package agentadmin

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/TimLai666/surtopya-api/internal/platformlog"
	"github.com/google/uuid"
)

const (
	apiKeyPrefix = "saa"
)

var (
	ErrUnauthorized = errors.New("unauthorized agent api key")
	ErrForbidden    = errors.New("forbidden")
	ErrNotFound     = errors.New("not found")
)

var AllPermissions = []string{
	"logs.read",
	"deid.read",
	"deid.write",
	"surveys.read",
	"surveys.write",
	"datasets.read",
	"datasets.write",
	"users.read",
	"users.write",
	"policies.read",
	"policies.write",
	"plans.read",
	"plans.write",
	"system.read",
	"system.write",
	"agents.read",
	"agents.write",
}

type Account struct {
	ID                uuid.UUID  `json:"id"`
	OwnerUserID       uuid.UUID  `json:"owner_user_id"`
	OwnerDisplayName  *string    `json:"owner_display_name,omitempty"`
	OwnerEmail        *string    `json:"owner_email,omitempty"`
	OwnerIsSuperAdmin bool       `json:"owner_is_super_admin"`
	Name              string     `json:"name"`
	Description       *string    `json:"description,omitempty"`
	IsActive          bool       `json:"is_active"`
	CreatedByUserID   uuid.UUID  `json:"created_by_user_id"`
	LastUsedAt        *time.Time `json:"last_used_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
	Permissions       []string   `json:"permissions"`
	KeyPrefix         string     `json:"key_prefix,omitempty"`
}

type AuthenticatedAgent struct {
	Account
	Scopes map[string]struct{}
}

type CreateAccountInput struct {
	OwnerUserID *uuid.UUID
	Name        string
	Description *string
	IsActive    bool
	Permissions []string
}

type UpdateAccountInput struct {
	Name        *string
	Description **string
	IsActive    *bool
	Permissions []string
}

type ListAccountsFilter struct {
	Search      string
	OwnerUserID *uuid.UUID
	Limit       int
	Offset      int
}

type ListLogsFilter struct {
	CorrelationID string
	Module        string
	Action        string
	Status        string
	ActorType     string
	ResourceType  string
	ResourceID    string
	From          *time.Time
	To            *time.Time
	Limit         int
	Cursor        string
}

type EventLogRecord struct {
	ID                  uuid.UUID      `json:"id"`
	CreatedAt           time.Time      `json:"created_at"`
	CorrelationID       uuid.UUID      `json:"correlation_id"`
	EventType           string         `json:"event_type"`
	Module              string         `json:"module"`
	Action              string         `json:"action"`
	Status              string         `json:"status"`
	ClientIP            *string        `json:"client_ip,omitempty"`
	ActorType           string         `json:"actor_type"`
	ActorUserID         *uuid.UUID     `json:"actor_user_id,omitempty"`
	ActorAgentID        *uuid.UUID     `json:"actor_agent_id,omitempty"`
	OwnerUserID         *uuid.UUID     `json:"owner_user_id,omitempty"`
	ResourceType        *string        `json:"resource_type,omitempty"`
	ResourceID          *string        `json:"resource_id,omitempty"`
	ResourceOwnerUserID *uuid.UUID     `json:"resource_owner_user_id,omitempty"`
	RequestSummary      map[string]any `json:"request_summary"`
	ResponseSummary     map[string]any `json:"response_summary"`
	ErrorCode           *string        `json:"error_code,omitempty"`
	ErrorMessage        *string        `json:"error_message,omitempty"`
	Metadata            map[string]any `json:"metadata"`
}

type EventLogPage struct {
	Logs       []EventLogRecord
	Total      int
	NextCursor *string
	HasMore    bool
}

type Service struct {
	db     *sql.DB
	logger *platformlog.Logger
}

func NewService(db *sql.DB) *Service {
	return &Service{
		db:     db,
		logger: platformlog.NewLogger(db),
	}
}

func (s *Service) Authenticate(ctx context.Context, apiKey string) (*AuthenticatedAgent, error) {
	if s.db == nil {
		return nil, ErrUnauthorized
	}
	prefix, err := parseKeyPrefix(apiKey)
	if err != nil {
		return nil, ErrUnauthorized
	}

	var (
		accountID         uuid.UUID
		ownerUserID       uuid.UUID
		ownerDisplayName  sql.NullString
		ownerEmail        sql.NullString
		ownerIsSuperAdmin bool
		name              string
		description       sql.NullString
		isActive          bool
		createdByUserID   uuid.UUID
		lastUsedAt        sql.NullTime
		createdAt         time.Time
		updatedAt         time.Time
		encryptedSecret   string
	)

	err = s.db.QueryRowContext(ctx, `
		SELECT
			a.id, a.owner_user_id, u.display_name, u.email, COALESCE(u.is_super_admin, FALSE), a.name, a.description, a.is_active, a.created_by_user_id,
			a.last_used_at, a.created_at, a.updated_at, k.encrypted_secret
		FROM agent_admin_accounts a
		JOIN users u ON u.id = a.owner_user_id
		JOIN agent_admin_api_keys k ON k.account_id = a.id
		WHERE k.key_prefix = $1
		  AND k.is_active = TRUE
		  AND a.is_active = TRUE
		LIMIT 1
	`, prefix).Scan(
		&accountID,
		&ownerUserID,
		&ownerDisplayName,
		&ownerEmail,
		&ownerIsSuperAdmin,
		&name,
		&description,
		&isActive,
		&createdByUserID,
		&lastUsedAt,
		&createdAt,
		&updatedAt,
		&encryptedSecret,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrUnauthorized
		}
		return nil, err
	}

	plain, err := decryptSecret(encryptedSecret)
	if err != nil {
		return nil, ErrUnauthorized
	}
	if !hmac.Equal([]byte(plain), []byte(apiKey)) {
		return nil, ErrUnauthorized
	}

	permissions, err := s.getPermissions(ctx, accountID)
	if err != nil {
		return nil, err
	}
	scopes := make(map[string]struct{}, len(permissions))
	for _, permission := range permissions {
		scopes[permission] = struct{}{}
	}

	now := time.Now().UTC()
	_, _ = s.db.ExecContext(ctx, "UPDATE agent_admin_accounts SET last_used_at = $2 WHERE id = $1", accountID, now)

	account := Account{
		ID:                accountID,
		OwnerUserID:       ownerUserID,
		OwnerDisplayName:  nullableString(ownerDisplayName),
		OwnerEmail:        nullableString(ownerEmail),
		OwnerIsSuperAdmin: ownerIsSuperAdmin,
		Name:              name,
		Description:       nullableString(description),
		IsActive:          isActive,
		CreatedByUserID:   createdByUserID,
		LastUsedAt:        nullableTime(lastUsedAt),
		CreatedAt:         createdAt,
		UpdatedAt:         updatedAt,
		Permissions:       permissions,
		KeyPrefix:         prefix,
	}
	return &AuthenticatedAgent{
		Account: account,
		Scopes:  scopes,
	}, nil
}

func (s *Service) HasPermission(agent *AuthenticatedAgent, permission string) bool {
	if agent == nil {
		return false
	}
	_, ok := agent.Scopes[permission]
	return ok
}

func (s *Service) ScopeList(agent *AuthenticatedAgent) []string {
	if agent == nil {
		return []string{}
	}
	return append([]string(nil), agent.Permissions...)
}

func (s *Service) ListAccountsForAdmin(ctx context.Context, actorUserID uuid.UUID, actorIsSuperAdmin bool, filter ListAccountsFilter) ([]Account, error) {
	if s.db == nil {
		return []Account{}, nil
	}
	if filter.Limit <= 0 || filter.Limit > 100 {
		filter.Limit = 20
	}
	if filter.Offset < 0 {
		filter.Offset = 0
	}

	query := `
		SELECT
			a.id, a.owner_user_id, u.display_name, u.email, COALESCE(u.is_super_admin, FALSE), a.name, a.description, a.is_active, a.created_by_user_id,
			a.last_used_at, a.created_at, a.updated_at
		FROM agent_admin_accounts a
		JOIN users u ON u.id = a.owner_user_id
		WHERE 1=1
	`
	args := []any{}
	index := 0

	if !actorIsSuperAdmin {
		index++
		query += fmt.Sprintf(" AND a.owner_user_id = $%d", index)
		args = append(args, actorUserID)
	} else if filter.OwnerUserID != nil {
		index++
		query += fmt.Sprintf(" AND a.owner_user_id = $%d", index)
		args = append(args, *filter.OwnerUserID)
	}

	if search := strings.TrimSpace(filter.Search); search != "" {
		index++
		query += fmt.Sprintf(" AND (a.name ILIKE $%d OR COALESCE(a.description, '') ILIKE $%d)", index, index)
		args = append(args, "%"+search+"%")
	}

	index++
	query += fmt.Sprintf(" ORDER BY a.created_at DESC LIMIT $%d", index)
	args = append(args, filter.Limit)
	index++
	query += fmt.Sprintf(" OFFSET $%d", index)
	args = append(args, filter.Offset)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	accounts := []Account{}
	for rows.Next() {
		var (
			account          Account
			ownerDisplayName sql.NullString
			ownerEmail       sql.NullString
			description      sql.NullString
			lastUsedAt       sql.NullTime
		)
		if err := rows.Scan(
			&account.ID,
			&account.OwnerUserID,
			&ownerDisplayName,
			&ownerEmail,
			&account.OwnerIsSuperAdmin,
			&account.Name,
			&description,
			&account.IsActive,
			&account.CreatedByUserID,
			&lastUsedAt,
			&account.CreatedAt,
			&account.UpdatedAt,
		); err != nil {
			return nil, err
		}
		account.OwnerDisplayName = nullableString(ownerDisplayName)
		account.OwnerEmail = nullableString(ownerEmail)
		account.Description = nullableString(description)
		account.LastUsedAt = nullableTime(lastUsedAt)
		account.Permissions, err = s.getPermissions(ctx, account.ID)
		if err != nil {
			return nil, err
		}
		account.KeyPrefix, _ = s.getActiveKeyPrefix(ctx, account.ID)
		accounts = append(accounts, account)
	}
	return accounts, rows.Err()
}

func (s *Service) CreateAccountForAdmin(ctx context.Context, actorUserID uuid.UUID, actorIsSuperAdmin bool, input CreateAccountInput) (Account, string, error) {
	if s.db == nil {
		return Account{}, "", errors.New("database unavailable")
	}
	ownerUserID := actorUserID
	if input.OwnerUserID != nil {
		if !actorIsSuperAdmin && *input.OwnerUserID != actorUserID {
			return Account{}, "", ErrForbidden
		}
		ownerUserID = *input.OwnerUserID
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Account{}, "", err
	}
	defer tx.Rollback()

	account := Account{
		ID:              uuid.New(),
		OwnerUserID:     ownerUserID,
		Name:            strings.TrimSpace(input.Name),
		Description:     input.Description,
		IsActive:        input.IsActive,
		CreatedByUserID: actorUserID,
		CreatedAt:       time.Now().UTC(),
		UpdatedAt:       time.Now().UTC(),
		Permissions:     normalizePermissions(input.Permissions),
	}
	if account.Name == "" {
		return Account{}, "", errors.New("name is required")
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO agent_admin_accounts (
			id, owner_user_id, name, description, is_active, created_by_user_id
		) VALUES ($1, $2, $3, $4, $5, $6)
	`, account.ID, account.OwnerUserID, account.Name, account.Description, account.IsActive, account.CreatedByUserID)
	if err != nil {
		return Account{}, "", err
	}

	if err := s.replacePermissionsTx(ctx, tx, account.ID, account.Permissions); err != nil {
		return Account{}, "", err
	}

	key, prefix, encrypted, err := generateAndEncryptKey()
	if err != nil {
		return Account{}, "", err
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO agent_admin_api_keys (
			id, account_id, key_prefix, encrypted_secret, is_active
		) VALUES ($1, $2, $3, $4, TRUE)
	`, uuid.New(), account.ID, prefix, encrypted)
	if err != nil {
		return Account{}, "", err
	}

	if err := tx.Commit(); err != nil {
		return Account{}, "", err
	}

	account.KeyPrefix = prefix
	refreshedAccount, err := s.GetAccountForAdmin(ctx, actorUserID, actorIsSuperAdmin, account.ID)
	if err == nil {
		account = refreshedAccount
		account.KeyPrefix = prefix
	}
	_ = s.logger.Log(ctx, platformlog.EventInput{
		EventType:    "domain",
		Module:       "agent_admin",
		Action:       "create_account",
		Status:       "success",
		ActorType:    platformlog.ActorTypeAdminUser,
		ActorUserID:  &actorUserID,
		OwnerUserID:  &ownerUserID,
		ResourceType: "agent_admin_account",
		ResourceID:   account.ID.String(),
		Metadata: map[string]any{
			"permissions": account.Permissions,
			"key_prefix":  prefix,
		},
	})

	return account, key, nil
}

func (s *Service) GetAccountForAdmin(ctx context.Context, actorUserID uuid.UUID, actorIsSuperAdmin bool, accountID uuid.UUID) (Account, error) {
	accounts, err := s.ListAccountsForAdmin(ctx, actorUserID, actorIsSuperAdmin, ListAccountsFilter{
		Limit:  100,
		Offset: 0,
	})
	if err != nil {
		return Account{}, err
	}
	for _, account := range accounts {
		if account.ID == accountID {
			return account, nil
		}
	}
	return Account{}, ErrNotFound
}

func (s *Service) UpdateAccountForAdmin(ctx context.Context, actorUserID uuid.UUID, actorIsSuperAdmin bool, accountID uuid.UUID, input UpdateAccountInput) (Account, error) {
	account, err := s.GetAccountForAdmin(ctx, actorUserID, actorIsSuperAdmin, accountID)
	if err != nil {
		return Account{}, err
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return Account{}, err
	}
	defer tx.Rollback()

	if input.Name != nil {
		account.Name = strings.TrimSpace(*input.Name)
	}
	if input.Description != nil {
		account.Description = *input.Description
	}
	if input.IsActive != nil {
		account.IsActive = *input.IsActive
	}
	if input.Permissions != nil {
		account.Permissions = normalizePermissions(input.Permissions)
		if err := s.replacePermissionsTx(ctx, tx, account.ID, account.Permissions); err != nil {
			return Account{}, err
		}
	}

	_, err = tx.ExecContext(ctx, `
		UPDATE agent_admin_accounts
		SET name = $2, description = $3, is_active = $4, updated_at = NOW()
		WHERE id = $1
	`, account.ID, account.Name, account.Description, account.IsActive)
	if err != nil {
		return Account{}, err
	}
	if err := tx.Commit(); err != nil {
		return Account{}, err
	}

	account.UpdatedAt = time.Now().UTC()
	account.KeyPrefix, _ = s.getActiveKeyPrefix(ctx, account.ID)
	return account, nil
}

func (s *Service) RevealKeyForAdmin(ctx context.Context, actorUserID uuid.UUID, actorIsSuperAdmin bool, accountID uuid.UUID) (string, error) {
	account, err := s.GetAccountForAdmin(ctx, actorUserID, actorIsSuperAdmin, accountID)
	if err != nil {
		return "", err
	}
	var keyID uuid.UUID
	var encryptedSecret string
	err = s.db.QueryRowContext(ctx, `
		SELECT id, encrypted_secret
		FROM agent_admin_api_keys
		WHERE account_id = $1 AND is_active = TRUE
		LIMIT 1
	`, account.ID).Scan(&keyID, &encryptedSecret)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", ErrNotFound
		}
		return "", err
	}

	plain, err := decryptSecret(encryptedSecret)
	if err != nil {
		return "", err
	}
	_, _ = s.db.ExecContext(ctx, "UPDATE agent_admin_api_keys SET revealed_at = $2 WHERE id = $1", keyID, time.Now().UTC())
	return plain, nil
}

func (s *Service) RotateKeyForAdmin(ctx context.Context, actorUserID uuid.UUID, actorIsSuperAdmin bool, accountID uuid.UUID) (string, string, error) {
	account, err := s.GetAccountForAdmin(ctx, actorUserID, actorIsSuperAdmin, accountID)
	if err != nil {
		return "", "", err
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return "", "", err
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx, `
		UPDATE agent_admin_api_keys
		SET is_active = FALSE, updated_at = NOW()
		WHERE account_id = $1 AND is_active = TRUE
	`, account.ID)
	if err != nil {
		return "", "", err
	}

	key, prefix, encrypted, err := generateAndEncryptKey()
	if err != nil {
		return "", "", err
	}
	_, err = tx.ExecContext(ctx, `
		INSERT INTO agent_admin_api_keys (
			id, account_id, key_prefix, encrypted_secret, is_active
		) VALUES ($1, $2, $3, $4, TRUE)
	`, uuid.New(), account.ID, prefix, encrypted)
	if err != nil {
		return "", "", err
	}
	if err := tx.Commit(); err != nil {
		return "", "", err
	}
	return key, prefix, nil
}

type eventLogCursor struct {
	CreatedAt time.Time `json:"created_at"`
	ID        uuid.UUID `json:"id"`
}

func (s *Service) ListLogs(ctx context.Context, actor *AuthenticatedAgent, filter ListLogsFilter) (EventLogPage, error) {
	if s.db == nil {
		return EventLogPage{Logs: []EventLogRecord{}}, nil
	}
	if filter.Limit <= 0 || filter.Limit > 100 {
		filter.Limit = 20
	}

	baseWhere, baseArgs := buildListLogsWhere(actor, filter)

	var total int
	countQuery := "SELECT COUNT(*) FROM platform_event_logs WHERE 1=1" + baseWhere
	if err := s.db.QueryRowContext(ctx, countQuery, baseArgs...).Scan(&total); err != nil {
		return EventLogPage{}, err
	}

	cursorWhere := ""
	args := append([]any{}, baseArgs...)
	if strings.TrimSpace(filter.Cursor) != "" {
		cursor, err := decodeEventLogCursor(filter.Cursor)
		if err != nil {
			return EventLogPage{}, err
		}
		args = append(args, cursor.CreatedAt, cursor.ID)
		createdAtIndex := len(args) - 1
		idIndex := len(args)
		cursorWhere = fmt.Sprintf(" AND (created_at < $%d OR (created_at = $%d AND id < $%d))", createdAtIndex, createdAtIndex, idIndex)
	}

	query := `
		SELECT
			id, created_at, correlation_id, event_type, module, action, status,
			client_ip, actor_type, actor_user_id, actor_agent_id, owner_user_id,
			resource_type, resource_id, resource_owner_user_id,
			request_summary, response_summary, error_code, error_message, metadata
		FROM platform_event_logs
		WHERE 1=1
	`
	query += baseWhere + cursorWhere
	args = append(args, filter.Limit+1)
	query += fmt.Sprintf(" ORDER BY created_at DESC, id DESC LIMIT $%d", len(args))

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return EventLogPage{}, err
	}
	defer rows.Close()

	logs := []EventLogRecord{}
	for rows.Next() {
		var (
			record          EventLogRecord
			clientIP        sql.NullString
			resourceType    sql.NullString
			resourceID      sql.NullString
			errorCode       sql.NullString
			errorMessage    sql.NullString
			requestSummary  []byte
			responseSummary []byte
			metadata        []byte
		)
		if err := rows.Scan(
			&record.ID,
			&record.CreatedAt,
			&record.CorrelationID,
			&record.EventType,
			&record.Module,
			&record.Action,
			&record.Status,
			&clientIP,
			&record.ActorType,
			&record.ActorUserID,
			&record.ActorAgentID,
			&record.OwnerUserID,
			&resourceType,
			&resourceID,
			&record.ResourceOwnerUserID,
			&requestSummary,
			&responseSummary,
			&errorCode,
			&errorMessage,
			&metadata,
		); err != nil {
			return EventLogPage{}, err
		}
		record.ClientIP = nullableString(clientIP)
		record.ResourceType = nullableString(resourceType)
		record.ResourceID = nullableString(resourceID)
		record.ErrorCode = nullableString(errorCode)
		record.ErrorMessage = nullableString(errorMessage)
		record.RequestSummary = decodeJSONMap(requestSummary)
		record.ResponseSummary = decodeJSONMap(responseSummary)
		record.Metadata = decodeJSONMap(metadata)
		logs = append(logs, record)
	}
	if err := rows.Err(); err != nil {
		return EventLogPage{}, err
	}

	page := EventLogPage{
		Logs:  logs,
		Total: total,
	}
	if len(logs) > filter.Limit {
		page.HasMore = true
		logs = logs[:filter.Limit]
		page.Logs = logs
		cursor, err := encodeEventLogCursor(logs[len(logs)-1])
		if err != nil {
			return EventLogPage{}, err
		}
		page.NextCursor = &cursor
	}
	return page, nil
}

func (s *Service) GetLogByID(ctx context.Context, actor *AuthenticatedAgent, logID uuid.UUID) (*EventLogRecord, error) {
	query := `
		SELECT
			id, created_at, correlation_id, event_type, module, action, status,
			client_ip, actor_type, actor_user_id, actor_agent_id, owner_user_id,
			resource_type, resource_id, resource_owner_user_id,
			request_summary, response_summary, error_code, error_message, metadata
		FROM platform_event_logs
		WHERE id = $1
	`
	args := []any{logID}
	if actor != nil && !actor.OwnerIsSuperAdmin {
		query += " AND (owner_user_id = $2 OR resource_owner_user_id = $2)"
		args = append(args, actor.OwnerUserID)
	}

	var (
		record          EventLogRecord
		clientIP        sql.NullString
		resourceType    sql.NullString
		resourceID      sql.NullString
		errorCode       sql.NullString
		errorMessage    sql.NullString
		requestSummary  []byte
		responseSummary []byte
		metadata        []byte
	)
	err := s.db.QueryRowContext(ctx, query, args...).Scan(
		&record.ID,
		&record.CreatedAt,
		&record.CorrelationID,
		&record.EventType,
		&record.Module,
		&record.Action,
		&record.Status,
		&clientIP,
		&record.ActorType,
		&record.ActorUserID,
		&record.ActorAgentID,
		&record.OwnerUserID,
		&resourceType,
		&resourceID,
		&record.ResourceOwnerUserID,
		&requestSummary,
		&responseSummary,
		&errorCode,
		&errorMessage,
		&metadata,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	record.ClientIP = nullableString(clientIP)
	record.ResourceType = nullableString(resourceType)
	record.ResourceID = nullableString(resourceID)
	record.ErrorCode = nullableString(errorCode)
	record.ErrorMessage = nullableString(errorMessage)
	record.RequestSummary = decodeJSONMap(requestSummary)
	record.ResponseSummary = decodeJSONMap(responseSummary)
	record.Metadata = decodeJSONMap(metadata)
	return &record, nil
}

func buildListLogsWhere(actor *AuthenticatedAgent, filter ListLogsFilter) (string, []any) {
	where := ""
	args := []any{}

	appendExact := func(clause string, value string) {
		if strings.TrimSpace(value) == "" {
			return
		}
		args = append(args, strings.TrimSpace(value))
		where += fmt.Sprintf(" AND %s = $%d", clause, len(args))
	}

	if actor != nil && !actor.OwnerIsSuperAdmin {
		args = append(args, actor.OwnerUserID)
		where += fmt.Sprintf(" AND (owner_user_id = $%d OR resource_owner_user_id = $%d)", len(args), len(args))
	}
	if value := strings.TrimSpace(filter.CorrelationID); value != "" {
		args = append(args, value)
		where += fmt.Sprintf(" AND correlation_id::text = $%d", len(args))
	}
	appendExact("module", filter.Module)
	appendExact("action", filter.Action)
	appendExact("status", filter.Status)
	appendExact("actor_type", filter.ActorType)
	appendExact("resource_type", filter.ResourceType)
	appendExact("resource_id", filter.ResourceID)
	if filter.From != nil {
		args = append(args, *filter.From)
		where += fmt.Sprintf(" AND created_at >= $%d", len(args))
	}
	if filter.To != nil {
		args = append(args, *filter.To)
		where += fmt.Sprintf(" AND created_at <= $%d", len(args))
	}
	return where, args
}

func encodeEventLogCursor(record EventLogRecord) (string, error) {
	data, err := json.Marshal(eventLogCursor{
		CreatedAt: record.CreatedAt,
		ID:        record.ID,
	})
	if err != nil {
		return "", fmt.Errorf("failed to encode log cursor: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(data), nil
}

func decodeEventLogCursor(value string) (eventLogCursor, error) {
	decoded, err := base64.RawURLEncoding.DecodeString(strings.TrimSpace(value))
	if err != nil {
		return eventLogCursor{}, fmt.Errorf("invalid log cursor: %w", err)
	}
	var cursor eventLogCursor
	if err := json.Unmarshal(decoded, &cursor); err != nil {
		return eventLogCursor{}, fmt.Errorf("invalid log cursor: %w", err)
	}
	if cursor.ID == uuid.Nil || cursor.CreatedAt.IsZero() {
		return eventLogCursor{}, errors.New("invalid log cursor")
	}
	return cursor, nil
}

func (s *Service) getPermissions(ctx context.Context, accountID uuid.UUID) ([]string, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT permission_key
		FROM agent_admin_permissions
		WHERE account_id = $1
		ORDER BY permission_key
	`, accountID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	permissions := []string{}
	for rows.Next() {
		var permission string
		if err := rows.Scan(&permission); err != nil {
			return nil, err
		}
		permissions = append(permissions, permission)
	}
	return permissions, rows.Err()
}

func (s *Service) replacePermissionsTx(ctx context.Context, tx *sql.Tx, accountID uuid.UUID, permissions []string) error {
	if _, err := tx.ExecContext(ctx, "DELETE FROM agent_admin_permissions WHERE account_id = $1", accountID); err != nil {
		return err
	}
	for _, permission := range permissions {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO agent_admin_permissions (account_id, permission_key)
			VALUES ($1, $2)
		`, accountID, permission); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) getActiveKeyPrefix(ctx context.Context, accountID uuid.UUID) (string, error) {
	var prefix string
	err := s.db.QueryRowContext(ctx, `
		SELECT key_prefix
		FROM agent_admin_api_keys
		WHERE account_id = $1 AND is_active = TRUE
		LIMIT 1
	`, accountID).Scan(&prefix)
	return prefix, err
}

func normalizePermissions(input []string) []string {
	allowed := make(map[string]struct{}, len(AllPermissions))
	for _, item := range AllPermissions {
		allowed[item] = struct{}{}
	}
	seen := map[string]struct{}{}
	result := make([]string, 0, len(input))
	for _, permission := range input {
		permission = strings.TrimSpace(permission)
		if permission == "" {
			continue
		}
		if _, ok := allowed[permission]; !ok {
			continue
		}
		if _, exists := seen[permission]; exists {
			continue
		}
		seen[permission] = struct{}{}
		result = append(result, permission)
	}
	return result
}

func generateAndEncryptKey() (string, string, string, error) {
	secret := make([]byte, 24)
	if _, err := io.ReadFull(rand.Reader, secret); err != nil {
		return "", "", "", err
	}
	prefixBytes := make([]byte, 4)
	if _, err := io.ReadFull(rand.Reader, prefixBytes); err != nil {
		return "", "", "", err
	}
	prefix := base64.RawURLEncoding.EncodeToString(prefixBytes)
	key := fmt.Sprintf("%s_%s_%s", apiKeyPrefix, prefix, base64.RawURLEncoding.EncodeToString(secret))
	encrypted, err := encryptSecret(key)
	if err != nil {
		return "", "", "", err
	}
	return key, prefix, encrypted, nil
}

func parseKeyPrefix(apiKey string) (string, error) {
	parts := strings.SplitN(apiKey, "_", 3)
	if len(parts) != 3 || parts[0] != apiKeyPrefix || parts[1] == "" || parts[2] == "" {
		return "", errors.New("invalid api key format")
	}
	return parts[1], nil
}

func secretCipherKey() []byte {
	raw := strings.TrimSpace(os.Getenv("AGENT_ADMIN_SECRET_KEY"))
	if raw == "" {
		raw = strings.TrimSpace(os.Getenv("JWT_SECRET"))
	}
	if raw == "" {
		raw = "development-agent-admin-secret"
	}
	digest := sha256.Sum256([]byte(raw))
	return digest[:]
}

func encryptSecret(plain string) (string, error) {
	block, err := aes.NewCipher(secretCipherKey())
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	sealed := gcm.Seal(nonce, nonce, []byte(plain), nil)
	return base64.RawURLEncoding.EncodeToString(sealed), nil
}

func decryptSecret(encoded string) (string, error) {
	block, err := aes.NewCipher(secretCipherKey())
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	payload, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return "", err
	}
	if len(payload) < gcm.NonceSize() {
		return "", errors.New("ciphertext too short")
	}
	nonce := payload[:gcm.NonceSize()]
	ciphertext := payload[gcm.NonceSize():]
	plain, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

func decodeJSONMap(raw []byte) map[string]any {
	if len(raw) == 0 {
		return map[string]any{}
	}
	payload := map[string]any{}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return map[string]any{}
	}
	return payload
}

func nullableString(value sql.NullString) *string {
	if !value.Valid {
		return nil
	}
	text := value.String
	return &text
}

func nullableTime(value sql.NullTime) *time.Time {
	if !value.Valid {
		return nil
	}
	timestamp := value.Time
	return &timestamp
}
