package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestHealthHandler(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/health", HealthHandler)

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var payload map[string]string
	err := json.Unmarshal(w.Body.Bytes(), &payload)
	assert.NoError(t, err)
	assert.Equal(t, "up", payload["status"])
	assert.Equal(t, "Surtopya API is running", payload["message"])
}
