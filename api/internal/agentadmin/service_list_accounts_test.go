package agentadmin

import (
	"context"
	"regexp"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestListAccountsForAdmin_AllowsNullOwnerEmail(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	service := NewService(db)
	actorUserID := uuid.New()
	accountID := uuid.New()
	ownerUserID := uuid.New()
	createdAt := time.Date(2026, time.March, 11, 0, 0, 0, 0, time.UTC)

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT
			a.id, a.owner_user_id, u.display_name, u.email, COALESCE(u.is_super_admin, FALSE), a.name, a.description, a.is_active, a.created_by_user_id,
			a.last_used_at, a.created_at, a.updated_at
		FROM agent_admin_accounts a
		JOIN users u ON u.id = a.owner_user_id
		WHERE 1=1
	`)).
		WithArgs(actorUserID, 20, 0).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "owner_user_id", "display_name", "email", "owner_is_super_admin", "name", "description", "is_active", "created_by_user_id", "last_used_at", "created_at", "updated_at",
		}).AddRow(accountID, ownerUserID, "Owner Name", nil, false, "ops-agent", "desc", true, actorUserID, nil, createdAt, createdAt))

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT permission_key
		FROM agent_admin_permissions
		WHERE account_id = $1
		ORDER BY permission_key
	`)).
		WithArgs(accountID).
		WillReturnRows(sqlmock.NewRows([]string{"permission_key"}).AddRow("logs.read"))

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT key_prefix
		FROM agent_admin_api_keys
		WHERE account_id = $1 AND is_active = TRUE
		LIMIT 1
	`)).
		WithArgs(accountID).
		WillReturnRows(sqlmock.NewRows([]string{"key_prefix"}).AddRow("prefix01"))

	accounts, err := service.ListAccountsForAdmin(context.Background(), actorUserID, false, ListAccountsFilter{
		Limit:  20,
		Offset: 0,
	})
	require.NoError(t, err)
	require.Len(t, accounts, 1)
	require.NotNil(t, accounts[0].OwnerDisplayName)
	require.Equal(t, "Owner Name", *accounts[0].OwnerDisplayName)
	require.Nil(t, accounts[0].OwnerEmail)
	require.Equal(t, "prefix01", accounts[0].KeyPrefix)
	require.NoError(t, mock.ExpectationsWereMet())
}
