package routes

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestSetupPublicRouter_UsesFreshDatasetHandlerAfterLateDatabaseConnect(t *testing.T) {
	gin.SetMode(gin.TestMode)

	database.DB = nil
	t.Cleanup(func() { database.DB = nil })

	router := SetupPublicRouter()

	db, mock, err := sqlmock.New(sqlmock.MonitorPingsOption(true))
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	database.DB = db

	mock.ExpectPing()
	now := time.Now().UTC()
	mock.ExpectQuery("FROM datasets").
		WithArgs(20, 0).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "title", "description", "category", "access_type", "price",
			"download_count", "sample_size", "is_active",
			"current_published_version_id", "current_published_version_number",
			"has_unpublished_changes", "entitlement_policy",
			"file_path", "file_name", "file_size", "mime_type",
			"created_at", "updated_at",
		}).AddRow(
			uuid.New(),
			nil,
			"Dataset",
			"Description",
			"technology",
			"free",
			0,
			0,
			12,
			true,
			nil,
			nil,
			false,
			"purchased_only",
			"",
			"",
			int64(0),
			"",
			now,
			now,
		))

	req := httptest.NewRequest(http.MethodGet, "/v1/datasets?limit=20&offset=0", nil)
	res := httptest.NewRecorder()
	router.ServeHTTP(res, req)

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("response=%s expectations=%v", res.Body.String(), err)
	}
	require.Equal(t, http.StatusOK, res.Code, res.Body.String())
}
