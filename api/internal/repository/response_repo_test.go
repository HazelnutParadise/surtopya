package repository

import (
	"database/sql/driver"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func uuidArgs(ids ...uuid.UUID) []driver.Value {
	args := make([]driver.Value, len(ids))
	for index, id := range ids {
		args[index] = id
	}
	return args
}

func TestResponseRepository_GetBySurveyID_LoadsAnswersInBatch(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	repo := NewResponseRepository(db)

	surveyID := uuid.New()
	responseID1 := uuid.New()
	responseID2 := uuid.New()
	questionID1 := uuid.New()
	questionID2 := uuid.New()
	now := time.Now().UTC()

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT id, survey_id, survey_version_id, survey_version_number, user_id, anonymous_id, status, points_awarded,
			started_at, completed_at, created_at
		FROM responses WHERE survey_id = $1
		ORDER BY created_at DESC
	`)).
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "survey_version_id", "survey_version_number", "user_id", "anonymous_id", "status", "points_awarded", "started_at", "completed_at", "created_at",
		}).
			AddRow(responseID1, surveyID, uuid.New(), 1, uuid.New(), nil, "completed", 9, now, now, now).
			AddRow(responseID2, surveyID, uuid.New(), 1, nil, "anon-1", "completed", 0, now, now, now),
		)

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT id, response_id, question_id, value, created_at
		FROM answers
		WHERE response_id IN ($1, $2)
		ORDER BY created_at ASC
	`)).
		WithArgs(uuidArgs(responseID1, responseID2)...).
		WillReturnRows(sqlmock.NewRows([]string{"id", "response_id", "question_id", "value", "created_at"}).
			AddRow(uuid.New(), responseID1, questionID1, []byte(`{"text":"hello"}`), now).
			AddRow(uuid.New(), responseID2, questionID2, []byte(`{"values":["A","B"]}`), now),
		)

	responses, err := repo.GetBySurveyID(surveyID)
	require.NoError(t, err)
	require.Len(t, responses, 2)
	require.Len(t, responses[0].Answers, 1)
	require.Equal(t, "hello", *responses[0].Answers[0].Value.Text)
	require.Len(t, responses[1].Answers, 1)
	require.Equal(t, []string{"A", "B"}, responses[1].Answers[0].Value.Values)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestResponseRepository_HasSurveyResponseOnceLockForUser(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	repo := NewResponseRepository(db)
	surveyID := uuid.New()
	userID := uuid.New()

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT EXISTS(
			SELECT 1
			FROM survey_response_once_locks
			WHERE survey_id = $1 AND user_id = $2
		)`)).
		WithArgs(surveyID, userID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

	exists, err := repo.HasSurveyResponseOnceLockForUser(surveyID, userID)
	require.NoError(t, err)
	require.True(t, exists)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestResponseRepository_AcquireSurveyResponseOnceLockTx(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	repo := NewResponseRepository(db)
	surveyID := uuid.New()
	responseID := uuid.New()
	userID := uuid.New()

	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta(`
		INSERT INTO survey_response_once_locks (
			id, survey_id, response_id, user_id, anonymous_id, source
		) VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT DO NOTHING`)).
		WithArgs(sqlmock.AnyArg(), surveyID, responseID, userID, nil, "authenticated_submit").
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	tx, err := db.Begin()
	require.NoError(t, err)
	inserted, err := repo.AcquireSurveyResponseOnceLockTx(tx, surveyID, responseID, &userID, nil, "authenticated_submit")
	require.NoError(t, err)
	require.True(t, inserted)
	require.NoError(t, tx.Commit())
	require.NoError(t, mock.ExpectationsWereMet())
}
