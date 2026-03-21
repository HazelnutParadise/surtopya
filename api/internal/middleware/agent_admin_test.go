package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/TimLai666/surtopya-api/internal/agentadmin"
	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/TimLai666/surtopya-api/internal/platformlog"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestRequireAgentAdmin_DeniesNonAdminOwner(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	prevDB := database.DB
	database.DB = db
	t.Cleanup(func() { database.DB = prevDB })

	ownerID := uuid.New()
	agentID := uuid.New()

	prevAuthenticate := authenticateAgentAdmin
	authenticateAgentAdmin = func(_ context.Context, _ string) (*agentadmin.AuthenticatedAgent, error) {
		return &agentadmin.AuthenticatedAgent{
			Account: agentadmin.Account{
				ID:                agentID,
				OwnerUserID:       ownerID,
				OwnerIsSuperAdmin: false,
			},
			Scopes: map[string]struct{}{},
		}, nil
	}
	t.Cleanup(func() { authenticateAgentAdmin = prevAuthenticate })

	mock.ExpectQuery("SELECT \\(is_admin = TRUE OR is_super_admin = TRUE\\) FROM users WHERE id = \\$1").
		WithArgs(ownerID).
		WillReturnRows(sqlmock.NewRows([]string{"allowed"}).AddRow(false))

	r := gin.New()
	r.GET("/agent", RequireAgentAdmin(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodGet, "/agent", nil)
	req.Header.Set("Authorization", "Bearer test-key")
	res := httptest.NewRecorder()

	r.ServeHTTP(res, req)

	require.Equal(t, http.StatusForbidden, res.Code)
	require.Contains(t, res.Body.String(), `"code":"forbidden"`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestRequireAgentAdmin_AllowsAdminOwnerAndSetsContext(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	prevDB := database.DB
	database.DB = db
	t.Cleanup(func() { database.DB = prevDB })

	ownerID := uuid.New()
	agentID := uuid.New()

	prevAuthenticate := authenticateAgentAdmin
	authenticateAgentAdmin = func(_ context.Context, _ string) (*agentadmin.AuthenticatedAgent, error) {
		return &agentadmin.AuthenticatedAgent{
			Account: agentadmin.Account{
				ID:                agentID,
				OwnerUserID:       ownerID,
				OwnerIsSuperAdmin: false,
				Permissions:       []string{"logs.read"},
			},
			Scopes: map[string]struct{}{
				"logs.read": {},
			},
		}, nil
	}
	t.Cleanup(func() { authenticateAgentAdmin = prevAuthenticate })

	mock.ExpectQuery("SELECT \\(is_admin = TRUE OR is_super_admin = TRUE\\) FROM users WHERE id = \\$1").
		WithArgs(ownerID).
		WillReturnRows(sqlmock.NewRows([]string{"allowed"}).AddRow(true))

	r := gin.New()
	r.GET("/agent", RequireAgentAdmin(), func(c *gin.Context) {
		rawUserID, ok := c.Get("userID")
		require.True(t, ok)
		require.Equal(t, ownerID, rawUserID)

		rawActorType, ok := c.Get(platformlog.ContextKeyActorType)
		require.True(t, ok)
		require.Equal(t, platformlog.ActorTypeAgentAdmin, rawActorType)

		rawOwnerUserID, ok := c.Get(platformlog.ContextKeyOwnerUserID)
		require.True(t, ok)
		require.Equal(t, ownerID, rawOwnerUserID)

		rawIdentity, ok := c.Get("agentAdminIdentity")
		require.True(t, ok)
		identity, ok := rawIdentity.(*agentadmin.AuthenticatedAgent)
		require.True(t, ok)
		require.Equal(t, agentID, identity.ID)

		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodGet, "/agent", nil)
	req.Header.Set("Authorization", "Bearer test-key")
	res := httptest.NewRecorder()

	r.ServeHTTP(res, req)

	require.Equal(t, http.StatusNoContent, res.Code)
	require.NoError(t, mock.ExpectationsWereMet())
}

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

func TestRequireAgentPermission_DeniesMissingExtendedScopes(t *testing.T) {
	gin.SetMode(gin.TestMode)

	requiredPermissions := []string{
		"surveys.write",
		"datasets.read",
		"datasets.write",
		"users.read",
		"users.write",
		"policies.read",
		"policies.write",
		"plans.read",
		"plans.write",
		"system.read",
		"system.write",
	}

	for _, permission := range requiredPermissions {
		t.Run(permission, func(t *testing.T) {
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
			r.GET("/resource", RequireAgentPermission(permission), func(c *gin.Context) {
				c.Status(http.StatusNoContent)
			})

			req := httptest.NewRequest(http.MethodGet, "/resource", nil)
			res := httptest.NewRecorder()
			r.ServeHTTP(res, req)

			require.Equal(t, http.StatusForbidden, res.Code)
			require.Contains(t, res.Body.String(), `"required_permission":"`+permission+`"`)
		})
	}
}
