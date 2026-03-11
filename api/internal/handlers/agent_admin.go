package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"github.com/TimLai666/surtopya-api/internal/agentadmin"
	"github.com/TimLai666/surtopya-api/internal/database"
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

func NewAgentAdminHandler() *AgentAdminHandler {
	db := database.GetDB()
	return &AgentAdminHandler{
		service: agentadmin.NewService(db),
		logger:  platformlog.NewLogger(db),
		db:      db,
	}
}

func (h *AgentAdminHandler) GetUsageIndex(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"kind":        "agent_admin_api",
		"name":        "Surtopya Agent Admin API",
		"version":     "1.0.0",
		"openapi_url": "/api/v1/agent-admin/openapi.json",
		"auth": gin.H{
			"type":   "bearer_api_key",
			"header": "Authorization: Bearer <agent_api_key>",
		},
		"scopes": agentadmin.AllPermissions,
		"scope_endpoints": gin.H{
			"logs.read":      []string{"GET /api/v1/agent-admin/logs", "GET /api/v1/agent-admin/logs/:id"},
			"agents.read":    []string{"GET /api/v1/agent-admin/agents", "GET /api/v1/agent-admin/agents/:id"},
			"agents.write":   []string{"POST /api/v1/agent-admin/agents", "PATCH /api/v1/agent-admin/agents/:id", "POST /api/v1/agent-admin/agents/:id/reveal-key", "POST /api/v1/agent-admin/agents/:id/rotate-key"},
			"surveys.read":   []string{},
			"surveys.write":  []string{},
			"datasets.read":  []string{},
			"datasets.write": []string{},
			"users.read":     []string{},
			"users.write":    []string{},
			"policies.read":  []string{},
			"policies.write": []string{},
			"plans.read":     []string{},
			"plans.write":    []string{},
			"system.read":    []string{},
			"system.write":   []string{},
		},
		"error_format": gin.H{
			"code":           "string",
			"message":        "string",
			"details":        gin.H{},
			"correlation_id": "uuid",
		},
		"endpoints": []gin.H{
			{"method": "GET", "path": "/api/v1/agent-admin", "purpose": "usage index"},
			{"method": "GET", "path": "/api/v1/agent-admin/openapi.json", "purpose": "OpenAPI document"},
			{"method": "GET", "path": "/api/v1/agent-admin/me", "purpose": "current agent identity"},
			{"method": "GET", "path": "/api/v1/agent-admin/logs", "purpose": "list logs"},
			{"method": "GET", "path": "/api/v1/agent-admin/logs/:id", "purpose": "get log detail"},
			{"method": "GET", "path": "/api/v1/agent-admin/agents", "purpose": "list accessible agent accounts"},
			{"method": "POST", "path": "/api/v1/agent-admin/agents", "purpose": "create agent account"},
			{"method": "GET", "path": "/api/v1/agent-admin/agents/:id", "purpose": "get agent account"},
			{"method": "PATCH", "path": "/api/v1/agent-admin/agents/:id", "purpose": "update agent account"},
			{"method": "POST", "path": "/api/v1/agent-admin/agents/:id/reveal-key", "purpose": "reveal active key"},
			{"method": "POST", "path": "/api/v1/agent-admin/agents/:id/rotate-key", "purpose": "rotate active key"},
		},
		"examples": gin.H{
			"list_logs": gin.H{
				"method": "GET",
				"path":   "/api/v1/agent-admin/logs?module=survey&status=error&limit=20",
			},
			"reveal_key": gin.H{
				"method": "POST",
				"path":   "/api/v1/agent-admin/agents/{id}/reveal-key",
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
			{"url": "/api/v1/agent-admin", "description": "Versioned agent admin API"},
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
		"paths": gin.H{
			"/": gin.H{
				"get": gin.H{"summary": "Usage index"},
			},
			"/me": gin.H{
				"get": gin.H{"summary": "Current agent identity"},
			},
			"/logs": gin.H{
				"get": gin.H{"summary": "List accessible logs"},
			},
			"/agents": gin.H{
				"get":  gin.H{"summary": "List accessible agent accounts"},
				"post": gin.H{"summary": "Create agent account"},
			},
			"/agents/{id}": gin.H{
				"get":   gin.H{"summary": "Get agent account"},
				"patch": gin.H{"summary": "Update agent account"},
			},
			"/agents/{id}/reveal-key": gin.H{
				"post": gin.H{"summary": "Reveal current agent key"},
			},
			"/agents/{id}/rotate-key": gin.H{
				"post": gin.H{"summary": "Rotate current agent key"},
			},
		},
	})
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
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	logs, err := h.service.ListLogs(c.Request.Context(), identity, agentadmin.ListLogsFilter{
		CorrelationID: c.Query("correlation_id"),
		Module:        c.Query("module"),
		Action:        c.Query("action"),
		Status:        c.Query("status"),
		ResourceType:  c.Query("resource_type"),
		ResourceID:    c.Query("resource_id"),
		Limit:         limit,
		Offset:        offset,
	})
	if err != nil {
		agentJSONError(c, http.StatusInternalServerError, "server_error", "Failed to list logs", nil)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"logs": logs,
		"meta": gin.H{
			"limit":  limit,
			"offset": offset,
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
