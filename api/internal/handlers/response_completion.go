package handlers

import (
	"database/sql"
	"strings"

	"github.com/google/uuid"
)

func normalizeCompletionCopyText(value sql.NullString) *string {
	if !value.Valid {
		return nil
	}

	trimmed := strings.TrimSpace(value.String)
	if trimmed == "" {
		return nil
	}

	return &trimmed
}

func completionCopyPayloadFromValues(title *string, message *string) *completionCopyPayload {
	if title == nil && message == nil {
		return nil
	}

	return &completionCopyPayload{
		Title:   title,
		Message: message,
	}
}

func loadSurveyCompletionCopyTx(tx *sql.Tx, surveyID uuid.UUID) (*completionCopyPayload, error) {
	var title sql.NullString
	var message sql.NullString

	if err := tx.QueryRow(
		"SELECT completion_title, completion_message FROM surveys WHERE id = $1",
		surveyID,
	).Scan(&title, &message); err != nil {
		return nil, err
	}

	return completionCopyPayloadFromValues(
		normalizeCompletionCopyText(title),
		normalizeCompletionCopyText(message),
	), nil
}
