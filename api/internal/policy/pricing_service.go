package policy

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

type PricingBenefit struct {
	Key         string `json:"key"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type PricingPlan struct {
	Code               string           `json:"code"`
	Name               string           `json:"name"`
	Description        string           `json:"description"`
	PriceCentsUSD      int              `json:"priceCentsUsd"`
	MonthlyPointsGrant int              `json:"monthlyPointsGrant"`
	MaxActiveSurveys   *int             `json:"maxActiveSurveys"`
	Currency           string           `json:"currency"`
	BillingInterval    string           `json:"billingInterval"`
	IsPurchasable      bool             `json:"isPurchasable"`
	Benefits           []PricingBenefit `json:"benefits"`
}

func localizedFromI18n(i18n map[string]string, locale, fallback string) string {
	if len(i18n) == 0 {
		return fallback
	}
	if v := strings.TrimSpace(i18n[locale]); v != "" {
		return v
	}
	if v := strings.TrimSpace(i18n["zh-TW"]); v != "" {
		return v
	}
	if v := strings.TrimSpace(i18n["en"]); v != "" {
		return v
	}
	for _, v := range i18n {
		if trimmed := strings.TrimSpace(v); trimmed != "" {
			return trimmed
		}
	}
	return fallback
}

func monthlyPointsBenefit(locale string, points int) PricingBenefit {
	name := fmt.Sprintf("%d base points per month", points)
	switch locale {
	case "zh-TW":
		name = fmt.Sprintf("\u6bcf\u6708\u57fa\u790e\u9ede\u6578 %d \u9ede", points)
	case "ja":
		name = fmt.Sprintf("\u6bce\u6708\u306e\u57fa\u672c\u30dd\u30a4\u30f3\u30c8 %d", points)
	}
	return PricingBenefit{
		Key:         "points.monthly_base",
		Name:        name,
		Description: "",
	}
}

func activeSurveysBenefit(locale string, maxActiveSurveys *int) PricingBenefit {
	var name string
	if maxActiveSurveys == nil {
		name = "Unlimited active surveys"
		switch locale {
		case "zh-TW":
			name = "無限制進行中問卷"
		case "ja":
			name = "進行中アンケート無制限"
		}
	} else {
		name = fmt.Sprintf("%d active surveys", *maxActiveSurveys)
		switch locale {
		case "zh-TW":
			name = fmt.Sprintf("%d 份進行中問卷", *maxActiveSurveys)
		case "ja":
			name = fmt.Sprintf("進行中アンケート %d 件", *maxActiveSurveys)
		}
	}

	return PricingBenefit{
		Key:         "surveys.active_limit",
		Name:        name,
		Description: "",
	}
}

func (s *Service) ListPricingPlans(ctx context.Context, locale string) ([]PricingPlan, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, code, name, name_i18n, description_i18n, price_cents_usd, monthly_points_grant, max_active_surveys, billing_interval, is_purchasable
		FROM membership_tiers
		WHERE is_active = TRUE
		  AND show_on_pricing = TRUE
		ORDER BY price_cents_usd ASC, code ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to list pricing plans: %w", err)
	}
	defer rows.Close()

	planIndex := map[uuid.UUID]int{}
	plans := []PricingPlan{}
	for rows.Next() {
		var tierID uuid.UUID
		var code string
		var fallbackName string
		var nameI18nRaw []byte
		var descriptionI18nRaw []byte
		var price int
		var monthlyPointsGrant int
		var maxActiveSurveys sql.NullInt64
		var billingInterval string
		var isPurchasable bool
		if err := rows.Scan(&tierID, &code, &fallbackName, &nameI18nRaw, &descriptionI18nRaw, &price, &monthlyPointsGrant, &maxActiveSurveys, &billingInterval, &isPurchasable); err != nil {
			return nil, fmt.Errorf("failed to scan pricing plan: %w", err)
		}
		nameI18n := map[string]string{}
		descriptionI18n := map[string]string{}
		_ = json.Unmarshal(nameI18nRaw, &nameI18n)
		_ = json.Unmarshal(descriptionI18nRaw, &descriptionI18n)
		var maxActiveSurveysValue *int
		if maxActiveSurveys.Valid {
			value := int(maxActiveSurveys.Int64)
			maxActiveSurveysValue = &value
		}
		planIndex[tierID] = len(plans)
		plans = append(plans, PricingPlan{
			Code:               code,
			Name:               localizedFromI18n(nameI18n, locale, fallbackName),
			Description:        localizedFromI18n(descriptionI18n, locale, ""),
			PriceCentsUSD:      price,
			MonthlyPointsGrant: monthlyPointsGrant,
			MaxActiveSurveys:   maxActiveSurveysValue,
			Currency:           "USD",
			BillingInterval:    billingInterval,
			IsPurchasable:      isPurchasable,
			Benefits: []PricingBenefit{
				monthlyPointsBenefit(locale, monthlyPointsGrant),
				activeSurveysBenefit(locale, maxActiveSurveysValue),
			},
		})
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate pricing plans: %w", err)
	}

	benefitsRows, err := s.db.QueryContext(ctx, `
		SELECT t.id, c.key, c.name, c.description, c.name_i18n, c.description_i18n
		FROM membership_tiers t
		JOIN tier_capabilities tc ON tc.tier_id = t.id AND tc.is_allowed = TRUE
		JOIN capabilities c ON c.id = tc.capability_id
		WHERE t.is_active = TRUE
		  AND t.show_on_pricing = TRUE
		  AND c.is_active = TRUE
		  AND c.show_on_pricing = TRUE
		ORDER BY t.code, c.key
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to load pricing benefits: %w", err)
	}
	defer benefitsRows.Close()

	for benefitsRows.Next() {
		var tierID uuid.UUID
		var key string
		var fallbackName string
		var fallbackDescription sql.NullString
		var nameI18nRaw []byte
		var descriptionI18nRaw []byte
		if err := benefitsRows.Scan(&tierID, &key, &fallbackName, &fallbackDescription, &nameI18nRaw, &descriptionI18nRaw); err != nil {
			return nil, fmt.Errorf("failed to scan pricing benefit: %w", err)
		}
		idx, exists := planIndex[tierID]
		if !exists {
			continue
		}
		nameI18n := map[string]string{}
		descriptionI18n := map[string]string{}
		_ = json.Unmarshal(nameI18nRaw, &nameI18n)
		_ = json.Unmarshal(descriptionI18nRaw, &descriptionI18n)
		fallbackDesc := ""
		if fallbackDescription.Valid {
			fallbackDesc = fallbackDescription.String
		}
		plans[idx].Benefits = append(plans[idx].Benefits, PricingBenefit{
			Key:         key,
			Name:        localizedFromI18n(nameI18n, locale, fallbackName),
			Description: localizedFromI18n(descriptionI18n, locale, fallbackDesc),
		})
	}
	if err := benefitsRows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate pricing benefits: %w", err)
	}

	return plans, nil
}
