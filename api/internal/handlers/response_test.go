package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/TimLai666/surtopya-api/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func newResponseHandlerForTest(t *testing.T) (*ResponseHandler, sqlmock.Sqlmock, func()) {
	t.Helper()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)

	h := &ResponseHandler{
		db:           db,
		responseRepo: repository.NewResponseRepository(db),
		draftRepo:    repository.NewResponseDraftRepository(db),
		surveyRepo:   repository.NewSurveyRepository(db),
		pointsRepo:   repository.NewPointsRepository(db),
	}
	cleanup := func() { _ = db.Close() }
	return h, mock, cleanup
}

func surveyGetByIDRowsForTest(id uuid.UUID, userID uuid.UUID, pointsReward int, isResponseOpen bool, currentVersionID uuid.UUID, currentVersionNumber int) (*sqlmock.Rows, *sqlmock.Rows) {
	now := time.Now().UTC()
	surveyCols := []string{
		"id", "user_id", "title", "description", "visibility", "require_login_to_respond", "is_response_open",
		"include_in_datasets", "ever_public", "published_count", "theme", "points_reward",
		"expires_at", "response_count", "created_at", "updated_at", "published_at",
		"current_published_version_id", "current_published_version_number", "has_unpublished_changes", "deleted_at",
	}
	surveyRows := sqlmock.NewRows(surveyCols).AddRow(
		id,
		userID,
		"Test Survey",
		"Desc",
		"public",
		false,
		isResponseOpen,
		true,
		true,
		1,
		[]byte("{}"),
		pointsReward,
		nil,
		0,
		now,
		now,
		now,
		currentVersionID,
		currentVersionNumber,
		false,
		nil,
	)

	questionCols := []string{
		"id", "survey_id", "type", "title", "description", "options", "required",
		"max_rating", "min_selections", "max_selections", "default_destination_question_id",
		"logic", "sort_order", "created_at", "updated_at",
	}
	questionRows := sqlmock.NewRows(questionCols)
	return surveyRows, questionRows
}

func TestResponseHandler_StartResponse_AnonymousRejected(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()

	r := gin.New()
	r.POST("/api/v1/surveys/:id/responses/start", h.StartResponse)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/surveys/"+surveyID.String()+"/responses/start", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusBadRequest, w.Code)
	require.Contains(t, w.Body.String(), "Anonymous users should submit directly")
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestResponseHandler_StartResponse_AuthenticatedCreatesDraft(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	publisherID := uuid.New()
	respondentID := uuid.New()
	versionID := uuid.New()
	now := time.Now().UTC()

	surveyRows, questionRows := surveyGetByIDRowsForTest(surveyID, publisherID, 0, true, versionID, 1)
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
		}).AddRow(versionID, surveyID, 1, []byte(`{"questions":[]}`), 0, nil, now, publisherID, now))
	mock.ExpectQuery("SELECT EXISTS\\(\\s*SELECT 1\\s*FROM survey_response_once_locks\\s*WHERE survey_id = \\$1 AND user_id = \\$2\\s*\\)").
		WithArgs(surveyID, respondentID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))
	mock.ExpectQuery("FROM response_drafts\\s+WHERE survey_id = \\$1 AND user_id = \\$2").
		WithArgs(surveyID, respondentID).
		WillReturnError(sql.ErrNoRows)
	mock.ExpectQuery("INSERT INTO response_drafts").
		WithArgs(sqlmock.AnyArg(), surveyID, versionID, 1, respondentID, sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"created_at", "updated_at"}).AddRow(now, now))

	r := gin.New()
	r.POST("/api/v1/surveys/:id/responses/start", func(c *gin.Context) {
		c.Set("userID", respondentID)
		h.StartResponse(c)
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/surveys/"+surveyID.String()+"/responses/start", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusCreated, w.Code)
	require.Contains(t, w.Body.String(), `"surveyId":"`+surveyID.String()+`"`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestResponseHandler_StartResponse_AuthenticatedResetsStaleDraftToCurrentPublishedVersion(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	publisherID := uuid.New()
	respondentID := uuid.New()
	currentVersionID := uuid.New()
	staleVersionID := uuid.New()
	draftID := uuid.New()
	questionID := uuid.New()
	now := time.Now().UTC()
	resetStartedAt := now.Add(2 * time.Minute)
	resetUpdatedAt := now.Add(2 * time.Minute)

	surveyRows, questionRows := surveyGetByIDRowsForTest(surveyID, publisherID, 0, true, currentVersionID, 2)
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
		}).AddRow(currentVersionID, surveyID, 2, []byte(`{"questions":[]}`), 0, nil, now, publisherID, now))
	mock.ExpectQuery("SELECT EXISTS\\(\\s*SELECT 1\\s*FROM survey_response_once_locks\\s*WHERE survey_id = \\$1 AND user_id = \\$2\\s*\\)").
		WithArgs(surveyID, respondentID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))
	mock.ExpectQuery("FROM response_drafts\\s+WHERE survey_id = \\$1 AND user_id = \\$2").
		WithArgs(surveyID, respondentID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "survey_version_id", "survey_version_number", "user_id", "started_at", "updated_at", "created_at",
		}).AddRow(draftID, surveyID, staleVersionID, 1, respondentID, now, now, now))
	mock.ExpectQuery("FROM response_draft_answers\\s+WHERE draft_id = \\$1").
		WithArgs(draftID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "draft_id", "question_id", "value", "created_at", "updated_at",
		}).AddRow(uuid.New(), draftID, questionID, []byte(`{"text":"stale answer"}`), now, now))
	mock.ExpectBegin()
	mock.ExpectExec("DELETE FROM response_draft_answers WHERE draft_id = \\$1").
		WithArgs(draftID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("UPDATE response_drafts SET survey_version_id = \\$2, survey_version_number = \\$3, started_at = NOW\\(\\), updated_at = NOW\\(\\) WHERE id = \\$1 RETURNING started_at, updated_at").
		WithArgs(draftID, currentVersionID, 2).
		WillReturnRows(sqlmock.NewRows([]string{"started_at", "updated_at"}).AddRow(resetStartedAt, resetUpdatedAt))
	mock.ExpectCommit()

	r := gin.New()
	r.POST("/api/v1/surveys/:id/responses/start", func(c *gin.Context) {
		c.Set("userID", respondentID)
		h.StartResponse(c)
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/surveys/"+surveyID.String()+"/responses/start", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"id":"`+draftID.String()+`"`)
	require.Contains(t, w.Body.String(), `"surveyVersionId":"`+currentVersionID.String()+`"`)
	require.Contains(t, w.Body.String(), `"surveyVersionNumber":2`)
	require.NotContains(t, w.Body.String(), `"questionId":"`+questionID.String()+`"`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestResponseHandler_StartResponse_AuthenticatedAlreadySubmitted(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	publisherID := uuid.New()
	respondentID := uuid.New()
	versionID := uuid.New()
	now := time.Now().UTC()

	surveyRows, questionRows := surveyGetByIDRowsForTest(surveyID, publisherID, 0, true, versionID, 1)
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
		}).AddRow(versionID, surveyID, 1, []byte(`{"questions":[]}`), 0, nil, now, publisherID, now))
	mock.ExpectQuery("SELECT EXISTS\\(\\s*SELECT 1\\s*FROM survey_response_once_locks\\s*WHERE survey_id = \\$1 AND user_id = \\$2\\s*\\)").
		WithArgs(surveyID, respondentID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

	r := gin.New()
	r.POST("/api/v1/surveys/:id/responses/start", func(c *gin.Context) {
		c.Set("userID", respondentID)
		h.StartResponse(c)
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/surveys/"+surveyID.String()+"/responses/start", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusConflict, w.Code)
	require.Contains(t, w.Body.String(), `"code":"ALREADY_SUBMITTED"`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestResponseHandler_SubmitAllAnswers_Authenticated_AwardsBasePoints(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)

	responseID := uuid.New()
	surveyID := uuid.New()
	versionID := uuid.New()
	respondentID := uuid.New()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT survey_id, survey_version_id, survey_version_number, user_id, status FROM responses WHERE id = \\$1 FOR UPDATE").
		WithArgs(responseID).
		WillReturnRows(sqlmock.NewRows([]string{"survey_id", "survey_version_id", "survey_version_number", "user_id", "status"}).AddRow(surveyID, versionID, 1, respondentID, "in_progress"))
	mock.ExpectQuery("SELECT snapshot, points_reward FROM survey_versions WHERE id = \\$1").
		WithArgs(versionID).
		WillReturnRows(sqlmock.NewRows([]string{"snapshot", "points_reward"}).AddRow([]byte(`{"questions":[]}`), 0))
	mock.ExpectQuery("SELECT value FROM system_settings WHERE key = \\$1").
		WithArgs("survey_base_points").
		WillReturnRows(sqlmock.NewRows([]string{"value"}).AddRow("6"))

	mock.ExpectExec("UPDATE responses SET status = 'completed'").
		WithArgs(responseID, sqlmock.AnyArg(), 6).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE surveys SET response_count = response_count \\+ 1 WHERE id = \\$1").
		WithArgs(surveyID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	// AwardSurveyPointsTx: update respondent balance + insert transaction
	mock.ExpectExec("UPDATE users SET points_balance = points_balance \\+ \\$2 WHERE id = \\$1").
		WithArgs(respondentID, 6).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO points_transactions").
		WithArgs(sqlmock.AnyArg(), respondentID, 6, sqlmock.AnyArg(), surveyID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	mock.ExpectCommit()

	// Reload response after commit
	mock.ExpectQuery("FROM responses WHERE id = \\$1").
		WithArgs(responseID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "survey_version_id", "survey_version_number", "user_id", "anonymous_id", "status", "points_awarded",
			"started_at", "completed_at", "created_at",
		}).AddRow(responseID, surveyID, versionID, 1, respondentID, nil, "completed", 6, time.Now(), time.Now(), time.Now()))
	mock.ExpectQuery("FROM answers WHERE response_id = \\$1").
		WithArgs(responseID).
		WillReturnRows(sqlmock.NewRows([]string{"id", "response_id", "question_id", "value", "created_at"}))

	r := gin.New()
	r.POST("/api/v1/responses/:id/submit", h.SubmitAllAnswers)

	body, err := json.Marshal(map[string]any{"answers": []any{}})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/responses/"+responseID.String()+"/submit", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"pointsAwarded":6`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestResponseHandler_SubmitAllAnswers_Anonymous_AwardsZeroPoints(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)

	responseID := uuid.New()
	surveyID := uuid.New()
	versionID := uuid.New()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT survey_id, survey_version_id, survey_version_number, user_id, status FROM responses WHERE id = \\$1 FOR UPDATE").
		WithArgs(responseID).
		WillReturnRows(sqlmock.NewRows([]string{"survey_id", "survey_version_id", "survey_version_number", "user_id", "status"}).AddRow(surveyID, versionID, 1, nil, "in_progress"))
	mock.ExpectQuery("SELECT snapshot, points_reward FROM survey_versions WHERE id = \\$1").
		WithArgs(versionID).
		WillReturnRows(sqlmock.NewRows([]string{"snapshot", "points_reward"}).AddRow([]byte(`{"questions":[]}`), 0))

	mock.ExpectExec("UPDATE responses SET status = 'completed'").
		WithArgs(responseID, sqlmock.AnyArg(), 0).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE surveys SET response_count = response_count \\+ 1 WHERE id = \\$1").
		WithArgs(surveyID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	mock.ExpectCommit()

	// Reload response after commit
	mock.ExpectQuery("FROM responses WHERE id = \\$1").
		WithArgs(responseID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "survey_version_id", "survey_version_number", "user_id", "anonymous_id", "status", "points_awarded",
			"started_at", "completed_at", "created_at",
		}).AddRow(responseID, surveyID, versionID, 1, nil, "anon", "completed", 0, time.Now(), time.Now(), time.Now()))
	mock.ExpectQuery("FROM answers WHERE response_id = \\$1").
		WithArgs(responseID).
		WillReturnRows(sqlmock.NewRows([]string{"id", "response_id", "question_id", "value", "created_at"}))

	r := gin.New()
	r.POST("/api/v1/responses/:id/submit", h.SubmitAllAnswers)

	body, err := json.Marshal(map[string]any{"answers": []any{}})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/responses/"+responseID.String()+"/submit", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"pointsAwarded":0`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestResponseHandler_SubmitAllAnswers_AppliesPublisherBoostWhenEligible(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)

	responseID := uuid.New()
	surveyID := uuid.New()
	versionID := uuid.New()
	respondentID := uuid.New()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT survey_id, survey_version_id, survey_version_number, user_id, status FROM responses WHERE id = \\$1 FOR UPDATE").
		WithArgs(responseID).
		WillReturnRows(sqlmock.NewRows([]string{"survey_id", "survey_version_id", "survey_version_number", "user_id", "status"}).AddRow(surveyID, versionID, 1, respondentID, "in_progress"))
	mock.ExpectQuery("SELECT snapshot, points_reward FROM survey_versions WHERE id = \\$1").
		WithArgs(versionID).
		WillReturnRows(sqlmock.NewRows([]string{"snapshot", "points_reward"}).AddRow([]byte(`{"questions":[]}`), 9))
	mock.ExpectQuery("SELECT value FROM system_settings WHERE key = \\$1").
		WithArgs("survey_base_points").
		WillReturnRows(sqlmock.NewRows([]string{"value"}).AddRow("6"))

	mock.ExpectExec("UPDATE responses SET status = 'completed'").
		WithArgs(responseID, sqlmock.AnyArg(), 9).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE surveys SET response_count = response_count \\+ 1 WHERE id = \\$1").
		WithArgs(surveyID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Award respondent total
	mock.ExpectExec("UPDATE users SET points_balance = points_balance \\+ \\$2 WHERE id = \\$1").
		WithArgs(respondentID, 9).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO points_transactions").
		WithArgs(sqlmock.AnyArg(), respondentID, 9, sqlmock.AnyArg(), surveyID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	mock.ExpectCommit()

	// Reload response after commit
	mock.ExpectQuery("FROM responses WHERE id = \\$1").
		WithArgs(responseID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "survey_version_id", "survey_version_number", "user_id", "anonymous_id", "status", "points_awarded",
			"started_at", "completed_at", "created_at",
		}).AddRow(responseID, surveyID, versionID, 1, respondentID, nil, "completed", 9, time.Now(), time.Now(), time.Now()))
	mock.ExpectQuery("FROM answers WHERE response_id = \\$1").
		WithArgs(responseID).
		WillReturnRows(sqlmock.NewRows([]string{"id", "response_id", "question_id", "value", "created_at"}))

	r := gin.New()
	r.POST("/api/v1/responses/:id/submit", h.SubmitAllAnswers)

	body, err := json.Marshal(map[string]any{"answers": []any{}})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/responses/"+responseID.String()+"/submit", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"pointsAwarded":9`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestResponseHandler_SubmitAllAnswers_RejectsMissingRequiredSupplementalText(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)

	responseID := uuid.New()
	surveyID := uuid.New()
	versionID := uuid.New()
	respondentID := uuid.New()
	questionID := uuid.New()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT survey_id, survey_version_id, survey_version_number, user_id, status FROM responses WHERE id = \\$1 FOR UPDATE").
		WithArgs(responseID).
		WillReturnRows(sqlmock.NewRows([]string{"survey_id", "survey_version_id", "survey_version_number", "user_id", "status"}).AddRow(surveyID, versionID, 1, respondentID, "in_progress"))
	mock.ExpectQuery("SELECT snapshot, points_reward FROM survey_versions WHERE id = \\$1").
		WithArgs(versionID).
		WillReturnRows(sqlmock.NewRows([]string{"snapshot", "points_reward"}).AddRow([]byte(`{"questions":[{"id":"`+questionID.String()+`","type":"single","title":"Q1","required":false,"options":[{"label":"Regular"},{"label":"Can add details","isOther":true,"requireOtherText":true}]}]}`), 0))
	mock.ExpectRollback()

	r := gin.New()
	r.POST("/api/v1/responses/:id/submit", h.SubmitAllAnswers)

	body, err := json.Marshal(map[string]any{
		"answers": []map[string]any{
			{
				"questionId": questionID.String(),
				"value": map[string]any{
					"value": "Can add details",
				},
			},
		},
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/responses/"+responseID.String()+"/submit", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusBadRequest, w.Code)
	require.Contains(t, w.Body.String(), "Supplemental text is required")
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestResponseHandler_GetSurveyResponses_IncludesAnswers(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	ownerID := uuid.New()
	versionID := uuid.New()
	responseID := uuid.New()
	questionID := uuid.New()
	now := time.Now().UTC()

	surveyRows, questionRows := surveyGetByIDRowsForTest(surveyID, ownerID, 0, true, versionID, 1)
	mock.ExpectQuery("FROM surveys s\\s+LEFT JOIN survey_versions sv").
		WithArgs(surveyID).
		WillReturnRows(surveyRows)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(questionRows)

	mock.ExpectQuery("FROM responses WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "survey_version_id", "survey_version_number", "user_id", "anonymous_id", "status", "points_awarded",
			"started_at", "completed_at", "created_at",
		}).AddRow(responseID, surveyID, versionID, 1, ownerID, nil, "completed", 6, now, now, now))

	mock.ExpectQuery("FROM answers\\s+WHERE response_id IN \\(\\$1\\)").
		WithArgs(responseID).
		WillReturnRows(sqlmock.NewRows([]string{"id", "response_id", "question_id", "value", "created_at"}).AddRow(
			uuid.New(), responseID, questionID, []byte(`{"text":"foo"}`), now,
		))

	r := gin.New()
	r.GET("/api/v1/surveys/:id/responses", func(c *gin.Context) {
		c.Set("userID", ownerID)
		h.GetSurveyResponses(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/surveys/"+surveyID.String()+"/responses", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"responses"`)
	require.Contains(t, w.Body.String(), `"answers":[`)
	require.Contains(t, w.Body.String(), `"text":"foo"`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestResponseHandler_GetSurveyResponseAnalytics_RejectsInvalidVersionQuery(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()

	r := gin.New()
	r.GET("/api/v1/surveys/:id/responses/analytics", func(c *gin.Context) {
		c.Set("userID", uuid.New())
		h.GetSurveyResponseAnalytics(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/surveys/"+surveyID.String()+"/responses/analytics?version=zero", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusBadRequest, w.Code)
	require.Contains(t, w.Body.String(), "Invalid version query")
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestResponseHandler_GetSurveyResponseAnalytics_ReturnsOwnerAnalytics(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)
	mock.MatchExpectationsInOrder(false)

	surveyID := uuid.New()
	ownerID := uuid.New()
	versionID := uuid.New()
	responseID := uuid.New()
	questionID := uuid.New()
	now := time.Now().UTC()

	surveyRows, questionRows := surveyGetByIDRowsForTest(surveyID, ownerID, 0, true, versionID, 1)
	mock.ExpectQuery("FROM surveys s\\s+LEFT JOIN survey_versions sv").
		WithArgs(surveyID).
		WillReturnRows(surveyRows)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(questionRows)

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT id, survey_id, survey_version_id, survey_version_number, user_id, anonymous_id, status, points_awarded,
			started_at, completed_at, created_at
		FROM responses WHERE survey_id = $1
		ORDER BY created_at DESC
	`)).
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "survey_version_id", "survey_version_number", "user_id", "anonymous_id", "status", "points_awarded",
			"started_at", "completed_at", "created_at",
		}).AddRow(responseID, surveyID, versionID, 1, ownerID, nil, "completed", 0, now, now, now))

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT id, response_id, question_id, value, created_at
		FROM answers
		WHERE response_id IN ($1)
		ORDER BY created_at ASC
	`)).
		WithArgs(responseID).
		WillReturnRows(sqlmock.NewRows([]string{"id", "response_id", "question_id", "value", "created_at"}).AddRow(
			uuid.New(), responseID, questionID, []byte(`{"text":"owner visible text"}`), now,
		))

	snapshot, err := json.Marshal(map[string]any{
		"title":             "Survey",
		"description":       "Desc",
		"visibility":        "public",
		"includeInDatasets": true,
		"pointsReward":      0,
		"questions": []map[string]any{
			{
				"id":        questionID,
				"type":      "text",
				"title":     "Comment",
				"required":  false,
				"sortOrder": 0,
			},
		},
	})
	require.NoError(t, err)

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT id, survey_id, version_number, snapshot, points_reward,
			expires_at, published_at, published_by, created_at
		FROM survey_versions
		WHERE survey_id = $1
		ORDER BY version_number DESC
	`)).
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "version_number", "snapshot", "points_reward",
			"expires_at", "published_at", "published_by", "created_at",
		}).AddRow(versionID, surveyID, 1, snapshot, 0, nil, now, ownerID, now))

	r := gin.New()
	r.GET("/api/v1/surveys/:id/responses/analytics", func(c *gin.Context) {
		c.Set("userID", ownerID)
		h.GetSurveyResponseAnalytics(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/surveys/"+surveyID.String()+"/responses/analytics", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"selectedVersion":"all"`)
	require.Contains(t, w.Body.String(), `"pages":[`)
	require.Contains(t, w.Body.String(), `"questionType":"text"`)
	require.Contains(t, w.Body.String(), `"textResponses":["owner visible text"]`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestResponseHandler_GetSurveyResponseAnalytics_ReturnsStableEmptyArrays(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)
	mock.MatchExpectationsInOrder(false)

	surveyID := uuid.New()
	ownerID := uuid.New()
	versionID := uuid.New()

	surveyRows, questionRows := surveyGetByIDRowsForTest(surveyID, ownerID, 0, false, versionID, 0)
	mock.ExpectQuery("FROM surveys s\\s+LEFT JOIN survey_versions sv").
		WithArgs(surveyID).
		WillReturnRows(surveyRows)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(questionRows)

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT id, survey_id, survey_version_id, survey_version_number, user_id, anonymous_id, status, points_awarded,
			started_at, completed_at, created_at
		FROM responses WHERE survey_id = $1
		ORDER BY created_at DESC
	`)).
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "survey_version_id", "survey_version_number", "user_id", "anonymous_id", "status", "points_awarded",
			"started_at", "completed_at", "created_at",
		}))

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT id, survey_id, version_number, snapshot, points_reward,
			expires_at, published_at, published_by, created_at
		FROM survey_versions
		WHERE survey_id = $1
		ORDER BY version_number DESC
	`)).
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "version_number", "snapshot", "points_reward",
			"expires_at", "published_at", "published_by", "created_at",
		}))

	r := gin.New()
	r.GET("/api/v1/surveys/:id/responses/analytics", func(c *gin.Context) {
		c.Set("userID", ownerID)
		h.GetSurveyResponseAnalytics(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/surveys/"+surveyID.String()+"/responses/analytics", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"availableVersions":[]`)
	require.Contains(t, w.Body.String(), `"pages":[]`)
	require.Contains(t, w.Body.String(), `"warnings":[]`)
	require.NoError(t, mock.ExpectationsWereMet())
}
