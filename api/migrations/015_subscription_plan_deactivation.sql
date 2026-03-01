-- Support retiring subscription plans with replacement handling for existing subscribers.

ALTER TABLE membership_tiers
ADD COLUMN IF NOT EXISTS replacement_tier_id UUID REFERENCES membership_tiers(id) ON DELETE SET NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'membership_tiers_replacement_not_self'
    ) THEN
        ALTER TABLE membership_tiers
        ADD CONSTRAINT membership_tiers_replacement_not_self
        CHECK (replacement_tier_id IS NULL OR replacement_tier_id <> id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_membership_tiers_replacement_tier_id
    ON membership_tiers(replacement_tier_id);

UPDATE membership_tiers
SET replacement_tier_id = NULL
WHERE code = 'free';
