package surveyanalytics

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/TimLai666/surtopya-api/internal/models"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func snapshotForTest(t *testing.T, questions ...map[string]any) json.RawMessage {
	t.Helper()

	payload, err := json.Marshal(map[string]any{
		"title":             "Survey",
		"description":       "Description",
		"visibility":        "public",
		"includeInDatasets": true,
		"pointsReward":      0,
		"questions":         questions,
	})
	require.NoError(t, err)
	return payload
}

func completedResponseForTest(versionNumber int, completedAt time.Time, answers ...models.Answer) models.Response {
	return models.Response{
		ID:                  uuid.New(),
		SurveyID:            uuid.New(),
		SurveyVersionID:     uuid.New(),
		SurveyVersionNumber: versionNumber,
		Status:              "completed",
		CreatedAt:           completedAt,
		CompletedAt:         &completedAt,
		Answers:             answers,
	}
}

func answerForTest(questionID uuid.UUID, value models.AnswerValue) models.Answer {
	return models.Answer{
		ID:         uuid.New(),
		ResponseID: uuid.New(),
		QuestionID: questionID,
		Value:      value,
		CreatedAt:  time.Now().UTC(),
	}
}

func TestBuildReport_AllVersionsMergesQuestionsAndPreservesLegacyOptions(t *testing.T) {
	questionID := uuid.New()
	now := time.Now().UTC()

	versions := []models.SurveyVersion{
		{
			ID:            uuid.New(),
			SurveyID:      uuid.New(),
			VersionNumber: 2,
			Snapshot: snapshotForTest(t, map[string]any{
				"id":        questionID,
				"type":      "single",
				"title":     "Favorite color",
				"options":   []string{"Blue", "Green"},
				"required":  false,
				"sortOrder": 0,
			}),
		},
		{
			ID:            uuid.New(),
			SurveyID:      uuid.New(),
			VersionNumber: 1,
			Snapshot: snapshotForTest(t, map[string]any{
				"id":        questionID,
				"type":      "single",
				"title":     "Favorite color",
				"options":   []string{"Red", "Blue"},
				"required":  false,
				"sortOrder": 0,
			}),
		},
	}

	responses := []models.Response{
		completedResponseForTest(1, now.Add(-2*time.Hour), answerForTest(questionID, models.AnswerValue{Value: ptr("Red")})),
		completedResponseForTest(2, now.Add(-time.Hour), answerForTest(questionID, models.AnswerValue{Value: ptr("Blue")})),
	}

	report, err := BuildReport(versions, responses, BuildOptions{
		SelectedVersion:      "all",
		IncludeTextResponses: true,
		GeneratedAt:          now,
	})
	require.NoError(t, err)
	require.Equal(t, "all", report.SelectedVersion)
	require.Equal(t, []int{2, 1}, report.AvailableVersions)
	require.Equal(t, 2, report.Summary.TotalCompletedResponses)
	require.Equal(t, 1, report.Summary.QuestionCount)
	require.Len(t, report.Pages, 1)
	require.Equal(t, []string{questionID.String()}, pageQuestionIDs(report.Pages[0]))
	require.Equal(t, []string{"Blue", "Green", "Red"}, bucketLabels(report.Pages[0].Questions[0].OptionCounts))
	require.Equal(t, []int{1, 0, 1}, bucketCounts(report.Pages[0].Questions[0].OptionCounts))
}

func TestBuildReport_AggregatesStructuredOtherOptionsAcrossVersions(t *testing.T) {
	questionID := uuid.New()
	now := time.Now().UTC()

	versions := []models.SurveyVersion{
		{
			ID:            uuid.New(),
			SurveyID:      uuid.New(),
			VersionNumber: 2,
			Snapshot: snapshotForTest(t, map[string]any{
				"id":    questionID,
				"type":  "single",
				"title": "Favorite color",
				"options": []map[string]any{
					{"label": "Red"},
					{"label": "Other", "isOther": true},
				},
				"required":  false,
				"sortOrder": 0,
			}),
		},
		{
			ID:            uuid.New(),
			SurveyID:      uuid.New(),
			VersionNumber: 1,
			Snapshot: snapshotForTest(t, map[string]any{
				"id":    questionID,
				"type":  "single",
				"title": "Favorite color",
				"options": []map[string]any{
					{"label": "Red"},
					{"label": "Something else", "isOther": true},
				},
				"required":  false,
				"sortOrder": 0,
			}),
		},
	}

	responses := []models.Response{
		completedResponseForTest(1, now.Add(-2*time.Hour), answerForTest(questionID, models.AnswerValue{Value: ptr("Something else")})),
		completedResponseForTest(2, now.Add(-time.Hour), answerForTest(questionID, models.AnswerValue{Value: ptr("Other")})),
	}

	report, err := BuildReport(versions, responses, BuildOptions{
		SelectedVersion:      "all",
		IncludeTextResponses: true,
		GeneratedAt:          now,
	})
	require.NoError(t, err)
	require.Len(t, report.Pages, 1)
	require.Equal(t, []string{"Red", "Other"}, bucketLabels(report.Pages[0].Questions[0].OptionCounts))
	require.Equal(t, []int{0, 2}, bucketCounts(report.Pages[0].Questions[0].OptionCounts))
}

func TestBuildReport_SingleVersionFiltersResultsAndRedactsTextResponsesWhenDisabled(t *testing.T) {
	questionID := uuid.New()
	now := time.Now().UTC()

	versions := []models.SurveyVersion{
		{
			ID:            uuid.New(),
			SurveyID:      uuid.New(),
			VersionNumber: 2,
			Snapshot: snapshotForTest(t, map[string]any{
				"id":        questionID,
				"type":      "text",
				"title":     "Comment",
				"required":  false,
				"sortOrder": 0,
			}),
		},
		{
			ID:            uuid.New(),
			SurveyID:      uuid.New(),
			VersionNumber: 1,
			Snapshot: snapshotForTest(t, map[string]any{
				"id":        questionID,
				"type":      "text",
				"title":     "Comment",
				"required":  false,
				"sortOrder": 0,
			}),
		},
	}

	responses := []models.Response{
		completedResponseForTest(1, now.Add(-2*time.Hour), answerForTest(questionID, models.AnswerValue{Text: ptr("version one")})),
		completedResponseForTest(2, now.Add(-time.Hour), answerForTest(questionID, models.AnswerValue{Text: ptr("version two")})),
	}

	report, err := BuildReport(versions, responses, BuildOptions{
		SelectedVersion:      "1",
		IncludeTextResponses: false,
		GeneratedAt:          now,
	})
	require.NoError(t, err)
	require.Equal(t, "1", report.SelectedVersion)
	require.Equal(t, 1, report.Summary.TotalCompletedResponses)
	require.Len(t, report.Pages, 1)
	require.Equal(t, 1, report.Pages[0].Questions[0].ResponseCount)
	require.Empty(t, report.Pages[0].Questions[0].TextResponses)
	require.False(t, report.Pages[0].Questions[0].HasMoreResponses)
}

func TestBuildReport_SelectedVersionChangesCountsAndBuckets(t *testing.T) {
	questionID := uuid.New()
	now := time.Now().UTC()

	versions := []models.SurveyVersion{
		{
			ID:            uuid.New(),
			SurveyID:      uuid.New(),
			VersionNumber: 2,
			Snapshot: snapshotForTest(t, map[string]any{
				"id":        questionID,
				"type":      "single",
				"title":     "Favorite color",
				"options":   []string{"Red", "Blue"},
				"required":  false,
				"sortOrder": 0,
			}),
		},
		{
			ID:            uuid.New(),
			SurveyID:      uuid.New(),
			VersionNumber: 1,
			Snapshot: snapshotForTest(t, map[string]any{
				"id":        questionID,
				"type":      "single",
				"title":     "Favorite color",
				"options":   []string{"Red", "Blue"},
				"required":  false,
				"sortOrder": 0,
			}),
		},
	}

	responses := []models.Response{
		completedResponseForTest(1, now.Add(-2*time.Hour), answerForTest(questionID, models.AnswerValue{Value: ptr("Red")})),
		completedResponseForTest(2, now.Add(-time.Hour), answerForTest(questionID, models.AnswerValue{Value: ptr("Blue")})),
	}

	reportV1, err := BuildReport(versions, responses, BuildOptions{
		SelectedVersion:      "1",
		IncludeTextResponses: true,
		GeneratedAt:          now,
	})
	require.NoError(t, err)

	reportV2, err := BuildReport(versions, responses, BuildOptions{
		SelectedVersion:      "2",
		IncludeTextResponses: true,
		GeneratedAt:          now,
	})
	require.NoError(t, err)

	require.Equal(t, "1", reportV1.SelectedVersion)
	require.Equal(t, "2", reportV2.SelectedVersion)
	require.Equal(t, 1, reportV1.Summary.TotalCompletedResponses)
	require.Equal(t, 1, reportV2.Summary.TotalCompletedResponses)
	require.Len(t, reportV1.Pages, 1)
	require.Len(t, reportV2.Pages, 1)
	require.Equal(t, []int{1, 0}, bucketCounts(reportV1.Pages[0].Questions[0].OptionCounts))
	require.Equal(t, []int{0, 1}, bucketCounts(reportV2.Pages[0].Questions[0].OptionCounts))
}

func TestBuildReport_TextQuestionKeepsNewestTwentyResponses(t *testing.T) {
	questionID := uuid.New()
	now := time.Now().UTC()

	versions := []models.SurveyVersion{
		{
			ID:            uuid.New(),
			SurveyID:      uuid.New(),
			VersionNumber: 1,
			Snapshot: snapshotForTest(t, map[string]any{
				"id":        questionID,
				"type":      "long",
				"title":     "Detailed feedback",
				"required":  false,
				"sortOrder": 0,
			}),
		},
	}

	responses := make([]models.Response, 0, 22)
	for i := 0; i < 22; i++ {
		label := time.Date(2026, 1, 1, 0, 0, i, 0, time.UTC).Format(time.RFC3339)
		responses = append(responses, completedResponseForTest(
			1,
			now.Add(time.Duration(i)*time.Minute),
			answerForTest(questionID, models.AnswerValue{Text: ptr(label)}),
		))
	}

	report, err := BuildReport(versions, responses, BuildOptions{
		SelectedVersion:      "all",
		IncludeTextResponses: true,
		GeneratedAt:          now,
	})
	require.NoError(t, err)
	require.Len(t, report.Pages, 1)
	require.Equal(t, 22, report.Pages[0].Questions[0].ResponseCount)
	require.Len(t, report.Pages[0].Questions[0].TextResponses, 20)
	require.Equal(t, "2026-01-01T00:00:21Z", report.Pages[0].Questions[0].TextResponses[0])
	require.True(t, report.Pages[0].Questions[0].HasMoreResponses)
}

func TestBuildReport_SkipsQuestionWhenTypeChangesAcrossVersionsInAllScope(t *testing.T) {
	questionID := uuid.New()
	now := time.Now().UTC()

	versions := []models.SurveyVersion{
		{
			ID:            uuid.New(),
			SurveyID:      uuid.New(),
			VersionNumber: 2,
			Snapshot: snapshotForTest(t, map[string]any{
				"id":        questionID,
				"type":      "text",
				"title":     "Answer",
				"required":  false,
				"sortOrder": 0,
			}),
		},
		{
			ID:            uuid.New(),
			SurveyID:      uuid.New(),
			VersionNumber: 1,
			Snapshot: snapshotForTest(t, map[string]any{
				"id":        questionID,
				"type":      "single",
				"title":     "Answer",
				"options":   []string{"Yes", "No"},
				"required":  false,
				"sortOrder": 0,
			}),
		},
	}

	report, err := BuildReport(versions, nil, BuildOptions{
		SelectedVersion:      "all",
		IncludeTextResponses: true,
		GeneratedAt:          now,
	})
	require.NoError(t, err)
	require.Empty(t, report.Pages)
	require.Len(t, report.Warnings, 1)
	require.NotEmpty(t, report.Warnings)
	require.Contains(t, report.Warnings[0], questionID.String())
}

func TestBuildReport_GroupsQuestionsIntoPagesUsingSections(t *testing.T) {
	introQuestionID := uuid.New()
	sectionOneID := uuid.New()
	detailQuestionID := uuid.New()
	ratingQuestionID := uuid.New()
	sectionTwoID := uuid.New()
	dateQuestionID := uuid.New()
	now := time.Now().UTC()

	versions := []models.SurveyVersion{
		{
			ID:            uuid.New(),
			SurveyID:      uuid.New(),
			VersionNumber: 1,
			Snapshot: snapshotForTest(t,
				map[string]any{
					"id":        introQuestionID,
					"type":      "short",
					"title":     "Intro",
					"required":  false,
					"sortOrder": 0,
				},
				map[string]any{
					"id":          sectionOneID,
					"type":        "section",
					"title":       "Details",
					"description": "Provide details",
					"required":    false,
					"sortOrder":   1,
				},
				map[string]any{
					"id":        detailQuestionID,
					"type":      "long",
					"title":     "More detail",
					"required":  false,
					"sortOrder": 2,
				},
				map[string]any{
					"id":        ratingQuestionID,
					"type":      "rating",
					"title":     "Satisfaction",
					"maxRating": 5,
					"required":  false,
					"sortOrder": 3,
				},
				map[string]any{
					"id":        sectionTwoID,
					"type":      "section",
					"title":     "Schedule",
					"required":  false,
					"sortOrder": 4,
				},
				map[string]any{
					"id":        dateQuestionID,
					"type":      "date",
					"title":     "Visit date",
					"required":  false,
					"sortOrder": 5,
				},
			),
		},
	}

	report, err := BuildReport(versions, nil, BuildOptions{
		SelectedVersion:      "all",
		IncludeTextResponses: true,
		GeneratedAt:          now,
	})
	require.NoError(t, err)
	require.Equal(t, 4, report.Summary.QuestionCount)
	require.Len(t, report.Pages, 3)
	require.Equal(t, []string{"", "Details", "Schedule"}, pageTitles(report.Pages))
	require.Equal(t, []string{introQuestionID.String()}, pageQuestionIDs(report.Pages[0]))
	require.Equal(t, []string{detailQuestionID.String(), ratingQuestionID.String()}, pageQuestionIDs(report.Pages[1]))
	require.Equal(t, []string{dateQuestionID.String()}, pageQuestionIDs(report.Pages[2]))
	require.Equal(t, 1, report.Pages[0].QuestionCount)
	require.Equal(t, 2, report.Pages[1].QuestionCount)
	require.Equal(t, 1, report.Pages[2].QuestionCount)
	require.Equal(t, "Provide details", deref(report.Pages[1].Description))
}

func TestBuildReport_RatingQuestionIncludesDistributionAndAverage(t *testing.T) {
	questionID := uuid.New()
	now := time.Now().UTC()

	versions := []models.SurveyVersion{
		{
			ID:            uuid.New(),
			SurveyID:      uuid.New(),
			VersionNumber: 1,
			Snapshot: snapshotForTest(t, map[string]any{
				"id":        questionID,
				"type":      "rating",
				"title":     "Satisfaction",
				"maxRating": 5,
				"required":  false,
				"sortOrder": 0,
			}),
		},
	}

	responses := []models.Response{
		completedResponseForTest(1, now.Add(-3*time.Hour), answerForTest(questionID, models.AnswerValue{Rating: intPtr(5)})),
		completedResponseForTest(1, now.Add(-2*time.Hour), answerForTest(questionID, models.AnswerValue{Rating: intPtr(3)})),
		completedResponseForTest(1, now.Add(-time.Hour), answerForTest(questionID, models.AnswerValue{Rating: intPtr(8)})),
	}

	report, err := BuildReport(versions, responses, BuildOptions{
		SelectedVersion:      "all",
		IncludeTextResponses: true,
		GeneratedAt:          now,
	})
	require.NoError(t, err)
	require.Len(t, report.Pages, 1)
	require.Equal(t, []string{"1", "2", "3", "4", "5"}, bucketLabels(report.Pages[0].Questions[0].OptionCounts))
	require.Equal(t, []int{0, 0, 1, 0, 1}, bucketCounts(report.Pages[0].Questions[0].OptionCounts))
	require.NotNil(t, report.Pages[0].Questions[0].AverageRating)
	require.Equal(t, 4.0, *report.Pages[0].Questions[0].AverageRating)
}

func TestBuildReport_ReturnsErrVersionNotFound(t *testing.T) {
	now := time.Now().UTC()

	versions := []models.SurveyVersion{
		{
			ID:            uuid.New(),
			SurveyID:      uuid.New(),
			VersionNumber: 1,
			Snapshot:      snapshotForTest(t),
		},
	}

	_, err := BuildReport(versions, nil, BuildOptions{
		SelectedVersion:      "9",
		IncludeTextResponses: true,
		GeneratedAt:          now,
	})
	require.ErrorIs(t, err, ErrVersionNotFound)
}

func bucketLabels(buckets []OptionCount) []string {
	labels := make([]string, 0, len(buckets))
	for _, bucket := range buckets {
		labels = append(labels, bucket.Label)
	}
	return labels
}

func bucketCounts(buckets []OptionCount) []int {
	counts := make([]int, 0, len(buckets))
	for _, bucket := range buckets {
		counts = append(counts, bucket.Count)
	}
	return counts
}

func pageTitles(pages []PageAnalytics) []string {
	titles := make([]string, 0, len(pages))
	for _, page := range pages {
		titles = append(titles, page.Title)
	}
	return titles
}

func pageQuestionIDs(page PageAnalytics) []string {
	questionIDs := make([]string, 0, len(page.Questions))
	for _, question := range page.Questions {
		questionIDs = append(questionIDs, question.QuestionID)
	}
	return questionIDs
}

func ptr(value string) *string {
	return &value
}

func intPtr(value int) *int {
	return &value
}
