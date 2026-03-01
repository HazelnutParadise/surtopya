package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/TimLai666/surtopya-api/internal/models"
	"github.com/TimLai666/surtopya-api/internal/policy"
	"github.com/TimLai666/surtopya-api/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AdminHandler handles admin management endpoints.
type AdminHandler struct {
	surveys  *repository.SurveyRepository
	datasets *repository.DatasetRepository
	policies *policy.Service
}

// NewAdminHandler creates a new AdminHandler.
func NewAdminHandler() *AdminHandler {
	db := database.GetDB()
	return &AdminHandler{
		surveys:  repository.NewSurveyRepository(db),
		datasets: repository.NewDatasetRepository(db),
		policies: policy.NewService(db),
	}
}

type AdminSurveyUpdateRequest struct {
	Title             *string `json:"title"`
	Description       *string `json:"description"`
	Visibility        *string `json:"visibility"`
	IncludeInDatasets *bool   `json:"includeInDatasets"`
	IsPublished       *bool   `json:"isPublished"`
	PointsReward      *int    `json:"pointsReward"`
}

type AdminDatasetUpdateRequest struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Category    *string `json:"category"`
	AccessType  *string `json:"accessType"`
	Price       *int    `json:"price"`
	SampleSize  *int    `json:"sampleSize"`
	IsActive    *bool   `json:"isActive"`
}

type AdminUser struct {
	ID                    uuid.UUID  `json:"id"`
	Email                 *string    `json:"email,omitempty"`
	DisplayName           *string    `json:"displayName,omitempty"`
	MembershipTier        string     `json:"membershipTier"`
	MembershipPeriodEndAt *time.Time `json:"membershipPeriodEndAt,omitempty"`
	MembershipIsPermanent bool       `json:"membershipIsPermanent"`
	IsAdmin               bool       `json:"isAdmin"`
	IsSuperAdmin          bool       `json:"isSuperAdmin"`
	CreatedAt             time.Time  `json:"createdAt"`
}

type AdminUserUpdateRequest struct {
	IsAdmin               *bool   `json:"isAdmin"`
	MembershipTier        *string `json:"membershipTier"`
	MembershipPeriodEndAt *string `json:"membershipPeriodEndAt"`
	MembershipIsPermanent *bool   `json:"membershipIsPermanent"`
}

type AdminPolicyUpdateRequest struct {
	Updates []policy.PolicyUpdate `json:"updates"`
}

type AdminPolicyWriterUpdateRequest struct {
	Enabled bool `json:"enabled"`
}

type AdminSubscriptionPlanCreateRequest struct {
	Code                    string            `json:"code"`
	NameI18n                map[string]string `json:"nameI18n"`
	DescriptionI18n         map[string]string `json:"descriptionI18n"`
	IsPurchasable           bool              `json:"isPurchasable"`
	ShowOnPricing           bool              `json:"showOnPricing"`
	PriceCentsUSD           int               `json:"priceCentsUsd"`
	BillingInterval         string            `json:"billingInterval"`
	AllowRenewalForExisting bool              `json:"allowRenewalForExisting"`
	MonthlyPointsGrant      int               `json:"monthlyPointsGrant"`
}

type AdminSubscriptionPlanPatchRequest struct {
	NameI18n                *map[string]string `json:"nameI18n"`
	DescriptionI18n         *map[string]string `json:"descriptionI18n"`
	IsPurchasable           *bool              `json:"isPurchasable"`
	ShowOnPricing           *bool              `json:"showOnPricing"`
	PriceCentsUSD           *int               `json:"priceCentsUsd"`
	BillingInterval         *string            `json:"billingInterval"`
	AllowRenewalForExisting *bool              `json:"allowRenewalForExisting"`
	MonthlyPointsGrant      *int               `json:"monthlyPointsGrant"`
}

type AdminSubscriptionPlanDeactivateRequest struct {
	ReplacementTierCode string `json:"replacementTierCode"`
	ExecutionTiming     string `json:"executionTiming"`
}

type AdminCapabilityPatchRequest struct {
	NameI18n        *map[string]string `json:"nameI18n"`
	DescriptionI18n *map[string]string `json:"descriptionI18n"`
	ShowOnPricing   *bool              `json:"showOnPricing"`
}

// GetSurveys handles GET /api/v1/admin/surveys
func (h *AdminHandler) GetSurveys(c *gin.Context) {
	search := c.Query("search")
	visibility := c.Query("visibility")
	published := c.Query("published")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	if limit > 100 {
		limit = 100
	}

	var publishedFilter *bool
	if published == "true" {
		value := true
		publishedFilter = &value
	}
	if published == "false" {
		value := false
		publishedFilter = &value
	}

	surveys, err := h.surveys.GetAllAdmin(search, visibility, publishedFilter, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get surveys"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"surveys": surveys,
		"meta": gin.H{
			"limit":  limit,
			"offset": offset,
		},
	})
}

// UpdateSurvey handles PATCH /api/v1/admin/surveys/:id
func (h *AdminHandler) UpdateSurvey(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid survey ID"})
		return
	}

	var req AdminSurveyUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	survey, err := h.surveys.GetByID(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get survey"})
		return
	}
	if survey == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Survey not found"})
		return
	}

	canOptOutPublicDataset, err := h.policies.Can(c.Request.Context(), survey.UserID, policy.CapabilitySurveyPublicDatasetOptOut)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to evaluate membership capability"})
		return
	}

	if req.Title != nil {
		survey.Title = *req.Title
	}
	if req.Description != nil {
		survey.Description = *req.Description
	}
	if req.Visibility != nil {
		if *req.Visibility != "public" && *req.Visibility != "non-public" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid visibility option"})
			return
		}
		if survey.PublishedCount > 0 && survey.Visibility != *req.Visibility {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot change visibility after first publish"})
			return
		}
		survey.Visibility = *req.Visibility
		if survey.Visibility == "public" && !canOptOutPublicDataset {
			survey.IncludeInDatasets = true
		}
		if survey.Visibility == "public" && survey.PublishedCount > 0 {
			survey.EverPublic = true
		}
	}
	if req.IncludeInDatasets != nil {
		if survey.PublishedCount > 0 && survey.IncludeInDatasets != *req.IncludeInDatasets {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot change dataset sharing after first publish"})
			return
		}
		if survey.Visibility == "public" && !canOptOutPublicDataset {
			survey.IncludeInDatasets = true
		} else {
			survey.IncludeInDatasets = *req.IncludeInDatasets
		}
	}
	if req.PointsReward != nil {
		survey.PointsReward = *req.PointsReward
	}
	if req.IsPublished != nil {
		if *req.IsPublished && !survey.IsPublished {
			survey.IsPublished = true
			survey.PublishedCount++
			now := time.Now()
			survey.PublishedAt = &now
			if survey.Visibility == "public" {
				survey.EverPublic = true
			}
		}
		if !*req.IsPublished && survey.IsPublished {
			survey.IsPublished = false
			survey.PublishedAt = nil
		}
	}
	if err := h.surveys.Update(survey); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update survey"})
		return
	}

	c.JSON(http.StatusOK, survey)
}

// DeleteSurvey handles DELETE /api/v1/admin/surveys/:id
func (h *AdminHandler) DeleteSurvey(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid survey ID"})
		return
	}

	if err := h.surveys.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete survey"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Survey deleted successfully"})
}

// GetDatasets handles GET /api/v1/admin/datasets
func (h *AdminHandler) GetDatasets(c *gin.Context) {
	search := c.Query("search")
	active := c.Query("active")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	if limit > 100 {
		limit = 100
	}

	var activeFilter *bool
	if active == "true" {
		value := true
		activeFilter = &value
	}
	if active == "false" {
		value := false
		activeFilter = &value
	}

	datasets, err := h.datasets.GetAllAdmin(search, activeFilter, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get datasets"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"datasets": datasets,
		"meta": gin.H{
			"limit":  limit,
			"offset": offset,
		},
	})
}

// CreateDataset handles POST /api/v1/admin/datasets
func (h *AdminHandler) CreateDataset(c *gin.Context) {
	surveyIDStr := strings.TrimSpace(c.PostForm("surveyId"))
	title := strings.TrimSpace(c.PostForm("title"))
	description := strings.TrimSpace(c.PostForm("description"))
	category := strings.TrimSpace(c.DefaultPostForm("category", "other"))
	accessType := strings.TrimSpace(c.DefaultPostForm("accessType", "free"))
	priceStr := strings.TrimSpace(c.DefaultPostForm("price", "0"))
	sampleSizeStr := strings.TrimSpace(c.DefaultPostForm("sampleSize", "0"))

	var surveyID *uuid.UUID
	if title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Title is required"})
		return
	}
	if accessType != "free" && accessType != "paid" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid access type"})
		return
	}

	if surveyIDStr != "" {
		parsedSurveyID, err := uuid.Parse(surveyIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid survey ID"})
			return
		}

		var exists bool
		if err := database.GetDB().QueryRow("SELECT EXISTS (SELECT 1 FROM surveys WHERE id = $1)", parsedSurveyID).Scan(&exists); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to validate survey"})
			return
		}
		if !exists {
			c.JSON(http.StatusNotFound, gin.H{"error": "Survey not found"})
			return
		}
		surveyID = &parsedSurveyID
	}

	price, err := strconv.Atoi(priceStr)
	if err != nil || price < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid price"})
		return
	}

	sampleSize, err := strconv.Atoi(sampleSizeStr)
	if err != nil || sampleSize < 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid sample size"})
		return
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Dataset file is required"})
		return
	}

	dataDir := os.Getenv("DATASETS_DIR")
	if dataDir == "" {
		dataDir = "/data/datasets"
	}
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to prepare dataset storage"})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read dataset file"})
		return
	}
	defer file.Close()

	datasetID := uuid.New()
	ext := filepath.Ext(fileHeader.Filename)
	storedName := datasetID.String()
	if ext != "" {
		storedName += ext
	}
	targetPath := filepath.Join(dataDir, storedName)

	out, err := os.Create(targetPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store dataset file"})
		return
	}
	defer out.Close()

	fileSize, err := io.Copy(out, file)
	if err != nil {
		_ = os.Remove(targetPath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store dataset file"})
		return
	}

	mimeType := fileHeader.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	descriptionValue := description
	dataset := &models.Dataset{
		ID:         datasetID,
		SurveyID:   surveyID,
		Title:      title,
		Category:   category,
		AccessType: accessType,
		Price:      price,
		SampleSize: sampleSize,
		IsActive:   true,
		FilePath:   targetPath,
		FileName:   fileHeader.Filename,
		FileSize:   fileSize,
		MimeType:   mimeType,
	}
	if descriptionValue != "" {
		dataset.Description = &descriptionValue
	}

	if err := h.datasets.Create(dataset); err != nil {
		_ = os.Remove(targetPath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create dataset"})
		return
	}

	c.JSON(http.StatusCreated, dataset)
}

// UpdateDataset handles PATCH /api/v1/admin/datasets/:id
func (h *AdminHandler) UpdateDataset(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid dataset ID"})
		return
	}

	var req AdminDatasetUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	dataset, err := h.datasets.GetByID(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get dataset"})
		return
	}
	if dataset == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Dataset not found"})
		return
	}

	if req.Title != nil {
		dataset.Title = *req.Title
	}
	if req.Description != nil {
		dataset.Description = req.Description
	}
	if req.Category != nil {
		dataset.Category = *req.Category
	}
	if req.AccessType != nil {
		if *req.AccessType != "free" && *req.AccessType != "paid" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid access type"})
			return
		}
		dataset.AccessType = *req.AccessType
	}
	if req.Price != nil {
		dataset.Price = *req.Price
	}
	if req.SampleSize != nil {
		dataset.SampleSize = *req.SampleSize
	}
	if req.IsActive != nil {
		dataset.IsActive = *req.IsActive
	}

	if err := h.datasets.Update(dataset); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update dataset"})
		return
	}

	c.JSON(http.StatusOK, dataset)
}

// DeleteDataset handles DELETE /api/v1/admin/datasets/:id
func (h *AdminHandler) DeleteDataset(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid dataset ID"})
		return
	}

	if err := h.datasets.Delete(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete dataset"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Dataset deleted successfully"})
}

// GetBootstrapStatus handles GET /api/v1/bootstrap
func (h *AdminHandler) GetBootstrapStatus(c *gin.Context) {
	var count int
	if err := database.GetDB().QueryRow("SELECT COUNT(*) FROM users WHERE is_super_admin = true").Scan(&count); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check admin status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"hasSuperAdmin": count > 0})
}

// GetUsers handles GET /api/v1/admin/users
func (h *AdminHandler) GetUsers(c *gin.Context) {
	search := c.Query("search")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	if limit > 100 {
		limit = 100
	}

	query := `
		SELECT
			u.id,
			u.email,
			u.display_name,
			COALESCE(mt.code, 'free') AS membership_tier,
			um.period_end_at,
			COALESCE(um.is_permanent, true) AS membership_is_permanent,
			u.is_admin,
			u.is_super_admin,
			u.created_at
		FROM users u
		LEFT JOIN user_memberships um ON um.user_id = u.id
		LEFT JOIN membership_tiers mt ON mt.id = um.tier_id
		WHERE 1=1
	`
	args := []interface{}{}
	argCount := 0

	if search != "" {
		argCount++
		query += " AND (u.email ILIKE $" + strconv.Itoa(argCount) + " OR u.display_name ILIKE $" + strconv.Itoa(argCount) + ")"
		args = append(args, "%"+search+"%")
	}

	argCount++
	query += " ORDER BY u.created_at DESC LIMIT $" + strconv.Itoa(argCount)
	args = append(args, limit)

	argCount++
	query += " OFFSET $" + strconv.Itoa(argCount)
	args = append(args, offset)

	rows, err := database.GetDB().Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get users"})
		return
	}
	defer rows.Close()

	var users []AdminUser
	for rows.Next() {
		var user AdminUser
		if err := rows.Scan(&user.ID, &user.Email, &user.DisplayName, &user.MembershipTier, &user.MembershipPeriodEndAt, &user.MembershipIsPermanent, &user.IsAdmin, &user.IsSuperAdmin, &user.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read users"})
			return
		}
		users = append(users, user)
	}

	c.JSON(http.StatusOK, gin.H{
		"users": users,
		"meta": gin.H{
			"limit":  limit,
			"offset": offset,
		},
	})
}

// UpdateUser handles PATCH /api/v1/admin/users/:id
func (h *AdminHandler) UpdateUser(c *gin.Context) {
	currentUserID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	var isSuperAdmin bool
	if err := database.GetDB().QueryRow("SELECT is_super_admin FROM users WHERE id = $1", currentUserID.(uuid.UUID)).Scan(&isSuperAdmin); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify admin access"})
		return
	}
	if !isSuperAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "Super admin access required"})
		return
	}

	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req AdminUserUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}
	membershipUpdateRequested := req.MembershipTier != nil || req.MembershipIsPermanent != nil || req.MembershipPeriodEndAt != nil
	if req.IsAdmin == nil && !membershipUpdateRequested {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No fields to update"})
		return
	}

	var targetIsSuper bool
	if err := database.GetDB().QueryRow("SELECT is_super_admin FROM users WHERE id = $1", id).Scan(&targetIsSuper); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
		return
	}
	if req.IsAdmin != nil && targetIsSuper && !*req.IsAdmin {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot remove super admin"})
		return
	}

	if req.IsAdmin != nil {
		if _, err := database.GetDB().Exec(
			"UPDATE users SET is_admin = $1 WHERE id = $2",
			*req.IsAdmin, id,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
			return
		}
	}

	if membershipUpdateRequested {
		currentGrant, err := h.policies.ResolveMembershipGrant(c.Request.Context(), id)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load current membership grant"})
			return
		}

		nextTier := currentGrant.TierCode
		if req.MembershipTier != nil {
			nextTier = strings.TrimSpace(*req.MembershipTier)
		}

		nextIsPermanent := currentGrant.MembershipIsPermanent
		if req.MembershipIsPermanent != nil {
			nextIsPermanent = *req.MembershipIsPermanent
		}

		nextPeriodEndAt := currentGrant.MembershipPeriodEndAt
		if req.MembershipPeriodEndAt != nil {
			if strings.TrimSpace(*req.MembershipPeriodEndAt) == "" {
				nextPeriodEndAt = nil
			} else {
				parsed, parseErr := parseMembershipPeriodEndAt(*req.MembershipPeriodEndAt)
				if parseErr != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid membershipPeriodEndAt"})
					return
				}
				nextPeriodEndAt = &parsed
			}
		}

		if err := h.policies.SetUserMembershipGrant(c.Request.Context(), id, nextTier, nextIsPermanent, nextPeriodEndAt); err != nil {
			if err == policy.ErrTierNotFound || err == policy.ErrInvalidMembershipGrant {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid membership grant payload"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update membership grant"})
			return
		}
	}

	if req.IsAdmin != nil {
		if _, err := database.GetDB().Exec(
			"UPDATE users SET is_admin = true WHERE is_super_admin = true",
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "User updated"})
}

// GetPolicies handles GET /api/v1/admin/policies
func (h *AdminHandler) GetPolicies(c *gin.Context) {
	_, _, matrix, err := h.policies.ListPolicies(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load policies"})
		return
	}
	tiers, err := h.policies.ListSubscriptionPlans(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load policies"})
		return
	}
	capabilities, err := h.policies.ListCapabilitiesAdmin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load policies"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"tiers":        tiers,
		"capabilities": capabilities,
		"matrix":       matrix,
	})
}

// UpdatePolicies handles PATCH /api/v1/admin/policies
func (h *AdminHandler) UpdatePolicies(c *gin.Context) {
	currentUserID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	canWrite, err := h.policies.IsPolicyWriter(c.Request.Context(), currentUserID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify policy write permission"})
		return
	}
	if !canWrite {
		c.JSON(http.StatusForbidden, gin.H{"error": "Policy writer permission required"})
		return
	}

	var req AdminPolicyUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if err := h.policies.UpdatePolicies(c.Request.Context(), currentUserID.(uuid.UUID), req.Updates); err != nil {
		if err == policy.ErrTierNotFound || err == policy.ErrCapabilityNotFound {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid policy update payload"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update policies"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Policies updated"})
}

// GetPolicyWriters handles GET /api/v1/admin/policy-writers
func (h *AdminHandler) GetPolicyWriters(c *gin.Context) {
	writers, err := h.policies.ListPolicyWriters(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load policy writers"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"users": writers})
}

// UpdatePolicyWriter handles PUT /api/v1/admin/policy-writers/:id
func (h *AdminHandler) UpdatePolicyWriter(c *gin.Context) {
	currentUserID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	var isSuperAdmin bool
	if err := database.GetDB().QueryRow("SELECT is_super_admin FROM users WHERE id = $1", currentUserID.(uuid.UUID)).Scan(&isSuperAdmin); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify admin access"})
		return
	}
	if !isSuperAdmin {
		c.JSON(http.StatusForbidden, gin.H{"error": "Super admin access required"})
		return
	}

	idStr := c.Param("id")
	targetUserID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req AdminPolicyWriterUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if err := h.policies.SetPolicyWriter(c.Request.Context(), currentUserID.(uuid.UUID), targetUserID, req.Enabled); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update policy writer"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Policy writer updated"})
}

// GetSubscriptionPlans handles GET /api/v1/admin/subscription-plans
func (h *AdminHandler) GetSubscriptionPlans(c *gin.Context) {
	plans, err := h.policies.ListSubscriptionPlans(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load subscription plans"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"plans": plans})
}

// CreateSubscriptionPlan handles POST /api/v1/admin/subscription-plans
func (h *AdminHandler) CreateSubscriptionPlan(c *gin.Context) {
	currentUserID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	canWrite, err := h.policies.IsPolicyWriter(c.Request.Context(), currentUserID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify policy write permission"})
		return
	}
	if !canWrite {
		c.JSON(http.StatusForbidden, gin.H{"error": "Policy writer permission required"})
		return
	}

	var req AdminSubscriptionPlanCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	plan, err := h.policies.CreateSubscriptionPlan(c.Request.Context(), policy.SubscriptionPlanCreate{
		Code:                    req.Code,
		NameI18n:                req.NameI18n,
		DescriptionI18n:         req.DescriptionI18n,
		IsPurchasable:           req.IsPurchasable,
		ShowOnPricing:           req.ShowOnPricing,
		PriceCentsUSD:           req.PriceCentsUSD,
		BillingInterval:         req.BillingInterval,
		AllowRenewalForExisting: req.AllowRenewalForExisting,
		MonthlyPointsGrant:      req.MonthlyPointsGrant,
	})
	if err != nil {
		if err == policy.ErrInvalidMembershipGrant || err == policy.ErrPlanCodeExists {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid plan payload"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create subscription plan"})
		return
	}

	c.JSON(http.StatusCreated, plan)
}

// UpdateSubscriptionPlan handles PATCH /api/v1/admin/subscription-plans/:id
func (h *AdminHandler) UpdateSubscriptionPlan(c *gin.Context) {
	currentUserID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	canWrite, err := h.policies.IsPolicyWriter(c.Request.Context(), currentUserID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify policy write permission"})
		return
	}
	if !canWrite {
		c.JSON(http.StatusForbidden, gin.H{"error": "Policy writer permission required"})
		return
	}

	planID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid subscription plan ID"})
		return
	}

	var req AdminSubscriptionPlanPatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	plan, err := h.policies.UpdateSubscriptionPlan(c.Request.Context(), planID, policy.SubscriptionPlanPatch{
		NameI18n:                req.NameI18n,
		DescriptionI18n:         req.DescriptionI18n,
		IsPurchasable:           req.IsPurchasable,
		ShowOnPricing:           req.ShowOnPricing,
		PriceCentsUSD:           req.PriceCentsUSD,
		BillingInterval:         req.BillingInterval,
		AllowRenewalForExisting: req.AllowRenewalForExisting,
		MonthlyPointsGrant:      req.MonthlyPointsGrant,
	})
	if err != nil {
		if err == policy.ErrTierNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Subscription plan not found"})
			return
		}
		if err == policy.ErrInvalidMembershipGrant {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid plan payload"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update subscription plan"})
		return
	}

	c.JSON(http.StatusOK, plan)
}

// DeactivateSubscriptionPlan handles DELETE /api/v1/admin/subscription-plans/:id
func (h *AdminHandler) DeactivateSubscriptionPlan(c *gin.Context) {
	currentUserID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	canWrite, err := h.policies.IsPolicyWriter(c.Request.Context(), currentUserID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify policy write permission"})
		return
	}
	if !canWrite {
		c.JSON(http.StatusForbidden, gin.H{"error": "Policy writer permission required"})
		return
	}

	planID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid subscription plan ID"})
		return
	}

	var req AdminSubscriptionPlanDeactivateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	updatedPlan, migratedUsers, err := h.policies.DeactivateSubscriptionPlan(c.Request.Context(), currentUserID.(uuid.UUID), planID, policy.SubscriptionPlanDeactivate{
		ReplacementTierCode: req.ReplacementTierCode,
		ExecutionTiming:     req.ExecutionTiming,
	})
	if err != nil {
		if err == policy.ErrTierNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Subscription plan not found"})
			return
		}
		if err == policy.ErrInvalidPlanDeactivation {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid plan deactivation payload"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to deactivate subscription plan"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "Subscription plan deactivated",
		"plan":          updatedPlan,
		"migratedUsers": migratedUsers,
	})
}

// UpdateCapability handles PATCH /api/v1/admin/capabilities/:id
func (h *AdminHandler) UpdateCapability(c *gin.Context) {
	currentUserID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	canWrite, err := h.policies.IsPolicyWriter(c.Request.Context(), currentUserID.(uuid.UUID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify policy write permission"})
		return
	}
	if !canWrite {
		c.JSON(http.StatusForbidden, gin.H{"error": "Policy writer permission required"})
		return
	}

	capabilityID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid capability ID"})
		return
	}

	var req AdminCapabilityPatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	capability, err := h.policies.UpdateCapabilityDisplay(c.Request.Context(), capabilityID, policy.CapabilityPatch{
		NameI18n:        req.NameI18n,
		DescriptionI18n: req.DescriptionI18n,
		ShowOnPricing:   req.ShowOnPricing,
	})
	if err != nil {
		if err == policy.ErrCapabilityNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Capability not found"})
			return
		}
		if err == policy.ErrInvalidMembershipGrant {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid capability payload"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update capability"})
		return
	}

	c.JSON(http.StatusOK, capability)
}

// GetPricingPlans handles GET /api/v1/pricing/plans
func (h *AdminHandler) GetPricingPlans(c *gin.Context) {
	locale := strings.TrimSpace(c.DefaultQuery("locale", "en"))
	plans, err := h.policies.ListPricingPlans(c.Request.Context(), locale)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load pricing plans"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"plans": plans})
}

func parseMembershipPeriodEndAt(raw string) (time.Time, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Time{}, fmt.Errorf("empty period end")
	}
	if parsed, err := time.Parse(time.RFC3339, raw); err == nil {
		return parsed.UTC(), nil
	}
	if parsed, err := time.Parse("2006-01-02", raw); err == nil {
		return time.Date(parsed.Year(), parsed.Month(), parsed.Day(), 23, 59, 59, 0, time.UTC), nil
	}
	return time.Time{}, fmt.Errorf("unsupported period end format")
}
