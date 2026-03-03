-- Track whether published surveys have draft-only edits waiting to be published.

ALTER TABLE surveys
ADD COLUMN IF NOT EXISTS has_unpublished_changes BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE surveys
SET has_unpublished_changes = FALSE
WHERE has_unpublished_changes IS DISTINCT FROM FALSE;
