package handlers

import (
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestResponseHandler_GetSurveyResponseAnalytics_FiltersSelectedVersion(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newResponseHandlerForTest(t)
	t.Cleanup(cleanup)
	mock.MatchExpectationsInOrder(false)

	surveyID := uuid.New()
	ownerID := uuid.New()
	versionOneID := uuid.New()
	versionTwoID := uuid.New()
	responseOneID := uuid.New()
	responseTwoID := uuid.New()
	questionID := uuid.New()
	now := time.Now().UTC()

	surveyRows, questionRows := surveyGetByIDRowsForTest(surveyID, ownerID, 0, true, versionTwoID, 2)
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
		}).
			AddRow(responseTwoID, surveyID, versionTwoID, 2, ownerID, nil, "completed", 0, now, now, now).
			AddRow(responseOneID, surveyID, versionOneID, 1, ownerID, nil, "completed", 0, now.Add(-time.Hour), now.Add(-time.Hour), now.Add(-time.Hour)))

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT id, response_id, question_id, value, created_at
		FROM answers
		WHERE response_id IN ($1, $2)
		ORDER BY created_at ASC
	`)).
		WithArgs(responseTwoID, responseOneID).
		WillReturnRows(sqlmock.NewRows([]string{"id", "response_id", "question_id", "value", "created_at"}).
			AddRow(uuid.New(), responseOneID, questionID, []byte(`{"value":"Red"}`), now.Add(-time.Hour)).
			AddRow(uuid.New(), responseTwoID, questionID, []byte(`{"value":"Blue"}`), now))

	snapshot := []byte(`{"title":"Survey","description":"Desc","visibility":"public","includeInDatasets":true,"pointsReward":0,"questions":[{"id":"` + questionID.String() + `","type":"single","title":"Favorite color","options":["Red","Blue"],"required":false,"sortOrder":0}]}`)

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
		}).
			AddRow(versionTwoID, surveyID, 2, snapshot, 0, nil, now, ownerID, now).
			AddRow(versionOneID, surveyID, 1, snapshot, 0, nil, now.Add(-time.Hour), ownerID, now.Add(-time.Hour)))

	r := gin.New()
	r.GET("/api/v1/surveys/:id/responses/analytics", func(c *gin.Context) {
		c.Set("userID", ownerID)
		h.GetSurveyResponseAnalytics(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/surveys/"+surveyID.String()+"/responses/analytics?version=1", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"selectedVersion":"1"`)
	require.Contains(t, w.Body.String(), `"totalCompletedResponses":1`)
	require.Contains(t, w.Body.String(), `"responseCount":1`)
	require.NoError(t, mock.ExpectationsWereMet())
}
