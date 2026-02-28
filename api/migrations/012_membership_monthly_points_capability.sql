-- Make monthly points grant eligibility policy-driven (tier capability matrix),
-- instead of hardcoding membership_tiers.code = 'pro'.

INSERT INTO capabilities (
    key,
    name,
    description,
    name_i18n,
    description_i18n,
    is_active,
    show_on_pricing
)
VALUES (
    'points.monthly_grant',
    'Monthly points grant',
    'Allows receiving monthly points grant once per month.',
    jsonb_build_object(
        'zh-TW', '每月點數發放',
        'en', 'Monthly points grant',
        'ja', '毎月ポイント付与'
    ),
    jsonb_build_object(
        'zh-TW', '每月最多一次的會員點數發放資格',
        'en', 'Eligible to receive monthly membership points once per month',
        'ja', '毎月1回まで会員ポイント付与を受け取る権限'
    ),
    TRUE,
    TRUE
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO tier_capabilities (tier_id, capability_id, is_allowed)
SELECT
    t.id,
    c.id,
    CASE WHEN t.code = 'pro' THEN TRUE ELSE FALSE END
FROM membership_tiers t
JOIN capabilities c ON c.key = 'points.monthly_grant'
WHERE t.code IN ('free', 'pro')
ON CONFLICT (tier_id, capability_id) DO NOTHING;
