package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// RequireAdmin ensures the current user is an admin.
func RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			c.Abort()
			return
		}

		isAdmin, err := IsAdminUser(userID.(uuid.UUID))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify admin access"})
			c.Abort()
			return
		}
		if !isAdmin {
			c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
			c.Abort()
			return
		}

		c.Next()
	}
}

// IsAdminUser checks if a user is configured as an admin.
func IsAdminUser(userID uuid.UUID) (bool, error) {
	adminIDs := parseEnvList(os.Getenv("ADMIN_USER_IDS"))
	if len(adminIDs) > 0 {
		for _, id := range adminIDs {
			if id == userID.String() {
				return true, nil
			}
		}
	}

	adminEmails := parseEnvList(os.Getenv("ADMIN_EMAILS"))
	if len(adminEmails) == 0 {
		return false, nil
	}

	db := database.GetDB()
	var email *string
	err := db.QueryRow("SELECT email FROM users WHERE id = $1", userID).Scan(&email)
	if err != nil {
		return false, err
	}
	if email == nil {
		return false, nil
	}

	candidate := strings.ToLower(strings.TrimSpace(*email))
	for _, adminEmail := range adminEmails {
		if candidate == adminEmail {
			return true, nil
		}
	}

	return false, nil
}

func parseEnvList(value string) []string {
	if value == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.ToLower(strings.TrimSpace(part))
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}
