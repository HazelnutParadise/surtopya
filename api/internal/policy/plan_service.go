package policy

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

type SubscriptionPlan struct {
	ID                      uuid.UUID         `json:"id"`
	Code                    string            `json:"code"`
	Name                    string            `json:"name"`
	NameI18n                map[string]string `json:"nameI18n"`
	DescriptionI18n         map[string]string `json:"descriptionI18n"`
	IsActive                bool              `json:"isActive"`
	IsPurchasable           bool              `json:"isPurchasable"`
	ShowOnPricing           bool              `json:"showOnPricing"`
	PriceCentsUSD           int               `json:"priceCentsUsd"`
	BillingInterval         string            `json:"billingInterval"`
	AllowRenewalForExisting bool              `json:"allowRenewalForExisting"`
	MonthlyPointsGrant      int               `json:"monthlyPointsGrant"`
	MaxActiveSurveys        *int              `json:"maxActiveSurveys"`
	ReplacementTierCode     *string           `json:"replacementTierCode,omitempty"`
}

type SubscriptionPlanCreate struct {
	Code                    string            `json:"code"`
	NameI18n                map[string]string `json:"nameI18n"`
	DescriptionI18n         map[string]string `json:"descriptionI18n"`
	IsPurchasable           bool              `json:"isPurchasable"`
	ShowOnPricing           bool              `json:"showOnPricing"`
	PriceCentsUSD           int               `json:"priceCentsUsd"`
	BillingInterval         string            `json:"billingInterval"`
	AllowRenewalForExisting bool              `json:"allowRenewalForExisting"`
	MonthlyPointsGrant      int               `json:"monthlyPointsGrant"`
	MaxActiveSurveys        *int              `json:"maxActiveSurveys"`
}

type SubscriptionPlanPatch struct {
	NameI18n                *map[string]string `json:"nameI18n"`
	DescriptionI18n         *map[string]string `json:"descriptionI18n"`
	IsPurchasable           *bool              `json:"isPurchasable"`
	ShowOnPricing           *bool              `json:"showOnPricing"`
	PriceCentsUSD           *int               `json:"priceCentsUsd"`
	BillingInterval         *string            `json:"billingInterval"`
	AllowRenewalForExisting *bool              `json:"allowRenewalForExisting"`
	MonthlyPointsGrant      *int               `json:"monthlyPointsGrant"`
	MaxActiveSurveys        *int               `json:"maxActiveSurveys"`
	MaxActiveSurveysSet     bool               `json:"-"`
}

type SubscriptionPlanDeactivate struct {
	ReplacementTierCode string `json:"replacementTierCode"`
	ExecutionTiming     string `json:"executionTiming"`
}

const (
	PlanDeactivationImmediate = "immediate"
	PlanDeactivationOnExpiry  = "on_expiry"
)

type CapabilityPatch struct {
	NameI18n        *map[string]string `json:"nameI18n"`
	DescriptionI18n *map[string]string `json:"descriptionI18n"`
	ShowOnPricing   *bool              `json:"showOnPricing"`
}

func normalizeI18n(value map[string]string, fallback string) map[string]string {
	out := map[string]string{
		"zh-TW": strings.TrimSpace(fallback),
		"en":    strings.TrimSpace(fallback),
		"ja":    strings.TrimSpace(fallback),
	}
	for k, v := range value {
		trimmed := strings.TrimSpace(v)
		if trimmed != "" {
			out[k] = trimmed
		}
	}
	return out
}

func validateI18n(value map[string]string) bool {
	return strings.TrimSpace(value["zh-TW"]) != "" && strings.TrimSpace(value["en"]) != "" && strings.TrimSpace(value["ja"]) != ""
}

func i18nJSON(value map[string]string, fallback string) (string, error) {
	payload, err := json.Marshal(normalizeI18n(value, fallback))
	if err != nil {
		return "", err
	}
	return string(payload), nil
}

func (s *Service) ListSubscriptionPlans(ctx context.Context) ([]SubscriptionPlan, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT
			t.id,
			t.code,
			t.name,
			t.name_i18n,
			t.description_i18n,
			t.is_active,
			t.is_purchasable,
			t.show_on_pricing,
			t.price_cents_usd,
			t.billing_interval,
			t.allow_renewal_for_existing,
			t.monthly_points_grant,
			t.max_active_surveys,
			rt.code AS replacement_tier_code
		FROM membership_tiers t
		LEFT JOIN membership_tiers rt ON rt.id = t.replacement_tier_id
		ORDER BY t.code
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to list subscription plans: %w", err)
	}
	defer rows.Close()

	plans := []SubscriptionPlan{}
	for rows.Next() {
		var plan SubscriptionPlan
		var nameI18nRaw []byte
		var descriptionI18nRaw []byte
		var maxActiveSurveys sql.NullInt64
		var replacementTierCode sql.NullString
		if err := rows.Scan(&plan.ID, &plan.Code, &plan.Name, &nameI18nRaw, &descriptionI18nRaw, &plan.IsActive, &plan.IsPurchasable, &plan.ShowOnPricing, &plan.PriceCentsUSD, &plan.BillingInterval, &plan.AllowRenewalForExisting, &plan.MonthlyPointsGrant, &maxActiveSurveys, &replacementTierCode); err != nil {
			return nil, fmt.Errorf("failed to scan subscription plan: %w", err)
		}
		_ = json.Unmarshal(nameI18nRaw, &plan.NameI18n)
		_ = json.Unmarshal(descriptionI18nRaw, &plan.DescriptionI18n)
		plan.NameI18n = normalizeI18n(plan.NameI18n, plan.Name)
		plan.DescriptionI18n = normalizeI18n(plan.DescriptionI18n, "")
		if maxActiveSurveys.Valid {
			value := int(maxActiveSurveys.Int64)
			plan.MaxActiveSurveys = &value
		}
		if replacementTierCode.Valid {
			plan.ReplacementTierCode = &replacementTierCode.String
		}
		plans = append(plans, plan)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate subscription plans: %w", err)
	}
	return plans, nil
}

func (s *Service) CreateSubscriptionPlan(ctx context.Context, input SubscriptionPlanCreate) (SubscriptionPlan, error) {
	input.Code = strings.TrimSpace(strings.ToLower(input.Code))
	if input.Code == "" || input.BillingInterval == "" || input.BillingInterval != "month" || input.PriceCentsUSD < 0 || input.MonthlyPointsGrant < 0 {
		return SubscriptionPlan{}, ErrInvalidMembershipGrant
	}
	if input.MaxActiveSurveys != nil && *input.MaxActiveSurveys < 0 {
		return SubscriptionPlan{}, ErrInvalidMembershipGrant
	}
	if !validateI18n(input.NameI18n) || !validateI18n(input.DescriptionI18n) {
		return SubscriptionPlan{}, ErrInvalidMembershipGrant
	}

	name := strings.TrimSpace(input.NameI18n["en"])
	if name == "" {
		name = strings.TrimSpace(input.NameI18n["zh-TW"])
	}
	nameI18nJSON, err := i18nJSON(input.NameI18n, name)
	if err != nil {
		return SubscriptionPlan{}, fmt.Errorf("failed to encode name i18n: %w", err)
	}
	descriptionI18nJSON, err := i18nJSON(input.DescriptionI18n, "")
	if err != nil {
		return SubscriptionPlan{}, fmt.Errorf("failed to encode description i18n: %w", err)
	}

	id := uuid.New()
	_, err = s.db.ExecContext(ctx, `
		INSERT INTO membership_tiers (id, code, name, name_i18n, description_i18n, is_purchasable, show_on_pricing, price_cents_usd, billing_interval, allow_renewal_for_existing, monthly_points_grant, max_active_surveys)
		VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10, $11, $12)
	`, id, input.Code, name, nameI18nJSON, descriptionI18nJSON, input.IsPurchasable, input.ShowOnPricing, input.PriceCentsUSD, input.BillingInterval, input.AllowRenewalForExisting, input.MonthlyPointsGrant, input.MaxActiveSurveys)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			return SubscriptionPlan{}, ErrPlanCodeExists
		}
		return SubscriptionPlan{}, fmt.Errorf("failed to create subscription plan: %w", err)
	}

	plans, err := s.ListSubscriptionPlans(ctx)
	if err != nil {
		return SubscriptionPlan{}, err
	}
	for _, plan := range plans {
		if plan.ID == id {
			return plan, nil
		}
	}
	return SubscriptionPlan{}, ErrTierNotFound
}

func (s *Service) UpdateSubscriptionPlan(ctx context.Context, id uuid.UUID, patch SubscriptionPlanPatch) (SubscriptionPlan, error) {
	plans, err := s.ListSubscriptionPlans(ctx)
	if err != nil {
		return SubscriptionPlan{}, err
	}

	var target *SubscriptionPlan
	for i := range plans {
		if plans[i].ID == id {
			target = &plans[i]
			break
		}
	}
	if target == nil {
		return SubscriptionPlan{}, ErrTierNotFound
	}

	if patch.NameI18n != nil {
		target.NameI18n = *patch.NameI18n
	}
	if patch.DescriptionI18n != nil {
		target.DescriptionI18n = *patch.DescriptionI18n
	}
	if patch.IsPurchasable != nil {
		target.IsPurchasable = *patch.IsPurchasable
	}
	if patch.ShowOnPricing != nil {
		target.ShowOnPricing = *patch.ShowOnPricing
	}
	if patch.PriceCentsUSD != nil {
		target.PriceCentsUSD = *patch.PriceCentsUSD
	}
	if patch.BillingInterval != nil {
		target.BillingInterval = strings.TrimSpace(*patch.BillingInterval)
	}
	if patch.AllowRenewalForExisting != nil {
		target.AllowRenewalForExisting = *patch.AllowRenewalForExisting
	}
	if patch.MonthlyPointsGrant != nil {
		target.MonthlyPointsGrant = *patch.MonthlyPointsGrant
	}
	if patch.MaxActiveSurveysSet {
		target.MaxActiveSurveys = patch.MaxActiveSurveys
	}

	if target.BillingInterval == "" || target.BillingInterval != "month" || target.PriceCentsUSD < 0 || target.MonthlyPointsGrant < 0 {
		return SubscriptionPlan{}, ErrInvalidMembershipGrant
	}
	if target.MaxActiveSurveys != nil && *target.MaxActiveSurveys < 0 {
		return SubscriptionPlan{}, ErrInvalidMembershipGrant
	}
	if !validateI18n(target.NameI18n) || !validateI18n(target.DescriptionI18n) {
		return SubscriptionPlan{}, ErrInvalidMembershipGrant
	}

	name := strings.TrimSpace(target.NameI18n["en"])
	if name == "" {
		name = strings.TrimSpace(target.NameI18n["zh-TW"])
	}
	nameI18nJSON, err := i18nJSON(target.NameI18n, name)
	if err != nil {
		return SubscriptionPlan{}, fmt.Errorf("failed to encode name i18n: %w", err)
	}
	descriptionI18nJSON, err := i18nJSON(target.DescriptionI18n, "")
	if err != nil {
		return SubscriptionPlan{}, fmt.Errorf("failed to encode description i18n: %w", err)
	}

	_, err = s.db.ExecContext(ctx, `
		UPDATE membership_tiers
		SET name = $2,
			name_i18n = $3::jsonb,
			description_i18n = $4::jsonb,
			is_purchasable = $5,
			show_on_pricing = $6,
			price_cents_usd = $7,
			billing_interval = $8,
			allow_renewal_for_existing = $9,
			monthly_points_grant = $10,
			max_active_surveys = $11,
			updated_at = NOW()
		WHERE id = $1
	`, target.ID, name, nameI18nJSON, descriptionI18nJSON, target.IsPurchasable, target.ShowOnPricing, target.PriceCentsUSD, target.BillingInterval, target.AllowRenewalForExisting, target.MonthlyPointsGrant, target.MaxActiveSurveys)
	if err != nil {
		return SubscriptionPlan{}, fmt.Errorf("failed to update subscription plan: %w", err)
	}

	updatedPlans, err := s.ListSubscriptionPlans(ctx)
	if err != nil {
		return SubscriptionPlan{}, err
	}
	for _, plan := range updatedPlans {
		if plan.ID == id {
			return plan, nil
		}
	}
	return SubscriptionPlan{}, ErrTierNotFound
}

func (s *Service) DeactivateSubscriptionPlan(ctx context.Context, actorUserID uuid.UUID, id uuid.UUID, input SubscriptionPlanDeactivate) (SubscriptionPlan, int64, error) {
	replacementCode := strings.TrimSpace(strings.ToLower(input.ReplacementTierCode))
	executionTiming := strings.TrimSpace(strings.ToLower(input.ExecutionTiming))
	if replacementCode == "" || (executionTiming != PlanDeactivationImmediate && executionTiming != PlanDeactivationOnExpiry) {
		return SubscriptionPlan{}, 0, ErrInvalidPlanDeactivation
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return SubscriptionPlan{}, 0, fmt.Errorf("failed to start transaction: %w", err)
	}
	defer tx.Rollback()

	var sourceCode string
	var sourceActive bool
	if err := tx.QueryRowContext(ctx, `
		SELECT code, is_active
		FROM membership_tiers
		WHERE id = $1
	`, id).Scan(&sourceCode, &sourceActive); err != nil {
		if err == sql.ErrNoRows {
			return SubscriptionPlan{}, 0, ErrTierNotFound
		}
		return SubscriptionPlan{}, 0, fmt.Errorf("failed to load source plan: %w", err)
	}
	if sourceCode == DefaultMembershipTierCode || !sourceActive {
		return SubscriptionPlan{}, 0, ErrInvalidPlanDeactivation
	}

	var replacementID uuid.UUID
	var resolvedReplacementCode string
	var replacementActive bool
	if err := tx.QueryRowContext(ctx, `
		SELECT id, code, is_active
		FROM membership_tiers
		WHERE code = $1
	`, replacementCode).Scan(&replacementID, &resolvedReplacementCode, &replacementActive); err != nil {
		if err == sql.ErrNoRows {
			return SubscriptionPlan{}, 0, ErrTierNotFound
		}
		return SubscriptionPlan{}, 0, fmt.Errorf("failed to load replacement plan: %w", err)
	}
	if replacementID == id || !replacementActive {
		return SubscriptionPlan{}, 0, ErrInvalidPlanDeactivation
	}
	replacementIsFree := resolvedReplacementCode == DefaultMembershipTierCode

	var affectedUsers int64
	if executionTiming == PlanDeactivationImmediate {
		res, err := tx.ExecContext(ctx, `
			UPDATE user_memberships um
			SET tier_id = $2,
				started_at = NOW(),
				period_end_at = CASE
					WHEN $3 THEN NULL
					ELSE um.period_end_at
				END,
				is_permanent = CASE
					WHEN $3 THEN TRUE
					ELSE um.is_permanent
				END,
				updated_at = NOW()
			WHERE um.tier_id = $1
		`, id, replacementID, replacementIsFree)
		if err != nil {
			return SubscriptionPlan{}, 0, fmt.Errorf("failed to migrate subscribers immediately: %w", err)
		}
		affectedUsers, _ = res.RowsAffected()

		if _, err := tx.ExecContext(ctx, `
			UPDATE membership_tiers
			SET is_active = FALSE,
				replacement_tier_id = NULL,
				updated_at = NOW()
			WHERE id = $1
		`, id); err != nil {
			return SubscriptionPlan{}, 0, fmt.Errorf("failed to deactivate subscription plan: %w", err)
		}
	} else {
		res, err := tx.ExecContext(ctx, `
			UPDATE user_memberships um
			SET tier_id = $2,
				started_at = NOW(),
				period_end_at = CASE
					WHEN $3 THEN NULL
					ELSE um.period_end_at
				END,
				is_permanent = CASE
					WHEN $3 THEN TRUE
					ELSE um.is_permanent
				END,
				updated_at = NOW()
			WHERE um.tier_id = $1
			  AND um.is_permanent = TRUE
		`, id, replacementID, replacementIsFree)
		if err != nil {
			return SubscriptionPlan{}, 0, fmt.Errorf("failed to migrate permanent subscribers: %w", err)
		}
		affectedUsers, _ = res.RowsAffected()

		if _, err := tx.ExecContext(ctx, `
			UPDATE membership_tiers
			SET is_active = FALSE,
				replacement_tier_id = $2,
				updated_at = NOW()
			WHERE id = $1
		`, id, replacementID); err != nil {
			return SubscriptionPlan{}, 0, fmt.Errorf("failed to deactivate subscription plan: %w", err)
		}
	}

	beforePayload, err := json.Marshal(map[string]any{
		"sourceTierCode": sourceCode,
		"isActive":       true,
	})
	if err != nil {
		return SubscriptionPlan{}, 0, fmt.Errorf("failed to marshal plan deactivation before payload: %w", err)
	}
	afterPayload, err := json.Marshal(map[string]any{
		"sourceTierCode":       sourceCode,
		"isActive":             false,
		"replacementTierCode":  resolvedReplacementCode,
		"executionTiming":      executionTiming,
		"migratedUsersCount":   affectedUsers,
		"replacementIsDefault": replacementIsFree,
	})
	if err != nil {
		return SubscriptionPlan{}, 0, fmt.Errorf("failed to marshal plan deactivation after payload: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO policy_audit_logs (
			id, actor_user_id, action, target_type, target_key, before_payload, after_payload
		) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
	`, uuid.New(), actorUserID, "subscription_plan_deactivate", "membership_tier", sourceCode, string(beforePayload), string(afterPayload)); err != nil {
		return SubscriptionPlan{}, 0, fmt.Errorf("failed to insert plan deactivation audit log: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return SubscriptionPlan{}, 0, fmt.Errorf("failed to commit plan deactivation: %w", err)
	}

	plans, err := s.ListSubscriptionPlans(ctx)
	if err != nil {
		return SubscriptionPlan{}, 0, err
	}
	for _, plan := range plans {
		if plan.ID == id {
			return plan, affectedUsers, nil
		}
	}
	return SubscriptionPlan{}, 0, ErrTierNotFound
}

func (s *Service) ListCapabilitiesAdmin(ctx context.Context) ([]Capability, error) {
	capRows, err := s.db.QueryContext(ctx, `
		SELECT id, key, name, description, name_i18n, description_i18n, is_active, show_on_pricing
		FROM capabilities
		WHERE is_active = TRUE
		ORDER BY key
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to list capabilities: %w", err)
	}
	defer capRows.Close()

	capabilities := []Capability{}
	for capRows.Next() {
		var c Capability
		var nameI18nRaw []byte
		var descriptionI18nRaw []byte
		if err := capRows.Scan(&c.ID, &c.Key, &c.Name, &c.Description, &nameI18nRaw, &descriptionI18nRaw, &c.IsActive, &c.ShowOnPricing); err != nil {
			return nil, fmt.Errorf("failed to scan capability: %w", err)
		}
		_ = json.Unmarshal(nameI18nRaw, &c.NameI18n)
		_ = json.Unmarshal(descriptionI18nRaw, &c.DescriptionI18n)
		c.NameI18n = normalizeI18n(c.NameI18n, c.Name)
		c.DescriptionI18n = normalizeI18n(c.DescriptionI18n, "")
		capabilities = append(capabilities, c)
	}
	if err := capRows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate capabilities: %w", err)
	}
	return capabilities, nil
}

func (s *Service) UpdateCapabilityDisplay(ctx context.Context, id uuid.UUID, patch CapabilityPatch) (Capability, error) {
	capabilities, err := s.ListCapabilitiesAdmin(ctx)
	if err != nil {
		return Capability{}, err
	}
	var target *Capability
	for i := range capabilities {
		if capabilities[i].ID == id {
			target = &capabilities[i]
			break
		}
	}
	if target == nil {
		return Capability{}, ErrCapabilityNotFound
	}

	if patch.NameI18n != nil {
		target.NameI18n = *patch.NameI18n
	}
	if patch.DescriptionI18n != nil {
		target.DescriptionI18n = *patch.DescriptionI18n
	}
	if patch.ShowOnPricing != nil {
		target.ShowOnPricing = *patch.ShowOnPricing
	}
	if !validateI18n(target.NameI18n) || !validateI18n(target.DescriptionI18n) {
		return Capability{}, ErrInvalidMembershipGrant
	}

	name := strings.TrimSpace(target.NameI18n["en"])
	if name == "" {
		name = strings.TrimSpace(target.NameI18n["zh-TW"])
	}
	nameI18nJSON, err := i18nJSON(target.NameI18n, name)
	if err != nil {
		return Capability{}, fmt.Errorf("failed to encode capability name i18n: %w", err)
	}
	descriptionI18nJSON, err := i18nJSON(target.DescriptionI18n, "")
	if err != nil {
		return Capability{}, fmt.Errorf("failed to encode capability description i18n: %w", err)
	}

	description := strings.TrimSpace(target.DescriptionI18n["en"])
	var descriptionValue *string
	if description != "" {
		descriptionValue = &description
	}
	_, err = s.db.ExecContext(ctx, `
		UPDATE capabilities
		SET name = $2,
			description = $3,
			name_i18n = $4::jsonb,
			description_i18n = $5::jsonb,
			show_on_pricing = $6,
			updated_at = NOW()
		WHERE id = $1
	`, target.ID, name, descriptionValue, nameI18nJSON, descriptionI18nJSON, target.ShowOnPricing)
	if err != nil {
		return Capability{}, fmt.Errorf("failed to update capability display: %w", err)
	}

	updatedCaps, err := s.ListCapabilitiesAdmin(ctx)
	if err != nil {
		return Capability{}, err
	}
	for _, capability := range updatedCaps {
		if capability.ID == id {
			return capability, nil
		}
	}
	return Capability{}, ErrCapabilityNotFound
}
