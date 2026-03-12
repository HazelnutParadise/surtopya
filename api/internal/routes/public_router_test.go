package routes

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestSetupPublicRouter_ExposesV1HealthAgentDocsAndDatasetRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := SetupPublicRouter()

	healthReq := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
	healthRes := httptest.NewRecorder()
	r.ServeHTTP(healthRes, healthReq)
	require.Equal(t, http.StatusOK, healthRes.Code)

	docsReq := httptest.NewRequest(http.MethodGet, "/api/v1/agent-admin", nil)
	docsRes := httptest.NewRecorder()
	r.ServeHTTP(docsRes, docsReq)
	require.Equal(t, http.StatusOK, docsRes.Code)

	datasetsReq := httptest.NewRequest(http.MethodGet, "/api/v1/datasets", nil)
	datasetsRes := httptest.NewRecorder()
	r.ServeHTTP(datasetsRes, datasetsReq)
	require.NotEqual(t, http.StatusNotFound, datasetsRes.Code)
}

func TestSetupPublicRouter_HidesInternalAndLegacyFrontendRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := SetupPublicRouter()

	internalReq := httptest.NewRequest(http.MethodPost, "/api/app/responses/forfeit-anonymous-points", nil)
	internalRes := httptest.NewRecorder()
	r.ServeHTTP(internalRes, internalReq)
	require.Equal(t, http.StatusNotFound, internalRes.Code)

	adminReq := httptest.NewRequest(http.MethodGet, "/api/v1/admin/users", nil)
	adminRes := httptest.NewRecorder()
	r.ServeHTTP(adminRes, adminReq)
	require.Equal(t, http.StatusNotFound, adminRes.Code)

	uiEventsReq := httptest.NewRequest(http.MethodPost, "/api/v1/ui-events", nil)
	uiEventsRes := httptest.NewRecorder()
	r.ServeHTTP(uiEventsRes, uiEventsReq)
	require.Equal(t, http.StatusNotFound, uiEventsRes.Code)

	surveysReq := httptest.NewRequest(http.MethodGet, "/api/v1/surveys/public", nil)
	surveysRes := httptest.NewRecorder()
	r.ServeHTTP(surveysRes, surveysReq)
	require.Equal(t, http.StatusNotFound, surveysRes.Code)

	meReq := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	meRes := httptest.NewRecorder()
	r.ServeHTTP(meRes, meReq)
	require.Equal(t, http.StatusNotFound, meRes.Code)
}

func TestSetupPublicRouter_StillProtectsAgentAuthRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := SetupPublicRouter()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/agent-admin/me", nil)
	res := httptest.NewRecorder()
	r.ServeHTTP(res, req)

	require.Equal(t, http.StatusUnauthorized, res.Code)
}
