package repository

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/TimLai666/surtopya-api/internal/models"
	"github.com/google/uuid"
)

const datasetSelectColumns = `
	id, survey_id, title, description, category, access_type, price,
	download_count, sample_size, is_active,
	current_published_version_id, current_published_version_number,
	has_unpublished_changes, entitlement_policy,
	file_path, file_name, file_size, mime_type,
	created_at, updated_at
`

// DatasetRepository handles dataset database operations.
type DatasetRepository struct {
	db *sql.DB
}

// NewDatasetRepository creates a new DatasetRepository.
func NewDatasetRepository(db *sql.DB) *DatasetRepository {
	return &DatasetRepository{db: db}
}

func scanDataset(scanner interface{ Scan(dest ...any) error }) (*models.Dataset, error) {
	dataset := &models.Dataset{}
	var surveyID uuid.NullUUID
	var currentPublishedVersionID uuid.NullUUID
	var currentPublishedVersionNumber sql.NullInt64
	var description sql.NullString

	err := scanner.Scan(
		&dataset.ID,
		&surveyID,
		&dataset.Title,
		&description,
		&dataset.Category,
		&dataset.AccessType,
		&dataset.Price,
		&dataset.DownloadCount,
		&dataset.SampleSize,
		&dataset.IsActive,
		&currentPublishedVersionID,
		&currentPublishedVersionNumber,
		&dataset.HasUnpublishedChanges,
		&dataset.EntitlementPolicy,
		&dataset.FilePath,
		&dataset.FileName,
		&dataset.FileSize,
		&dataset.MimeType,
		&dataset.CreatedAt,
		&dataset.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	dataset.SurveyID = optionalUUID(surveyID)
	if description.Valid {
		dataset.Description = &description.String
	}
	if currentPublishedVersionID.Valid {
		id := currentPublishedVersionID.UUID
		dataset.CurrentPublishedVersionID = &id
	}
	if currentPublishedVersionNumber.Valid {
		v := int(currentPublishedVersionNumber.Int64)
		dataset.CurrentPublishedVersionNumber = &v
	}
	if strings.TrimSpace(dataset.EntitlementPolicy) == "" {
		dataset.EntitlementPolicy = "purchased_only"
	}

	return dataset, nil
}

func optionalUUID(value uuid.NullUUID) *uuid.UUID {
	if !value.Valid {
		return nil
	}
	id := value.UUID
	return &id
}

// Create creates a new dataset.
func (r *DatasetRepository) Create(dataset *models.Dataset) error {
	if strings.TrimSpace(dataset.EntitlementPolicy) == "" {
		dataset.EntitlementPolicy = "purchased_only"
	}

	query := `
		INSERT INTO datasets (
			id, survey_id, title, description, category, access_type, price, sample_size,
			file_path, file_name, file_size, mime_type, entitlement_policy
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id, created_at, updated_at
	`

	err := r.db.QueryRow(
		query,
		dataset.ID,
		dataset.SurveyID,
		dataset.Title,
		dataset.Description,
		dataset.Category,
		dataset.AccessType,
		dataset.Price,
		dataset.SampleSize,
		dataset.FilePath,
		dataset.FileName,
		dataset.FileSize,
		dataset.MimeType,
		dataset.EntitlementPolicy,
	).Scan(&dataset.ID, &dataset.CreatedAt, &dataset.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create dataset: %w", err)
	}

	return nil
}

// CreateWithTx creates a new dataset with an external transaction.
func (r *DatasetRepository) CreateWithTx(tx *sql.Tx, dataset *models.Dataset) error {
	if tx == nil {
		return fmt.Errorf("transaction is required")
	}
	if strings.TrimSpace(dataset.EntitlementPolicy) == "" {
		dataset.EntitlementPolicy = "purchased_only"
	}

	query := `
		INSERT INTO datasets (
			id, survey_id, title, description, category, access_type, price, sample_size,
			file_path, file_name, file_size, mime_type, entitlement_policy,
			has_unpublished_changes
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id, created_at, updated_at
	`

	err := tx.QueryRow(
		query,
		dataset.ID,
		dataset.SurveyID,
		dataset.Title,
		dataset.Description,
		dataset.Category,
		dataset.AccessType,
		dataset.Price,
		dataset.SampleSize,
		dataset.FilePath,
		dataset.FileName,
		dataset.FileSize,
		dataset.MimeType,
		dataset.EntitlementPolicy,
		dataset.HasUnpublishedChanges,
	).Scan(&dataset.ID, &dataset.CreatedAt, &dataset.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to create dataset: %w", err)
	}

	return nil
}

// GetByID retrieves a dataset by ID.
func (r *DatasetRepository) GetByID(id uuid.UUID) (*models.Dataset, error) {
	query := `
		SELECT ` + datasetSelectColumns + `
		FROM datasets
		WHERE id = $1
	`

	dataset, err := scanDataset(r.db.QueryRow(query, id))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get dataset: %w", err)
	}
	return dataset, nil
}

func datasetOrderBy(sortBy string) string {
	switch sortBy {
	case "downloads":
		return "download_count DESC, created_at DESC"
	case "samples":
		return "sample_size DESC, created_at DESC"
	case "newest":
		fallthrough
	default:
		return "created_at DESC"
	}
}

func (r *DatasetRepository) queryDatasetList(query string, args ...any) ([]models.Dataset, error) {
	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query datasets: %w", err)
	}
	defer rows.Close()

	results := make([]models.Dataset, 0)
	for rows.Next() {
		dataset, err := scanDataset(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan dataset: %w", err)
		}
		results = append(results, *dataset)
	}

	return results, nil
}

// GetAll retrieves all active datasets with optional filtering.
func (r *DatasetRepository) GetAll(category string, accessType string, limit, offset int) ([]models.Dataset, error) {
	return r.GetAllSorted(category, accessType, "newest", limit, offset)
}

// GetAllSorted retrieves all active datasets with optional filtering and sorting.
func (r *DatasetRepository) GetAllSorted(category string, accessType string, sortBy string, limit, offset int) ([]models.Dataset, error) {
	query := `
		SELECT ` + datasetSelectColumns + `
		FROM datasets
		WHERE is_active = true
	`
	args := []any{}
	argCount := 0

	if category != "" && category != "all" {
		argCount++
		query += fmt.Sprintf(" AND category = $%d", argCount)
		args = append(args, category)
	}

	if accessType != "" && accessType != "all" {
		argCount++
		query += fmt.Sprintf(" AND access_type = $%d", argCount)
		args = append(args, accessType)
	}

	query += fmt.Sprintf(" ORDER BY %s", datasetOrderBy(sortBy))

	argCount++
	query += fmt.Sprintf(" LIMIT $%d", argCount)
	args = append(args, limit)

	argCount++
	query += fmt.Sprintf(" OFFSET $%d", argCount)
	args = append(args, offset)

	return r.queryDatasetList(query, args...)
}

// GetAllAdmin retrieves datasets with optional search and active filter.
func (r *DatasetRepository) GetAllAdmin(search string, isActive *bool, limit, offset int) ([]models.Dataset, error) {
	query := `
		SELECT ` + datasetSelectColumns + `
		FROM datasets
		WHERE 1=1
	`
	args := []any{}
	argCount := 0

	if search != "" {
		argCount++
		query += fmt.Sprintf(" AND (title ILIKE $%d OR description ILIKE $%d)", argCount, argCount)
		args = append(args, "%"+search+"%")
	}

	if isActive != nil {
		argCount++
		query += fmt.Sprintf(" AND is_active = $%d", argCount)
		args = append(args, *isActive)
	}

	argCount++
	query += fmt.Sprintf(" ORDER BY updated_at DESC LIMIT $%d", argCount)
	args = append(args, limit)

	argCount++
	query += fmt.Sprintf(" OFFSET $%d", argCount)
	args = append(args, offset)

	return r.queryDatasetList(query, args...)
}

// Search searches datasets by title or description.
func (r *DatasetRepository) Search(searchQuery string, limit, offset int) ([]models.Dataset, error) {
	return r.SearchSorted(searchQuery, "downloads", limit, offset)
}

// SearchSorted searches datasets by title/description and applies sorting.
func (r *DatasetRepository) SearchSorted(searchQuery string, sortBy string, limit, offset int) ([]models.Dataset, error) {
	query := `
		SELECT ` + datasetSelectColumns + `
		FROM datasets
		WHERE is_active = true
		  AND (title ILIKE $1 OR description ILIKE $1)
	`
	query += fmt.Sprintf(" ORDER BY %s", datasetOrderBy(sortBy))
	query += `
		LIMIT $2 OFFSET $3
	`

	searchPattern := "%" + searchQuery + "%"
	return r.queryDatasetList(query, searchPattern, limit, offset)
}

// Update updates a dataset.
func (r *DatasetRepository) Update(dataset *models.Dataset) error {
	query := `
		UPDATE datasets SET
			title = $2,
			description = $3,
			category = $4,
			access_type = $5,
			price = $6,
			sample_size = $7,
			is_active = $8,
			has_unpublished_changes = $9,
			entitlement_policy = $10
		WHERE id = $1
	`

	_, err := r.db.Exec(
		query,
		dataset.ID,
		dataset.Title,
		dataset.Description,
		dataset.Category,
		dataset.AccessType,
		dataset.Price,
		dataset.SampleSize,
		dataset.IsActive,
		dataset.HasUnpublishedChanges,
		dataset.EntitlementPolicy,
	)
	if err != nil {
		return fmt.Errorf("failed to update dataset: %w", err)
	}

	return nil
}

// UpdateFile updates dataset file metadata.
func (r *DatasetRepository) UpdateFile(id uuid.UUID, filePath, fileName, mimeType string, fileSize int64) error {
	query := `
		UPDATE datasets SET
			file_path = $2,
			file_name = $3,
			mime_type = $4,
			file_size = $5,
			has_unpublished_changes = TRUE
		WHERE id = $1
	`

	if _, err := r.db.Exec(query, id, filePath, fileName, mimeType, fileSize); err != nil {
		return fmt.Errorf("failed to update dataset file: %w", err)
	}
	return nil
}

// Delete deletes a dataset.
func (r *DatasetRepository) Delete(id uuid.UUID) error {
	_, err := r.db.Exec("DELETE FROM datasets WHERE id = $1", id)
	if err != nil {
		return fmt.Errorf("failed to delete dataset: %w", err)
	}
	return nil
}

// IncrementDownloadCount increments the aggregate download count for a dataset.
func (r *DatasetRepository) IncrementDownloadCount(id uuid.UUID) error {
	_, err := r.db.Exec(
		"UPDATE datasets SET download_count = download_count + 1 WHERE id = $1",
		id,
	)
	if err != nil {
		return fmt.Errorf("failed to increment download count: %w", err)
	}
	return nil
}

// UpdateSampleSize updates the sample size for a dataset.
func (r *DatasetRepository) UpdateSampleSize(id uuid.UUID, sampleSize int) error {
	_, err := r.db.Exec(
		"UPDATE datasets SET sample_size = $2 WHERE id = $1",
		id,
		sampleSize,
	)
	if err != nil {
		return fmt.Errorf("failed to update sample size: %w", err)
	}
	return nil
}

func scanDatasetVersion(scanner interface{ Scan(dest ...any) error }) (*models.DatasetVersion, error) {
	item := &models.DatasetVersion{}
	var description sql.NullString
	var publishedBy uuid.NullUUID

	err := scanner.Scan(
		&item.ID,
		&item.DatasetID,
		&item.VersionNumber,
		&item.Title,
		&description,
		&item.Category,
		&item.AccessType,
		&item.Price,
		&item.SampleSize,
		&item.FilePath,
		&item.FileName,
		&item.FileSize,
		&item.MimeType,
		&item.DownloadCount,
		&item.PublishedAt,
		&publishedBy,
		&item.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	if description.Valid {
		item.Description = &description.String
	}
	if publishedBy.Valid {
		id := publishedBy.UUID
		item.PublishedBy = &id
	}

	return item, nil
}

// GetVersionByNumber retrieves a specific dataset version.
func (r *DatasetRepository) GetVersionByNumber(datasetID uuid.UUID, versionNumber int) (*models.DatasetVersion, error) {
	query := `
		SELECT
			id, dataset_id, version_number, title, description, category, access_type,
			price, sample_size, file_path, file_name, file_size, mime_type, download_count,
			published_at, published_by, created_at
		FROM dataset_versions
		WHERE dataset_id = $1 AND version_number = $2
	`

	version, err := scanDatasetVersion(r.db.QueryRow(query, datasetID, versionNumber))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get dataset version: %w", err)
	}
	return version, nil
}

// GetCurrentPublishedVersion retrieves current published version metadata for a dataset.
func (r *DatasetRepository) GetCurrentPublishedVersion(datasetID uuid.UUID) (*models.DatasetVersion, error) {
	query := `
		SELECT
			v.id, v.dataset_id, v.version_number, v.title, v.description, v.category, v.access_type,
			v.price, v.sample_size, v.file_path, v.file_name, v.file_size, v.mime_type, v.download_count,
			v.published_at, v.published_by, v.created_at
		FROM datasets d
		JOIN dataset_versions v ON v.id = d.current_published_version_id
		WHERE d.id = $1
	`

	version, err := scanDatasetVersion(r.db.QueryRow(query, datasetID))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get current dataset version: %w", err)
	}
	return version, nil
}

// ListVersions returns all published versions for a dataset.
func (r *DatasetRepository) ListVersions(datasetID uuid.UUID) ([]models.DatasetVersion, error) {
	query := `
		SELECT
			id, dataset_id, version_number, title, description, category, access_type,
			price, sample_size, file_path, file_name, file_size, mime_type, download_count,
			published_at, published_by, created_at
		FROM dataset_versions
		WHERE dataset_id = $1
		ORDER BY version_number DESC
	`

	rows, err := r.db.Query(query, datasetID)
	if err != nil {
		return nil, fmt.Errorf("failed to list dataset versions: %w", err)
	}
	defer rows.Close()

	versions := make([]models.DatasetVersion, 0)
	for rows.Next() {
		item, err := scanDatasetVersion(rows)
		if err != nil {
			return nil, fmt.Errorf("failed to scan dataset version: %w", err)
		}
		versions = append(versions, *item)
	}

	return versions, nil
}

// GetNextVersionNumberTx returns next version number for a dataset.
func (r *DatasetRepository) GetNextVersionNumberTx(tx *sql.Tx, datasetID uuid.UUID) (int, error) {
	if tx == nil {
		return 0, fmt.Errorf("transaction is required")
	}

	var next int
	if err := tx.QueryRow(
		"SELECT COALESCE(MAX(version_number), 0) + 1 FROM dataset_versions WHERE dataset_id = $1",
		datasetID,
	).Scan(&next); err != nil {
		return 0, fmt.Errorf("failed to determine next dataset version: %w", err)
	}
	return next, nil
}

// CreateVersionTx inserts a published dataset version.
func (r *DatasetRepository) CreateVersionTx(tx *sql.Tx, version *models.DatasetVersion) error {
	if tx == nil {
		return fmt.Errorf("transaction is required")
	}

	query := `
		INSERT INTO dataset_versions (
			id, dataset_id, version_number, title, description, category, access_type,
			price, sample_size, file_path, file_name, file_size, mime_type, download_count,
			published_at, published_by
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
		RETURNING created_at
	`

	err := tx.QueryRow(
		query,
		version.ID,
		version.DatasetID,
		version.VersionNumber,
		version.Title,
		version.Description,
		version.Category,
		version.AccessType,
		version.Price,
		version.SampleSize,
		version.FilePath,
		version.FileName,
		version.FileSize,
		version.MimeType,
		version.DownloadCount,
		version.PublishedAt,
		version.PublishedBy,
	).Scan(&version.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to create dataset version: %w", err)
	}

	return nil
}

// SetCurrentPublishedVersionTx sets the current published version pointers.
func (r *DatasetRepository) SetCurrentPublishedVersionTx(tx *sql.Tx, datasetID uuid.UUID, versionID uuid.UUID, versionNumber int) error {
	if tx == nil {
		return fmt.Errorf("transaction is required")
	}

	_, err := tx.Exec(
		`UPDATE datasets
		 SET current_published_version_id = $2,
		     current_published_version_number = $3,
		     has_unpublished_changes = FALSE,
		     updated_at = NOW()
		 WHERE id = $1`,
		datasetID,
		versionID,
		versionNumber,
	)
	if err != nil {
		return fmt.Errorf("failed to update current published dataset version: %w", err)
	}
	return nil
}

func scanDatasetDraft(scanner interface{ Scan(dest ...any) error }) (*models.DatasetDraft, error) {
	draft := &models.DatasetDraft{}
	var description sql.NullString
	var sourceJobID uuid.NullUUID
	var updatedBy uuid.NullUUID

	err := scanner.Scan(
		&draft.DatasetID,
		&draft.Title,
		&description,
		&draft.Category,
		&draft.AccessType,
		&draft.Price,
		&draft.SampleSize,
		&draft.FilePath,
		&draft.FileName,
		&draft.FileSize,
		&draft.MimeType,
		&sourceJobID,
		&updatedBy,
		&draft.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if description.Valid {
		draft.Description = &description.String
	}
	if sourceJobID.Valid {
		id := sourceJobID.UUID
		draft.SourceDeidJobID = &id
	}
	if updatedBy.Valid {
		id := updatedBy.UUID
		draft.UpdatedBy = &id
	}

	return draft, nil
}

// GetDraft returns dataset draft by dataset id.
func (r *DatasetRepository) GetDraft(datasetID uuid.UUID) (*models.DatasetDraft, error) {
	query := `
		SELECT dataset_id, title, description, category, access_type, price, sample_size,
		       file_path, file_name, file_size, mime_type, source_deid_job_id, updated_by, updated_at
		FROM dataset_drafts
		WHERE dataset_id = $1
	`
	item, err := scanDatasetDraft(r.db.QueryRow(query, datasetID))
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get dataset draft: %w", err)
	}
	return item, nil
}

// UpsertDraftTx creates or updates dataset draft.
func (r *DatasetRepository) UpsertDraftTx(tx *sql.Tx, draft *models.DatasetDraft) error {
	if tx == nil {
		return fmt.Errorf("transaction is required")
	}

	query := `
		INSERT INTO dataset_drafts (
			dataset_id, title, description, category, access_type, price, sample_size,
			file_path, file_name, file_size, mime_type, source_deid_job_id, updated_by, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
		ON CONFLICT (dataset_id) DO UPDATE
		SET title = EXCLUDED.title,
		    description = EXCLUDED.description,
		    category = EXCLUDED.category,
		    access_type = EXCLUDED.access_type,
		    price = EXCLUDED.price,
		    sample_size = EXCLUDED.sample_size,
		    file_path = EXCLUDED.file_path,
		    file_name = EXCLUDED.file_name,
		    file_size = EXCLUDED.file_size,
		    mime_type = EXCLUDED.mime_type,
		    source_deid_job_id = EXCLUDED.source_deid_job_id,
		    updated_by = EXCLUDED.updated_by,
		    updated_at = NOW()
	`

	_, err := tx.Exec(
		query,
		draft.DatasetID,
		draft.Title,
		draft.Description,
		draft.Category,
		draft.AccessType,
		draft.Price,
		draft.SampleSize,
		draft.FilePath,
		draft.FileName,
		draft.FileSize,
		draft.MimeType,
		draft.SourceDeidJobID,
		draft.UpdatedBy,
	)
	if err != nil {
		return fmt.Errorf("failed to upsert dataset draft: %w", err)
	}

	_, err = tx.Exec("UPDATE datasets SET has_unpublished_changes = TRUE WHERE id = $1", draft.DatasetID)
	if err != nil {
		return fmt.Errorf("failed to mark dataset as having unpublished changes: %w", err)
	}

	return nil
}

// IncrementDownloadCountForVersionTx increments per-version download count.
func (r *DatasetRepository) IncrementDownloadCountForVersionTx(tx *sql.Tx, versionID uuid.UUID) error {
	if tx == nil {
		return fmt.Errorf("transaction is required")
	}

	_, err := tx.Exec("UPDATE dataset_versions SET download_count = download_count + 1 WHERE id = $1", versionID)
	if err != nil {
		return fmt.Errorf("failed to increment dataset version download count: %w", err)
	}
	return nil
}

// HasPurchaseForVersionTx checks if user already purchased a dataset version.
func (r *DatasetRepository) HasPurchaseForVersionTx(tx *sql.Tx, userID, versionID uuid.UUID) (bool, error) {
	if tx == nil {
		return false, fmt.Errorf("transaction is required")
	}

	var exists bool
	err := tx.QueryRow(
		"SELECT EXISTS (SELECT 1 FROM dataset_purchases WHERE user_id = $1 AND dataset_version_id = $2)",
		userID,
		versionID,
	).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check dataset purchase by version: %w", err)
	}
	return exists, nil
}

// HasAnyPurchaseForDatasetTx checks if user purchased any version of a dataset.
func (r *DatasetRepository) HasAnyPurchaseForDatasetTx(tx *sql.Tx, userID, datasetID uuid.UUID) (bool, error) {
	if tx == nil {
		return false, fmt.Errorf("transaction is required")
	}

	var exists bool
	err := tx.QueryRow(
		"SELECT EXISTS (SELECT 1 FROM dataset_purchases WHERE user_id = $1 AND dataset_id = $2)",
		userID,
		datasetID,
	).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check dataset purchase by dataset: %w", err)
	}
	return exists, nil
}

// CreatePurchaseTx records a paid dataset purchase.
func (r *DatasetRepository) CreatePurchaseTx(tx *sql.Tx, purchase *models.DatasetPurchase) error {
	if tx == nil {
		return fmt.Errorf("transaction is required")
	}

	if purchase.ID == uuid.Nil {
		purchase.ID = uuid.New()
	}

	err := tx.QueryRow(
		`INSERT INTO dataset_purchases (id, user_id, dataset_id, dataset_version_id, price_paid)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (user_id, dataset_version_id) DO NOTHING
		 RETURNING created_at`,
		purchase.ID,
		purchase.UserID,
		purchase.DatasetID,
		purchase.DatasetVersionID,
		purchase.PricePaid,
	).Scan(&purchase.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			// Already purchased.
			return nil
		}
		return fmt.Errorf("failed to create dataset purchase: %w", err)
	}

	return nil
}

// ResolveDownloadVersion returns the target version for download/purchase.
func (r *DatasetRepository) ResolveDownloadVersion(datasetID uuid.UUID, versionNumber *int) (*models.DatasetVersion, error) {
	if versionNumber != nil {
		return r.GetVersionByNumber(datasetID, *versionNumber)
	}
	return r.GetCurrentPublishedVersion(datasetID)
}

// CopyDatasetAsDraftTx seeds draft from a dataset row.
func (r *DatasetRepository) CopyDatasetAsDraftTx(tx *sql.Tx, datasetID uuid.UUID, updatedBy *uuid.UUID) error {
	if tx == nil {
		return fmt.Errorf("transaction is required")
	}

	query := `
		INSERT INTO dataset_drafts (
			dataset_id, title, description, category, access_type, price, sample_size,
			file_path, file_name, file_size, mime_type, updated_by, updated_at
		)
		SELECT
			id, title, description, category, access_type, price, sample_size,
			file_path, file_name, file_size, mime_type, $2, NOW()
		FROM datasets
		WHERE id = $1
		ON CONFLICT (dataset_id) DO NOTHING
	`

	if _, err := tx.Exec(query, datasetID, updatedBy); err != nil {
		return fmt.Errorf("failed to seed dataset draft: %w", err)
	}
	return nil
}

// UpdateCurrentFromDraftTx syncs dataset top-level fields from draft after publish.
func (r *DatasetRepository) UpdateCurrentFromDraftTx(tx *sql.Tx, datasetID uuid.UUID, draft *models.DatasetDraft) error {
	if tx == nil {
		return fmt.Errorf("transaction is required")
	}

	_, err := tx.Exec(
		`UPDATE datasets
		 SET title = $2,
		     description = $3,
		     category = $4,
		     access_type = $5,
		     price = $6,
		     sample_size = $7,
		     file_path = $8,
		     file_name = $9,
		     file_size = $10,
		     mime_type = $11,
		     updated_at = NOW()
		 WHERE id = $1`,
		datasetID,
		draft.Title,
		draft.Description,
		draft.Category,
		draft.AccessType,
		draft.Price,
		draft.SampleSize,
		draft.FilePath,
		draft.FileName,
		draft.FileSize,
		draft.MimeType,
	)
	if err != nil {
		return fmt.Errorf("failed to sync dataset from draft: %w", err)
	}

	return nil
}

// MarkDatasetHasUnpublishedChangesTx updates draft status flag.
func (r *DatasetRepository) MarkDatasetHasUnpublishedChangesTx(tx *sql.Tx, datasetID uuid.UUID, value bool) error {
	if tx == nil {
		return fmt.Errorf("transaction is required")
	}
	_, err := tx.Exec("UPDATE datasets SET has_unpublished_changes = $2 WHERE id = $1", datasetID, value)
	if err != nil {
		return fmt.Errorf("failed to update dataset unpublished flag: %w", err)
	}
	return nil
}

// TouchDatasetUpdatedAt updates updated_at for dataset.
func (r *DatasetRepository) TouchDatasetUpdatedAt(datasetID uuid.UUID) error {
	_, err := r.db.Exec("UPDATE datasets SET updated_at = $2 WHERE id = $1", datasetID, time.Now().UTC())
	if err != nil {
		return fmt.Errorf("failed to touch dataset updated_at: %w", err)
	}
	return nil
}
