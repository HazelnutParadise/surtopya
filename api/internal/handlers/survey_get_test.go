package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func surveyRowsForGetSurveyViewerTest(
	surveyID uuid.UUID,
	userID uuid.UUID,
	hasResponded bool,
) (*sqlmock.Rows, *sqlmock.Rows) {
	now := time.Now().UTC()
	surveyCols := []string{
		"id", "user_id", "title", "description", "visibility", "require_login_to_respond", "is_response_open_effective",
		"include_in_datasets", "ever_public", "published_count", "theme", "points_reward",
		"expires_at", "response_count", "created_at", "updated_at", "published_at",
		"current_published_version_id", "current_published_version_number", "has_unpublished_changes", "has_responded", "deleted_at",
	}
	surveyRows := sqlmock.NewRows(surveyCols).AddRow(
		surveyID,
		userID,
		"Survey",
		"Desc",
		"public",
		false,
		true,
		true,
		true,
		1,
		[]byte("{}"),
		0,
		nil,
		10,
		now,
		now,
		now,
		nil,
		nil,
		false,
		hasResponded,
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

func TestSurveyHandler_GetSurvey_UsesAuthenticatedViewerContext(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newSurveyHandlerForPublishTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	userID := uuid.New()

	surveyRows, questionRows := surveyRowsForGetSurveyViewerTest(surveyID, userID, true)
	mock.ExpectQuery("FROM surveys s\\s+LEFT JOIN survey_versions sv").
		WithArgs(surveyID, userID, nil).
		WillReturnRows(surveyRows)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(questionRows)

	r := gin.New()
	r.GET("/api/v1/surveys/:id", func(c *gin.Context) {
		c.Set("userID", userID)
		h.GetSurvey(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/surveys/"+surveyID.String(), nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"hasResponded":true`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyHandler_GetSurvey_UsesAnonymousViewerHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newSurveyHandlerForPublishTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	ownerID := uuid.New()
	anonymousID := "anon-viewer"

	surveyRows, questionRows := surveyRowsForGetSurveyViewerTest(surveyID, ownerID, true)
	mock.ExpectQuery("FROM surveys s\\s+LEFT JOIN survey_versions sv").
		WithArgs(surveyID, nil, anonymousID).
		WillReturnRows(surveyRows)
	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(questionRows)

	r := gin.New()
	r.GET("/api/v1/surveys/:id", h.GetSurvey)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/surveys/"+surveyID.String(), nil)
	req.Header.Set("X-Surtopya-Anonymous-Id", anonymousID)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"hasResponded":true`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyHandler_GetPublicSurveys_DefaultsToNewestSort(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newSurveyHandlerForPublishTest(t)
	t.Cleanup(cleanup)

	mock.ExpectQuery(`ORDER BY COALESCE\(s\.published_at, s\.created_at\) DESC, s\.id ASC`).
		WithArgs(20, 0, nil, nil).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "user_id", "title", "description", "visibility", "require_login_to_respond", "is_response_open_effective",
			"include_in_datasets", "ever_public", "published_count", "theme", "points_reward",
			"expires_at", "response_count", "created_at", "updated_at", "published_at",
			"current_published_version_id", "current_published_version_number", "has_unpublished_changes", "deleted_at", "is_hot", "has_responded",
		}))

	r := gin.New()
	r.GET("/v1/surveys/public", h.GetPublicSurveys)

	req := httptest.NewRequest(http.MethodGet, "/v1/surveys/public", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyHandler_GetPublicSurveys_ForwardsRecommendedSort(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newSurveyHandlerForPublishTest(t)
	t.Cleanup(cleanup)

	mock.ExpectQuery(`ORDER BY\s*wp\.has_responded ASC`).
		WithArgs(20, 0, nil, nil).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "user_id", "title", "description", "visibility", "require_login_to_respond", "is_response_open_effective",
			"include_in_datasets", "ever_public", "published_count", "theme", "points_reward",
			"expires_at", "response_count", "created_at", "updated_at", "published_at",
			"current_published_version_id", "current_published_version_number", "has_unpublished_changes", "deleted_at", "is_hot", "has_responded",
		}))

	r := gin.New()
	r.GET("/v1/surveys/public", h.GetPublicSurveys)

	req := httptest.NewRequest(http.MethodGet, "/v1/surveys/public?sort=recommended", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.NoError(t, mock.ExpectationsWereMet())
}
