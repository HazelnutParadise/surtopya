-- Split in-progress responses into dedicated draft tables.

CREATE TABLE IF NOT EXISTS response_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    survey_version_id UUID NOT NULL REFERENCES survey_versions(id) ON DELETE RESTRICT,
    survey_version_number INTEGER NOT NULL CHECK (survey_version_number >= 1),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (survey_id, user_id)
);

CREATE TABLE IF NOT EXISTS response_draft_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    draft_id UUID NOT NULL REFERENCES response_drafts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (draft_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_response_drafts_user_id ON response_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_response_drafts_survey_id ON response_drafts(survey_id);
CREATE INDEX IF NOT EXISTS idx_response_draft_answers_draft_id ON response_draft_answers(draft_id);

DROP TRIGGER IF EXISTS update_response_drafts_updated_at ON response_drafts;
CREATE TRIGGER update_response_drafts_updated_at BEFORE UPDATE ON response_drafts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_response_draft_answers_updated_at ON response_draft_answers;
CREATE TRIGGER update_response_draft_answers_updated_at BEFORE UPDATE ON response_draft_answers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migrate existing authenticated in-progress responses into draft tables.
INSERT INTO response_drafts (
    id,
    survey_id,
    survey_version_id,
    survey_version_number,
    user_id,
    started_at,
    updated_at,
    created_at
)
SELECT
    r.id,
    r.survey_id,
    r.survey_version_id,
    r.survey_version_number,
    r.user_id,
    COALESCE(r.started_at, r.created_at, NOW()),
    COALESCE(r.created_at, NOW()),
    COALESCE(r.created_at, NOW())
FROM responses r
WHERE r.status = 'in_progress'
  AND r.user_id IS NOT NULL
ON CONFLICT (survey_id, user_id) DO UPDATE
SET
    survey_version_id = EXCLUDED.survey_version_id,
    survey_version_number = EXCLUDED.survey_version_number,
    started_at = LEAST(response_drafts.started_at, EXCLUDED.started_at),
    updated_at = GREATEST(response_drafts.updated_at, EXCLUDED.updated_at);

INSERT INTO response_draft_answers (
    id,
    draft_id,
    question_id,
    value,
    created_at,
    updated_at
)
SELECT
    a.id,
    a.response_id,
    a.question_id,
    a.value,
    a.created_at,
    COALESCE(a.created_at, NOW())
FROM answers a
JOIN responses r ON r.id = a.response_id
WHERE r.status = 'in_progress'
  AND r.user_id IS NOT NULL
ON CONFLICT (draft_id, question_id) DO UPDATE
SET
    value = EXCLUDED.value,
    updated_at = NOW();

-- Remove all legacy in-progress responses (including anonymous sessions).
DELETE FROM answers a
USING responses r
WHERE a.response_id = r.id
  AND r.status = 'in_progress';

DELETE FROM responses
WHERE status = 'in_progress';

ALTER TABLE responses
DROP CONSTRAINT IF EXISTS responses_status_check;

ALTER TABLE responses
ADD CONSTRAINT responses_status_check
CHECK (status IN ('completed', 'abandoned'));
