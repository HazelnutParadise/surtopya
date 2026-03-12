package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestUserHandler_GetProfile_IncludesMonthlyGrantFields(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	prev := database.DB
	database.DB = db
	t.Cleanup(func() { database.DB = prev })

	userID := uuid.New()
	nextGrant := time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC)
	createdAt := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)

	mock.ExpectQuery("SELECT email, display_name, avatar_url, phone, bio, location,\\s+points_balance, pro_points_next_grant_at, is_admin, is_super_admin, locale, created_at\\s+FROM users WHERE id = \\$1").
		WithArgs(userID).
		WillReturnRows(sqlmock.NewRows([]string{
			"email",
			"display_name",
			"avatar_url",
			"phone",
			"bio",
			"location",
			"points_balance",
			"pro_points_next_grant_at",
			"is_admin",
			"is_super_admin",
			"locale",
			"created_at",
		}).AddRow(
			"user@example.com",
			"User",
			nil,
			nil,
			nil,
			nil,
			120,
			nextGrant,
			false,
			true,
			"en",
			createdAt,
		))

	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM responses WHERE user_id = \\$1 AND status = 'completed'").
		WithArgs(userID).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(8))

	mock.ExpectExec("INSERT INTO user_memberships").
		WithArgs(userID, "free").
		WillReturnResult(sqlmock.NewResult(0, 1))

	mock.ExpectQuery("SELECT\\s+COALESCE\\(mt.code, \\$2\\) AS tier_code,\\s+um.period_end_at,\\s+COALESCE\\(um.is_permanent, true\\) AS is_permanent\\s+FROM user_memberships um\\s+LEFT JOIN membership_tiers mt ON mt.id = um.tier_id\\s+WHERE um.user_id = \\$1").
		WithArgs(userID, "free").
		WillReturnRows(sqlmock.NewRows([]string{"tier_code", "period_end_at", "is_permanent"}).AddRow("pro", nil, true))

	mock.ExpectQuery("FROM capabilities c").
		WithArgs(userID).
		WillReturnRows(sqlmock.NewRows([]string{"key", "is_allowed"}).AddRow("survey.public_dataset_opt_out", true))

	mock.ExpectQuery("SELECT COALESCE\\(monthly_points_grant, 0\\)\\s+FROM membership_tiers\\s+WHERE code = \\$1").
		WithArgs("pro").
		WillReturnRows(sqlmock.NewRows([]string{"monthly_points_grant"}).AddRow(100))

	r := gin.New()
	handler := NewUserHandler()
	r.GET("/api/v1/me", func(c *gin.Context) {
		c.Set("userID", userID)
		handler.GetProfile(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	var payload map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &payload))
	require.Equal(t, float64(120), payload["pointsBalance"])
	require.Equal(t, float64(100), payload["monthlyPointsGrant"])
	require.Equal(t, nextGrant.Format(time.RFC3339), payload["nextMonthlyPointsGrantAt"])

	require.NoError(t, mock.ExpectationsWereMet())
}

func TestUserHandler_GetProfile_ClearsNextGrantWhenMonthlyGrantDisabled(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	prev := database.DB
	database.DB = db
	t.Cleanup(func() { database.DB = prev })

	userID := uuid.New()
	nextGrant := time.Date(2026, 4, 1, 0, 0, 0, 0, time.UTC)
	createdAt := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)

	mock.ExpectQuery("SELECT email, display_name, avatar_url, phone, bio, location,\\s+points_balance, pro_points_next_grant_at, is_admin, is_super_admin, locale, created_at\\s+FROM users WHERE id = \\$1").
		WithArgs(userID).
		WillReturnRows(sqlmock.NewRows([]string{
			"email",
			"display_name",
			"avatar_url",
			"phone",
			"bio",
			"location",
			"points_balance",
			"pro_points_next_grant_at",
			"is_admin",
			"is_super_admin",
			"locale",
			"created_at",
		}).AddRow(
			"user@example.com",
			"User",
			nil,
			nil,
			nil,
			nil,
			12,
			nextGrant,
			false,
			true,
			"en",
			createdAt,
		))

	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM responses WHERE user_id = \\$1 AND status = 'completed'").
		WithArgs(userID).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	mock.ExpectExec("INSERT INTO user_memberships").
		WithArgs(userID, "free").
		WillReturnResult(sqlmock.NewResult(0, 1))

	mock.ExpectQuery("SELECT\\s+COALESCE\\(mt.code, \\$2\\) AS tier_code,\\s+um.period_end_at,\\s+COALESCE\\(um.is_permanent, true\\) AS is_permanent\\s+FROM user_memberships um\\s+LEFT JOIN membership_tiers mt ON mt.id = um.tier_id\\s+WHERE um.user_id = \\$1").
		WithArgs(userID, "free").
		WillReturnRows(sqlmock.NewRows([]string{"tier_code", "period_end_at", "is_permanent"}).AddRow("free", nil, true))

	mock.ExpectQuery("FROM capabilities c").
		WithArgs(userID).
		WillReturnRows(sqlmock.NewRows([]string{"key", "is_allowed"}).AddRow("survey.public_dataset_opt_out", false))

	mock.ExpectQuery("SELECT COALESCE\\(monthly_points_grant, 0\\)\\s+FROM membership_tiers\\s+WHERE code = \\$1").
		WithArgs("free").
		WillReturnRows(sqlmock.NewRows([]string{"monthly_points_grant"}).AddRow(0))

	r := gin.New()
	handler := NewUserHandler()
	r.GET("/api/v1/me", func(c *gin.Context) {
		c.Set("userID", userID)
		handler.GetProfile(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)

	var payload map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &payload))
	require.Equal(t, float64(0), payload["monthlyPointsGrant"])
	_, hasNextGrant := payload["nextMonthlyPointsGrantAt"]
	require.False(t, hasNextGrant)

	require.NoError(t, mock.ExpectationsWereMet())
}
