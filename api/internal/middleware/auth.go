package middleware

import (
	"context"
	"database/sql"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/TimLai666/surtopya-api/internal/policy"
	"github.com/TimLai666/surtopya-api/internal/repository"
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

		cfg := LoadJWTConfigFromEnv()
		claims, err := ParseJWTClaims(tokenString, cfg)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
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

		if _, err := policy.NewService(database.GetDB()).ExpireMembershipIfNeeded(context.Background(), userID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to evaluate membership expiry"})
			c.Abort()
			return
		}

		maybeGrantProMonthlyPoints(userID)

		_, _ = EnsureSuperAdmin(userID)

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
		email := getClaimString(claims, "email")
		name := getClaimString(claims, "name", "preferred_username", "username", "nickname")
		picture := getClaimString(claims, "picture", "avatar")
		_, _ = db.Exec(`
			UPDATE users
			SET email = COALESCE(email, $2),
			    display_name = COALESCE(display_name, $3),
			    avatar_url = COALESCE(avatar_url, $4)
			WHERE id = $1
		`, userID, nullString(email), nullString(name), nullString(picture))
		_ = policy.NewService(db).EnsureUserMembership(context.Background(), userID)
		return userID, nil
	}

	if err != sql.ErrNoRows {
		return uuid.Nil, err
	}

	// Create new user
	userID = uuid.New()
	email := getClaimString(claims, "email")
	name := getClaimString(claims, "name", "preferred_username", "username", "nickname")
	picture := getClaimString(claims, "picture", "avatar")

	_, err = db.Exec(`
		INSERT INTO users (id, logto_user_id, email, display_name, avatar_url)
		VALUES ($1, $2, $3, $4, $5)
	`, userID, logtoUserID, nullString(email), nullString(name), nullString(picture))

	if err != nil {
		return uuid.Nil, err
	}

	if err := policy.NewService(db).EnsureUserMembership(context.Background(), userID); err != nil {
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

func getClaimString(claims jwt.MapClaims, keys ...string) string {
	for _, key := range keys {
		if value, ok := claims[key].(string); ok && value != "" {
			return value
		}
	}
	return ""
}

func maybeGrantProMonthlyPoints(userID uuid.UUID) {
	amount := parseIntEnv("PRO_MONTHLY_POINTS")
	if amount <= 0 {
		return
	}

	db := database.GetDB()
	tx, err := db.Begin()
	if err != nil {
		return
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	repo := repository.NewPointsRepository(db)
	_, err = repo.GrantProMonthlyPointsIfEligibleTx(tx, userID, amount, time.Now().UTC(), "")
	if err != nil {
		return
	}

	if err := tx.Commit(); err != nil {
		return
	}
	committed = true
}

func parseIntEnv(key string) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return 0
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return 0
	}
	return v
}

// CORSMiddleware handles CORS headers
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		allowed := parseAllowedOriginsFromEnv()
		requestOrigin := c.GetHeader("Origin")

		allowAll := len(allowed) == 0 && !isProductionEnv()

		if requestOrigin != "" {
			if allowAll {
				// Wildcard is OK only when we don't allow credentials.
				c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
			} else {
				if _, ok := allowed[requestOrigin]; !ok {
					if c.Request.Method == "OPTIONS" {
						c.AbortWithStatus(http.StatusForbidden)
						return
					}
					// Not a browser preflight; continue without CORS headers.
					c.Next()
					return
				}

				c.Writer.Header().Set("Access-Control-Allow-Origin", requestOrigin)
				c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
			}

			c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
			c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")
		}

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

func parseAllowedOriginsFromEnv() map[string]struct{} {
	origins := os.Getenv("ALLOWED_ORIGINS")
	if origins == "" {
		return map[string]struct{}{}
	}

	set := map[string]struct{}{}
	for _, part := range strings.Split(origins, ",") {
		o := strings.TrimSpace(part)
		if o == "" {
			continue
		}
		set[o] = struct{}{}
	}
	return set
}
