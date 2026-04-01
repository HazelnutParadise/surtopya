package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/TimLai666/surtopya-api/internal/deid"
	"github.com/TimLai666/surtopya-api/internal/models"
	"github.com/TimLai666/surtopya-api/internal/platformlog"
	"github.com/TimLai666/surtopya-api/internal/policy"
	"github.com/TimLai666/surtopya-api/internal/repository"
	"github.com/TimLai666/surtopya-api/internal/timeutil"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// SurveyHandler handles survey-related requests
type SurveyHandler struct {
	db         *sql.DB
	repo       *repository.SurveyRepository
	authorRepo *repository.AuthorRepository
	policies   *policy.Service
	pointsRepo *repository.PointsRepository
	logger     *platformlog.Logger
}

const activeSurveyLimitReachedError = "Active survey limit reached"
const noChangesToPublishError = "No changes to publish"
const publishedVersionExpiredError = "Published version expired"
const expirationDatePastError = "Expiration date cannot be in the past"
const surveyContainsInvalidLogicError = "Survey contains invalid logic"

func queueDeidForSurvey(ctx context.Context, db *sql.DB, surveyID uuid.UUID, triggerSource string, triggeredBy *uuid.UUID) (string, *uuid.UUID, int, error) {
	service := deid.NewService(db)
	result, err := service.QueueSurveyJob(ctx, surveyID, triggerSource, triggeredBy)
	if err != nil {
		if errors.Is(err, deid.ErrNoNewResponses) {
			return "no_data", &result.JobID, 0, nil
		}
		return "", nil, 0, err
	}
	return result.Status, &result.JobID, result.ResponseRows, nil
}

// NewSurveyHandler creates a new SurveyHandler
func NewSurveyHandler() *SurveyHandler {
	db := database.GetDB()
	return &SurveyHandler{
		db:         db,
		repo:       repository.NewSurveyRepository(db),
		authorRepo: repository.NewAuthorRepository(db),
		policies:   policy.NewService(db),
		pointsRepo: repository.NewPointsRepository(db),
		logger:     platformlog.NewLogger(db),
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
	CompletionTitle       *string             `json:"completionTitle"`
	CompletionMessage     *string             `json:"completionMessage"`
	Visibility            string              `json:"visibility"`
	RequireLoginToRespond bool                `json:"requireLoginToRespond"`
	IncludeInDatasets     bool                `json:"includeInDatasets"`
	Theme                 *models.SurveyTheme `json:"theme"`
	PointsReward          int                 `json:"pointsReward"`
	ExpiresAtLocal        *string             `json:"expiresAtLocal"`
	TimeZone              *string             `json:"timeZone"`
	Questions             []QuestionRequest   `json:"questions"`
}

// QuestionRequest represents a question in the request
type QuestionRequest struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"`
	Title       string                 `json:"title"`
	Description string                 `json:"description"`
	Options     models.QuestionOptions `json:"options"`
	Required    bool                   `json:"required"`
	MaxRating   int                    `json:"maxRating"`
	MinSelections *int                 `json:"minSelections"`
	MaxSelections *int                 `json:"maxSelections"`
	DefaultDestinationQuestionID *string `json:"defaultDestinationQuestionId"`
	Logic       []models.LogicRule     `json:"logic"`
}

func normalizeQuestionDescription(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func nullableIntEqual(left *int, right *int) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	return *left == *right
}

func nullableStringEqual(left *string, right *string) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	return *left == *right
}

func normalizeOptionalText(value *string) *string {
	if value == nil {
		return nil
	}

	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func normalizeQuestionOptionsForType(questionType string, options models.QuestionOptions) (models.QuestionOptions, error) {
	switch questionType {
	case "single", "multi", "select":
		normalized := options.Clone()
		if normalized.HasMultipleOther() {
			return nil, fmt.Errorf("only one other option is allowed")
		}
		return normalized, nil
	default:
		return nil, nil
	}
}

func buildSnapshotQuestionsFromModels(questions []models.Question) []surveySnapshotQuestion {
	snapshotQuestions := make([]surveySnapshotQuestion, len(questions))
	for i, q := range questions {
		options, _ := normalizeQuestionOptionsForType(q.Type, q.Options)
		snapshotQuestions[i] = surveySnapshotQuestion{
			ID:          q.ID,
			Type:        q.Type,
			Title:       q.Title,
			Description: q.Description,
			Options:     options,
			Required:    q.Required,
			MaxRating:   q.MaxRating,
			MinSelections: q.MinSelections,
			MaxSelections: q.MaxSelections,
			DefaultDestinationQuestionID: q.DefaultDestinationQuestionID,
			Logic:       q.Logic,
			SortOrder:   i,
		}
	}
	return snapshotQuestions
}

func buildSnapshotQuestionsFromRequests(questions []QuestionRequest) ([]surveySnapshotQuestion, error) {
	snapshotQuestions := make([]surveySnapshotQuestion, len(questions))
	for i, q := range questions {
		parsedID, err := uuid.Parse(q.ID)
		if err != nil || parsedID == uuid.Nil {
			return nil, fmt.Errorf("invalid question id")
		}
		options, err := normalizeQuestionOptionsForType(q.Type, q.Options)
		if err != nil {
			return nil, err
		}
		description := q.Description
		snapshotQuestions[i] = surveySnapshotQuestion{
			ID:          parsedID,
			Type:        q.Type,
			Title:       q.Title,
			Description: &description,
			Options:     options,
			Required:    q.Required,
			MaxRating:   q.MaxRating,
			MinSelections: q.MinSelections,
			MaxSelections: q.MaxSelections,
			DefaultDestinationQuestionID: q.DefaultDestinationQuestionID,
			Logic:       q.Logic,
			SortOrder:   i,
		}
	}
	return snapshotQuestions, nil
}

func buildQuestionsFromRequests(surveyID uuid.UUID, requests []QuestionRequest) ([]models.Question, error) {
	questions := make([]models.Question, len(requests))
	for i, qReq := range requests {
		qID, _ := uuid.Parse(qReq.ID)
		if qID == uuid.Nil {
			qID = uuid.New()
		}
		options, err := normalizeQuestionOptionsForType(qReq.Type, qReq.Options)
		if err != nil {
			return nil, err
		}
		description := qReq.Description
		questions[i] = models.Question{
			ID:          qID,
			SurveyID:    surveyID,
			Type:        qReq.Type,
			Title:       qReq.Title,
			Description: &description,
			Options:     options,
			Required:    qReq.Required,
			MaxRating:   qReq.MaxRating,
			MinSelections: qReq.MinSelections,
			MaxSelections: qReq.MaxSelections,
			DefaultDestinationQuestionID: qReq.DefaultDestinationQuestionID,
			Logic:       qReq.Logic,
			SortOrder:   i,
		}
	}
	return questions, nil
}

func areQuestionSnapshotsEqual(left []surveySnapshotQuestion, right []surveySnapshotQuestion) bool {
	if len(left) != len(right) {
		return false
	}
	for i := range left {
		if left[i].ID != right[i].ID {
			return false
		}
		if left[i].Type != right[i].Type || left[i].Title != right[i].Title {
			return false
		}
		if normalizeQuestionDescription(left[i].Description) != normalizeQuestionDescription(right[i].Description) {
			return false
		}
		if left[i].Required != right[i].Required || left[i].MaxRating != right[i].MaxRating {
			return false
		}
		if !nullableIntEqual(left[i].MinSelections, right[i].MinSelections) || !nullableIntEqual(left[i].MaxSelections, right[i].MaxSelections) {
			return false
		}
		if !nullableStringEqual(left[i].DefaultDestinationQuestionID, right[i].DefaultDestinationQuestionID) {
			return false
		}
		if left[i].SortOrder != right[i].SortOrder {
			return false
		}
		leftOptionsJSON, _ := json.Marshal(left[i].Options)
		rightOptionsJSON, _ := json.Marshal(right[i].Options)
		if string(leftOptionsJSON) != string(rightOptionsJSON) {
			return false
		}
		leftLogicJSON, _ := json.Marshal(left[i].Logic)
		rightLogicJSON, _ := json.Marshal(right[i].Logic)
		if string(leftLogicJSON) != string(rightLogicJSON) {
			return false
		}
	}
	return true
}

// CreateSurvey handles POST /v1/surveys
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
	expiresAt, err := parseSurveyExpiresAt(req.ExpiresAtLocal, req.TimeZone)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid expiration date"})
		return
	}
	if err := validateSurveyExpiresAtTransition(nil, expiresAt, time.Now()); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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
		CompletionTitle:       normalizeOptionalText(req.CompletionTitle),
		CompletionMessage:     normalizeOptionalText(req.CompletionMessage),
		Visibility:            req.Visibility,
		IsResponseOpen:        false,
		RequireLoginToRespond: req.RequireLoginToRespond,
		IncludeInDatasets:     req.IncludeInDatasets,
		EverPublic:            false,
		PublishedCount:        0,
		HasUnpublishedChanges: false,
		Theme:                 req.Theme,
		PointsReward:          req.PointsReward,
		ExpiresAt:             expiresAt,
	}

	if err := h.repo.Create(survey); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create survey"})
		return
	}

	// Save questions if provided
	if len(req.Questions) > 0 {
		questions, err := buildQuestionsFromRequests(survey.ID, req.Questions)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if err := h.repo.SaveQuestions(survey.ID, questions); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save questions"})
			return
		}
		survey.Questions = questions
	}

	platformlog.LogFromGin(c, h.logger, platformlog.EventInput{
		EventType:    "domain",
		Module:       "surveys",
		Action:       "create",
		Status:       "success",
		ResourceType: "survey",
		ResourceID:   survey.ID.String(),
		RequestSummary: map[string]any{
			"visibility":          survey.Visibility,
			"include_in_datasets": survey.IncludeInDatasets,
			"points_reward":       survey.PointsReward,
		},
	})

	c.JSON(http.StatusCreated, survey)
}

// GetSurvey handles GET /v1/surveys/:id
func (h *SurveyHandler) GetSurvey(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid survey ID"})
		return
	}

	var viewerUserID *uuid.UUID
	var viewerAnonymousID *string

	if userID, exists := c.Get("userID"); exists {
		if parsed, ok := userID.(uuid.UUID); ok {
			viewerUserID = &parsed
		}
	}

	if anonymousID := strings.TrimSpace(c.GetHeader("X-Surtopya-Anonymous-Id")); anonymousID != "" {
		viewerAnonymousID = &anonymousID
	}

	survey, err := h.repo.GetByIDForViewer(id, viewerUserID, viewerAnonymousID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get survey"})
		return
	}

	if survey == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Survey not found"})
		return
	}

	if err := attachAuthorToSurvey(survey, h.authorRepo); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resolve survey author"})
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

	platformlog.LogFromGin(c, h.logger, platformlog.EventInput{
		EventType:    "domain",
		Module:       "surveys",
		Action:       "update",
		Status:       "success",
		ResourceType: "survey",
		ResourceID:   survey.ID.String(),
		RequestSummary: map[string]any{
			"visibility":          survey.Visibility,
			"include_in_datasets": survey.IncludeInDatasets,
			"points_reward":       survey.PointsReward,
		},
	})

	c.JSON(http.StatusOK, survey)
}

// GetMySurveys handles GET /v1/surveys/my
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
	if err := attachAuthorsToSurveys(surveys, h.authorRepo); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resolve survey authors"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"surveys": surveys})
}

// GetPublicSurveys handles GET /v1/surveys/public
func (h *SurveyHandler) GetPublicSurveys(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	sort := c.DefaultQuery("sort", "newest")
	var viewerUserID *uuid.UUID
	var viewerAnonymousID *string

	if limit > 100 {
		limit = 100
	}

	if userID, exists := c.Get("userID"); exists {
		if parsed, ok := userID.(uuid.UUID); ok {
			viewerUserID = &parsed
		}
	}

	if anonymousID := strings.TrimSpace(c.GetHeader("X-Surtopya-Anonymous-Id")); anonymousID != "" {
		viewerAnonymousID = &anonymousID
	}

	surveys, err := h.repo.GetPublicSurveys(limit, offset, sort, viewerUserID, viewerAnonymousID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get surveys"})
		return
	}
	if err := attachAuthorsToSurveys(surveys, h.authorRepo); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resolve survey authors"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"surveys": surveys})
}

// UpdateSurveyRequest represents the request body for updating a survey
type UpdateSurveyRequest struct {
	Title                 *string             `json:"title"`
	Description           *string             `json:"description"`
	CompletionTitle       *string             `json:"completionTitle"`
	CompletionMessage     *string             `json:"completionMessage"`
	Visibility            *string             `json:"visibility"`
	RequireLoginToRespond *bool               `json:"requireLoginToRespond"`
	IncludeInDatasets     *bool               `json:"includeInDatasets"`
	Theme                 *models.SurveyTheme `json:"theme"`
	PointsReward          *int                `json:"pointsReward"`
	ExpiresAtLocal        *string             `json:"expiresAtLocal"`
	TimeZone              *string             `json:"timeZone"`
	Questions             []QuestionRequest   `json:"questions"`
}

// UpdateSurvey handles PUT /v1/surveys/:id
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

	questionChanges := false
	originalCompletionTitle := survey.CompletionTitle
	originalCompletionMessage := survey.CompletionMessage

	// Update fields if provided
	if req.Title != nil {
		survey.Title = *req.Title
	}
	if req.Description != nil {
		survey.Description = *req.Description
	}
	if req.CompletionTitle != nil {
		survey.CompletionTitle = normalizeOptionalText(req.CompletionTitle)
	}
	if req.CompletionMessage != nil {
		survey.CompletionMessage = normalizeOptionalText(req.CompletionMessage)
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
		survey.Visibility = *req.Visibility
		if survey.Visibility == "public" && !canOptOutPublicDataset {
			survey.IncludeInDatasets = true
		}
		if survey.Visibility == "public" && survey.PublishedCount > 0 {
			survey.EverPublic = true
		}
	}
	if req.RequireLoginToRespond != nil {
		survey.RequireLoginToRespond = *req.RequireLoginToRespond
	}
	if req.IncludeInDatasets != nil {
		if survey.PublishedCount > 0 && survey.IncludeInDatasets != *req.IncludeInDatasets {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot change dataset sharing after first publish"})
			return
		}
		if survey.Visibility == "public" && !canOptOutPublicDataset {
			survey.IncludeInDatasets = true
		} else {
			survey.IncludeInDatasets = *req.IncludeInDatasets
		}
	}
	if req.Theme != nil {
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
		survey.PointsReward = *req.PointsReward
	}
	if req.ExpiresAtLocal != nil || req.TimeZone != nil {
		parsedExpiresAt, err := parseSurveyExpiresAt(req.ExpiresAtLocal, req.TimeZone)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid expiration date"})
			return
		}
		if err := validateSurveyExpiresAtTransition(survey.ExpiresAt, parsedExpiresAt, time.Now()); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		survey.ExpiresAt = parsedExpiresAt
	}

	if len(req.Questions) > 0 {
		currentQuestionSnapshot := buildSnapshotQuestionsFromModels(survey.Questions)
		nextQuestionSnapshot, err := buildSnapshotQuestionsFromRequests(req.Questions)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if !areQuestionSnapshotsEqual(currentQuestionSnapshot, nextQuestionSnapshot) {
			questionChanges = true
		}
	}

	if questionChanges && survey.CurrentPublishedVersionNumber != nil && *survey.CurrentPublishedVersionNumber > 0 {
		survey.HasUnpublishedChanges = true
	}
	if survey.CurrentPublishedVersionNumber != nil && *survey.CurrentPublishedVersionNumber > 0 {
		if !nullableStringEqual(originalCompletionTitle, survey.CompletionTitle) || !nullableStringEqual(originalCompletionMessage, survey.CompletionMessage) {
			survey.HasUnpublishedChanges = true
		}
	}

	if err := h.repo.Update(survey); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update survey"})
		return
	}

	// Update questions if provided
	if len(req.Questions) > 0 {
		questions, err := buildQuestionsFromRequests(survey.ID, req.Questions)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if err := h.repo.SaveQuestions(survey.ID, questions); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save questions"})
			return
		}
		survey.Questions = questions
	}

	c.JSON(http.StatusOK, survey)
}

func parseSurveyExpiresAt(expiresAtLocal *string, timeZone *string) (*time.Time, error) {
	if expiresAtLocal == nil && timeZone == nil {
		return nil, nil
	}
	if expiresAtLocal == nil || timeZone == nil {
		return nil, fmt.Errorf("expiresAtLocal and timeZone must be provided together")
	}
	if strings.TrimSpace(*expiresAtLocal) == "" {
		return nil, nil
	}

	parsed, err := timeutil.ParseLocalDateTimeToUTC(*expiresAtLocal, *timeZone)
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

func surveyExpiresAtChanged(current *time.Time, next *time.Time) bool {
	switch {
	case current == nil && next == nil:
		return false
	case current == nil || next == nil:
		return true
	default:
		return !current.Equal(*next)
	}
}

func validateSurveyExpiresAtTransition(current *time.Time, next *time.Time, now time.Time) error {
	if !surveyExpiresAtChanged(current, next) {
		return nil
	}
	if next == nil {
		return nil
	}
	if !next.After(now) {
		return fmt.Errorf(expirationDatePastError)
	}
	return nil
}

// PublishSurveyRequest represents the request body for publishing
type PublishSurveyRequest struct {
	Visibility        string `json:"visibility"`
	IncludeInDatasets bool   `json:"includeInDatasets"`
	PointsReward      int    `json:"pointsReward"`
}

type surveySnapshotQuestion struct {
	ID          uuid.UUID              `json:"id"`
	Type        string                 `json:"type"`
	Title       string                 `json:"title"`
	Description *string                `json:"description,omitempty"`
	Options     models.QuestionOptions `json:"options,omitempty"`
	Required    bool                   `json:"required"`
	MaxRating   int                    `json:"maxRating,omitempty"`
	MinSelections *int                 `json:"minSelections,omitempty"`
	MaxSelections *int                 `json:"maxSelections,omitempty"`
	DefaultDestinationQuestionID *string `json:"defaultDestinationQuestionId,omitempty"`
	Logic       []models.LogicRule     `json:"logic,omitempty"`
	SortOrder   int                    `json:"sortOrder"`
}

type surveySnapshot struct {
	CompletionTitle   *string                  `json:"completionTitle,omitempty"`
	CompletionMessage *string                  `json:"completionMessage,omitempty"`
	Questions         []surveySnapshotQuestion `json:"questions"`
}

func buildSurveySnapshot(survey *models.Survey) ([]byte, error) {
	snapshot := surveySnapshot{
		CompletionTitle:   survey.CompletionTitle,
		CompletionMessage: survey.CompletionMessage,
		Questions:         buildSnapshotQuestionsFromModels(survey.Questions),
	}

	return json.Marshal(snapshot)
}

// PublishSurvey handles POST /v1/surveys/:id/publish
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
	if surveyHasPublishBlockingLogicIssues(survey.Questions) {
		c.JSON(http.StatusBadRequest, gin.H{"error": surveyContainsInvalidLogicError})
		return
	}
	publishedPointsReward := survey.PointsReward
	if survey.PublishedCount > 0 {
		currentVersion, err := h.repo.GetCurrentPublishedVersion(survey.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get published survey version"})
			return
		}
		if currentVersion != nil {
			publishedPointsReward = currentVersion.PointsReward
		}
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
		if desiredPointsReward < publishedPointsReward {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Boost points can only increase after first publish"})
			return
		}
	}

	boostTopUp := 0
	if survey.PublishedCount == 0 {
		boostTopUp = desiredPointsReward
	} else if desiredPointsReward > publishedPointsReward {
		boostTopUp = desiredPointsReward - publishedPointsReward
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
	if isSameSnapshot && survey.PublishedCount > 0 {
		if err := h.repo.UpdateCurrentPublishedVersionStateTx(tx, survey.ID, survey.PointsReward, survey.ExpiresAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to synchronize current published version settings"})
			return
		}
		survey.HasUnpublishedChanges = false
		if err := h.repo.UpdateTx(tx, survey); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save survey settings"})
			return
		}
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to finalize publish"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"survey":  survey,
			"message": "Settings saved. No new version was created.",
		})
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

	platformlog.LogFromGin(c, h.logger, platformlog.EventInput{
		EventType:    "domain",
		Module:       "surveys",
		Action:       "publish",
		Status:       "success",
		ResourceType: "survey",
		ResourceID:   survey.ID.String(),
		RequestSummary: map[string]any{
			"version_number": nextVersionNumber,
			"boost_top_up":   boostTopUp,
		},
	})

	c.JSON(http.StatusOK, survey)
}

// OpenSurveyResponses handles POST /v1/surveys/:id/responses/open
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

	platformlog.LogFromGin(c, h.logger, platformlog.EventInput{
		EventType:    "domain",
		Module:       "surveys",
		Action:       "open_responses",
		Status:       "success",
		ResourceType: "survey",
		ResourceID:   survey.ID.String(),
	})

	c.JSON(http.StatusOK, survey)
}

// CloseSurveyResponses handles POST /v1/surveys/:id/responses/close
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

	triggeredBy := userID.(uuid.UUID)
	deidStatus, deidJobID, queuedRows, err := queueDeidForSurvey(
		c.Request.Context(),
		h.db,
		survey.ID,
		"close_responses",
		&triggeredBy,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to queue de-identification workflow"})
		return
	}

	platformlog.LogFromGin(c, h.logger, platformlog.EventInput{
		EventType:    "domain",
		Module:       "surveys",
		Action:       "close_responses",
		Status:       "success",
		ResourceType: "survey",
		ResourceID:   survey.ID.String(),
		Metadata: map[string]any{
			"deid_status":      deidStatus,
			"deid_job_id":      deidJobID,
			"deid_queued_rows": queuedRows,
		},
	})

	c.JSON(http.StatusOK, survey)
}

// ListSurveyVersions handles GET /v1/surveys/:id/versions
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

// GetSurveyVersion handles GET /v1/surveys/:id/versions/:versionNumber
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

// RestoreSurveyVersionDraft handles POST /v1/surveys/:id/versions/:versionNumber/restore-draft
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
			MinSelections: q.MinSelections,
			MaxSelections: q.MaxSelections,
			DefaultDestinationQuestionID: q.DefaultDestinationQuestionID,
			Logic:       q.Logic,
			SortOrder:   i,
		}
	}

	survey.CompletionTitle = snapshot.CompletionTitle
	survey.CompletionMessage = snapshot.CompletionMessage

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

// DeleteSurvey handles DELETE /v1/surveys/:id
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

	triggeredBy := userID.(uuid.UUID)
	deidStatus, deidJobID, queuedRows, err := queueDeidForSurvey(
		c.Request.Context(),
		h.db,
		id,
		"user_delete",
		&triggeredBy,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to queue de-identification workflow"})
		return
	}

	platformlog.LogFromGin(c, h.logger, platformlog.EventInput{
		EventType:    "domain",
		Module:       "surveys",
		Action:       "delete",
		Status:       "success",
		ResourceType: "survey",
		ResourceID:   id.String(),
		Metadata: map[string]any{
			"deid_status":      deidStatus,
			"deid_job_id":      deidJobID,
			"deid_queued_rows": queuedRows,
		},
	})

	c.JSON(http.StatusOK, gin.H{"message": "Survey deleted successfully"})
}
