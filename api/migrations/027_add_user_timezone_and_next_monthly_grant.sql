-- Add user time zone preference and next monthly grant boundary.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) NOT NULL DEFAULT 'Asia/Taipei',
ADD COLUMN IF NOT EXISTS pro_points_next_grant_at TIMESTAMP WITH TIME ZONE;

UPDATE users
SET timezone = 'Asia/Taipei'
WHERE COALESCE(NULLIF(BTRIM(timezone), ''), '') = '';

UPDATE users
SET pro_points_next_grant_at = (
    (date_trunc('month', pro_points_last_granted_at AT TIME ZONE 'UTC') + INTERVAL '1 month') AT TIME ZONE 'UTC'
)
WHERE pro_points_last_granted_at IS NOT NULL
  AND pro_points_next_grant_at IS NULL;
