package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/TimLai666/surtopya-api/internal/agentadmin"
	"github.com/TimLai666/surtopya-api/internal/platformlog"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func newAgentAdminHandlerForTest(t *testing.T) (*AgentAdminHandler, sqlmock.Sqlmock, func()) {
	t.Helper()

	db, mock, err := sqlmock.New()
	require.NoError(t, err)

	h := &AgentAdminHandler{
		service: agentadmin.NewService(db),
		logger:  platformlog.NewLogger(db),
		db:      db,
	}

	cleanup := func() { _ = db.Close() }
	return h, mock, cleanup
}

func TestAgentAdminHandler_GetSurveyResponseAnalytics_RejectsCrossOwnerAccess(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newAgentAdminHandlerForTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	ownerID := uuid.New()
	agentOwnerID := uuid.New()
	versionID := uuid.New()

	surveyRows, questionRows := surveyGetByIDRowsForTest(surveyID, ownerID, 0, true, versionID, 1)
	mock.ExpectQuery("FROM surveys s\\s+LEFT JOIN survey_versions sv").
		WithArgs(surveyID).
		WillReturnRows(surveyRows)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(questionRows)

	r := gin.New()
	r.GET("/api/v1/agent-admin/surveys/:id/responses/analytics", func(c *gin.Context) {
		c.Set("agentAdminIdentity", &agentadmin.AuthenticatedAgent{
			Account: agentadmin.Account{
				ID:                uuid.New(),
				OwnerUserID:       agentOwnerID,
				OwnerIsSuperAdmin: false,
				Permissions:       []string{"surveys.read"},
			},
			Scopes: map[string]struct{}{
				"surveys.read": {},
			},
		})
		h.GetSurveyResponseAnalytics(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/agent-admin/surveys/"+surveyID.String()+"/responses/analytics", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusForbidden, w.Code)
	require.Contains(t, w.Body.String(), `"code":"forbidden"`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestAgentAdminHandler_GetSurveyResponseAnalytics_RedactsTextResponses(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newAgentAdminHandlerForTest(t)
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
			uuid.New(), responseID, questionID, []byte(`{"text":"private owner text"}`), now,
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
	r.GET("/api/v1/agent-admin/surveys/:id/responses/analytics", func(c *gin.Context) {
		c.Set("agentAdminIdentity", &agentadmin.AuthenticatedAgent{
			Account: agentadmin.Account{
				ID:                uuid.New(),
				OwnerUserID:       ownerID,
				OwnerIsSuperAdmin: false,
				Permissions:       []string{"surveys.read"},
			},
			Scopes: map[string]struct{}{
				"surveys.read": {},
			},
		})
		h.GetSurveyResponseAnalytics(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/agent-admin/surveys/"+surveyID.String()+"/responses/analytics", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"selected_version":"all"`)
	require.Contains(t, w.Body.String(), `"question_type":"text"`)
	require.NotContains(t, w.Body.String(), "private owner text")
	require.Contains(t, w.Body.String(), `"response_count":1`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestAgentAdminHandler_GetSurveyResponseAnalytics_ReturnsStableEmptyArrays(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newAgentAdminHandlerForTest(t)
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
	r.GET("/api/v1/agent-admin/surveys/:id/responses/analytics", func(c *gin.Context) {
		c.Set("agentAdminIdentity", &agentadmin.AuthenticatedAgent{
			Account: agentadmin.Account{
				ID:                uuid.New(),
				OwnerUserID:       ownerID,
				OwnerIsSuperAdmin: false,
				Permissions:       []string{"surveys.read"},
			},
			Scopes: map[string]struct{}{
				"surveys.read": {},
			},
		})
		h.GetSurveyResponseAnalytics(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/agent-admin/surveys/"+surveyID.String()+"/responses/analytics", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"available_versions":[]`)
	require.Contains(t, w.Body.String(), `"questions":[]`)
	require.Contains(t, w.Body.String(), `"warnings":[]`)
	require.NoError(t, mock.ExpectationsWereMet())
}
