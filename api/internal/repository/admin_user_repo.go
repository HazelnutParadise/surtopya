package repository

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

type AdminUserFilter struct {
	Search         string
	Role           string
	MembershipTier string
	IsDisabled     *bool
	Limit          int
	Offset         int
}

type AdminUserRecord struct {
	ID                    uuid.UUID
	Email                 *string
	DisplayName           *string
	PointsBalance         int
	MembershipTier        string
	MembershipPeriodEndAt *time.Time
	MembershipIsPermanent bool
	IsAdmin               bool
	IsSuperAdmin          bool
	IsDisabled            bool
	CreatedAt             time.Time
}

type AdminUserRepository struct {
	db *sql.DB
}

func NewAdminUserRepository(db *sql.DB) *AdminUserRepository {
	return &AdminUserRepository{db: db}
}

func (r *AdminUserRepository) List(ctx context.Context, filter AdminUserFilter) ([]AdminUserRecord, int, error) {
	if filter.Limit <= 0 || filter.Limit > 100 {
		filter.Limit = 20
	}
	if filter.Offset < 0 {
		filter.Offset = 0
	}

	whereClause, whereArgs := buildAdminUserWhereClause(filter)

	countQuery := "SELECT COUNT(*) FROM (" + adminUserSelectQuery() + whereClause + ") AS filtered_users"
	var total int
	if err := r.db.QueryRowContext(ctx, countQuery, whereArgs...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count users: %w", err)
	}

	args := append([]any{}, whereArgs...)
	args = append(args, filter.Limit, filter.Offset)
	query := adminUserSelectQuery() + whereClause +
		" ORDER BY u.created_at DESC LIMIT $" + strconv.Itoa(len(args)-1) +
		" OFFSET $" + strconv.Itoa(len(args))

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list users: %w", err)
	}
	defer rows.Close()

	users, err := scanAdminUserRows(rows)
	if err != nil {
		return nil, 0, err
	}
	return users, total, nil
}

func (r *AdminUserRepository) GetByID(ctx context.Context, id uuid.UUID) (*AdminUserRecord, error) {
	query := adminUserSelectQuery() + " WHERE u.id = $1"
	rows, err := r.db.QueryContext(ctx, query, id)
	if err != nil {
		return nil, fmt.Errorf("failed to load user: %w", err)
	}
	defer rows.Close()

	users, err := scanAdminUserRows(rows)
	if err != nil {
		return nil, err
	}
	if len(users) == 0 {
		return nil, nil
	}
	return &users[0], nil
}

func adminUserSelectQuery() string {
	return `
		SELECT
			u.id,
			u.email,
			u.display_name,
			u.points_balance,
			COALESCE(mt.code, 'free') AS membership_tier,
			um.period_end_at,
			COALESCE(um.is_permanent, true) AS membership_is_permanent,
			u.is_admin,
			u.is_super_admin,
			u.is_disabled,
			u.created_at
		FROM users u
		LEFT JOIN user_memberships um ON um.user_id = u.id
		LEFT JOIN membership_tiers mt ON mt.id = um.tier_id
	`
}

func buildAdminUserWhereClause(filter AdminUserFilter) (string, []any) {
	role := strings.TrimSpace(filter.Role)
	membershipTier := strings.TrimSpace(filter.MembershipTier)
	search := strings.TrimSpace(filter.Search)

	args := []any{}
	index := 0
	where := " WHERE 1=1"

	if search != "" {
		index++
		where += " AND (u.email ILIKE $" + strconv.Itoa(index) + " OR u.display_name ILIKE $" + strconv.Itoa(index) + ")"
		args = append(args, "%"+search+"%")
	}
	switch role {
	case "admin":
		where += " AND (u.is_admin = true OR u.is_super_admin = true)"
	case "non_admin":
		where += " AND u.is_admin = false AND u.is_super_admin = false"
	}
	if membershipTier != "" && membershipTier != "all" {
		index++
		where += " AND COALESCE(mt.code, 'free') = $" + strconv.Itoa(index)
		args = append(args, membershipTier)
	}
	if filter.IsDisabled != nil {
		index++
		where += " AND u.is_disabled = $" + strconv.Itoa(index)
		args = append(args, *filter.IsDisabled)
	}

	return where, args
}

func scanAdminUserRows(rows *sql.Rows) ([]AdminUserRecord, error) {
	users := []AdminUserRecord{}
	for rows.Next() {
		var user AdminUserRecord
		if err := rows.Scan(
			&user.ID,
			&user.Email,
			&user.DisplayName,
			&user.PointsBalance,
			&user.MembershipTier,
			&user.MembershipPeriodEndAt,
			&user.MembershipIsPermanent,
			&user.IsAdmin,
			&user.IsSuperAdmin,
			&user.IsDisabled,
			&user.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan user: %w", err)
		}
		users = append(users, user)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate users: %w", err)
	}
	return users, nil
}
