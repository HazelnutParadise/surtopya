package repository

import (
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestPointsRepository_DeductForDatasetTx_Insufficient(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := NewPointsRepository(db)

	mock.ExpectBegin()
	tx, err := db.Begin()
	require.NoError(t, err)

	userID := uuid.New()
	datasetID := uuid.New()

	mock.ExpectQuery("SELECT points_balance FROM users WHERE id = \\$1 FOR UPDATE").
		WithArgs(userID).
		WillReturnRows(sqlmock.NewRows([]string{"points_balance"}).AddRow(3))

	err = repo.DeductForDatasetTx(tx, userID, datasetID, 10, "")
	require.ErrorIs(t, err, ErrInsufficientPoints)

	mock.ExpectRollback()
	require.NoError(t, tx.Rollback())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestPointsRepository_AwardSurveyPointsTx_InsertsTransaction(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := NewPointsRepository(db)

	mock.ExpectBegin()
	tx, err := db.Begin()
	require.NoError(t, err)

	userID := uuid.New()
	surveyID := uuid.New()

	mock.ExpectExec("UPDATE users SET points_balance = points_balance \\+ \\$2 WHERE id = \\$1").
		WithArgs(userID, 5).
		WillReturnResult(sqlmock.NewResult(0, 1))

	mock.ExpectExec("INSERT INTO points_transactions").
		WithArgs(sqlmock.AnyArg(), userID, 5, sqlmock.AnyArg(), surveyID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	require.NoError(t, repo.AwardSurveyPointsTx(tx, userID, surveyID, 5, ""))

	mock.ExpectCommit()
	require.NoError(t, tx.Commit())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestPointsRepository_GrantMonthlyPointsIfEligibleTx_GrantsAndInsertsTransaction(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := NewPointsRepository(db)

	mock.ExpectBegin()
	tx, err := db.Begin()
	require.NoError(t, err)

	userID := uuid.New()
	now := time.Date(2026, 2, 12, 10, 0, 0, 0, time.UTC)

	mock.ExpectQuery("SELECT u.timezone, u.pro_points_next_grant_at, mt.monthly_points_grant").
		WithArgs(userID).
		WillReturnRows(sqlmock.NewRows([]string{"timezone", "pro_points_next_grant_at", "monthly_points_grant"}).AddRow("Asia/Taipei", nil, 100))

	mock.ExpectExec("UPDATE users SET points_balance = points_balance \\+ \\$2, pro_points_last_granted_at = \\$3, pro_points_next_grant_at = \\$4 WHERE id = \\$1").
		WithArgs(userID, 100, now, time.Date(2026, 2, 28, 16, 0, 0, 0, time.UTC)).
		WillReturnResult(sqlmock.NewResult(0, 1))

	mock.ExpectExec("INSERT INTO points_transactions").
		WithArgs(sqlmock.AnyArg(), userID, 100, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	granted, err := repo.GrantMonthlyPointsIfEligibleTx(tx, userID, now, "")
	require.NoError(t, err)
	require.True(t, granted)

	mock.ExpectCommit()
	require.NoError(t, tx.Commit())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestPointsRepository_GrantMonthlyPointsIfEligibleTx_NoOpWhenNotEligible(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := NewPointsRepository(db)

	mock.ExpectBegin()
	tx, err := db.Begin()
	require.NoError(t, err)

	userID := uuid.New()
	now := time.Date(2026, 2, 12, 10, 0, 0, 0, time.UTC)

	mock.ExpectQuery("SELECT u.timezone, u.pro_points_next_grant_at, mt.monthly_points_grant").
		WithArgs(userID).
		WillReturnRows(sqlmock.NewRows([]string{"timezone", "pro_points_next_grant_at", "monthly_points_grant"}).AddRow("Asia/Taipei", time.Date(2026, 2, 28, 16, 0, 0, 0, time.UTC), 100))

	granted, err := repo.GrantMonthlyPointsIfEligibleTx(tx, userID, now, "")
	require.NoError(t, err)
	require.False(t, granted)

	mock.ExpectCommit()
	require.NoError(t, tx.Commit())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestPointsRepository_GrantMonthlyPointsIfEligibleTx_UsesUserTimeZoneBoundary(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := NewPointsRepository(db)

	mock.ExpectBegin()
	tx, err := db.Begin()
	require.NoError(t, err)

	userID := uuid.New()
	now := time.Date(2026, 3, 31, 23, 30, 0, 0, time.UTC)

	mock.ExpectQuery("SELECT u.timezone, u.pro_points_next_grant_at, mt.monthly_points_grant").
		WithArgs(userID).
		WillReturnRows(sqlmock.NewRows([]string{"timezone", "pro_points_next_grant_at", "monthly_points_grant"}).AddRow("America/Los_Angeles", nil, 50))

	mock.ExpectExec("UPDATE users SET points_balance = points_balance \\+ \\$2, pro_points_last_granted_at = \\$3, pro_points_next_grant_at = \\$4 WHERE id = \\$1").
		WithArgs(userID, 50, now, time.Date(2026, 4, 1, 7, 0, 0, 0, time.UTC)).
		WillReturnResult(sqlmock.NewResult(0, 1))

	mock.ExpectExec("INSERT INTO points_transactions").
		WithArgs(sqlmock.AnyArg(), userID, 50, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	granted, err := repo.GrantMonthlyPointsIfEligibleTx(tx, userID, now, "")
	require.NoError(t, err)
	require.True(t, granted)

	mock.ExpectCommit()
	require.NoError(t, tx.Commit())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestPointsRepository_DeductForSurveyBoostTx_Insufficient(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := NewPointsRepository(db)

	mock.ExpectBegin()
	tx, err := db.Begin()
	require.NoError(t, err)

	publisherID := uuid.New()
	surveyID := uuid.New()

	mock.ExpectQuery("SELECT points_balance FROM users WHERE id = \\$1 FOR UPDATE").
		WithArgs(publisherID).
		WillReturnRows(sqlmock.NewRows([]string{"points_balance"}).AddRow(2))

	err = repo.DeductForSurveyBoostTx(tx, publisherID, surveyID, 9, "")
	require.ErrorIs(t, err, ErrInsufficientPoints)

	mock.ExpectRollback()
	require.NoError(t, tx.Rollback())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestPointsRepository_DeductForSurveyBoostTx_DeductsAndInsertsTransaction(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	repo := NewPointsRepository(db)

	mock.ExpectBegin()
	tx, err := db.Begin()
	require.NoError(t, err)

	publisherID := uuid.New()
	surveyID := uuid.New()

	mock.ExpectQuery("SELECT points_balance FROM users WHERE id = \\$1 FOR UPDATE").
		WithArgs(publisherID).
		WillReturnRows(sqlmock.NewRows([]string{"points_balance"}).AddRow(99))

	mock.ExpectExec("UPDATE users SET points_balance = points_balance - \\$2 WHERE id = \\$1").
		WithArgs(publisherID, 9).
		WillReturnResult(sqlmock.NewResult(0, 1))

	mock.ExpectExec("INSERT INTO points_transactions").
		WithArgs(sqlmock.AnyArg(), publisherID, -9, sqlmock.AnyArg(), surveyID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	require.NoError(t, repo.DeductForSurveyBoostTx(tx, publisherID, surveyID, 9, ""))

	mock.ExpectCommit()
	require.NoError(t, tx.Commit())
	require.NoError(t, mock.ExpectationsWereMet())
}
