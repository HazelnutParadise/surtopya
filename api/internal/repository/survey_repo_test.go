package repository

import (
	"database/sql/driver"
	"encoding/json"
	"reflect"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/TimLai666/surtopya-api/internal/models"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func newSurveyRepoForTest(t *testing.T) (*SurveyRepository, sqlmock.Sqlmock, func()) {
	t.Helper()
	db, mock, err := sqlmock.New()
	require.NoError(t, err)

	repo := NewSurveyRepository(db)
	cleanup := func() { _ = db.Close() }
	return repo, mock, cleanup
}

type jsonArgumentMatcher struct {
	expected string
}

func (matcher jsonArgumentMatcher) Match(value driver.Value) bool {
	var raw []byte
	switch typed := value.(type) {
	case []byte:
		raw = typed
	case string:
		raw = []byte(typed)
	default:
		return false
	}

	var got any
	if err := json.Unmarshal(raw, &got); err != nil {
		return false
	}

	var expected any
	if err := json.Unmarshal([]byte(matcher.expected), &expected); err != nil {
		return false
	}

	return reflect.DeepEqual(got, expected)
}

func TestSurveyRepository_SoftDelete(t *testing.T) {
	repo, mock, cleanup := newSurveyRepoForTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	mock.ExpectExec(`UPDATE surveys SET deleted_at = NOW\(\), is_response_open = FALSE WHERE id = \$1 AND deleted_at IS NULL`).
		WithArgs(surveyID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	err := repo.SoftDelete(surveyID)
	require.NoError(t, err)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyRepository_GetByUserID_FiltersDeletedSurveys(t *testing.T) {
	repo, mock, cleanup := newSurveyRepoForTest(t)
	t.Cleanup(cleanup)

	userID := uuid.New()
	queryPattern := "WHERE s.user_id = \\$1\\s+AND s.deleted_at IS NULL"
	mock.ExpectQuery(queryPattern).
		WithArgs(userID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "user_id", "title", "description", "visibility", "require_login_to_respond", "is_response_open_effective",
			"include_in_datasets", "ever_public", "published_count", "theme", "points_reward",
			"expires_at", "response_count", "created_at", "updated_at", "published_at",
			"current_published_version_id", "current_published_version_number", "has_unpublished_changes", "deleted_at",
		}))

	surveys, err := repo.GetByUserID(userID)
	require.NoError(t, err)
	require.Len(t, surveys, 0)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyRepository_GetPublicSurveys_FiltersDeletedSurveys(t *testing.T) {
	repo, mock, cleanup := newSurveyRepoForTest(t)
	t.Cleanup(cleanup)

	queryPattern := "WHERE s.visibility = 'public'\\s+AND s.deleted_at IS NULL"
	mock.ExpectQuery(queryPattern).
		WithArgs(20, 0, nil, nil).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "user_id", "title", "description", "visibility", "require_login_to_respond", "is_response_open_effective",
			"include_in_datasets", "ever_public", "published_count", "theme", "points_reward",
			"expires_at", "response_count", "created_at", "updated_at", "published_at",
			"current_published_version_id", "current_published_version_number", "has_unpublished_changes", "deleted_at", "is_hot", "has_responded",
		}))

	surveys, err := repo.GetPublicSurveys(20, 0, "newest", nil, nil)
	require.NoError(t, err)
	require.Len(t, surveys, 0)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyRepository_GetPublicSurveys_NewestSortUsesPublishedFallback(t *testing.T) {
	repo, mock, cleanup := newSurveyRepoForTest(t)
	t.Cleanup(cleanup)

	queryPattern := `ORDER BY COALESCE\(s\.published_at, s\.created_at\) DESC, s\.id ASC`
	mock.ExpectQuery(queryPattern).
		WithArgs(20, 0, nil, nil).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "user_id", "title", "description", "visibility", "require_login_to_respond", "is_response_open_effective",
			"include_in_datasets", "ever_public", "published_count", "theme", "points_reward",
			"expires_at", "response_count", "created_at", "updated_at", "published_at",
			"current_published_version_id", "current_published_version_number", "has_unpublished_changes", "deleted_at", "is_hot", "has_responded",
		}))

	surveys, err := repo.GetPublicSurveys(20, 0, "newest", nil, nil)
	require.NoError(t, err)
	require.Len(t, surveys, 0)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyRepository_GetPublicSurveys_RecommendedSortUsesResponseDemotionAndScore(t *testing.T) {
	repo, mock, cleanup := newSurveyRepoForTest(t)
	t.Cleanup(cleanup)

	queryPattern := `(?s)ROW_NUMBER\(\) OVER \(\s*PARTITION BY e\.user_id\s*ORDER BY e\.first_published_at ASC, e\.id ASC\s*\)\s+AS author_publish_rank.*ORDER BY\s*wp\.has_responded ASC.*wp\.first_published_at - wp\.previous_first_published_at >= INTERVAL '90 days'.*CASE WHEN wp\.author_publish_rank <= 5 THEN 0\.03 ELSE 0\.0 END`
	mock.ExpectQuery(queryPattern).
		WithArgs(20, 0, nil, nil).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "user_id", "title", "description", "visibility", "require_login_to_respond", "is_response_open_effective",
			"include_in_datasets", "ever_public", "published_count", "theme", "points_reward",
			"expires_at", "response_count", "created_at", "updated_at", "published_at",
			"current_published_version_id", "current_published_version_number", "has_unpublished_changes", "deleted_at", "is_hot", "has_responded",
		}))

	surveys, err := repo.GetPublicSurveys(20, 0, "recommended", nil, nil)
	require.NoError(t, err)
	require.Len(t, surveys, 0)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyRepository_GetByIDForViewer_UsesUserContextForHasResponded(t *testing.T) {
	repo, mock, cleanup := newSurveyRepoForTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	userID := uuid.New()
	now := time.Now().UTC()

	mock.ExpectQuery("WHERE s.id = \\$1\\s+AND s.deleted_at IS NULL").
		WithArgs(surveyID, userID, nil).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "user_id", "title", "description", "visibility", "require_login_to_respond", "is_response_open_effective",
			"include_in_datasets", "ever_public", "published_count", "theme", "points_reward",
			"expires_at", "response_count", "created_at", "updated_at", "published_at",
			"current_published_version_id", "current_published_version_number", "has_unpublished_changes", "has_responded", "deleted_at",
		}).AddRow(
			surveyID, userID, "Survey", "Desc", "public", false, true,
			true, true, 1, []byte("{}"), 0,
			nil, 3, now, now, now,
			nil, nil, false, true, nil,
		))

	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "type", "title", "description", "options", "required",
			"max_rating", "logic", "sort_order", "created_at", "updated_at",
		}))

	survey, err := repo.GetByIDForViewer(surveyID, &userID, nil)
	require.NoError(t, err)
	require.NotNil(t, survey)
	require.True(t, survey.HasResponded)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyRepository_GetByIDForViewer_UsesAnonymousContextForHasResponded(t *testing.T) {
	repo, mock, cleanup := newSurveyRepoForTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	userID := uuid.New()
	anonymousID := "anon-123"
	now := time.Now().UTC()

	mock.ExpectQuery("WHERE s.id = \\$1\\s+AND s.deleted_at IS NULL").
		WithArgs(surveyID, nil, anonymousID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "user_id", "title", "description", "visibility", "require_login_to_respond", "is_response_open_effective",
			"include_in_datasets", "ever_public", "published_count", "theme", "points_reward",
			"expires_at", "response_count", "created_at", "updated_at", "published_at",
			"current_published_version_id", "current_published_version_number", "has_unpublished_changes", "has_responded", "deleted_at",
		}).AddRow(
			surveyID, userID, "Survey", "Desc", "public", false, true,
			true, true, 1, []byte("{}"), 0,
			nil, 3, now, now, now,
			nil, nil, false, true, nil,
		))

	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "type", "title", "description", "options", "required",
			"max_rating", "logic", "sort_order", "created_at", "updated_at",
		}))

	survey, err := repo.GetByIDForViewer(surveyID, nil, &anonymousID)
	require.NoError(t, err)
	require.NotNil(t, survey)
	require.True(t, survey.HasResponded)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyRepository_GetByIDForViewer_NoViewerDefaultsHasRespondedFalse(t *testing.T) {
	repo, mock, cleanup := newSurveyRepoForTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	userID := uuid.New()
	now := time.Now().UTC()

	mock.ExpectQuery("WHERE s.id = \\$1\\s+AND s.deleted_at IS NULL").
		WithArgs(surveyID, nil, nil).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "user_id", "title", "description", "visibility", "require_login_to_respond", "is_response_open_effective",
			"include_in_datasets", "ever_public", "published_count", "theme", "points_reward",
			"expires_at", "response_count", "created_at", "updated_at", "published_at",
			"current_published_version_id", "current_published_version_number", "has_unpublished_changes", "has_responded", "deleted_at",
		}).AddRow(
			surveyID, userID, "Survey", "Desc", "public", false, true,
			true, true, 1, []byte("{}"), 0,
			nil, 3, now, now, now,
			nil, nil, false, false, nil,
		))

	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "type", "title", "description", "options", "required",
			"max_rating", "logic", "sort_order", "created_at", "updated_at",
		}))

	survey, err := repo.GetByIDForViewer(surveyID, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, survey)
	require.False(t, survey.HasResponded)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyRepository_RecomputeHotSurveysUTC_MarksTopTenPercent(t *testing.T) {
	repo, mock, cleanup := newSurveyRepoForTest(t)
	t.Cleanup(cleanup)

	now := time.Now().UTC()
	rows := sqlmock.NewRows([]string{"id", "ranking_published_at", "completed_count_30d"})
	ids := make([]uuid.UUID, 0, 20)
	for i := 0; i < 20; i++ {
		id := uuid.New()
		ids = append(ids, id)
		rows.AddRow(id, now.Add(time.Duration(i)*time.Minute), int64(20-i))
	}

	mock.ExpectQuery(`SELECT s\.id,\s*COALESCE\(s\.published_at, s\.created_at\) AS ranking_published_at`).
		WillReturnRows(rows)
	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE surveys SET is_hot = FALSE WHERE is_hot = TRUE`).
		WillReturnResult(sqlmock.NewResult(0, 3))
	mock.ExpectExec(`UPDATE surveys SET is_hot = TRUE WHERE id IN \(\$1, \$2\)`).
		WithArgs(ids[0], ids[1]).
		WillReturnResult(sqlmock.NewResult(0, 2))
	mock.ExpectCommit()

	hotCount, err := repo.RecomputeHotSurveysUTC()
	require.NoError(t, err)
	require.EqualValues(t, 2, hotCount)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyRepository_RecomputeHotSurveysUTC_UsesOneSlotWhenCandidateCountBelowTen(t *testing.T) {
	repo, mock, cleanup := newSurveyRepoForTest(t)
	t.Cleanup(cleanup)

	now := time.Now().UTC()
	rows := sqlmock.NewRows([]string{"id", "ranking_published_at", "completed_count_30d"})
	ids := make([]uuid.UUID, 0, 5)
	for i := 0; i < 5; i++ {
		id := uuid.New()
		ids = append(ids, id)
		rows.AddRow(id, now.Add(time.Duration(i)*time.Minute), int64(5-i))
	}

	mock.ExpectQuery(`SELECT s\.id,\s*COALESCE\(s\.published_at, s\.created_at\) AS ranking_published_at`).
		WillReturnRows(rows)
	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE surveys SET is_hot = FALSE WHERE is_hot = TRUE`).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(`UPDATE surveys SET is_hot = TRUE WHERE id IN \(\$1\)`).
		WithArgs(ids[0]).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	hotCount, err := repo.RecomputeHotSurveysUTC()
	require.NoError(t, err)
	require.EqualValues(t, 1, hotCount)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyRepository_RecomputeHotSurveysUTC_DoesNotMarkHotWhenAllCountsAreZero(t *testing.T) {
	repo, mock, cleanup := newSurveyRepoForTest(t)
	t.Cleanup(cleanup)

	now := time.Now().UTC()
	rows := sqlmock.NewRows([]string{"id", "ranking_published_at", "completed_count_30d"})
	for i := 0; i < 6; i++ {
		rows.AddRow(uuid.New(), now.Add(time.Duration(i)*time.Minute), int64(0))
	}

	mock.ExpectQuery(`SELECT s\.id,\s*COALESCE\(s\.published_at, s\.created_at\) AS ranking_published_at`).
		WillReturnRows(rows)
	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE surveys SET is_hot = FALSE WHERE is_hot = TRUE`).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	hotCount, err := repo.RecomputeHotSurveysUTC()
	require.NoError(t, err)
	require.EqualValues(t, 0, hotCount)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyRepository_GetQuestions_NormalizesStructuredOptions(t *testing.T) {
	repo, mock, cleanup := newSurveyRepoForTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	questionID := uuid.New()
	now := time.Now().UTC()

	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "type", "title", "description", "options", "required",
			"max_rating", "logic", "sort_order", "created_at", "updated_at",
		}).AddRow(
			questionID,
			surveyID,
			"single",
			"Favorite option",
			"Desc",
			[]byte(`[{"label":"Regular"},{"label":"Can add details","isOther":true,"requireOtherText":true}]`),
			true,
			0,
			[]byte(`[]`),
			0,
			now,
			now,
		))

	questions, err := repo.GetQuestions(surveyID)
	require.NoError(t, err)
	require.Len(t, questions, 1)

	optionsJSON, err := json.Marshal(questions[0].Options)
	require.NoError(t, err)
	require.JSONEq(t, `[{"label":"Regular"},{"label":"Can add details","isOther":true,"requireOtherText":true}]`, string(optionsJSON))
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyRepository_GetQuestions_NormalizesLegacyStringOptions(t *testing.T) {
	repo, mock, cleanup := newSurveyRepoForTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	questionID := uuid.New()
	now := time.Now().UTC()

	mock.ExpectQuery("FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "survey_id", "type", "title", "description", "options", "required",
			"max_rating", "logic", "sort_order", "created_at", "updated_at",
		}).AddRow(
			questionID,
			surveyID,
			"single",
			"Favorite color",
			"Desc",
			[]byte(`["Red","Blue"]`),
			true,
			0,
			[]byte(`[]`),
			0,
			now,
			now,
		))

	questions, err := repo.GetQuestions(surveyID)
	require.NoError(t, err)
	require.Len(t, questions, 1)

	optionsJSON, err := json.Marshal(questions[0].Options)
	require.NoError(t, err)
	require.JSONEq(t, `[{"label":"Red"},{"label":"Blue"}]`, string(optionsJSON))
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSurveyRepository_SaveQuestions_WritesStructuredOptions(t *testing.T) {
	repo, mock, cleanup := newSurveyRepoForTest(t)
	t.Cleanup(cleanup)

	surveyID := uuid.New()
	questionID := uuid.New()

	mock.ExpectBegin()
	mock.ExpectExec("DELETE FROM questions WHERE survey_id = \\$1").
		WithArgs(surveyID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO questions").
		WithArgs(
			questionID,
			surveyID,
			"single",
			"Favorite option",
			sqlmock.AnyArg(),
			jsonArgumentMatcher{expected: `[{"label":"Regular"},{"label":"Can add details","isOther":true,"requireOtherText":true}]`},
			true,
			0,
			jsonArgumentMatcher{expected: `[]`},
			0,
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	err := repo.SaveQuestions(surveyID, []models.Question{
		{
			ID:          questionID,
			SurveyID:    surveyID,
			Type:        "single",
			Title:       "Favorite option",
			Description: ptrString("Desc"),
			Options: models.QuestionOptions{
				{Label: "Regular"},
				{Label: "Can add details", IsOther: true, RequireOtherText: true},
			},
			Required:  true,
			MaxRating: 0,
			Logic:     []models.LogicRule{},
			SortOrder: 0,
		},
	})
	require.NoError(t, err)
	require.NoError(t, mock.ExpectationsWereMet())
}

func ptrString(value string) *string {
	return &value
}
