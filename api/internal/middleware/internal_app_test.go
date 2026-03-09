package middleware

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func signHeadersForTest(secret string, method string, path string, timestamp string, body string) (string, string) {
	canonical := buildInternalAppCanonicalString(method, path, timestamp, []byte(body))
	signature := signInternalAppCanonical(secret, canonical)
	return timestamp, signature
}

func TestRequireInternalApp_MissingSignature(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setEnv(t, "INTERNAL_APP_SIGNING_SECRET", "test-secret")

	r := gin.New()
	r.Use(RequireInternalApp())
	r.POST("/api/app/test", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodPost, "/api/app/test", strings.NewReader(`{"x":1}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestRequireInternalApp_ExpiredTimestamp(t *testing.T) {
	gin.SetMode(gin.TestMode)
	secret := "test-secret"
	setEnv(t, "INTERNAL_APP_SIGNING_SECRET", secret)

	r := gin.New()
	r.Use(RequireInternalApp())
	r.POST("/api/app/test", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	body := `{"x":1}`
	timestamp := fmt.Sprintf("%d", time.Now().Add(-10*time.Minute).Unix())
	_, signature := signHeadersForTest(secret, http.MethodPost, "/api/app/test", timestamp, body)

	req := httptest.NewRequest(http.MethodPost, "/api/app/test", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(internalAppTimestampHeader, timestamp)
	req.Header.Set(internalAppSignatureHeader, signature)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestRequireInternalApp_InvalidSignature(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setEnv(t, "INTERNAL_APP_SIGNING_SECRET", "test-secret")

	r := gin.New()
	r.Use(RequireInternalApp())
	r.POST("/api/app/test", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	timestamp := fmt.Sprintf("%d", time.Now().Unix())
	req := httptest.NewRequest(http.MethodPost, "/api/app/test", strings.NewReader(`{"x":1}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(internalAppTimestampHeader, timestamp)
	req.Header.Set(internalAppSignatureHeader, "bad-signature")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestRequireInternalApp_ValidSignatureAndBodyPreserved(t *testing.T) {
	gin.SetMode(gin.TestMode)
	secret := "test-secret"
	setEnv(t, "INTERNAL_APP_SIGNING_SECRET", secret)

	r := gin.New()
	r.Use(RequireInternalApp())
	r.POST("/api/app/test", func(c *gin.Context) {
		body, err := io.ReadAll(c.Request.Body)
		require.NoError(t, err)
		c.JSON(http.StatusOK, gin.H{"body": string(body)})
	})

	body := `{"x":1}`
	timestamp := fmt.Sprintf("%d", time.Now().Unix())
	_, signature := signHeadersForTest(secret, http.MethodPost, "/api/app/test", timestamp, body)

	req := httptest.NewRequest(http.MethodPost, "/api/app/test", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(internalAppTimestampHeader, timestamp)
	req.Header.Set(internalAppSignatureHeader, signature)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var payload map[string]string
	err := json.Unmarshal(w.Body.Bytes(), &payload)
	require.NoError(t, err)
	require.Equal(t, body, payload["body"])
}
