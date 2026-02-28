package policy

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

const (
	CapabilitySurveyPublicDatasetOptOut = "survey.public_dataset_opt_out"
	CapabilityPointsMonthlyGrant        = "points.monthly_grant"
	PermissionPolicyWrite               = "policy.write"
	DefaultMembershipTierCode           = "free"
)

var (
	ErrTierNotFound           = errors.New("membership tier not found")
	ErrCapabilityNotFound     = errors.New("capability not found")
	ErrInvalidMembershipGrant = errors.New("invalid membership grant payload")
	ErrPlanCodeExists         = errors.New("subscription plan code already exists")
)

type Service struct {
	db *sql.DB
}

func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

type Tier struct {
	ID                      uuid.UUID         `json:"id"`
	Code                    string            `json:"code"`
	Name                    string            `json:"name"`
	NameI18n                map[string]string `json:"nameI18n,omitempty"`
	DescriptionI18n         map[string]string `json:"descriptionI18n,omitempty"`
	IsActive                bool              `json:"isActive"`
	IsPurchasable           bool              `json:"isPurchasable,omitempty"`
	ShowOnPricing           bool              `json:"showOnPricing,omitempty"`
	PriceCentsUSD           int               `json:"priceCentsUsd,omitempty"`
	BillingInterval         string            `json:"billingInterval,omitempty"`
	AllowRenewalForExisting bool              `json:"allowRenewalForExisting,omitempty"`
}

type Capability struct {
	ID              uuid.UUID         `json:"id"`
	Key             string            `json:"key"`
	Name            string            `json:"name"`
	Description     *string           `json:"description,omitempty"`
	NameI18n        map[string]string `json:"nameI18n,omitempty"`
	DescriptionI18n map[string]string `json:"descriptionI18n,omitempty"`
	IsActive        bool              `json:"isActive"`
	ShowOnPricing   bool              `json:"showOnPricing,omitempty"`
}

type MembershipGrant struct {
	TierCode              string     `json:"membershipTier"`
	MembershipPeriodEndAt *time.Time `json:"membershipPeriodEndAt,omitempty"`
	MembershipIsPermanent bool       `json:"membershipIsPermanent"`
}

type MatrixEntry struct {
	TierCode      string `json:"tierCode"`
	CapabilityKey string `json:"capabilityKey"`
	IsAllowed     bool   `json:"isAllowed"`
}

type PolicyUpdate struct {
	TierCode      string `json:"tierCode"`
	CapabilityKey string `json:"capabilityKey"`
	IsAllowed     bool   `json:"isAllowed"`
}

type PolicyWriter struct {
	ID             uuid.UUID `json:"id"`
	Email          *string   `json:"email,omitempty"`
	DisplayName    *string   `json:"displayName,omitempty"`
	IsAdmin        bool      `json:"isAdmin"`
	IsSuperAdmin   bool      `json:"isSuperAdmin"`
	CanWritePolicy bool      `json:"canWritePolicy"`
}

func (s *Service) EnsureUserMembership(ctx context.Context, userID uuid.UUID) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO user_memberships (user_id, tier_id)
		SELECT $1, t.id
		FROM membership_tiers t
		WHERE t.code = $2
		ON CONFLICT (user_id) DO NOTHING
	`, userID, DefaultMembershipTierCode)
	if err != nil {
		return fmt.Errorf("failed to ensure user membership: %w", err)
	}
	return nil
}

func (s *Service) ResolveMembershipTier(ctx context.Context, userID uuid.UUID) (string, error) {
	var tierCode string
	err := s.db.QueryRowContext(ctx, `
		SELECT mt.code
		FROM user_memberships um
		JOIN membership_tiers mt ON mt.id = um.tier_id
		WHERE um.user_id = $1
	`, userID).Scan(&tierCode)
	if err == sql.ErrNoRows {
		return DefaultMembershipTierCode, nil
	}
	if err != nil {
		return "", fmt.Errorf("failed to resolve membership tier: %w", err)
	}
	return tierCode, nil
}

func (s *Service) ResolveCapabilities(ctx context.Context, userID uuid.UUID) (map[string]bool, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT
			c.key,
			COALESCE(tc.is_allowed, false) AS is_allowed
		FROM capabilities c
		LEFT JOIN user_memberships um
			ON um.user_id = $1
		LEFT JOIN tier_capabilities tc
			ON tc.capability_id = c.id
		   AND tc.tier_id = um.tier_id
		WHERE c.is_active = true
		ORDER BY c.key
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve capabilities: %w", err)
	}
	defer rows.Close()

	capabilities := map[string]bool{}
	for rows.Next() {
		var key string
		var allowed bool
		if err := rows.Scan(&key, &allowed); err != nil {
			return nil, fmt.Errorf("failed to scan capability: %w", err)
		}
		capabilities[key] = allowed
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate capabilities: %w", err)
	}

	// Always expose known keys even if table state is incomplete.
	if _, ok := capabilities[CapabilitySurveyPublicDatasetOptOut]; !ok {
		capabilities[CapabilitySurveyPublicDatasetOptOut] = false
	}
	if _, ok := capabilities[CapabilityPointsMonthlyGrant]; !ok {
		capabilities[CapabilityPointsMonthlyGrant] = false
	}

	return capabilities, nil
}

func (s *Service) Can(ctx context.Context, userID uuid.UUID, capabilityKey string) (bool, error) {
	var allowed bool
	err := s.db.QueryRowContext(ctx, `
		SELECT COALESCE(tc.is_allowed, false)
		FROM capabilities c
		LEFT JOIN user_memberships um ON um.user_id = $1
		LEFT JOIN tier_capabilities tc
			ON tc.capability_id = c.id
		   AND tc.tier_id = um.tier_id
		WHERE c.key = $2
	`, userID, capabilityKey).Scan(&allowed)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("failed to evaluate capability: %w", err)
	}
	return allowed, nil
}

func (s *Service) ResolveTierIDByCode(ctx context.Context, code string) (uuid.UUID, error) {
	var id uuid.UUID
	err := s.db.QueryRowContext(ctx, `
		SELECT id
		FROM membership_tiers
		WHERE code = $1
	`, code).Scan(&id)
	if err == sql.ErrNoRows {
		return uuid.Nil, ErrTierNotFound
	}
	if err != nil {
		return uuid.Nil, fmt.Errorf("failed to resolve tier id: %w", err)
	}
	return id, nil
}

func (s *Service) SetUserTier(ctx context.Context, userID uuid.UUID, tierCode string) error {
	tierID, err := s.ResolveTierIDByCode(ctx, tierCode)
	if err != nil {
		return err
	}

	_, err = s.db.ExecContext(ctx, `
		INSERT INTO user_memberships (user_id, tier_id)
		VALUES ($1, $2)
		ON CONFLICT (user_id) DO UPDATE SET
			tier_id = EXCLUDED.tier_id,
			updated_at = NOW()
	`, userID, tierID)
	if err != nil {
		return fmt.Errorf("failed to set user tier: %w", err)
	}
	return nil
}

func (s *Service) ResolveMembershipGrant(ctx context.Context, userID uuid.UUID) (MembershipGrant, error) {
	if err := s.EnsureUserMembership(ctx, userID); err != nil {
		return MembershipGrant{}, err
	}

	var grant MembershipGrant
	err := s.db.QueryRowContext(ctx, `
		SELECT
			COALESCE(mt.code, $2) AS tier_code,
			um.period_end_at,
			COALESCE(um.is_permanent, true) AS is_permanent
		FROM user_memberships um
		LEFT JOIN membership_tiers mt ON mt.id = um.tier_id
		WHERE um.user_id = $1
	`, userID, DefaultMembershipTierCode).Scan(&grant.TierCode, &grant.MembershipPeriodEndAt, &grant.MembershipIsPermanent)
	if err == sql.ErrNoRows {
		return MembershipGrant{
			TierCode:              DefaultMembershipTierCode,
			MembershipIsPermanent: true,
		}, nil
	}
	if err != nil {
		return MembershipGrant{}, fmt.Errorf("failed to resolve membership grant: %w", err)
	}
	return grant, nil
}

func (s *Service) SetUserMembershipGrant(ctx context.Context, userID uuid.UUID, tierCode string, isPermanent bool, periodEndAt *time.Time) error {
	tierCode = strings.TrimSpace(tierCode)
	if tierCode == "" {
		return ErrInvalidMembershipGrant
	}
	if isPermanent {
		if periodEndAt != nil {
			return ErrInvalidMembershipGrant
		}
	} else {
		if periodEndAt == nil || !periodEndAt.After(time.Now().UTC()) {
			return ErrInvalidMembershipGrant
		}
	}

	tierID, err := s.ResolveTierIDByCode(ctx, tierCode)
	if err != nil {
		return err
	}

	_, err = s.db.ExecContext(ctx, `
		INSERT INTO user_memberships (user_id, tier_id, started_at, period_end_at, is_permanent)
		VALUES ($1, $2, NOW(), $3, $4)
		ON CONFLICT (user_id) DO UPDATE SET
			tier_id = EXCLUDED.tier_id,
			started_at = NOW(),
			period_end_at = EXCLUDED.period_end_at,
			is_permanent = EXCLUDED.is_permanent,
			updated_at = NOW()
	`, userID, tierID, periodEndAt, isPermanent)
	if err != nil {
		return fmt.Errorf("failed to set user membership grant: %w", err)
	}
	return nil
}

func (s *Service) ExpireMembershipIfNeeded(ctx context.Context, userID uuid.UUID) (bool, error) {
	if err := s.EnsureUserMembership(ctx, userID); err != nil {
		return false, err
	}

	res, err := s.db.ExecContext(ctx, `
		UPDATE user_memberships um
		SET tier_id = free_tier.id,
			started_at = NOW(),
			period_end_at = NULL,
			is_permanent = TRUE,
			updated_at = NOW()
		FROM membership_tiers free_tier
		WHERE um.user_id = $1
		  AND free_tier.code = $2
		  AND um.is_permanent = FALSE
		  AND um.period_end_at IS NOT NULL
		  AND um.period_end_at <= NOW()
	`, userID, DefaultMembershipTierCode)
	if err != nil {
		return false, fmt.Errorf("failed to expire membership: %w", err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("failed to read expired membership update result: %w", err)
	}
	return affected > 0, nil
}

func (s *Service) IsPolicyWriter(ctx context.Context, userID uuid.UUID) (bool, error) {
	var isSuper bool
	if err := s.db.QueryRowContext(ctx, "SELECT is_super_admin FROM users WHERE id = $1", userID).Scan(&isSuper); err != nil {
		return false, fmt.Errorf("failed to load super admin state: %w", err)
	}
	if isSuper {
		return true, nil
	}

	var canWrite bool
	if err := s.db.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM admin_permissions
			WHERE user_id = $1
			  AND permission_key = $2
		)
	`, userID, PermissionPolicyWrite).Scan(&canWrite); err != nil {
		return false, fmt.Errorf("failed to load policy writer state: %w", err)
	}
	return canWrite, nil
}

func (s *Service) ListPolicies(ctx context.Context) ([]Tier, []Capability, []MatrixEntry, error) {
	tierRows, err := s.db.QueryContext(ctx, `
		SELECT id, code, name, is_active
		FROM membership_tiers
		ORDER BY code
	`)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed to list tiers: %w", err)
	}
	defer tierRows.Close()

	tiers := []Tier{}
	for tierRows.Next() {
		var t Tier
		if err := tierRows.Scan(&t.ID, &t.Code, &t.Name, &t.IsActive); err != nil {
			return nil, nil, nil, fmt.Errorf("failed to scan tier: %w", err)
		}
		tiers = append(tiers, t)
	}
	if err := tierRows.Err(); err != nil {
		return nil, nil, nil, fmt.Errorf("failed to iterate tiers: %w", err)
	}

	capRows, err := s.db.QueryContext(ctx, `
		SELECT id, key, name, description, is_active
		FROM capabilities
		ORDER BY key
	`)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed to list capabilities: %w", err)
	}
	defer capRows.Close()

	capabilities := []Capability{}
	for capRows.Next() {
		var c Capability
		if err := capRows.Scan(&c.ID, &c.Key, &c.Name, &c.Description, &c.IsActive); err != nil {
			return nil, nil, nil, fmt.Errorf("failed to scan capability: %w", err)
		}
		capabilities = append(capabilities, c)
	}
	if err := capRows.Err(); err != nil {
		return nil, nil, nil, fmt.Errorf("failed to iterate capabilities: %w", err)
	}

	matrixRows, err := s.db.QueryContext(ctx, `
		SELECT
			t.code AS tier_code,
			c.key AS capability_key,
			COALESCE(tc.is_allowed, false) AS is_allowed
		FROM membership_tiers t
		CROSS JOIN capabilities c
		LEFT JOIN tier_capabilities tc
			ON tc.tier_id = t.id
		   AND tc.capability_id = c.id
		ORDER BY t.code, c.key
	`)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("failed to list policy matrix: %w", err)
	}
	defer matrixRows.Close()

	matrix := []MatrixEntry{}
	for matrixRows.Next() {
		var e MatrixEntry
		if err := matrixRows.Scan(&e.TierCode, &e.CapabilityKey, &e.IsAllowed); err != nil {
			return nil, nil, nil, fmt.Errorf("failed to scan matrix entry: %w", err)
		}
		matrix = append(matrix, e)
	}
	if err := matrixRows.Err(); err != nil {
		return nil, nil, nil, fmt.Errorf("failed to iterate matrix: %w", err)
	}

	return tiers, capabilities, matrix, nil
}

func (s *Service) UpdatePolicies(ctx context.Context, actorUserID uuid.UUID, updates []PolicyUpdate) error {
	if len(updates) == 0 {
		return nil
	}

	type policyChange struct {
		TierCode      string `json:"tierCode"`
		CapabilityKey string `json:"capabilityKey"`
		IsAllowed     bool   `json:"isAllowed"`
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	before := []policyChange{}
	after := []policyChange{}

	for _, upd := range updates {
		var tierID uuid.UUID
		var capabilityID uuid.UUID
		var prevAllowed bool

		err := tx.QueryRowContext(ctx, `
			SELECT
				t.id,
				c.id,
				COALESCE(tc.is_allowed, false)
			FROM membership_tiers t
			JOIN capabilities c ON c.key = $2
			LEFT JOIN tier_capabilities tc
				ON tc.tier_id = t.id
			   AND tc.capability_id = c.id
			WHERE t.code = $1
		`, upd.TierCode, upd.CapabilityKey).Scan(&tierID, &capabilityID, &prevAllowed)
		if err == sql.ErrNoRows {
			return ErrTierNotFound
		}
		if err != nil {
			return fmt.Errorf("failed to load policy entry: %w", err)
		}

		_, err = tx.ExecContext(ctx, `
			INSERT INTO tier_capabilities (tier_id, capability_id, is_allowed)
			VALUES ($1, $2, $3)
			ON CONFLICT (tier_id, capability_id) DO UPDATE SET
				is_allowed = EXCLUDED.is_allowed,
				updated_at = NOW()
		`, tierID, capabilityID, upd.IsAllowed)
		if err != nil {
			return fmt.Errorf("failed to upsert policy entry: %w", err)
		}

		if prevAllowed != upd.IsAllowed {
			before = append(before, policyChange{
				TierCode:      upd.TierCode,
				CapabilityKey: upd.CapabilityKey,
				IsAllowed:     prevAllowed,
			})
			after = append(after, policyChange{
				TierCode:      upd.TierCode,
				CapabilityKey: upd.CapabilityKey,
				IsAllowed:     upd.IsAllowed,
			})
		}
	}

	if len(after) > 0 {
		beforePayload, err := json.Marshal(before)
		if err != nil {
			return fmt.Errorf("failed to marshal before payload: %w", err)
		}
		afterPayload, err := json.Marshal(after)
		if err != nil {
			return fmt.Errorf("failed to marshal after payload: %w", err)
		}

		_, err = tx.ExecContext(ctx, `
			INSERT INTO policy_audit_logs (
				id, actor_user_id, action, target_type, target_key, before_payload, after_payload
			) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
		`, uuid.New(), actorUserID, "policy_matrix_update", "tier_capability", "bulk", string(beforePayload), string(afterPayload))
		if err != nil {
			return fmt.Errorf("failed to insert policy audit log: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit policy updates: %w", err)
	}

	return nil
}

func (s *Service) ListPolicyWriters(ctx context.Context) ([]PolicyWriter, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT
			u.id,
			u.email,
			u.display_name,
			u.is_admin,
			u.is_super_admin,
			(
				u.is_super_admin
				OR EXISTS (
					SELECT 1
					FROM admin_permissions ap
					WHERE ap.user_id = u.id
					  AND ap.permission_key = $1
				)
			) AS can_write_policy
		FROM users u
		WHERE u.is_admin = true OR u.is_super_admin = true
		ORDER BY u.created_at DESC
	`, PermissionPolicyWrite)
	if err != nil {
		return nil, fmt.Errorf("failed to list policy writers: %w", err)
	}
	defer rows.Close()

	writers := []PolicyWriter{}
	for rows.Next() {
		var w PolicyWriter
		if err := rows.Scan(&w.ID, &w.Email, &w.DisplayName, &w.IsAdmin, &w.IsSuperAdmin, &w.CanWritePolicy); err != nil {
			return nil, fmt.Errorf("failed to scan policy writer: %w", err)
		}
		writers = append(writers, w)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate policy writers: %w", err)
	}
	return writers, nil
}

func (s *Service) SetPolicyWriter(ctx context.Context, actorUserID, targetUserID uuid.UUID, enabled bool) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	// Keep super admins implicitly writable and non-removable.
	var targetIsSuper bool
	if err := tx.QueryRowContext(ctx, "SELECT is_super_admin FROM users WHERE id = $1", targetUserID).Scan(&targetIsSuper); err != nil {
		return fmt.Errorf("failed to load target user: %w", err)
	}

	var hadPermission bool
	if err := tx.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM admin_permissions
			WHERE user_id = $1
			  AND permission_key = $2
		)
	`, targetUserID, PermissionPolicyWrite).Scan(&hadPermission); err != nil {
		return fmt.Errorf("failed to load target policy writer permission: %w", err)
	}

	if targetIsSuper {
		hadPermission = true
	}

	if targetIsSuper && !enabled {
		enabled = true
	}

	if enabled {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO admin_permissions (user_id, permission_key)
			VALUES ($1, $2)
			ON CONFLICT (user_id, permission_key) DO NOTHING
		`, targetUserID, PermissionPolicyWrite); err != nil {
			return fmt.Errorf("failed to grant policy writer permission: %w", err)
		}
	} else {
		if _, err := tx.ExecContext(ctx, `
			DELETE FROM admin_permissions
			WHERE user_id = $1
			  AND permission_key = $2
		`, targetUserID, PermissionPolicyWrite); err != nil {
			return fmt.Errorf("failed to revoke policy writer permission: %w", err)
		}
	}

	beforePayload, err := json.Marshal(map[string]bool{"enabled": hadPermission})
	if err != nil {
		return fmt.Errorf("failed to marshal audit before payload: %w", err)
	}
	afterPayload, err := json.Marshal(map[string]bool{"enabled": enabled})
	if err != nil {
		return fmt.Errorf("failed to marshal audit after payload: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO policy_audit_logs (
			id, actor_user_id, action, target_type, target_key, before_payload, after_payload
		) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
	`, uuid.New(), actorUserID, "policy_writer_update", "admin_permission", targetUserID.String(), string(beforePayload), string(afterPayload)); err != nil {
		return fmt.Errorf("failed to insert policy writer audit log: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit policy writer update: %w", err)
	}
	return nil
}
