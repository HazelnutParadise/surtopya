ALTER TABLE surveys
ADD COLUMN IF NOT EXISTS ever_public BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE surveys
SET ever_public = TRUE
WHERE ever_public = FALSE
  AND published_count > 0
  AND visibility = 'public';
