package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/TimLai666/surtopya-api/internal/models"
	"github.com/google/uuid"
)

// ResponseRepository handles response database operations
type ResponseRepository struct {
	db *sql.DB
}

// NewResponseRepository creates a new ResponseRepository
func NewResponseRepository(db *sql.DB) *ResponseRepository {
	return &ResponseRepository{db: db}
}

// Create creates a new response
func (r *ResponseRepository) Create(response *models.Response) error {
	query := `
		INSERT INTO responses (
			id, survey_id, user_id, anonymous_id, status, points_awarded, started_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at
	`

	err := r.db.QueryRow(
		query,
		response.ID, response.SurveyID, response.UserID, response.AnonymousID,
		response.Status, response.PointsAwarded, response.StartedAt,
	).Scan(&response.ID, &response.CreatedAt)

	if err != nil {
		return fmt.Errorf("failed to create response: %w", err)
	}

	return nil
}

// GetByID retrieves a response by ID
func (r *ResponseRepository) GetByID(id uuid.UUID) (*models.Response, error) {
	response := &models.Response{}

	query := `
		SELECT id, survey_id, user_id, anonymous_id, status, points_awarded,
			started_at, completed_at, created_at
		FROM responses WHERE id = $1
	`

	err := r.db.QueryRow(query, id).Scan(
		&response.ID, &response.SurveyID, &response.UserID, &response.AnonymousID,
		&response.Status, &response.PointsAwarded, &response.StartedAt,
		&response.CompletedAt, &response.CreatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get response: %w", err)
	}

	// Load answers
	answers, err := r.GetAnswers(id)
	if err != nil {
		return nil, err
	}
	response.Answers = answers

	return response, nil
}

// GetBySurveyID retrieves all responses for a survey
func (r *ResponseRepository) GetBySurveyID(surveyID uuid.UUID) ([]models.Response, error) {
	query := `
		SELECT id, survey_id, user_id, anonymous_id, status, points_awarded,
			started_at, completed_at, created_at
		FROM responses WHERE survey_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(query, surveyID)
	if err != nil {
		return nil, fmt.Errorf("failed to query responses: %w", err)
	}
	defer rows.Close()

	var responses []models.Response
	for rows.Next() {
		var response models.Response
		err := rows.Scan(
			&response.ID, &response.SurveyID, &response.UserID, &response.AnonymousID,
			&response.Status, &response.PointsAwarded, &response.StartedAt,
			&response.CompletedAt, &response.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan response: %w", err)
		}
		responses = append(responses, response)
	}

	return responses, nil
}

// Complete marks a response as completed
func (r *ResponseRepository) Complete(id uuid.UUID, pointsAwarded int) error {
	now := time.Now()
	query := `
		UPDATE responses SET status = 'completed', completed_at = $2, points_awarded = $3
		WHERE id = $1
	`

	_, err := r.db.Exec(query, id, now, pointsAwarded)
	if err != nil {
		return fmt.Errorf("failed to complete response: %w", err)
	}

	return nil
}

// SaveAnswer saves an answer to a question
func (r *ResponseRepository) SaveAnswer(answer *models.Answer) error {
	valueJSON, err := json.Marshal(answer.Value)
	if err != nil {
		return fmt.Errorf("failed to marshal answer value: %w", err)
	}

	query := `
		INSERT INTO answers (id, response_id, question_id, value)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (response_id, question_id)
		DO UPDATE SET value = $4
		RETURNING id, created_at
	`

	err = r.db.QueryRow(
		query,
		answer.ID, answer.ResponseID, answer.QuestionID, valueJSON,
	).Scan(&answer.ID, &answer.CreatedAt)

	if err != nil {
		return fmt.Errorf("failed to save answer: %w", err)
	}

	return nil
}

// GetAnswers retrieves all answers for a response
func (r *ResponseRepository) GetAnswers(responseID uuid.UUID) ([]models.Answer, error) {
	query := `
		SELECT id, response_id, question_id, value, created_at
		FROM answers WHERE response_id = $1
	`

	rows, err := r.db.Query(query, responseID)
	if err != nil {
		return nil, fmt.Errorf("failed to query answers: %w", err)
	}
	defer rows.Close()

	var answers []models.Answer
	for rows.Next() {
		var answer models.Answer
		var valueJSON []byte

		err := rows.Scan(
			&answer.ID, &answer.ResponseID, &answer.QuestionID,
			&valueJSON, &answer.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan answer: %w", err)
		}

		if len(valueJSON) > 0 {
			json.Unmarshal(valueJSON, &answer.Value)
		}

		answers = append(answers, answer)
	}

	return answers, nil
}

// SaveAllAnswers saves multiple answers in a transaction
func (r *ResponseRepository) SaveAllAnswers(responseID uuid.UUID, answers []models.Answer) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	for _, answer := range answers {
		valueJSON, _ := json.Marshal(answer.Value)

		query := `
			INSERT INTO answers (id, response_id, question_id, value)
			VALUES ($1, $2, $3, $4)
		`

		_, err = tx.Exec(query, answer.ID, responseID, answer.QuestionID, valueJSON)
		if err != nil {
			return fmt.Errorf("failed to insert answer: %w", err)
		}
	}

	return tx.Commit()
}
