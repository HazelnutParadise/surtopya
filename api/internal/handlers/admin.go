package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/TimLai666/surtopya-api/internal/database"
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
		}
	}
	if req.IncludeInDatasets != nil {
		if survey.Visibility == "public" {
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
