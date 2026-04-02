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

func surveyRowsForAnonymousResponseTest(
	surveyID uuid.UUID,
	userID uuid.UUID,
	versionID uuid.UUID,
	requireLogin bool,
	pointsReward int,
) (*sqlmock.Rows, *sqlmock.Rows) {
	now := time.Now().UTC()
	surveyCols := []string{
		"id", "user_id", "title", "description", "visibility", "require_login_to_respond", "is_response_open",
		"include_in_datasets", "ever_public", "published_count", "theme", "points_reward", "completion_title", "completion_message",
		"expires_at", "response_count", "created_at", "updated_at", "published_at",
		"current_published_version_id", "current_published_version_number", "has_unpublished_changes", "deleted_at",
	}
	surveyRows := sqlmock.NewRows(surveyCols).AddRow(
		surveyID,
		userID,
		"Anonymous Test",
		"Desc",
		"public",
		requireLogin,
		true,
		true,
		true,
		1,
		[]byte("{}"),
		pointsReward,
		nil,
		nil,
		nil,
		0,
		now,
		now,
		now,
		versionID,
		1,
		false,
		nil,
	)

	questionCols := []string{
		"id", "survey_id", "type", "title", "description", "options", "required",
		"max_rating", "min_selections", "max_selections", "default_destination_question_id",
		"logic", "sort_order", "created_at", "updated_at",
	}
	return surveyRows, sqlmock.NewRows(questionCols)
}

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

func TestResponseHandler_SubmitAnonymousResponse_LoginRequiredRejected(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	publisherID := uuid.New()
	versionID := uuid.New()
	now := time.Now().UTC()

	surveyRows, questionRows := surveyRowsForAnonymousResponseTest(surveyID, publisherID, versionID, true, 0)
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

	r := gin.New()
	r.POST("/api/v1/surveys/:id/responses/submit-anonymous", h.SubmitAnonymousResponse)

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/surveys/"+surveyID.String()+"/responses/submit-anonymous",
		bytes.NewReader([]byte(`{"answers":[]}`)),
	)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusForbidden, w.Code)
	require.Contains(t, w.Body.String(), `"code":"LOGIN_REQUIRED_TO_RESPOND"`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestResponseHandler_SubmitAnonymousResponse_ReturnsClaimContext(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	publisherID := uuid.New()
	versionID := uuid.New()
	questionID := uuid.New()
	responseID := uuid.New()
	now := time.Now().UTC()

	surveyRows, questionRows := surveyRowsForAnonymousResponseTest(surveyID, publisherID, versionID, false, 9)
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
			versionID,
			surveyID,
			1,
			[]byte(`{"completionTitle":"Thanks","completionMessage":"See you again","questions":[{"id":"`+questionID.String()+`","type":"short","title":"Q1","required":false}]}`),
			9,
			nil,
			now,
			publisherID,
			now,
		))

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT snapshot, points_reward FROM survey_versions WHERE id = \\$1").
		WithArgs(versionID).
		WillReturnRows(sqlmock.NewRows([]string{"snapshot", "points_reward"}).AddRow(
			[]byte(`{"completionTitle":"Thanks","completionMessage":"See you again","questions":[{"id":"`+questionID.String()+`","type":"short","title":"Q1","required":false}]}`),
			9,
		))
	mock.ExpectQuery("SELECT completion_title, completion_message FROM surveys WHERE id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{"completion_title", "completion_message"}).AddRow("Live thanks", "Live follow-up"))
	mock.ExpectQuery("SELECT value FROM system_settings WHERE key = \\$1").
		WithArgs("survey_base_points").
		WillReturnRows(sqlmock.NewRows([]string{"value"}).AddRow("6"))
	mock.ExpectExec("INSERT INTO responses").
		WithArgs(sqlmock.AnyArg(), surveyID, versionID, 1, "anon-1", 9, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO survey_response_once_locks").
		WithArgs(sqlmock.AnyArg(), surveyID, sqlmock.AnyArg(), nil, sqlmock.AnyArg(), "anonymous_submit").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO answers").
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), questionID, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE surveys SET response_count = response_count \\+ 1 WHERE id = \\$1").
		WithArgs(surveyID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO anonymous_response_point_claims").
		WithArgs(sqlmock.AnyArg(), surveyID, sqlmock.AnyArg(), 9, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	mock.ExpectQuery("FROM responses WHERE id = \\$1").
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "survey_version_id", "survey_version_number", "user_id", "anonymous_id", "status", "points_awarded",
			"started_at", "completed_at", "created_at",
		}).AddRow(responseID, surveyID, versionID, 1, nil, "anon-1", "completed", 9, now, now, now))
	mock.ExpectQuery("FROM answers WHERE response_id = \\$1").
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id", "response_id", "question_id", "value", "created_at"}))

	r := gin.New()
	r.POST("/api/v1/surveys/:id/responses/submit-anonymous", h.SubmitAnonymousResponse)

	body, err := json.Marshal(map[string]any{
		"anonymousId": "anon-1",
		"answers": []map[string]any{
			{
				"questionId": questionID.String(),
				"value": map[string]any{
					"text": "hello",
				},
			},
		},
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/surveys/"+surveyID.String()+"/responses/submit-anonymous", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"pointsAwarded":9`)
	require.Contains(t, w.Body.String(), `"claimContext"`)
	require.Contains(t, w.Body.String(), `"completion":{"title":"Live thanks","message":"Live follow-up"}`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestResponseHandler_SubmitAnonymousResponse_DuplicateAnonymousRejected(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	publisherID := uuid.New()
	versionID := uuid.New()
	questionID := uuid.New()
	now := time.Now().UTC()

	surveyRows, questionRows := surveyRowsForAnonymousResponseTest(surveyID, publisherID, versionID, false, 9)
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
			versionID,
			surveyID,
			1,
			[]byte(`{"questions":[{"id":"`+questionID.String()+`","type":"short","title":"Q1","required":false}]}`),
			9,
			nil,
			now,
			publisherID,
			now,
		))

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT snapshot, points_reward FROM survey_versions WHERE id = \\$1").
		WithArgs(versionID).
		WillReturnRows(sqlmock.NewRows([]string{"snapshot", "points_reward"}).AddRow(
			[]byte(`{"questions":[{"id":"`+questionID.String()+`","type":"short","title":"Q1","required":false}]}`),
			9,
		))
	mock.ExpectQuery("SELECT completion_title, completion_message FROM surveys WHERE id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{"completion_title", "completion_message"}).AddRow(nil, nil))
	mock.ExpectQuery("SELECT value FROM system_settings WHERE key = \\$1").
		WithArgs("survey_base_points").
		WillReturnRows(sqlmock.NewRows([]string{"value"}).AddRow("6"))
	mock.ExpectExec("INSERT INTO responses").
		WithArgs(sqlmock.AnyArg(), surveyID, versionID, 1, "anon-1", 9, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO survey_response_once_locks").
		WithArgs(sqlmock.AnyArg(), surveyID, sqlmock.AnyArg(), nil, sqlmock.AnyArg(), "anonymous_submit").
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectRollback()

	r := gin.New()
	r.POST("/api/v1/surveys/:id/responses/submit-anonymous", h.SubmitAnonymousResponse)

	body, err := json.Marshal(map[string]any{
		"anonymousId": "anon-1",
		"answers": []map[string]any{
			{
				"questionId": questionID.String(),
				"value": map[string]any{
					"text": "hello",
				},
			},
		},
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/surveys/"+surveyID.String()+"/responses/submit-anonymous", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusConflict, w.Code)
	require.Contains(t, w.Body.String(), `"code":"ALREADY_SUBMITTED"`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestResponseHandler_SubmitAnonymousResponse_RejectsMissingRequiredSupplementalText(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	publisherID := uuid.New()
	versionID := uuid.New()
	questionID := uuid.New()
	now := time.Now().UTC()

	surveyRows, questionRows := surveyRowsForAnonymousResponseTest(surveyID, publisherID, versionID, false, 0)
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
			versionID,
			surveyID,
			1,
			[]byte(`{"questions":[{"id":"`+questionID.String()+`","type":"single","title":"Q1","required":false,"options":[{"label":"Regular"},{"label":"Can add details","isOther":true,"requireOtherText":true}]}]}`),
			0,
			nil,
			now,
			publisherID,
			now,
		))

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT snapshot, points_reward FROM survey_versions WHERE id = \\$1").
		WithArgs(versionID).
		WillReturnRows(sqlmock.NewRows([]string{"snapshot", "points_reward"}).AddRow(
			[]byte(`{"questions":[{"id":"`+questionID.String()+`","type":"single","title":"Q1","required":false,"options":[{"label":"Regular"},{"label":"Can add details","isOther":true,"requireOtherText":true}]}]}`),
			0,
		))
	mock.ExpectQuery("SELECT completion_title, completion_message FROM surveys WHERE id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{"completion_title", "completion_message"}).AddRow(nil, nil))
	mock.ExpectRollback()

	r := gin.New()
	r.POST("/api/v1/surveys/:id/responses/submit-anonymous", h.SubmitAnonymousResponse)

	body, err := json.Marshal(map[string]any{
		"anonymousId": "anon-1",
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

	req := httptest.NewRequest(http.MethodPost, "/api/v1/surveys/"+surveyID.String()+"/responses/submit-anonymous", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusBadRequest, w.Code)
	require.Contains(t, w.Body.String(), "Supplemental text is required")
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestResponseHandler_ClaimAnonymousPoints_AwardsPointsOnce(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)

	claimToken := uuid.New()
	userID := uuid.New()
	surveyID := uuid.New()
	now := time.Now().UTC()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT response_id, survey_id, points_awarded, status, expires_at FROM anonymous_response_point_claims").
		WithArgs(claimToken).
		WillReturnRows(sqlmock.NewRows([]string{"response_id", "survey_id", "points_awarded", "status", "expires_at"}).AddRow(
			uuid.New(),
			surveyID,
			9,
			"pending",
			now.Add(1*time.Hour),
		))
	mock.ExpectExec("INSERT INTO survey_response_once_locks").
		WithArgs(sqlmock.AnyArg(), surveyID, sqlmock.AnyArg(), sqlmock.AnyArg(), nil, "anonymous_claim").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT user_id FROM surveys WHERE id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{"user_id"}).AddRow(uuid.New()))
	mock.ExpectExec("UPDATE users SET points_balance = points_balance \\+ \\$2 WHERE id = \\$1").
		WithArgs(userID, 9).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO points_transactions").
		WithArgs(sqlmock.AnyArg(), userID, 9, sqlmock.AnyArg(), surveyID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE anonymous_response_point_claims SET status = 'claimed'").
		WithArgs(userID, sqlmock.AnyArg(), claimToken).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	r := gin.New()
	r.POST("/api/v1/responses/claim-anonymous-points", func(c *gin.Context) {
		c.Set("userID", userID)
		h.ClaimAnonymousPoints(c)
	})

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/responses/claim-anonymous-points",
		bytes.NewReader([]byte(`{"claimToken":"`+claimToken.String()+`"}`)),
	)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"pointsAwarded":9`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestResponseHandler_SubmitDraft_OwnerGetsZeroPoints(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)

	draftID := uuid.New()
	surveyID := uuid.New()
	ownerID := uuid.New()
	surveyVersionID := uuid.New()
	questionID := uuid.New()
	now := time.Now().UTC()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT survey_id, survey_version_id, survey_version_number, started_at\\s+FROM response_drafts").
		WithArgs(draftID, ownerID).
		WillReturnRows(sqlmock.NewRows([]string{"survey_id", "survey_version_id", "survey_version_number", "started_at"}).AddRow(
			surveyID, surveyVersionID, 1, now,
		))

	surveyRows, questionRows := surveyGetByIDRowsForTest(surveyID, ownerID, 0, true, surveyVersionID, 1)
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
			9,
			nil,
			now,
			ownerID,
			now,
		))

	mock.ExpectQuery("SELECT snapshot, points_reward FROM survey_versions WHERE id = \\$1").
		WithArgs(surveyVersionID).
		WillReturnRows(sqlmock.NewRows([]string{"snapshot", "points_reward"}).AddRow(
			[]byte(`{"questions":[{"id":"`+questionID.String()+`","type":"short","title":"Q1","required":false}]}`),
			9,
		))
	mock.ExpectQuery("SELECT completion_title, completion_message FROM surveys WHERE id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{"completion_title", "completion_message"}).AddRow(nil, nil))
	mock.ExpectExec("INSERT INTO response_draft_answers").
		WithArgs(sqlmock.AnyArg(), draftID, questionID, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT question_id, value\\s+FROM response_draft_answers\\s+WHERE draft_id = \\$1").
		WithArgs(draftID).
		WillReturnRows(sqlmock.NewRows([]string{"question_id", "value"}).AddRow(
			questionID,
			[]byte(`{"text":"hello"}`),
		))
	mock.ExpectQuery("SELECT user_id FROM surveys WHERE id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{"user_id"}).AddRow(ownerID))
	mock.ExpectExec("INSERT INTO responses").
		WithArgs(sqlmock.AnyArg(), surveyID, surveyVersionID, 1, ownerID, 0, now, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO survey_response_once_locks").
		WithArgs(sqlmock.AnyArg(), surveyID, sqlmock.AnyArg(), ownerID, nil, "authenticated_submit").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO answers").
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), questionID, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE surveys SET response_count = response_count \\+ 1 WHERE id = \\$1").
		WithArgs(surveyID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("DELETE FROM response_drafts WHERE id = \\$1").
		WithArgs(draftID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	mock.ExpectQuery("FROM responses WHERE id = \\$1").
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "survey_version_id", "survey_version_number", "user_id", "anonymous_id", "status", "points_awarded",
			"started_at", "completed_at", "created_at",
		}).AddRow(uuid.New(), surveyID, surveyVersionID, 1, ownerID, nil, "completed", 0, now, now, now))
	mock.ExpectQuery("FROM answers WHERE response_id = \\$1").
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id", "response_id", "question_id", "value", "created_at"}))

	r := gin.New()
	r.POST("/api/v1/drafts/:id/submit", func(c *gin.Context) {
		c.Set("userID", ownerID)
		h.SubmitDraft(c)
	})

	body, err := json.Marshal(map[string]any{
		"answers": []map[string]any{
			{
				"questionId": questionID.String(),
				"value": map[string]any{
					"text": "hello",
				},
			},
		},
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/drafts/"+draftID.String()+"/submit", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"pointsAwarded":0`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestResponseHandler_SubmitDraft_ReturnsLiveCompletionCopy(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)

	draftID := uuid.New()
	surveyID := uuid.New()
	respondentID := uuid.New()
	ownerID := uuid.New()
	surveyVersionID := uuid.New()
	questionID := uuid.New()
	now := time.Now().UTC()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT survey_id, survey_version_id, survey_version_number, started_at\\s+FROM response_drafts").
		WithArgs(draftID, respondentID).
		WillReturnRows(sqlmock.NewRows([]string{"survey_id", "survey_version_id", "survey_version_number", "started_at"}).AddRow(
			surveyID, surveyVersionID, 2, now,
		))

	surveyRows, questionRows := surveyGetByIDRowsForTest(surveyID, ownerID, 0, true, surveyVersionID, 2)
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
			2,
			[]byte(`{"completionTitle":"Draft title","completionMessage":"Draft message","questions":[{"id":"`+questionID.String()+`","type":"short","title":"Q1","required":false}]}`),
			0,
			nil,
			now,
			ownerID,
			now,
		))
	mock.ExpectQuery("SELECT snapshot, points_reward FROM survey_versions WHERE id = \\$1").
		WithArgs(surveyVersionID).
		WillReturnRows(sqlmock.NewRows([]string{"snapshot", "points_reward"}).AddRow(
			[]byte(`{"completionTitle":"Draft title","completionMessage":"Draft message","questions":[{"id":"`+questionID.String()+`","type":"short","title":"Q1","required":false}]}`),
			0,
		))
	mock.ExpectQuery("SELECT completion_title, completion_message FROM surveys WHERE id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{"completion_title", "completion_message"}).AddRow("Live draft title", "Live draft message"))
	mock.ExpectExec("INSERT INTO response_draft_answers").
		WithArgs(sqlmock.AnyArg(), draftID, questionID, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT question_id, value\\s+FROM response_draft_answers\\s+WHERE draft_id = \\$1").
		WithArgs(draftID).
		WillReturnRows(sqlmock.NewRows([]string{"question_id", "value"}).AddRow(
			questionID,
			[]byte(`{"text":"hello"}`),
		))
	mock.ExpectQuery("SELECT user_id FROM surveys WHERE id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{"user_id"}).AddRow(ownerID))
	mock.ExpectQuery("SELECT value FROM system_settings WHERE key = \\$1").
		WithArgs("survey_base_points").
		WillReturnRows(sqlmock.NewRows([]string{"value"}).AddRow("6"))
	mock.ExpectExec("INSERT INTO responses").
		WithArgs(sqlmock.AnyArg(), surveyID, surveyVersionID, 2, respondentID, 6, now, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO survey_response_once_locks").
		WithArgs(sqlmock.AnyArg(), surveyID, sqlmock.AnyArg(), respondentID, nil, "authenticated_submit").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO answers").
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), questionID, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE surveys SET response_count = response_count \\+ 1 WHERE id = \\$1").
		WithArgs(surveyID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE users SET points_balance = points_balance \\+ \\$2 WHERE id = \\$1").
		WithArgs(respondentID, 6).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO points_transactions").
		WithArgs(sqlmock.AnyArg(), respondentID, 6, sqlmock.AnyArg(), surveyID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("DELETE FROM response_drafts WHERE id = \\$1").
		WithArgs(draftID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	mock.ExpectQuery("FROM responses WHERE id = \\$1").
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "survey_version_id", "survey_version_number", "user_id", "anonymous_id", "status", "points_awarded",
			"started_at", "completed_at", "created_at",
		}).AddRow(uuid.New(), surveyID, surveyVersionID, 2, respondentID, nil, "completed", 6, now, now, now))
	mock.ExpectQuery("FROM answers WHERE response_id = \\$1").
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id", "response_id", "question_id", "value", "created_at"}))

	r := gin.New()
	r.POST("/api/v1/drafts/:id/submit", func(c *gin.Context) {
		c.Set("userID", respondentID)
		h.SubmitDraft(c)
	})

	body, err := json.Marshal(map[string]any{
		"answers": []map[string]any{
			{
				"questionId": questionID.String(),
				"value": map[string]any{
					"text": "hello",
				},
			},
		},
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/drafts/"+draftID.String()+"/submit", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"completion":{"title":"Live draft title","message":"Live draft message"}`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestResponseHandler_SubmitDraft_IgnoresStaleDraftAnswersOutsidePublishedVersion(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)

	draftID := uuid.New()
	surveyID := uuid.New()
	respondentID := uuid.New()
	ownerID := uuid.New()
	surveyVersionID := uuid.New()
	validQuestionID := uuid.New()
	staleQuestionID := uuid.New()
	now := time.Now().UTC()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT survey_id, survey_version_id, survey_version_number, started_at\\s+FROM response_drafts").
		WithArgs(draftID, respondentID).
		WillReturnRows(sqlmock.NewRows([]string{"survey_id", "survey_version_id", "survey_version_number", "started_at"}).AddRow(
			surveyID, surveyVersionID, 2, now,
		))

	surveyRows, questionRows := surveyGetByIDRowsForTest(surveyID, ownerID, 0, true, surveyVersionID, 2)
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
			2,
			[]byte(`{"questions":[{"id":"`+validQuestionID.String()+`","type":"short","title":"Q1","required":false}]}`),
			0,
			nil,
			now,
			ownerID,
			now,
		))
	mock.ExpectQuery("SELECT snapshot, points_reward FROM survey_versions WHERE id = \\$1").
		WithArgs(surveyVersionID).
		WillReturnRows(sqlmock.NewRows([]string{"snapshot", "points_reward"}).AddRow(
			[]byte(`{"questions":[{"id":"`+validQuestionID.String()+`","type":"short","title":"Q1","required":false}]}`),
			0,
		))
	mock.ExpectQuery("SELECT completion_title, completion_message FROM surveys WHERE id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{"completion_title", "completion_message"}).AddRow(nil, nil))
	mock.ExpectQuery("SELECT question_id, value\\s+FROM response_draft_answers\\s+WHERE draft_id = \\$1").
		WithArgs(draftID).
		WillReturnRows(sqlmock.NewRows([]string{"question_id", "value"}).
			AddRow(validQuestionID, []byte(`{"text":"keep me"}`)).
			AddRow(staleQuestionID, []byte(`{"text":"stale"}`)))
	mock.ExpectQuery("SELECT user_id FROM surveys WHERE id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{"user_id"}).AddRow(ownerID))
	mock.ExpectQuery("SELECT value FROM system_settings WHERE key = \\$1").
		WithArgs("survey_base_points").
		WillReturnRows(sqlmock.NewRows([]string{"value"}).AddRow("6"))
	mock.ExpectExec("INSERT INTO responses").
		WithArgs(sqlmock.AnyArg(), surveyID, surveyVersionID, 2, respondentID, 6, now, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO survey_response_once_locks").
		WithArgs(sqlmock.AnyArg(), surveyID, sqlmock.AnyArg(), respondentID, nil, "authenticated_submit").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO answers").
		WithArgs(sqlmock.AnyArg(), sqlmock.AnyArg(), validQuestionID, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE surveys SET response_count = response_count \\+ 1 WHERE id = \\$1").
		WithArgs(surveyID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE users SET points_balance = points_balance \\+ \\$2 WHERE id = \\$1").
		WithArgs(respondentID, 6).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO points_transactions").
		WithArgs(sqlmock.AnyArg(), respondentID, 6, sqlmock.AnyArg(), surveyID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("DELETE FROM response_drafts WHERE id = \\$1").
		WithArgs(draftID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	mock.ExpectQuery("FROM responses WHERE id = \\$1").
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "survey_version_id", "survey_version_number", "user_id", "anonymous_id", "status", "points_awarded",
			"started_at", "completed_at", "created_at",
		}).AddRow(uuid.New(), surveyID, surveyVersionID, 2, respondentID, nil, "completed", 6, now, now, now))
	mock.ExpectQuery("FROM answers WHERE response_id = \\$1").
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id", "response_id", "question_id", "value", "created_at"}).
			AddRow(uuid.New(), uuid.New(), validQuestionID, []byte(`{"text":"keep me"}`), now))

	r := gin.New()
	r.POST("/api/v1/drafts/:id/submit", func(c *gin.Context) {
		c.Set("userID", respondentID)
		h.SubmitDraft(c)
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/drafts/"+draftID.String()+"/submit", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestResponseHandler_ClaimAnonymousPoints_OwnerGetsZeroPoints(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)

	claimToken := uuid.New()
	ownerID := uuid.New()
	surveyID := uuid.New()
	responseID := uuid.New()
	now := time.Now().UTC()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT response_id, survey_id, points_awarded, status, expires_at FROM anonymous_response_point_claims").
		WithArgs(claimToken).
		WillReturnRows(sqlmock.NewRows([]string{"response_id", "survey_id", "points_awarded", "status", "expires_at"}).AddRow(
			responseID,
			surveyID,
			9,
			"pending",
			now.Add(1*time.Hour),
		))
	mock.ExpectExec("INSERT INTO survey_response_once_locks").
		WithArgs(sqlmock.AnyArg(), surveyID, responseID, ownerID, nil, "anonymous_claim").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT user_id FROM surveys WHERE id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{"user_id"}).AddRow(ownerID))
	mock.ExpectExec("UPDATE anonymous_response_point_claims SET status = 'claimed'").
		WithArgs(ownerID, sqlmock.AnyArg(), claimToken).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	r := gin.New()
	r.POST("/api/v1/responses/claim-anonymous-points", func(c *gin.Context) {
		c.Set("userID", ownerID)
		h.ClaimAnonymousPoints(c)
	})

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/responses/claim-anonymous-points",
		bytes.NewReader([]byte(`{"claimToken":"`+claimToken.String()+`"}`)),
	)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"pointsAwarded":0`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestResponseHandler_ClaimAnonymousPoints_DuplicateUserDiscardsAnonymousResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)

	claimToken := uuid.New()
	userID := uuid.New()
	surveyID := uuid.New()
	responseID := uuid.New()
	now := time.Now().UTC()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT response_id, survey_id, points_awarded, status, expires_at FROM anonymous_response_point_claims").
		WithArgs(claimToken).
		WillReturnRows(sqlmock.NewRows([]string{"response_id", "survey_id", "points_awarded", "status", "expires_at"}).AddRow(
			responseID,
			surveyID,
			9,
			"pending",
			now.Add(1*time.Hour),
		))
	mock.ExpectExec("INSERT INTO survey_response_once_locks").
		WithArgs(sqlmock.AnyArg(), surveyID, responseID, sqlmock.AnyArg(), nil, "anonymous_claim").
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectExec("DELETE FROM responses WHERE id = \\$1").
		WithArgs(responseID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE surveys SET response_count = GREATEST\\(response_count - 1, 0\\) WHERE id = \\$1").
		WithArgs(surveyID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	r := gin.New()
	r.POST("/api/v1/responses/claim-anonymous-points", func(c *gin.Context) {
		c.Set("userID", userID)
		h.ClaimAnonymousPoints(c)
	})

	req := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/responses/claim-anonymous-points",
		bytes.NewReader([]byte(`{"claimToken":"`+claimToken.String()+`"}`)),
	)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusConflict, w.Code)
	require.Contains(t, w.Body.String(), `"code":"ALREADY_SUBMITTED"`)
	require.Contains(t, w.Body.String(), `"discarded_anonymous_response":true`)
	require.NoError(t, mock.ExpectationsWereMet())
}
