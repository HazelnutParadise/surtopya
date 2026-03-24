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
