-- Survey versioning and response-open decoupling.

ALTER TABLE surveys
RENAME COLUMN is_published TO is_response_open;

ALTER TABLE surveys
ADD COLUMN IF NOT EXISTS current_published_version_id UUID,
ADD COLUMN IF NOT EXISTS current_published_version_number INTEGER;

-- Rebuild index name for response-open status.
DROP INDEX IF EXISTS idx_surveys_is_published;
CREATE INDEX IF NOT EXISTS idx_surveys_is_response_open ON surveys(is_response_open);

CREATE TABLE IF NOT EXISTS survey_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL CHECK (version_number >= 1),
    snapshot JSONB NOT NULL,
    points_reward INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    published_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (survey_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_survey_versions_survey_id_version_number
    ON survey_versions(survey_id, version_number);

ALTER TABLE surveys
    ADD CONSTRAINT surveys_current_published_version_id_fk
    FOREIGN KEY (current_published_version_id)
    REFERENCES survey_versions(id)
    ON DELETE SET NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'surveys_current_published_version_pair_check'
    ) THEN
        ALTER TABLE surveys
            ADD CONSTRAINT surveys_current_published_version_pair_check
            CHECK (
                (current_published_version_id IS NULL AND current_published_version_number IS NULL)
                OR
                (current_published_version_id IS NOT NULL AND current_published_version_number IS NOT NULL)
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'surveys_current_published_version_number_non_negative'
    ) THEN
        ALTER TABLE surveys
            ADD CONSTRAINT surveys_current_published_version_number_non_negative
            CHECK (
                current_published_version_number IS NULL OR current_published_version_number >= 1
            );
    END IF;
END $$;

WITH legacy_surveys AS (
    SELECT s.*
    FROM surveys s
    WHERE (
        s.published_count > 0
        OR s.is_response_open = TRUE
        OR s.published_at IS NOT NULL
        OR EXISTS (
            SELECT 1
            FROM responses r
            WHERE r.survey_id = s.id
        )
    )
), inserted_versions AS (
    INSERT INTO survey_versions (
        id,
        survey_id,
        version_number,
        snapshot,
        points_reward,
        expires_at,
        published_at,
        published_by
    )
    SELECT
        uuid_generate_v4(),
        s.id,
        1,
        jsonb_build_object(
            'title', s.title,
            'description', s.description,
            'visibility', s.visibility,
            'includeInDatasets', s.include_in_datasets,
            'theme', COALESCE(s.theme, '{}'::jsonb),
            'pointsReward', s.points_reward,
            'expiresAt', s.expires_at,
            'questions', COALESCE((
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', q.id,
                        'type', q.type,
                        'title', q.title,
                        'description', q.description,
                        'options', COALESCE(q.options, '[]'::jsonb),
                        'required', q.required,
                        'maxRating', q.max_rating,
                        'logic', COALESCE(q.logic, '[]'::jsonb),
                        'sortOrder', q.sort_order
                    )
                    ORDER BY q.sort_order
                )
                FROM questions q
                WHERE q.survey_id = s.id
            ), '[]'::jsonb)
        ) AS snapshot,
        s.points_reward,
        s.expires_at,
        COALESCE(s.published_at, s.updated_at, s.created_at),
        s.user_id
    FROM legacy_surveys s
    WHERE NOT EXISTS (
        SELECT 1
        FROM survey_versions existing
        WHERE existing.survey_id = s.id
          AND existing.version_number = 1
    )
    RETURNING survey_id
)
UPDATE surveys s
SET
    current_published_version_id = sv.id,
    current_published_version_number = sv.version_number,
    published_count = GREATEST(COALESCE(s.published_count, 0), 1)
FROM survey_versions sv
WHERE sv.survey_id = s.id
  AND sv.version_number = 1
  AND (
      s.current_published_version_id IS NULL
      OR s.current_published_version_number IS NULL
  );

ALTER TABLE responses
ADD COLUMN IF NOT EXISTS survey_version_id UUID,
ADD COLUMN IF NOT EXISTS survey_version_number INTEGER;

UPDATE responses r
SET
    survey_version_id = s.current_published_version_id,
    survey_version_number = s.current_published_version_number
FROM surveys s
WHERE r.survey_id = s.id
  AND r.survey_version_id IS NULL
  AND s.current_published_version_id IS NOT NULL;

ALTER TABLE responses
    ALTER COLUMN survey_version_id SET NOT NULL,
    ALTER COLUMN survey_version_number SET NOT NULL;

ALTER TABLE responses
    ADD CONSTRAINT responses_survey_version_id_fk
    FOREIGN KEY (survey_version_id)
    REFERENCES survey_versions(id)
    ON DELETE RESTRICT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'responses_survey_version_number_non_negative'
    ) THEN
        ALTER TABLE responses
            ADD CONSTRAINT responses_survey_version_number_non_negative
            CHECK (survey_version_number >= 1);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_responses_survey_version_id ON responses(survey_version_id);
