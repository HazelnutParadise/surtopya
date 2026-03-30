package handlers

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/TimLai666/surtopya-api/internal/models"
	"github.com/google/uuid"
)

type snapshotPage struct {
	section   *surveySnapshotQuestion
	questions []surveySnapshotQuestion
}

func buildSnapshotPages(questions []surveySnapshotQuestion) []snapshotPage {
	pages := make([]snapshotPage, 0)

	for _, question := range questions {
		if question.Type == "section" {
			section := question
			pages = append(pages, snapshotPage{section: &section, questions: []surveySnapshotQuestion{}})
			continue
		}

		if len(pages) == 0 {
			pages = append(pages, snapshotPage{})
		}

		pages[len(pages)-1].questions = append(pages[len(pages)-1].questions, question)
	}

	if len(pages) == 0 && len(questions) > 0 {
		pages = append(pages, snapshotPage{questions: questions})
	}

	return pages
}

func findSnapshotPageIndex(pages []snapshotPage, questionID uuid.UUID) int {
	for pageIndex, page := range pages {
		if page.section != nil && page.section.ID == questionID {
			return pageIndex
		}
		for _, question := range page.questions {
			if question.ID == questionID {
				return pageIndex
			}
		}
	}
	return -1
}

func getChoiceConditionsForResponseValidation(question surveySnapshotQuestion, rule models.LogicRule) []models.LogicCondition {
	if len(rule.Conditions) > 0 {
		conditions := make([]models.LogicCondition, 0, len(rule.Conditions))
		for _, condition := range rule.Conditions {
			if condition.Kind == "scalar" || strings.TrimSpace(condition.Comparator) != "" {
				continue
			}
			if strings.TrimSpace(condition.OptionID) == "" {
				continue
			}
			match := "includes"
			if condition.Match == "excludes" {
				match = "excludes"
			}
			conditions = append(conditions, models.LogicCondition{
				Kind:     "choice",
				OptionID: strings.TrimSpace(condition.OptionID),
				Match:    match,
			})
		}
		return conditions
	}

	triggerOption := strings.TrimSpace(rule.TriggerOption)
	if triggerOption == "" {
		return nil
	}

	for _, option := range question.Options {
		if strings.TrimSpace(option.Label) == triggerOption && strings.TrimSpace(option.ID) != "" {
			return []models.LogicCondition{{
				Kind:     "choice",
				OptionID: strings.TrimSpace(option.ID),
				Match:    "includes",
			}}
		}
	}

	return nil
}

func getScalarConditionForResponseValidation(rule models.LogicRule) *models.LogicCondition {
	for _, condition := range rule.Conditions {
		if condition.Kind == "scalar" || strings.TrimSpace(condition.Comparator) != "" {
			comparator := strings.TrimSpace(condition.Comparator)
			if comparator == "" {
				comparator = "lt"
			}
			return &models.LogicCondition{
				Kind:           "scalar",
				Comparator:     comparator,
				Value:          strings.TrimSpace(condition.Value),
				SecondaryValue: strings.TrimSpace(condition.SecondaryValue),
			}
		}
	}
	return nil
}

func resolveSelectedOptionIDs(question surveySnapshotQuestion, answer models.AnswerValue) []string {
	selected := make([]string, 0, len(answer.Values)+1)

	appendMatch := func(raw string) {
		trimmed := strings.TrimSpace(raw)
		if trimmed == "" {
			return
		}
		for _, option := range question.Options {
			if strings.TrimSpace(option.ID) == trimmed || strings.TrimSpace(option.Label) == trimmed {
				selected = append(selected, strings.TrimSpace(option.ID))
				return
			}
		}
	}

	if answer.Value != nil {
		appendMatch(*answer.Value)
	}
	for _, value := range answer.Values {
		appendMatch(value)
	}

	return selected
}

func responseScalarConditionMatches(question surveySnapshotQuestion, answer models.AnswerValue, condition models.LogicCondition) bool {
	switch question.Type {
	case "rating":
		if answer.Rating == nil {
			return false
		}
		primary, err := strconv.ParseFloat(condition.Value, 64)
		if err != nil {
			return false
		}
		value := float64(*answer.Rating)
		switch condition.Comparator {
		case "gt":
			return value > primary
		case "between":
			secondary, err := strconv.ParseFloat(condition.SecondaryValue, 64)
			return err == nil && value >= primary && value <= secondary
		case "not_between":
			secondary, err := strconv.ParseFloat(condition.SecondaryValue, 64)
			return err == nil && (value < primary || value > secondary)
		default:
			return value < primary
		}
	case "date":
		if answer.Date == nil {
			return false
		}
		value := strings.TrimSpace(*answer.Date)
		if value == "" {
			return false
		}
		switch condition.Comparator {
		case "gt":
			return value > condition.Value
		case "between":
			return condition.SecondaryValue != "" && value >= condition.Value && value <= condition.SecondaryValue
		case "not_between":
			return condition.SecondaryValue != "" && (value < condition.Value || value > condition.SecondaryValue)
		default:
			return value < condition.Value
		}
	default:
		return false
	}
}

func responseLogicRuleMatches(question surveySnapshotQuestion, answer models.AnswerValue, rule models.LogicRule) bool {
	switch question.Type {
	case "single", "select", "multi":
		selectedOptionIDs := resolveSelectedOptionIDs(question, answer)
		if len(selectedOptionIDs) == 0 {
			return false
		}
		conditions := getChoiceConditionsForResponseValidation(question, rule)
		if len(conditions) == 0 {
			return false
		}
		operator := strings.TrimSpace(rule.Operator)
		if operator == "and" {
			for _, condition := range conditions {
				includes := false
				for _, optionID := range selectedOptionIDs {
					if optionID == condition.OptionID {
						includes = true
						break
					}
				}
				if condition.Match == "includes" && !includes {
					return false
				}
				if condition.Match == "excludes" && includes {
					return false
				}
			}
			return true
		}

		for _, condition := range conditions {
			includes := false
			for _, optionID := range selectedOptionIDs {
				if optionID == condition.OptionID {
					includes = true
					break
				}
			}
			if condition.Match == "includes" && includes {
				return true
			}
			if condition.Match == "excludes" && !includes {
				return true
			}
		}
		return false
	case "rating", "date":
		condition := getScalarConditionForResponseValidation(rule)
		if condition == nil {
			return false
		}
		return responseScalarConditionMatches(question, answer, *condition)
	default:
		return false
	}
}

func resolveNextSnapshotPageIndex(pages []snapshotPage, currentPageIndex int, answers map[uuid.UUID]models.AnswerValue) int {
	if currentPageIndex < 0 || currentPageIndex >= len(pages) {
		return -1
	}

	page := pages[currentPageIndex]
	var matchedRule *models.LogicRule

	for _, question := range page.questions {
		answer, ok := answers[question.ID]
		if !ok {
			continue
		}
		for _, rule := range question.Logic {
			if responseLogicRuleMatches(question, answer, rule) {
				ruleCopy := rule
				matchedRule = &ruleCopy
			}
		}
	}

	if matchedRule != nil {
		destinationID := strings.TrimSpace(matchedRule.DestinationQuestionID)
		if destinationID == "end_survey" {
			return -1
		}
		for index, candidatePage := range pages {
			if candidatePage.section != nil && candidatePage.section.ID.String() == destinationID {
				return index
			}
		}
	}

	if page.section != nil && page.section.DefaultDestinationQuestionID != nil {
		destinationID := strings.TrimSpace(*page.section.DefaultDestinationQuestionID)
		if destinationID != "" {
			for index, candidatePage := range pages {
				if candidatePage.section != nil && candidatePage.section.ID.String() == destinationID {
					return index
				}
			}
		}
	}

	if currentPageIndex+1 < len(pages) {
		return currentPageIndex + 1
	}
	return -1
}

func getVisitedSnapshotPageIndexes(snapshot surveySnapshot, answers map[uuid.UUID]models.AnswerValue) []int {
	pages := buildSnapshotPages(snapshot.Questions)
	if len(pages) == 0 {
		return nil
	}

	visited := []int{0}
	seen := map[int]struct{}{0: {}}
	currentPageIndex := 0

	for {
		nextPageIndex := resolveNextSnapshotPageIndex(pages, currentPageIndex, answers)
		if nextPageIndex == -1 {
			break
		}
		if nextPageIndex <= currentPageIndex {
			break
		}
		if _, exists := seen[nextPageIndex]; exists {
			break
		}
		visited = append(visited, nextPageIndex)
		seen[nextPageIndex] = struct{}{}
		currentPageIndex = nextPageIndex
	}

	return visited
}

func hasMultiSelectionBoundsViolation(question surveySnapshotQuestion, answer models.AnswerValue) bool {
	if question.Type != "multi" {
		return false
	}

	selectedCount := len(answer.Values)
	if selectedCount == 0 {
		return false
	}

	if question.MinSelections != nil && selectedCount < *question.MinSelections {
		return true
	}
	if question.MaxSelections != nil && selectedCount > *question.MaxSelections {
		return true
	}
	return false
}

func validateSurveyCompletion(snapshot surveySnapshot, answers map[uuid.UUID]models.AnswerValue) error {
	pages := buildSnapshotPages(snapshot.Questions)
	visitedPageIndexes := getVisitedSnapshotPageIndexes(snapshot, answers)

	for _, pageIndex := range visitedPageIndexes {
		if pageIndex < 0 || pageIndex >= len(pages) {
			continue
		}
		for _, question := range pages[pageIndex].questions {
			answer, answered := answers[question.ID]
			if question.Required {
				if !answered || isAnswerValueEmpty(answer) {
					return fmt.Errorf("required question is missing")
				}
			}
			if answered {
				if answerSelectsRequiredSupplementalOption(question, answer) {
					if answer.OtherText == nil || strings.TrimSpace(*answer.OtherText) == "" {
						return fmt.Errorf("Supplemental text is required for the selected option")
					}
				}
				if hasMultiSelectionBoundsViolation(question, answer) {
					return fmt.Errorf("Selection count is outside the allowed range")
				}
			}
		}
	}

	return nil
}

func normalizeAnswerTimeValue(value *string) *time.Time {
	if value == nil {
		return nil
	}
	parsed, err := time.Parse(time.RFC3339, *value)
	if err != nil {
		return nil
	}
	return &parsed
}
