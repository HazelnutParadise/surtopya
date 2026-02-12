package handlers

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/TimLai666/surtopya-api/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func newDatasetHandlerForTest(t *testing.T) (*DatasetHandler, sqlmock.Sqlmock, func()) {
	t.Helper()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)

	h := &DatasetHandler{
		db:         db,
		repo:       repository.NewDatasetRepository(db),
		pointsRepo: repository.NewPointsRepository(db),
	}

	cleanup := func() { _ = db.Close() }
	return h, mock, cleanup
}

func datasetGetByIDRow(id uuid.UUID, accessType string, price int, filePath string, fileName string) *sqlmock.Rows {
	cols := []string{
		"id", "survey_id", "title", "description", "category", "access_type", "price",
		"download_count", "sample_size", "is_active", "file_path", "file_name", "file_size", "mime_type",
		"created_at", "updated_at",
	}
	now := time.Now().UTC()
	return sqlmock.NewRows(cols).AddRow(
		id,
		nil, // survey_id
		"Test Dataset",
		"Test description",
		"technology",
		accessType,
		price,
		0,   // download_count
		10,  // sample_size
		true, // is_active
		filePath,
		fileName,
		int64(1),
		"text/csv",
		now,
		now,
	)
}

func TestDatasetHandler_GetDatasets_SortDownloads_OrdersByDownloadCount(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newDatasetHandlerForTest(t)
	t.Cleanup(cleanup)

	mock.ExpectQuery("ORDER BY download_count DESC, created_at DESC").WillReturnRows(sqlmock.NewRows([]string{
		"id", "survey_id", "title", "description", "category", "access_type", "price",
		"download_count", "sample_size", "is_active", "file_path", "file_name", "file_size", "mime_type",
		"created_at", "updated_at",
	}))

	r := gin.New()
	r.GET("/api/v1/datasets", h.GetDatasets)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/datasets?sort=downloads&limit=20&offset=0", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestDatasetHandler_GetDatasets_SortSamples_OrdersBySampleSize(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newDatasetHandlerForTest(t)
	t.Cleanup(cleanup)

	mock.ExpectQuery("ORDER BY sample_size DESC, created_at DESC").WillReturnRows(sqlmock.NewRows([]string{
		"id", "survey_id", "title", "description", "category", "access_type", "price",
		"download_count", "sample_size", "is_active", "file_path", "file_name", "file_size", "mime_type",
		"created_at", "updated_at",
	}))

	r := gin.New()
	r.GET("/api/v1/datasets", h.GetDatasets)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/datasets?sort=samples&limit=20&offset=0", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestDatasetHandler_GetDatasets_SortNewest_OrdersByCreatedAt(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newDatasetHandlerForTest(t)
	t.Cleanup(cleanup)

	mock.ExpectQuery("ORDER BY created_at DESC").WillReturnRows(sqlmock.NewRows([]string{
		"id", "survey_id", "title", "description", "category", "access_type", "price",
		"download_count", "sample_size", "is_active", "file_path", "file_name", "file_size", "mime_type",
		"created_at", "updated_at",
	}))

	r := gin.New()
	r.GET("/api/v1/datasets", h.GetDatasets)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/datasets?sort=newest&limit=20&offset=0", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestDatasetHandler_DownloadDataset_PaidRequiresAuth_401(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newDatasetHandlerForTest(t)
	t.Cleanup(cleanup)

	tmp, err := os.CreateTemp(t.TempDir(), "dataset-*.csv")
	require.NoError(t, err)
	require.NoError(t, tmp.Close())

	datasetID := uuid.New()

	mock.ExpectQuery("FROM datasets WHERE id = \\$1").
		WithArgs(datasetID).
		WillReturnRows(datasetGetByIDRow(datasetID, "paid", 10, tmp.Name(), "paid.csv"))

	// Handler starts a transaction only after verifying file exists.
	mock.ExpectBegin()
	mock.ExpectRollback()

	r := gin.New()
	r.POST("/api/v1/datasets/:id/download", h.DownloadDataset)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/datasets/"+datasetID.String()+"/download", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestDatasetHandler_DownloadDataset_PaidInsufficientPoints_402_NoSideEffects(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newDatasetHandlerForTest(t)
	t.Cleanup(cleanup)

	tmp, err := os.CreateTemp(t.TempDir(), "dataset-*.csv")
	require.NoError(t, err)
	require.NoError(t, tmp.Close())

	datasetID := uuid.New()
	userID := uuid.New()

	mock.ExpectQuery("FROM datasets WHERE id = \\$1").
		WithArgs(datasetID).
		WillReturnRows(datasetGetByIDRow(datasetID, "paid", 10, tmp.Name(), "paid.csv"))

	mock.ExpectBegin()

	// PointsRepository.DeductForDatasetTx begins by selecting user balance FOR UPDATE.
	mock.ExpectQuery("SELECT points_balance FROM users WHERE id = \\$1 FOR UPDATE").
		WithArgs(userID).
		WillReturnRows(sqlmock.NewRows([]string{"points_balance"}).AddRow(3))

	// No download_count UPDATE and no points_transactions INSERT expected on insufficient points.
	mock.ExpectRollback()

	r := gin.New()
	// Inject auth context for the handler.
	r.Use(func(c *gin.Context) {
		c.Set("userID", userID)
		c.Next()
	})
	r.POST("/api/v1/datasets/:id/download", h.DownloadDataset)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/datasets/"+datasetID.String()+"/download", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusPaymentRequired, w.Code)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestDatasetHandler_DownloadDataset_PaidSuccess_DeductsAndIncrementsAndReturnsAttachment(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h, mock, cleanup := newDatasetHandlerForTest(t)
	t.Cleanup(cleanup)

	tmp, err := os.CreateTemp(t.TempDir(), "dataset-*.csv")
	require.NoError(t, err)
	_, err = tmp.WriteString("a,b\n1,2\n")
	require.NoError(t, err)
	require.NoError(t, tmp.Close())

	datasetID := uuid.New()
	userID := uuid.New()

	mock.ExpectQuery("FROM datasets WHERE id = \\$1").
		WithArgs(datasetID).
		WillReturnRows(datasetGetByIDRow(datasetID, "paid", 10, tmp.Name(), "paid.csv"))

	mock.ExpectBegin()

	// DeductForDatasetTx: lock user row, update balance, insert transaction
	mock.ExpectQuery("SELECT points_balance FROM users WHERE id = \\$1 FOR UPDATE").
		WithArgs(userID).
		WillReturnRows(sqlmock.NewRows([]string{"points_balance"}).AddRow(99))

	mock.ExpectExec("UPDATE users SET points_balance = points_balance - \\$2 WHERE id = \\$1").
		WithArgs(userID, 10).
		WillReturnResult(sqlmock.NewResult(0, 1))

	mock.ExpectExec("INSERT INTO points_transactions").
		WithArgs(sqlmock.AnyArg(), userID, -10, sqlmock.AnyArg(), datasetID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	mock.ExpectExec("UPDATE datasets SET download_count = download_count \\+ 1 WHERE id = \\$1").
		WithArgs(datasetID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	mock.ExpectCommit()

	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("userID", userID)
		c.Next()
	})
	r.POST("/api/v1/datasets/:id/download", h.DownloadDataset)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/datasets/"+datasetID.String()+"/download", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Header().Get("Content-Disposition"), `attachment; filename="paid.csv"`)
	require.NoError(t, mock.ExpectationsWereMet())
}
