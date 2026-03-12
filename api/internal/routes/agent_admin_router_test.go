package routes

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestSetupRouter_AgentAdminUsageIndexIsPublicAndReturnsDocs(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := SetupRouter()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/agent-admin", nil)
	res := httptest.NewRecorder()

	r.ServeHTTP(res, req)

	require.Equal(t, http.StatusOK, res.Code)
	require.NotEmpty(t, res.Header().Get("X-Correlation-Id"))

	var payload map[string]any
	require.NoError(t, json.Unmarshal(res.Body.Bytes(), &payload))

	require.Equal(t, "agent_admin_api", payload["kind"])
	require.Equal(t, "/api/v1/agent-admin/openapi.json", payload["openapi_url"])

	auth, ok := payload["auth"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "bearer_api_key", auth["type"])
}

func TestSetupRouter_AgentAdminUsageIndexAdvertisesSurveyAnalyticsEndpoint(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := SetupRouter()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/agent-admin", nil)
	res := httptest.NewRecorder()

	r.ServeHTTP(res, req)

	require.Equal(t, http.StatusOK, res.Code)

	var payload map[string]any
	require.NoError(t, json.Unmarshal(res.Body.Bytes(), &payload))

	scopeEndpoints, ok := payload["scope_endpoints"].(map[string]any)
	require.True(t, ok)
	surveysRead, ok := scopeEndpoints["surveys.read"].([]any)
	require.True(t, ok)
	require.Contains(t, surveysRead, "GET /api/v1/agent-admin/surveys/:id/responses/analytics")
}
