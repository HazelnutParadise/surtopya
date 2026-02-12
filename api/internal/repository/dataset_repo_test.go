package repository

import (
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/require"
)

func TestDatasetRepository_GetAllSorted_OrderByDownloads(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := NewDatasetRepository(db)

	cols := []string{
		"id", "survey_id", "title", "description", "category", "access_type", "price",
		"download_count", "sample_size", "is_active", "file_path", "file_name", "file_size", "mime_type",
		"created_at", "updated_at",
	}

	mock.ExpectQuery("ORDER BY download_count DESC, created_at DESC").
		WillReturnRows(sqlmock.NewRows(cols))

	_, err = repo.GetAllSorted("", "", "downloads", 10, 0)
	require.NoError(t, err)
	require.NoError(t, mock.ExpectationsWereMet())
}

