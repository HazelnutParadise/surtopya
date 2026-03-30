package handlers

import (
	"testing"

	"github.com/TimLai666/surtopya-api/internal/models"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestSurveyHasPublishBlockingLogicIssues(t *testing.T) {
	page1ID := uuid.New()
	page2ID := uuid.New()
	page3ID := uuid.New()
	q1ID := uuid.New()
	q2ID := uuid.New()

	makeSection := func(id uuid.UUID, title string, destination *string) models.Question {
		return models.Question{
			ID:                           id,
			Type:                         "section",
			Title:                        title,
			DefaultDestinationQuestionID: destination,
		}
	}

	makeChoiceQuestion := func(destination string) models.Question {
		return models.Question{
			ID:       q1ID,
			Type:     "single",
			Title:    "Choose",
			Required: false,
			Options: models.QuestionOptions{
				{ID: "opt-a", Label: "A"},
			},
			Logic: []models.LogicRule{{
				Operator: "or",
				Conditions: []models.LogicCondition{{
					Kind:     "choice",
					OptionID: "opt-a",
					Match:    "includes",
				}},
				DestinationQuestionID: destination,
			}},
		}
	}

	t.Run("allows later page destinations", func(t *testing.T) {
		questions := []models.Question{
			makeSection(page1ID, "Page 1", nil),
			makeChoiceQuestion(page2ID.String()),
			makeSection(page2ID, "Page 2", nil),
		}

		require.False(t, surveyHasPublishBlockingLogicIssues(questions))
	})

	t.Run("blocks same page destinations", func(t *testing.T) {
		questions := []models.Question{
			makeSection(page1ID, "Page 1", nil),
			makeChoiceQuestion(page1ID.String()),
			makeSection(page2ID, "Page 2", nil),
		}

		require.True(t, surveyHasPublishBlockingLogicIssues(questions))
	})

	t.Run("blocks invalid section defaults", func(t *testing.T) {
		questions := []models.Question{
			makeSection(page1ID, "Page 1", nil),
			{
				ID:    q1ID,
				Type:  "short",
				Title: "Short answer",
			},
			makeSection(page2ID, "Page 2", stringPtrForSurveyLogicTest(page1ID.String())),
		}

		require.True(t, surveyHasPublishBlockingLogicIssues(questions))
	})

	t.Run("allows section defaults to end survey", func(t *testing.T) {
		questions := []models.Question{
			makeSection(page1ID, "Page 1", stringPtrForSurveyLogicTest("end_survey")),
			{
				ID:    q1ID,
				Type:  "short",
				Title: "Short answer",
			},
			makeSection(page2ID, "Page 2", nil),
		}

		require.False(t, surveyHasPublishBlockingLogicIssues(questions))
	})

	t.Run("blocks multiple exclusive options", func(t *testing.T) {
		questions := []models.Question{
			makeSection(page1ID, "Page 1", nil),
			{
				ID:    q1ID,
				Type:  "multi",
				Title: "Pick options",
				Options: models.QuestionOptions{
					{ID: "opt-a", Label: "A", Exclusive: true},
					{ID: "opt-b", Label: "B", Exclusive: true},
				},
			},
			makeSection(page2ID, "Page 2", nil),
		}

		require.True(t, surveyHasPublishBlockingLogicIssues(questions))
	})

	t.Run("blocks invalid selection bounds", func(t *testing.T) {
		questions := []models.Question{
			makeSection(page1ID, "Page 1", nil),
			{
				ID:            q2ID,
				Type:          "multi",
				Title:         "Pick options",
				MinSelections: intPtrForSurveyLogicTest(3),
				MaxSelections: intPtrForSurveyLogicTest(1),
				Options: models.QuestionOptions{
					{ID: "opt-a", Label: "A"},
					{ID: "opt-b", Label: "B"},
				},
			},
			makeSection(page3ID, "Page 3", nil),
		}

		require.True(t, surveyHasPublishBlockingLogicIssues(questions))
	})
}

func intPtrForSurveyLogicTest(value int) *int {
	return &value
}

func stringPtrForSurveyLogicTest(value string) *string {
	return &value
}
