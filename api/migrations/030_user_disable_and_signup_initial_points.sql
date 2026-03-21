-- Add user disable flag and configurable signup initial points.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_disabled BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO system_settings (key, value)
VALUES ('signup_initial_points', '0')
ON CONFLICT (key) DO NOTHING;

