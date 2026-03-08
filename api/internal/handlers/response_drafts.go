package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/TimLai666/surtopya-api/internal/models"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SubmitAnonymousResponseRequest struct {
	AnonymousID string                `json:"anonymousId,omitempty"`
	Answers     []SubmitAnswerRequest `json:"answers"`
}

func (h *ResponseHandler) ensureSurveyAcceptingResponses(surveyID uuid.UUID) (*models.Survey, *models.SurveyVersion, int, string) {
	survey, err := h.surveyRepo.GetByID(surveyID)
	if err != nil {
		return nil, nil, http.StatusInternalServerError, "Failed to get survey"
	}
	if survey == nil {
		return nil, nil, http.StatusNotFound, "Survey not found"
	}
	if !survey.IsResponseOpen || survey.CurrentPublishedVersionID == nil {
		return nil, nil, http.StatusForbidden, surveyResponsesClosedError
	}

	version, err := h.surveyRepo.GetCurrentPublishedVersion(surveyID)
	if err != nil || version == nil {
		return nil, nil, http.StatusInternalServerError, "Failed to get published survey version"
	}
	if version.ExpiresAt != nil && version.ExpiresAt.Before(time.Now()) {
		return nil, nil, http.StatusGone, "Survey has expired"
	}

	return survey, version, 0, ""
}

func (h *ResponseHandler) loadVersionQuestionSet(tx *sql.Tx, surveyVersionID uuid.UUID) (map[uuid.UUID]struct{}, int, error) {
	var snapshotRaw []byte
	var boostSpend int
	if err := tx.QueryRow(
		"SELECT snapshot, points_reward FROM survey_versions WHERE id = $1",
		surveyVersionID,
	).Scan(&snapshotRaw, &boostSpend); err != nil {
		return nil, 0, err
	}

	var snapshot surveySnapshot
	if err := json.Unmarshal(snapshotRaw, &snapshot); err != nil {
		return nil, 0, err
	}

	validQuestions := make(map[uuid.UUID]struct{}, len(snapshot.Questions))
	for _, question := range snapshot.Questions {
		validQuestions[question.ID] = struct{}{}
	}
	return validQuestions, boostSpend, nil
}

// StartDraft handles POST /api/v1/surveys/:id/drafts/start
func (h *ResponseHandler) StartDraft(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	surveyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid survey ID"})
		return
	}

	_, version, code, message := h.ensureSurveyAcceptingResponses(surveyID)
	if code != 0 {
		c.JSON(code, gin.H{"error": message})
		return
	}

	uid := userID.(uuid.UUID)
	existingDraft, err := h.draftRepo.GetBySurveyAndUser(surveyID, uid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get response draft"})
		return
	}
	if existingDraft != nil {
		c.JSON(http.StatusOK, existingDraft)
		return
	}

	draft := &models.ResponseDraft{
		ID:                  uuid.New(),
		SurveyID:            surveyID,
		SurveyVersionID:     version.ID,
		SurveyVersionNumber: version.VersionNumber,
		UserID:              uid,
		StartedAt:           time.Now(),
	}
	if err := h.draftRepo.Create(draft); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start response draft"})
		return
	}

	c.JSON(http.StatusCreated, draft)
}

// SaveDraftAnswer handles POST /api/v1/drafts/:id/answers
func (h *ResponseHandler) SaveDraftAnswer(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	draftID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid draft ID"})
		return
	}

	draft, err := h.draftRepo.GetByIDForUser(draftID, userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get response draft"})
		return
	}
	if draft == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Response draft not found"})
		return
	}

	_, _, code, message := h.ensureSurveyAcceptingResponses(draft.SurveyID)
	if code != 0 {
		c.JSON(code, gin.H{"error": message})
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

	tx, err := h.db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}
	defer tx.Rollback()

	validQuestions, _, err := h.loadVersionQuestionSet(tx, draft.SurveyVersionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load survey version"})
		return
	}
	if _, ok := validQuestions[questionID]; !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Question does not belong to survey"})
		return
	}

	valueJSON, err := json.Marshal(req.Value)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid answer value"})
		return
	}

	var answerID uuid.UUID
	var answerCreatedAt time.Time
	var answerUpdatedAt time.Time
	if err := tx.QueryRow(
		`INSERT INTO response_draft_answers (id, draft_id, question_id, value)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (draft_id, question_id)
		 DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
		 RETURNING id, created_at, updated_at`,
		uuid.New(),
		draft.ID,
		questionID,
		valueJSON,
	).Scan(&answerID, &answerCreatedAt, &answerUpdatedAt); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save draft answer"})
		return
	}

	var draftUpdatedAt time.Time
	if err := tx.QueryRow(
		"UPDATE response_drafts SET updated_at = NOW() WHERE id = $1 RETURNING updated_at",
		draft.ID,
	).Scan(&draftUpdatedAt); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update draft timestamp"})
		return
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":             answerID,
		"draftId":        draft.ID,
		"questionId":     questionID,
		"value":          req.Value,
		"createdAt":      answerCreatedAt,
		"updatedAt":      answerUpdatedAt,
		"draftUpdatedAt": draftUpdatedAt,
	})
}

// SubmitDraft handles POST /api/v1/drafts/:id/submit
func (h *ResponseHandler) SubmitDraft(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	draftID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid draft ID"})
		return
	}

	var req SubmitAllAnswersRequest
	_ = c.ShouldBindJSON(&req)

	tx, err := h.db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}
	defer tx.Rollback()

	var surveyID uuid.UUID
	var surveyVersionID uuid.UUID
	var surveyVersionNumber int
	var startedAt time.Time
	if err := tx.QueryRow(
		`SELECT survey_id, survey_version_id, survey_version_number, started_at
		 FROM response_drafts
		 WHERE id = $1 AND user_id = $2
		 FOR UPDATE`,
		draftID, userID.(uuid.UUID),
	).Scan(&surveyID, &surveyVersionID, &surveyVersionNumber, &startedAt); err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Response draft not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get response draft"})
		return
	}

	_, _, code, message := h.ensureSurveyAcceptingResponses(surveyID)
	if code != 0 {
		c.JSON(code, gin.H{"error": message})
		return
	}

	validQuestions, boostSpend, err := h.loadVersionQuestionSet(tx, surveyVersionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load survey version"})
		return
	}

	for _, ansReq := range req.Answers {
		questionID, err := uuid.Parse(ansReq.QuestionID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid question ID"})
			return
		}
		if _, ok := validQuestions[questionID]; !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Question does not belong to survey"})
			return
		}

		valueJSON, err := json.Marshal(ansReq.Value)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid answer value"})
			return
		}

		if _, err := tx.Exec(
			`INSERT INTO response_draft_answers (id, draft_id, question_id, value)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (draft_id, question_id)
			 DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
			uuid.New(),
			draftID,
			questionID,
			valueJSON,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save draft answers"})
			return
		}
	}

	rows, err := tx.Query(
		`SELECT question_id, value
		 FROM response_draft_answers
		 WHERE draft_id = $1`,
		draftID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read draft answers"})
		return
	}
	defer rows.Close()

	type draftAnswerRow struct {
		questionID uuid.UUID
		valueJSON  []byte
	}
	var draftAnswers []draftAnswerRow
	for rows.Next() {
		var row draftAnswerRow
		if err := rows.Scan(&row.questionID, &row.valueJSON); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read draft answers"})
			return
		}
		draftAnswers = append(draftAnswers, row)
	}

	pointsAwarded := 0
	if basePoints, err := loadSurveyBasePoints(tx); err == nil {
		pointsAwarded = basePoints
		if boostSpend > 0 {
			if boostReward := boostSpend / 3; boostReward > 0 {
				pointsAwarded += boostReward
			}
		}
	} else {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load system settings"})
		return
	}

	responseID := uuid.New()
	completedAt := time.Now()
	if _, err := tx.Exec(
		`INSERT INTO responses (
			id, survey_id, survey_version_id, survey_version_number, user_id,
			status, points_awarded, started_at, completed_at
		) VALUES ($1, $2, $3, $4, $5, 'completed', $6, $7, $8)`,
		responseID,
		surveyID,
		surveyVersionID,
		surveyVersionNumber,
		userID.(uuid.UUID),
		pointsAwarded,
		startedAt,
		completedAt,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create response"})
		return
	}

	for _, draftAnswer := range draftAnswers {
		if _, err := tx.Exec(
			`INSERT INTO answers (id, response_id, question_id, value)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (response_id, question_id)
			 DO UPDATE SET value = EXCLUDED.value`,
			uuid.New(),
			responseID,
			draftAnswer.questionID,
			draftAnswer.valueJSON,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to persist answers"})
			return
		}
	}

	if _, err := tx.Exec(
		"UPDATE surveys SET response_count = response_count + 1 WHERE id = $1",
		surveyID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update survey stats"})
		return
	}

	if pointsAwarded > 0 {
		if err := h.pointsRepo.AwardSurveyPointsTx(tx, userID.(uuid.UUID), surveyID, pointsAwarded, "Survey completion reward"); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to award points"})
			return
		}
	}

	if _, err := tx.Exec("DELETE FROM response_drafts WHERE id = $1", draftID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to clear response draft"})
		return
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

// GetMyDrafts handles GET /api/v1/drafts/my
func (h *ResponseHandler) GetMyDrafts(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	drafts, err := h.draftRepo.ListByUserID(userID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get response drafts"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"drafts": drafts})
}

// SubmitAnonymousResponse handles POST /api/v1/surveys/:id/responses/submit-anonymous
func (h *ResponseHandler) SubmitAnonymousResponse(c *gin.Context) {
	surveyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid survey ID"})
		return
	}

	_, version, code, message := h.ensureSurveyAcceptingResponses(surveyID)
	if code != 0 {
		c.JSON(code, gin.H{"error": message})
		return
	}

	var req SubmitAnonymousResponseRequest
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

	validQuestions, _, err := h.loadVersionQuestionSet(tx, version.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load survey version"})
		return
	}

	type answerRow struct {
		questionID uuid.UUID
		valueJSON  []byte
	}
	answerRows := make([]answerRow, 0, len(req.Answers))
	for _, ansReq := range req.Answers {
		questionID, err := uuid.Parse(ansReq.QuestionID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid question ID"})
			return
		}
		if _, ok := validQuestions[questionID]; !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Question does not belong to survey"})
			return
		}
		valueJSON, err := json.Marshal(ansReq.Value)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid answer value"})
			return
		}
		answerRows = append(answerRows, answerRow{questionID: questionID, valueJSON: valueJSON})
	}

	anonymousID := req.AnonymousID
	if anonymousID == "" {
		anonymousID = uuid.New().String()
	}

	now := time.Now()
	responseID := uuid.New()
	if _, err := tx.Exec(
		`INSERT INTO responses (
			id, survey_id, survey_version_id, survey_version_number,
			user_id, anonymous_id, status, points_awarded, started_at, completed_at
		) VALUES ($1, $2, $3, $4, NULL, $5, 'completed', 0, $6, $6)`,
		responseID,
		surveyID,
		version.ID,
		version.VersionNumber,
		anonymousID,
		now,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create response"})
		return
	}

	for _, row := range answerRows {
		if _, err := tx.Exec(
			`INSERT INTO answers (id, response_id, question_id, value)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (response_id, question_id)
			 DO UPDATE SET value = EXCLUDED.value`,
			uuid.New(),
			responseID,
			row.questionID,
			row.valueJSON,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save answers"})
			return
		}
	}

	if _, err := tx.Exec(
		"UPDATE surveys SET response_count = response_count + 1 WHERE id = $1",
		surveyID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update survey stats"})
		return
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	response, _ := h.responseRepo.GetByID(responseID)
	c.JSON(http.StatusOK, gin.H{
		"message":             "Survey completed successfully",
		"response":            response,
		"pointsAwarded":       0,
		"surveyVersionNumber": version.VersionNumber,
	})
}
