-- Backfill retired plan replacement to free tier when legacy rows are unset.

DO $$
DECLARE
    free_tier_id UUID;
BEGIN
    SELECT id INTO free_tier_id
    FROM membership_tiers
    WHERE code = 'free'
    LIMIT 1;

    IF free_tier_id IS NULL THEN
        RAISE EXCEPTION 'membership_tiers.free tier is required for replacement backfill';
    END IF;

    UPDATE membership_tiers
    SET replacement_tier_id = free_tier_id,
        updated_at = NOW()
    WHERE is_active = FALSE
      AND code <> 'free'
      AND replacement_tier_id IS NULL;
END $$;
