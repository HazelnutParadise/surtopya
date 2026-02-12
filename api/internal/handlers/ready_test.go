package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestReadyHandler_NoDB(t *testing.T) {
	gin.SetMode(gin.TestMode)

	prev := database.DB
	database.DB = nil
	t.Cleanup(func() { database.DB = prev })

	r := gin.New()
	r.GET("/ready", ReadyHandler)

	req := httptest.NewRequest(http.MethodGet, "/ready", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusServiceUnavailable, w.Code)
	require.Contains(t, w.Body.String(), `"status"`)
}

func TestReadyHandler_DBReady(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	mock.ExpectPing()

	prev := database.DB
	database.DB = db
	t.Cleanup(func() { database.DB = prev })

	r := gin.New()
	r.GET("/ready", ReadyHandler)

	req := httptest.NewRequest(http.MethodGet, "/ready", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"ready"`)
	require.NoError(t, mock.ExpectationsWereMet())
}
