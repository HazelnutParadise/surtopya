package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/gin-gonic/gin"
)

// ReadyHandler checks if the service is ready to receive traffic (e.g., DB reachable).
func ReadyHandler(c *gin.Context) {
	db := database.GetDB()
	if db == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status":  "not_ready",
			"message": "database not initialized",
		})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 1*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
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
