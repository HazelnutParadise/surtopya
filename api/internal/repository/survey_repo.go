package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"

	"github.com/TimLai666/surtopya-api/internal/models"
	"github.com/google/uuid"
)

// SurveyRepository handles survey database operations
type SurveyRepository struct {
	db *sql.DB
}

// NewSurveyRepository creates a new SurveyRepository
func NewSurveyRepository(db *sql.DB) *SurveyRepository {
	return &SurveyRepository{db: db}
}

// Create creates a new survey
func (r *SurveyRepository) Create(survey *models.Survey) error {
	themeJSON, err := json.Marshal(survey.Theme)
	if err != nil {
		return fmt.Errorf("failed to marshal theme: %w", err)
	}

	query := `
		INSERT INTO surveys (
			id, user_id, title, description, visibility, is_published,
			include_in_datasets, published_count, theme, points_reward, expires_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, created_at, updated_at
	`

	err = r.db.QueryRow(
		query,
		survey.ID, survey.UserID, survey.Title, survey.Description,
		survey.Visibility, survey.IsPublished, survey.IncludeInDatasets,
		survey.PublishedCount, themeJSON, survey.PointsReward, survey.ExpiresAt,
	).Scan(&survey.ID, &survey.CreatedAt, &survey.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create survey: %w", err)
	}

	return nil
}

// GetByID retrieves a survey by ID
func (r *SurveyRepository) GetByID(id uuid.UUID) (*models.Survey, error) {
	survey := &models.Survey{}
	var themeJSON []byte

	query := `
		SELECT id, user_id, title, description, visibility, is_published,
			include_in_datasets, published_count, theme, points_reward,
			expires_at, response_count, created_at, updated_at, published_at
		FROM surveys WHERE id = $1
	`

	err := r.db.QueryRow(query, id).Scan(
		&survey.ID, &survey.UserID, &survey.Title, &survey.Description,
		&survey.Visibility, &survey.IsPublished, &survey.IncludeInDatasets,
		&survey.PublishedCount, &themeJSON, &survey.PointsReward,
		&survey.ExpiresAt, &survey.ResponseCount, &survey.CreatedAt,
		&survey.UpdatedAt, &survey.PublishedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get survey: %w", err)
	}

	if len(themeJSON) > 0 {
		survey.Theme = &models.SurveyTheme{}
		if err := json.Unmarshal(themeJSON, survey.Theme); err != nil {
			return nil, fmt.Errorf("failed to unmarshal theme: %w", err)
		}
	}

	// Load questions
	questions, err := r.GetQuestions(id)
	if err != nil {
		return nil, err
	}
	survey.Questions = questions

	return survey, nil
}

// GetByUserID retrieves all surveys for a user
func (r *SurveyRepository) GetByUserID(userID uuid.UUID) ([]models.Survey, error) {
	query := `
		SELECT id, user_id, title, description, visibility, is_published,
			include_in_datasets, published_count, theme, points_reward,
			expires_at, response_count, created_at, updated_at, published_at
		FROM surveys WHERE user_id = $1
		ORDER BY updated_at DESC
	`

	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to query surveys: %w", err)
	}
	defer rows.Close()

	var surveys []models.Survey
	for rows.Next() {
		var survey models.Survey
		var themeJSON []byte

		err := rows.Scan(
			&survey.ID, &survey.UserID, &survey.Title, &survey.Description,
			&survey.Visibility, &survey.IsPublished, &survey.IncludeInDatasets,
			&survey.PublishedCount, &themeJSON, &survey.PointsReward,
			&survey.ExpiresAt, &survey.ResponseCount, &survey.CreatedAt,
			&survey.UpdatedAt, &survey.PublishedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan survey: %w", err)
		}

		if len(themeJSON) > 0 {
			survey.Theme = &models.SurveyTheme{}
			json.Unmarshal(themeJSON, survey.Theme)
		}

		surveys = append(surveys, survey)
	}

	return surveys, nil
}

// GetPublicSurveys retrieves all public published surveys
func (r *SurveyRepository) GetPublicSurveys(limit, offset int) ([]models.Survey, error) {
	query := `
		SELECT id, user_id, title, description, visibility, is_published,
			include_in_datasets, published_count, theme, points_reward,
			expires_at, response_count, created_at, updated_at, published_at
		FROM surveys
		WHERE visibility = 'public' AND is_published = true
		ORDER BY published_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.db.Query(query, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to query public surveys: %w", err)
	}
	defer rows.Close()

	var surveys []models.Survey
	for rows.Next() {
		var survey models.Survey
		var themeJSON []byte

		err := rows.Scan(
			&survey.ID, &survey.UserID, &survey.Title, &survey.Description,
			&survey.Visibility, &survey.IsPublished, &survey.IncludeInDatasets,
			&survey.PublishedCount, &themeJSON, &survey.PointsReward,
			&survey.ExpiresAt, &survey.ResponseCount, &survey.CreatedAt,
			&survey.UpdatedAt, &survey.PublishedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan survey: %w", err)
		}

		if len(themeJSON) > 0 {
			survey.Theme = &models.SurveyTheme{}
			json.Unmarshal(themeJSON, survey.Theme)
		}

		surveys = append(surveys, survey)
	}

	return surveys, nil
}

// Update updates a survey
func (r *SurveyRepository) Update(survey *models.Survey) error {
	themeJSON, err := json.Marshal(survey.Theme)
	if err != nil {
		return fmt.Errorf("failed to marshal theme: %w", err)
	}

	query := `
		UPDATE surveys SET
			title = $2, description = $3, visibility = $4, is_published = $5,
			include_in_datasets = $6, published_count = $7, theme = $8,
			points_reward = $9, expires_at = $10, published_at = $11
		WHERE id = $1
	`

	_, err = r.db.Exec(
		query,
		survey.ID, survey.Title, survey.Description, survey.Visibility,
		survey.IsPublished, survey.IncludeInDatasets, survey.PublishedCount,
		themeJSON, survey.PointsReward, survey.ExpiresAt, survey.PublishedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to update survey: %w", err)
	}

	return nil
}

// Delete deletes a survey
func (r *SurveyRepository) Delete(id uuid.UUID) error {
	_, err := r.db.Exec("DELETE FROM surveys WHERE id = $1", id)
	if err != nil {
		return fmt.Errorf("failed to delete survey: %w", err)
	}
	return nil
}

// GetQuestions retrieves all questions for a survey
func (r *SurveyRepository) GetQuestions(surveyID uuid.UUID) ([]models.Question, error) {
	query := `
		SELECT id, survey_id, type, title, description, options, required,
			points, max_rating, logic, sort_order, created_at, updated_at
		FROM questions WHERE survey_id = $1
		ORDER BY sort_order ASC
	`

	rows, err := r.db.Query(query, surveyID)
	if err != nil {
		return nil, fmt.Errorf("failed to query questions: %w", err)
	}
	defer rows.Close()

	var questions []models.Question
	for rows.Next() {
		var q models.Question
		var optionsJSON, logicJSON []byte

		err := rows.Scan(
			&q.ID, &q.SurveyID, &q.Type, &q.Title, &q.Description,
			&optionsJSON, &q.Required, &q.Points, &q.MaxRating,
			&logicJSON, &q.SortOrder, &q.CreatedAt, &q.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan question: %w", err)
		}

		if len(optionsJSON) > 0 {
			json.Unmarshal(optionsJSON, &q.Options)
		}
		if len(logicJSON) > 0 {
			json.Unmarshal(logicJSON, &q.Logic)
		}

		questions = append(questions, q)
	}

	return questions, nil
}

// SaveQuestions saves questions for a survey (replaces all)
func (r *SurveyRepository) SaveQuestions(surveyID uuid.UUID, questions []models.Question) error {
	tx, err := r.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Delete existing questions
	_, err = tx.Exec("DELETE FROM questions WHERE survey_id = $1", surveyID)
	if err != nil {
		return fmt.Errorf("failed to delete existing questions: %w", err)
	}

	// Insert new questions
	for i, q := range questions {
		optionsJSON, _ := json.Marshal(q.Options)
		logicJSON, _ := json.Marshal(q.Logic)

		query := `
			INSERT INTO questions (
				id, survey_id, type, title, description, options, required,
				points, max_rating, logic, sort_order
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		`

		_, err = tx.Exec(
			query,
			q.ID, surveyID, q.Type, q.Title, q.Description,
			optionsJSON, q.Required, q.Points, q.MaxRating, logicJSON, i,
		)
		if err != nil {
			return fmt.Errorf("failed to insert question: %w", err)
		}
	}

	return tx.Commit()
}

// IncrementResponseCount increments the response count for a survey
func (r *SurveyRepository) IncrementResponseCount(surveyID uuid.UUID) error {
	_, err := r.db.Exec(
		"UPDATE surveys SET response_count = response_count + 1 WHERE id = $1",
		surveyID,
	)
	if err != nil {
		return fmt.Errorf("failed to increment response count: %w", err)
	}
	return nil
}
