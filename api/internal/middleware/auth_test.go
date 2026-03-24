package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestGetUsernameClaimForSlug_StrictUsernameOnly(t *testing.T) {
	claims := jwt.MapClaims{
		"preferred_username": "preferred",
		"nickname":           "nick",
	}
	require.Equal(t, "", getUsernameClaimForSlug(claims))

	claims["username"] = "alice"
	require.Equal(t, "alice", getUsernameClaimForSlug(claims))
}

func TestSyncAuthorSlug_UsernamePromotesTempSlugAndCreatesRedirect(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	userID := uuid.New()
	currentSlug := temporaryAuthorSlug(userID)

	mock.ExpectQuery("SELECT EXISTS\\(").
		WithArgs("alice", userID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))
	mock.ExpectBegin()
	mock.ExpectExec("INSERT INTO author_slug_redirects").
		WithArgs(currentSlug, userID).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec("UPDATE users SET author_slug = \\$2 WHERE id = \\$1").
		WithArgs(userID, "alice").
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec("DELETE FROM author_slug_redirects WHERE old_slug = \\$1 AND user_id = \\$2").
		WithArgs("alice", userID).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	nextSlug, err := syncAuthorSlug(db, userID, currentSlug, "alice")
	require.NoError(t, err)
	require.Equal(t, "alice", nextSlug)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestSyncAuthorSlug_EmptyUsernameKeepsTemporarySlug(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	userID := uuid.New()
	currentSlug := temporaryAuthorSlug(userID)

	mock.ExpectQuery("SELECT EXISTS\\(").
		WithArgs(currentSlug, userID).
		WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))

	nextSlug, err := syncAuthorSlug(db, userID, currentSlug, "")
	require.NoError(t, err)
	require.Equal(t, currentSlug, nextSlug)
	require.NoError(t, mock.ExpectationsWereMet())
}

func TestAuthMiddleware_DisabledUserReturnsForbidden(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	database.DB = db
	t.Cleanup(func() { database.DB = nil })

	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": "logto|disabled-user",
	}).SignedString([]byte("development-secret-key"))
	require.NoError(t, err)

	userID := uuid.New()
	mock.ExpectQuery("SELECT id, COALESCE\\(is_disabled, false\\), COALESCE\\(author_slug, ''\\) FROM users WHERE logto_user_id = \\$1").
		WithArgs("logto|disabled-user").
		WillReturnRows(sqlmock.NewRows([]string{"id", "is_disabled", "author_slug"}).AddRow(userID, true, "u-disabled"))

	r := gin.New()
	r.Use(AuthMiddleware())
	r.GET("/private", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodGet, "/private", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()

	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusForbidden, w.Code)
	require.Contains(t, w.Body.String(), "User is disabled")
	require.NoError(t, mock.ExpectationsWereMet())
}
