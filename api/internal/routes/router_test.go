package routes

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func signInternalAppRequest(secret string, method string, path string, timestamp string, body string) string {
	bodyDigest := sha256.Sum256([]byte(body))
	canonical := strings.Join([]string{
		strings.ToUpper(method),
		path,
		timestamp,
		hex.EncodeToString(bodyDigest[:]),
	}, "\n")
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(canonical))
	return hex.EncodeToString(mac.Sum(nil))
}

func TestSetupRouter_InternalAppRouteUsesUnversionedPrefix(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("INTERNAL_APP_SIGNING_SECRET", "route-test-secret")

	r := SetupRouter()
	body := "{}"
	timestamp := fmt.Sprintf("%d", time.Now().Unix())
	signature := signInternalAppRequest(
		"route-test-secret",
		http.MethodPost,
		"/api/app/responses/forfeit-anonymous-points",
		timestamp,
		body,
	)

	newReq := httptest.NewRequest(http.MethodPost, "/api/app/responses/forfeit-anonymous-points", strings.NewReader(body))
	newReq.Header.Set("Content-Type", "application/json")
	newReq.Header.Set("X-Surtopya-App-Timestamp", timestamp)
	newReq.Header.Set("X-Surtopya-App-Signature", signature)
	newRes := httptest.NewRecorder()
	r.ServeHTTP(newRes, newReq)

	require.Equal(t, http.StatusBadRequest, newRes.Code)

	oldReq := httptest.NewRequest(http.MethodPost, "/api/v1/app/responses/forfeit-anonymous-points", strings.NewReader(body))
	oldReq.Header.Set("Content-Type", "application/json")
	oldReq.Header.Set("X-Surtopya-App-Timestamp", timestamp)
	oldReq.Header.Set("X-Surtopya-App-Signature", signature)
	oldRes := httptest.NewRecorder()
	r.ServeHTTP(oldRes, oldReq)

	require.Equal(t, http.StatusNotFound, oldRes.Code)
}
