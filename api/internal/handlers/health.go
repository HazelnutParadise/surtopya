package handlers

import (
	"github.com/gin-gonic/gin"
	"net/http"
)

// HealthHandler returns a simple status message
func HealthHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "up",
		"message": "Surtopya API is running",
	})
}
