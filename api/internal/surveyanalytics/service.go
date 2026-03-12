package surveyanalytics

import (
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/HazelnutParadise/insyra"
	"github.com/TimLai666/surtopya-api/internal/models"
	"github.com/google/uuid"
)

var (
	// ErrVersionNotFound indicates the requested survey version was not found.
	ErrVersionNotFound = errors.New("survey version not found")

	configureInsyraOnce sync.Once
)

// BuildOptions controls report generation.
type BuildOptions struct {
	SelectedVersion      string
	IncludeTextResponses bool
	GeneratedAt          time.Time
}

// Report is the analytics payload shared by owner and agent-admin handlers.
type Report struct {
	SelectedVersion   string
	AvailableVersions []int
	Summary           Summary
	Questions         []QuestionAnalytics
	Warnings          []string
}

// Summary provides top-level analytics metadata.
type Summary struct {
	TotalCompletedResponses int
	QuestionCount           int
	GeneratedAt             time.Time
}

// QuestionAnalytics describes per-question analytics.
type QuestionAnalytics struct {
	QuestionID       string
	Title            string
	Description      *string
	QuestionType     string
	ResponseCount    int
	OptionCounts     []OptionCount
	AverageRating    *float64
	MaxRating        *int
	TextResponses    []string
	HasMoreResponses bool
}

// OptionCount holds a single option bucket.
type OptionCount struct {
	Label      string
	Count      int
	Percentage float64
}

type snapshotQuestion struct {
	ID          uuid.UUID `json:"id"`
	Type        string    `json:"type"`
	Title       string    `json:"title"`
	Description *string   `json:"description,omitempty"`
	Options     []string  `json:"options,omitempty"`
	Required    bool      `json:"required"`
	MaxRating   int       `json:"maxRating,omitempty"`
	SortOrder   int       `json:"sortOrder"`
}

type snapshotVersion struct {
	Questions []snapshotQuestion `json:"questions"`
}

type questionMeta struct {
	ID          uuid.UUID
	Type        string
	Title       string
	Description *string
	Options     []string
	MaxRating   int
	SortOrder   int
}

type textSample struct {
	Text string
	At   time.Time
}

// BuildReport builds analytics from published survey versions and collected responses.
func BuildReport(versions []models.SurveyVersion, responses []models.Response, opts BuildOptions) (Report, error) {
	configureInsyra()

	selectedVersion := strings.TrimSpace(opts.SelectedVersion)
	if selectedVersion == "" {
		selectedVersion = "all"
	}
	if opts.GeneratedAt.IsZero() {
		opts.GeneratedAt = time.Now().UTC()
	}

	sortedVersions := append([]models.SurveyVersion(nil), versions...)
	sort.Slice(sortedVersions, func(i, j int) bool {
		return sortedVersions[i].VersionNumber > sortedVersions[j].VersionNumber
	})

	report := Report{
		SelectedVersion:   selectedVersion,
		AvailableVersions: make([]int, 0, len(sortedVersions)),
		Summary: Summary{
			GeneratedAt: opts.GeneratedAt,
		},
	}
	for _, version := range sortedVersions {
		report.AvailableVersions = append(report.AvailableVersions, version.VersionNumber)
	}

	selectedVersions, err := filterVersions(sortedVersions, selectedVersion)
	if err != nil {
		return Report{}, err
	}

	questionOrder, questionMetaByID, incompatibleIDs, warnings, err := questionSelection(selectedVersions)
	if err != nil {
		return Report{}, err
	}
	report.Warnings = append(report.Warnings, warnings...)

	filteredResponses := completedResponsesForVersion(responses, selectedVersion)
	report.Summary.TotalCompletedResponses = len(filteredResponses)

	questions := make([]QuestionAnalytics, 0, len(questionOrder))
	for _, questionID := range questionOrder {
		meta := questionMetaByID[questionID]
		if incompatibleIDs[questionID] {
			continue
		}

		analytics := QuestionAnalytics{
			QuestionID:   questionID.String(),
			Title:        meta.Title,
			Description:  meta.Description,
			QuestionType: meta.Type,
		}

		switch meta.Type {
		case "single", "select":
			analytics = buildChoiceAnalytics(meta, filteredResponses, false)
		case "multi":
			analytics = buildChoiceAnalytics(meta, filteredResponses, true)
		case "rating":
			analytics = buildRatingAnalytics(meta, filteredResponses)
		case "date":
			analytics = buildDateAnalytics(meta, filteredResponses)
		case "text", "short", "long":
			analytics = buildTextAnalytics(meta, filteredResponses, opts.IncludeTextResponses)
		default:
			continue
		}

		analytics.QuestionID = questionID.String()
		analytics.Title = meta.Title
		analytics.Description = meta.Description
		analytics.QuestionType = meta.Type
		questions = append(questions, analytics)
	}

	report.Questions = questions
	report.Summary.QuestionCount = len(report.Questions)
	return report, nil
}

func configureInsyra() {
	configureInsyraOnce.Do(func() {
		insyra.Config.SetDontPanic(true)
	})
}

func filterVersions(versions []models.SurveyVersion, selectedVersion string) ([]models.SurveyVersion, error) {
	if selectedVersion == "all" {
		return versions, nil
	}

	versionNumber, err := strconv.Atoi(selectedVersion)
	if err != nil || versionNumber < 1 {
		return nil, ErrVersionNotFound
	}

	for _, version := range versions {
		if version.VersionNumber == versionNumber {
			return []models.SurveyVersion{version}, nil
		}
	}
	return nil, ErrVersionNotFound
}

func questionSelection(versions []models.SurveyVersion) ([]uuid.UUID, map[uuid.UUID]questionMeta, map[uuid.UUID]bool, []string, error) {
	order := make([]uuid.UUID, 0)
	metaByID := make(map[uuid.UUID]questionMeta)
	typeByID := make(map[uuid.UUID]map[string]struct{})
	warnings := make([]string, 0)

	for _, version := range versions {
		questions, err := parseSnapshotQuestions(version.Snapshot)
		if err != nil {
			return nil, nil, nil, nil, err
		}

		sort.SliceStable(questions, func(i, j int) bool {
			return questions[i].SortOrder < questions[j].SortOrder
		})

		for _, question := range questions {
			if question.Type == "section" {
				continue
			}

			if _, exists := metaByID[question.ID]; !exists {
				order = append(order, question.ID)
				metaByID[question.ID] = questionMeta{
					ID:          question.ID,
					Type:        question.Type,
					Title:       question.Title,
					Description: question.Description,
					Options:     append([]string(nil), question.Options...),
					MaxRating:   question.MaxRating,
					SortOrder:   question.SortOrder,
				}
			}
			if _, exists := typeByID[question.ID]; !exists {
				typeByID[question.ID] = make(map[string]struct{})
			}
			typeByID[question.ID][question.Type] = struct{}{}
		}
	}

	incompatibleIDs := make(map[uuid.UUID]bool)
	for questionID, typeSet := range typeByID {
		if len(typeSet) > 1 {
			incompatibleIDs[questionID] = true
			warnings = append(warnings, fmt.Sprintf("Question %s changed type across selected versions and was skipped.", questionID))
		}
	}

	return order, metaByID, incompatibleIDs, warnings, nil
}

func parseSnapshotQuestions(snapshot json.RawMessage) ([]snapshotQuestion, error) {
	var parsed snapshotVersion
	if len(snapshot) == 0 {
		return []snapshotQuestion{}, nil
	}
	if err := json.Unmarshal(snapshot, &parsed); err != nil {
		return nil, fmt.Errorf("decode survey version snapshot: %w", err)
	}
	return parsed.Questions, nil
}

func completedResponsesForVersion(responses []models.Response, selectedVersion string) []models.Response {
	filtered := make([]models.Response, 0, len(responses))
	for _, response := range responses {
		if response.Status != "completed" {
			continue
		}
		if selectedVersion != "all" && strconv.Itoa(response.SurveyVersionNumber) != selectedVersion {
			continue
		}
		filtered = append(filtered, response)
	}
	return filtered
}

func buildChoiceAnalytics(meta questionMeta, responses []models.Response, multiple bool) QuestionAnalytics {
	values := make([]any, 0)
	answeredCount := 0

	for _, response := range responses {
		answer, ok := answerForQuestion(response.Answers, meta.ID)
		if !ok {
			continue
		}

		if multiple {
			normalized := normalizeMultiValues(answer.Value.Values)
			if len(normalized) == 0 {
				continue
			}
			answeredCount++
			for _, value := range normalized {
				values = append(values, value)
			}
			continue
		}

		normalized := strings.TrimSpace(deref(answer.Value.Value))
		if normalized == "" {
			continue
		}
		answeredCount++
		values = append(values, normalized)
	}

	counter := insyra.NewDataList(values...).Counter()
	bucketOrder := appendKnownAndLegacyOptions(meta.Options, counter)

	return QuestionAnalytics{
		ResponseCount: answeredCount,
		OptionCounts:  buildBucketsFromStrings(bucketOrder, counter, answeredCount),
	}
}

func buildRatingAnalytics(meta questionMeta, responses []models.Response) QuestionAnalytics {
	maxRating := meta.MaxRating
	if maxRating < 1 {
		maxRating = 5
	}

	values := make([]any, 0)
	answeredCount := 0
	for _, response := range responses {
		answer, ok := answerForQuestion(response.Answers, meta.ID)
		if !ok || answer.Value.Rating == nil {
			continue
		}
		if *answer.Value.Rating < 1 || *answer.Value.Rating > maxRating {
			continue
		}
		answeredCount++
		values = append(values, *answer.Value.Rating)
	}

	counter := insyra.NewDataList(values...).Counter()
	result := QuestionAnalytics{
		ResponseCount: answeredCount,
		MaxRating:     &maxRating,
		OptionCounts:  make([]OptionCount, 0, maxRating),
	}

	if answeredCount > 0 {
		averageList := insyra.NewDataList(values...)
		average := averageList.Mean()
		if averageList.Err() == nil {
			result.AverageRating = &average
		}
	}

	for rating := 1; rating <= maxRating; rating++ {
		count, _ := counter[rating]
		result.OptionCounts = append(result.OptionCounts, OptionCount{
			Label:      strconv.Itoa(rating),
			Count:      count,
			Percentage: percent(count, answeredCount),
		})
	}

	return result
}

func buildDateAnalytics(meta questionMeta, responses []models.Response) QuestionAnalytics {
	values := make([]any, 0)
	answeredCount := 0

	for _, response := range responses {
		answer, ok := answerForQuestion(response.Answers, meta.ID)
		if !ok {
			continue
		}
		normalized, ok := normalizeDate(answer.Value.Date)
		if !ok {
			continue
		}
		answeredCount++
		values = append(values, normalized)
	}

	counter := insyra.NewDataList(values...).Counter()
	labels := make([]string, 0, len(counter))
	for raw := range counter {
		label, ok := raw.(string)
		if ok {
			labels = append(labels, label)
		}
	}
	sort.Strings(labels)

	return QuestionAnalytics{
		ResponseCount: answeredCount,
		OptionCounts:  buildBucketsFromStrings(labels, counter, answeredCount),
	}
}

func buildTextAnalytics(meta questionMeta, responses []models.Response, includeSamples bool) QuestionAnalytics {
	samples := make([]textSample, 0)

	for _, response := range responses {
		answer, ok := answerForQuestion(response.Answers, meta.ID)
		if !ok {
			continue
		}
		text := strings.TrimSpace(deref(answer.Value.Text))
		if text == "" {
			continue
		}
		samples = append(samples, textSample{
			Text: text,
			At:   responseTimestamp(response),
		})
	}

	result := QuestionAnalytics{
		ResponseCount: len(samples),
	}
	if !includeSamples {
		return result
	}

	sort.Slice(samples, func(i, j int) bool {
		return samples[i].At.After(samples[j].At)
	})
	limit := min(20, len(samples))
	result.TextResponses = make([]string, 0, limit)
	for i := 0; i < limit; i++ {
		result.TextResponses = append(result.TextResponses, samples[i].Text)
	}
	result.HasMoreResponses = len(samples) > limit
	return result
}

func buildBucketsFromStrings(labels []string, counter map[any]int, answeredCount int) []OptionCount {
	buckets := make([]OptionCount, 0, len(labels))
	for _, label := range labels {
		buckets = append(buckets, OptionCount{
			Label:      label,
			Count:      counter[label],
			Percentage: percent(counter[label], answeredCount),
		})
	}
	return buckets
}

func appendKnownAndLegacyOptions(known []string, counter map[any]int) []string {
	result := make([]string, 0, len(known)+len(counter))
	seen := make(map[string]struct{}, len(known)+len(counter))

	for _, option := range known {
		normalized := strings.TrimSpace(option)
		if normalized == "" {
			continue
		}
		if _, exists := seen[normalized]; exists {
			continue
		}
		seen[normalized] = struct{}{}
		result = append(result, normalized)
	}

	legacy := make([]string, 0)
	for raw := range counter {
		label, ok := raw.(string)
		if !ok {
			continue
		}
		if _, exists := seen[label]; exists {
			continue
		}
		legacy = append(legacy, label)
	}
	sort.Strings(legacy)
	result = append(result, legacy...)
	return result
}

func normalizeMultiValues(values []string) []string {
	normalized := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		normalized = append(normalized, trimmed)
	}
	return normalized
}

func normalizeDate(value *string) (string, bool) {
	trimmed := strings.TrimSpace(deref(value))
	if trimmed == "" {
		return "", false
	}
	parsed, err := time.Parse("2006-01-02", trimmed)
	if err != nil {
		return "", false
	}
	return parsed.Format("2006-01-02"), true
}

func answerForQuestion(answers []models.Answer, questionID uuid.UUID) (models.Answer, bool) {
	for _, answer := range answers {
		if answer.QuestionID == questionID {
			return answer, true
		}
	}
	return models.Answer{}, false
}

func responseTimestamp(response models.Response) time.Time {
	if response.CompletedAt != nil {
		return *response.CompletedAt
	}
	return response.CreatedAt
}

func percent(count int, total int) float64 {
	if total <= 0 {
		return 0
	}
	return float64(count) * 100 / float64(total)
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func min(left int, right int) int {
	return slices.Min([]int{left, right})
}
