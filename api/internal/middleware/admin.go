package middleware

import (
	"net/http"

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
			promoted, err := EnsureSuperAdmin(userID.(uuid.UUID))
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify admin access"})
				c.Abort()
				return
			}
			if promoted {
				c.Next()
				return
			}
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
	db := database.GetDB()
	var isAdmin bool
	err := db.QueryRow("SELECT is_admin FROM users WHERE id = $1", userID).Scan(&isAdmin)
	if err != nil {
		return false, err
	}
	return isAdmin, nil
}

// EnsureSuperAdmin promotes the user to super admin if none exists.
func EnsureSuperAdmin(userID uuid.UUID) (bool, error) {
	db := database.GetDB()
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM users WHERE is_super_admin = true").Scan(&count); err != nil {
		return false, err
	}
	if count > 0 {
		return false, nil
	}

	_, err := db.Exec("UPDATE users SET is_admin = true, is_super_admin = true WHERE id = $1", userID)
	if err != nil {
		return false, err
	}
	return true, nil
}
