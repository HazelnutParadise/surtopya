package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/TimLai666/surtopya-api/internal/models"
	"github.com/TimLai666/surtopya-api/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const anonymousAuthorDisplayName = ""

type AuthorHandler struct {
	repo *repository.AuthorRepository
}

func NewAuthorHandler() *AuthorHandler {
	return &AuthorHandler{
		repo: repository.NewAuthorRepository(database.GetDB()),
	}
}

type AuthorResponsePayload struct {
	Author        AuthorPublicPayload `json:"author"`
	Surveys       []models.Survey     `json:"surveys"`
	CanonicalSlug string              `json:"canonicalSlug"`
	Meta          gin.H               `json:"meta"`
}

type AuthorPublicPayload struct {
	ID          uuid.UUID `json:"id"`
	Slug        string    `json:"slug"`
	DisplayName string    `json:"displayName"`
	AvatarURL   *string   `json:"avatarUrl,omitempty"`
	Bio         *string   `json:"bio,omitempty"`
	Location    *string   `json:"location,omitempty"`
	Phone       *string   `json:"phone,omitempty"`
	Email       *string   `json:"email,omitempty"`
	MemberSince string    `json:"memberSince"`
}

// GetAuthor handles GET /v1/authors/:slug and /api/app/authors/:slug.
func (h *AuthorHandler) GetAuthor(c *gin.Context) {
	slug := c.Param("slug")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	result, err := h.repo.ResolveAuthorBySlug(slug)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resolve author"})
		return
	}
	if result == nil || result.Profile == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Author not found"})
		return
	}

	var viewerUserID *uuid.UUID
	var viewerAnonymousID *string

	if userID, exists := c.Get("userID"); exists {
		if parsed, ok := userID.(uuid.UUID); ok {
			viewerUserID = &parsed
		}
	}

	if anonymousID := strings.TrimSpace(c.GetHeader("X-Surtopya-Anonymous-Id")); anonymousID != "" {
		viewerAnonymousID = &anonymousID
	}

	surveys, err := h.repo.GetPublicPublishedSurveysByAuthor(
		result.Profile.ID,
		limit,
		offset,
		viewerUserID,
		viewerAnonymousID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get author surveys"})
		return
	}

	authorSummary := &models.SurveyAuthor{
		ID:          result.Profile.ID,
		Slug:        result.Profile.Slug,
		DisplayName: chooseAnonymousAuthorLabel(result.Profile.DisplayName, anonymousAuthorDisplayName),
		AvatarURL:   result.Profile.AvatarURL,
	}
	for i := range surveys {
		surveys[i].Author = authorSummary
	}

	c.JSON(http.StatusOK, AuthorResponsePayload{
		Author: AuthorPublicPayload{
			ID:          result.Profile.ID,
			Slug:        result.Profile.Slug,
			DisplayName: chooseAnonymousAuthorLabel(result.Profile.DisplayName, anonymousAuthorDisplayName),
			AvatarURL:   result.Profile.AvatarURL,
			Bio:         result.Profile.Bio,
			Location:    result.Profile.Location,
			Phone:       result.Profile.Phone,
			Email:       result.Profile.Email,
			MemberSince: result.Profile.MemberSince.Format("2006-01-02T15:04:05Z07:00"),
		},
		Surveys:       surveys,
		CanonicalSlug: result.CanonicalSlug,
		Meta: gin.H{
			"limit":  limit,
			"offset": offset,
		},
	})
}
