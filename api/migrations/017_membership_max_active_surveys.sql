-- Configurable per-plan limit for concurrent active surveys.
-- NULL means unlimited.

ALTER TABLE membership_tiers
ADD COLUMN IF NOT EXISTS max_active_surveys INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'membership_tiers_max_active_surveys_non_negative'
    ) THEN
        ALTER TABLE membership_tiers
        ADD CONSTRAINT membership_tiers_max_active_surveys_non_negative
        CHECK (max_active_surveys IS NULL OR max_active_surveys >= 0);
    END IF;
END $$;

-- Defaults for built-in plans:
-- free = 3 active surveys, pro = unlimited (NULL).
UPDATE membership_tiers
SET max_active_surveys = CASE
    WHEN code = 'free' THEN 3
    WHEN code = 'pro' THEN NULL
    ELSE max_active_surveys
END
WHERE code IN ('free', 'pro');
