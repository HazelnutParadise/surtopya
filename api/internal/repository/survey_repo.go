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
			id, user_id, title, description, visibility, is_response_open,
			require_login_to_respond,
			include_in_datasets, ever_public, published_count,
			current_published_version_id, current_published_version_number,
			theme, points_reward, expires_at, has_unpublished_changes
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
		RETURNING id, created_at, updated_at
	`

	err = r.db.QueryRow(
		query,
		survey.ID, survey.UserID, survey.Title, survey.Description,
		survey.Visibility, survey.IsResponseOpen, survey.RequireLoginToRespond,
		survey.IncludeInDatasets, survey.EverPublic, survey.PublishedCount,
		survey.CurrentPublishedVersionID, survey.CurrentPublishedVersionNumber,
		themeJSON, survey.PointsReward, survey.ExpiresAt, survey.HasUnpublishedChanges,
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
		SELECT s.id, s.user_id, s.title, s.description, s.visibility,
			s.require_login_to_respond,
			(s.is_response_open AND (sv.expires_at IS NULL OR sv.expires_at > NOW())) AS is_response_open_effective,
			s.include_in_datasets, s.ever_public, s.published_count, s.theme, s.points_reward,
			s.expires_at, s.response_count, s.created_at, s.updated_at, s.published_at,
			s.current_published_version_id, s.current_published_version_number,
			s.has_unpublished_changes, s.deleted_at
		FROM surveys s
		LEFT JOIN survey_versions sv ON sv.id = s.current_published_version_id
		WHERE s.id = $1
		  AND s.deleted_at IS NULL
	`

	err := r.db.QueryRow(query, id).Scan(
		&survey.ID, &survey.UserID, &survey.Title, &survey.Description,
		&survey.Visibility, &survey.RequireLoginToRespond, &survey.IsResponseOpen, &survey.IncludeInDatasets,
		&survey.EverPublic, &survey.PublishedCount, &themeJSON, &survey.PointsReward,
		&survey.ExpiresAt, &survey.ResponseCount, &survey.CreatedAt,
		&survey.UpdatedAt, &survey.PublishedAt,
		&survey.CurrentPublishedVersionID, &survey.CurrentPublishedVersionNumber,
		&survey.HasUnpublishedChanges, &survey.DeletedAt,
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
		SELECT s.id, s.user_id, s.title, s.description, s.visibility,
			s.require_login_to_respond,
			(s.is_response_open AND (sv.expires_at IS NULL OR sv.expires_at > NOW())) AS is_response_open_effective,
			s.include_in_datasets, s.ever_public, s.published_count, s.theme, s.points_reward,
			s.expires_at, s.response_count, s.created_at, s.updated_at, s.published_at,
			s.current_published_version_id, s.current_published_version_number,
			s.has_unpublished_changes, s.deleted_at
		FROM surveys s
		LEFT JOIN survey_versions sv ON sv.id = s.current_published_version_id
		WHERE s.user_id = $1
		  AND s.deleted_at IS NULL
		ORDER BY s.updated_at DESC
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
			&survey.Visibility, &survey.RequireLoginToRespond, &survey.IsResponseOpen, &survey.IncludeInDatasets,
			&survey.EverPublic, &survey.PublishedCount, &themeJSON, &survey.PointsReward,
			&survey.ExpiresAt, &survey.ResponseCount, &survey.CreatedAt,
			&survey.UpdatedAt, &survey.PublishedAt,
			&survey.CurrentPublishedVersionID, &survey.CurrentPublishedVersionNumber,
			&survey.HasUnpublishedChanges, &survey.DeletedAt,
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

// CountActiveResponseOpenByUser counts surveys that currently accept responses and are not expired.
// The current survey can be excluded to support republish/open checks.
func (r *SurveyRepository) CountActiveResponseOpenByUser(userID uuid.UUID, excludeSurveyID *uuid.UUID) (int, error) {
	query := `
		SELECT COUNT(*)
		FROM surveys s
		LEFT JOIN survey_versions sv
			ON sv.id = s.current_published_version_id
		WHERE s.user_id = $1
		  AND s.deleted_at IS NULL
		  AND s.is_response_open = TRUE
		  AND sv.id IS NOT NULL
		  AND (sv.expires_at IS NULL OR sv.expires_at > NOW())
	`
	args := []interface{}{userID}
	if excludeSurveyID != nil {
		query += " AND s.id <> $2"
		args = append(args, *excludeSurveyID)
	}

	var count int
	if err := r.db.QueryRow(query, args...).Scan(&count); err != nil {
		return 0, fmt.Errorf("failed to count active response-open surveys: %w", err)
	}
	return count, nil
}

// GetAllAdmin retrieves all surveys with optional filters for admin usage
func (r *SurveyRepository) GetAllAdmin(search string, visibility string, published *bool, limit, offset int) ([]models.Survey, error) {
	query := `
		SELECT s.id, s.user_id, s.title, s.description, s.visibility,
			s.require_login_to_respond,
			(s.is_response_open AND (sv.expires_at IS NULL OR sv.expires_at > NOW())) AS is_response_open_effective,
			s.include_in_datasets, s.ever_public, s.published_count, s.theme, s.points_reward,
			s.expires_at, s.response_count, s.created_at, s.updated_at, s.published_at,
			s.current_published_version_id, s.current_published_version_number,
			s.has_unpublished_changes, s.deleted_at
		FROM surveys s
		LEFT JOIN survey_versions sv ON sv.id = s.current_published_version_id
		WHERE s.deleted_at IS NULL
	`
	args := []interface{}{}
	argCount := 0

	if search != "" {
		argCount++
		query += fmt.Sprintf(" AND (s.title ILIKE $%d OR s.description ILIKE $%d)", argCount, argCount)
		args = append(args, "%"+search+"%")
	}

	if visibility != "" && visibility != "all" {
		argCount++
		query += fmt.Sprintf(" AND s.visibility = $%d", argCount)
		args = append(args, visibility)
	}

	if published != nil {
		argCount++
		query += fmt.Sprintf(" AND (s.is_response_open AND (sv.expires_at IS NULL OR sv.expires_at > NOW())) = $%d", argCount)
		args = append(args, *published)
	}

	argCount++
	query += fmt.Sprintf(" ORDER BY s.updated_at DESC LIMIT $%d", argCount)
	args = append(args, limit)

	argCount++
	query += fmt.Sprintf(" OFFSET $%d", argCount)
	args = append(args, offset)

	rows, err := r.db.Query(query, args...)
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
			&survey.Visibility, &survey.RequireLoginToRespond, &survey.IsResponseOpen, &survey.IncludeInDatasets,
			&survey.EverPublic, &survey.PublishedCount, &themeJSON, &survey.PointsReward,
			&survey.ExpiresAt, &survey.ResponseCount, &survey.CreatedAt,
			&survey.UpdatedAt, &survey.PublishedAt,
			&survey.CurrentPublishedVersionID, &survey.CurrentPublishedVersionNumber,
			&survey.HasUnpublishedChanges, &survey.DeletedAt,
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

// GetPublicSurveys retrieves all public surveys with responses currently open.
func (r *SurveyRepository) GetPublicSurveys(limit, offset int) ([]models.Survey, error) {
	query := `
		SELECT s.id, s.user_id, s.title, s.description, s.visibility,
			s.require_login_to_respond,
			(s.is_response_open AND (sv.expires_at IS NULL OR sv.expires_at > NOW())) AS is_response_open_effective,
			s.include_in_datasets, s.ever_public, s.published_count, s.theme, s.points_reward,
			s.expires_at, s.response_count, s.created_at, s.updated_at, s.published_at,
			s.current_published_version_id, s.current_published_version_number,
			s.has_unpublished_changes, s.deleted_at
		FROM surveys s
		JOIN survey_versions sv ON sv.id = s.current_published_version_id
		WHERE s.visibility = 'public'
		  AND s.deleted_at IS NULL
		  AND s.is_response_open = true
		  AND (sv.expires_at IS NULL OR sv.expires_at > NOW())
		ORDER BY s.published_at DESC
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
			&survey.Visibility, &survey.RequireLoginToRespond, &survey.IsResponseOpen, &survey.IncludeInDatasets,
			&survey.EverPublic, &survey.PublishedCount, &themeJSON, &survey.PointsReward,
			&survey.ExpiresAt, &survey.ResponseCount, &survey.CreatedAt,
			&survey.UpdatedAt, &survey.PublishedAt,
			&survey.CurrentPublishedVersionID, &survey.CurrentPublishedVersionNumber,
			&survey.HasUnpublishedChanges, &survey.DeletedAt,
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
	return r.UpdateTx(nil, survey)
}

// UpdateTx updates a survey using an existing transaction when provided.
func (r *SurveyRepository) UpdateTx(tx *sql.Tx, survey *models.Survey) error {
	themeJSON, err := json.Marshal(survey.Theme)
	if err != nil {
		return fmt.Errorf("failed to marshal theme: %w", err)
	}

	query := `
		UPDATE surveys SET
			title = $2, description = $3, visibility = $4, is_response_open = $5,
			require_login_to_respond = $6, include_in_datasets = $7,
			ever_public = $8, published_count = $9, theme = $10,
			points_reward = $11, expires_at = $12, published_at = $13,
			current_published_version_id = $14, current_published_version_number = $15,
			has_unpublished_changes = $16
		WHERE id = $1
	`

	if tx != nil {
		_, err = tx.Exec(
			query,
			survey.ID, survey.Title, survey.Description, survey.Visibility,
			survey.IsResponseOpen, survey.RequireLoginToRespond, survey.IncludeInDatasets, survey.EverPublic,
			survey.PublishedCount, themeJSON, survey.PointsReward, survey.ExpiresAt, survey.PublishedAt,
			survey.CurrentPublishedVersionID, survey.CurrentPublishedVersionNumber, survey.HasUnpublishedChanges,
		)
	} else {
		_, err = r.db.Exec(
			query,
			survey.ID, survey.Title, survey.Description, survey.Visibility,
			survey.IsResponseOpen, survey.RequireLoginToRespond, survey.IncludeInDatasets, survey.EverPublic,
			survey.PublishedCount, themeJSON, survey.PointsReward, survey.ExpiresAt, survey.PublishedAt,
			survey.CurrentPublishedVersionID, survey.CurrentPublishedVersionNumber, survey.HasUnpublishedChanges,
		)
	}

	if err != nil {
		return fmt.Errorf("failed to update survey: %w", err)
	}

	return nil
}

// SoftDelete marks a survey as deleted for user-facing flows.
func (r *SurveyRepository) SoftDelete(id uuid.UUID) error {
	_, err := r.db.Exec(
		"UPDATE surveys SET deleted_at = NOW(), is_response_open = FALSE WHERE id = $1 AND deleted_at IS NULL",
		id,
	)
	if err != nil {
		return fmt.Errorf("failed to soft-delete survey: %w", err)
	}
	return nil
}

// HardDelete permanently deletes a survey.
func (r *SurveyRepository) HardDelete(id uuid.UUID) error {
	_, err := r.db.Exec("DELETE FROM surveys WHERE id = $1", id)
	if err != nil {
		return fmt.Errorf("failed to delete survey: %w", err)
	}
	return nil
}

// Delete permanently deletes a survey.
func (r *SurveyRepository) Delete(id uuid.UUID) error {
	return r.HardDelete(id)
}

// GetQuestions retrieves all questions for a survey
func (r *SurveyRepository) GetQuestions(surveyID uuid.UUID) ([]models.Question, error) {
	query := `
		SELECT id, survey_id, type, title, description, options, required,
			max_rating, logic, sort_order, created_at, updated_at
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
			&optionsJSON, &q.Required, &q.MaxRating,
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

	if err := r.SaveQuestionsTx(tx, surveyID, questions); err != nil {
		return err
	}

	return tx.Commit()
}

// SaveQuestionsTx saves questions for a survey (replaces all) in an existing transaction.
func (r *SurveyRepository) SaveQuestionsTx(tx *sql.Tx, surveyID uuid.UUID, questions []models.Question) error {
	// Delete existing questions
	_, err := tx.Exec("DELETE FROM questions WHERE survey_id = $1", surveyID)
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
				max_rating, logic, sort_order
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		`

		_, err = tx.Exec(
			query,
			q.ID, surveyID, q.Type, q.Title, q.Description,
			optionsJSON, q.Required, q.MaxRating, logicJSON, i,
		)
		if err != nil {
			return fmt.Errorf("failed to insert question: %w", err)
		}
	}
	return nil
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

// SetResponseOpen updates whether a survey currently accepts responses.
func (r *SurveyRepository) SetResponseOpen(surveyID uuid.UUID, isOpen bool) error {
	_, err := r.db.Exec("UPDATE surveys SET is_response_open = $2 WHERE id = $1", surveyID, isOpen)
	if err != nil {
		return fmt.Errorf("failed to update response-open status: %w", err)
	}
	return nil
}

// CloseExpiredResponseOpenSurveys closes response-open surveys whose current published version is expired.
func (r *SurveyRepository) CloseExpiredResponseOpenSurveys() (int64, error) {
	query := `
		UPDATE surveys s
		SET is_response_open = FALSE
		FROM survey_versions sv
		WHERE s.current_published_version_id = sv.id
		  AND s.is_response_open = TRUE
		  AND sv.expires_at IS NOT NULL
		  AND sv.expires_at <= NOW()
	`
	result, err := r.db.Exec(query)
	if err != nil {
		return 0, fmt.Errorf("failed to close expired response-open surveys: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to read affected rows: %w", err)
	}

	return affected, nil
}

// GetCurrentPublishedVersion retrieves the current published version for a survey.
func (r *SurveyRepository) GetCurrentPublishedVersion(surveyID uuid.UUID) (*models.SurveyVersion, error) {
	query := `
		SELECT sv.id, sv.survey_id, sv.version_number, sv.snapshot, sv.points_reward,
			sv.expires_at, sv.published_at, sv.published_by, sv.created_at
		FROM surveys s
		JOIN survey_versions sv ON sv.id = s.current_published_version_id
		WHERE s.id = $1
		  AND s.deleted_at IS NULL
	`
	version := &models.SurveyVersion{}
	if err := r.db.QueryRow(query, surveyID).Scan(
		&version.ID, &version.SurveyID, &version.VersionNumber, &version.Snapshot,
		&version.PointsReward, &version.ExpiresAt, &version.PublishedAt, &version.PublishedBy, &version.CreatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get current published version: %w", err)
	}
	return version, nil
}

// GetVersionByNumber retrieves a specific published version by its version number.
func (r *SurveyRepository) GetVersionByNumber(surveyID uuid.UUID, versionNumber int) (*models.SurveyVersion, error) {
	query := `
		SELECT id, survey_id, version_number, snapshot, points_reward,
			expires_at, published_at, published_by, created_at
		FROM survey_versions
		WHERE survey_id = $1 AND version_number = $2
	`
	version := &models.SurveyVersion{}
	if err := r.db.QueryRow(query, surveyID, versionNumber).Scan(
		&version.ID, &version.SurveyID, &version.VersionNumber, &version.Snapshot,
		&version.PointsReward, &version.ExpiresAt, &version.PublishedAt, &version.PublishedBy, &version.CreatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get survey version: %w", err)
	}
	return version, nil
}

// ListVersionsBySurvey retrieves all published versions for a survey.
func (r *SurveyRepository) ListVersionsBySurvey(surveyID uuid.UUID) ([]models.SurveyVersion, error) {
	query := `
		SELECT id, survey_id, version_number, snapshot, points_reward,
			expires_at, published_at, published_by, created_at
		FROM survey_versions
		WHERE survey_id = $1
		ORDER BY version_number DESC
	`
	rows, err := r.db.Query(query, surveyID)
	if err != nil {
		return nil, fmt.Errorf("failed to list survey versions: %w", err)
	}
	defer rows.Close()

	var versions []models.SurveyVersion
	for rows.Next() {
		var version models.SurveyVersion
		if err := rows.Scan(
			&version.ID, &version.SurveyID, &version.VersionNumber, &version.Snapshot,
			&version.PointsReward, &version.ExpiresAt, &version.PublishedAt, &version.PublishedBy, &version.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan survey version: %w", err)
		}
		versions = append(versions, version)
	}

	return versions, nil
}

// GetNextVersionNumberTx returns the next version number for a survey within a transaction.
func (r *SurveyRepository) GetNextVersionNumberTx(tx *sql.Tx, surveyID uuid.UUID) (int, error) {
	query := "SELECT COALESCE(MAX(version_number), 0) + 1 FROM survey_versions WHERE survey_id = $1"
	var next int
	if err := tx.QueryRow(query, surveyID).Scan(&next); err != nil {
		return 0, fmt.Errorf("failed to get next version number: %w", err)
	}
	return next, nil
}

// CreateVersionTx inserts a survey version using an existing transaction.
func (r *SurveyRepository) CreateVersionTx(tx *sql.Tx, version *models.SurveyVersion) error {
	query := `
		INSERT INTO survey_versions (
			id, survey_id, version_number, snapshot, points_reward,
			expires_at, published_at, published_by
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING created_at
	`
	if err := tx.QueryRow(
		query,
		version.ID, version.SurveyID, version.VersionNumber, []byte(version.Snapshot),
		version.PointsReward, version.ExpiresAt, version.PublishedAt, version.PublishedBy,
	).Scan(&version.CreatedAt); err != nil {
		return fmt.Errorf("failed to create survey version: %w", err)
	}
	return nil
}

// IsCurrentVersionSnapshotEqual checks if a snapshot matches the currently published version.
func (r *SurveyRepository) IsCurrentVersionSnapshotEqual(surveyID uuid.UUID, snapshot []byte) (bool, error) {
	query := `
		SELECT CASE WHEN sv.id IS NULL THEN FALSE ELSE sv.snapshot = $2::jsonb END
		FROM surveys s
		LEFT JOIN survey_versions sv ON sv.id = s.current_published_version_id
		WHERE s.id = $1
		  AND s.deleted_at IS NULL
	`
	var isEqual bool
	if err := r.db.QueryRow(query, surveyID, snapshot).Scan(&isEqual); err != nil {
		return false, fmt.Errorf("failed to compare survey snapshots: %w", err)
	}
	return isEqual, nil
}
