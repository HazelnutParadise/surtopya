package handlers

import (
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/TimLai666/surtopya-api/internal/models"
	"github.com/TimLai666/surtopya-api/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AdminHandler handles admin management endpoints.
type AdminHandler struct {
	surveys  *repository.SurveyRepository
	datasets *repository.DatasetRepository
}

// NewAdminHandler creates a new AdminHandler.
func NewAdminHandler() *AdminHandler {
	db := database.GetDB()
	return &AdminHandler{
		surveys:  repository.NewSurveyRepository(db),
		datasets: repository.NewDatasetRepository(db),
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
	ID           uuid.UUID `json:"id"`
	Email        *string   `json:"email,omitempty"`
	DisplayName  *string   `json:"displayName,omitempty"`
	IsAdmin      bool      `json:"isAdmin"`
	IsSuperAdmin bool      `json:"isSuperAdmin"`
	CreatedAt    time.Time `json:"createdAt"`
}

type AdminUserUpdateRequest struct {
	IsAdmin *bool `json:"isAdmin"`
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
		survey.Visibility = *req.Visibility
		if survey.Visibility == "public" {
			survey.IncludeInDatasets = true
			if survey.PublishedCount > 0 {
				survey.EverPublic = true
			}
		}
	}
	if req.IncludeInDatasets != nil {
		if survey.EverPublic && !*req.IncludeInDatasets {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot disable dataset sharing after public publish"})
			return
		}
		if survey.Visibility == "public" || survey.EverPublic {
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
	if survey.EverPublic {
		survey.IncludeInDatasets = true
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
		SELECT id, email, display_name, is_admin, is_super_admin, created_at
		FROM users
		WHERE 1=1
	`
	args := []interface{}{}
	argCount := 0

	if search != "" {
		argCount++
		query += " AND (email ILIKE $" + strconv.Itoa(argCount) + " OR display_name ILIKE $" + strconv.Itoa(argCount) + ")"
		args = append(args, "%"+search+"%")
	}

	argCount++
	query += " ORDER BY created_at DESC LIMIT $" + strconv.Itoa(argCount)
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
		if err := rows.Scan(&user.ID, &user.Email, &user.DisplayName, &user.IsAdmin, &user.IsSuperAdmin, &user.CreatedAt); err != nil {
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
	if req.IsAdmin == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No fields to update"})
		return
	}

	var targetIsSuper bool
	if err := database.GetDB().QueryRow("SELECT is_super_admin FROM users WHERE id = $1", id).Scan(&targetIsSuper); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
		return
	}
	if targetIsSuper && !*req.IsAdmin {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot remove super admin"})
		return
	}

	if _, err := database.GetDB().Exec(
		"UPDATE users SET is_admin = $1 WHERE id = $2",
		*req.IsAdmin, id,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}

	if _, err := database.GetDB().Exec(
		"UPDATE users SET is_admin = true WHERE is_super_admin = true",
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "User updated"})
}
