ALTER TABLE platform_event_logs
    ADD COLUMN IF NOT EXISTS client_ip TEXT;

CREATE INDEX IF NOT EXISTS idx_platform_event_logs_created_at_id
    ON platform_event_logs(created_at DESC, id DESC);
