-- Monthly points grant is now plan-configured (membership_tiers.monthly_points_grant),
-- so this legacy capability should not appear in policy matrix/admin capability management.

UPDATE capabilities
SET
    is_active = FALSE,
    show_on_pricing = FALSE,
    updated_at = NOW()
WHERE key = 'points.monthly_grant';
