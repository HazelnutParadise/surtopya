package handlers

import (
	"bytes"
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

func TestAdminHandler_GetUsers_AppliesFilters(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	database.DB = db
	t.Cleanup(func() { database.DB = nil })

	now := time.Now().UTC()
	mock.ExpectQuery("FROM users u").
		WithArgs("%alice%", "pro", true, 20, 0).
		WillReturnRows(sqlmock.NewRows([]string{
			"id",
			"email",
			"display_name",
			"points_balance",
			"membership_tier",
			"period_end_at",
			"membership_is_permanent",
			"is_admin",
			"is_super_admin",
			"is_disabled",
			"created_at",
		}).AddRow(uuid.New(), "alice@example.com", "Alice", 88, "pro", nil, true, true, false, true, now))

	h := NewAdminHandler()
	r := gin.New()
	r.GET("/admin/users", h.GetUsers)

	req := httptest.NewRequest(http.MethodGet, "/admin/users?search=alice&role=admin&membership_tier=pro&is_disabled=true&limit=20&offset=0", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"isDisabled":true`)
	require.Contains(t, w.Body.String(), `"pointsBalance":88`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestAdminHandler_UpdateUser_CanToggleDisabled(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	database.DB = db
	t.Cleanup(func() { database.DB = nil })

	currentUserID := uuid.New()
	targetUserID := uuid.New()

	mock.ExpectQuery("SELECT is_super_admin FROM users WHERE id = \\$1").
		WithArgs(currentUserID).
		WillReturnRows(sqlmock.NewRows([]string{"is_super_admin"}).AddRow(true))
	mock.ExpectQuery("SELECT is_super_admin FROM users WHERE id = \\$1").
		WithArgs(targetUserID).
		WillReturnRows(sqlmock.NewRows([]string{"is_super_admin"}).AddRow(false))
	mock.ExpectExec("UPDATE users SET is_disabled = \\$1 WHERE id = \\$2").
		WithArgs(true, targetUserID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	h := NewAdminHandler()
	r := gin.New()
	r.PATCH("/admin/users/:id", func(c *gin.Context) {
		c.Set("userID", currentUserID)
		h.UpdateUser(c)
	})

	body, err := json.Marshal(map[string]any{
		"isDisabled": true,
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPatch, "/admin/users/"+targetUserID.String(), bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), "User updated")
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestAdminHandler_AdjustUsersPoints_RejectsInvalidPayload(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h := &AdminHandler{}
	r := gin.New()
	currentUserID := uuid.New()
	r.POST("/admin/users/points-adjust", func(c *gin.Context) {
		c.Set("userID", currentUserID)
		h.AdjustUsersPoints(c)
	})

	body, err := json.Marshal(map[string]any{
		"userIds": []string{},
		"delta":   0,
		"reason":  "",
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/admin/users/points-adjust", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusBadRequest, w.Code)
	require.Contains(t, w.Body.String(), "Invalid points adjust payload")
}

func TestAdminHandler_AdjustUsersPoints_InsufficientReturnsConflict(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	database.DB = db
	t.Cleanup(func() { database.DB = nil })

	currentUserID := uuid.New()
	user1 := uuid.New()
	user2 := uuid.New()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT id, points_balance").
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id", "points_balance"}).
			AddRow(user1, 3).
			AddRow(user2, 20))
	mock.ExpectRollback()

	h := NewAdminHandler()
	r := gin.New()
	r.POST("/admin/users/points-adjust", func(c *gin.Context) {
		c.Set("userID", currentUserID)
		h.AdjustUsersPoints(c)
	})

	body, err := json.Marshal(map[string]any{
		"userIds": []string{user1.String(), user2.String()},
		"delta":   -10,
		"reason":  "batch deduction",
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/admin/users/points-adjust", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusConflict, w.Code)
	require.Contains(t, w.Body.String(), `"error":"Insufficient points for one or more users"`)
	require.Contains(t, w.Body.String(), user1.String())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestAdminHandler_AdjustUsersPoints_FloorZeroStrategySucceeds(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	database.DB = db
	t.Cleanup(func() { database.DB = nil })

	currentUserID := uuid.New()
	user1 := uuid.New()
	user2 := uuid.New()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT id, points_balance").
		WithArgs(sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id", "points_balance"}).
			AddRow(user1, 2).
			AddRow(user2, 9))

	mock.ExpectExec("UPDATE users SET points_balance = points_balance \\+ \\$2 WHERE id = \\$1").
		WithArgs(user1, -2).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO points_transactions").
		WithArgs(sqlmock.AnyArg(), user1, -2, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	mock.ExpectExec("UPDATE users SET points_balance = points_balance \\+ \\$2 WHERE id = \\$1").
		WithArgs(user2, -5).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO points_transactions").
		WithArgs(sqlmock.AnyArg(), user2, -5, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))

	mock.ExpectCommit()

	h := NewAdminHandler()
	r := gin.New()
	r.POST("/admin/users/points-adjust", func(c *gin.Context) {
		c.Set("userID", currentUserID)
		h.AdjustUsersPoints(c)
	})

	body, err := json.Marshal(map[string]any{
		"userIds":           []string{user1.String(), user2.String()},
		"delta":             -5,
		"reason":            "batch deduction",
		"underflowStrategy": "floor_zero",
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/admin/users/points-adjust", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Contains(t, w.Body.String(), `"adjustedUsers":2`)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestAdminHandler_SystemSettings_IncludeSignupInitialPoints(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	database.DB = db
	t.Cleanup(func() { database.DB = nil })

	h := NewAdminHandler()

	t.Run("get", func(t *testing.T) {
		mock.ExpectQuery("SELECT value FROM system_settings WHERE key = \\$1").
			WithArgs(surveyBasePointsSettingKey).
			WillReturnRows(sqlmock.NewRows([]string{"value"}).AddRow("3"))
		mock.ExpectQuery("SELECT value FROM system_settings WHERE key = \\$1").
			WithArgs(signupInitialPointsSettingKey).
			WillReturnRows(sqlmock.NewRows([]string{"value"}).AddRow("25"))

		r := gin.New()
		r.GET("/admin/system-settings", h.GetSystemSettings)
		req := httptest.NewRequest(http.MethodGet, "/admin/system-settings", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		require.Equal(t, http.StatusOK, w.Code)
		require.Contains(t, w.Body.String(), `"surveyBasePoints":3`)
		require.Contains(t, w.Body.String(), `"signupInitialPoints":25`)
	})

	t.Run("patch", func(t *testing.T) {
		currentUserID := uuid.New()
		mock.ExpectQuery("SELECT is_super_admin FROM users WHERE id = \\$1").
			WithArgs(currentUserID).
			WillReturnRows(sqlmock.NewRows([]string{"is_super_admin"}).AddRow(true))
		mock.ExpectExec("INSERT INTO system_settings \\(key, value, updated_at\\)").
			WithArgs(surveyBasePointsSettingKey, "5").
			WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectExec("INSERT INTO system_settings \\(key, value, updated_at\\)").
			WithArgs(signupInitialPointsSettingKey, "20").
			WillReturnResult(sqlmock.NewResult(0, 1))
		mock.ExpectQuery("SELECT value FROM system_settings WHERE key = \\$1").
			WithArgs(surveyBasePointsSettingKey).
			WillReturnRows(sqlmock.NewRows([]string{"value"}).AddRow("5"))
		mock.ExpectQuery("SELECT value FROM system_settings WHERE key = \\$1").
			WithArgs(signupInitialPointsSettingKey).
			WillReturnRows(sqlmock.NewRows([]string{"value"}).AddRow("20"))

		r := gin.New()
		r.PATCH("/admin/system-settings", func(c *gin.Context) {
			c.Set("userID", currentUserID)
			h.UpdateSystemSettings(c)
		})
		body, err := json.Marshal(map[string]any{
			"surveyBasePoints":    5,
			"signupInitialPoints": 20,
		})
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodPatch, "/admin/system-settings", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		require.Equal(t, http.StatusOK, w.Code)
		require.Contains(t, w.Body.String(), `"surveyBasePoints":5`)
		require.Contains(t, w.Body.String(), `"signupInitialPoints":20`)
	})

	require.NoError(t, mock.ExpectationsWereMet())
}
