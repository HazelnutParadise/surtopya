package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/TimLai666/surtopya-api/internal/models"
	"github.com/TimLai666/surtopya-api/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// SurveyHandler handles survey-related requests
type SurveyHandler struct {
	repo *repository.SurveyRepository
}

// NewSurveyHandler creates a new SurveyHandler
func NewSurveyHandler() *SurveyHandler {
	return &SurveyHandler{
		repo: repository.NewSurveyRepository(database.GetDB()),
	}
}

// CreateSurveyRequest represents the request body for creating a survey
type CreateSurveyRequest struct {
	Title             string              `json:"title"`
	Description       string              `json:"description"`
	Visibility        string              `json:"visibility"`
	IncludeInDatasets bool                `json:"includeInDatasets"`
	Theme             *models.SurveyTheme `json:"theme"`
	PointsReward      int                 `json:"pointsReward"`
	Questions         []QuestionRequest   `json:"questions"`
}

// QuestionRequest represents a question in the request
type QuestionRequest struct {
	ID          string             `json:"id"`
	Type        string             `json:"type"`
	Title       string             `json:"title"`
	Description string             `json:"description"`
	Options     []string           `json:"options"`
	Required    bool               `json:"required"`
	Points      int                `json:"points"`
	MaxRating   int                `json:"maxRating"`
	Logic       []models.LogicRule `json:"logic"`
}

// CreateSurvey handles POST /api/v1/surveys
func (h *SurveyHandler) CreateSurvey(c *gin.Context) {
	var req CreateSurveyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Validate visibility
	if req.Visibility != "public" && req.Visibility != "non-public" {
		req.Visibility = "non-public"
	}

	// Enforce dataset sharing for public surveys
	if req.Visibility == "public" {
		req.IncludeInDatasets = true
	}

	survey := &models.Survey{
		ID:                uuid.New(),
		UserID:            userID.(uuid.UUID),
		Title:             req.Title,
		Description:       req.Description,
		Visibility:        req.Visibility,
		IsPublished:       false,
		IncludeInDatasets: req.IncludeInDatasets,
		PublishedCount:    0,
		Theme:             req.Theme,
		PointsReward:      req.PointsReward,
	}

	if err := h.repo.Create(survey); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create survey"})
		return
	}

	// Save questions if provided
	if len(req.Questions) > 0 {
		questions := make([]models.Question, len(req.Questions))
		for i, qReq := range req.Questions {
			qID, _ := uuid.Parse(qReq.ID)
			if qID == uuid.Nil {
				qID = uuid.New()
			}
			questions[i] = models.Question{
				ID:          qID,
				SurveyID:    survey.ID,
				Type:        qReq.Type,
				Title:       qReq.Title,
				Description: &qReq.Description,
				Options:     qReq.Options,
				Required:    qReq.Required,
				Points:      qReq.Points,
				MaxRating:   qReq.MaxRating,
				Logic:       qReq.Logic,
				SortOrder:   i,
			}
		}

		if err := h.repo.SaveQuestions(survey.ID, questions); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save questions"})
			return
		}
		survey.Questions = questions
	}

	c.JSON(http.StatusCreated, survey)
}

// GetSurvey handles GET /api/v1/surveys/:id
func (h *SurveyHandler) GetSurvey(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid survey ID"})
		return
	}

	survey, err := h.repo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get survey"})
		return
	}

	if survey == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Survey not found"})
		return
	}

	// Check access permission
	userID, exists := c.Get("userID")
	if survey.Visibility == "non-public" && !survey.IsPublished {
		if !exists || survey.UserID != userID.(uuid.UUID) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
			return
		}
	}

	c.JSON(http.StatusOK, survey)
}

// GetMySurveys handles GET /api/v1/surveys/my
func (h *SurveyHandler) GetMySurveys(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	surveys, err := h.repo.GetByUserID(userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get surveys"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"surveys": surveys})
}

// GetPublicSurveys handles GET /api/v1/surveys/public
func (h *SurveyHandler) GetPublicSurveys(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	if limit > 100 {
		limit = 100
	}

	surveys, err := h.repo.GetPublicSurveys(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get surveys"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"surveys": surveys})
}

// UpdateSurveyRequest represents the request body for updating a survey
type UpdateSurveyRequest struct {
	Title        *string             `json:"title"`
	Description  *string             `json:"description"`
	Theme        *models.SurveyTheme `json:"theme"`
	PointsReward *int                `json:"pointsReward"`
	Questions    []QuestionRequest   `json:"questions"`
}

// UpdateSurvey handles PUT /api/v1/surveys/:id
func (h *SurveyHandler) UpdateSurvey(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid survey ID"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	survey, err := h.repo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get survey"})
		return
	}

	if survey == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Survey not found"})
		return
	}

	if survey.UserID != userID.(uuid.UUID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var req UpdateSurveyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Update fields if provided
	if req.Title != nil {
		survey.Title = *req.Title
	}
	if req.Description != nil {
		survey.Description = *req.Description
	}
	if req.Theme != nil {
		survey.Theme = req.Theme
	}
	if req.PointsReward != nil {
		survey.PointsReward = *req.PointsReward
	}

	if err := h.repo.Update(survey); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update survey"})
		return
	}

	// Update questions if provided
	if len(req.Questions) > 0 {
		questions := make([]models.Question, len(req.Questions))
		for i, qReq := range req.Questions {
			qID, _ := uuid.Parse(qReq.ID)
			if qID == uuid.Nil {
				qID = uuid.New()
			}
			questions[i] = models.Question{
				ID:          qID,
				SurveyID:    survey.ID,
				Type:        qReq.Type,
				Title:       qReq.Title,
				Description: &qReq.Description,
				Options:     qReq.Options,
				Required:    qReq.Required,
				Points:      qReq.Points,
				MaxRating:   qReq.MaxRating,
				Logic:       qReq.Logic,
				SortOrder:   i,
			}
		}

		if err := h.repo.SaveQuestions(survey.ID, questions); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save questions"})
			return
		}
		survey.Questions = questions
	}

	c.JSON(http.StatusOK, survey)
}

// PublishSurveyRequest represents the request body for publishing
type PublishSurveyRequest struct {
	Visibility        string `json:"visibility"`
	IncludeInDatasets bool   `json:"includeInDatasets"`
	PointsReward      int    `json:"pointsReward"`
}

// PublishSurvey handles POST /api/v1/surveys/:id/publish
func (h *SurveyHandler) PublishSurvey(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid survey ID"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	survey, err := h.repo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get survey"})
		return
	}

	if survey == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Survey not found"})
		return
	}

	if survey.UserID != userID.(uuid.UUID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	var req PublishSurveyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// First publish rules
	if survey.PublishedCount == 0 {
		// Set visibility (locked after first publish)
		if req.Visibility == "public" || req.Visibility == "non-public" {
			survey.Visibility = req.Visibility
		}
		// Public surveys must include in datasets
		if survey.Visibility == "public" {
			survey.IncludeInDatasets = true
		} else {
			survey.IncludeInDatasets = req.IncludeInDatasets
		}
	} else {
		// After first publish, can't change visibility from non-public to public
		if survey.Visibility == "non-public" && req.Visibility == "public" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot change from non-public to public after first publish"})
			return
		}
	}

	survey.IsPublished = true
	survey.PublishedCount++
	survey.PointsReward = req.PointsReward
	now := time.Now()
	survey.PublishedAt = &now

	if err := h.repo.Update(survey); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to publish survey"})
		return
	}

	c.JSON(http.StatusOK, survey)
}

// UnpublishSurvey handles POST /api/v1/surveys/:id/unpublish
func (h *SurveyHandler) UnpublishSurvey(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid survey ID"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	survey, err := h.repo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get survey"})
		return
	}

	if survey == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Survey not found"})
		return
	}

	if survey.UserID != userID.(uuid.UUID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	survey.IsPublished = false

	if err := h.repo.Update(survey); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unpublish survey"})
		return
	}

	c.JSON(http.StatusOK, survey)
}

// DeleteSurvey handles DELETE /api/v1/surveys/:id
func (h *SurveyHandler) DeleteSurvey(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid survey ID"})
		return
	}

	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	survey, err := h.repo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get survey"})
		return
	}

	if survey == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Survey not found"})
		return
	}

	if survey.UserID != userID.(uuid.UUID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	if err := h.repo.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete survey"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Survey deleted successfully"})
}
