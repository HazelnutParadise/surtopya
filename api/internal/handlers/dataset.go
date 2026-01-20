package handlers

import (
	"net/http"
	"strconv"

	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/TimLai666/surtopya-api/internal/models"
	"github.com/TimLai666/surtopya-api/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// DatasetHandler handles dataset-related requests
type DatasetHandler struct {
	repo *repository.DatasetRepository
}

// NewDatasetHandler creates a new DatasetHandler
func NewDatasetHandler() *DatasetHandler {
	return &DatasetHandler{
		repo: repository.NewDatasetRepository(database.GetDB()),
	}
}

// GetDatasets handles GET /api/v1/datasets
func (h *DatasetHandler) GetDatasets(c *gin.Context) {
	category := c.Query("category")
	accessType := c.Query("accessType")
	search := c.Query("search")
	sortBy := c.DefaultQuery("sort", "newest")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	if limit > 100 {
		limit = 100
	}

	var datasets []models.Dataset
	var err error

	if search != "" {
		datasets, err = h.repo.Search(search, limit, offset)
	} else {
		datasets, err = h.repo.GetAll(category, accessType, limit, offset)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get datasets"})
		return
	}

	// Sort results (basic in-memory sort for now)
	// In production, this should be done in the SQL query
	_ = sortBy // TODO: Implement sorting in repository

	c.JSON(http.StatusOK, gin.H{
		"datasets": datasets,
		"meta": gin.H{
			"limit":  limit,
			"offset": offset,
		},
	})
}

// GetDataset handles GET /api/v1/datasets/:id
func (h *DatasetHandler) GetDataset(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid dataset ID"})
		return
	}

	dataset, err := h.repo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get dataset"})
		return
	}

	if dataset == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Dataset not found"})
		return
	}

	c.JSON(http.StatusOK, dataset)
}

// DownloadDataset handles POST /api/v1/datasets/:id/download
func (h *DatasetHandler) DownloadDataset(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid dataset ID"})
		return
	}

	dataset, err := h.repo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get dataset"})
		return
	}

	if dataset == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Dataset not found"})
		return
	}

	// Check if paid and user has sufficient points
	if dataset.AccessType == "paid" {
		userID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required for paid datasets"})
			return
		}
		// TODO: Check user's points balance and deduct
		_ = userID
	}

	// Increment download count
	h.repo.IncrementDownloadCount(id)

	// TODO: Return actual dataset data
	// For now, return a placeholder response
	c.JSON(http.StatusOK, gin.H{
		"message":   "Dataset download initiated",
		"datasetId": id,
		// In production, this would include a download URL or the actual data
	})
}

// GetCategories handles GET /api/v1/datasets/categories
func (h *DatasetHandler) GetCategories(c *gin.Context) {
	// Return available categories
	categories := []gin.H{
		{"id": "market-research", "name": "Market Research", "description": "Consumer preferences and market trends"},
		{"id": "social-science", "name": "Social Science", "description": "Social behavior and demographics"},
		{"id": "technology", "name": "Technology", "description": "Tech usage and preferences"},
		{"id": "healthcare", "name": "Healthcare", "description": "Health and wellness surveys"},
		{"id": "finance", "name": "Finance", "description": "Financial behavior and preferences"},
		{"id": "consumer-goods", "name": "Consumer Goods", "description": "Product feedback and preferences"},
		{"id": "other", "name": "Other", "description": "Miscellaneous datasets"},
	}

	c.JSON(http.StatusOK, gin.H{"categories": categories})
}
