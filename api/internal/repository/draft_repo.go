package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/TimLai666/surtopya-api/internal/models"
	"github.com/google/uuid"
)

// ResponseDraftRepository handles authenticated in-progress draft persistence.
type ResponseDraftRepository struct {
	db *sql.DB
}

func NewResponseDraftRepository(db *sql.DB) *ResponseDraftRepository {
	return &ResponseDraftRepository{db: db}
}

func (r *ResponseDraftRepository) Create(draft *models.ResponseDraft) error {
	query := `
		INSERT INTO response_drafts (
			id, survey_id, survey_version_id, survey_version_number, user_id, started_at
		) VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING created_at, updated_at
	`
	if err := r.db.QueryRow(
		query,
		draft.ID,
		draft.SurveyID,
		draft.SurveyVersionID,
		draft.SurveyVersionNumber,
		draft.UserID,
		draft.StartedAt,
	).Scan(&draft.CreatedAt, &draft.UpdatedAt); err != nil {
		return fmt.Errorf("failed to create response draft: %w", err)
	}
	return nil
}

func (r *ResponseDraftRepository) GetBySurveyAndUser(surveyID uuid.UUID, userID uuid.UUID) (*models.ResponseDraft, error) {
	query := `
		SELECT id, survey_id, survey_version_id, survey_version_number, user_id, started_at, updated_at, created_at
		FROM response_drafts
		WHERE survey_id = $1 AND user_id = $2
	`
	var draft models.ResponseDraft
	err := r.db.QueryRow(query, surveyID, userID).Scan(
		&draft.ID,
		&draft.SurveyID,
		&draft.SurveyVersionID,
		&draft.SurveyVersionNumber,
		&draft.UserID,
		&draft.StartedAt,
		&draft.UpdatedAt,
		&draft.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get response draft: %w", err)
	}

	answers, err := r.GetAnswers(draft.ID)
	if err != nil {
		return nil, err
	}
	draft.Answers = answers
	return &draft, nil
}

func (r *ResponseDraftRepository) GetByIDForUser(draftID uuid.UUID, userID uuid.UUID) (*models.ResponseDraft, error) {
	query := `
		SELECT id, survey_id, survey_version_id, survey_version_number, user_id, started_at, updated_at, created_at
		FROM response_drafts
		WHERE id = $1 AND user_id = $2
	`
	var draft models.ResponseDraft
	err := r.db.QueryRow(query, draftID, userID).Scan(
		&draft.ID,
		&draft.SurveyID,
		&draft.SurveyVersionID,
		&draft.SurveyVersionNumber,
		&draft.UserID,
		&draft.StartedAt,
		&draft.UpdatedAt,
		&draft.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get response draft: %w", err)
	}

	answers, err := r.GetAnswers(draft.ID)
	if err != nil {
		return nil, err
	}
	draft.Answers = answers
	return &draft, nil
}

func (r *ResponseDraftRepository) SaveAnswer(draftID uuid.UUID, questionID uuid.UUID, value models.AnswerValue) (*models.ResponseDraftAnswer, time.Time, error) {
	valueJSON, err := json.Marshal(value)
	if err != nil {
		return nil, time.Time{}, fmt.Errorf("failed to marshal draft answer: %w", err)
	}

	answer := &models.ResponseDraftAnswer{}
	query := `
		INSERT INTO response_draft_answers (id, draft_id, question_id, value)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (draft_id, question_id)
		DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
		RETURNING id, created_at, updated_at
	`
	if err := r.db.QueryRow(query, uuid.New(), draftID, questionID, valueJSON).Scan(
		&answer.ID,
		&answer.CreatedAt,
		&answer.UpdatedAt,
	); err != nil {
		return nil, time.Time{}, fmt.Errorf("failed to save draft answer: %w", err)
	}
	answer.DraftID = draftID
	answer.QuestionID = questionID
	answer.Value = value

	var draftUpdatedAt time.Time
	if err := r.db.QueryRow(
		"UPDATE response_drafts SET updated_at = NOW() WHERE id = $1 RETURNING updated_at",
		draftID,
	).Scan(&draftUpdatedAt); err != nil {
		return nil, time.Time{}, fmt.Errorf("failed to touch draft updated_at: %w", err)
	}

	return answer, draftUpdatedAt, nil
}

func (r *ResponseDraftRepository) GetAnswers(draftID uuid.UUID) ([]models.ResponseDraftAnswer, error) {
	query := `
		SELECT id, draft_id, question_id, value, created_at, updated_at
		FROM response_draft_answers
		WHERE draft_id = $1
		ORDER BY created_at ASC
	`
	rows, err := r.db.Query(query, draftID)
	if err != nil {
		return nil, fmt.Errorf("failed to query draft answers: %w", err)
	}
	defer rows.Close()

	var answers []models.ResponseDraftAnswer
	for rows.Next() {
		var answer models.ResponseDraftAnswer
		var valueJSON []byte
		if err := rows.Scan(
			&answer.ID,
			&answer.DraftID,
			&answer.QuestionID,
			&valueJSON,
			&answer.CreatedAt,
			&answer.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan draft answer: %w", err)
		}

		if len(valueJSON) > 0 {
			_ = json.Unmarshal(valueJSON, &answer.Value)
		}
		answers = append(answers, answer)
	}

	return answers, nil
}

func (r *ResponseDraftRepository) ListByUserID(userID uuid.UUID) ([]models.ResponseDraftSummary, error) {
	query := `
		SELECT
			d.id,
			d.survey_id,
			s.title,
			d.survey_version_id,
			d.survey_version_number,
			d.started_at,
			d.updated_at,
			(s.is_response_open AND s.current_published_version_id IS NOT NULL
				AND (svp.expires_at IS NULL OR svp.expires_at > NOW())) AS can_resume
		FROM response_drafts d
		JOIN surveys s ON s.id = d.survey_id
		LEFT JOIN survey_versions svp ON svp.id = s.current_published_version_id
		WHERE d.user_id = $1
		ORDER BY d.updated_at DESC
	`
	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to list response drafts: %w", err)
	}
	defer rows.Close()

	var drafts []models.ResponseDraftSummary
	for rows.Next() {
		var draft models.ResponseDraftSummary
		if err := rows.Scan(
			&draft.ID,
			&draft.SurveyID,
			&draft.SurveyTitle,
			&draft.SurveyVersionID,
			&draft.SurveyVersionNumber,
			&draft.StartedAt,
			&draft.UpdatedAt,
			&draft.CanResume,
		); err != nil {
			return nil, fmt.Errorf("failed to scan response draft summary: %w", err)
		}
		drafts = append(drafts, draft)
	}

	return drafts, nil
}
