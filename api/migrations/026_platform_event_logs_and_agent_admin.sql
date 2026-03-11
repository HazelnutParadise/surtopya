-- Structured platform event logs + agent admin machine identities.

CREATE TABLE IF NOT EXISTS platform_event_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    correlation_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    module VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL,
    actor_type VARCHAR(50) NOT NULL,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_agent_id UUID,
    owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    resource_owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    request_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    response_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_code VARCHAR(100),
    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_platform_event_logs_created_at
    ON platform_event_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_event_logs_correlation_id
    ON platform_event_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_platform_event_logs_module_action
    ON platform_event_logs(module, action);
CREATE INDEX IF NOT EXISTS idx_platform_event_logs_status
    ON platform_event_logs(status);
CREATE INDEX IF NOT EXISTS idx_platform_event_logs_actor
    ON platform_event_logs(actor_type, actor_user_id, actor_agent_id);
CREATE INDEX IF NOT EXISTS idx_platform_event_logs_resource
    ON platform_event_logs(resource_type, resource_id);

CREATE TABLE IF NOT EXISTS agent_admin_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_admin_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES agent_admin_accounts(id) ON DELETE CASCADE,
    key_prefix VARCHAR(32) NOT NULL,
    encrypted_secret TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    revealed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_admin_api_keys_prefix_active
    ON agent_admin_api_keys(key_prefix, is_active);
CREATE INDEX IF NOT EXISTS idx_agent_admin_api_keys_account_id
    ON agent_admin_api_keys(account_id);

CREATE TABLE IF NOT EXISTS agent_admin_permissions (
    account_id UUID NOT NULL REFERENCES agent_admin_accounts(id) ON DELETE CASCADE,
    permission_key VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (account_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_agent_admin_permissions_permission_key
    ON agent_admin_permissions(permission_key);

DROP TRIGGER IF EXISTS update_agent_admin_accounts_updated_at ON agent_admin_accounts;
CREATE TRIGGER update_agent_admin_accounts_updated_at BEFORE UPDATE ON agent_admin_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_agent_admin_api_keys_updated_at ON agent_admin_api_keys;
CREATE TRIGGER update_agent_admin_api_keys_updated_at BEFORE UPDATE ON agent_admin_api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
