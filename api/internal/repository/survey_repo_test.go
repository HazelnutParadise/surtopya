package repository

import (
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func newSurveyRepoForTest(t *testing.T) (*SurveyRepository, sqlmock.Sqlmock, func()) {
	t.Helper()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)

	repo := NewSurveyRepository(db)
	cleanup := func() { _ = db.Close() }
	return repo, mock, cleanup
}

func TestSurveyRepository_SoftDelete(t *testing.T) {
	repo, mock, cleanup := newSurveyRepoForTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	mock.ExpectExec(`UPDATE surveys SET deleted_at = NOW\(\), is_response_open = FALSE WHERE id = \$1 AND deleted_at IS NULL`).
		WithArgs(surveyID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.SoftDelete(surveyID)
	require.NoError(t, err)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyRepository_GetByUserID_FiltersDeletedSurveys(t *testing.T) {
	repo, mock, cleanup := newSurveyRepoForTest(t)
	t.Cleanup(cleanup)

	userID := uuid.New()
	queryPattern := "WHERE s.user_id = \\$1\\s+AND s.deleted_at IS NULL"
	mock.ExpectQuery(queryPattern).
		WithArgs(userID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "user_id", "title", "description", "visibility", "require_login_to_respond", "is_response_open_effective",
			"include_in_datasets", "ever_public", "published_count", "theme", "points_reward",
			"expires_at", "response_count", "created_at", "updated_at", "published_at",
			"current_published_version_id", "current_published_version_number", "has_unpublished_changes", "deleted_at",
		}))

	surveys, err := repo.GetByUserID(userID)
	require.NoError(t, err)
	require.Len(t, surveys, 0)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyRepository_GetPublicSurveys_FiltersDeletedSurveys(t *testing.T) {
	repo, mock, cleanup := newSurveyRepoForTest(t)
	t.Cleanup(cleanup)

	queryPattern := "WHERE s.visibility = 'public'\\s+AND s.deleted_at IS NULL"
	mock.ExpectQuery(queryPattern).
		WithArgs(20, 0, nil, nil).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "user_id", "title", "description", "visibility", "require_login_to_respond", "is_response_open_effective",
			"include_in_datasets", "ever_public", "published_count", "theme", "points_reward",
			"expires_at", "response_count", "created_at", "updated_at", "published_at",
			"current_published_version_id", "current_published_version_number", "has_unpublished_changes", "deleted_at", "has_responded",
		}))

	surveys, err := repo.GetPublicSurveys(20, 0, nil, nil)
	require.NoError(t, err)
	require.Len(t, surveys, 0)
	require.NoError(t, mock.ExpectationsWereMet())
}
