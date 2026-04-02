package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/TimLai666/surtopya-api/internal/policy"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func surveyRowsForUpdateVersioningTest(
	id uuid.UUID,
	userID uuid.UUID,
	visibility string,
	includeInDatasets bool,
	publishedCount int,
	currentVersionID *uuid.UUID,
	currentVersionNumber *int,
	hasUnpublishedChanges bool,
) *sqlmock.Rows {
	now := time.Now().UTC()
	everPublic := visibility == "public" || publishedCount > 0
	var currentVersionIDValue interface{}
	if currentVersionID != nil {
		currentVersionIDValue = *currentVersionID
	}
	var currentVersionNumberValue interface{}
	if currentVersionNumber != nil {
		currentVersionNumberValue = *currentVersionNumber
	}

	surveyCols := []string{
		"id", "user_id", "title", "description", "visibility", "require_login_to_respond", "is_response_open",
		"include_in_datasets", "ever_public", "published_count", "theme", "points_reward", "completion_title", "completion_message",
		"expires_at", "response_count", "created_at", "updated_at", "published_at",
		"current_published_version_id", "current_published_version_number", "has_unpublished_changes", "deleted_at",
	}

	return sqlmock.NewRows(surveyCols).AddRow(
		id,
		userID,
		"Publish Test",
		"Desc",
		visibility,
		false,
		false,
		includeInDatasets,
		everPublic,
		publishedCount,
		[]byte("{}"),
		0,
		nil,
		nil,
		nil,
		0,
		now,
		now,
		nil,
		currentVersionIDValue,
		currentVersionNumberValue,
		hasUnpublishedChanges,
		nil,
	)
}

func singleQuestionRowsForUpdateVersioningTest(surveyID uuid.UUID, questionID uuid.UUID, title string) *sqlmock.Rows {
	now := time.Now().UTC()
	questionCols := []string{
		"id", "survey_id", "type", "title", "description", "options", "required",
		"max_rating", "min_selections", "max_selections", "default_destination_question_id",
		"logic", "sort_order", "created_at", "updated_at",
	}
	return sqlmock.NewRows(questionCols).AddRow(
		questionID,
		surveyID,
		"short",
		title,
		"Old description",
		[]byte(`["Old option"]`),
		true,
		0,
		nil,
		nil,
		nil,
		[]byte(`[]`),
		0,
		now,
		now,
	)
}

func TestSurveyHandler_UpdateSurvey_MetadataOnly_DoesNotMarkUnpublished(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newSurveyHandlerForPublishTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	userID := uuid.New()
	currentVersionID := uuid.New()
	currentVersionNumber := 2

	mock.ExpectQuery("FROM surveys s\\s+LEFT JOIN survey_versions sv").
		WithArgs(surveyID).
		WillReturnRows(
			surveyRowsForUpdateVersioningTest(
				surveyID,
				userID,
				"non-public",
				false,
				1,
				&currentVersionID,
				&currentVersionNumber,
				false,
			),
		)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "type", "title", "description", "options", "required",
			"max_rating", "min_selections", "max_selections", "default_destination_question_id",
			"logic", "sort_order", "created_at", "updated_at",
		}))
	mock.ExpectQuery("SELECT COALESCE\\(tc.is_allowed, false\\)").
		WithArgs(userID, policy.CapabilitySurveyPublicDatasetOptOut).
		WillReturnRows(sqlmock.NewRows([]string{"is_allowed"}).AddRow(true))
	mock.ExpectBegin()
	mock.ExpectExec("UPDATE surveys SET").
		WithArgs(
			surveyID,
			"Metadata only title",
			"Desc",
			"non-public",
			false,
			false,
			false,
			true,
			1,
			sqlmock.AnyArg(),
			0,
			nil,
			nil,
			nil,
			nil,
			currentVersionID,
			currentVersionNumber,
			false,
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	r := gin.New()
	r.PUT("/api/v1/surveys/:id", func(c *gin.Context) {
		c.Set("userID", userID)
		h.UpdateSurvey(c)
	})

	body, err := json.Marshal(map[string]any{
		"title": "Metadata only title",
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/surveys/"+surveyID.String(), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"hasUnpublishedChanges":false`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyHandler_UpdateSurvey_PublishedMutableState_SyncsCurrentVersion(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newSurveyHandlerForPublishTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	userID := uuid.New()
	currentVersionID := uuid.New()
	currentVersionNumber := 2

	mock.ExpectQuery("FROM surveys s\\s+LEFT JOIN survey_versions sv").
		WithArgs(surveyID).
		WillReturnRows(
			surveyRowsForUpdateVersioningTest(
				surveyID,
				userID,
				"non-public",
				false,
				1,
				&currentVersionID,
				&currentVersionNumber,
				false,
			),
		)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "type", "title", "description", "options", "required",
			"max_rating", "min_selections", "max_selections", "default_destination_question_id",
			"logic", "sort_order", "created_at", "updated_at",
		}))
	mock.ExpectQuery("SELECT COALESCE\\(tc.is_allowed, false\\)").
		WithArgs(userID, policy.CapabilitySurveyPublicDatasetOptOut).
		WillReturnRows(sqlmock.NewRows([]string{"is_allowed"}).AddRow(true))
	mock.ExpectBegin()
	mock.ExpectExec("UPDATE surveys SET").
		WithArgs(
			surveyID,
			"Publish Test",
			"Desc",
			"non-public",
			false,
			false,
			false,
			true,
			1,
			sqlmock.AnyArg(),
			7,
			nil,
			nil,
			sqlmock.AnyArg(),
			nil,
			currentVersionID,
			currentVersionNumber,
			false,
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE survey_versions\\s+SET\\s+points_reward = \\$2,\\s+expires_at = \\$3").
		WithArgs(surveyID, 7, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	r := gin.New()
	r.PUT("/api/v1/surveys/:id", func(c *gin.Context) {
		c.Set("userID", userID)
		h.UpdateSurvey(c)
	})

	body, err := json.Marshal(map[string]any{
		"pointsReward":   7,
		"expiresAtLocal": "2026-05-01T09:00",
		"timeZone":       "Asia/Taipei",
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/surveys/"+surveyID.String(), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"pointsReward":7`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyHandler_UpdateSurvey_QuestionChanged_MarksUnpublished(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newSurveyHandlerForPublishTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	userID := uuid.New()
	currentVersionID := uuid.New()
	currentVersionNumber := 2
	questionID := uuid.New()

	mock.ExpectQuery("FROM surveys s\\s+LEFT JOIN survey_versions sv").
		WithArgs(surveyID).
		WillReturnRows(
			surveyRowsForUpdateVersioningTest(
				surveyID,
				userID,
				"non-public",
				false,
				1,
				&currentVersionID,
				&currentVersionNumber,
				false,
			),
		)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(singleQuestionRowsForUpdateVersioningTest(surveyID, questionID, "Original question"))
	mock.ExpectQuery("SELECT COALESCE\\(tc.is_allowed, false\\)").
		WithArgs(userID, policy.CapabilitySurveyPublicDatasetOptOut).
		WillReturnRows(sqlmock.NewRows([]string{"is_allowed"}).AddRow(true))
	mock.ExpectBegin()
	mock.ExpectExec("UPDATE surveys SET").
		WithArgs(
			surveyID,
			"Publish Test",
			"Desc",
			"non-public",
			false,
			false,
			false,
			true,
			1,
			sqlmock.AnyArg(),
			0,
			nil,
			nil,
			nil,
			nil,
			currentVersionID,
			currentVersionNumber,
			true,
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("DELETE FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO questions").
		WithArgs(
			questionID,
			surveyID,
			"short",
			"Updated question",
			"Updated description",
			sqlmock.AnyArg(),
			true,
			0,
			nil,
			nil,
			nil,
			sqlmock.AnyArg(),
			0,
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	r := gin.New()
	r.PUT("/api/v1/surveys/:id", func(c *gin.Context) {
		c.Set("userID", userID)
		h.UpdateSurvey(c)
	})

	body, err := json.Marshal(map[string]any{
		"questions": []map[string]any{
			{
				"id":          questionID.String(),
				"type":        "short",
				"title":       "Updated question",
				"description": "Updated description",
				"options":     []string{"A", "B"},
				"required":    true,
				"maxRating":   0,
				"logic":       []any{},
			},
		},
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/surveys/"+surveyID.String(), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"hasUnpublishedChanges":true`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyHandler_UpdateSurvey_AcceptsStructuredOptionsAndReturnsOtherFlag(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newSurveyHandlerForPublishTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	userID := uuid.New()
	currentVersionID := uuid.New()
	currentVersionNumber := 2
	questionID := uuid.New()

	mock.ExpectQuery("FROM surveys s\\s+LEFT JOIN survey_versions sv").
		WithArgs(surveyID).
		WillReturnRows(
			surveyRowsForUpdateVersioningTest(
				surveyID,
				userID,
				"non-public",
				false,
				1,
				&currentVersionID,
				&currentVersionNumber,
				false,
			),
		)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(singleQuestionRowsForUpdateVersioningTest(surveyID, questionID, "Original question"))
	mock.ExpectQuery("SELECT COALESCE\\(tc.is_allowed, false\\)").
		WithArgs(userID, policy.CapabilitySurveyPublicDatasetOptOut).
		WillReturnRows(sqlmock.NewRows([]string{"is_allowed"}).AddRow(true))
	mock.ExpectBegin()
	mock.ExpectExec("UPDATE surveys SET").
		WithArgs(
			surveyID,
			"Publish Test",
			"Desc",
			"non-public",
			false,
			false,
			false,
			true,
			1,
			sqlmock.AnyArg(),
			0,
			nil,
			nil,
			nil,
			nil,
			currentVersionID,
			currentVersionNumber,
			true,
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("DELETE FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO questions").
		WithArgs(
			questionID,
			surveyID,
			"single",
			"Updated question",
			"Updated description",
			sqlmock.AnyArg(),
			true,
			0,
			nil,
			nil,
			nil,
			sqlmock.AnyArg(),
			0,
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	r := gin.New()
	r.PUT("/api/v1/surveys/:id", func(c *gin.Context) {
		c.Set("userID", userID)
		h.UpdateSurvey(c)
	})

	body, err := json.Marshal(map[string]any{
		"questions": []map[string]any{
			{
				"id":          questionID.String(),
				"type":        "single",
				"title":       "Updated question",
				"description": "Updated description",
				"options": []map[string]any{
					{"label": "Regular"},
					{"label": "Can add details", "isOther": true, "requireOtherText": true},
				},
				"required":  true,
				"maxRating": 0,
				"logic":     []any{},
			},
		},
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/surveys/"+surveyID.String(), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"isOther":true`)
	require.Contains(t, w.Body.String(), `"requireOtherText":true`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyHandler_UpdateSurvey_BlankCompletionCopy_NormalizesToNull(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newSurveyHandlerForPublishTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	userID := uuid.New()
	currentVersionID := uuid.New()
	currentVersionNumber := 2

	mock.ExpectQuery("FROM surveys s\\s+LEFT JOIN survey_versions sv").
		WithArgs(surveyID).
		WillReturnRows(
			surveyRowsForUpdateVersioningTest(
				surveyID,
				userID,
				"non-public",
				false,
				1,
				&currentVersionID,
				&currentVersionNumber,
				false,
			),
		)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "type", "title", "description", "options", "required",
			"max_rating", "min_selections", "max_selections", "default_destination_question_id",
			"logic", "sort_order", "created_at", "updated_at",
		}))
	mock.ExpectQuery("SELECT COALESCE\\(tc.is_allowed, false\\)").
		WithArgs(userID, policy.CapabilitySurveyPublicDatasetOptOut).
		WillReturnRows(sqlmock.NewRows([]string{"is_allowed"}).AddRow(true))
	mock.ExpectBegin()
	mock.ExpectExec("UPDATE surveys SET").
		WithArgs(
			surveyID,
			"Publish Test",
			"Desc",
			"non-public",
			false,
			false,
			false,
			true,
			1,
			sqlmock.AnyArg(),
			0,
			nil,
			nil,
			nil,
			nil,
			currentVersionID,
			currentVersionNumber,
			false,
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	r := gin.New()
	r.PUT("/api/v1/surveys/:id", func(c *gin.Context) {
		c.Set("userID", userID)
		h.UpdateSurvey(c)
	})

	body, err := json.Marshal(map[string]any{
		"completionTitle":   "   ",
		"completionMessage": "\n\t",
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/surveys/"+surveyID.String(), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"completionTitle":null`)
	require.Contains(t, w.Body.String(), `"completionMessage":null`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyHandler_UpdateSurvey_CompletionCopyChanged_DoesNotMarkUnpublished(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newSurveyHandlerForPublishTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	userID := uuid.New()
	currentVersionID := uuid.New()
	currentVersionNumber := 2

	mock.ExpectQuery("FROM surveys s\\s+LEFT JOIN survey_versions sv").
		WithArgs(surveyID).
		WillReturnRows(
			surveyRowsForUpdateVersioningTest(
				surveyID,
				userID,
				"non-public",
				false,
				1,
				&currentVersionID,
				&currentVersionNumber,
				false,
			),
		)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "type", "title", "description", "options", "required",
			"max_rating", "min_selections", "max_selections", "default_destination_question_id",
			"logic", "sort_order", "created_at", "updated_at",
		}))
	mock.ExpectQuery("SELECT COALESCE\\(tc.is_allowed, false\\)").
		WithArgs(userID, policy.CapabilitySurveyPublicDatasetOptOut).
		WillReturnRows(sqlmock.NewRows([]string{"is_allowed"}).AddRow(true))
	mock.ExpectBegin()
	mock.ExpectExec("UPDATE surveys SET").
		WithArgs(
			surveyID,
			"Publish Test",
			"Desc",
			"non-public",
			false,
			false,
			false,
			true,
			1,
			sqlmock.AnyArg(),
			0,
			"Thanks right away",
			"Visible without republish",
			nil,
			nil,
			currentVersionID,
			currentVersionNumber,
			false,
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	r := gin.New()
	r.PUT("/api/v1/surveys/:id", func(c *gin.Context) {
		c.Set("userID", userID)
		h.UpdateSurvey(c)
	})

	body, err := json.Marshal(map[string]any{
		"completionTitle":   "Thanks right away",
		"completionMessage": "Visible without republish",
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/surveys/"+surveyID.String(), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"hasUnpublishedChanges":false`)
	require.NoError(t, mock.ExpectationsWereMet())
}
