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

func TestListLogs_ReturnsCursorPaginationAndTotals(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	service := NewService(db)
	ownerUserID := uuid.New()
	logID1 := uuid.New()
	logID2 := uuid.New()
	correlationID := uuid.New()
	now := time.Date(2026, time.April, 3, 12, 0, 0, 0, time.UTC)
	from := now.Add(-time.Hour)
	to := now.Add(time.Hour)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT COUNT(*) FROM platform_event_logs WHERE 1=1 AND (owner_user_id = $1 OR resource_owner_user_id = $1) AND module = $2 AND status = $3 AND actor_type = $4 AND created_at >= $5 AND created_at <= $6`)).
		WithArgs(ownerUserID, "agent_admin", "error", "agent_admin", from, to).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT
			id, created_at, correlation_id, event_type, module, action, status,
			client_ip, actor_type, actor_user_id, actor_agent_id, owner_user_id,
			resource_type, resource_id, resource_owner_user_id,
			request_summary, response_summary, error_code, error_message, metadata
		FROM platform_event_logs
		WHERE 1=1
	`)).
		WithArgs(ownerUserID, "agent_admin", "error", "agent_admin", from, to, 2).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "created_at", "correlation_id", "event_type", "module", "action", "status",
			"client_ip", "actor_type", "actor_user_id", "actor_agent_id", "owner_user_id",
			"resource_type", "resource_id", "resource_owner_user_id",
			"request_summary", "response_summary", "error_code", "error_message", "metadata",
		}).
			AddRow(logID1, now, correlationID, "request", "agent_admin", "get.logs", "error", "203.0.113.10", "agent_admin", nil, nil, ownerUserID, "log", "one", ownerUserID, []byte(`{}`), []byte(`{"status_code":500}`), "server_error", "boom", []byte(`{}`)).
			AddRow(logID2, now.Add(-time.Minute), correlationID, "request", "agent_admin", "get.logs", "error", "203.0.113.11", "agent_admin", nil, nil, ownerUserID, "log", "two", ownerUserID, []byte(`{}`), []byte(`{"status_code":500}`), "server_error", "boom", []byte(`{}`)))

	page, err := service.ListLogs(context.Background(), &AuthenticatedAgent{
		Account: Account{
			OwnerUserID:       ownerUserID,
			OwnerIsSuperAdmin: false,
		},
	}, ListLogsFilter{
		Module:    "agent_admin",
		Status:    "error",
		ActorType: "agent_admin",
		From:      &from,
		To:        &to,
		Limit:     1,
	})
	require.NoError(t, err)
	require.Len(t, page.Logs, 1)
	require.Equal(t, 2, page.Total)
	require.True(t, page.HasMore)
	require.NotNil(t, page.NextCursor)
	require.NotNil(t, page.Logs[0].ClientIP)
	require.Equal(t, "203.0.113.10", *page.Logs[0].ClientIP)
	require.NoError(t, mock.ExpectationsWereMet())
}
