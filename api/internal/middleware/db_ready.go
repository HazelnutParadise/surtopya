package middleware

import (
	"net/http"
	"strings"

	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/gin-gonic/gin"
)

const serviceUnavailableErrorCode = "service_unavailable"

// RequireDBReady blocks /api/v1 requests when the database is unavailable.
func RequireDBReady() gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Request.URL.Path

		if c.FullPath() == "" {
			c.Next()
			return
		}

		if !strings.HasPrefix(path, "/api/v1/") {
			c.Next()
			return
		}

		if path == "/api/v1/health" || path == "/api/v1/ready" || strings.HasPrefix(path, "/api/v1/agent-admin") {
			c.Next()
			return
		}

		if !database.IsReady() {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": serviceUnavailableErrorCode})
			c.Abort()
			return
		}

		c.Next()
	}
}
