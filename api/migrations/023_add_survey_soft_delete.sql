ALTER TABLE surveys
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_surveys_deleted_at ON surveys(deleted_at);
