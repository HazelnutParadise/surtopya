package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/TimLai666/surtopya-api/internal/agentadmin"
	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/TimLai666/surtopya-api/internal/deid"
	"github.com/TimLai666/surtopya-api/internal/platformlog"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AgentAdminHandler struct {
	service *agentadmin.Service
	logger  *platformlog.Logger
	db      *sql.DB
}

type agentAccountRequest struct {
	OwnerUserID *string  `json:"owner_user_id"`
	Name        string   `json:"name"`
	Description *string  `json:"description"`
	IsActive    *bool    `json:"is_active"`
	Permissions []string `json:"permissions"`
}

type uiEventRequest struct {
	Screen     string         `json:"screen"`
	Component  string         `json:"component"`
	EventName  string         `json:"event_name"`
	ResourceID string         `json:"resource_id"`
	StateFrom  string         `json:"state_from"`
	StateTo    string         `json:"state_to"`
	Metadata   map[string]any `json:"metadata"`
}

type deidChunkAnnotateRequest struct {
	Cells []struct {
		RowNo  int    `json:"row_no"`
		ColNo  int    `json:"col_no"`
		Reason string `json:"reason"`
	} `json:"cells"`
}

func NewAgentAdminHandler() *AgentAdminHandler {
	db := database.GetDB()
	return &AgentAdminHandler{
		service: agentadmin.NewService(db),
		logger:  platformlog.NewLogger(db),
		db:      db,
	}
}

type agentEndpointDoc struct {
	Method      string
	Path        string
	OpenAPIPath string
	Purpose     string
	Summary     string
	Permission  string
}

var agentEndpointDocs = []agentEndpointDoc{
	{Method: "GET", Path: "/v1/agent-admin", OpenAPIPath: "/", Purpose: "usage index", Summary: "Usage index"},
	{Method: "GET", Path: "/v1/agent-admin/openapi.json", OpenAPIPath: "/openapi.json", Purpose: "OpenAPI document", Summary: "OpenAPI document"},
	{Method: "GET", Path: "/v1/agent-admin/me", OpenAPIPath: "/me", Purpose: "current agent identity", Summary: "Current agent identity"},
	{Method: "GET", Path: "/v1/agent-admin/logs", OpenAPIPath: "/logs", Purpose: "list logs", Summary: "List accessible logs", Permission: "logs.read"},
	{Method: "GET", Path: "/v1/agent-admin/logs/:id", OpenAPIPath: "/logs/{id}", Purpose: "get log detail", Summary: "Get log detail", Permission: "logs.read"},

	{Method: "GET", Path: "/v1/agent-admin/surveys", OpenAPIPath: "/surveys", Purpose: "list surveys", Summary: "List surveys", Permission: "surveys.read"},
	{Method: "PATCH", Path: "/v1/agent-admin/surveys/:id", OpenAPIPath: "/surveys/{id}", Purpose: "update survey draft metadata", Summary: "Update survey", Permission: "surveys.write"},
	{Method: "DELETE", Path: "/v1/agent-admin/surveys/:id", OpenAPIPath: "/surveys/{id}", Purpose: "delete survey", Summary: "Delete survey", Permission: "surveys.write"},
	{Method: "POST", Path: "/v1/agent-admin/surveys/:id/publish", OpenAPIPath: "/surveys/{id}/publish", Purpose: "publish survey draft", Summary: "Publish survey", Permission: "surveys.write"},
	{Method: "POST", Path: "/v1/agent-admin/surveys/:id/responses/open", OpenAPIPath: "/surveys/{id}/responses/open", Purpose: "open survey responses", Summary: "Open survey responses", Permission: "surveys.write"},
	{Method: "POST", Path: "/v1/agent-admin/surveys/:id/responses/close", OpenAPIPath: "/surveys/{id}/responses/close", Purpose: "close survey responses", Summary: "Close survey responses", Permission: "surveys.write"},
	{Method: "GET", Path: "/v1/agent-admin/surveys/:id/versions", OpenAPIPath: "/surveys/{id}/versions", Purpose: "list survey versions", Summary: "List survey versions", Permission: "surveys.read"},
	{Method: "GET", Path: "/v1/agent-admin/surveys/:id/versions/:versionNumber", OpenAPIPath: "/surveys/{id}/versions/{versionNumber}", Purpose: "get survey version detail", Summary: "Get survey version", Permission: "surveys.read"},
	{Method: "POST", Path: "/v1/agent-admin/surveys/:id/versions/:versionNumber/restore-draft", OpenAPIPath: "/surveys/{id}/versions/{versionNumber}/restore-draft", Purpose: "restore version as draft", Summary: "Restore survey version to draft", Permission: "surveys.write"},
	{Method: "GET", Path: "/v1/agent-admin/surveys/:id/responses", OpenAPIPath: "/surveys/{id}/responses", Purpose: "list survey responses", Summary: "List survey responses", Permission: "surveys.read"},
	{Method: "GET", Path: "/v1/agent-admin/surveys/:id/responses/analytics", OpenAPIPath: "/surveys/{id}/responses/analytics", Purpose: "get survey response analytics", Summary: "Get survey response analytics", Permission: "surveys.read"},
	{Method: "GET", Path: "/v1/agent-admin/deid", OpenAPIPath: "/deid", Purpose: "de-identification workflow usage and queue summary", Summary: "Get de-identification usage index", Permission: "deid.read"},
	{Method: "POST", Path: "/v1/agent-admin/deid/sessions/start", OpenAPIPath: "/deid/sessions/start", Purpose: "start next pending de-identification session", Summary: "Start de-identification session", Permission: "deid.write"},
	{Method: "GET", Path: "/v1/agent-admin/deid/sessions/:session_id", OpenAPIPath: "/deid/sessions/{session_id}", Purpose: "resume de-identification session", Summary: "Get de-identification session", Permission: "deid.read"},
	{Method: "POST", Path: "/v1/agent-admin/deid/sessions/:session_id/chunks/:chunk_index/annotate", OpenAPIPath: "/deid/sessions/{session_id}/chunks/{chunk_index}/annotate", Purpose: "annotate current chunk sensitive cells", Summary: "Annotate de-identification chunk", Permission: "deid.write"},

	{Method: "GET", Path: "/v1/agent-admin/datasets", OpenAPIPath: "/datasets", Purpose: "list datasets", Summary: "List datasets", Permission: "datasets.read"},
	{Method: "POST", Path: "/v1/agent-admin/datasets", OpenAPIPath: "/datasets", Purpose: "create dataset", Summary: "Create dataset", Permission: "datasets.write"},
	{Method: "PATCH", Path: "/v1/agent-admin/datasets/:id", OpenAPIPath: "/datasets/{id}", Purpose: "update dataset", Summary: "Update dataset", Permission: "datasets.write"},
	{Method: "DELETE", Path: "/v1/agent-admin/datasets/:id", OpenAPIPath: "/datasets/{id}", Purpose: "delete dataset", Summary: "Delete dataset", Permission: "datasets.write"},

	{Method: "GET", Path: "/v1/agent-admin/users", OpenAPIPath: "/users", Purpose: "list users", Summary: "List users", Permission: "users.read"},
	{Method: "GET", Path: "/v1/agent-admin/users/:id", OpenAPIPath: "/users/{id}", Purpose: "get user detail", Summary: "Get user", Permission: "users.read"},
	{Method: "PATCH", Path: "/v1/agent-admin/users/:id", OpenAPIPath: "/users/{id}", Purpose: "update user", Summary: "Update user", Permission: "users.write"},
	{Method: "POST", Path: "/v1/agent-admin/users/points-adjust", OpenAPIPath: "/users/points-adjust", Purpose: "adjust users points in batch", Summary: "Adjust users points", Permission: "users.write"},

	{Method: "GET", Path: "/v1/agent-admin/subscription-plans", OpenAPIPath: "/subscription-plans", Purpose: "list subscription plans", Summary: "List subscription plans", Permission: "plans.read"},
	{Method: "POST", Path: "/v1/agent-admin/subscription-plans", OpenAPIPath: "/subscription-plans", Purpose: "create subscription plan", Summary: "Create subscription plan", Permission: "plans.write"},
	{Method: "PATCH", Path: "/v1/agent-admin/subscription-plans/:id", OpenAPIPath: "/subscription-plans/{id}", Purpose: "update subscription plan", Summary: "Update subscription plan", Permission: "plans.write"},
	{Method: "DELETE", Path: "/v1/agent-admin/subscription-plans/:id", OpenAPIPath: "/subscription-plans/{id}", Purpose: "deactivate subscription plan", Summary: "Deactivate subscription plan", Permission: "plans.write"},

	{Method: "GET", Path: "/v1/agent-admin/policies", OpenAPIPath: "/policies", Purpose: "load policy matrix", Summary: "Get policies", Permission: "policies.read"},
	{Method: "PATCH", Path: "/v1/agent-admin/policies", OpenAPIPath: "/policies", Purpose: "update policy matrix", Summary: "Update policies", Permission: "policies.write"},
	{Method: "PATCH", Path: "/v1/agent-admin/capabilities/:id", OpenAPIPath: "/capabilities/{id}", Purpose: "update capability display metadata", Summary: "Update capability", Permission: "policies.write"},
	{Method: "GET", Path: "/v1/agent-admin/policy-writers", OpenAPIPath: "/policy-writers", Purpose: "list policy writers", Summary: "List policy writers", Permission: "policies.read"},
	{Method: "PUT", Path: "/v1/agent-admin/policy-writers/:id", OpenAPIPath: "/policy-writers/{id}", Purpose: "update policy writer permission", Summary: "Update policy writer", Permission: "policies.write"},

	{Method: "GET", Path: "/v1/agent-admin/system-settings", OpenAPIPath: "/system-settings", Purpose: "get system settings", Summary: "Get system settings", Permission: "system.read"},
	{Method: "PATCH", Path: "/v1/agent-admin/system-settings", OpenAPIPath: "/system-settings", Purpose: "update system settings", Summary: "Update system settings", Permission: "system.write"},

	{Method: "GET", Path: "/v1/agent-admin/agents", OpenAPIPath: "/agents", Purpose: "list accessible agent accounts", Summary: "List accessible agent accounts", Permission: "agents.read"},
	{Method: "POST", Path: "/v1/agent-admin/agents", OpenAPIPath: "/agents", Purpose: "create agent account", Summary: "Create agent account", Permission: "agents.write"},
	{Method: "GET", Path: "/v1/agent-admin/agents/:id", OpenAPIPath: "/agents/{id}", Purpose: "get agent account", Summary: "Get agent account", Permission: "agents.read"},
	{Method: "PATCH", Path: "/v1/agent-admin/agents/:id", OpenAPIPath: "/agents/{id}", Purpose: "update agent account", Summary: "Update agent account", Permission: "agents.write"},
	{Method: "POST", Path: "/v1/agent-admin/agents/:id/reveal-key", OpenAPIPath: "/agents/{id}/reveal-key", Purpose: "reveal active key", Summary: "Reveal current agent key", Permission: "agents.write"},
	{Method: "POST", Path: "/v1/agent-admin/agents/:id/rotate-key", OpenAPIPath: "/agents/{id}/rotate-key", Purpose: "rotate active key", Summary: "Rotate current agent key", Permission: "agents.write"},
}

func buildAgentScopeEndpoints() gin.H {
	byScope := make(map[string][]string, len(agentadmin.AllPermissions))
	for _, permission := range agentadmin.AllPermissions {
		byScope[permission] = []string{}
	}
	for _, endpoint := range agentEndpointDocs {
		if endpoint.Permission == "" {
			continue
		}
		byScope[endpoint.Permission] = append(byScope[endpoint.Permission], endpoint.Method+" "+endpoint.Path)
	}

	result := gin.H{}
	for _, permission := range agentadmin.AllPermissions {
		result[permission] = byScope[permission]
	}
	return result
}

func buildAgentUsageEndpoints() []gin.H {
	endpoints := make([]gin.H, 0, len(agentEndpointDocs))
	for _, endpoint := range agentEndpointDocs {
		endpoints = append(endpoints, gin.H{
			"method":  endpoint.Method,
			"path":    endpoint.Path,
			"purpose": endpoint.Purpose,
		})
	}
	return endpoints
}

func buildAgentOpenAPIPaths() gin.H {
	paths := gin.H{}
	for _, endpoint := range agentEndpointDocs {
		pathItem, ok := paths[endpoint.OpenAPIPath].(gin.H)
		if !ok {
			pathItem = gin.H{}
		}

		operation := gin.H{
			"summary": endpoint.Summary,
		}
		if endpoint.Permission != "" {
			operation["x-required-permission"] = endpoint.Permission
		}

		pathItem[strings.ToLower(endpoint.Method)] = operation
		paths[endpoint.OpenAPIPath] = pathItem
	}
	return paths
}

func (h *AgentAdminHandler) GetUsageIndex(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"kind":        "agent_admin_api",
		"name":        "Surtopya Agent Admin API",
		"version":     "1.0.0",
		"openapi_url": "/v1/agent-admin/openapi.json",
		"auth": gin.H{
			"type":   "bearer_api_key",
			"header": "Authorization: Bearer <agent_api_key>",
		},
		"scopes":          agentadmin.AllPermissions,
		"scope_endpoints": buildAgentScopeEndpoints(),
		"error_format": gin.H{
			"code":           "string",
			"message":        "string",
			"details":        gin.H{},
			"correlation_id": "uuid",
		},
		"endpoints": buildAgentUsageEndpoints(),
		"examples": gin.H{
			"list_logs": gin.H{
				"method": "GET",
				"path":   "/v1/agent-admin/logs?module=survey&status=error&limit=20",
			},
			"reveal_key": gin.H{
				"method": "POST",
				"path":   "/v1/agent-admin/agents/{id}/reveal-key",
			},
		},
	})
}

func (h *AgentAdminHandler) GetOpenAPI(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"openapi": "3.1.0",
		"info": gin.H{
			"title":       "Surtopya Agent Admin API",
			"version":     "1.0.0",
			"description": "Machine-facing admin API for AI agents.",
		},
		"servers": []gin.H{
			{"url": "/v1/agent-admin", "description": "Versioned agent admin API"},
		},
		"components": gin.H{
			"securitySchemes": gin.H{
				"bearerApiKey": gin.H{
					"type":         "http",
					"scheme":       "bearer",
					"bearerFormat": "API Key",
				},
			},
			"schemas": gin.H{
				"error": gin.H{
					"type": "object",
					"properties": gin.H{
						"code":           gin.H{"type": "string"},
						"message":        gin.H{"type": "string"},
						"details":        gin.H{"type": "object"},
						"correlation_id": gin.H{"type": "string", "format": "uuid"},
					},
				},
			},
		},
		"security": []gin.H{
			{"bearerApiKey": []string{}},
		},
		"paths": buildAgentOpenAPIPaths(),
	})
}

func (h *AgentAdminHandler) GetDeidUsage(c *gin.Context) {
	identity := currentAgentIdentity(c)
	if identity == nil {
		agentJSONError(c, http.StatusUnauthorized, "unauthorized", "Agent identity missing", nil)
		return
	}

	service := deid.NewService(h.db)
	overview, err := service.GetUsageOverview(c.Request.Context(), identity.OwnerUserID, identity.OwnerIsSuperAdmin)
	if err != nil {
		agentJSONError(c, http.StatusInternalServerError, "server_error", "Failed to load de-identification usage", nil)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"kind": "deid_usage",
		"instructions": gin.H{
			"summary": "Start a session, review chunk table by row/col, submit sensitive cells, continue until awaiting_review.",
			"steps": []string{
				"Call POST /v1/agent-admin/deid/sessions/start",
				"Read the returned chunk (1-based row_no and col_no).",
				"Submit sensitive cells to annotate endpoint.",
				"Repeat until status becomes awaiting_review.",
			},
			"endpoints": []gin.H{
				{"method": "GET", "path": "/v1/agent-admin/deid"},
				{"method": "POST", "path": "/v1/agent-admin/deid/sessions/start"},
				{"method": "GET", "path": "/v1/agent-admin/deid/sessions/{session_id}"},
				{"method": "POST", "path": "/v1/agent-admin/deid/sessions/{session_id}/chunks/{chunk_index}/annotate"},
			},
		},
		"queue": overview,
	})
}

func (h *AgentAdminHandler) StartDeidSession(c *gin.Context) {
	identity := currentAgentIdentity(c)
	if identity == nil {
		agentJSONError(c, http.StatusUnauthorized, "unauthorized", "Agent identity missing", nil)
		return
	}

	service := deid.NewService(h.db)
	session, err := service.StartPendingSession(c.Request.Context(), identity.OwnerUserID, identity.OwnerIsSuperAdmin)
	if err != nil {
		switch err {
		case deid.ErrNoPendingJob:
			c.JSON(http.StatusOK, gin.H{
				"status":  "no_data",
				"message": "No pending de-identification data",
			})
		default:
			agentJSONError(c, http.StatusInternalServerError, "server_error", "Failed to start de-identification session", nil)
		}
		return
	}

	c.JSON(http.StatusOK, session)
}

func (h *AgentAdminHandler) GetDeidSession(c *gin.Context) {
	identity := currentAgentIdentity(c)
	if identity == nil {
		agentJSONError(c, http.StatusUnauthorized, "unauthorized", "Agent identity missing", nil)
		return
	}

	sessionID, err := uuid.Parse(c.Param("session_id"))
	if err != nil {
		agentJSONError(c, http.StatusBadRequest, "invalid_request", "Invalid session_id", nil)
		return
	}

	service := deid.NewService(h.db)
	session, err := service.GetSession(c.Request.Context(), sessionID, identity.OwnerUserID, identity.OwnerIsSuperAdmin)
	if err != nil {
		switch err {
		case deid.ErrSessionNotFound:
			agentJSONError(c, http.StatusNotFound, "not_found", "Session not found", nil)
		case deid.ErrSessionAccessDenied:
			agentJSONError(c, http.StatusForbidden, "forbidden", "Session access denied", nil)
		default:
			agentJSONError(c, http.StatusInternalServerError, "server_error", "Failed to load de-identification session", nil)
		}
		return
	}

	c.JSON(http.StatusOK, session)
}

func (h *AgentAdminHandler) AnnotateDeidChunk(c *gin.Context) {
	identity := currentAgentIdentity(c)
	if identity == nil {
		agentJSONError(c, http.StatusUnauthorized, "unauthorized", "Agent identity missing", nil)
		return
	}

	sessionID, err := uuid.Parse(c.Param("session_id"))
	if err != nil {
		agentJSONError(c, http.StatusBadRequest, "invalid_request", "Invalid session_id", nil)
		return
	}
	chunkIndex, err := strconv.Atoi(c.Param("chunk_index"))
	if err != nil || chunkIndex < 0 {
		agentJSONError(c, http.StatusBadRequest, "invalid_request", "Invalid chunk_index", nil)
		return
	}

	var req deidChunkAnnotateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		agentJSONError(c, http.StatusBadRequest, "invalid_request", "Invalid request body", nil)
		return
	}

	cells := make([]deid.CellAnnotation, 0, len(req.Cells))
	for _, cell := range req.Cells {
		cells = append(cells, deid.CellAnnotation{
			RowNo:  cell.RowNo,
			ColNo:  cell.ColNo,
			Reason: strings.TrimSpace(cell.Reason),
		})
	}

	service := deid.NewService(h.db)
	actorUserID := identity.OwnerUserID
	actorAgentID := identity.ID
	session, err := service.AnnotateChunk(
		c.Request.Context(),
		sessionID,
		chunkIndex,
		cells,
		&actorUserID,
		&actorAgentID,
		identity.OwnerUserID,
		identity.OwnerIsSuperAdmin,
	)
	if err != nil {
		switch err {
		case deid.ErrSessionNotFound:
			agentJSONError(c, http.StatusNotFound, "not_found", "Session not found", nil)
		case deid.ErrSessionAccessDenied:
			agentJSONError(c, http.StatusForbidden, "forbidden", "Session access denied", nil)
		case deid.ErrChunkIndexMismatch:
			agentJSONError(c, http.StatusConflict, "chunk_index_mismatch", "Chunk index mismatch", nil)
		case deid.ErrSessionNotInProgress:
			agentJSONError(c, http.StatusConflict, "invalid_session_state", "Session is not in progress", nil)
		default:
			agentJSONError(c, http.StatusInternalServerError, "server_error", "Failed to annotate chunk", nil)
		}
		return
	}

	c.JSON(http.StatusOK, session)
}

func (h *AgentAdminHandler) GetMe(c *gin.Context) {
	identity := currentAgentIdentity(c)
	if identity == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"code":           "unauthorized",
			"message":        "Agent identity missing",
			"details":        gin.H{},
			"correlation_id": platformlog.CorrelationIDFromGin(c).String(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"id":                   identity.ID,
		"owner_user_id":        identity.OwnerUserID,
		"owner_is_super_admin": identity.OwnerIsSuperAdmin,
		"name":                 identity.Name,
		"description":          identity.Description,
		"is_active":            identity.IsActive,
		"created_by_user_id":   identity.CreatedByUserID,
		"last_used_at":         identity.LastUsedAt,
		"created_at":           identity.CreatedAt,
		"updated_at":           identity.UpdatedAt,
		"permissions":          identity.Permissions,
		"key_prefix":           identity.KeyPrefix,
		"capabilities":         h.service.ScopeList(identity),
	})
}

func (h *AgentAdminHandler) ListLogs(c *gin.Context) {
	identity := currentAgentIdentity(c)
	if identity == nil {
		agentJSONError(c, http.StatusUnauthorized, "unauthorized", "Agent identity missing", nil)
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	from, err := parseLogTimeQuery(c.Query("from"))
	if err != nil {
		agentJSONError(c, http.StatusBadRequest, "invalid_request", "Invalid from query", nil)
		return
	}
	to, err := parseLogTimeQuery(c.Query("to"))
	if err != nil {
		agentJSONError(c, http.StatusBadRequest, "invalid_request", "Invalid to query", nil)
		return
	}
	page, err := h.service.ListLogs(c.Request.Context(), identity, agentadmin.ListLogsFilter{
		CorrelationID: c.Query("correlation_id"),
		Module:        c.Query("module"),
		Action:        c.Query("action"),
		Status:        c.Query("status"),
		ActorType:     c.Query("actor_type"),
		ResourceType:  c.Query("resource_type"),
		ResourceID:    c.Query("resource_id"),
		From:          from,
		To:            to,
		Limit:         limit,
		Cursor:        c.Query("cursor"),
	})
	if err != nil {
		if strings.Contains(err.Error(), "cursor") {
			agentJSONError(c, http.StatusBadRequest, "invalid_request", "Invalid cursor query", nil)
			return
		}
		agentJSONError(c, http.StatusInternalServerError, "server_error", "Failed to list logs", nil)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"logs": page.Logs,
		"meta": gin.H{
			"limit":       limit,
			"total":       page.Total,
			"next_cursor": page.NextCursor,
			"has_more":    page.HasMore,
		},
	})
}

func (h *AgentAdminHandler) GetLog(c *gin.Context) {
	identity := currentAgentIdentity(c)
	if identity == nil {
		agentJSONError(c, http.StatusUnauthorized, "unauthorized", "Agent identity missing", nil)
		return
	}
	logID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		agentJSONError(c, http.StatusBadRequest, "invalid_request", "Invalid log id", nil)
		return
	}
	record, err := h.service.GetLogByID(c.Request.Context(), identity, logID)
	if err != nil {
		if err == agentadmin.ErrNotFound {
			agentJSONError(c, http.StatusNotFound, "not_found", "Log not found", nil)
			return
		}
		agentJSONError(c, http.StatusInternalServerError, "server_error", "Failed to load log", nil)
		return
	}
	c.JSON(http.StatusOK, record)
}

func parseLogTimeQuery(value string) (*time.Time, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil, nil
	}
	parsed, err := time.Parse(time.RFC3339, trimmed)
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

func (h *AgentAdminHandler) ListAccounts(c *gin.Context) {
	actorUserID, actorIsSuperAdmin, ok := managementActor(c, h.db)
	if !ok {
		agentJSONError(c, http.StatusUnauthorized, "unauthorized", "Management identity missing", nil)
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	var ownerFilter *uuid.UUID
	if rawOwner := strings.TrimSpace(c.Query("owner_user_id")); rawOwner != "" {
		parsed, err := uuid.Parse(rawOwner)
		if err != nil {
			agentJSONError(c, http.StatusBadRequest, "invalid_request", "Invalid owner_user_id", nil)
			return
		}
		ownerFilter = &parsed
	}

	accounts, err := h.service.ListAccountsForAdmin(c.Request.Context(), actorUserID, actorIsSuperAdmin, agentadmin.ListAccountsFilter{
		Search:      c.Query("search"),
		OwnerUserID: ownerFilter,
		Limit:       limit,
		Offset:      offset,
	})
	if err != nil {
		agentJSONError(c, http.StatusInternalServerError, "server_error", "Failed to list agent accounts", nil)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"accounts": accounts,
		"meta": gin.H{
			"limit":  limit,
			"offset": offset,
		},
	})
}

func (h *AgentAdminHandler) CreateAccount(c *gin.Context) {
	actorUserID, actorIsSuperAdmin, ok := managementActor(c, h.db)
	if !ok {
		agentJSONError(c, http.StatusUnauthorized, "unauthorized", "Management identity missing", nil)
		return
	}
	var req agentAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		agentJSONError(c, http.StatusBadRequest, "invalid_request", "Invalid request body", nil)
		return
	}
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}
	var ownerUserID *uuid.UUID
	if req.OwnerUserID != nil && strings.TrimSpace(*req.OwnerUserID) != "" {
		parsed, err := uuid.Parse(strings.TrimSpace(*req.OwnerUserID))
		if err != nil {
			agentJSONError(c, http.StatusBadRequest, "invalid_request", "Invalid owner_user_id", nil)
			return
		}
		ownerUserID = &parsed
	}
	account, apiKey, err := h.service.CreateAccountForAdmin(c.Request.Context(), actorUserID, actorIsSuperAdmin, agentadmin.CreateAccountInput{
		OwnerUserID: ownerUserID,
		Name:        req.Name,
		Description: req.Description,
		IsActive:    isActive,
		Permissions: req.Permissions,
	})
	if err != nil {
		if err == agentadmin.ErrForbidden {
			agentJSONError(c, http.StatusForbidden, "forbidden", "Owner assignment not allowed", nil)
			return
		}
		agentJSONError(c, http.StatusInternalServerError, "server_error", "Failed to create agent account", nil)
		return
	}
	c.JSON(http.StatusCreated, gin.H{
		"account":  account,
		"api_key":  apiKey,
		"revealed": true,
	})
}

func (h *AgentAdminHandler) GetAccount(c *gin.Context) {
	actorUserID, actorIsSuperAdmin, ok := managementActor(c, h.db)
	if !ok {
		agentJSONError(c, http.StatusUnauthorized, "unauthorized", "Management identity missing", nil)
		return
	}
	accountID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		agentJSONError(c, http.StatusBadRequest, "invalid_request", "Invalid account id", nil)
		return
	}
	account, err := h.service.GetAccountForAdmin(c.Request.Context(), actorUserID, actorIsSuperAdmin, accountID)
	if err != nil {
		if err == agentadmin.ErrNotFound {
			agentJSONError(c, http.StatusNotFound, "not_found", "Agent account not found", nil)
			return
		}
		agentJSONError(c, http.StatusInternalServerError, "server_error", "Failed to load agent account", nil)
		return
	}
	c.JSON(http.StatusOK, account)
}

func (h *AgentAdminHandler) UpdateAccount(c *gin.Context) {
	actorUserID, actorIsSuperAdmin, ok := managementActor(c, h.db)
	if !ok {
		agentJSONError(c, http.StatusUnauthorized, "unauthorized", "Management identity missing", nil)
		return
	}
	accountID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		agentJSONError(c, http.StatusBadRequest, "invalid_request", "Invalid account id", nil)
		return
	}
	var req agentAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		agentJSONError(c, http.StatusBadRequest, "invalid_request", "Invalid request body", nil)
		return
	}
	var description **string
	if req.Description != nil {
		description = &req.Description
	}
	account, err := h.service.UpdateAccountForAdmin(c.Request.Context(), actorUserID, actorIsSuperAdmin, accountID, agentadmin.UpdateAccountInput{
		Name:        nullableStringValue(req.Name),
		Description: description,
		IsActive:    req.IsActive,
		Permissions: req.Permissions,
	})
	if err != nil {
		if err == agentadmin.ErrNotFound {
			agentJSONError(c, http.StatusNotFound, "not_found", "Agent account not found", nil)
			return
		}
		agentJSONError(c, http.StatusInternalServerError, "server_error", "Failed to update agent account", nil)
		return
	}
	c.JSON(http.StatusOK, account)
}

func (h *AgentAdminHandler) RevealKey(c *gin.Context) {
	actorUserID, actorIsSuperAdmin, ok := managementActor(c, h.db)
	if !ok {
		agentJSONError(c, http.StatusUnauthorized, "unauthorized", "Management identity missing", nil)
		return
	}
	accountID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		agentJSONError(c, http.StatusBadRequest, "invalid_request", "Invalid account id", nil)
		return
	}
	apiKey, err := h.service.RevealKeyForAdmin(c.Request.Context(), actorUserID, actorIsSuperAdmin, accountID)
	if err != nil {
		if err == agentadmin.ErrNotFound {
			agentJSONError(c, http.StatusNotFound, "not_found", "Agent account not found", nil)
			return
		}
		agentJSONError(c, http.StatusInternalServerError, "server_error", "Failed to reveal agent key", nil)
		return
	}
	platformlog.LogFromGin(c, h.logger, platformlog.EventInput{
		EventType:    "domain",
		Module:       "agent_admin",
		Action:       "reveal_key",
		Status:       "success",
		ActorType:    platformlog.ActorTypeFromGin(c),
		ActorUserID:  platformlog.ActorUserIDFromGin(c),
		ActorAgentID: platformlog.ActorAgentIDFromGin(c),
		OwnerUserID:  ownerUserIDForAudit(c, actorUserID),
		ResourceType: "agent_admin_account",
		ResourceID:   accountID.String(),
	})
	c.JSON(http.StatusOK, gin.H{"api_key": apiKey, "revealed": true})
}

func (h *AgentAdminHandler) RotateKey(c *gin.Context) {
	actorUserID, actorIsSuperAdmin, ok := managementActor(c, h.db)
	if !ok {
		agentJSONError(c, http.StatusUnauthorized, "unauthorized", "Management identity missing", nil)
		return
	}
	accountID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		agentJSONError(c, http.StatusBadRequest, "invalid_request", "Invalid account id", nil)
		return
	}
	apiKey, prefix, err := h.service.RotateKeyForAdmin(c.Request.Context(), actorUserID, actorIsSuperAdmin, accountID)
	if err != nil {
		if err == agentadmin.ErrNotFound {
			agentJSONError(c, http.StatusNotFound, "not_found", "Agent account not found", nil)
			return
		}
		agentJSONError(c, http.StatusInternalServerError, "server_error", "Failed to rotate agent key", nil)
		return
	}
	platformlog.LogFromGin(c, h.logger, platformlog.EventInput{
		EventType:    "domain",
		Module:       "agent_admin",
		Action:       "rotate_key",
		Status:       "success",
		ActorType:    platformlog.ActorTypeFromGin(c),
		ActorUserID:  platformlog.ActorUserIDFromGin(c),
		ActorAgentID: platformlog.ActorAgentIDFromGin(c),
		OwnerUserID:  ownerUserIDForAudit(c, actorUserID),
		ResourceType: "agent_admin_account",
		ResourceID:   accountID.String(),
		Metadata: map[string]any{
			"key_prefix": prefix,
		},
	})
	c.JSON(http.StatusOK, gin.H{"api_key": apiKey, "key_prefix": prefix, "rotated": true})
}

func (h *AgentAdminHandler) IngestUIEvent(c *gin.Context) {
	var req uiEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	module := "ui"
	if strings.TrimSpace(req.Screen) != "" {
		module = req.Screen
	}
	platformlog.LogFromGin(c, h.logger, platformlog.EventInput{
		EventType:    "ui_event",
		Module:       module,
		Action:       req.EventName,
		Status:       "success",
		ResourceType: "ui_component",
		ResourceID:   req.ResourceID,
		RequestSummary: map[string]any{
			"screen":     req.Screen,
			"component":  req.Component,
			"event_name": req.EventName,
			"state_from": req.StateFrom,
			"state_to":   req.StateTo,
		},
		Metadata: req.Metadata,
	})

	c.JSON(http.StatusAccepted, gin.H{"ok": true})
}

func currentAgentIdentity(c *gin.Context) *agentadmin.AuthenticatedAgent {
	rawIdentity, exists := c.Get("agentAdminIdentity")
	if !exists {
		return nil
	}
	identity, ok := rawIdentity.(*agentadmin.AuthenticatedAgent)
	if !ok {
		return nil
	}
	return identity
}

func humanAdminActor(c *gin.Context, db *sql.DB) (uuid.UUID, bool, bool) {
	rawUserID, exists := c.Get("userID")
	if !exists {
		return uuid.Nil, false, false
	}
	userID, ok := rawUserID.(uuid.UUID)
	if !ok {
		return uuid.Nil, false, false
	}
	var isSuperAdmin bool
	if db == nil {
		return userID, false, true
	}
	if err := db.QueryRow("SELECT is_super_admin FROM users WHERE id = $1", userID).Scan(&isSuperAdmin); err != nil {
		return uuid.Nil, false, false
	}
	return userID, isSuperAdmin, true
}

func managementActor(c *gin.Context, db *sql.DB) (uuid.UUID, bool, bool) {
	if userID, isSuperAdmin, ok := humanAdminActor(c, db); ok {
		return userID, isSuperAdmin, true
	}
	identity := currentAgentIdentity(c)
	if identity == nil {
		return uuid.Nil, false, false
	}
	if db == nil {
		return identity.OwnerUserID, false, true
	}
	var isSuperAdmin bool
	if err := db.QueryRow("SELECT is_super_admin FROM users WHERE id = $1", identity.OwnerUserID).Scan(&isSuperAdmin); err != nil {
		return uuid.Nil, false, false
	}
	return identity.OwnerUserID, isSuperAdmin, true
}

func ownerUserIDForAudit(c *gin.Context, fallback uuid.UUID) *uuid.UUID {
	if ownerUserID := platformlog.OwnerUserIDFromGin(c); ownerUserID != nil {
		return ownerUserID
	}
	return &fallback
}

func nullableStringValue(value string) *string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	trimmed := strings.TrimSpace(value)
	return &trimmed
}

func agentJSONError(c *gin.Context, status int, code string, message string, details map[string]any) {
	c.JSON(status, gin.H{
		"code":           code,
		"message":        message,
		"details":        details,
		"correlation_id": platformlog.CorrelationIDFromGin(c).String(),
	})
}
