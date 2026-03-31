package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/TimLai666/surtopya-api/internal/models"
	"github.com/google/uuid"
)

// SurveyRepository handles survey database operations
type SurveyRepository struct {
	db *sql.DB
}

const (
	publicSurveySortRecommended = "recommended"
	publicSurveySortNewest      = "newest"
	publicSurveySortPointsHigh  = "points-high"
)

func normalizePublicSurveySort(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case publicSurveySortRecommended:
		return publicSurveySortRecommended
	case publicSurveySortPointsHigh:
		return publicSurveySortPointsHigh
	case publicSurveySortNewest:
		fallthrough
	default:
		return publicSurveySortNewest
	}
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

// GetByIDForViewer retrieves a survey by ID and resolves whether the current viewer has already responded.
func (r *SurveyRepository) GetByIDForViewer(
	id uuid.UUID,
	viewerUserID *uuid.UUID,
	viewerAnonymousID *string,
) (*models.Survey, error) {
	survey := &models.Survey{}
	var themeJSON []byte

	var viewerArg interface{}
	if viewerUserID != nil {
		viewerArg = *viewerUserID
	}
	var anonymousArg interface{}
	if viewerAnonymousID != nil {
		anonymousArg = *viewerAnonymousID
	}

	query := `
		SELECT s.id, s.user_id, s.title, s.description, s.visibility,
			s.require_login_to_respond,
			(s.is_response_open AND (sv.expires_at IS NULL OR sv.expires_at > NOW())) AS is_response_open_effective,
			s.include_in_datasets, s.ever_public, s.published_count, s.theme, s.points_reward,
			s.expires_at, s.response_count, s.created_at, s.updated_at, s.published_at,
			s.current_published_version_id, s.current_published_version_number,
			s.has_unpublished_changes,
			CASE
				WHEN $2::uuid IS NULL AND NULLIF($3::text, '') IS NULL THEN FALSE
				ELSE EXISTS(
					SELECT 1
					FROM survey_response_once_locks sr
					WHERE sr.survey_id = s.id
					  AND (
					  	($2::uuid IS NOT NULL AND sr.user_id = $2::uuid)
						OR (NULLIF($3::text, '') IS NOT NULL AND sr.anonymous_id = NULLIF($3::text, ''))
					  )
				)
			END AS has_responded,
			s.deleted_at
		FROM surveys s
		LEFT JOIN survey_versions sv ON sv.id = s.current_published_version_id
		WHERE s.id = $1
		  AND s.deleted_at IS NULL
	`

	err := r.db.QueryRow(query, id, viewerArg, anonymousArg).Scan(
		&survey.ID, &survey.UserID, &survey.Title, &survey.Description,
		&survey.Visibility, &survey.RequireLoginToRespond, &survey.IsResponseOpen, &survey.IncludeInDatasets,
		&survey.EverPublic, &survey.PublishedCount, &themeJSON, &survey.PointsReward,
		&survey.ExpiresAt, &survey.ResponseCount, &survey.CreatedAt,
		&survey.UpdatedAt, &survey.PublishedAt,
		&survey.CurrentPublishedVersionID, &survey.CurrentPublishedVersionNumber,
		&survey.HasUnpublishedChanges, &survey.HasResponded, &survey.DeletedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get survey for viewer: %w", err)
	}

	if len(themeJSON) > 0 {
		survey.Theme = &models.SurveyTheme{}
		if err := json.Unmarshal(themeJSON, survey.Theme); err != nil {
			return nil, fmt.Errorf("failed to unmarshal theme: %w", err)
		}
	}

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
func (r *SurveyRepository) GetPublicSurveys(
	limit, offset int,
	sort string,
	viewerUserID *uuid.UUID,
	viewerAnonymousID *string,
) ([]models.Survey, error) {
	normalizedSort := normalizePublicSurveySort(sort)

	var viewerArg interface{}
	if viewerUserID != nil {
		viewerArg = *viewerUserID
	}
	var anonymousArg interface{}
	if viewerAnonymousID != nil {
		anonymousArg = *viewerAnonymousID
	}

	var query string
	switch normalizedSort {
	case publicSurveySortRecommended:
		query = `
			WITH survey_first_publish AS (
				SELECT
					sv.survey_id,
					MIN(sv.published_at) AS first_published_at
				FROM survey_versions sv
				GROUP BY sv.survey_id
			),
			author_survey_first_publish AS (
				SELECT
					s.id AS survey_id,
					s.user_id,
					COALESCE(sfp.first_published_at, COALESCE(s.published_at, s.created_at)) AS first_published_at
				FROM surveys s
				LEFT JOIN survey_first_publish sfp ON sfp.survey_id = s.id
			),
			eligible AS (
				SELECT
					s.id, s.user_id, s.title, s.description, s.visibility,
					s.require_login_to_respond,
					(s.is_response_open AND (sv.expires_at IS NULL OR sv.expires_at > NOW())) AS is_response_open_effective,
					s.include_in_datasets, s.ever_public, s.published_count, s.theme, s.points_reward,
					s.expires_at, s.response_count, s.created_at, s.updated_at, s.published_at,
					s.current_published_version_id, s.current_published_version_number,
					s.has_unpublished_changes, s.deleted_at, s.is_hot,
					u.created_at AS author_created_at,
					COALESCE(s.published_at, s.created_at) AS ranking_published_at,
					COALESCE(sfp.first_published_at, COALESCE(s.published_at, s.created_at)) AS first_published_at,
					CASE
						WHEN $3::uuid IS NULL AND NULLIF($4::text, '') IS NULL THEN FALSE
						ELSE EXISTS(
							SELECT 1
							FROM survey_response_once_locks sr
							WHERE sr.survey_id = s.id
							  AND (
							  	($3::uuid IS NOT NULL AND sr.user_id = $3::uuid)
								OR (NULLIF($4::text, '') IS NOT NULL AND sr.anonymous_id = NULLIF($4::text, ''))
							  )
						)
					END AS has_responded
				FROM surveys s
				JOIN survey_versions sv ON sv.id = s.current_published_version_id
				JOIN users u ON u.id = s.user_id
				LEFT JOIN survey_first_publish sfp ON sfp.survey_id = s.id
				WHERE s.visibility = 'public'
				  AND s.deleted_at IS NULL
				  AND s.is_response_open = TRUE
				  AND (sv.expires_at IS NULL OR sv.expires_at > NOW())
			),
			ranked AS (
				SELECT
					e.*,
					ROW_NUMBER() OVER (
						PARTITION BY e.user_id
						ORDER BY e.first_published_at ASC, e.id ASC
					) AS author_publish_rank
				FROM eligible e
			),
			with_previous AS (
				SELECT
					ranked.*,
					prev.previous_first_published_at
				FROM ranked
				LEFT JOIN LATERAL (
					SELECT MAX(prev.first_published_at) AS previous_first_published_at
					FROM author_survey_first_publish prev
					WHERE prev.user_id = ranked.user_id
					  AND prev.survey_id <> ranked.id
					  AND prev.first_published_at < ranked.first_published_at
				) prev ON TRUE
			)
			SELECT
				wp.id, wp.user_id, wp.title, wp.description, wp.visibility,
				wp.require_login_to_respond, wp.is_response_open_effective,
				wp.include_in_datasets, wp.ever_public, wp.published_count, wp.theme, wp.points_reward,
				wp.expires_at, wp.response_count, wp.created_at, wp.updated_at, wp.published_at,
				wp.current_published_version_id, wp.current_published_version_number,
				wp.has_unpublished_changes, wp.deleted_at, wp.is_hot, wp.has_responded
			FROM with_previous wp
			ORDER BY
				wp.has_responded ASC,
				(
					0.35 * LEAST(
						1.0,
						GREATEST(
							0.0,
							1.0 - (EXTRACT(EPOCH FROM (NOW() - wp.ranking_published_at)) / 86400.0 / 30.0)
						)
					)
					+ 0.25 * (
						LEAST(
							1.0,
							LN(1.0 + GREATEST(wp.response_count, 0)::double precision) / LN(101.0)
						) * 0.8
						+ CASE WHEN wp.is_hot THEN 0.2 ELSE 0.0 END
					)
					+ 0.20 * LEAST(1.0, GREATEST(wp.points_reward, 0)::double precision / 30.0)
					+ 0.10 * LEAST(
						1.0,
						GREATEST(
							0.0,
							1.0 - (EXTRACT(EPOCH FROM (NOW() - wp.author_created_at)) / 86400.0 / 365.0)
						)
					)
					+ 0.10 * CASE
						WHEN wp.previous_first_published_at IS NOT NULL
						 AND wp.first_published_at - wp.previous_first_published_at >= INTERVAL '90 days'
						THEN 1.0
						ELSE 0.0
					END
					+ CASE WHEN wp.author_publish_rank <= 5 THEN 0.03 ELSE 0.0 END
				) DESC,
				wp.ranking_published_at DESC,
				wp.id ASC
			LIMIT $1 OFFSET $2
		`
	case publicSurveySortPointsHigh:
		query = `
			SELECT s.id, s.user_id, s.title, s.description, s.visibility,
				s.require_login_to_respond,
				(s.is_response_open AND (sv.expires_at IS NULL OR sv.expires_at > NOW())) AS is_response_open_effective,
				s.include_in_datasets, s.ever_public, s.published_count, s.theme, s.points_reward,
				s.expires_at, s.response_count, s.created_at, s.updated_at, s.published_at,
				s.current_published_version_id, s.current_published_version_number,
				s.has_unpublished_changes, s.deleted_at, s.is_hot,
				CASE
					WHEN $3::uuid IS NULL AND NULLIF($4::text, '') IS NULL THEN FALSE
					ELSE EXISTS(
						SELECT 1
						FROM survey_response_once_locks sr
						WHERE sr.survey_id = s.id
						  AND (
						  	($3::uuid IS NOT NULL AND sr.user_id = $3::uuid)
							OR (NULLIF($4::text, '') IS NOT NULL AND sr.anonymous_id = NULLIF($4::text, ''))
						  )
					)
				END AS has_responded
			FROM surveys s
			JOIN survey_versions sv ON sv.id = s.current_published_version_id
			WHERE s.visibility = 'public'
			  AND s.deleted_at IS NULL
			  AND s.is_response_open = TRUE
			  AND (sv.expires_at IS NULL OR sv.expires_at > NOW())
			ORDER BY s.points_reward DESC, COALESCE(s.published_at, s.created_at) DESC, s.id ASC
			LIMIT $1 OFFSET $2
		`
	default:
		query = `
			SELECT s.id, s.user_id, s.title, s.description, s.visibility,
				s.require_login_to_respond,
				(s.is_response_open AND (sv.expires_at IS NULL OR sv.expires_at > NOW())) AS is_response_open_effective,
				s.include_in_datasets, s.ever_public, s.published_count, s.theme, s.points_reward,
				s.expires_at, s.response_count, s.created_at, s.updated_at, s.published_at,
				s.current_published_version_id, s.current_published_version_number,
				s.has_unpublished_changes, s.deleted_at, s.is_hot,
				CASE
					WHEN $3::uuid IS NULL AND NULLIF($4::text, '') IS NULL THEN FALSE
					ELSE EXISTS(
						SELECT 1
						FROM survey_response_once_locks sr
						WHERE sr.survey_id = s.id
						  AND (
						  	($3::uuid IS NOT NULL AND sr.user_id = $3::uuid)
							OR (NULLIF($4::text, '') IS NOT NULL AND sr.anonymous_id = NULLIF($4::text, ''))
						  )
					)
				END AS has_responded
			FROM surveys s
			JOIN survey_versions sv ON sv.id = s.current_published_version_id
			WHERE s.visibility = 'public'
			  AND s.deleted_at IS NULL
			  AND s.is_response_open = TRUE
			  AND (sv.expires_at IS NULL OR sv.expires_at > NOW())
			ORDER BY COALESCE(s.published_at, s.created_at) DESC, s.id ASC
			LIMIT $1 OFFSET $2
		`
	}

	rows, err := r.db.Query(query, limit, offset, viewerArg, anonymousArg)
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
			&survey.HasUnpublishedChanges, &survey.DeletedAt, &survey.IsHot, &survey.HasResponded,
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

// RecomputeHotSurveysUTC recalculates HOT surveys from the last 30 days completed responses.
func (r *SurveyRepository) RecomputeHotSurveysUTC() (int64, error) {
	type hotSurveyCandidate struct {
		ID                uuid.UUID
		RankingPublished  time.Time
		CompletedCount30d int64
	}

	candidateQuery := `
		SELECT s.id,
			COALESCE(s.published_at, s.created_at) AS ranking_published_at,
			COALESCE(
				COUNT(r.id) FILTER (
					WHERE r.status = 'completed'
					  AND r.completed_at IS NOT NULL
					  AND r.completed_at >= NOW() - INTERVAL '30 days'
				),
				0
			) AS completed_count_30d
		FROM surveys s
		JOIN survey_versions sv ON sv.id = s.current_published_version_id
		LEFT JOIN responses r ON r.survey_id = s.id
		WHERE s.visibility = 'public'
		  AND s.deleted_at IS NULL
		  AND s.is_response_open = TRUE
		  AND (sv.expires_at IS NULL OR sv.expires_at > NOW())
		GROUP BY s.id, COALESCE(s.published_at, s.created_at)
		ORDER BY completed_count_30d DESC, ranking_published_at DESC, s.id ASC
	`

	rows, err := r.db.Query(candidateQuery)
	if err != nil {
		return 0, fmt.Errorf("failed to query hot-survey candidates: %w", err)
	}
	defer rows.Close()

	candidates := make([]hotSurveyCandidate, 0)
	for rows.Next() {
		var candidate hotSurveyCandidate
		if err := rows.Scan(&candidate.ID, &candidate.RankingPublished, &candidate.CompletedCount30d); err != nil {
			return 0, fmt.Errorf("failed to scan hot-survey candidate: %w", err)
		}
		candidates = append(candidates, candidate)
	}

	targetCount := 0
	if len(candidates) > 0 {
		targetCount = int(math.Ceil(float64(len(candidates)) * 0.1))
		if targetCount < 1 {
			targetCount = 1
		}
	}

	hotIDs := make([]uuid.UUID, 0, targetCount)
	for index, candidate := range candidates {
		if index >= targetCount {
			break
		}
		if candidate.CompletedCount30d <= 0 {
			continue
		}
		hotIDs = append(hotIDs, candidate.ID)
	}

	tx, err := r.db.Begin()
	if err != nil {
		return 0, fmt.Errorf("failed to begin hot-survey recompute transaction: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`UPDATE surveys SET is_hot = FALSE WHERE is_hot = TRUE`); err != nil {
		return 0, fmt.Errorf("failed to clear existing hot surveys: %w", err)
	}

	hotCount := int64(0)
	if len(hotIDs) > 0 {
		placeholders := make([]string, len(hotIDs))
		args := make([]interface{}, len(hotIDs))
		for index, surveyID := range hotIDs {
			placeholders[index] = fmt.Sprintf("$%d", index+1)
			args[index] = surveyID
		}

		updateHotQuery := fmt.Sprintf(
			`UPDATE surveys SET is_hot = TRUE WHERE id IN (%s)`,
			strings.Join(placeholders, ", "),
		)

		result, err := tx.Exec(updateHotQuery, args...)
		if err != nil {
			return 0, fmt.Errorf("failed to mark hot surveys: %w", err)
		}

		affected, err := result.RowsAffected()
		if err != nil {
			return 0, fmt.Errorf("failed to read hot survey rows affected: %w", err)
		}
		hotCount = affected
	}

	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("failed to commit hot-survey recompute transaction: %w", err)
	}

	return hotCount, nil
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
			max_rating, min_selections, max_selections, default_destination_question_id,
			logic, sort_order, created_at, updated_at
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
			&optionsJSON, &q.Required, &q.MaxRating, &q.MinSelections, &q.MaxSelections, &q.DefaultDestinationQuestionID,
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
				max_rating, min_selections, max_selections, default_destination_question_id, logic, sort_order
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		`

		_, err = tx.Exec(
			query,
			q.ID, surveyID, q.Type, q.Title, q.Description,
			optionsJSON, q.Required, q.MaxRating, q.MinSelections, q.MaxSelections, q.DefaultDestinationQuestionID, logicJSON, i,
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

// UpdateCurrentPublishedVersionStateTx updates mutable attributes on the current published version row.
func (r *SurveyRepository) UpdateCurrentPublishedVersionStateTx(
	tx *sql.Tx,
	surveyID uuid.UUID,
	pointsReward int,
	expiresAt *time.Time,
) error {
	if tx == nil {
		return fmt.Errorf("transaction is required")
	}

	_, err := tx.Exec(
		`UPDATE survey_versions
		 SET points_reward = $2,
		     expires_at = $3
		 WHERE id = (
		   SELECT current_published_version_id
		   FROM surveys
		   WHERE id = $1
		 )`,
		surveyID,
		pointsReward,
		expiresAt,
	)
	if err != nil {
		return fmt.Errorf("failed to update current published survey version state: %w", err)
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
