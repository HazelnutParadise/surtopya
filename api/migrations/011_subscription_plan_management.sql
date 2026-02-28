-- Subscription plan management + dynamic pricing metadata + membership grant lifecycle.

ALTER TABLE membership_tiers
ADD COLUMN IF NOT EXISTS name_i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS description_i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS is_purchasable BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS show_on_pricing BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS price_cents_usd INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS billing_interval VARCHAR(20) NOT NULL DEFAULT 'month',
ADD COLUMN IF NOT EXISTS allow_renewal_for_existing BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE capabilities
ADD COLUMN IF NOT EXISTS name_i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS description_i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS show_on_pricing BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE user_memberships
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS period_end_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_permanent BOOLEAN NOT NULL DEFAULT TRUE;

-- Backfill localized fields from existing plain-text columns.
UPDATE membership_tiers
SET
    name_i18n = CASE
        WHEN jsonb_typeof(name_i18n) = 'object' AND name_i18n <> '{}'::jsonb THEN name_i18n
        ELSE jsonb_build_object('zh-TW', name, 'en', name, 'ja', name)
    END,
    description_i18n = CASE
        WHEN jsonb_typeof(description_i18n) = 'object' AND description_i18n <> '{}'::jsonb THEN description_i18n
        ELSE jsonb_build_object('zh-TW', COALESCE(name, ''), 'en', COALESCE(name, ''), 'ja', COALESCE(name, ''))
    END;

UPDATE capabilities
SET
    name_i18n = CASE
        WHEN jsonb_typeof(name_i18n) = 'object' AND name_i18n <> '{}'::jsonb THEN name_i18n
        ELSE jsonb_build_object('zh-TW', name, 'en', name, 'ja', name)
    END,
    description_i18n = CASE
        WHEN jsonb_typeof(description_i18n) = 'object' AND description_i18n <> '{}'::jsonb THEN description_i18n
        ELSE jsonb_build_object('zh-TW', COALESCE(description, ''), 'en', COALESCE(description, ''), 'ja', COALESCE(description, ''))
    END;

-- Initial tier defaults for pricing display.
UPDATE membership_tiers
SET
    is_purchasable = TRUE,
    show_on_pricing = TRUE,
    price_cents_usd = CASE
        WHEN code = 'pro' THEN 2900
        ELSE 0
    END,
    billing_interval = 'month',
    allow_renewal_for_existing = TRUE
WHERE code IN ('free', 'pro');

-- Backfill membership lifecycle fields.
UPDATE user_memberships um
SET
    started_at = COALESCE(um.started_at, NOW()),
    is_permanent = CASE WHEN mt.code = 'pro' THEN FALSE ELSE TRUE END,
    period_end_at = CASE
        WHEN mt.code = 'pro' THEN NOW() + INTERVAL '30 days'
        ELSE NULL
    END
FROM membership_tiers mt
WHERE mt.id = um.tier_id;

CREATE INDEX IF NOT EXISTS idx_user_memberships_period_end_at ON user_memberships(period_end_at);

