package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
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
		surveyRepo:   repository.NewSurveyRepository(db),
		pointsRepo:   repository.NewPointsRepository(db),
	}
	cleanup := func() { _ = db.Close() }
	return h, mock, cleanup
}

func surveyGetByIDRowsForTest(id uuid.UUID, userID uuid.UUID, pointsReward int, isPublished bool) (*sqlmock.Rows, *sqlmock.Rows) {
	now := time.Now().UTC()
	surveyCols := []string{
		"id", "user_id", "title", "description", "visibility", "is_published",
		"include_in_datasets", "ever_public", "published_count", "theme", "points_reward",
		"expires_at", "response_count", "created_at", "updated_at", "published_at",
	}
	surveyRows := sqlmock.NewRows(surveyCols).AddRow(
		id,
		userID,
		"Test Survey",
		"Desc",
		"public",
		isPublished,
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
	)

	questionCols := []string{
		"id", "survey_id", "type", "title", "description", "options", "required",
		"max_rating", "logic", "sort_order", "created_at", "updated_at",
	}
	questionRows := sqlmock.NewRows(questionCols)
	return surveyRows, questionRows
}

func TestResponseHandler_StartResponse_PublishedSurvey_CreatesInProgressResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	publisherID := uuid.New()

	surveyRows, questionRows := surveyGetByIDRowsForTest(surveyID, publisherID, 0, true)
	mock.ExpectQuery("FROM surveys WHERE id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(surveyRows)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(questionRows)

	createdResponseID := uuid.New()
	now := time.Now().UTC()
	mock.ExpectQuery("INSERT INTO responses").
		WithArgs(sqlmock.AnyArg(), surveyID, nil, sqlmock.AnyArg(), "in_progress", 0, sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id", "created_at"}).AddRow(createdResponseID, now))

	r := gin.New()
	r.POST("/api/v1/surveys/:id/responses/start", h.StartResponse)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/surveys/"+surveyID.String()+"/responses/start", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusCreated, w.Code)
	require.Contains(t, w.Body.String(), `"status":"in_progress"`)
	require.Contains(t, w.Body.String(), `"surveyId":"`+surveyID.String()+`"`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestResponseHandler_SubmitAllAnswers_Authenticated_AwardsBasePoints(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("SURVEY_BASE_POINTS", "6")

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)

	responseID := uuid.New()
	surveyID := uuid.New()
	respondentID := uuid.New()
	publisherID := uuid.New()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT survey_id, user_id, status FROM responses WHERE id = \\$1 FOR UPDATE").
		WithArgs(responseID).
		WillReturnRows(sqlmock.NewRows([]string{"survey_id", "user_id", "status"}).AddRow(surveyID, respondentID, "in_progress"))

	surveyRows, questionRows := surveyGetByIDRowsForTest(surveyID, publisherID, 0, true)
	mock.ExpectQuery("FROM surveys WHERE id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(surveyRows)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(questionRows)

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
			"id", "survey_id", "user_id", "anonymous_id", "status", "points_awarded",
			"started_at", "completed_at", "created_at",
		}).AddRow(responseID, surveyID, respondentID, nil, "completed", 6, time.Now(), time.Now(), time.Now()))
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
	t.Setenv("SURVEY_BASE_POINTS", "6")

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)

	responseID := uuid.New()
	surveyID := uuid.New()
	publisherID := uuid.New()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT survey_id, user_id, status FROM responses WHERE id = \\$1 FOR UPDATE").
		WithArgs(responseID).
		WillReturnRows(sqlmock.NewRows([]string{"survey_id", "user_id", "status"}).AddRow(surveyID, nil, "in_progress"))

	surveyRows, questionRows := surveyGetByIDRowsForTest(surveyID, publisherID, 0, true)
	mock.ExpectQuery("FROM surveys WHERE id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(surveyRows)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(questionRows)

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
			"id", "survey_id", "user_id", "anonymous_id", "status", "points_awarded",
			"started_at", "completed_at", "created_at",
		}).AddRow(responseID, surveyID, nil, "anon", "completed", 0, time.Now(), time.Now(), time.Now()))
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
	t.Setenv("SURVEY_BASE_POINTS", "6")

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)

	responseID := uuid.New()
	surveyID := uuid.New()
	respondentID := uuid.New()
	publisherID := uuid.New()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT survey_id, user_id, status FROM responses WHERE id = \\$1 FOR UPDATE").
		WithArgs(responseID).
		WillReturnRows(sqlmock.NewRows([]string{"survey_id", "user_id", "status"}).AddRow(surveyID, respondentID, "in_progress"))

	// points_reward=9 => boostReward=3, so total=9 when publisher has enough points.
	surveyRows, questionRows := surveyGetByIDRowsForTest(surveyID, publisherID, 9, true)
	mock.ExpectQuery("FROM surveys WHERE id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(surveyRows)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(questionRows)

	// DeductForSurveyBoostTx: lock publisher row, deduct, insert transaction
	mock.ExpectQuery("SELECT points_balance FROM users WHERE id = \\$1 FOR UPDATE").
		WithArgs(publisherID).
		WillReturnRows(sqlmock.NewRows([]string{"points_balance"}).AddRow(99))
	mock.ExpectExec("UPDATE users SET points_balance = points_balance - \\$2 WHERE id = \\$1").
		WithArgs(publisherID, 9).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO points_transactions").
		WithArgs(sqlmock.AnyArg(), publisherID, -9, sqlmock.AnyArg(), surveyID).
		WillReturnResult(sqlmock.NewResult(0, 1))

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
			"id", "survey_id", "user_id", "anonymous_id", "status", "points_awarded",
			"started_at", "completed_at", "created_at",
		}).AddRow(responseID, surveyID, respondentID, nil, "completed", 9, time.Now(), time.Now(), time.Now()))
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

