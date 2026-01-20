package handlers

import (
	"net/http"
	"time"

	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/TimLai666/surtopya-api/internal/models"
	"github.com/TimLai666/surtopya-api/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ResponseHandler handles survey response-related requests
type ResponseHandler struct {
	responseRepo *repository.ResponseRepository
	surveyRepo   *repository.SurveyRepository
}

// NewResponseHandler creates a new ResponseHandler
func NewResponseHandler() *ResponseHandler {
	db := database.GetDB()
	return &ResponseHandler{
		responseRepo: repository.NewResponseRepository(db),
		surveyRepo:   repository.NewSurveyRepository(db),
	}
}

// StartResponseRequest represents the request to start a survey response
type StartResponseRequest struct {
	AnonymousID string `json:"anonymousId,omitempty"`
}

// StartResponse handles POST /api/v1/surveys/:id/responses/start
func (h *ResponseHandler) StartResponse(c *gin.Context) {
	surveyIDStr := c.Param("id")
	surveyID, err := uuid.Parse(surveyIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid survey ID"})
		return
	}

	// Check if survey exists and is published
	survey, err := h.surveyRepo.GetByID(surveyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get survey"})
		return
	}

	if survey == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Survey not found"})
		return
	}

	if !survey.IsPublished {
		c.JSON(http.StatusForbidden, gin.H{"error": "Survey is not published"})
		return
	}

	// Check expiration
	if survey.ExpiresAt != nil && survey.ExpiresAt.Before(time.Now()) {
		c.JSON(http.StatusGone, gin.H{"error": "Survey has expired"})
		return
	}

	var req StartResponseRequest
	c.ShouldBindJSON(&req)

	// Get user ID if authenticated
	var userID *uuid.UUID
	if uid, exists := c.Get("userID"); exists {
		id := uid.(uuid.UUID)
		userID = &id
	}

	// Generate anonymous ID if not authenticated and not provided
	var anonymousID *string
	if userID == nil {
		if req.AnonymousID != "" {
			anonymousID = &req.AnonymousID
		} else {
			anonID := uuid.New().String()
			anonymousID = &anonID
		}
	}

	response := &models.Response{
		ID:          uuid.New(),
		SurveyID:    surveyID,
		UserID:      userID,
		AnonymousID: anonymousID,
		Status:      "in_progress",
		StartedAt:   time.Now(),
	}

	if err := h.responseRepo.Create(response); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start response"})
		return
	}

	c.JSON(http.StatusCreated, response)
}

// SubmitAnswerRequest represents a single answer submission
type SubmitAnswerRequest struct {
	QuestionID string             `json:"questionId" binding:"required"`
	Value      models.AnswerValue `json:"value" binding:"required"`
}

// SubmitAnswer handles POST /api/v1/responses/:id/answers
func (h *ResponseHandler) SubmitAnswer(c *gin.Context) {
	responseIDStr := c.Param("id")
	responseID, err := uuid.Parse(responseIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid response ID"})
		return
	}

	response, err := h.responseRepo.GetByID(responseID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get response"})
		return
	}

	if response == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Response not found"})
		return
	}

	if response.Status != "in_progress" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Response is already completed"})
		return
	}

	var req SubmitAnswerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	questionID, err := uuid.Parse(req.QuestionID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid question ID"})
		return
	}

	answer := &models.Answer{
		ID:         uuid.New(),
		ResponseID: responseID,
		QuestionID: questionID,
		Value:      req.Value,
	}

	if err := h.responseRepo.SaveAnswer(answer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save answer"})
		return
	}

	c.JSON(http.StatusOK, answer)
}

// SubmitAllAnswersRequest represents bulk answer submission
type SubmitAllAnswersRequest struct {
	Answers []SubmitAnswerRequest `json:"answers" binding:"required"`
}

// SubmitAllAnswers handles POST /api/v1/responses/:id/submit
func (h *ResponseHandler) SubmitAllAnswers(c *gin.Context) {
	responseIDStr := c.Param("id")
	responseID, err := uuid.Parse(responseIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid response ID"})
		return
	}

	response, err := h.responseRepo.GetByID(responseID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get response"})
		return
	}

	if response == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Response not found"})
		return
	}

	if response.Status != "in_progress" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Response is already completed"})
		return
	}

	var req SubmitAllAnswersRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Convert to models.Answer
	answers := make([]models.Answer, len(req.Answers))
	for i, ansReq := range req.Answers {
		questionID, err := uuid.Parse(ansReq.QuestionID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid question ID"})
			return
		}
		answers[i] = models.Answer{
			ID:         uuid.New(),
			ResponseID: responseID,
			QuestionID: questionID,
			Value:      ansReq.Value,
		}
	}

	// Save all answers
	if err := h.responseRepo.SaveAllAnswers(responseID, answers); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save answers"})
		return
	}

	// Get survey to award points
	survey, err := h.surveyRepo.GetByID(response.SurveyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get survey"})
		return
	}

	// Complete the response
	pointsAwarded := 0
	if survey != nil {
		pointsAwarded = survey.PointsReward
	}

	if err := h.responseRepo.Complete(responseID, pointsAwarded); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to complete response"})
		return
	}

	// Increment survey response count
	if err := h.surveyRepo.IncrementResponseCount(response.SurveyID); err != nil {
		// Log error but don't fail the request
	}

	// Get updated response
	response, _ = h.responseRepo.GetByID(responseID)

	c.JSON(http.StatusOK, gin.H{
		"message":       "Survey completed successfully",
		"response":      response,
		"pointsAwarded": pointsAwarded,
	})
}

// GetResponse handles GET /api/v1/responses/:id
func (h *ResponseHandler) GetResponse(c *gin.Context) {
	responseIDStr := c.Param("id")
	responseID, err := uuid.Parse(responseIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid response ID"})
		return
	}

	response, err := h.responseRepo.GetByID(responseID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get response"})
		return
	}

	if response == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Response not found"})
		return
	}

	c.JSON(http.StatusOK, response)
}

// GetSurveyResponses handles GET /api/v1/surveys/:id/responses
func (h *ResponseHandler) GetSurveyResponses(c *gin.Context) {
	surveyIDStr := c.Param("id")
	surveyID, err := uuid.Parse(surveyIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid survey ID"})
		return
	}

	// Check if user owns the survey
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	survey, err := h.surveyRepo.GetByID(surveyID)
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

	responses, err := h.responseRepo.GetBySurveyID(surveyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get responses"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"responses": responses})
}
