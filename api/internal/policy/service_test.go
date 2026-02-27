package policy

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestService_ResolveCapabilities_FallbackIncludesKnownKey(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	svc := NewService(db)
	userID := uuid.New()

	mock.ExpectQuery("FROM capabilities c").
		WithArgs(userID).
		WillReturnRows(sqlmock.NewRows([]string{"key", "is_allowed"}))

	capabilities, err := svc.ResolveCapabilities(context.Background(), userID)
	require.NoError(t, err)
	require.Contains(t, capabilities, CapabilitySurveyPublicDatasetOptOut)
	require.False(t, capabilities[CapabilitySurveyPublicDatasetOptOut])
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestService_IsPolicyWriter_DelegatedAdmin(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	svc := NewService(db)
	userID := uuid.New()

	mock.ExpectQuery("SELECT is_super_admin FROM users WHERE id = \\$1").
		WithArgs(userID).
		WillReturnRows(sqlmock.NewRows([]string{"is_super_admin"}).AddRow(false))

	mock.ExpectQuery("SELECT EXISTS").
		WithArgs(userID, PermissionPolicyWrite).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

	canWrite, err := svc.IsPolicyWriter(context.Background(), userID)
	require.NoError(t, err)
	require.True(t, canWrite)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestService_SetUserTier_UpsertMembership(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	svc := NewService(db)
	userID := uuid.New()
	tierID := uuid.New()

	mock.ExpectQuery("SELECT id\\s+FROM membership_tiers").
		WithArgs("pro").
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(tierID))

	mock.ExpectExec("INSERT INTO user_memberships").
		WithArgs(userID, tierID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err = svc.SetUserTier(context.Background(), userID, "pro")
	require.NoError(t, err)
	require.NoError(t, mock.ExpectationsWereMet())
}
