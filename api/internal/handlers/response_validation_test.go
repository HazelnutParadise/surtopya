package handlers

import (
	"testing"

	"github.com/TimLai666/surtopya-api/internal/models"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestValidateSurveyCompletion_SkipsRequiredQuestionsOnUnvisitedPages(t *testing.T) {
	page1ID := uuid.New()
	page2ID := uuid.New()
	page3ID := uuid.New()
	branchQuestionID := uuid.New()
	skippedQuestionID := uuid.New()
	visitedQuestionID := uuid.New()

	snapshot := surveySnapshot{
		Questions: []surveySnapshotQuestion{
			{ID: page1ID, Type: "section", Title: "Page 1"},
			{
				ID:       branchQuestionID,
				Type:     "single",
				Title:    "Branch question",
				Required: true,
				Options: models.QuestionOptions{
					{ID: "opt-branch", Label: "Go to page 3"},
				},
				Logic: []models.LogicRule{{
					Operator: "or",
					Conditions: []models.LogicCondition{{
						Kind:     "choice",
						OptionID: "opt-branch",
						Match:    "includes",
					}},
					DestinationQuestionID: page3ID.String(),
				}},
			},
			{ID: page2ID, Type: "section", Title: "Page 2"},
			{ID: skippedQuestionID, Type: "short", Title: "Skipped required", Required: true},
			{ID: page3ID, Type: "section", Title: "Page 3"},
			{ID: visitedQuestionID, Type: "short", Title: "Visited required", Required: true},
		},
	}

	answers := map[uuid.UUID]models.AnswerValue{
		branchQuestionID:  {Value: stringPtrForResponseValidationTest("opt-branch")},
		visitedQuestionID: {Text: stringPtrForResponseValidationTest("answered")},
	}

	require.NoError(t, validateSurveyCompletion(snapshot, answers))
}

func TestValidateSurveyCompletion_EnforcesMultiSelectionBoundsOnVisitedPages(t *testing.T) {
	page1ID := uuid.New()
	multiQuestionID := uuid.New()

	snapshot := surveySnapshot{
		Questions: []surveySnapshotQuestion{
			{ID: page1ID, Type: "section", Title: "Page 1"},
			{
				ID:            multiQuestionID,
				Type:          "multi",
				Title:         "Pick multiple",
				MinSelections: intPtrForResponseValidationTest(2),
				MaxSelections: intPtrForResponseValidationTest(3),
				Options: models.QuestionOptions{
					{ID: "opt-a", Label: "A"},
					{ID: "opt-b", Label: "B"},
					{ID: "opt-c", Label: "C"},
				},
			},
		},
	}

	answers := map[uuid.UUID]models.AnswerValue{
		multiQuestionID: {Values: []string{"opt-a"}},
	}

	err := validateSurveyCompletion(snapshot, answers)
	require.EqualError(t, err, "Selection count is outside the allowed range")
}

func TestValidateSurveyCompletion_StopsOnSectionDefaultEndSurvey(t *testing.T) {
	page1ID := uuid.New()
	page2ID := uuid.New()
	answerQuestionID := uuid.New()
	skippedQuestionID := uuid.New()

	snapshot := surveySnapshot{
		Questions: []surveySnapshotQuestion{
			{ID: page1ID, Type: "section", Title: "Page 1", DefaultDestinationQuestionID: stringPtrForResponseValidationTest("end_survey")},
			{ID: answerQuestionID, Type: "short", Title: "Answer here", Required: true},
			{ID: page2ID, Type: "section", Title: "Page 2"},
			{ID: skippedQuestionID, Type: "short", Title: "Skipped required", Required: true},
		},
	}

	answers := map[uuid.UUID]models.AnswerValue{
		answerQuestionID: {Text: stringPtrForResponseValidationTest("done")},
	}

	require.NoError(t, validateSurveyCompletion(snapshot, answers))
}

func intPtrForResponseValidationTest(value int) *int {
	return &value
}

func stringPtrForResponseValidationTest(value string) *string {
	return &value
}
