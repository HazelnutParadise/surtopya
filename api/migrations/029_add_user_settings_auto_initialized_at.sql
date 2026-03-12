ALTER TABLE users
ADD COLUMN IF NOT EXISTS settings_auto_initialized_at TIMESTAMPTZ NULL;

UPDATE users
SET settings_auto_initialized_at = NOW()
WHERE settings_auto_initialized_at IS NULL;
