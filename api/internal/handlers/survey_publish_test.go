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

func surveyRowsForPublishTest(id uuid.UUID, userID uuid.UUID, visibility string, includeInDatasets bool, pointsReward int, publishedCount int, isResponseOpen bool, currentVersionID *uuid.UUID, currentVersionNumber *int) (*sqlmock.Rows, *sqlmock.Rows) {
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
		"include_in_datasets", "ever_public", "published_count", "theme", "points_reward",
		"expires_at", "response_count", "created_at", "updated_at", "published_at",
		"current_published_version_id", "current_published_version_number", "has_unpublished_changes", "deleted_at",
	}
	surveyRows := sqlmock.NewRows(surveyCols).AddRow(
		id,
		userID,
		"Publish Test",
		"Desc",
		visibility,
		false,
		isResponseOpen,
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
		currentVersionIDValue,
		currentVersionNumberValue,
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

func TestSurveyHandler_PublishSurvey_FirstPublish_DeductsBoostSpend(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newSurveyHandlerForPublishTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	publisherID := uuid.New()

	surveyRows, questionRows := surveyRowsForPublishTest(surveyID, publisherID, "public", true, 0, 0, false, nil, nil)
	mock.ExpectQuery("FROM surveys s\\s+LEFT JOIN survey_versions sv").
		WithArgs(surveyID).
		WillReturnRows(surveyRows)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(questionRows)
	mock.ExpectQuery("SELECT COALESCE\\(tc.is_allowed, false\\)").
		WithArgs(publisherID, policy.CapabilitySurveyPublicDatasetOptOut).
		WillReturnRows(sqlmock.NewRows([]string{"is_allowed"}).AddRow(true))
	mock.ExpectExec("INSERT INTO user_memberships").
		WithArgs(publisherID, policy.DefaultMembershipTierCode).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT mt.max_active_surveys").
		WithArgs(publisherID).
		WillReturnRows(sqlmock.NewRows([]string{"max_active_surveys"}).AddRow(nil))

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
	mock.ExpectQuery("SELECT CASE WHEN sv.id IS NULL THEN FALSE ELSE sv.snapshot = \\$2::jsonb END").
		WithArgs(surveyID, sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"is_equal"}).AddRow(false))
	mock.ExpectQuery("SELECT COALESCE\\(MAX\\(version_number\\), 0\\) \\+ 1 FROM survey_versions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{"next"}).AddRow(1))
	mock.ExpectQuery("INSERT INTO survey_versions").
		WillReturnRows(sqlmock.NewRows([]string{"created_at"}).AddRow(time.Now().UTC()))
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
	require.Contains(t, w.Body.String(), `"isResponseOpen":true`)
	require.Contains(t, w.Body.String(), `"pointsReward":9`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyHandler_PublishSurvey_AfterFirstPublish_BoostCanOnlyIncrease(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newSurveyHandlerForPublishTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	publisherID := uuid.New()

	currentVersionID := uuid.New()
	currentVersionNumber := 1
	surveyRows, questionRows := surveyRowsForPublishTest(surveyID, publisherID, "public", true, 9, 1, false, &currentVersionID, &currentVersionNumber)
	mock.ExpectQuery("FROM surveys s\\s+LEFT JOIN survey_versions sv").
		WithArgs(surveyID).
		WillReturnRows(surveyRows)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(questionRows)
	mock.ExpectQuery("SELECT COALESCE\\(tc.is_allowed, false\\)").
		WithArgs(publisherID, policy.CapabilitySurveyPublicDatasetOptOut).
		WillReturnRows(sqlmock.NewRows([]string{"is_allowed"}).AddRow(true))
	mock.ExpectQuery("FROM surveys s\\s+JOIN survey_versions sv").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "version_number", "snapshot", "points_reward",
			"expires_at", "published_at", "published_by", "created_at",
		}).AddRow(currentVersionID, surveyID, 1, []byte(`{"questions":[]}`), 9, nil, time.Now().UTC(), publisherID, time.Now().UTC()))
	mock.ExpectExec("INSERT INTO user_memberships").
		WithArgs(publisherID, policy.DefaultMembershipTierCode).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT mt.max_active_surveys").
		WithArgs(publisherID).
		WillReturnRows(sqlmock.NewRows([]string{"max_active_surveys"}).AddRow(nil))

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

	currentVersionID := uuid.New()
	currentVersionNumber := 1
	surveyRows, questionRows := surveyRowsForPublishTest(surveyID, publisherID, "public", true, 9, 1, false, &currentVersionID, &currentVersionNumber)
	mock.ExpectQuery("FROM surveys s\\s+LEFT JOIN survey_versions sv").
		WithArgs(surveyID).
		WillReturnRows(surveyRows)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(questionRows)
	mock.ExpectQuery("SELECT COALESCE\\(tc.is_allowed, false\\)").
		WithArgs(publisherID, policy.CapabilitySurveyPublicDatasetOptOut).
		WillReturnRows(sqlmock.NewRows([]string{"is_allowed"}).AddRow(true))
	mock.ExpectQuery("FROM surveys s\\s+JOIN survey_versions sv").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "version_number", "snapshot", "points_reward",
			"expires_at", "published_at", "published_by", "created_at",
		}).AddRow(currentVersionID, surveyID, 1, []byte(`{"questions":[]}`), 9, nil, time.Now().UTC(), publisherID, time.Now().UTC()))
	mock.ExpectExec("INSERT INTO user_memberships").
		WithArgs(publisherID, policy.DefaultMembershipTierCode).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT mt.max_active_surveys").
		WithArgs(publisherID).
		WillReturnRows(sqlmock.NewRows([]string{"max_active_surveys"}).AddRow(nil))

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
	mock.ExpectQuery("SELECT CASE WHEN sv.id IS NULL THEN FALSE ELSE sv.snapshot = \\$2::jsonb END").
		WithArgs(surveyID, sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"is_equal"}).AddRow(false))
	mock.ExpectQuery("SELECT COALESCE\\(MAX\\(version_number\\), 0\\) \\+ 1 FROM survey_versions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{"next"}).AddRow(2))
	mock.ExpectQuery("INSERT INTO survey_versions").
		WillReturnRows(sqlmock.NewRows([]string{"created_at"}).AddRow(time.Now().UTC()))
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

func TestSurveyHandler_PublishSurvey_AfterFirstPublish_UsesPublishedVersionPointsAsBaseline(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newSurveyHandlerForPublishTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	publisherID := uuid.New()

	currentVersionID := uuid.New()
	currentVersionNumber := 1
	// Draft already has pointsReward=12, but current published version was 6.
	surveyRows, questionRows := surveyRowsForPublishTest(surveyID, publisherID, "public", true, 12, 1, false, &currentVersionID, &currentVersionNumber)
	mock.ExpectQuery("FROM surveys s\\s+LEFT JOIN survey_versions sv").
		WithArgs(surveyID).
		WillReturnRows(surveyRows)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(questionRows)
	mock.ExpectQuery("SELECT COALESCE\\(tc.is_allowed, false\\)").
		WithArgs(publisherID, policy.CapabilitySurveyPublicDatasetOptOut).
		WillReturnRows(sqlmock.NewRows([]string{"is_allowed"}).AddRow(true))
	mock.ExpectQuery("FROM surveys s\\s+JOIN survey_versions sv").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "version_number", "snapshot", "points_reward",
			"expires_at", "published_at", "published_by", "created_at",
		}).AddRow(currentVersionID, surveyID, 1, []byte(`{"questions":[]}`), 6, nil, time.Now().UTC(), publisherID, time.Now().UTC()))
	mock.ExpectExec("INSERT INTO user_memberships").
		WithArgs(publisherID, policy.DefaultMembershipTierCode).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT mt.max_active_surveys").
		WithArgs(publisherID).
		WillReturnRows(sqlmock.NewRows([]string{"max_active_surveys"}).AddRow(nil))

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT points_balance FROM users WHERE id = \\$1 FOR UPDATE").
		WithArgs(publisherID).
		WillReturnRows(sqlmock.NewRows([]string{"points_balance"}).AddRow(99))
	mock.ExpectExec("UPDATE users SET points_balance = points_balance - \\$2 WHERE id = \\$1").
		WithArgs(publisherID, 6).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO points_transactions").
		WithArgs(sqlmock.AnyArg(), publisherID, -6, sqlmock.AnyArg(), surveyID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT CASE WHEN sv.id IS NULL THEN FALSE ELSE sv.snapshot = \\$2::jsonb END").
		WithArgs(surveyID, sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"is_equal"}).AddRow(false))
	mock.ExpectQuery("SELECT COALESCE\\(MAX\\(version_number\\), 0\\) \\+ 1 FROM survey_versions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{"next"}).AddRow(2))
	mock.ExpectQuery("INSERT INTO survey_versions").
		WillReturnRows(sqlmock.NewRows([]string{"created_at"}).AddRow(time.Now().UTC()))
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

	surveyRows, questionRows := surveyRowsForPublishTest(surveyID, publisherID, "public", true, 0, 0, false, nil, nil)
	mock.ExpectQuery("FROM surveys s\\s+LEFT JOIN survey_versions sv").
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

func TestSurveyHandler_PublishSurvey_MetadataOnly_DoesNotCreateVersion(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newSurveyHandlerForPublishTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	publisherID := uuid.New()
	currentVersionID := uuid.New()
	currentVersionNumber := 1

	surveyRows, questionRows := surveyRowsForPublishTest(surveyID, publisherID, "public", true, 9, 1, false, &currentVersionID, &currentVersionNumber)
	mock.ExpectQuery("FROM surveys s\\s+LEFT JOIN survey_versions sv").
		WithArgs(surveyID).
		WillReturnRows(surveyRows)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(questionRows)
	mock.ExpectQuery("SELECT COALESCE\\(tc.is_allowed, false\\)").
		WithArgs(publisherID, policy.CapabilitySurveyPublicDatasetOptOut).
		WillReturnRows(sqlmock.NewRows([]string{"is_allowed"}).AddRow(true))
	mock.ExpectQuery("FROM surveys s\\s+JOIN survey_versions sv").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "version_number", "snapshot", "points_reward",
			"expires_at", "published_at", "published_by", "created_at",
		}).AddRow(currentVersionID, surveyID, 1, []byte(`{"questions":[]}`), 9, nil, time.Now().UTC(), publisherID, time.Now().UTC()))
	mock.ExpectExec("INSERT INTO user_memberships").
		WithArgs(publisherID, policy.DefaultMembershipTierCode).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT mt.max_active_surveys").
		WithArgs(publisherID).
		WillReturnRows(sqlmock.NewRows([]string{"max_active_surveys"}).AddRow(nil))

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT CASE WHEN sv.id IS NULL THEN FALSE ELSE sv.snapshot = \\$2::jsonb END").
		WithArgs(surveyID, sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"is_equal"}).AddRow(true))
	mock.ExpectExec("UPDATE survey_versions\\s+SET points_reward = \\$2,\\s+expires_at = \\$3").
		WithArgs(surveyID, 9, nil).
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
	require.Contains(t, w.Body.String(), `"message":"Settings saved. No new version was created."`)
	require.Contains(t, w.Body.String(), `"survey"`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyHandler_PublishSurvey_MetadataOnlyWithTopUp_DeductsPointsWithoutNewVersion(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newSurveyHandlerForPublishTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	publisherID := uuid.New()
	currentVersionID := uuid.New()
	currentVersionNumber := 1

	surveyRows, questionRows := surveyRowsForPublishTest(surveyID, publisherID, "public", true, 9, 1, false, &currentVersionID, &currentVersionNumber)
	mock.ExpectQuery("FROM surveys s\\s+LEFT JOIN survey_versions sv").
		WithArgs(surveyID).
		WillReturnRows(surveyRows)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(questionRows)
	mock.ExpectQuery("SELECT COALESCE\\(tc.is_allowed, false\\)").
		WithArgs(publisherID, policy.CapabilitySurveyPublicDatasetOptOut).
		WillReturnRows(sqlmock.NewRows([]string{"is_allowed"}).AddRow(true))
	mock.ExpectQuery("FROM surveys s\\s+JOIN survey_versions sv").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "version_number", "snapshot", "points_reward",
			"expires_at", "published_at", "published_by", "created_at",
		}).AddRow(currentVersionID, surveyID, 1, []byte(`{"questions":[]}`), 9, nil, time.Now().UTC(), publisherID, time.Now().UTC()))
	mock.ExpectExec("INSERT INTO user_memberships").
		WithArgs(publisherID, policy.DefaultMembershipTierCode).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT mt.max_active_surveys").
		WithArgs(publisherID).
		WillReturnRows(sqlmock.NewRows([]string{"max_active_surveys"}).AddRow(nil))

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
	mock.ExpectQuery("SELECT CASE WHEN sv.id IS NULL THEN FALSE ELSE sv.snapshot = \\$2::jsonb END").
		WithArgs(surveyID, sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"is_equal"}).AddRow(true))
	mock.ExpectExec("UPDATE survey_versions\\s+SET points_reward = \\$2,\\s+expires_at = \\$3").
		WithArgs(surveyID, 12, nil).
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
	require.Contains(t, w.Body.String(), `"message":"Settings saved. No new version was created."`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyHandler_PublishSurvey_RejectsWhenActiveSurveyLimitReached(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newSurveyHandlerForPublishTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	publisherID := uuid.New()

	surveyRows, questionRows := surveyRowsForPublishTest(surveyID, publisherID, "public", true, 0, 0, false, nil, nil)
	mock.ExpectQuery("FROM surveys s\\s+LEFT JOIN survey_versions sv").
		WithArgs(surveyID).
		WillReturnRows(surveyRows)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(questionRows)
	mock.ExpectQuery("SELECT COALESCE\\(tc.is_allowed, false\\)").
		WithArgs(publisherID, policy.CapabilitySurveyPublicDatasetOptOut).
		WillReturnRows(sqlmock.NewRows([]string{"is_allowed"}).AddRow(true))
	mock.ExpectExec("INSERT INTO user_memberships").
		WithArgs(publisherID, policy.DefaultMembershipTierCode).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT mt.max_active_surveys").
		WithArgs(publisherID).
		WillReturnRows(sqlmock.NewRows([]string{"max_active_surveys"}).AddRow(3))
	mock.ExpectQuery("SELECT COUNT\\(\\*\\)\\s+FROM surveys s").
		WithArgs(publisherID, surveyID).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(3))

	r := gin.New()
	r.POST("/api/v1/surveys/:id/publish", func(c *gin.Context) {
		c.Set("userID", publisherID)
		h.PublishSurvey(c)
	})

	body, err := json.Marshal(map[string]any{
		"visibility":        "public",
		"includeInDatasets": true,
		"pointsReward":      0,
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/surveys/"+surveyID.String()+"/publish", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusForbidden, w.Code)
	require.Contains(t, w.Body.String(), activeSurveyLimitReachedError)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyHandler_OpenSurveyResponses_ExpiredVersionReturnsConflict(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newSurveyHandlerForPublishTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	publisherID := uuid.New()
	currentVersionID := uuid.New()
	currentVersionNumber := 1
	now := time.Now().UTC()
	expired := now.Add(-1 * time.Hour)

	surveyRows, questionRows := surveyRowsForPublishTest(
		surveyID,
		publisherID,
		"public",
		true,
		0,
		1,
		false,
		&currentVersionID,
		&currentVersionNumber,
	)
	mock.ExpectQuery("FROM surveys s\\s+LEFT JOIN survey_versions sv").
		WithArgs(surveyID).
		WillReturnRows(surveyRows)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(questionRows)
	mock.ExpectQuery("FROM surveys s\\s+JOIN survey_versions sv").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "version_number", "snapshot", "points_reward",
			"expires_at", "published_at", "published_by", "created_at",
		}).AddRow(currentVersionID, surveyID, 1, []byte(`{"questions":[]}`), 0, expired, now, publisherID, now))

	r := gin.New()
	r.POST("/api/v1/surveys/:id/responses/open", func(c *gin.Context) {
		c.Set("userID", publisherID)
		h.OpenSurveyResponses(c)
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/surveys/"+surveyID.String()+"/responses/open", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusConflict, w.Code)
	require.Contains(t, w.Body.String(), publishedVersionExpiredError)
	require.NoError(t, mock.ExpectationsWereMet())
}
