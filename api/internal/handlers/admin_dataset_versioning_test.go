package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func buildMultipartPublishRequest(
	t *testing.T,
	url string,
	fields map[string]string,
	fileField string,
	fileName string,
	fileContent []byte,
) *http.Request {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for key, value := range fields {
		require.NoError(t, writer.WriteField(key, value))
	}
	if fileField != "" {
		part, err := writer.CreateFormFile(fileField, fileName)
		require.NoError(t, err)
		_, err = part.Write(fileContent)
		require.NoError(t, err)
	}
	require.NoError(t, writer.Close())

	req := httptest.NewRequest(http.MethodPost, url, &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req
}

func adminDatasetRow(
	id uuid.UUID,
	title string,
	description string,
	category string,
	accessType string,
	price int,
	sampleSize int,
	isActive bool,
	currentVersionID uuid.UUID,
	currentVersionNumber int,
	hasUnpublishedChanges bool,
	entitlementPolicy string,
	filePath string,
	fileName string,
	fileSize int64,
	mimeType string,
) *sqlmock.Rows {
	now := time.Now().UTC()
	cols := []string{
		"id", "survey_id", "title", "description", "category", "access_type", "price",
		"download_count", "sample_size", "is_active",
		"current_published_version_id", "current_published_version_number",
		"has_unpublished_changes", "entitlement_policy",
		"file_path", "file_name", "file_size", "mime_type",
		"created_at", "updated_at",
	}
	return sqlmock.NewRows(cols).AddRow(
		id,
		nil,
		title,
		description,
		category,
		accessType,
		price,
		0,
		sampleSize,
		isActive,
		currentVersionID,
		currentVersionNumber,
		hasUnpublishedChanges,
		entitlementPolicy,
		filePath,
		fileName,
		fileSize,
		mimeType,
		now,
		now,
	)
}

func adminDatasetDraftRow(
	datasetID uuid.UUID,
	title string,
	description string,
	category string,
	accessType string,
	price int,
	sampleSize int,
	filePath string,
	fileName string,
	fileSize int64,
	mimeType string,
) *sqlmock.Rows {
	cols := []string{
		"dataset_id", "title", "description", "category", "access_type", "price", "sample_size",
		"file_path", "file_name", "file_size", "mime_type", "source_deid_job_id", "updated_by", "updated_at",
	}
	return sqlmock.NewRows(cols).AddRow(
		datasetID,
		title,
		description,
		category,
		accessType,
		price,
		sampleSize,
		filePath,
		fileName,
		fileSize,
		mimeType,
		nil,
		nil,
		time.Now().UTC(),
	)
}

func adminDatasetVersionRow(
	versionID uuid.UUID,
	datasetID uuid.UUID,
	versionNumber int,
	title string,
	description string,
	category string,
	accessType string,
	price int,
	sampleSize int,
	filePath string,
	fileName string,
	fileSize int64,
	mimeType string,
) *sqlmock.Rows {
	cols := []string{
		"id", "dataset_id", "version_number", "title", "description", "category", "access_type",
		"price", "sample_size", "file_path", "file_name", "file_size", "mime_type", "download_count",
		"published_at", "published_by", "created_at",
	}
	now := time.Now().UTC()
	return sqlmock.NewRows(cols).AddRow(
		versionID,
		datasetID,
		versionNumber,
		title,
		description,
		category,
		accessType,
		price,
		sampleSize,
		filePath,
		fileName,
		fileSize,
		mimeType,
		0,
		now,
		nil,
		now,
	)
}

func TestAdminHandler_UpdateDataset_MetadataOnly_DoesNotMarkUnpublished(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	database.DB = db
	t.Cleanup(func() { database.DB = nil })

	h := NewAdminHandler()
	datasetID := uuid.New()
	versionID := uuid.New()
	actorID := uuid.New()

	mock.ExpectQuery("FROM datasets\\s+WHERE id = \\$1").
		WithArgs(datasetID).
		WillReturnRows(adminDatasetRow(
			datasetID,
			"Original Title",
			"Original description",
			"other",
			"free",
			0,
			10,
			true,
			versionID,
			2,
			false,
			"purchased_only",
			"/data/datasets/original.csv",
			"original.csv",
			128,
			"text/csv",
		))

	mock.ExpectBegin()
	mock.ExpectQuery("FROM dataset_drafts\\s+WHERE dataset_id = \\$1").
		WithArgs(datasetID).
		WillReturnRows(adminDatasetDraftRow(
			datasetID,
			"Original Title",
			"Original description",
			"other",
			"free",
			0,
			10,
			"/data/datasets/original.csv",
			"original.csv",
			128,
			"text/csv",
		))
	mock.ExpectExec("INSERT INTO dataset_drafts").
		WithArgs(
			datasetID,
			"Updated Title",
			"Original description",
			"other",
			"free",
			0,
			10,
			"/data/datasets/original.csv",
			"original.csv",
			int64(128),
			"text/csv",
			nil,
			actorID,
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE datasets\\s+SET title = \\$2,\\s+description = \\$3,\\s+category = \\$4,\\s+access_type = \\$5,\\s+price = \\$6,\\s+sample_size = \\$7").
		WithArgs(datasetID, "Updated Title", "Original description", "other", "free", 0, 10).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE dataset_versions\\s+SET title = \\$2,\\s+description = \\$3,\\s+category = \\$4,\\s+access_type = \\$5,\\s+price = \\$6,\\s+sample_size = \\$7").
		WithArgs(datasetID, "Updated Title", "Original description", "other", "free", 0, 10).
		WillReturnResult(sqlmock.NewResult(0, 2))
	mock.ExpectCommit()

	mock.ExpectQuery("FROM datasets\\s+WHERE id = \\$1").
		WithArgs(datasetID).
		WillReturnRows(adminDatasetRow(
			datasetID,
			"Updated Title",
			"Original description",
			"other",
			"free",
			0,
			10,
			true,
			versionID,
			2,
			false,
			"purchased_only",
			"/data/datasets/original.csv",
			"original.csv",
			128,
			"text/csv",
		))

	r := gin.New()
	r.PATCH("/admin/datasets/:id", func(c *gin.Context) {
		c.Set("userID", actorID)
		h.UpdateDataset(c)
	})

	body, err := json.Marshal(map[string]any{
		"title": "Updated Title",
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPatch, "/admin/datasets/"+datasetID.String(), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"title":"Updated Title"`)
	require.Contains(t, w.Body.String(), `"hasUnpublishedChanges":false`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestAdminHandler_PublishDataset_MetadataOnly_DoesNotCreateVersion(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	database.DB = db
	t.Cleanup(func() { database.DB = nil })

	h := NewAdminHandler()
	datasetID := uuid.New()
	versionID := uuid.New()
	actorID := uuid.New()

	mock.ExpectQuery("FROM datasets\\s+WHERE id = \\$1").
		WithArgs(datasetID).
		WillReturnRows(adminDatasetRow(
			datasetID,
			"Updated Title",
			"Original description",
			"other",
			"free",
			0,
			10,
			true,
			versionID,
			2,
			true,
			"purchased_only",
			"/data/datasets/original.csv",
			"original.csv",
			128,
			"text/csv",
		))
	mock.ExpectQuery("FROM dataset_drafts\\s+WHERE dataset_id = \\$1").
		WithArgs(datasetID).
		WillReturnRows(adminDatasetDraftRow(
			datasetID,
			"Updated Title",
			"Original description",
			"other",
			"free",
			0,
			10,
			"/data/datasets/original.csv",
			"original.csv",
			128,
			"text/csv",
		))
	mock.ExpectQuery("FROM datasets d\\s+JOIN dataset_versions v ON v.id = d.current_published_version_id").
		WithArgs(datasetID).
		WillReturnRows(adminDatasetVersionRow(
			versionID,
			datasetID,
			2,
			"Updated Title",
			"Original description",
			"other",
			"free",
			0,
			10,
			"/data/datasets/original.csv",
			"original.csv",
			128,
			"text/csv",
		))

	mock.ExpectBegin()
	mock.ExpectExec("INSERT INTO dataset_drafts").
		WithArgs(
			datasetID,
			"Updated Title",
			"Original description",
			"other",
			"free",
			0,
			10,
			"/data/datasets/original.csv",
			"original.csv",
			int64(128),
			"text/csv",
			nil,
			nil,
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE datasets\\s+SET title = \\$2,\\s+description = \\$3,\\s+category = \\$4,\\s+access_type = \\$5,\\s+price = \\$6,\\s+sample_size = \\$7,\\s+file_path = \\$8,\\s+file_name = \\$9,\\s+file_size = \\$10,\\s+mime_type = \\$11").
		WithArgs(
			datasetID,
			"Updated Title",
			"Original description",
			"other",
			"free",
			0,
			10,
			"/data/datasets/original.csv",
			"original.csv",
			int64(128),
			"text/csv",
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE dataset_versions\\s+SET title = \\$2,\\s+description = \\$3,\\s+category = \\$4,\\s+access_type = \\$5,\\s+price = \\$6,\\s+sample_size = \\$7").
		WithArgs(datasetID, "Updated Title", "Original description", "other", "free", 0, 10).
		WillReturnResult(sqlmock.NewResult(0, 2))
	mock.ExpectExec("UPDATE datasets SET has_unpublished_changes = \\$2 WHERE id = \\$1").
		WithArgs(datasetID, false).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	mock.ExpectQuery("FROM datasets\\s+WHERE id = \\$1").
		WithArgs(datasetID).
		WillReturnRows(adminDatasetRow(
			datasetID,
			"Updated Title",
			"Original description",
			"other",
			"free",
			0,
			10,
			true,
			versionID,
			2,
			false,
			"purchased_only",
			"/data/datasets/original.csv",
			"original.csv",
			128,
			"text/csv",
		))

	r := gin.New()
	r.POST("/admin/datasets/:id/publish", func(c *gin.Context) {
		c.Set("userID", actorID)
		h.PublishDatasetVersion(c)
	})

	req := httptest.NewRequest(http.MethodPost, "/admin/datasets/"+datasetID.String()+"/publish", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"message":"Settings saved. No new version was created."`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestAdminHandler_PublishDataset_FileChanged_CreatesNewVersion(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	database.DB = db
	t.Cleanup(func() { database.DB = nil })

	h := NewAdminHandler()
	datasetID := uuid.New()
	versionID := uuid.New()
	actorID := uuid.New()

	mock.ExpectQuery("FROM datasets\\s+WHERE id = \\$1").
		WithArgs(datasetID).
		WillReturnRows(adminDatasetRow(
			datasetID,
			"Updated Title",
			"Original description",
			"other",
			"free",
			0,
			10,
			true,
			versionID,
			2,
			true,
			"purchased_only",
			"/data/datasets/original.csv",
			"original.csv",
			128,
			"text/csv",
		))
	mock.ExpectQuery("FROM dataset_drafts\\s+WHERE dataset_id = \\$1").
		WithArgs(datasetID).
		WillReturnRows(adminDatasetDraftRow(
			datasetID,
			"Updated Title",
			"Original description",
			"other",
			"free",
			0,
			10,
			"/data/datasets/new.csv",
			"new.csv",
			256,
			"text/csv",
		))
	mock.ExpectQuery("FROM datasets d\\s+JOIN dataset_versions v ON v.id = d.current_published_version_id").
		WithArgs(datasetID).
		WillReturnRows(adminDatasetVersionRow(
			versionID,
			datasetID,
			2,
			"Updated Title",
			"Original description",
			"other",
			"free",
			0,
			10,
			"/data/datasets/original.csv",
			"original.csv",
			128,
			"text/csv",
		))

	mock.ExpectBegin()
	mock.ExpectExec("INSERT INTO dataset_drafts").
		WithArgs(
			datasetID,
			"Updated Title",
			"Original description",
			"other",
			"free",
			0,
			10,
			"/data/datasets/new.csv",
			"new.csv",
			int64(256),
			"text/csv",
			nil,
			nil,
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE datasets SET has_unpublished_changes = TRUE WHERE id = \\$1").
		WithArgs(datasetID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT COALESCE\\(MAX\\(version_number\\), 0\\) \\+ 1 FROM dataset_versions WHERE dataset_id = \\$1").
		WithArgs(datasetID).
		WillReturnRows(sqlmock.NewRows([]string{"next"}).AddRow(3))
	mock.ExpectQuery("INSERT INTO dataset_versions").
		WillReturnRows(sqlmock.NewRows([]string{"created_at"}).AddRow(time.Now().UTC()))
	mock.ExpectExec("UPDATE datasets\\s+SET current_published_version_id = \\$2,\\s+current_published_version_number = \\$3,\\s+has_unpublished_changes = FALSE,\\s+updated_at = NOW\\(\\)\\s+WHERE id = \\$1").
		WithArgs(datasetID, sqlmock.AnyArg(), 3).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE datasets\\s+SET title = \\$2,\\s+description = \\$3,\\s+category = \\$4,\\s+access_type = \\$5,\\s+price = \\$6,\\s+sample_size = \\$7,\\s+file_path = \\$8,\\s+file_name = \\$9,\\s+file_size = \\$10,\\s+mime_type = \\$11").
		WithArgs(
			datasetID,
			"Updated Title",
			"Original description",
			"other",
			"free",
			0,
			10,
			"/data/datasets/new.csv",
			"new.csv",
			int64(256),
			"text/csv",
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE dataset_versions\\s+SET title = \\$2,\\s+description = \\$3,\\s+category = \\$4,\\s+access_type = \\$5,\\s+price = \\$6,\\s+sample_size = \\$7").
		WithArgs(datasetID, "Updated Title", "Original description", "other", "free", 0, 10).
		WillReturnResult(sqlmock.NewResult(0, 3))
	mock.ExpectExec("UPDATE datasets SET has_unpublished_changes = \\$2 WHERE id = \\$1").
		WithArgs(datasetID, false).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	mock.ExpectQuery("FROM datasets\\s+WHERE id = \\$1").
		WithArgs(datasetID).
		WillReturnRows(adminDatasetRow(
			datasetID,
			"Updated Title",
			"Original description",
			"other",
			"free",
			0,
			10,
			true,
			versionID,
			3,
			false,
			"purchased_only",
			"/data/datasets/new.csv",
			"new.csv",
			256,
			"text/csv",
		))

	r := gin.New()
	r.POST("/admin/datasets/:id/publish", func(c *gin.Context) {
		c.Set("userID", actorID)
		h.PublishDatasetVersion(c)
	})

	req := httptest.NewRequest(http.MethodPost, "/admin/datasets/"+datasetID.String()+"/publish", bytes.NewReader([]byte(`{}`)))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"version":`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestAdminHandler_PublishDataset_MultipartWithFile_CreatesNewVersion(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	database.DB = db
	t.Cleanup(func() { database.DB = nil })

	h := NewAdminHandler()
	datasetID := uuid.New()
	versionID := uuid.New()
	actorID := uuid.New()
	newCurrentVersionID := uuid.New()
	fileContent := []byte("col1,col2\n1,2\n")

	mock.ExpectQuery("FROM datasets\\s+WHERE id = \\$1").
		WithArgs(datasetID).
		WillReturnRows(adminDatasetRow(
			datasetID,
			"Updated Title",
			"Original description",
			"other",
			"free",
			0,
			10,
			true,
			versionID,
			2,
			true,
			"purchased_only",
			"/data/datasets/original.csv",
			"original.csv",
			128,
			"text/csv",
		))
	mock.ExpectQuery("FROM dataset_drafts\\s+WHERE dataset_id = \\$1").
		WithArgs(datasetID).
		WillReturnRows(adminDatasetDraftRow(
			datasetID,
			"Updated Title",
			"Original description",
			"other",
			"free",
			0,
			10,
			"/data/datasets/original.csv",
			"original.csv",
			128,
			"text/csv",
		))
	mock.ExpectQuery("FROM datasets d\\s+JOIN dataset_versions v ON v.id = d.current_published_version_id").
		WithArgs(datasetID).
		WillReturnRows(adminDatasetVersionRow(
			versionID,
			datasetID,
			2,
			"Updated Title",
			"Original description",
			"other",
			"free",
			0,
			10,
			"/data/datasets/original.csv",
			"original.csv",
			128,
			"text/csv",
		))

	mock.ExpectBegin()
	mock.ExpectExec("INSERT INTO dataset_drafts").
		WithArgs(
			datasetID,
			"Updated Title",
			"Original description",
			"other",
			"paid",
			21,
			10,
			sqlmock.AnyArg(),
			"replacement.csv",
			int64(len(fileContent)),
			"application/octet-stream",
			nil,
			nil,
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE datasets SET has_unpublished_changes = TRUE WHERE id = \\$1").
		WithArgs(datasetID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT COALESCE\\(MAX\\(version_number\\), 0\\) \\+ 1 FROM dataset_versions WHERE dataset_id = \\$1").
		WithArgs(datasetID).
		WillReturnRows(sqlmock.NewRows([]string{"next"}).AddRow(3))
	mock.ExpectQuery("INSERT INTO dataset_versions").
		WillReturnRows(sqlmock.NewRows([]string{"created_at"}).AddRow(time.Now().UTC()))
	mock.ExpectExec("UPDATE datasets\\s+SET current_published_version_id = \\$2,\\s+current_published_version_number = \\$3,\\s+has_unpublished_changes = FALSE,\\s+updated_at = NOW\\(\\)\\s+WHERE id = \\$1").
		WithArgs(datasetID, sqlmock.AnyArg(), 3).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE datasets\\s+SET title = \\$2,\\s+description = \\$3,\\s+category = \\$4,\\s+access_type = \\$5,\\s+price = \\$6,\\s+sample_size = \\$7,\\s+file_path = \\$8,\\s+file_name = \\$9,\\s+file_size = \\$10,\\s+mime_type = \\$11").
		WithArgs(
			datasetID,
			"Updated Title",
			"Original description",
			"other",
			"paid",
			21,
			10,
			sqlmock.AnyArg(),
			"replacement.csv",
			int64(len(fileContent)),
			"application/octet-stream",
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE dataset_versions\\s+SET title = \\$2,\\s+description = \\$3,\\s+category = \\$4,\\s+access_type = \\$5,\\s+price = \\$6,\\s+sample_size = \\$7").
		WithArgs(datasetID, "Updated Title", "Original description", "other", "paid", 21, 10).
		WillReturnResult(sqlmock.NewResult(0, 3))
	mock.ExpectExec("UPDATE datasets SET has_unpublished_changes = \\$2 WHERE id = \\$1").
		WithArgs(datasetID, false).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	mock.ExpectQuery("FROM datasets\\s+WHERE id = \\$1").
		WithArgs(datasetID).
		WillReturnRows(adminDatasetRow(
			datasetID,
			"Updated Title",
			"Original description",
			"other",
			"paid",
			21,
			10,
			true,
			newCurrentVersionID,
			3,
			false,
			"purchased_only",
			"/data/datasets/replacement.csv",
			"replacement.csv",
			int64(len(fileContent)),
			"application/octet-stream",
		))

	r := gin.New()
	r.POST("/admin/datasets/:id/publish", func(c *gin.Context) {
		c.Set("userID", actorID)
		h.PublishDatasetVersion(c)
	})

	req := buildMultipartPublishRequest(
		t,
		"/admin/datasets/"+datasetID.String()+"/publish",
		map[string]string{
			"accessType": "paid",
			"price":      "21",
		},
		"file",
		"replacement.csv",
		fileContent,
	)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"version":`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestAdminHandler_PublishDataset_MultipartWithoutFile_MetadataOnlyPath(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	database.DB = db
	t.Cleanup(func() { database.DB = nil })

	h := NewAdminHandler()
	datasetID := uuid.New()
	versionID := uuid.New()
	actorID := uuid.New()

	mock.ExpectQuery("FROM datasets\\s+WHERE id = \\$1").
		WithArgs(datasetID).
		WillReturnRows(adminDatasetRow(
			datasetID,
			"Updated Title",
			"Original description",
			"other",
			"free",
			0,
			10,
			true,
			versionID,
			2,
			true,
			"purchased_only",
			"/data/datasets/original.csv",
			"original.csv",
			128,
			"text/csv",
		))
	mock.ExpectQuery("FROM dataset_drafts\\s+WHERE dataset_id = \\$1").
		WithArgs(datasetID).
		WillReturnRows(adminDatasetDraftRow(
			datasetID,
			"Updated Title",
			"Original description",
			"other",
			"free",
			0,
			10,
			"/data/datasets/original.csv",
			"original.csv",
			128,
			"text/csv",
		))
	mock.ExpectQuery("FROM datasets d\\s+JOIN dataset_versions v ON v.id = d.current_published_version_id").
		WithArgs(datasetID).
		WillReturnRows(adminDatasetVersionRow(
			versionID,
			datasetID,
			2,
			"Updated Title",
			"Original description",
			"other",
			"free",
			0,
			10,
			"/data/datasets/original.csv",
			"original.csv",
			128,
			"text/csv",
		))

	mock.ExpectBegin()
	mock.ExpectExec("INSERT INTO dataset_drafts").
		WithArgs(
			datasetID,
			"Updated Title",
			"Original description",
			"other",
			"free",
			0,
			10,
			"/data/datasets/original.csv",
			"original.csv",
			int64(128),
			"text/csv",
			nil,
			nil,
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE datasets\\s+SET title = \\$2,\\s+description = \\$3,\\s+category = \\$4,\\s+access_type = \\$5,\\s+price = \\$6,\\s+sample_size = \\$7,\\s+file_path = \\$8,\\s+file_name = \\$9,\\s+file_size = \\$10,\\s+mime_type = \\$11").
		WithArgs(
			datasetID,
			"Updated Title",
			"Original description",
			"other",
			"free",
			0,
			10,
			"/data/datasets/original.csv",
			"original.csv",
			int64(128),
			"text/csv",
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE dataset_versions\\s+SET title = \\$2,\\s+description = \\$3,\\s+category = \\$4,\\s+access_type = \\$5,\\s+price = \\$6,\\s+sample_size = \\$7").
		WithArgs(datasetID, "Updated Title", "Original description", "other", "free", 0, 10).
		WillReturnResult(sqlmock.NewResult(0, 2))
	mock.ExpectExec("UPDATE datasets SET has_unpublished_changes = \\$2 WHERE id = \\$1").
		WithArgs(datasetID, false).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	mock.ExpectQuery("FROM datasets\\s+WHERE id = \\$1").
		WithArgs(datasetID).
		WillReturnRows(adminDatasetRow(
			datasetID,
			"Updated Title",
			"Original description",
			"other",
			"free",
			0,
			10,
			true,
			versionID,
			2,
			false,
			"purchased_only",
			"/data/datasets/original.csv",
			"original.csv",
			128,
			"text/csv",
		))

	r := gin.New()
	r.POST("/admin/datasets/:id/publish", func(c *gin.Context) {
		c.Set("userID", actorID)
		h.PublishDatasetVersion(c)
	})

	req := buildMultipartPublishRequest(
		t,
		"/admin/datasets/"+datasetID.String()+"/publish",
		map[string]string{
			"accessType": "free",
			"price":      "0",
		},
		"",
		"",
		nil,
	)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"message":"Settings saved. No new version was created."`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestAdminHandler_PublishDataset_MultipartFile_FailureCleansUploadedFile(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	database.DB = db
	t.Cleanup(func() { database.DB = nil })

	tempDir := t.TempDir()
	t.Setenv("DATASETS_DIR", tempDir)

	h := NewAdminHandler()
	datasetID := uuid.New()
	versionID := uuid.New()
	actorID := uuid.New()
	fileContent := []byte("col1,col2\n1,2\n")

	mock.ExpectQuery("FROM datasets\\s+WHERE id = \\$1").
		WithArgs(datasetID).
		WillReturnRows(adminDatasetRow(
			datasetID,
			"Updated Title",
			"Original description",
			"other",
			"free",
			0,
			10,
			true,
			versionID,
			2,
			true,
			"purchased_only",
			"/data/datasets/original.csv",
			"original.csv",
			128,
			"text/csv",
		))
	mock.ExpectQuery("FROM dataset_drafts\\s+WHERE dataset_id = \\$1").
		WithArgs(datasetID).
		WillReturnRows(adminDatasetDraftRow(
			datasetID,
			"Updated Title",
			"Original description",
			"other",
			"free",
			0,
			10,
			"/data/datasets/original.csv",
			"original.csv",
			128,
			"text/csv",
		))
	mock.ExpectQuery("FROM datasets d\\s+JOIN dataset_versions v ON v.id = d.current_published_version_id").
		WithArgs(datasetID).
		WillReturnRows(adminDatasetVersionRow(
			versionID,
			datasetID,
			2,
			"Updated Title",
			"Original description",
			"other",
			"free",
			0,
			10,
			"/data/datasets/original.csv",
			"original.csv",
			128,
			"text/csv",
		))

	mock.ExpectBegin()
	mock.ExpectExec("INSERT INTO dataset_drafts").
		WithArgs(
			datasetID,
			"Updated Title",
			"Original description",
			"other",
			"paid",
			19,
			10,
			sqlmock.AnyArg(),
			"replacement.csv",
			int64(len(fileContent)),
			"application/octet-stream",
			nil,
			nil,
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE datasets SET has_unpublished_changes = TRUE WHERE id = \\$1").
		WithArgs(datasetID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectQuery("SELECT COALESCE\\(MAX\\(version_number\\), 0\\) \\+ 1 FROM dataset_versions WHERE dataset_id = \\$1").
		WithArgs(datasetID).
		WillReturnRows(sqlmock.NewRows([]string{"next"}).AddRow(3))
	mock.ExpectQuery("INSERT INTO dataset_versions").
		WillReturnError(fmt.Errorf("insert failed"))
	mock.ExpectRollback()

	r := gin.New()
	r.POST("/admin/datasets/:id/publish", func(c *gin.Context) {
		c.Set("userID", actorID)
		h.PublishDatasetVersion(c)
	})

	req := buildMultipartPublishRequest(
		t,
		"/admin/datasets/"+datasetID.String()+"/publish",
		map[string]string{
			"accessType": "paid",
			"price":      "19",
		},
		"file",
		"replacement.csv",
		fileContent,
	)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusInternalServerError, w.Code)
	entries, err := os.ReadDir(filepath.Clean(tempDir))
	require.NoError(t, err)
	require.Len(t, entries, 0)
	require.NoError(t, mock.ExpectationsWereMet())
}
