package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestAuthorHandler_GetAuthor_DirectSlug(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	prev := database.DB
	database.DB = db
	t.Cleanup(func() { database.DB = prev })

	authorID := uuid.New()
	now := time.Now().UTC()
	mock.ExpectQuery("FROM users\\s+WHERE author_slug = \\$1").
		WithArgs("alice").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "author_slug", "email", "display_name", "avatar_url", "phone", "bio", "location",
			"public_show_display_name", "public_show_avatar_url", "public_show_bio",
			"public_show_location", "public_show_phone", "public_show_email", "created_at",
		}).AddRow(
			authorID, "alice", "alice@example.com", "Alice", "https://img.example/avatar.png", nil, "bio", "Taipei",
			true, true, true, true, false, false, now,
		))

	mock.ExpectQuery("FROM surveys s\\s+JOIN survey_versions sv").
		WithArgs(authorID, 20, 0, nil, nil).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "user_id", "title", "description", "visibility", "require_login_to_respond", "is_response_open_effective",
			"include_in_datasets", "ever_public", "published_count", "theme", "points_reward",
			"expires_at", "response_count", "created_at", "updated_at", "published_at",
			"current_published_version_id", "current_published_version_number", "has_unpublished_changes", "deleted_at", "is_hot", "has_responded",
		}).AddRow(
			uuid.New(), authorID, "Survey A", "Desc", "public", false, true,
			true, true, 1, []byte("{}"), 3,
			nil, 12, now, now, now,
			uuid.New(), 1, false, nil, false, false,
		))

	r := gin.New()
	h := NewAuthorHandler()
	r.GET("/v1/authors/:slug", h.GetAuthor)

	req := httptest.NewRequest(http.MethodGet, "/v1/authors/alice", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var payload map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &payload))
	require.Equal(t, "alice", payload["canonicalSlug"])
	author, ok := payload["author"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "alice", author["slug"])
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestAuthorHandler_GetAuthor_RedirectSlugResolvesCanonical(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	prev := database.DB
	database.DB = db
	t.Cleanup(func() { database.DB = prev })

	authorID := uuid.New()
	now := time.Now().UTC()

	mock.ExpectQuery("FROM users\\s+WHERE author_slug = \\$1").
		WithArgs("alice-old").
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "author_slug", "email", "display_name", "avatar_url", "phone", "bio", "location",
			"public_show_display_name", "public_show_avatar_url", "public_show_bio",
			"public_show_location", "public_show_phone", "public_show_email", "created_at",
		}))

	mock.ExpectQuery("FROM author_slug_redirects").
		WithArgs("alice-old").
		WillReturnRows(sqlmock.NewRows([]string{"user_id"}).AddRow(authorID))

	mock.ExpectQuery("FROM users\\s+WHERE id = \\$1").
		WithArgs(authorID).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "author_slug", "email", "display_name", "avatar_url", "phone", "bio", "location",
			"public_show_display_name", "public_show_avatar_url", "public_show_bio",
			"public_show_location", "public_show_phone", "public_show_email", "created_at",
		}).AddRow(
			authorID, "alice", "alice@example.com", "Alice", nil, nil, nil, nil,
			true, true, false, false, false, false, now,
		))

	mock.ExpectQuery("FROM surveys s\\s+JOIN survey_versions sv").
		WithArgs(authorID, 20, 0, nil, nil).
		WillReturnRows(sqlmock.NewRows([]string{
			"id", "user_id", "title", "description", "visibility", "require_login_to_respond", "is_response_open_effective",
			"include_in_datasets", "ever_public", "published_count", "theme", "points_reward",
			"expires_at", "response_count", "created_at", "updated_at", "published_at",
			"current_published_version_id", "current_published_version_number", "has_unpublished_changes", "deleted_at", "is_hot", "has_responded",
		}))

	r := gin.New()
	h := NewAuthorHandler()
	r.GET("/v1/authors/:slug", h.GetAuthor)

	req := httptest.NewRequest(http.MethodGet, "/v1/authors/alice-old", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	var payload map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &payload))
	require.Equal(t, "alice", payload["canonicalSlug"])
	require.NoError(t, mock.ExpectationsWereMet())
}
