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

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/TimLai666/surtopya-api/internal/database"
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

	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })
	mock.ExpectPing()
	prevDB := database.DB
	database.DB = db
	t.Cleanup(func() { database.DB = prevDB })

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
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSetupRouter_InternalAppContainsMovedFrontendRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("INTERNAL_APP_SIGNING_SECRET", "route-test-secret")

	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })
	mock.ExpectPing()
	prevDB := database.DB
	database.DB = db
	t.Cleanup(func() { database.DB = prevDB })

	r := SetupRouter()
	body := ""
	timestamp := fmt.Sprintf("%d", time.Now().Unix())

	configSignature := signInternalAppRequest(
		"route-test-secret",
		http.MethodGet,
		"/api/app/config",
		timestamp,
		body,
	)

	configReq := httptest.NewRequest(http.MethodGet, "/api/app/config", nil)
	configReq.Header.Set("X-Surtopya-App-Timestamp", timestamp)
	configReq.Header.Set("X-Surtopya-App-Signature", configSignature)
	configRes := httptest.NewRecorder()
	r.ServeHTTP(configRes, configReq)
	require.NotEqual(t, http.StatusNotFound, configRes.Code)

	adminSignature := signInternalAppRequest(
		"route-test-secret",
		http.MethodGet,
		"/api/app/admin/users",
		timestamp,
		body,
	)

	adminReq := httptest.NewRequest(http.MethodGet, "/api/app/admin/users", nil)
	adminReq.Header.Set("X-Surtopya-App-Timestamp", timestamp)
	adminReq.Header.Set("X-Surtopya-App-Signature", adminSignature)
	adminRes := httptest.NewRecorder()
	r.ServeHTTP(adminRes, adminReq)
	require.Equal(t, http.StatusUnauthorized, adminRes.Code)

	oldReq := httptest.NewRequest(http.MethodGet, "/api/v1/config", nil)
	oldRes := httptest.NewRecorder()
	r.ServeHTTP(oldRes, oldReq)
	require.Equal(t, http.StatusNotFound, oldRes.Code)
	require.NoError(t, mock.ExpectationsWereMet())
}
