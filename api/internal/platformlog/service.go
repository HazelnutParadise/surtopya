package platformlog

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	HeaderCorrelationID      = "X-Correlation-Id"
	ContextKeyCorrelationID  = "correlationID"
	ContextKeyActorType      = "actorType"
	ContextKeyActorUserID    = "actorUserID"
	ContextKeyActorAgentID   = "actorAgentID"
	ContextKeyOwnerUserID    = "ownerUserID"
	ContextKeyAgentAccountID = "agentAdminAccountID"
	ContextKeyAgentScopes    = "agentAdminScopes"

	ActorTypeAnonymous  = "anonymous"
	ActorTypeUser       = "user"
	ActorTypeAdminUser  = "admin_user"
	ActorTypeAgentAdmin = "agent_admin"
	ActorTypeInternal   = "internal_app"
)

type EventInput struct {
	CorrelationID       uuid.UUID
	EventType           string
	Module              string
	Action              string
	Status              string
	ActorType           string
	ActorUserID         *uuid.UUID
	ActorAgentID        *uuid.UUID
	OwnerUserID         *uuid.UUID
	ResourceType        string
	ResourceID          string
	ResourceOwnerUserID *uuid.UUID
	RequestSummary      map[string]any
	ResponseSummary     map[string]any
	ErrorCode           string
	ErrorMessage        string
	Metadata            map[string]any
}

type Logger struct {
	db *sql.DB
}

func NewLogger(db *sql.DB) *Logger {
	return &Logger{db: db}
}

func (l *Logger) Enabled() bool {
	return l != nil && l.db != nil
}

func (l *Logger) Log(ctx context.Context, input EventInput) error {
	if !l.Enabled() {
		return nil
	}

	correlationID := input.CorrelationID
	if correlationID == uuid.Nil {
		correlationID = CorrelationIDFromContext(ctx)
	}
	if correlationID == uuid.Nil {
		correlationID = uuid.New()
	}

	requestSummary, err := marshalJSONB(input.RequestSummary)
	if err != nil {
		return err
	}
	responseSummary, err := marshalJSONB(input.ResponseSummary)
	if err != nil {
		return err
	}
	metadata, err := marshalJSONB(input.Metadata)
	if err != nil {
		return err
	}

	_, err = l.db.ExecContext(ctx, `
		INSERT INTO platform_event_logs (
			id, correlation_id, event_type, module, action, status,
			actor_type, actor_user_id, actor_agent_id, owner_user_id,
			resource_type, resource_id, resource_owner_user_id,
			request_summary, response_summary, error_code, error_message, metadata
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, $10,
			$11, $12, $13,
			$14::jsonb, $15::jsonb, $16, $17, $18::jsonb
		)
	`,
		uuid.New(),
		correlationID,
		defaultString(input.EventType, "domain"),
		defaultString(input.Module, "unknown"),
		defaultString(input.Action, "unknown"),
		defaultString(input.Status, "success"),
		defaultString(input.ActorType, ActorTypeAnonymous),
		input.ActorUserID,
		input.ActorAgentID,
		input.OwnerUserID,
		nullString(input.ResourceType),
		nullString(input.ResourceID),
		input.ResourceOwnerUserID,
		requestSummary,
		responseSummary,
		nullString(input.ErrorCode),
		nullString(input.ErrorMessage),
		metadata,
	)
	if err != nil {
		return fmt.Errorf("failed to insert platform event log: %w", err)
	}

	return nil
}

func LogFromGin(c *gin.Context, logger *Logger, input EventInput) {
	if logger == nil || !logger.Enabled() {
		return
	}

	if input.CorrelationID == uuid.Nil {
		input.CorrelationID = CorrelationIDFromGin(c)
	}
	if input.ActorType == "" {
		input.ActorType = ActorTypeFromGin(c)
	}
	if input.ActorUserID == nil {
		input.ActorUserID = ActorUserIDFromGin(c)
	}
	if input.ActorAgentID == nil {
		input.ActorAgentID = ActorAgentIDFromGin(c)
	}
	if input.OwnerUserID == nil {
		input.OwnerUserID = OwnerUserIDFromGin(c)
	}

	_ = logger.Log(c.Request.Context(), input)
}

func CorrelationIDFromContext(ctx context.Context) uuid.UUID {
	if ctx == nil {
		return uuid.Nil
	}
	value := ctx.Value(ContextKeyCorrelationID)
	if id, ok := value.(uuid.UUID); ok {
		return id
	}
	if id, ok := value.(string); ok {
		parsed, err := uuid.Parse(id)
		if err == nil {
			return parsed
		}
	}
	return uuid.Nil
}

func CorrelationIDFromGin(c *gin.Context) uuid.UUID {
	if c == nil {
		return uuid.Nil
	}
	if value, exists := c.Get(ContextKeyCorrelationID); exists {
		if id, ok := value.(uuid.UUID); ok {
			return id
		}
		if id, ok := value.(string); ok {
			parsed, err := uuid.Parse(id)
			if err == nil {
				return parsed
			}
		}
	}
	return uuid.Nil
}

func ActorTypeFromGin(c *gin.Context) string {
	if c == nil {
		return ActorTypeAnonymous
	}
	if value, exists := c.Get(ContextKeyActorType); exists {
		if actorType, ok := value.(string); ok && actorType != "" {
			return actorType
		}
	}
	return ActorTypeAnonymous
}

func ActorUserIDFromGin(c *gin.Context) *uuid.UUID {
	return uuidPointerFromGin(c, ContextKeyActorUserID, "userID")
}

func ActorAgentIDFromGin(c *gin.Context) *uuid.UUID {
	return uuidPointerFromGin(c, ContextKeyActorAgentID, ContextKeyAgentAccountID)
}

func OwnerUserIDFromGin(c *gin.Context) *uuid.UUID {
	return uuidPointerFromGin(c, ContextKeyOwnerUserID)
}

func uuidPointerFromGin(c *gin.Context, keys ...string) *uuid.UUID {
	if c == nil {
		return nil
	}
	for _, key := range keys {
		if value, exists := c.Get(key); exists {
			switch typed := value.(type) {
			case uuid.UUID:
				id := typed
				return &id
			case *uuid.UUID:
				return typed
			case string:
				parsed, err := uuid.Parse(typed)
				if err == nil {
					return &parsed
				}
			}
		}
	}
	return nil
}

func SanitizePayload(input any) map[string]any {
	sanitized := sanitizeAny(input)
	if typed, ok := sanitized.(map[string]any); ok {
		return typed
	}
	if sanitized == nil {
		return map[string]any{}
	}
	return map[string]any{
		"value": sanitized,
	}
}

func sanitizeAny(input any) any {
	switch typed := input.(type) {
	case nil:
		return nil
	case map[string]any:
		return sanitizeMap(typed)
	case []any:
		return sanitizeSlice(typed)
	case json.RawMessage:
		return sanitizeJSONBytes(typed)
	case []byte:
		return sanitizeJSONBytes(typed)
	case string:
		if len(typed) > 1000 {
			return typed[:1000] + "..."
		}
		return typed
	case bool:
		return typed
	case float32:
		return typed
	case float64:
		return typed
	case int:
		return typed
	case int8:
		return typed
	case int16:
		return typed
	case int32:
		return typed
	case int64:
		return typed
	case uint:
		return typed
	case uint8:
		return typed
	case uint16:
		return typed
	case uint32:
		return typed
	case uint64:
		return typed
	default:
		data, err := json.Marshal(typed)
		if err != nil {
			return typed
		}
		return sanitizeJSONBytes(data)
	}
}

func sanitizeJSONBytes(data []byte) any {
	if len(data) == 0 {
		return map[string]any{}
	}
	var decoded any
	if err := json.Unmarshal(data, &decoded); err != nil {
		return map[string]any{
			"type":        "binary",
			"size_bytes":  len(data),
			"description": "non-json payload",
		}
	}
	return sanitizeAny(decoded)
}

func sanitizeMap(input map[string]any) map[string]any {
	result := make(map[string]any, len(input))
	for key, value := range input {
		normalizedKey := toSnakeCase(key)
		lowerKey := strings.ToLower(normalizedKey)

		if isSecretKey(lowerKey) {
			result[normalizedKey] = "[redacted]"
			continue
		}

		if lowerKey == "answers" {
			result[normalizedKey] = summarizeAnswers(value)
			continue
		}

		result[normalizedKey] = sanitizeAny(value)
	}
	return result
}

func sanitizeSlice(input []any) []any {
	result := make([]any, 0, len(input))
	for _, value := range input {
		result = append(result, sanitizeAny(value))
	}
	return result
}

func summarizeAnswers(raw any) map[string]any {
	items, ok := raw.([]any)
	if !ok {
		if typed, ok := raw.([]map[string]any); ok {
			items = make([]any, 0, len(typed))
			for _, item := range typed {
				items = append(items, item)
			}
		}
	}
	summary := map[string]any{
		"count":        float64(len(items)),
		"question_ids": []any{},
		"value_types":  []any{},
	}
	if len(items) == 0 {
		return summary
	}

	questionIDs := map[string]struct{}{}
	valueTypes := map[string]struct{}{}
	for _, item := range items {
		entry, ok := item.(map[string]any)
		if !ok {
			continue
		}
		if questionID, ok := extractString(entry, "questionId", "question_id"); ok {
			questionIDs[questionID] = struct{}{}
		}
		if rawValue, exists := entry["value"]; exists {
			if valueMap, ok := rawValue.(map[string]any); ok {
				for key, value := range valueMap {
					if value == nil {
						continue
					}
					valueTypes[toSnakeCase(key)] = struct{}{}
				}
			}
		}
	}

	summary["question_ids"] = sortedAnyKeys(questionIDs)
	summary["value_types"] = sortedAnyKeys(valueTypes)
	return summary
}

func extractString(input map[string]any, keys ...string) (string, bool) {
	for _, key := range keys {
		if raw, exists := input[key]; exists {
			if value, ok := raw.(string); ok && value != "" {
				return value, true
			}
		}
	}
	return "", false
}

func sortedAnyKeys(values map[string]struct{}) []any {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	result := make([]any, 0, len(keys))
	for _, key := range keys {
		result = append(result, key)
	}
	return result
}

func isSecretKey(key string) bool {
	switch key {
	case "authorization", "api_key", "api_key_plain", "apikey", "claim_token", "token", "access_token", "refresh_token", "password", "secret", "encrypted_secret":
		return true
	default:
		return false
	}
}

func toSnakeCase(input string) string {
	if input == "" {
		return input
	}
	var buffer bytes.Buffer
	for index, r := range input {
		if r >= 'A' && r <= 'Z' {
			if index > 0 {
				buffer.WriteByte('_')
			}
			buffer.WriteRune(r + ('a' - 'A'))
			continue
		}
		if r == '-' || r == ' ' {
			buffer.WriteByte('_')
			continue
		}
		buffer.WriteRune(r)
	}
	return buffer.String()
}

func ExtractRequestPayload(c *gin.Context, body []byte) map[string]any {
	summary := map[string]any{
		"method": c.Request.Method,
		"path":   c.Request.URL.Path,
	}
	if len(c.Request.URL.RawQuery) > 0 {
		summary["query"] = SanitizePayload(queryValuesToMap(c.Request.URL.Query()))
	}
	if contentType := c.ContentType(); contentType != "" {
		summary["content_type"] = contentType
	}
	if len(body) == 0 {
		return summary
	}

	if strings.HasPrefix(c.ContentType(), "multipart/") {
		summary["body"] = map[string]any{
			"type":        "multipart",
			"size_bytes":  len(body),
			"description": "multipart body omitted",
		}
		return summary
	}

	summary["body"] = sanitizeJSONBytes(body)
	return summary
}

func ExtractResponsePayload(status int, headers http.Header, body []byte) map[string]any {
	summary := map[string]any{
		"status_code": status,
	}
	contentType := headers.Get("Content-Type")
	if contentType != "" {
		summary["content_type"] = contentType
	}
	if len(body) == 0 {
		return summary
	}
	if !strings.Contains(contentType, "application/json") {
		summary["body"] = map[string]any{
			"type":        "non_json",
			"size_bytes":  len(body),
			"description": "response body omitted",
		}
		return summary
	}
	summary["body"] = sanitizeJSONBytes(body)
	return summary
}

func queryValuesToMap(values map[string][]string) map[string]any {
	result := make(map[string]any, len(values))
	for key, value := range values {
		if len(value) == 1 {
			result[key] = value[0]
			continue
		}
		items := make([]any, 0, len(value))
		for _, item := range value {
			items = append(items, item)
		}
		result[key] = items
	}
	return result
}

func PurgeOlderThan(ctx context.Context, db *sql.DB, cutoff time.Time) (int64, error) {
	if db == nil {
		return 0, nil
	}
	result, err := db.ExecContext(ctx, "DELETE FROM platform_event_logs WHERE created_at < $1", cutoff)
	if err != nil {
		return 0, fmt.Errorf("failed to purge platform event logs: %w", err)
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to inspect purge result: %w", err)
	}
	return rows, nil
}

func marshalJSONB(payload map[string]any) (string, error) {
	if payload == nil {
		payload = map[string]any{}
	}
	bytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal jsonb payload: %w", err)
	}
	return string(bytes), nil
}

func nullString(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}

func defaultString(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}
