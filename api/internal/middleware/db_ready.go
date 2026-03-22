package middleware

import (
	"net/http"
	"strings"

	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/gin-gonic/gin"
)

const serviceUnavailableErrorCode = "service_unavailable"

// RequireDBReady blocks /v1 and /api/app requests when the database is unavailable.
func RequireDBReady() gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Request.URL.Path

		if c.FullPath() == "" {
			c.Next()
			return
		}

		isV1Path := strings.HasPrefix(path, "/v1/")
		isAppPath := strings.HasPrefix(path, "/api/app/")
		if !isV1Path && !isAppPath {
			c.Next()
			return
		}

		if isV1Path && (path == "/v1/health" || path == "/v1/ready" || strings.HasPrefix(path, "/v1/agent-admin")) {
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
