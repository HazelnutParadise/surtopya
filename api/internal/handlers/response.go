package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/TimLai666/surtopya-api/internal/models"
	"github.com/TimLai666/surtopya-api/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const surveyResponsesClosedError = "Survey responses are closed"

// ResponseHandler handles survey response-related requests
type ResponseHandler struct {
	db           *sql.DB
	responseRepo *repository.ResponseRepository
	draftRepo    *repository.ResponseDraftRepository
	surveyRepo   *repository.SurveyRepository
	pointsRepo   *repository.PointsRepository
}

// NewResponseHandler creates a new ResponseHandler
func NewResponseHandler() *ResponseHandler {
	db := database.GetDB()
	return &ResponseHandler{
		db:           db,
		responseRepo: repository.NewResponseRepository(db),
		draftRepo:    repository.NewResponseDraftRepository(db),
		surveyRepo:   repository.NewSurveyRepository(db),
		pointsRepo:   repository.NewPointsRepository(db),
	}
}

// StartResponseRequest represents the request to start a survey response
type StartResponseRequest struct {
	AnonymousID string `json:"anonymousId,omitempty"`
}

// StartResponse handles POST /api/app/surveys/:id/responses/start
func (h *ResponseHandler) StartResponse(c *gin.Context) {
	if _, exists := c.Get("userID"); !exists {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Anonymous users should submit directly without starting a backend session"})
		return
	}
	h.StartDraft(c)
}

// SubmitAnswerRequest represents a single answer submission
type SubmitAnswerRequest struct {
	QuestionID string             `json:"questionId" binding:"required"`
	Value      models.AnswerValue `json:"value" binding:"required"`
}

// SubmitAnswer handles POST /api/app/responses/:id/answers
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
	Answers []SubmitAnswerRequest `json:"answers"`
}

// SubmitAllAnswers handles POST /api/app/responses/:id/submit
func (h *ResponseHandler) SubmitAllAnswers(c *gin.Context) {
	responseIDStr := c.Param("id")
	responseID, err := uuid.Parse(responseIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid response ID"})
		return
	}

	var req SubmitAllAnswersRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	tx, err := h.db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}
	defer tx.Rollback()

	var surveyID uuid.UUID
	var surveyVersionID uuid.UUID
	var surveyVersionNumber int
	var userID uuid.NullUUID
	var status string
	if err := tx.QueryRow(
		"SELECT survey_id, survey_version_id, survey_version_number, user_id, status FROM responses WHERE id = $1 FOR UPDATE",
		responseID,
	).Scan(&surveyID, &surveyVersionID, &surveyVersionNumber, &userID, &status); err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Response not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get response"})
		return
	}

	if status != "in_progress" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Response is already completed"})
		return
	}

	var versionSnapshot []byte
	var boostSpend int
	if err := tx.QueryRow(
		"SELECT snapshot, points_reward FROM survey_versions WHERE id = $1",
		surveyVersionID,
	).Scan(&versionSnapshot, &boostSpend); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get survey version"})
		return
	}
	var snapshot surveySnapshot
	if err := json.Unmarshal(versionSnapshot, &snapshot); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decode survey version snapshot"})
		return
	}

	validQuestions := make(map[uuid.UUID]struct{}, len(snapshot.Questions))
	for _, q := range snapshot.Questions {
		validQuestions[q.ID] = struct{}{}
	}

	answerValues := make(map[uuid.UUID]models.AnswerValue, len(req.Answers))
	for _, ansReq := range req.Answers {
		questionID, err := uuid.Parse(ansReq.QuestionID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid question ID"})
			return
		}

		if _, exists := validQuestions[questionID]; !exists {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Question does not belong to survey"})
			return
		}
		answerValues[questionID] = ansReq.Value
	}
	if !validateRequiredSupplementalAnswersOrRespond(c, snapshot, answerValues) {
		return
	}

	// Save all answers (if any)
	for _, ansReq := range req.Answers {
		questionID, _ := uuid.Parse(ansReq.QuestionID)
		valueJSON, err := json.Marshal(ansReq.Value)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid answer value"})
			return
		}

		if _, err := tx.Exec(
			`INSERT INTO answers (id, response_id, question_id, value)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (response_id, question_id)
			 DO UPDATE SET value = EXCLUDED.value`,
			uuid.New(), responseID, questionID, valueJSON,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save answers"})
			return
		}
	}
	pointsAwarded := 0
	boostReward := 0

	// Only authenticated users earn points.
	if userID.Valid {
		basePoints, err := loadSurveyBasePoints(tx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load system settings"})
			return
		}
		pointsAwarded = basePoints

		// Survey boost spend is charged at publish time; each respondent earns 1/3 of configured spend.
		if boostSpend > 0 {
			boostReward = boostSpend / 3
			if boostReward > 0 {
				pointsAwarded += boostReward
			}
		}
	}

	if _, err := tx.Exec(
		"UPDATE responses SET status = 'completed', completed_at = $2, points_awarded = $3 WHERE id = $1",
		responseID, time.Now(), pointsAwarded,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to complete response"})
		return
	}

	if _, err := tx.Exec(
		"UPDATE surveys SET response_count = response_count + 1 WHERE id = $1",
		surveyID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update survey stats"})
		return
	}

	if userID.Valid && pointsAwarded > 0 {
		if err := h.pointsRepo.AwardSurveyPointsTx(tx, userID.UUID, surveyID, pointsAwarded, "Survey completion reward"); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to award points"})
			return
		}
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	response, _ := h.responseRepo.GetByID(responseID)

	c.JSON(http.StatusOK, gin.H{
		"message":             "Survey completed successfully",
		"response":            response,
		"pointsAwarded":       pointsAwarded,
		"surveyVersionNumber": surveyVersionNumber,
	})
}

// GetResponse handles GET /v1/responses/:id
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

// GetSurveyResponses handles GET /v1/surveys/:id/responses
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
