-- Membership ACL + policy management center.

CREATE TABLE membership_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE user_memberships (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    tier_id UUID NOT NULL REFERENCES membership_tiers(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE capabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(150) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE tier_capabilities (
    tier_id UUID NOT NULL REFERENCES membership_tiers(id) ON DELETE CASCADE,
    capability_id UUID NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
    is_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (tier_id, capability_id)
);

CREATE TABLE admin_permissions (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_key VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, permission_key)
);

CREATE TABLE policy_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(100) NOT NULL,
    target_key VARCHAR(150) NOT NULL,
    before_payload JSONB,
    after_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_memberships_tier_id ON user_memberships(tier_id);
CREATE INDEX idx_tier_capabilities_capability_id ON tier_capabilities(capability_id);
CREATE INDEX idx_admin_permissions_permission_key ON admin_permissions(permission_key);
CREATE INDEX idx_policy_audit_logs_target ON policy_audit_logs(target_type, target_key);
CREATE INDEX idx_policy_audit_logs_actor ON policy_audit_logs(actor_user_id);

-- Updated_at triggers
CREATE TRIGGER update_membership_tiers_updated_at BEFORE UPDATE ON membership_tiers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_memberships_updated_at BEFORE UPDATE ON user_memberships
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_capabilities_updated_at BEFORE UPDATE ON capabilities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tier_capabilities_updated_at BEFORE UPDATE ON tier_capabilities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed membership tiers
INSERT INTO membership_tiers (code, name, is_active)
VALUES
    ('free', 'Free', TRUE),
    ('pro', 'Pro', TRUE)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Seed capabilities
INSERT INTO capabilities (key, name, description, is_active)
VALUES
    (
        'survey.public_dataset_opt_out',
        'Public survey dataset opt-out',
        'Allows opting out of dataset plan while survey visibility is public before publish lock.',
        TRUE
    )
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Seed tier capability matrix: free=false, pro=true
INSERT INTO tier_capabilities (tier_id, capability_id, is_allowed)
SELECT t.id, c.id, CASE WHEN t.code = 'pro' THEN TRUE ELSE FALSE END
FROM membership_tiers t
JOIN capabilities c ON c.key = 'survey.public_dataset_opt_out'
WHERE t.code IN ('free', 'pro')
ON CONFLICT (tier_id, capability_id) DO UPDATE SET
    is_allowed = EXCLUDED.is_allowed,
    updated_at = NOW();

-- Backfill user memberships from legacy users.is_pro
INSERT INTO user_memberships (user_id, tier_id)
SELECT
    u.id,
    CASE WHEN u.is_pro THEN pro_tier.id ELSE free_tier.id END AS tier_id
FROM users u
JOIN membership_tiers free_tier ON free_tier.code = 'free'
JOIN membership_tiers pro_tier ON pro_tier.code = 'pro'
ON CONFLICT (user_id) DO UPDATE SET
    tier_id = EXCLUDED.tier_id,
    updated_at = NOW();

ALTER TABLE users
DROP COLUMN IF EXISTS is_pro;
