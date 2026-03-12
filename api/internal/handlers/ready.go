package handlers

import (
	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/gin-gonic/gin"
	"net/http"
)

// ReadyHandler checks if the service is ready to receive traffic (e.g., DB reachable).
func ReadyHandler(c *gin.Context) {
	if database.GetDB() == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status":  "not_ready",
			"message": "database not initialized",
		})
		return
	}

	if !database.IsReady() {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status":  "not_ready",
			"message": "database not reachable",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "ready",
	})
}
