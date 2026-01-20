package repository

import (
	"database/sql"
	"fmt"

	"github.com/TimLai666/surtopya-api/internal/models"
	"github.com/google/uuid"
)

// DatasetRepository handles dataset database operations
type DatasetRepository struct {
	db *sql.DB
}

// NewDatasetRepository creates a new DatasetRepository
func NewDatasetRepository(db *sql.DB) *DatasetRepository {
	return &DatasetRepository{db: db}
}

// Create creates a new dataset
func (r *DatasetRepository) Create(dataset *models.Dataset) error {
	query := `
		INSERT INTO datasets (
			id, survey_id, title, description, category, access_type, price, sample_size
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at, updated_at
	`

	err := r.db.QueryRow(
		query,
		dataset.ID, dataset.SurveyID, dataset.Title, dataset.Description,
		dataset.Category, dataset.AccessType, dataset.Price, dataset.SampleSize,
	).Scan(&dataset.ID, &dataset.CreatedAt, &dataset.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create dataset: %w", err)
	}

	return nil
}

// GetByID retrieves a dataset by ID
func (r *DatasetRepository) GetByID(id uuid.UUID) (*models.Dataset, error) {
	dataset := &models.Dataset{}

	query := `
		SELECT id, survey_id, title, description, category, access_type, price,
			download_count, sample_size, is_active, created_at, updated_at
		FROM datasets WHERE id = $1
	`

	err := r.db.QueryRow(query, id).Scan(
		&dataset.ID, &dataset.SurveyID, &dataset.Title, &dataset.Description,
		&dataset.Category, &dataset.AccessType, &dataset.Price,
		&dataset.DownloadCount, &dataset.SampleSize, &dataset.IsActive,
		&dataset.CreatedAt, &dataset.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get dataset: %w", err)
	}

	return dataset, nil
}

// GetAll retrieves all active datasets with optional filtering
func (r *DatasetRepository) GetAll(category string, accessType string, limit, offset int) ([]models.Dataset, error) {
	query := `
		SELECT id, survey_id, title, description, category, access_type, price,
			download_count, sample_size, is_active, created_at, updated_at
		FROM datasets
		WHERE is_active = true
	`
	args := []interface{}{}
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

	argCount++
	query += fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d", argCount)
	args = append(args, limit)

	argCount++
	query += fmt.Sprintf(" OFFSET $%d", argCount)
	args = append(args, offset)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query datasets: %w", err)
	}
	defer rows.Close()

	var datasets []models.Dataset
	for rows.Next() {
		var dataset models.Dataset
		err := rows.Scan(
			&dataset.ID, &dataset.SurveyID, &dataset.Title, &dataset.Description,
			&dataset.Category, &dataset.AccessType, &dataset.Price,
			&dataset.DownloadCount, &dataset.SampleSize, &dataset.IsActive,
			&dataset.CreatedAt, &dataset.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan dataset: %w", err)
		}
		datasets = append(datasets, dataset)
	}

	return datasets, nil
}

// Search searches datasets by title or description
func (r *DatasetRepository) Search(searchQuery string, limit, offset int) ([]models.Dataset, error) {
	query := `
		SELECT id, survey_id, title, description, category, access_type, price,
			download_count, sample_size, is_active, created_at, updated_at
		FROM datasets
		WHERE is_active = true
			AND (title ILIKE $1 OR description ILIKE $1)
		ORDER BY download_count DESC
		LIMIT $2 OFFSET $3
	`

	searchPattern := "%" + searchQuery + "%"
	rows, err := r.db.Query(query, searchPattern, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to search datasets: %w", err)
	}
	defer rows.Close()

	var datasets []models.Dataset
	for rows.Next() {
		var dataset models.Dataset
		err := rows.Scan(
			&dataset.ID, &dataset.SurveyID, &dataset.Title, &dataset.Description,
			&dataset.Category, &dataset.AccessType, &dataset.Price,
			&dataset.DownloadCount, &dataset.SampleSize, &dataset.IsActive,
			&dataset.CreatedAt, &dataset.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan dataset: %w", err)
		}
		datasets = append(datasets, dataset)
	}

	return datasets, nil
}

// Update updates a dataset
func (r *DatasetRepository) Update(dataset *models.Dataset) error {
	query := `
		UPDATE datasets SET
			title = $2, description = $3, category = $4, access_type = $5,
			price = $6, sample_size = $7, is_active = $8
		WHERE id = $1
	`

	_, err := r.db.Exec(
		query,
		dataset.ID, dataset.Title, dataset.Description, dataset.Category,
		dataset.AccessType, dataset.Price, dataset.SampleSize, dataset.IsActive,
	)

	if err != nil {
		return fmt.Errorf("failed to update dataset: %w", err)
	}

	return nil
}

// Delete deletes a dataset
func (r *DatasetRepository) Delete(id uuid.UUID) error {
	_, err := r.db.Exec("DELETE FROM datasets WHERE id = $1", id)
	if err != nil {
		return fmt.Errorf("failed to delete dataset: %w", err)
	}
	return nil
}

// IncrementDownloadCount increments the download count for a dataset
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

// UpdateSampleSize updates the sample size for a dataset
func (r *DatasetRepository) UpdateSampleSize(id uuid.UUID, sampleSize int) error {
	_, err := r.db.Exec(
		"UPDATE datasets SET sample_size = $2 WHERE id = $1",
		id, sampleSize,
	)
	if err != nil {
		return fmt.Errorf("failed to update sample size: %w", err)
	}
	return nil
}

// GetBySurveyID retrieves a dataset by survey ID
func (r *DatasetRepository) GetBySurveyID(surveyID uuid.UUID) (*models.Dataset, error) {
	dataset := &models.Dataset{}

	query := `
		SELECT id, survey_id, title, description, category, access_type, price,
			download_count, sample_size, is_active, created_at, updated_at
		FROM datasets WHERE survey_id = $1
	`

	err := r.db.QueryRow(query, surveyID).Scan(
		&dataset.ID, &dataset.SurveyID, &dataset.Title, &dataset.Description,
		&dataset.Category, &dataset.AccessType, &dataset.Price,
		&dataset.DownloadCount, &dataset.SampleSize, &dataset.IsActive,
		&dataset.CreatedAt, &dataset.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get dataset by survey: %w", err)
	}

	return dataset, nil
}
