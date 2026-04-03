package middleware

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestExtractClientIP_UsesForwardedPriority(t *testing.T) {
	req, err := http.NewRequest(http.MethodGet, "/v1/agent-admin/logs", nil)
	require.NoError(t, err)
	req.RemoteAddr = "198.51.100.20:443"
	req.Header.Set("CF-Connecting-IP", "203.0.113.10")
	req.Header.Set("X-Forwarded-For", "198.51.100.9, 198.51.100.8")

	clientIP := extractClientIP(req)
	require.NotNil(t, clientIP)
	require.Equal(t, "203.0.113.10", *clientIP)

	req.Header.Del("CF-Connecting-IP")
	clientIP = extractClientIP(req)
	require.NotNil(t, clientIP)
	require.Equal(t, "198.51.100.9", *clientIP)

	req.Header.Del("X-Forwarded-For")
	clientIP = extractClientIP(req)
	require.NotNil(t, clientIP)
	require.Equal(t, "198.51.100.20", *clientIP)
}

func TestInferModuleAndAction_UsesExplicitRouteGroups(t *testing.T) {
	module, action := inferModuleAndAction(http.MethodGet, "/api/app/me", "/api/app/me")
	require.Equal(t, "users", module)
	require.Equal(t, "get.me", action)

	module, action = inferModuleAndAction(http.MethodGet, "/api/app/bootstrap", "/api/app/bootstrap")
	require.Equal(t, "system", module)
	require.Equal(t, "get.bootstrap", action)

	module, action = inferModuleAndAction(http.MethodPost, "/api/app/ui-events", "/api/app/ui-events")
	require.Equal(t, "ui", module)
	require.Equal(t, "post.ui_events", action)
}
