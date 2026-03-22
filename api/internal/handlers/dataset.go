package handlers

import (
	"database/sql"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"

	"github.com/TimLai666/surtopya-api/internal/database"
	"github.com/TimLai666/surtopya-api/internal/models"
	"github.com/TimLai666/surtopya-api/internal/platformlog"
	"github.com/TimLai666/surtopya-api/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// DatasetHandler handles dataset-related requests
type DatasetHandler struct {
	db         *sql.DB
	repo       *repository.DatasetRepository
	pointsRepo *repository.PointsRepository
	logger     *platformlog.Logger
}

type datasetVersionRequest struct {
	VersionNumber *int `json:"version_number"`
}

// NewDatasetHandler creates a new DatasetHandler
func NewDatasetHandler() *DatasetHandler {
	db := database.GetDB()
	return &DatasetHandler{
		db:         db,
		repo:       repository.NewDatasetRepository(db),
		pointsRepo: repository.NewPointsRepository(db),
		logger:     platformlog.NewLogger(db),
	}
}

// GetDatasets handles GET /v1/datasets
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

// GetDataset handles GET /v1/datasets/:id
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

// DownloadDataset handles POST /v1/datasets/:id/download
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

	versionNumber, err := readVersionNumber(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid version number"})
		return
	}

	targetVersion, err := h.repo.ResolveDownloadVersion(id, versionNumber)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resolve dataset version"})
		return
	}
	if targetVersion == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Dataset version not found"})
		return
	}

	if targetVersion.FilePath == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "Dataset file unavailable"})
		return
	}
	if _, err := os.Stat(targetVersion.FilePath); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Dataset file unavailable"})
		return
	}

	tx, err := h.db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}
	defer tx.Rollback()

	requestedByUser := (*uuid.UUID)(nil)
	if targetVersion.AccessType == "paid" {
		rawUserID, exists := c.Get("userID")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required for paid dataset versions"})
			return
		}
		userID := rawUserID.(uuid.UUID)
		requestedByUser = &userID

		entitled, err := h.checkDownloadEntitlementTx(tx, userID, dataset, targetVersion)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify purchase entitlement"})
			return
		}
		if !entitled {
			c.JSON(http.StatusPaymentRequired, gin.H{"error": "Purchase required for this dataset version"})
			return
		}
	}

	if err := h.repo.IncrementDownloadCountForVersionTx(tx, targetVersion.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update dataset version download count"})
		return
	}
	if _, err := tx.Exec("UPDATE datasets SET download_count = download_count + 1 WHERE id = $1", id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update download count"})
		return
	}
	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit transaction"})
		return
	}

	platformlog.LogFromGin(c, h.logger, platformlog.EventInput{
		EventType:    "domain",
		Module:       "datasets",
		Action:       "download",
		Status:       "success",
		ResourceType: "dataset",
		ResourceID:   id.String(),
		RequestSummary: map[string]any{
			"version_number": targetVersion.VersionNumber,
			"access_type":    targetVersion.AccessType,
			"price":          targetVersion.Price,
			"user_id":        requestedByUser,
		},
	})

	filename := targetVersion.FileName
	if filename == "" {
		filename = "dataset"
	}
	c.FileAttachment(targetVersion.FilePath, filename)
}

// PurchaseDataset handles POST /v1/datasets/:id/purchase
func (h *DatasetHandler) PurchaseDataset(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid dataset ID"})
		return
	}

	rawUserID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}
	userID := rawUserID.(uuid.UUID)

	versionNumber, err := readVersionNumber(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid version number"})
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

	targetVersion, err := h.repo.ResolveDownloadVersion(id, versionNumber)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resolve dataset version"})
		return
	}
	if targetVersion == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Dataset version not found"})
		return
	}

	if targetVersion.AccessType != "paid" {
		c.JSON(http.StatusOK, gin.H{
			"message":        "This dataset version is free and does not require purchase",
			"dataset_id":     id,
			"version_number": targetVersion.VersionNumber,
			"already_owned":  true,
		})
		return
	}

	tx, err := h.db.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start transaction"})
		return
	}
	defer tx.Rollback()

	alreadyOwned, err := h.repo.HasPurchaseForVersionTx(tx, userID, targetVersion.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to inspect purchase records"})
		return
	}
	if alreadyOwned {
		if err := tx.Commit(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to finalize purchase check"})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"message":        "Dataset version already purchased",
			"dataset_id":     id,
			"version_number": targetVersion.VersionNumber,
			"already_owned":  true,
		})
		return
	}

	description := fmt.Sprintf("Dataset version %d purchase", targetVersion.VersionNumber)
	if err := h.pointsRepo.DeductForDatasetTx(tx, userID, id, targetVersion.Price, description); err != nil {
		if err == repository.ErrInsufficientPoints {
			c.JSON(http.StatusPaymentRequired, gin.H{"error": "Insufficient points"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process purchase"})
		return
	}

	purchase := &models.DatasetPurchase{
		ID:               uuid.New(),
		UserID:           userID,
		DatasetID:        id,
		DatasetVersionID: targetVersion.ID,
		PricePaid:        targetVersion.Price,
	}
	if err := h.repo.CreatePurchaseTx(tx, purchase); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create purchase record"})
		return
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit purchase"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":            "Purchase completed",
		"dataset_id":         id,
		"dataset_version":    targetVersion.VersionNumber,
		"dataset_version_id": targetVersion.ID,
		"price_paid":         targetVersion.Price,
		"already_owned":      false,
	})
}

// ListDatasetVersions handles GET /v1/datasets/:id/versions
func (h *DatasetHandler) ListDatasetVersions(c *gin.Context) {
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

	versions, err := h.repo.ListVersions(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list dataset versions"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"versions": versions})
}

// GetCategories handles GET /v1/datasets/categories
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

func (h *DatasetHandler) checkDownloadEntitlementTx(tx *sql.Tx, userID uuid.UUID, dataset *models.Dataset, version *models.DatasetVersion) (bool, error) {
	if dataset == nil || version == nil {
		return false, nil
	}
	policy := dataset.EntitlementPolicy
	if policy == "all_versions_if_any_purchase" {
		return h.repo.HasAnyPurchaseForDatasetTx(tx, userID, dataset.ID)
	}
	return h.repo.HasPurchaseForVersionTx(tx, userID, version.ID)
}

func readVersionNumber(c *gin.Context) (*int, error) {
	queryVersion := c.Query("version_number")
	if queryVersion != "" {
		value, err := strconv.Atoi(queryVersion)
		if err != nil || value <= 0 {
			return nil, fmt.Errorf("invalid version")
		}
		return &value, nil
	}

	if c.Request.Body == nil {
		return nil, nil
	}
	var req datasetVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		if errors.Is(err, io.EOF) {
			return nil, nil
		}
		return nil, err
	}
	if req.VersionNumber == nil {
		return nil, nil
	}
	if *req.VersionNumber <= 0 {
		return nil, fmt.Errorf("invalid version")
	}
	return req.VersionNumber, nil
}
