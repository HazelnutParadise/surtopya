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

func surveyRowsForUpdateTimeTest(id uuid.UUID, userID uuid.UUID, expiresAt *time.Time) (*sqlmock.Rows, *sqlmock.Rows) {
	now := time.Now().UTC()
	var expiresAtValue interface{}
	if expiresAt != nil {
		expiresAtValue = *expiresAt
	}

	surveyCols := []string{
		"id", "user_id", "title", "description", "visibility", "require_login_to_respond", "is_response_open",
		"include_in_datasets", "ever_public", "published_count", "theme", "points_reward",
		"expires_at", "response_count", "created_at", "updated_at", "published_at",
		"current_published_version_id", "current_published_version_number", "has_unpublished_changes", "deleted_at",
	}
	surveyRows := sqlmock.NewRows(surveyCols).AddRow(
		id,
		userID,
		"Publish Test",
		"Desc",
		"non-public",
		false,
		false,
		false,
		false,
		0,
		[]byte("{}"),
		0,
		expiresAtValue,
		0,
		now,
		now,
		nil,
		nil,
		nil,
		false,
		nil,
	)

	questionCols := []string{
		"id", "survey_id", "type", "title", "description", "options", "required",
		"max_rating", "logic", "sort_order", "created_at", "updated_at",
	}
	questionRows := sqlmock.NewRows(questionCols)
	return surveyRows, questionRows
}

func TestSurveyHandler_CreateSurvey_RejectsPastExpiresAt(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newSurveyHandlerForPublishTest(t)
	t.Cleanup(cleanup)

	userID := uuid.New()
	r := gin.New()
	r.POST("/api/v1/surveys", func(c *gin.Context) {
		c.Set("userID", userID)
		h.CreateSurvey(c)
	})

	body, err := json.Marshal(map[string]any{
		"title":                 "Past Expiration",
		"description":           "Desc",
		"visibility":            "non-public",
		"requireLoginToRespond": false,
		"includeInDatasets":     false,
		"pointsReward":          0,
		"expiresAtLocal":        "2000-01-01T00:00",
		"timeZone":              "Asia/Taipei",
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/surveys", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusBadRequest, w.Code)
	require.Contains(t, w.Body.String(), expirationDatePastError)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyHandler_UpdateSurvey_ConvertsExpiresAtLocalToUTC(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newSurveyHandlerForPublishTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	userID := uuid.New()

	surveyRows, questionRows := surveyRowsForUpdateTimeTest(surveyID, userID, nil)
	mock.ExpectQuery("FROM surveys s\\s+LEFT JOIN survey_versions sv").
		WithArgs(surveyID).
		WillReturnRows(surveyRows)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(questionRows)
	mock.ExpectQuery("SELECT COALESCE\\(tc.is_allowed, false\\)").
		WithArgs(userID, policy.CapabilitySurveyPublicDatasetOptOut).
		WillReturnRows(sqlmock.NewRows([]string{"is_allowed"}).AddRow(false))
	mock.ExpectExec("UPDATE surveys SET").
		WithArgs(
			surveyID,
			"Publish Test",
			"Desc",
			"non-public",
			false,
			false,
			false,
			false,
			0,
			sqlmock.AnyArg(),
			0,
			time.Date(2099, 3, 11, 7, 0, 0, 0, time.UTC),
			nil,
			nil,
			nil,
			false,
		).
		WillReturnResult(sqlmock.NewResult(0, 1))

	r := gin.New()
	r.PUT("/api/v1/surveys/:id", func(c *gin.Context) {
		c.Set("userID", userID)
		h.UpdateSurvey(c)
	})

	body, err := json.Marshal(map[string]any{
		"expiresAtLocal": "2099-03-11T15:00",
		"timeZone":       "Asia/Taipei",
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/surveys/"+surveyID.String(), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"expiresAt":"2099-03-11T07:00:00Z"`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyHandler_UpdateSurvey_RejectsChangedToPastExpiresAt(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newSurveyHandlerForPublishTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	userID := uuid.New()
	currentFuture := time.Date(2099, 3, 11, 7, 0, 0, 0, time.UTC)

	surveyRows, questionRows := surveyRowsForUpdateTimeTest(surveyID, userID, &currentFuture)
	mock.ExpectQuery("FROM surveys s\\s+LEFT JOIN survey_versions sv").
		WithArgs(surveyID).
		WillReturnRows(surveyRows)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(questionRows)
	mock.ExpectQuery("SELECT COALESCE\\(tc.is_allowed, false\\)").
		WithArgs(userID, policy.CapabilitySurveyPublicDatasetOptOut).
		WillReturnRows(sqlmock.NewRows([]string{"is_allowed"}).AddRow(false))

	r := gin.New()
	r.PUT("/api/v1/surveys/:id", func(c *gin.Context) {
		c.Set("userID", userID)
		h.UpdateSurvey(c)
	})

	body, err := json.Marshal(map[string]any{
		"expiresAtLocal": "2000-01-01T00:00",
		"timeZone":       "Asia/Taipei",
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/surveys/"+surveyID.String(), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusBadRequest, w.Code)
	require.Contains(t, w.Body.String(), expirationDatePastError)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyHandler_UpdateSurvey_AllowsClearingExpiresAt(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newSurveyHandlerForPublishTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	userID := uuid.New()
	currentFuture := time.Date(2099, 3, 11, 7, 0, 0, 0, time.UTC)

	surveyRows, questionRows := surveyRowsForUpdateTimeTest(surveyID, userID, &currentFuture)
	mock.ExpectQuery("FROM surveys s\\s+LEFT JOIN survey_versions sv").
		WithArgs(surveyID).
		WillReturnRows(surveyRows)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(questionRows)
	mock.ExpectQuery("SELECT COALESCE\\(tc.is_allowed, false\\)").
		WithArgs(userID, policy.CapabilitySurveyPublicDatasetOptOut).
		WillReturnRows(sqlmock.NewRows([]string{"is_allowed"}).AddRow(false))
	mock.ExpectExec("UPDATE surveys SET").
		WithArgs(
			surveyID,
			"Updated Title",
			"Desc",
			"non-public",
			false,
			false,
			false,
			false,
			0,
			sqlmock.AnyArg(),
			0,
			nil,
			nil,
			nil,
			nil,
			false,
		).
		WillReturnResult(sqlmock.NewResult(0, 1))

	r := gin.New()
	r.PUT("/api/v1/surveys/:id", func(c *gin.Context) {
		c.Set("userID", userID)
		h.UpdateSurvey(c)
	})

	body, err := json.Marshal(map[string]any{
		"title":          "Updated Title",
		"expiresAtLocal": "",
		"timeZone":       "Asia/Taipei",
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/surveys/"+surveyID.String(), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"title":"Updated Title"`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyHandler_UpdateSurvey_AllowsKeepingUnchangedLegacyPastExpiresAt(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newSurveyHandlerForPublishTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	userID := uuid.New()
	legacyPast := time.Date(2024, 1, 2, 3, 4, 0, 0, time.UTC)

	surveyRows, questionRows := surveyRowsForUpdateTimeTest(surveyID, userID, &legacyPast)
	mock.ExpectQuery("FROM surveys s\\s+LEFT JOIN survey_versions sv").
		WithArgs(surveyID).
		WillReturnRows(surveyRows)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(questionRows)
	mock.ExpectQuery("SELECT COALESCE\\(tc.is_allowed, false\\)").
		WithArgs(userID, policy.CapabilitySurveyPublicDatasetOptOut).
		WillReturnRows(sqlmock.NewRows([]string{"is_allowed"}).AddRow(false))
	mock.ExpectExec("UPDATE surveys SET").
		WithArgs(
			surveyID,
			"Updated Title",
			"Desc",
			"non-public",
			false,
			false,
			false,
			false,
			0,
			sqlmock.AnyArg(),
			0,
			legacyPast,
			nil,
			nil,
			nil,
			false,
		).
		WillReturnResult(sqlmock.NewResult(0, 1))

	r := gin.New()
	r.PUT("/api/v1/surveys/:id", func(c *gin.Context) {
		c.Set("userID", userID)
		h.UpdateSurvey(c)
	})

	body, err := json.Marshal(map[string]any{
		"title":          "Updated Title",
		"expiresAtLocal": "2024-01-02T11:04",
		"timeZone":       "Asia/Taipei",
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/surveys/"+surveyID.String(), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"title":"Updated Title"`)
	require.Contains(t, w.Body.String(), `"expiresAt":"2024-01-02T03:04:00Z"`)
	require.NoError(t, mock.ExpectationsWereMet())
}
