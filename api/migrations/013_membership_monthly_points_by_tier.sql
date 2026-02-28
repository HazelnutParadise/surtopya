-- Per-tier monthly points configuration managed by admin subscription plans.

ALTER TABLE membership_tiers
ADD COLUMN IF NOT EXISTS monthly_points_grant INTEGER NOT NULL DEFAULT 0;

-- Preserve legacy behavior for built-in tiers: pro receives 100/month, free receives 0.
UPDATE membership_tiers
SET monthly_points_grant = CASE
    WHEN code = 'pro' THEN 100
    ELSE 0
END
WHERE code IN ('free', 'pro');
