package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestResponseHandler_SaveDraftAnswersBulk_SavesLatestNonEmptyAnswers(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)

	draftID := uuid.New()
	surveyID := uuid.New()
	userID := uuid.New()
	publisherID := uuid.New()
	surveyVersionID := uuid.New()
	questionID := uuid.New()
	now := time.Now().UTC()
	updatedAt := now.Add(1 * time.Minute)

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT survey_id, survey_version_id, updated_at\\s+FROM response_drafts").
		WithArgs(draftID, userID).
		WillReturnRows(sqlmock.NewRows([]string{"survey_id", "survey_version_id", "updated_at"}).AddRow(
			surveyID, surveyVersionID, now,
		))

	surveyRows, questionRows := surveyGetByIDRowsForTest(
		surveyID,
		publisherID,
		0,
		true,
		surveyVersionID,
		1,
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
		}).AddRow(
			surveyVersionID,
			surveyID,
			1,
			[]byte(`{"questions":[{"id":"`+questionID.String()+`","type":"short","title":"Q1","required":false}]}`),
			0,
			nil,
			now,
			publisherID,
			now,
		))

	mock.ExpectQuery("SELECT snapshot, points_reward FROM survey_versions WHERE id = \\$1").
		WithArgs(surveyVersionID).
		WillReturnRows(sqlmock.NewRows([]string{"snapshot", "points_reward"}).AddRow(
			[]byte(`{"questions":[{"id":"`+questionID.String()+`","type":"short","title":"Q1","required":false}]}`),
			0,
		))

	mock.ExpectExec("INSERT INTO response_draft_answers").
		WithArgs(sqlmock.AnyArg(), draftID, questionID, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectQuery("UPDATE response_drafts SET updated_at = NOW\\(\\) WHERE id = \\$1 RETURNING updated_at").
		WithArgs(draftID).
		WillReturnRows(sqlmock.NewRows([]string{"updated_at"}).AddRow(updatedAt))
	mock.ExpectCommit()

	r := gin.New()
	r.POST("/api/v1/drafts/:id/answers/bulk", func(c *gin.Context) {
		c.Set("userID", userID)
		h.SaveDraftAnswersBulk(c)
	})

	body, err := json.Marshal(map[string]any{
		"answers": []map[string]any{
			{
				"questionId": questionID.String(),
				"value": map[string]any{
					"text": "first",
				},
			},
			{
				"questionId": questionID.String(),
				"value": map[string]any{
					"text": "latest",
				},
			},
		},
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/drafts/"+draftID.String()+"/answers/bulk", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"saved_count":1`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestResponseHandler_SaveDraftAnswersBulk_FiltersEmptyAnswers(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)

	draftID := uuid.New()
	surveyID := uuid.New()
	userID := uuid.New()
	publisherID := uuid.New()
	surveyVersionID := uuid.New()
	questionID := uuid.New()
	now := time.Now().UTC()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT survey_id, survey_version_id, updated_at\\s+FROM response_drafts").
		WithArgs(draftID, userID).
		WillReturnRows(sqlmock.NewRows([]string{"survey_id", "survey_version_id", "updated_at"}).AddRow(
			surveyID, surveyVersionID, now,
		))

	surveyRows, questionRows := surveyGetByIDRowsForTest(
		surveyID,
		publisherID,
		0,
		true,
		surveyVersionID,
		1,
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
		}).AddRow(
			surveyVersionID,
			surveyID,
			1,
			[]byte(`{"questions":[{"id":"`+questionID.String()+`","type":"short","title":"Q1","required":false}]}`),
			0,
			nil,
			now,
			publisherID,
			now,
		))

	mock.ExpectQuery("SELECT snapshot, points_reward FROM survey_versions WHERE id = \\$1").
		WithArgs(surveyVersionID).
		WillReturnRows(sqlmock.NewRows([]string{"snapshot", "points_reward"}).AddRow(
			[]byte(`{"questions":[{"id":"`+questionID.String()+`","type":"short","title":"Q1","required":false}]}`),
			0,
		))
	mock.ExpectCommit()

	r := gin.New()
	r.POST("/api/v1/drafts/:id/answers/bulk", func(c *gin.Context) {
		c.Set("userID", userID)
		h.SaveDraftAnswersBulk(c)
	})

	body, err := json.Marshal(map[string]any{
		"answers": []map[string]any{
			{
				"questionId": questionID.String(),
				"value":      map[string]any{},
			},
		},
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/drafts/"+draftID.String()+"/answers/bulk", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"saved_count":0`)
	require.NoError(t, mock.ExpectationsWereMet())
}
