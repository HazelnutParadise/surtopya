package middleware

import (
	"database/sql"
	"net/http"
	"os"
	"strings"

	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// AuthMiddleware validates JWT tokens from Logto
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next() // Allow unauthenticated access for public endpoints
			return
		}

		// Extract token from "Bearer <token>"
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization header"})
			c.Abort()
			return
		}

		tokenString := parts[1]

		// Parse and validate token
		// Note: In production, you should validate with Logto's JWKS
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			// For Logto, you would typically use the JWKS endpoint
			// This is a simplified version - use proper key validation in production
			jwtSecret := os.Getenv("JWT_SECRET")
			if jwtSecret == "" {
				jwtSecret = "development-secret-key"
			}
			return []byte(jwtSecret), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		// Extract claims
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			c.Abort()
			return
		}

		// Get Logto user ID from "sub" claim
		logtoUserID, ok := claims["sub"].(string)
		if !ok || logtoUserID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID in token"})
			c.Abort()
			return
		}

		// Get or create user in our database
		userID, err := getOrCreateUser(logtoUserID, claims)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
			c.Abort()
			return
		}

		// Set user ID in context
		c.Set("userID", userID)
		c.Set("logtoUserID", logtoUserID)

		c.Next()
	}
}

// RequireAuth middleware that requires authentication
func RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		_, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// getOrCreateUser gets or creates a user based on Logto user ID
func getOrCreateUser(logtoUserID string, claims jwt.MapClaims) (uuid.UUID, error) {
	db := database.GetDB()

	// Try to find existing user
	var userID uuid.UUID
	err := db.QueryRow(
		"SELECT id FROM users WHERE logto_user_id = $1",
		logtoUserID,
	).Scan(&userID)

	if err == nil {
		return userID, nil
	}

	if err != sql.ErrNoRows {
		return uuid.Nil, err
	}

	// Create new user
	userID = uuid.New()
	email, _ := claims["email"].(string)
	name, _ := claims["name"].(string)
	picture, _ := claims["picture"].(string)

	_, err = db.Exec(`
		INSERT INTO users (id, logto_user_id, email, display_name, avatar_url)
		VALUES ($1, $2, $3, $4, $5)
	`, userID, logtoUserID, nullString(email), nullString(name), nullString(picture))

	if err != nil {
		return uuid.Nil, err
	}

	return userID, nil
}

func nullString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// CORSMiddleware handles CORS headers
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := os.Getenv("ALLOWED_ORIGIN")
		if origin == "" {
			origin = "*"
		}

		c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
