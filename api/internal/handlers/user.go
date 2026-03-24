package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/TimLai666/surtopya-api/internal/middleware"
	"github.com/TimLai666/surtopya-api/internal/policy"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// UserHandler handles user profile requests.
type UserHandler struct{}

// NewUserHandler creates a new UserHandler.
func NewUserHandler() *UserHandler {
	return &UserHandler{}
}

type UserProfileResponse struct {
	ID                    uuid.UUID       `json:"id"`
	Email                 *string         `json:"email,omitempty"`
	DisplayName           *string         `json:"displayName,omitempty"`
	AvatarURL             *string         `json:"avatarUrl,omitempty"`
	Phone                 *string         `json:"phone,omitempty"`
	Bio                   *string         `json:"bio,omitempty"`
	Location              *string         `json:"location,omitempty"`
	PointsBalance         int             `json:"pointsBalance"`
	NextMonthlyGrantAt    *time.Time      `json:"nextMonthlyPointsGrantAt,omitempty"`
	MonthlyPointsGrant    int             `json:"monthlyPointsGrant"`
	MembershipTier        string          `json:"membershipTier"`
	MembershipPeriodEndAt *time.Time      `json:"membershipPeriodEndAt,omitempty"`
	MembershipIsPermanent bool            `json:"membershipIsPermanent"`
	Capabilities          map[string]bool `json:"capabilities"`
	IsAdmin               bool            `json:"isAdmin"`
	IsSuperAdmin          bool            `json:"isSuperAdmin"`
	Locale                string          `json:"locale"`
	PublicProfile         PublicProfile   `json:"publicProfile"`
	CreatedAt             time.Time       `json:"createdAt"`
	SurveysCompleted      int             `json:"surveysCompleted"`
}

type PublicProfile struct {
	ShowDisplayName bool `json:"showDisplayName"`
	ShowAvatar      bool `json:"showAvatar"`
	ShowBio         bool `json:"showBio"`
	ShowLocation    bool `json:"showLocation"`
	ShowPhone       bool `json:"showPhone"`
	ShowEmail       bool `json:"showEmail"`
}

type PublicProfileUpdateRequest struct {
	ShowDisplayName *bool `json:"showDisplayName"`
	ShowAvatar      *bool `json:"showAvatar"`
	ShowBio         *bool `json:"showBio"`
	ShowLocation    *bool `json:"showLocation"`
	ShowPhone       *bool `json:"showPhone"`
	ShowEmail       *bool `json:"showEmail"`
}

type UpdateUserProfileRequest struct {
	DisplayName   *string                     `json:"displayName"`
	Email         *string                     `json:"email"`
	AvatarURL     *string                     `json:"avatarUrl"`
	Phone         *string                     `json:"phone"`
	Bio           *string                     `json:"bio"`
	Location      *string                     `json:"location"`
	PublicProfile *PublicProfileUpdateRequest `json:"publicProfile"`
}

// GetProfile handles GET /v1/me
func (h *UserHandler) GetProfile(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	db := database.GetDB()

	var profile UserProfileResponse
	profile.ID = userID.(uuid.UUID)

	err := db.QueryRow(`
		SELECT email, display_name, avatar_url, phone, bio, location,
			points_balance, pro_points_next_grant_at, is_admin, is_super_admin, locale,
			public_show_display_name, public_show_avatar_url, public_show_bio,
			public_show_location, public_show_phone, public_show_email,
			created_at
		FROM users WHERE id = $1
	`, profile.ID).Scan(
		&profile.Email, &profile.DisplayName, &profile.AvatarURL,
		&profile.Phone, &profile.Bio, &profile.Location,
		&profile.PointsBalance, &profile.NextMonthlyGrantAt, &profile.IsAdmin, &profile.IsSuperAdmin,
		&profile.Locale,
		&profile.PublicProfile.ShowDisplayName,
		&profile.PublicProfile.ShowAvatar,
		&profile.PublicProfile.ShowBio,
		&profile.PublicProfile.ShowLocation,
		&profile.PublicProfile.ShowPhone,
		&profile.PublicProfile.ShowEmail,
		&profile.CreatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user profile"})
		return
	}

	if !profile.IsSuperAdmin {
		promoted, err := middleware.EnsureSuperAdmin(profile.ID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify admin access"})
			return
		}
		if promoted {
			profile.IsAdmin = true
			profile.IsSuperAdmin = true
		}
	}

	if err := db.QueryRow(`
		SELECT COUNT(*) FROM responses WHERE user_id = $1 AND status = 'completed'
	`, profile.ID).Scan(&profile.SurveysCompleted); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user stats"})
		return
	}

	policySvc := policy.NewService(db)
	grant, err := policySvc.ResolveMembershipGrant(c.Request.Context(), profile.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get membership tier"})
		return
	}
	capabilities, err := policySvc.ResolveCapabilities(c.Request.Context(), profile.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get capabilities"})
		return
	}
	profile.MembershipTier = grant.TierCode
	profile.MembershipPeriodEndAt = grant.MembershipPeriodEndAt
	profile.MembershipIsPermanent = grant.MembershipIsPermanent
	profile.Capabilities = capabilities

	if err := db.QueryRow(`
		SELECT COALESCE(monthly_points_grant, 0)
		FROM membership_tiers
		WHERE code = $1
	`, grant.TierCode).Scan(&profile.MonthlyPointsGrant); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get monthly points grant"})
		return
	}

	if profile.MonthlyPointsGrant <= 0 {
		profile.NextMonthlyGrantAt = nil
	}

	c.JSON(http.StatusOK, profile)
}

// UpdateProfile handles PATCH /v1/me
func (h *UserHandler) UpdateProfile(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var req UpdateUserProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	db := database.GetDB()
	query := "UPDATE users SET"
	args := []interface{}{}
	argCount := 0

	if req.DisplayName != nil {
		argCount++
		query += " display_name = $" + strconv.Itoa(argCount) + ","
		args = append(args, req.DisplayName)
	}
	if req.Email != nil {
		argCount++
		query += " email = $" + strconv.Itoa(argCount) + ","
		args = append(args, req.Email)
	}
	if req.AvatarURL != nil {
		argCount++
		query += " avatar_url = $" + strconv.Itoa(argCount) + ","
		args = append(args, req.AvatarURL)
	}
	if req.Phone != nil {
		argCount++
		query += " phone = $" + strconv.Itoa(argCount) + ","
		args = append(args, req.Phone)
	}
	if req.Bio != nil {
		argCount++
		query += " bio = $" + strconv.Itoa(argCount) + ","
		args = append(args, req.Bio)
	}
	if req.Location != nil {
		argCount++
		query += " location = $" + strconv.Itoa(argCount) + ","
		args = append(args, req.Location)
	}
	if req.PublicProfile != nil {
		if req.PublicProfile.ShowDisplayName != nil {
			argCount++
			query += " public_show_display_name = $" + strconv.Itoa(argCount) + ","
			args = append(args, *req.PublicProfile.ShowDisplayName)
		}
		if req.PublicProfile.ShowAvatar != nil {
			argCount++
			query += " public_show_avatar_url = $" + strconv.Itoa(argCount) + ","
			args = append(args, *req.PublicProfile.ShowAvatar)
		}
		if req.PublicProfile.ShowBio != nil {
			argCount++
			query += " public_show_bio = $" + strconv.Itoa(argCount) + ","
			args = append(args, *req.PublicProfile.ShowBio)
		}
		if req.PublicProfile.ShowLocation != nil {
			argCount++
			query += " public_show_location = $" + strconv.Itoa(argCount) + ","
			args = append(args, *req.PublicProfile.ShowLocation)
		}
		if req.PublicProfile.ShowPhone != nil {
			argCount++
			query += " public_show_phone = $" + strconv.Itoa(argCount) + ","
			args = append(args, *req.PublicProfile.ShowPhone)
		}
		if req.PublicProfile.ShowEmail != nil {
			argCount++
			query += " public_show_email = $" + strconv.Itoa(argCount) + ","
			args = append(args, *req.PublicProfile.ShowEmail)
		}
	}

	if argCount == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No fields to update"})
		return
	}

	query = query[:len(query)-1]
	argCount++
	query += " WHERE id = $" + strconv.Itoa(argCount)
	args = append(args, userID.(uuid.UUID))

	if _, err := db.Exec(query, args...); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user profile"})
		return
	}

	c.Status(http.StatusNoContent)
}
