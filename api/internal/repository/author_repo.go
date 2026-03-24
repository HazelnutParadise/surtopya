package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/TimLai666/surtopya-api/internal/models"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

type AuthorProfile struct {
	ID          uuid.UUID
	Slug        string
	DisplayName string
	AvatarURL   *string
	Bio         *string
	Location    *string
	Phone       *string
	Email       *string
	MemberSince time.Time
}

type AuthorLookupResult struct {
	Profile       *AuthorProfile
	CanonicalSlug string
	Redirected    bool
}

type rawAuthorRecord struct {
	ID                 uuid.UUID
	Slug               string
	Email              *string
	DisplayName        *string
	AvatarURL          *string
	Phone              *string
	Bio                *string
	Location           *string
	PublicShowName     bool
	PublicShowAvatar   bool
	PublicShowBio      bool
	PublicShowLocation bool
	PublicShowPhone    bool
	PublicShowEmail    bool
	CreatedAt          time.Time
}

// AuthorRepository handles author/public profile queries.
type AuthorRepository struct {
	db *sql.DB
}

func NewAuthorRepository(db *sql.DB) *AuthorRepository {
	return &AuthorRepository{db: db}
}

func normalizeLookupSlug(raw string) string {
	trimmed := strings.TrimSpace(strings.TrimPrefix(raw, "@"))
	return strings.ToLower(trimmed)
}

func applyPublicFallbackDisplayName(displayName *string, email *string, showDisplay bool, showEmail bool) string {
	if showDisplay && displayName != nil {
		candidate := strings.TrimSpace(*displayName)
		if candidate != "" {
			return candidate
		}
	}
	if showEmail && email != nil {
		candidate := strings.TrimSpace(*email)
		if candidate != "" {
			return candidate
		}
	}
	return ""
}

func (r *AuthorRepository) scanAuthorRecord(rowScanner interface {
	Scan(dest ...interface{}) error
}) (*rawAuthorRecord, error) {
	record := &rawAuthorRecord{}
	err := rowScanner.Scan(
		&record.ID,
		&record.Slug,
		&record.Email,
		&record.DisplayName,
		&record.AvatarURL,
		&record.Phone,
		&record.Bio,
		&record.Location,
		&record.PublicShowName,
		&record.PublicShowAvatar,
		&record.PublicShowBio,
		&record.PublicShowLocation,
		&record.PublicShowPhone,
		&record.PublicShowEmail,
		&record.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return record, nil
}

func (r *AuthorRepository) getRawAuthorBySlug(slug string) (*rawAuthorRecord, error) {
	query := `
		SELECT
			id,
			author_slug,
			email,
			display_name,
			avatar_url,
			phone,
			bio,
			location,
			public_show_display_name,
			public_show_avatar_url,
			public_show_bio,
			public_show_location,
			public_show_phone,
			public_show_email,
			created_at
		FROM users
		WHERE author_slug = $1
	`
	row := r.db.QueryRow(query, slug)
	record, err := r.scanAuthorRecord(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query author by slug: %w", err)
	}
	return record, nil
}

func (r *AuthorRepository) getRawAuthorByID(userID uuid.UUID) (*rawAuthorRecord, error) {
	query := `
		SELECT
			id,
			author_slug,
			email,
			display_name,
			avatar_url,
			phone,
			bio,
			location,
			public_show_display_name,
			public_show_avatar_url,
			public_show_bio,
			public_show_location,
			public_show_phone,
			public_show_email,
			created_at
		FROM users
		WHERE id = $1
	`
	row := r.db.QueryRow(query, userID)
	record, err := r.scanAuthorRecord(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query author by id: %w", err)
	}
	return record, nil
}

func toPublicAuthorProfile(record *rawAuthorRecord) *AuthorProfile {
	if record == nil {
		return nil
	}

	displayName := applyPublicFallbackDisplayName(
		record.DisplayName,
		record.Email,
		record.PublicShowName,
		record.PublicShowEmail,
	)

	var avatarURL *string
	if record.PublicShowAvatar {
		avatarURL = record.AvatarURL
	}

	var bio *string
	if record.PublicShowBio {
		bio = record.Bio
	}

	var location *string
	if record.PublicShowLocation {
		location = record.Location
	}

	var phone *string
	if record.PublicShowPhone {
		phone = record.Phone
	}

	var email *string
	if record.PublicShowEmail {
		email = record.Email
	}

	return &AuthorProfile{
		ID:          record.ID,
		Slug:        record.Slug,
		DisplayName: displayName,
		AvatarURL:   avatarURL,
		Bio:         bio,
		Location:    location,
		Phone:       phone,
		Email:       email,
		MemberSince: record.CreatedAt,
	}
}

func (r *AuthorRepository) ResolveAuthorBySlug(slug string) (*AuthorLookupResult, error) {
	normalizedSlug := normalizeLookupSlug(slug)
	if normalizedSlug == "" {
		return nil, nil
	}

	record, err := r.getRawAuthorBySlug(normalizedSlug)
	if err != nil {
		return nil, err
	}
	if record != nil {
		return &AuthorLookupResult{
			Profile:       toPublicAuthorProfile(record),
			CanonicalSlug: record.Slug,
			Redirected:    false,
		}, nil
	}

	var redirectUserID uuid.UUID
	err = r.db.QueryRow(`
		SELECT user_id
		FROM author_slug_redirects
		WHERE old_slug = $1
	`, normalizedSlug).Scan(&redirectUserID)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to query author slug redirect: %w", err)
	}

	redirectedRecord, err := r.getRawAuthorByID(redirectUserID)
	if err != nil {
		return nil, err
	}
	if redirectedRecord == nil {
		return nil, nil
	}

	return &AuthorLookupResult{
		Profile:       toPublicAuthorProfile(redirectedRecord),
		CanonicalSlug: redirectedRecord.Slug,
		Redirected:    true,
	}, nil
}

func (r *AuthorRepository) GetPublicPublishedSurveysByAuthor(
	authorUserID uuid.UUID,
	limit int,
	offset int,
	viewerUserID *uuid.UUID,
	viewerAnonymousID *string,
) ([]models.Survey, error) {
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
			s.has_unpublished_changes, s.deleted_at, s.is_hot,
			CASE
				WHEN $4::uuid IS NULL AND NULLIF($5::text, '') IS NULL THEN FALSE
				ELSE EXISTS(
					SELECT 1
					FROM survey_response_once_locks sr
					WHERE sr.survey_id = s.id
					  AND (
					  	($4::uuid IS NOT NULL AND sr.user_id = $4::uuid)
						OR (NULLIF($5::text, '') IS NOT NULL AND sr.anonymous_id = NULLIF($5::text, ''))
					  )
				)
			END AS has_responded
		FROM surveys s
		JOIN survey_versions sv ON sv.id = s.current_published_version_id
		WHERE s.user_id = $1
		  AND s.visibility = 'public'
		  AND s.deleted_at IS NULL
		  AND s.current_published_version_id IS NOT NULL
		ORDER BY s.published_at DESC NULLS LAST, s.updated_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(query, authorUserID, limit, offset, viewerArg, anonymousArg)
	if err != nil {
		return nil, fmt.Errorf("failed to query author surveys: %w", err)
	}
	defer rows.Close()

	surveys := make([]models.Survey, 0)
	for rows.Next() {
		var survey models.Survey
		var themeJSON []byte
		if err := rows.Scan(
			&survey.ID, &survey.UserID, &survey.Title, &survey.Description,
			&survey.Visibility, &survey.RequireLoginToRespond, &survey.IsResponseOpen, &survey.IncludeInDatasets,
			&survey.EverPublic, &survey.PublishedCount, &themeJSON, &survey.PointsReward,
			&survey.ExpiresAt, &survey.ResponseCount, &survey.CreatedAt,
			&survey.UpdatedAt, &survey.PublishedAt,
			&survey.CurrentPublishedVersionID, &survey.CurrentPublishedVersionNumber,
			&survey.HasUnpublishedChanges, &survey.DeletedAt, &survey.IsHot, &survey.HasResponded,
		); err != nil {
			return nil, fmt.Errorf("failed to scan author survey: %w", err)
		}

		if len(themeJSON) > 0 {
			survey.Theme = &models.SurveyTheme{}
			_ = json.Unmarshal(themeJSON, survey.Theme)
		}
		surveys = append(surveys, survey)
	}
	return surveys, nil
}

func (r *AuthorRepository) BuildSurveyAuthorSummaries(userIDs []uuid.UUID) (map[uuid.UUID]*models.SurveyAuthor, error) {
	if len(userIDs) == 0 {
		return map[uuid.UUID]*models.SurveyAuthor{}, nil
	}

	query := `
		SELECT
			id,
			author_slug,
			email,
			display_name,
			avatar_url,
			public_show_display_name,
			public_show_avatar_url,
			public_show_email
		FROM users
		WHERE id = ANY($1::uuid[])
	`
	userIDArgs := make([]string, 0, len(userIDs))
	for _, id := range userIDs {
		userIDArgs = append(userIDArgs, id.String())
	}
	rows, err := r.db.Query(query, pq.Array(userIDArgs))
	if err != nil {
		return nil, fmt.Errorf("failed to query survey authors: %w", err)
	}
	defer rows.Close()

	result := make(map[uuid.UUID]*models.SurveyAuthor, len(userIDs))
	for rows.Next() {
		var id uuid.UUID
		var slug string
		var email *string
		var displayName *string
		var avatarURL *string
		var showDisplayName bool
		var showAvatarURL bool
		var showEmail bool

		if err := rows.Scan(
			&id,
			&slug,
			&email,
			&displayName,
			&avatarURL,
			&showDisplayName,
			&showAvatarURL,
			&showEmail,
		); err != nil {
			return nil, fmt.Errorf("failed to scan survey author: %w", err)
		}

		var summaryAvatarURL *string
		if showAvatarURL {
			summaryAvatarURL = avatarURL
		}

		result[id] = &models.SurveyAuthor{
			ID:          id,
			Slug:        slug,
			DisplayName: applyPublicFallbackDisplayName(displayName, email, showDisplayName, showEmail),
			AvatarURL:   summaryAvatarURL,
		}
	}

	return result, nil
}
