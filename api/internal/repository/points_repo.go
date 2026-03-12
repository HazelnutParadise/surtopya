package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/TimLai666/surtopya-api/internal/timeutil"
	"github.com/google/uuid"
)

var ErrInsufficientPoints = errors.New("insufficient points")

// PointsRepository handles points balance updates and transaction recording.
// All methods are designed to be used inside a SQL transaction.
type PointsRepository struct {
	db *sql.DB
}

func NewPointsRepository(db *sql.DB) *PointsRepository {
	return &PointsRepository{db: db}
}

func (r *PointsRepository) AwardSurveyPointsTx(tx *sql.Tx, userID uuid.UUID, surveyID uuid.UUID, amount int, description string) error {
	if amount <= 0 {
		return nil
	}
	if description == "" {
		description = "Survey completion reward"
	}

	if _, err := tx.Exec(
		"UPDATE users SET points_balance = points_balance + $2 WHERE id = $1",
		userID, amount,
	); err != nil {
		return fmt.Errorf("failed to award points: %w", err)
	}

	if _, err := tx.Exec(
		`INSERT INTO points_transactions (id, user_id, amount, type, description, survey_id)
		 VALUES ($1, $2, $3, 'survey_reward', $4, $5)`,
		uuid.New(), userID, amount, description, surveyID,
	); err != nil {
		return fmt.Errorf("failed to insert points transaction: %w", err)
	}

	return nil
}

func (r *PointsRepository) DeductForDatasetTx(tx *sql.Tx, userID uuid.UUID, datasetID uuid.UUID, price int, description string) error {
	if price <= 0 {
		return nil
	}
	if description == "" {
		description = "Dataset purchase"
	}

	var balance int
	if err := tx.QueryRow(
		"SELECT points_balance FROM users WHERE id = $1 FOR UPDATE",
		userID,
	).Scan(&balance); err != nil {
		return fmt.Errorf("failed to read points balance: %w", err)
	}

	if balance < price {
		return ErrInsufficientPoints
	}

	if _, err := tx.Exec(
		"UPDATE users SET points_balance = points_balance - $2 WHERE id = $1",
		userID, price,
	); err != nil {
		return fmt.Errorf("failed to deduct points: %w", err)
	}

	if _, err := tx.Exec(
		`INSERT INTO points_transactions (id, user_id, amount, type, description, dataset_id)
		 VALUES ($1, $2, $3, 'dataset_purchase', $4, $5)`,
		uuid.New(), userID, -price, description, datasetID,
	); err != nil {
		return fmt.Errorf("failed to insert points transaction: %w", err)
	}

	return nil
}

func (r *PointsRepository) GrantMonthlyPointsIfEligibleTx(tx *sql.Tx, userID uuid.UUID, now time.Time, description string) (bool, error) {
	if description == "" {
		description = "Membership monthly points grant"
	}

	now = now.UTC()

	var timeZone string
	var nextGrantAt sql.NullTime
	var grantAmount int
	err := tx.QueryRow(
		`
		SELECT u.timezone, u.pro_points_next_grant_at, mt.monthly_points_grant
		FROM users u
		JOIN user_memberships um ON um.user_id = u.id
		JOIN membership_tiers mt ON mt.id = um.tier_id
		WHERE u.id = $1
		FOR UPDATE
		`,
		userID,
	).Scan(&timeZone, &nextGrantAt, &grantAmount)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("failed to grant membership monthly points: %w", err)
	}
	if grantAmount <= 0 {
		return false, nil
	}
	if nextGrantAt.Valid && nextGrantAt.Time.After(now) {
		return false, nil
	}
	if timeZone == "" {
		timeZone = "Asia/Taipei"
	}

	nextBoundary, err := timeutil.NextMonthlyBoundaryUTC(now, timeZone)
	if err != nil {
		return false, fmt.Errorf("failed to compute next monthly boundary: %w", err)
	}

	if _, err := tx.Exec(
		`UPDATE users
		 SET points_balance = points_balance + $2,
		     pro_points_last_granted_at = $3,
		     pro_points_next_grant_at = $4
		 WHERE id = $1`,
		userID, grantAmount, now, nextBoundary,
	); err != nil {
		return false, fmt.Errorf("failed to update monthly grant fields: %w", err)
	}

	if _, err := tx.Exec(
		`INSERT INTO points_transactions (id, user_id, amount, type, description)
		 VALUES ($1, $2, $3, 'pro_monthly_grant', $4)`,
		uuid.New(), userID, grantAmount, description,
	); err != nil {
		return false, fmt.Errorf("failed to insert points transaction: %w", err)
	}

	return true, nil
}

func (r *PointsRepository) DeductForSurveyBoostTx(tx *sql.Tx, publisherID uuid.UUID, surveyID uuid.UUID, spend int, description string) error {
	if spend <= 0 {
		return nil
	}
	if description == "" {
		description = "Survey boost spend"
	}

	var balance int
	if err := tx.QueryRow(
		"SELECT points_balance FROM users WHERE id = $1 FOR UPDATE",
		publisherID,
	).Scan(&balance); err != nil {
		return fmt.Errorf("failed to read points balance: %w", err)
	}

	if balance < spend {
		return ErrInsufficientPoints
	}

	if _, err := tx.Exec(
		"UPDATE users SET points_balance = points_balance - $2 WHERE id = $1",
		publisherID, spend,
	); err != nil {
		return fmt.Errorf("failed to deduct points: %w", err)
	}

	if _, err := tx.Exec(
		`INSERT INTO points_transactions (id, user_id, amount, type, description, survey_id)
		 VALUES ($1, $2, $3, 'survey_boost_spend', $4, $5)`,
		uuid.New(), publisherID, -spend, description, surveyID,
	); err != nil {
		return fmt.Errorf("failed to insert points transaction: %w", err)
	}

	return nil
}
