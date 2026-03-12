package handlers

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/TimLai666/surtopya-api/internal/timeutil"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type UserSettingsHandler struct {
	db *sql.DB
}

type userSettingsResponse struct {
	Locale                  string `json:"locale"`
	TimeZone                string `json:"timeZone"`
	SettingsAutoInitialized bool   `json:"settingsAutoInitialized"`
}

type updateUserSettingsRequest struct {
	Locale         *string `json:"locale"`
	TimeZone       *string `json:"timeZone"`
	AutoInitialize *bool   `json:"autoInitialize"`
}

var supportedLocales = map[string]bool{
	"zh-TW": true,
	"en":    true,
	"ja":    true,
}

type storedUserSettings struct {
	Locale                    string
	TimeZone                  string
	SettingsAutoInitializedAt sql.NullTime
}

func (s storedUserSettings) response() userSettingsResponse {
	return userSettingsResponse{
		Locale:                  s.Locale,
		TimeZone:                s.TimeZone,
		SettingsAutoInitialized: s.SettingsAutoInitializedAt.Valid,
	}
}

func NewUserSettingsHandler() *UserSettingsHandler {
	return &UserSettingsHandler{db: database.GetDB()}
}

func (h *UserSettingsHandler) loadSettings(userID uuid.UUID) (storedUserSettings, error) {
	var settings storedUserSettings
	err := h.db.QueryRow(
		"SELECT locale, timezone, settings_auto_initialized_at FROM users WHERE id = $1",
		userID,
	).Scan(&settings.Locale, &settings.TimeZone, &settings.SettingsAutoInitializedAt)
	return settings, err
}

func (h *UserSettingsHandler) GetSettings(c *gin.Context) {
	userID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	settings, err := h.loadSettings(userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load settings"})
		return
	}

	c.JSON(http.StatusOK, settings.response())
}

func (h *UserSettingsHandler) UpdateSettings(c *gin.Context) {
	userID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var req updateUserSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	autoInitialize := req.AutoInitialize != nil && *req.AutoInitialize
	if autoInitialize && (req.Locale == nil || req.TimeZone == nil) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "locale and timeZone are required for automatic initialization"})
		return
	}

	if !autoInitialize && req.Locale == nil && req.TimeZone == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "At least one setting is required"})
		return
	}

	nextLocale := ""
	if req.Locale != nil {
		nextLocale = strings.TrimSpace(*req.Locale)
		if !supportedLocales[nextLocale] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported locale"})
			return
		}
	}

	nextTimeZone := ""
	if req.TimeZone != nil {
		nextTimeZone = strings.TrimSpace(*req.TimeZone)
		if _, err := timeutil.LoadLocation(nextTimeZone); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported time zone"})
			return
		}
	}

	if autoInitialize {
		var initialized storedUserSettings
		err := h.db.QueryRow(
			`UPDATE users
			 SET locale = $1, timezone = $2, settings_auto_initialized_at = NOW()
			 WHERE id = $3 AND settings_auto_initialized_at IS NULL
			 RETURNING locale, timezone, settings_auto_initialized_at`,
			nextLocale,
			nextTimeZone,
			userID.(uuid.UUID),
		).Scan(&initialized.Locale, &initialized.TimeZone, &initialized.SettingsAutoInitializedAt)
		if err == nil {
			c.JSON(http.StatusOK, initialized.response())
			return
		}
		if err != sql.ErrNoRows {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update settings"})
			return
		}

		settings, loadErr := h.loadSettings(userID.(uuid.UUID))
		if loadErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load settings"})
			return
		}

		c.JSON(http.StatusOK, settings.response())
		return
	}

	if req.Locale == nil || req.TimeZone == nil {
		settings, err := h.loadSettings(userID.(uuid.UUID))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load settings"})
			return
		}
		if req.Locale == nil {
			nextLocale = settings.Locale
		}
		if req.TimeZone == nil {
			nextTimeZone = settings.TimeZone
		}
	}

	var updated storedUserSettings
	err := h.db.QueryRow(
		"UPDATE users SET locale = $1, timezone = $2 WHERE id = $3 RETURNING locale, timezone, settings_auto_initialized_at",
		nextLocale,
		nextTimeZone,
		userID.(uuid.UUID),
	).Scan(&updated.Locale, &updated.TimeZone, &updated.SettingsAutoInitializedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update settings"})
		return
	}

	c.JSON(http.StatusOK, updated.response())
}
