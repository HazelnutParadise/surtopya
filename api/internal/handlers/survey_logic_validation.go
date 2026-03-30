package handlers

import (
	"strconv"
	"strings"
	"time"

	"github.com/TimLai666/surtopya-api/internal/models"
)

func surveyHasPublishBlockingLogicIssues(questions []models.Question) bool {
	normalizedQuestions := make([]models.Question, len(questions))
	for index, question := range questions {
		normalizedQuestions[index] = normalizeQuestionForLogicValidation(question)
	}

	for _, question := range normalizedQuestions {
		if questionHasPublishBlockingLogicIssues(question, normalizedQuestions) {
			return true
		}
	}

	return false
}

func normalizeQuestionForLogicValidation(question models.Question) models.Question {
	normalized := question
	normalized.Options = question.Options.Clone()
	normalized.Logic = make([]models.LogicRule, 0, len(question.Logic))

	for _, rule := range question.Logic {
		normalized.Logic = append(normalized.Logic, normalizeLogicRuleForValidation(normalized, rule))
	}

	return normalized
}

func normalizeLogicRuleForValidation(question models.Question, rule models.LogicRule) models.LogicRule {
	normalizedConditions := make([]models.LogicCondition, 0, len(rule.Conditions))
	for _, condition := range rule.Conditions {
		normalizedCondition, ok := normalizeLogicConditionForValidation(condition)
		if ok {
			normalizedConditions = append(normalizedConditions, normalizedCondition)
		}
	}

	if len(normalizedConditions) > 0 {
		return models.LogicRule{
			TriggerOption:         rule.TriggerOption,
			Operator:              normalizeLogicOperator(rule.Operator),
			Conditions:            normalizedConditions,
			DestinationQuestionID: strings.TrimSpace(rule.DestinationQuestionID),
		}
	}

	triggerOption := strings.TrimSpace(rule.TriggerOption)
	if triggerOption != "" {
		if option := findQuestionOptionByLabelForValidation(question, triggerOption); option != nil && strings.TrimSpace(option.ID) != "" {
			return models.LogicRule{
				TriggerOption: triggerOption,
				Operator:      "or",
				Conditions: []models.LogicCondition{{
					Kind:     "choice",
					OptionID: strings.TrimSpace(option.ID),
					Match:    "includes",
				}},
				DestinationQuestionID: strings.TrimSpace(rule.DestinationQuestionID),
			}
		}
	}

	return models.LogicRule{
		TriggerOption:         triggerOption,
		Operator:              normalizeLogicOperator(rule.Operator),
		DestinationQuestionID: strings.TrimSpace(rule.DestinationQuestionID),
	}
}

func normalizeLogicConditionForValidation(condition models.LogicCondition) (models.LogicCondition, bool) {
	if condition.Kind == "scalar" || strings.TrimSpace(condition.Comparator) != "" {
		return models.LogicCondition{
			Kind:           "scalar",
			Comparator:     normalizeScalarComparator(condition.Comparator),
			Value:          strings.TrimSpace(condition.Value),
			SecondaryValue: strings.TrimSpace(condition.SecondaryValue),
		}, true
	}

	optionID := strings.TrimSpace(condition.OptionID)
	if optionID == "" {
		return models.LogicCondition{}, false
	}

	match := "includes"
	if condition.Match == "excludes" {
		match = "excludes"
	}

	return models.LogicCondition{
		Kind:     "choice",
		OptionID: optionID,
		Match:    match,
	}, true
}

func normalizeLogicOperator(value string) string {
	if value == "and" {
		return "and"
	}
	return "or"
}

func normalizeScalarComparator(value string) string {
	switch value {
	case "between", "not_between", "gt":
		return value
	default:
		return "lt"
	}
}

func getChoiceConditionsForValidation(rule models.LogicRule) []models.LogicCondition {
	conditions := make([]models.LogicCondition, 0, len(rule.Conditions))
	for _, condition := range rule.Conditions {
		if isChoiceConditionForValidation(condition) {
			conditions = append(conditions, condition)
		}
	}
	return conditions
}

func getScalarConditionsForValidation(rule models.LogicRule) []models.LogicCondition {
	conditions := make([]models.LogicCondition, 0, len(rule.Conditions))
	for _, condition := range rule.Conditions {
		if isScalarConditionForValidation(condition) {
			conditions = append(conditions, condition)
		}
	}
	return conditions
}

func isChoiceConditionForValidation(condition models.LogicCondition) bool {
	return !isScalarConditionForValidation(condition) && strings.TrimSpace(condition.OptionID) != ""
}

func isScalarConditionForValidation(condition models.LogicCondition) bool {
	return condition.Kind == "scalar" || strings.TrimSpace(condition.Comparator) != ""
}

func isContradictoryLogicRuleForValidation(rule models.LogicRule) bool {
	seen := map[string]string{}
	for _, condition := range getChoiceConditionsForValidation(rule) {
		optionID := strings.TrimSpace(condition.OptionID)
		previous, ok := seen[optionID]
		if ok && previous != condition.Match {
			return true
		}
		seen[optionID] = condition.Match
	}
	return false
}

func questionHasPublishBlockingLogicIssues(question models.Question, allQuestions []models.Question) bool {
	if question.Type == "section" {
		destinationID := ""
		if question.DefaultDestinationQuestionID != nil {
			destinationID = strings.TrimSpace(*question.DefaultDestinationQuestionID)
		}
		if destinationID == "" {
			return false
		}
		destinationIndex := -1
		for index, candidate := range allQuestions {
			if candidate.ID.String() == destinationID {
				destinationIndex = index
				break
			}
		}
		return destinationIndex == -1 || allQuestions[destinationIndex].Type != "section" || findQuestionPageIndexForValidation(allQuestions, destinationID) <= findQuestionPageIndexForValidation(allQuestions, question.ID.String())
	}

	if question.Type == "multi" {
		exclusiveCount := 0
		optionCount := len(question.Options)
		for _, option := range question.Options {
			if option.Exclusive {
				exclusiveCount++
			}
		}
		if exclusiveCount > 1 {
			return true
		}
		if question.MinSelections != nil && (*question.MinSelections < 0 || *question.MinSelections > optionCount) {
			return true
		}
		if question.MaxSelections != nil && (*question.MaxSelections < 1 || *question.MaxSelections > optionCount) {
			return true
		}
		if question.MinSelections != nil && question.MaxSelections != nil && *question.MinSelections > *question.MaxSelections {
			return true
		}
	}

	questionPageIndex := findQuestionPageIndexForValidation(allQuestions, question.ID.String())
	for _, rule := range question.Logic {
		choiceConditions := getChoiceConditionsForValidation(rule)
		scalarConditions := getScalarConditionsForValidation(rule)

		switch question.Type {
		case "single", "select", "multi":
			if len(scalarConditions) > 0 || isContradictoryLogicRuleForValidation(rule) {
				return true
			}
			if len(choiceConditions) == 0 && strings.TrimSpace(rule.TriggerOption) != "" {
				return true
			}
			for _, condition := range choiceConditions {
				if findQuestionOptionByIDForValidation(question, condition.OptionID) == nil {
					return true
				}
			}
		case "rating", "date":
			if len(choiceConditions) > 0 || len(scalarConditions) > 1 {
				return true
			}
			if len(scalarConditions) == 0 {
				return true
			}
			if validateScalarConditionForValidation(question, scalarConditions[0]) {
				return true
			}
		}

		destinationID := strings.TrimSpace(rule.DestinationQuestionID)
		if destinationID == "end_survey" {
			continue
		}

		destinationPageIndex := findQuestionPageIndexForValidation(allQuestions, destinationID)
		destinationQuestion := findQuestionByIDForValidation(allQuestions, destinationID)
		if destinationQuestion == nil || destinationQuestion.Type != "section" || destinationPageIndex <= questionPageIndex {
			return true
		}
	}

	return false
}

func findQuestionByIDForValidation(allQuestions []models.Question, questionID string) *models.Question {
	for _, question := range allQuestions {
		if question.ID.String() == strings.TrimSpace(questionID) {
			cloned := question
			return &cloned
		}
	}
	return nil
}

func findQuestionPageIndexForValidation(allQuestions []models.Question, questionID string) int {
	pageIndex := -1
	for _, question := range allQuestions {
		if question.Type == "section" {
			pageIndex++
		}
		if question.ID.String() == strings.TrimSpace(questionID) {
			if pageIndex == -1 {
				return 0
			}
			return pageIndex
		}
	}
	return -1
}

func validateScalarConditionForValidation(question models.Question, condition models.LogicCondition) bool {
	isRange := condition.Comparator == "between" || condition.Comparator == "not_between"

	if strings.TrimSpace(condition.Value) == "" {
		return true
	}
	if isRange && strings.TrimSpace(condition.SecondaryValue) == "" {
		return true
	}

	switch question.Type {
	case "rating":
		primary, err := strconv.ParseFloat(condition.Value, 64)
		if err != nil {
			return true
		}
		if !isRange {
			return false
		}
		secondary, err := strconv.ParseFloat(condition.SecondaryValue, 64)
		if err != nil {
			return true
		}
		return primary > secondary
	case "date":
		if _, err := time.Parse("2006-01-02", condition.Value); err != nil {
			return true
		}
		if !isRange {
			return false
		}
		if _, err := time.Parse("2006-01-02", condition.SecondaryValue); err != nil {
			return true
		}
		return condition.Value > condition.SecondaryValue
	default:
		return true
	}
}

func findQuestionOptionByIDForValidation(question models.Question, optionID string) *models.QuestionOption {
	for _, option := range question.Options.Clone() {
		if strings.TrimSpace(option.ID) == strings.TrimSpace(optionID) {
			cloned := option
			return &cloned
		}
	}
	return nil
}

func findQuestionOptionByLabelForValidation(question models.Question, label string) *models.QuestionOption {
	for _, option := range question.Options.Clone() {
		if option.Label == label {
			cloned := option
			return &cloned
		}
	}
	return nil
}
