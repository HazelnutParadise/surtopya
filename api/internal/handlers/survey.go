package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/TimLai666/surtopya-api/internal/models"
	"github.com/TimLai666/surtopya-api/internal/policy"
	"github.com/TimLai666/surtopya-api/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// SurveyHandler handles survey-related requests
type SurveyHandler struct {
	db         *sql.DB
	repo       *repository.SurveyRepository
	policies   *policy.Service
	pointsRepo *repository.PointsRepository
}

const activeSurveyLimitReachedError = "Active survey limit reached"
const noChangesToPublishError = "No changes to publish"
const publishedVersionExpiredError = "Published version expired"

// NewSurveyHandler creates a new SurveyHandler
func NewSurveyHandler() *SurveyHandler {
	db := database.GetDB()
	return &SurveyHandler{
		db:         db,
		repo:       repository.NewSurveyRepository(db),
		policies:   policy.NewService(db),
		pointsRepo: repository.NewPointsRepository(db),
	}
}

func (h *SurveyHandler) canPublishUnderPlanLimit(ctx context.Context, userID uuid.UUID, surveyID uuid.UUID) (bool, error) {
	maxActiveSurveys, err := h.policies.ResolveMaxActiveSurveys(ctx, userID)
	if err != nil {
		return false, err
	}
	if maxActiveSurveys == nil {
		return true, nil
	}

	activeCount, err := h.repo.CountActiveResponseOpenByUser(userID, &surveyID)
	if err != nil {
		return false, err
	}
	return activeCount < *maxActiveSurveys, nil
}

// CreateSurveyRequest represents the request body for creating a survey
type CreateSurveyRequest struct {
	Title                 string              `json:"title"`
	Description           string              `json:"description"`
	Visibility            string              `json:"visibility"`
	RequireLoginToRespond bool                `json:"requireLoginToRespond"`
	IncludeInDatasets     bool                `json:"includeInDatasets"`
	Theme                 *models.SurveyTheme `json:"theme"`
	PointsReward          int                 `json:"pointsReward"`
	Questions             []QuestionRequest   `json:"questions"`
}

// QuestionRequest represents a question in the request
type QuestionRequest struct {
	ID          string             `json:"id"`
	Type        string             `json:"type"`
	Title       string             `json:"title"`
	Description string             `json:"description"`
	Options     []string           `json:"options"`
	Required    bool               `json:"required"`
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
	if req.PointsReward < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Boost points cannot be negative"})
		return
	}

	canOptOutPublicDataset, err := h.policies.Can(c.Request.Context(), userID.(uuid.UUID), policy.CapabilitySurveyPublicDatasetOptOut)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to evaluate membership capability"})
		return
	}

	// Enforce dataset sharing for public surveys when capability is denied.
	if req.Visibility == "public" && !canOptOutPublicDataset {
		req.IncludeInDatasets = true
	}

	survey := &models.Survey{
		ID:                    uuid.New(),
		UserID:                userID.(uuid.UUID),
		Title:                 req.Title,
		Description:           req.Description,
		Visibility:            req.Visibility,
		IsResponseOpen:        false,
		RequireLoginToRespond: req.RequireLoginToRespond,
		IncludeInDatasets:     req.IncludeInDatasets,
		EverPublic:            false,
		PublishedCount:        0,
		HasUnpublishedChanges: false,
		Theme:                 req.Theme,
		PointsReward:          req.PointsReward,
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
	isPublished := survey.CurrentPublishedVersionID != nil
	if survey.Visibility == "non-public" && !isPublished {
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
	Title                 *string             `json:"title"`
	Description           *string             `json:"description"`
	Visibility            *string             `json:"visibility"`
	RequireLoginToRespond *bool               `json:"requireLoginToRespond"`
	IncludeInDatasets     *bool               `json:"includeInDatasets"`
	Theme                 *models.SurveyTheme `json:"theme"`
	PointsReward          *int                `json:"pointsReward"`
	ExpiresAt             *string             `json:"expiresAt"`
	Questions             []QuestionRequest   `json:"questions"`
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

	canOptOutPublicDataset, err := h.policies.Can(c.Request.Context(), userID.(uuid.UUID), policy.CapabilitySurveyPublicDatasetOptOut)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to evaluate membership capability"})
		return
	}

	hasDraftChanges := false

	// Update fields if provided
	if req.Title != nil {
		if survey.Title != *req.Title {
			hasDraftChanges = true
		}
		survey.Title = *req.Title
	}
	if req.Description != nil {
		if survey.Description != *req.Description {
			hasDraftChanges = true
		}
		survey.Description = *req.Description
	}
	if req.Visibility != nil {
		if *req.Visibility != "public" && *req.Visibility != "non-public" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid visibility option"})
			return
		}
		if survey.PublishedCount > 0 && survey.Visibility != *req.Visibility {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot change visibility after first publish"})
			return
		}
		if survey.Visibility != *req.Visibility {
			hasDraftChanges = true
		}
		survey.Visibility = *req.Visibility
		if survey.Visibility == "public" && !canOptOutPublicDataset {
			survey.IncludeInDatasets = true
		}
		if survey.Visibility == "public" && survey.PublishedCount > 0 {
			survey.EverPublic = true
		}
	}
	if req.RequireLoginToRespond != nil {
		if survey.RequireLoginToRespond != *req.RequireLoginToRespond {
			hasDraftChanges = true
		}
		survey.RequireLoginToRespond = *req.RequireLoginToRespond
	}
	if req.IncludeInDatasets != nil {
		if survey.PublishedCount > 0 && survey.IncludeInDatasets != *req.IncludeInDatasets {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot change dataset sharing after first publish"})
			return
		}
		previousIncludeInDatasets := survey.IncludeInDatasets
		if survey.Visibility == "public" && !canOptOutPublicDataset {
			survey.IncludeInDatasets = true
		} else {
			survey.IncludeInDatasets = *req.IncludeInDatasets
		}
		if previousIncludeInDatasets != survey.IncludeInDatasets {
			hasDraftChanges = true
		}
	}
	if req.Theme != nil {
		currentThemeJSON, _ := json.Marshal(survey.Theme)
		incomingThemeJSON, _ := json.Marshal(req.Theme)
		if string(currentThemeJSON) != string(incomingThemeJSON) {
			hasDraftChanges = true
		}
		survey.Theme = req.Theme
	}
	if req.PointsReward != nil {
		if *req.PointsReward < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Boost points cannot be negative"})
			return
		}
		if survey.PublishedCount > 0 && *req.PointsReward < survey.PointsReward {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Boost points can only increase after first publish"})
			return
		}
		if survey.PointsReward != *req.PointsReward {
			hasDraftChanges = true
		}
		survey.PointsReward = *req.PointsReward
	}
	if req.ExpiresAt != nil {
		currentExpiresAt := ""
		if survey.ExpiresAt != nil {
			currentExpiresAt = survey.ExpiresAt.Format("2006-01-02")
		}
		if currentExpiresAt != *req.ExpiresAt {
			hasDraftChanges = true
		}
		if *req.ExpiresAt == "" {
			survey.ExpiresAt = nil
		} else {
			parsed, err := time.Parse("2006-01-02", *req.ExpiresAt)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid expiration date"})
				return
			}
			expiresAt := time.Date(parsed.Year(), parsed.Month(), parsed.Day(), 23, 59, 59, 0, time.UTC)
			survey.ExpiresAt = &expiresAt
		}
	}

	if survey.CurrentPublishedVersionNumber != nil && *survey.CurrentPublishedVersionNumber > 0 && hasDraftChanges {
		survey.HasUnpublishedChanges = true
	}
	if len(req.Questions) > 0 && survey.CurrentPublishedVersionNumber != nil && *survey.CurrentPublishedVersionNumber > 0 {
		survey.HasUnpublishedChanges = true
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

type surveySnapshotQuestion struct {
	ID          uuid.UUID          `json:"id"`
	Type        string             `json:"type"`
	Title       string             `json:"title"`
	Description *string            `json:"description,omitempty"`
	Options     []string           `json:"options,omitempty"`
	Required    bool               `json:"required"`
	MaxRating   int                `json:"maxRating,omitempty"`
	Logic       []models.LogicRule `json:"logic,omitempty"`
	SortOrder   int                `json:"sortOrder"`
}

type surveySnapshot struct {
	Title             string                   `json:"title"`
	Description       string                   `json:"description"`
	Visibility        string                   `json:"visibility"`
	IncludeInDatasets bool                     `json:"includeInDatasets"`
	Theme             *models.SurveyTheme      `json:"theme,omitempty"`
	PointsReward      int                      `json:"pointsReward"`
	ExpiresAt         *time.Time               `json:"expiresAt,omitempty"`
	Questions         []surveySnapshotQuestion `json:"questions"`
}

func buildSurveySnapshot(survey *models.Survey) ([]byte, error) {
	questions := make([]surveySnapshotQuestion, len(survey.Questions))
	for i, q := range survey.Questions {
		questions[i] = surveySnapshotQuestion{
			ID:          q.ID,
			Type:        q.Type,
			Title:       q.Title,
			Description: q.Description,
			Options:     q.Options,
			Required:    q.Required,
			MaxRating:   q.MaxRating,
			Logic:       q.Logic,
			SortOrder:   q.SortOrder,
		}
	}

	snapshot := surveySnapshot{
		Title:             survey.Title,
		Description:       survey.Description,
		Visibility:        survey.Visibility,
		IncludeInDatasets: survey.IncludeInDatasets,
		Theme:             survey.Theme,
		PointsReward:      survey.PointsReward,
		ExpiresAt:         survey.ExpiresAt,
		Questions:         questions,
	}

	return json.Marshal(snapshot)
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

	canOptOutPublicDataset, err := h.policies.Can(c.Request.Context(), userID.(uuid.UUID), policy.CapabilitySurveyPublicDatasetOptOut)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to evaluate membership capability"})
		return
	}

	desiredPointsReward := req.PointsReward
	if desiredPointsReward < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Boost points cannot be negative"})
		return
	}

	canPublish, err := h.canPublishUnderPlanLimit(c.Request.Context(), survey.UserID, survey.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to evaluate active survey limit"})
		return
	}
	if !canPublish {
		c.JSON(http.StatusForbidden, gin.H{"error": activeSurveyLimitReachedError})
		return
	}

	// First publish rules
	if survey.PublishedCount == 0 {
		// Set visibility (locked after first publish)
		if req.Visibility == "public" || req.Visibility == "non-public" {
			survey.Visibility = req.Visibility
		}
		// Public surveys require capability to opt-out.
		if survey.Visibility == "public" {
			survey.EverPublic = true
			if canOptOutPublicDataset {
				survey.IncludeInDatasets = req.IncludeInDatasets
			} else {
				survey.IncludeInDatasets = true
			}
		} else {
			survey.IncludeInDatasets = req.IncludeInDatasets
		}
	} else {
		if req.Visibility != "" && req.Visibility != survey.Visibility {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot change visibility after first publish"})
			return
		}
		if req.IncludeInDatasets != survey.IncludeInDatasets {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot change dataset sharing after first publish"})
			return
		}
		if desiredPointsReward < survey.PointsReward {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Boost points can only increase after first publish"})
			return
		}
	}

	boostTopUp := 0
	if survey.PublishedCount == 0 {
		boostTopUp = desiredPointsReward
	} else if desiredPointsReward > survey.PointsReward {
		boostTopUp = desiredPointsReward - survey.PointsReward
	}

	tx, err := h.db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}
	defer tx.Rollback()

	if boostTopUp > 0 {
		if err := h.pointsRepo.DeductForSurveyBoostTx(tx, survey.UserID, survey.ID, boostTopUp, "Survey boost spend (publish)"); err != nil {
			if err == repository.ErrInsufficientPoints {
				c.JSON(http.StatusPaymentRequired, gin.H{"error": "Insufficient points for boost top-up"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to deduct boost points"})
			return
		}
	}

	survey.PointsReward = desiredPointsReward
	snapshotJSON, err := buildSurveySnapshot(survey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to build publish snapshot"})
		return
	}
	isSameSnapshot, err := h.repo.IsCurrentVersionSnapshotEqual(survey.ID, snapshotJSON)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to compare publish snapshot"})
		return
	}
	if isSameSnapshot {
		c.JSON(http.StatusConflict, gin.H{"error": noChangesToPublishError})
		return
	}

	nextVersionNumber, err := h.repo.GetNextVersionNumberTx(tx, survey.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to determine next survey version"})
		return
	}

	now := time.Now()
	publisherID := userID.(uuid.UUID)
	version := &models.SurveyVersion{
		ID:            uuid.New(),
		SurveyID:      survey.ID,
		VersionNumber: nextVersionNumber,
		Snapshot:      snapshotJSON,
		PointsReward:  survey.PointsReward,
		ExpiresAt:     survey.ExpiresAt,
		PublishedAt:   now,
		PublishedBy:   &publisherID,
	}
	if err := h.repo.CreateVersionTx(tx, version); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to persist survey version"})
		return
	}

	survey.IsResponseOpen = true
	survey.PublishedCount = nextVersionNumber
	survey.PublishedAt = &now
	survey.CurrentPublishedVersionID = &version.ID
	survey.CurrentPublishedVersionNumber = &nextVersionNumber
	survey.HasUnpublishedChanges = false

	if err := h.repo.UpdateTx(tx, survey); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to publish survey"})
		return
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to finalize publish"})
		return
	}

	c.JSON(http.StatusOK, survey)
}

// OpenSurveyResponses handles POST /api/v1/surveys/:id/responses/open
func (h *SurveyHandler) OpenSurveyResponses(c *gin.Context) {
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

	if survey.CurrentPublishedVersionID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Survey has not been published yet"})
		return
	}

	currentVersion, err := h.repo.GetCurrentPublishedVersion(survey.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get published survey version"})
		return
	}
	if currentVersion == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Survey has not been published yet"})
		return
	}
	if currentVersion.ExpiresAt != nil && !currentVersion.ExpiresAt.After(time.Now()) {
		c.JSON(http.StatusConflict, gin.H{"error": publishedVersionExpiredError})
		return
	}

	if survey.IsResponseOpen {
		c.JSON(http.StatusOK, survey)
		return
	}

	canPublish, err := h.canPublishUnderPlanLimit(c.Request.Context(), survey.UserID, survey.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to evaluate active survey limit"})
		return
	}
	if !canPublish {
		c.JSON(http.StatusForbidden, gin.H{"error": activeSurveyLimitReachedError})
		return
	}

	survey.IsResponseOpen = true

	if err := h.repo.Update(survey); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open survey responses"})
		return
	}

	c.JSON(http.StatusOK, survey)
}

// CloseSurveyResponses handles POST /api/v1/surveys/:id/responses/close
func (h *SurveyHandler) CloseSurveyResponses(c *gin.Context) {
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

	if !survey.IsResponseOpen {
		c.JSON(http.StatusOK, survey)
		return
	}

	survey.IsResponseOpen = false

	if err := h.repo.Update(survey); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to close survey responses"})
		return
	}

	c.JSON(http.StatusOK, survey)
}

// ListSurveyVersions handles GET /api/v1/surveys/:id/versions
func (h *SurveyHandler) ListSurveyVersions(c *gin.Context) {
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

	versions, err := h.repo.ListVersionsBySurvey(survey.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list survey versions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"versions": versions})
}

// GetSurveyVersion handles GET /api/v1/surveys/:id/versions/:versionNumber
func (h *SurveyHandler) GetSurveyVersion(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid survey ID"})
		return
	}
	versionNumber, err := strconv.Atoi(c.Param("versionNumber"))
	if err != nil || versionNumber < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid version number"})
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

	version, err := h.repo.GetVersionByNumber(id, versionNumber)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get survey version"})
		return
	}
	if version == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Survey version not found"})
		return
	}

	c.JSON(http.StatusOK, version)
}

// RestoreSurveyVersionDraft handles POST /api/v1/surveys/:id/versions/:versionNumber/restore-draft
func (h *SurveyHandler) RestoreSurveyVersionDraft(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid survey ID"})
		return
	}
	versionNumber, err := strconv.Atoi(c.Param("versionNumber"))
	if err != nil || versionNumber < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid version number"})
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

	version, err := h.repo.GetVersionByNumber(id, versionNumber)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get survey version"})
		return
	}
	if version == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Survey version not found"})
		return
	}

	var snapshot surveySnapshot
	if err := json.Unmarshal(version.Snapshot, &snapshot); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode survey version snapshot"})
		return
	}

	restoredQuestions := make([]models.Question, len(snapshot.Questions))
	for i, q := range snapshot.Questions {
		restoredQuestions[i] = models.Question{
			ID:          q.ID,
			SurveyID:    survey.ID,
			Type:        q.Type,
			Title:       q.Title,
			Description: q.Description,
			Options:     q.Options,
			Required:    q.Required,
			MaxRating:   q.MaxRating,
			Logic:       q.Logic,
			SortOrder:   i,
		}
	}

	survey.Title = snapshot.Title
	survey.Description = snapshot.Description
	survey.Visibility = snapshot.Visibility
	survey.IncludeInDatasets = snapshot.IncludeInDatasets
	survey.Theme = snapshot.Theme
	survey.PointsReward = snapshot.PointsReward
	survey.ExpiresAt = snapshot.ExpiresAt
	if snapshot.Visibility == "public" {
		survey.EverPublic = true
	}
	if survey.CurrentPublishedVersionNumber != nil && *survey.CurrentPublishedVersionNumber > 0 {
		survey.HasUnpublishedChanges = true
	}

	tx, err := h.db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}
	defer tx.Rollback()

	if err := h.repo.UpdateTx(tx, survey); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to restore survey draft"})
		return
	}
	if err := h.repo.SaveQuestionsTx(tx, survey.ID, restoredQuestions); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to restore survey questions"})
		return
	}
	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to finalize draft restore"})
		return
	}

	updated, err := h.repo.GetByID(survey.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load restored survey"})
		return
	}
	c.JSON(http.StatusOK, updated)
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

	if err := h.repo.SoftDelete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete survey"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Survey deleted successfully"})
}
