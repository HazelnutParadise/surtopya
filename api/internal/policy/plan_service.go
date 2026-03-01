package policy

import (
	"context"
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
}

type SubscriptionPlanCreate struct {
	Code                    string            `json:"code"`
	NameI18n                map[string]string `json:"nameI18n"`
	DescriptionI18n         map[string]string `json:"descriptionI18n"`
	IsActive                bool              `json:"isActive"`
	IsPurchasable           bool              `json:"isPurchasable"`
	ShowOnPricing           bool              `json:"showOnPricing"`
	PriceCentsUSD           int               `json:"priceCentsUsd"`
	BillingInterval         string            `json:"billingInterval"`
	AllowRenewalForExisting bool              `json:"allowRenewalForExisting"`
	MonthlyPointsGrant      int               `json:"monthlyPointsGrant"`
}

type SubscriptionPlanPatch struct {
	NameI18n                *map[string]string `json:"nameI18n"`
	DescriptionI18n         *map[string]string `json:"descriptionI18n"`
	IsActive                *bool              `json:"isActive"`
	IsPurchasable           *bool              `json:"isPurchasable"`
	ShowOnPricing           *bool              `json:"showOnPricing"`
	PriceCentsUSD           *int               `json:"priceCentsUsd"`
	BillingInterval         *string            `json:"billingInterval"`
	AllowRenewalForExisting *bool              `json:"allowRenewalForExisting"`
	MonthlyPointsGrant      *int               `json:"monthlyPointsGrant"`
}

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
		SELECT id, code, name, name_i18n, description_i18n, is_active, is_purchasable, show_on_pricing, price_cents_usd, billing_interval, allow_renewal_for_existing, monthly_points_grant
		FROM membership_tiers
		ORDER BY code
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
		if err := rows.Scan(&plan.ID, &plan.Code, &plan.Name, &nameI18nRaw, &descriptionI18nRaw, &plan.IsActive, &plan.IsPurchasable, &plan.ShowOnPricing, &plan.PriceCentsUSD, &plan.BillingInterval, &plan.AllowRenewalForExisting, &plan.MonthlyPointsGrant); err != nil {
			return nil, fmt.Errorf("failed to scan subscription plan: %w", err)
		}
		_ = json.Unmarshal(nameI18nRaw, &plan.NameI18n)
		_ = json.Unmarshal(descriptionI18nRaw, &plan.DescriptionI18n)
		plan.NameI18n = normalizeI18n(plan.NameI18n, plan.Name)
		plan.DescriptionI18n = normalizeI18n(plan.DescriptionI18n, "")
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
		INSERT INTO membership_tiers (id, code, name, name_i18n, description_i18n, is_active, is_purchasable, show_on_pricing, price_cents_usd, billing_interval, allow_renewal_for_existing, monthly_points_grant)
		VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10, $11, $12)
	`, id, input.Code, name, nameI18nJSON, descriptionI18nJSON, input.IsActive, input.IsPurchasable, input.ShowOnPricing, input.PriceCentsUSD, input.BillingInterval, input.AllowRenewalForExisting, input.MonthlyPointsGrant)
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
	if patch.IsActive != nil {
		target.IsActive = *patch.IsActive
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

	if target.BillingInterval == "" || target.BillingInterval != "month" || target.PriceCentsUSD < 0 || target.MonthlyPointsGrant < 0 {
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
			is_active = $5,
			is_purchasable = $6,
			show_on_pricing = $7,
			price_cents_usd = $8,
			billing_interval = $9,
			allow_renewal_for_existing = $10,
			monthly_points_grant = $11,
			updated_at = NOW()
		WHERE id = $1
	`, target.ID, name, nameI18nJSON, descriptionI18nJSON, target.IsActive, target.IsPurchasable, target.ShowOnPricing, target.PriceCentsUSD, target.BillingInterval, target.AllowRenewalForExisting, target.MonthlyPointsGrant)
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
