-- Ensure response-open surveys always have a published version.

UPDATE surveys
SET is_response_open = FALSE
WHERE is_response_open = TRUE
  AND current_published_version_id IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'surveys_response_open_requires_published_version'
    ) THEN
        ALTER TABLE surveys
            ADD CONSTRAINT surveys_response_open_requires_published_version
            CHECK (
                is_response_open = FALSE
                OR current_published_version_id IS NOT NULL
            );
    END IF;
END $$;

