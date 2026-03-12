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

func TestSurveyHandler_UpdateSurvey_ConvertsExpiresAtLocalToUTC(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newSurveyHandlerForPublishTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	userID := uuid.New()

	surveyRows, questionRows := surveyRowsForPublishTest(surveyID, userID, "non-public", false, 0, 0, false, nil, nil)
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
			time.Date(2026, 3, 11, 7, 0, 0, 0, time.UTC),
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
		"expiresAtLocal": "2026-03-11T15:00",
		"timeZone":       "Asia/Taipei",
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/surveys/"+surveyID.String(), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"expiresAt":"2026-03-11T07:00:00Z"`)
	require.NoError(t, mock.ExpectationsWereMet())
}
