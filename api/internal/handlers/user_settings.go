package handlers

import (
	"database/sql"
	"net/http"

	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type UserSettingsHandler struct {
	db *sql.DB
}

type userSettingsResponse struct {
	Locale string `json:"locale"`
}

type updateUserSettingsRequest struct {
	Locale string `json:"locale"`
}

var supportedLocales = map[string]bool{
	"zh-TW": true,
	"en":    true,
	"ja":    true,
}

func NewUserSettingsHandler() *UserSettingsHandler {
	return &UserSettingsHandler{db: database.GetDB()}
}

func (h *UserSettingsHandler) GetSettings(c *gin.Context) {
	userID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var locale string
	err := h.db.QueryRow("SELECT locale FROM users WHERE id = $1", userID.(uuid.UUID)).Scan(&locale)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load settings"})
		return
	}

	c.JSON(http.StatusOK, userSettingsResponse{Locale: locale})
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

	if !supportedLocales[req.Locale] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported locale"})
		return
	}

	_, err := h.db.Exec("UPDATE users SET locale = $1 WHERE id = $2", req.Locale, userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update settings"})
		return
	}

	c.JSON(http.StatusOK, userSettingsResponse{Locale: req.Locale})
}
