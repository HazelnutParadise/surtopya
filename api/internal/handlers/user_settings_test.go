package handlers

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestUserSettingsHandler_GetSettings_IncludesInitializationFlag(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	userID := uuid.New()
	mock.ExpectQuery("SELECT locale, timezone, settings_auto_initialized_at FROM users WHERE id = \\$1").
		WithArgs(userID).
		WillReturnRows(sqlmock.NewRows([]string{"locale", "timezone", "settings_auto_initialized_at"}).AddRow("en", "Asia/Taipei", nil))

	handler := &UserSettingsHandler{db: db}

	r := gin.New()
	r.GET("/api/v1/me/settings", func(c *gin.Context) {
		c.Set("userID", userID)
		handler.GetSettings(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/me/settings", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.JSONEq(t, `{"locale":"en","timeZone":"Asia/Taipei","settingsAutoInitialized":false}`, w.Body.String())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestUserSettingsHandler_UpdateSettings_AutoInitializeSetsFlagEvenWhenValuesMatchDefaults(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	userID := uuid.New()
	initializedAt := time.Date(2026, time.March, 12, 8, 0, 0, 0, time.UTC)
	mock.ExpectQuery("UPDATE users\\s+SET locale = \\$1, timezone = \\$2, settings_auto_initialized_at = NOW\\(\\)").
		WithArgs("en", "Asia/Taipei", userID).
		WillReturnRows(sqlmock.NewRows([]string{"locale", "timezone", "settings_auto_initialized_at"}).AddRow("en", "Asia/Taipei", initializedAt))

	handler := &UserSettingsHandler{db: db}

	r := gin.New()
	r.PATCH("/api/v1/me/settings", func(c *gin.Context) {
		c.Set("userID", userID)
		handler.UpdateSettings(c)
	})

	req := httptest.NewRequest(http.MethodPatch, "/api/v1/me/settings", bytes.NewBufferString(`{"locale":"en","timeZone":"Asia/Taipei","autoInitialize":true}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.JSONEq(t, `{"locale":"en","timeZone":"Asia/Taipei","settingsAutoInitialized":true}`, w.Body.String())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestUserSettingsHandler_UpdateSettings_AutoInitializeIsNoOpAfterFirstRun(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	userID := uuid.New()
	initializedAt := time.Date(2026, time.March, 12, 9, 0, 0, 0, time.UTC)
	mock.ExpectQuery("UPDATE users\\s+SET locale = \\$1, timezone = \\$2, settings_auto_initialized_at = NOW\\(\\)").
		WithArgs("ja", "Asia/Tokyo", userID).
		WillReturnRows(sqlmock.NewRows([]string{"locale", "timezone", "settings_auto_initialized_at"}))
	mock.ExpectQuery("SELECT locale, timezone, settings_auto_initialized_at FROM users WHERE id = \\$1").
		WithArgs(userID).
		WillReturnRows(sqlmock.NewRows([]string{"locale", "timezone", "settings_auto_initialized_at"}).AddRow("en", "Asia/Taipei", initializedAt))

	handler := &UserSettingsHandler{db: db}

	r := gin.New()
	r.PATCH("/api/v1/me/settings", func(c *gin.Context) {
		c.Set("userID", userID)
		handler.UpdateSettings(c)
	})

	req := httptest.NewRequest(http.MethodPatch, "/api/v1/me/settings", bytes.NewBufferString(`{"locale":"ja","timeZone":"Asia/Tokyo","autoInitialize":true}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.JSONEq(t, `{"locale":"en","timeZone":"Asia/Taipei","settingsAutoInitialized":true}`, w.Body.String())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestUserSettingsHandler_UpdateSettings_ManualUpdatePreservesInitializationFlag(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	userID := uuid.New()
	initializedAt := time.Date(2026, time.March, 12, 10, 0, 0, 0, time.UTC)
	mock.ExpectQuery("UPDATE users SET locale = \\$1, timezone = \\$2 WHERE id = \\$3 RETURNING locale, timezone, settings_auto_initialized_at").
		WithArgs("ja", "Asia/Tokyo", userID).
		WillReturnRows(sqlmock.NewRows([]string{"locale", "timezone", "settings_auto_initialized_at"}).AddRow("ja", "Asia/Tokyo", initializedAt))

	handler := &UserSettingsHandler{db: db}

	r := gin.New()
	r.PATCH("/api/v1/me/settings", func(c *gin.Context) {
		c.Set("userID", userID)
		handler.UpdateSettings(c)
	})

	req := httptest.NewRequest(http.MethodPatch, "/api/v1/me/settings", bytes.NewBufferString(`{"locale":"ja","timeZone":"Asia/Tokyo"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.JSONEq(t, `{"locale":"ja","timeZone":"Asia/Tokyo","settingsAutoInitialized":true}`, w.Body.String())
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestUserSettingsHandler_UpdateSettings_RejectsInvalidTimeZone(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, _, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	userID := uuid.New()
	handler := &UserSettingsHandler{db: db}

	r := gin.New()
	r.PATCH("/api/v1/me/settings", func(c *gin.Context) {
		c.Set("userID", userID)
		handler.UpdateSettings(c)
	})

	req := httptest.NewRequest(http.MethodPatch, "/api/v1/me/settings", bytes.NewBufferString(`{"locale":"ja","timeZone":"Mars/Olympus"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusBadRequest, w.Code)
	require.Contains(t, w.Body.String(), "Unsupported time zone")
}
