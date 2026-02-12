package handlers

import (
	"database/sql"
	"net/http"
	"os"
	"strconv"

	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/TimLai666/surtopya-api/internal/models"
	"github.com/TimLai666/surtopya-api/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// DatasetHandler handles dataset-related requests
type DatasetHandler struct {
	db         *sql.DB
	repo       *repository.DatasetRepository
	pointsRepo *repository.PointsRepository
}

// NewDatasetHandler creates a new DatasetHandler
func NewDatasetHandler() *DatasetHandler {
	db := database.GetDB()
	return &DatasetHandler{
		db:         db,
		repo:       repository.NewDatasetRepository(db),
		pointsRepo: repository.NewPointsRepository(db),
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
		datasets, err = h.repo.SearchSorted(search, sortBy, limit, offset)
	} else {
		datasets, err = h.repo.GetAllSorted(category, accessType, sortBy, limit, offset)
	}

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

	// Load dataset first (read-only) to validate file existence before side effects.
	dataset, err := h.repo.GetByID(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get dataset"})
		return
	}
	if dataset == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Dataset not found"})
		return
	}

	if dataset.FilePath != "" {
		if _, err := os.Stat(dataset.FilePath); err == nil {
			// Paid purchase + download_count increment are transactional.
			tx, err := h.db.Begin()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
				return
			}
			defer tx.Rollback()

			if dataset.AccessType == "paid" {
				userID, exists := c.Get("userID")
				if !exists {
					c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required for paid datasets"})
					return
				}
				if err := h.pointsRepo.DeductForDatasetTx(tx, userID.(uuid.UUID), id, dataset.Price, "Dataset download"); err != nil {
					if err == repository.ErrInsufficientPoints {
						c.JSON(http.StatusPaymentRequired, gin.H{"error": "Insufficient points"})
						return
					}
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process purchase"})
					return
				}
			}

			if _, err := tx.Exec("UPDATE datasets SET download_count = download_count + 1 WHERE id = $1", id); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update download count"})
				return
			}

			if err := tx.Commit(); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
				return
			}

			filename := dataset.FileName
			if filename == "" {
				filename = "dataset"
			}
			c.FileAttachment(dataset.FilePath, filename)
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Dataset download initiated",
		"datasetId": id,
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
