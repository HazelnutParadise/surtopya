package middleware

import (
	"net/http"
	"strings"

	"github.com/TimLai666/surtopya-api/internal/agentadmin"
	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/TimLai666/surtopya-api/internal/platformlog"
	"github.com/gin-gonic/gin"
)

func RequireAgentAdmin() gin.HandlerFunc {
	service := agentadmin.NewService(database.GetDB())

	return func(c *gin.Context) {
		authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
		if authHeader == "" {
			agentError(c, http.StatusUnauthorized, "unauthorized", "Agent API key required", nil)
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			agentError(c, http.StatusUnauthorized, "unauthorized", "Invalid Authorization header", nil)
			c.Abort()
			return
		}

		identity, err := service.Authenticate(c.Request.Context(), parts[1])
		if err != nil {
			agentError(c, http.StatusUnauthorized, "unauthorized", "Invalid agent API key", nil)
			c.Abort()
			return
		}

		c.Set(platformlog.ContextKeyActorType, platformlog.ActorTypeAgentAdmin)
		c.Set(platformlog.ContextKeyActorAgentID, identity.ID)
		c.Set(platformlog.ContextKeyOwnerUserID, identity.OwnerUserID)
		c.Set(platformlog.ContextKeyAgentAccountID, identity.ID)
		c.Set(platformlog.ContextKeyAgentScopes, identity.Permissions)
		c.Set("agentAdminIdentity", identity)
		c.Next()
	}
}

func RequireAgentPermission(permission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		rawIdentity, exists := c.Get("agentAdminIdentity")
		if !exists {
			agentError(c, http.StatusUnauthorized, "unauthorized", "Agent identity missing", nil)
			c.Abort()
			return
		}
		identity, ok := rawIdentity.(*agentadmin.AuthenticatedAgent)
		if !ok || !agentadmin.NewService(database.GetDB()).HasPermission(identity, permission) {
			agentError(c, http.StatusForbidden, "forbidden", "Agent permission denied", map[string]any{
				"required_permission": permission,
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

func agentError(c *gin.Context, status int, code string, message string, details map[string]any) {
	payload := gin.H{
		"code":           code,
		"message":        message,
		"details":        details,
		"correlation_id": platformlog.CorrelationIDFromGin(c).String(),
	}
	c.JSON(status, payload)
}
