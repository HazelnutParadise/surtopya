package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestRequireDBReady_BlocksUnavailableV1Route(t *testing.T) {
	gin.SetMode(gin.TestMode)

	prev := database.DB
	database.DB = nil
	t.Cleanup(func() { database.DB = prev })

	r := gin.New()
	r.Use(RequireDBReady())
	r.GET("/api/v1/me", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusServiceUnavailable, w.Code)
	require.Contains(t, w.Body.String(), serviceUnavailableErrorCode)
}

func TestRequireDBReady_AllowsHealthWhenUnavailable(t *testing.T) {
	gin.SetMode(gin.TestMode)

	prev := database.DB
	database.DB = nil
	t.Cleanup(func() { database.DB = prev })

	r := gin.New()
	r.Use(RequireDBReady())
	r.GET("/api/v1/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "up"})
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
}

func TestRequireDBReady_AllowsReadyDatabase(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })
	mock.ExpectPing()

	prev := database.DB
	database.DB = db
	t.Cleanup(func() { database.DB = prev })

	r := gin.New()
	r.Use(RequireDBReady())
	r.GET("/api/v1/me", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestRequireDBReady_BlocksUnavailableAppRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)

	prev := database.DB
	database.DB = nil
	t.Cleanup(func() { database.DB = prev })

	r := gin.New()
	r.Use(RequireDBReady())
	r.GET("/api/app/surveys/public", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodGet, "/api/app/surveys/public", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusServiceUnavailable, w.Code)
	require.Contains(t, w.Body.String(), serviceUnavailableErrorCode)
}

func TestRequireDBReady_AllowsAgentAdminWhenUnavailable(t *testing.T) {
	gin.SetMode(gin.TestMode)

	prev := database.DB
	database.DB = nil
	t.Cleanup(func() { database.DB = prev })

	r := gin.New()
	r.Use(RequireDBReady())
	r.GET("/api/v1/agent-admin", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/agent-admin", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
}
