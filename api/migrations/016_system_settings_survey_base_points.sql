-- Global system settings used by backend/runtime configuration.

CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Default base reward for authenticated survey completions.
INSERT INTO system_settings (key, value)
VALUES ('survey_base_points', '1')
ON CONFLICT (key) DO NOTHING;
