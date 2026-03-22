-- Backfill de-identification permissions for existing agent accounts.
-- This migration is idempotent and can be safely re-run.

INSERT INTO agent_admin_permissions (account_id, permission_key)
SELECT DISTINCT account_id, 'deid.read'
FROM agent_admin_permissions
WHERE permission_key = 'surveys.read'
ON CONFLICT (account_id, permission_key) DO NOTHING;

INSERT INTO agent_admin_permissions (account_id, permission_key)
SELECT DISTINCT account_id, 'deid.write'
FROM agent_admin_permissions
WHERE permission_key = 'surveys.write'
ON CONFLICT (account_id, permission_key) DO NOTHING;
