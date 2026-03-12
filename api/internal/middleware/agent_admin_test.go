package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/TimLai666/surtopya-api/internal/agentadmin"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestRequireAgentPermission_DeniesMissingScope(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("agentAdminIdentity", &agentadmin.AuthenticatedAgent{
			Account: agentadmin.Account{
				ID:          uuid.New(),
				OwnerUserID: uuid.New(),
				Permissions: []string{"logs.read"},
			},
			Scopes: map[string]struct{}{
				"logs.read": {},
			},
		})
		c.Next()
	})
	r.GET("/agent", RequireAgentPermission("agents.write"), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodGet, "/agent", nil)
	res := httptest.NewRecorder()

	r.ServeHTTP(res, req)

	require.Equal(t, http.StatusForbidden, res.Code)
	require.Contains(t, res.Body.String(), "required_permission")
}

func TestRequireAgentPermission_DeniesMissingSurveysReadScope(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("agentAdminIdentity", &agentadmin.AuthenticatedAgent{
			Account: agentadmin.Account{
				ID:          uuid.New(),
				OwnerUserID: uuid.New(),
				Permissions: []string{"logs.read"},
			},
			Scopes: map[string]struct{}{
				"logs.read": {},
			},
		})
		c.Next()
	})
	r.GET("/analytics", RequireAgentPermission("surveys.read"), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodGet, "/analytics", nil)
	res := httptest.NewRecorder()

	r.ServeHTTP(res, req)

	require.Equal(t, http.StatusForbidden, res.Code)
	require.Contains(t, res.Body.String(), `"required_permission":"surveys.read"`)
}
