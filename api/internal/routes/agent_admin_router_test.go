package routes

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/TimLai666/surtopya-api/internal/agentadmin"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestSetupRouter_AgentAdminUsageIndexIsPublicAndReturnsDocs(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := SetupRouter()
	req := httptest.NewRequest(http.MethodGet, "/v1/agent-admin", nil)
	res := httptest.NewRecorder()

	r.ServeHTTP(res, req)

	require.Equal(t, http.StatusOK, res.Code)
	require.NotEmpty(t, res.Header().Get("X-Correlation-Id"))

	var payload map[string]any
	require.NoError(t, json.Unmarshal(res.Body.Bytes(), &payload))

	require.Equal(t, "agent_admin_api", payload["kind"])
	require.Equal(t, "/v1/agent-admin/openapi.json", payload["openapi_url"])

	auth, ok := payload["auth"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "bearer_api_key", auth["type"])
}

func TestSetupRouter_AgentAdminUsageIndexAdvertisesSurveyAnalyticsEndpoint(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := SetupRouter()
	req := httptest.NewRequest(http.MethodGet, "/v1/agent-admin", nil)
	res := httptest.NewRecorder()

	r.ServeHTTP(res, req)

	require.Equal(t, http.StatusOK, res.Code)

	var payload map[string]any
	require.NoError(t, json.Unmarshal(res.Body.Bytes(), &payload))

	scopeEndpoints, ok := payload["scope_endpoints"].(map[string]any)
	require.True(t, ok)
	surveysRead, ok := scopeEndpoints["surveys.read"].([]any)
	require.True(t, ok)
	require.Contains(t, surveysRead, "GET /v1/agent-admin/surveys/:id/responses/analytics")
	require.Contains(t, surveysRead, "GET /v1/agent-admin/surveys/:id/responses")
}

func TestSetupRouter_AgentAdminUsageIndexAdvertisesDeidEndpointsInDeidScopes(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := SetupRouter()
	req := httptest.NewRequest(http.MethodGet, "/v1/agent-admin", nil)
	res := httptest.NewRecorder()

	r.ServeHTTP(res, req)

	require.Equal(t, http.StatusOK, res.Code)

	var payload map[string]any
	require.NoError(t, json.Unmarshal(res.Body.Bytes(), &payload))

	scopeEndpoints, ok := payload["scope_endpoints"].(map[string]any)
	require.True(t, ok)

	deidRead, ok := scopeEndpoints["deid.read"].([]any)
	require.True(t, ok)
	require.Contains(t, deidRead, "GET /v1/agent-admin/deid")
	require.Contains(t, deidRead, "GET /v1/agent-admin/deid/sessions/:session_id")

	deidWrite, ok := scopeEndpoints["deid.write"].([]any)
	require.True(t, ok)
	require.Contains(t, deidWrite, "POST /v1/agent-admin/deid/sessions/start")
	require.Contains(t, deidWrite, "POST /v1/agent-admin/deid/sessions/:session_id/chunks/:chunk_index/annotate")
}

func TestSetupRouter_AgentAdminUsageIndexAdvertisesAllPermissionEndpoints(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := SetupRouter()
	req := httptest.NewRequest(http.MethodGet, "/v1/agent-admin", nil)
	res := httptest.NewRecorder()

	r.ServeHTTP(res, req)

	require.Equal(t, http.StatusOK, res.Code)

	var payload map[string]any
	require.NoError(t, json.Unmarshal(res.Body.Bytes(), &payload))

	scopeEndpoints, ok := payload["scope_endpoints"].(map[string]any)
	require.True(t, ok)

	for _, permission := range agentadmin.AllPermissions {
		rawEndpoints, exists := scopeEndpoints[permission]
		require.Truef(t, exists, "missing permission key in usage index: %s", permission)
		endpoints, ok := rawEndpoints.([]any)
		require.Truef(t, ok, "invalid endpoint list type for permission: %s", permission)
		require.NotEmptyf(t, endpoints, "empty endpoint list for permission: %s", permission)
	}
}

func TestSetupRouter_AgentAdminOpenAPIDocIncludesExtendedPaths(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := SetupRouter()
	req := httptest.NewRequest(http.MethodGet, "/v1/agent-admin/openapi.json", nil)
	res := httptest.NewRecorder()

	r.ServeHTTP(res, req)

	require.Equal(t, http.StatusOK, res.Code)

	var payload map[string]any
	require.NoError(t, json.Unmarshal(res.Body.Bytes(), &payload))

	paths, ok := payload["paths"].(map[string]any)
	require.True(t, ok)

	require.Contains(t, paths, "/users/points-adjust")
	require.Contains(t, paths, "/users/{id}")
	require.Contains(t, paths, "/subscription-plans")
	require.Contains(t, paths, "/system-settings")
	require.Contains(t, paths, "/logs/{id}")
	require.Contains(t, paths, "/surveys/{id}/responses")

	deidPath, ok := paths["/deid"].(map[string]any)
	require.True(t, ok)
	deidGet, ok := deidPath["get"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "deid.read", deidGet["x-required-permission"])

	annotatePath, ok := paths["/deid/sessions/{session_id}/chunks/{chunk_index}/annotate"].(map[string]any)
	require.True(t, ok)
	annotatePost, ok := annotatePath["post"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "deid.write", annotatePost["x-required-permission"])
}

func TestSetupRouter_AgentAdminExtendedRoutesAreRegistered(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := SetupRouter()

	testCases := []struct {
		method string
		path   string
	}{
		{method: http.MethodGet, path: "/v1/agent-admin/surveys"},
		{method: http.MethodPatch, path: "/v1/agent-admin/surveys/00000000-0000-0000-0000-000000000000"},
		{method: http.MethodGet, path: "/v1/agent-admin/datasets"},
		{method: http.MethodGet, path: "/v1/agent-admin/surveys/00000000-0000-0000-0000-000000000000/responses"},
		{method: http.MethodGet, path: "/v1/agent-admin/users/00000000-0000-0000-0000-000000000000"},
		{method: http.MethodPost, path: "/v1/agent-admin/users/points-adjust"},
		{method: http.MethodPatch, path: "/v1/agent-admin/subscription-plans/00000000-0000-0000-0000-000000000000"},
		{method: http.MethodGet, path: "/v1/agent-admin/policies"},
		{method: http.MethodPatch, path: "/v1/agent-admin/capabilities/00000000-0000-0000-0000-000000000000"},
		{method: http.MethodGet, path: "/v1/agent-admin/system-settings"},
	}

	for _, tc := range testCases {
		req := httptest.NewRequest(tc.method, tc.path, nil)
		res := httptest.NewRecorder()
		r.ServeHTTP(res, req)
		require.Contains(t, []int{http.StatusUnauthorized, http.StatusForbidden}, res.Code, "%s %s should be registered", tc.method, tc.path)
	}
}
