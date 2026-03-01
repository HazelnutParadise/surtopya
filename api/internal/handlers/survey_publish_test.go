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
	"github.com/TimLai666/surtopya-api/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func newSurveyHandlerForPublishTest(t *testing.T) (*SurveyHandler, sqlmock.Sqlmock, func()) {
	t.Helper()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)

	h := &SurveyHandler{
		db:         db,
		repo:       repository.NewSurveyRepository(db),
		policies:   policy.NewService(db),
		pointsRepo: repository.NewPointsRepository(db),
	}

	cleanup := func() { _ = db.Close() }
	return h, mock, cleanup
}

func surveyRowsForPublishTest(id uuid.UUID, userID uuid.UUID, visibility string, includeInDatasets bool, pointsReward int, publishedCount int, isPublished bool) (*sqlmock.Rows, *sqlmock.Rows) {
	now := time.Now().UTC()
	everPublic := visibility == "public" || publishedCount > 0

	surveyCols := []string{
		"id", "user_id", "title", "description", "visibility", "is_published",
		"include_in_datasets", "ever_public", "published_count", "theme", "points_reward",
		"expires_at", "response_count", "created_at", "updated_at", "published_at",
	}
	surveyRows := sqlmock.NewRows(surveyCols).AddRow(
		id,
		userID,
		"Publish Test",
		"Desc",
		visibility,
		isPublished,
		includeInDatasets,
		everPublic,
		publishedCount,
		[]byte("{}"),
		pointsReward,
		nil,
		0,
		now,
		now,
		nil,
	)

	questionCols := []string{
		"id", "survey_id", "type", "title", "description", "options", "required",
		"max_rating", "logic", "sort_order", "created_at", "updated_at",
	}
	questionRows := sqlmock.NewRows(questionCols)
	return surveyRows, questionRows
}

func TestSurveyHandler_PublishSurvey_FirstPublish_DeductsBoostSpend(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newSurveyHandlerForPublishTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	publisherID := uuid.New()

	surveyRows, questionRows := surveyRowsForPublishTest(surveyID, publisherID, "public", true, 0, 0, false)
	mock.ExpectQuery("FROM surveys WHERE id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(surveyRows)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(questionRows)
	mock.ExpectQuery("SELECT COALESCE\\(tc.is_allowed, false\\)").
		WithArgs(publisherID, policy.CapabilitySurveyPublicDatasetOptOut).
		WillReturnRows(sqlmock.NewRows([]string{"is_allowed"}).AddRow(true))

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT points_balance FROM users WHERE id = \\$1 FOR UPDATE").
		WithArgs(publisherID).
		WillReturnRows(sqlmock.NewRows([]string{"points_balance"}).AddRow(99))
	mock.ExpectExec("UPDATE users SET points_balance = points_balance - \\$2 WHERE id = \\$1").
		WithArgs(publisherID, 9).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO points_transactions").
		WithArgs(sqlmock.AnyArg(), publisherID, -9, sqlmock.AnyArg(), surveyID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE surveys SET").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	r := gin.New()
	r.POST("/api/v1/surveys/:id/publish", func(c *gin.Context) {
		c.Set("userID", publisherID)
		h.PublishSurvey(c)
	})

	body, err := json.Marshal(map[string]any{
		"visibility":        "public",
		"includeInDatasets": true,
		"pointsReward":      9,
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/surveys/"+surveyID.String()+"/publish", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"isPublished":true`)
	require.Contains(t, w.Body.String(), `"pointsReward":9`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyHandler_PublishSurvey_AfterFirstPublish_BoostCanOnlyIncrease(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newSurveyHandlerForPublishTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	publisherID := uuid.New()

	surveyRows, questionRows := surveyRowsForPublishTest(surveyID, publisherID, "public", true, 9, 1, false)
	mock.ExpectQuery("FROM surveys WHERE id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(surveyRows)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(questionRows)
	mock.ExpectQuery("SELECT COALESCE\\(tc.is_allowed, false\\)").
		WithArgs(publisherID, policy.CapabilitySurveyPublicDatasetOptOut).
		WillReturnRows(sqlmock.NewRows([]string{"is_allowed"}).AddRow(true))

	r := gin.New()
	r.POST("/api/v1/surveys/:id/publish", func(c *gin.Context) {
		c.Set("userID", publisherID)
		h.PublishSurvey(c)
	})

	body, err := json.Marshal(map[string]any{
		"visibility":        "public",
		"includeInDatasets": true,
		"pointsReward":      6,
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/surveys/"+surveyID.String()+"/publish", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusBadRequest, w.Code)
	require.Contains(t, w.Body.String(), "Boost points can only increase after first publish")
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyHandler_PublishSurvey_AfterFirstPublish_DeductsOnlyTopUp(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newSurveyHandlerForPublishTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	publisherID := uuid.New()

	surveyRows, questionRows := surveyRowsForPublishTest(surveyID, publisherID, "public", true, 9, 1, false)
	mock.ExpectQuery("FROM surveys WHERE id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(surveyRows)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(questionRows)
	mock.ExpectQuery("SELECT COALESCE\\(tc.is_allowed, false\\)").
		WithArgs(publisherID, policy.CapabilitySurveyPublicDatasetOptOut).
		WillReturnRows(sqlmock.NewRows([]string{"is_allowed"}).AddRow(true))

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT points_balance FROM users WHERE id = \\$1 FOR UPDATE").
		WithArgs(publisherID).
		WillReturnRows(sqlmock.NewRows([]string{"points_balance"}).AddRow(99))
	mock.ExpectExec("UPDATE users SET points_balance = points_balance - \\$2 WHERE id = \\$1").
		WithArgs(publisherID, 3).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO points_transactions").
		WithArgs(sqlmock.AnyArg(), publisherID, -3, sqlmock.AnyArg(), surveyID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE surveys SET").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	r := gin.New()
	r.POST("/api/v1/surveys/:id/publish", func(c *gin.Context) {
		c.Set("userID", publisherID)
		h.PublishSurvey(c)
	})

	body, err := json.Marshal(map[string]any{
		"visibility":        "public",
		"includeInDatasets": true,
		"pointsReward":      12,
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/surveys/"+surveyID.String()+"/publish", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"pointsReward":12`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyHandler_PublishSurvey_NegativeBoostRejected(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newSurveyHandlerForPublishTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	publisherID := uuid.New()

	surveyRows, questionRows := surveyRowsForPublishTest(surveyID, publisherID, "public", true, 0, 0, false)
	mock.ExpectQuery("FROM surveys WHERE id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(surveyRows)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(questionRows)
	mock.ExpectQuery("SELECT COALESCE\\(tc.is_allowed, false\\)").
		WithArgs(publisherID, policy.CapabilitySurveyPublicDatasetOptOut).
		WillReturnRows(sqlmock.NewRows([]string{"is_allowed"}).AddRow(true))

	r := gin.New()
	r.POST("/api/v1/surveys/:id/publish", func(c *gin.Context) {
		c.Set("userID", publisherID)
		h.PublishSurvey(c)
	})

	body, err := json.Marshal(map[string]any{
		"visibility":        "public",
		"includeInDatasets": true,
		"pointsReward":      -1,
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/surveys/"+surveyID.String()+"/publish", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusBadRequest, w.Code)
	require.Contains(t, w.Body.String(), "Boost points cannot be negative")
	require.NoError(t, mock.ExpectationsWereMet())
}
