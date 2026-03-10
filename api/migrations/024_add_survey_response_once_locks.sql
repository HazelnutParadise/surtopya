-- Enforce one completed response per survey per identity.
-- Identity can be either an authenticated user_id or an anonymous_id.

CREATE TABLE IF NOT EXISTS survey_response_once_locks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    response_id UUID NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    anonymous_id VARCHAR(255),
    source VARCHAR(50) NOT NULL DEFAULT 'unknown',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CHECK (
        (user_id IS NOT NULL AND anonymous_id IS NULL)
        OR (user_id IS NULL AND anonymous_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_survey_response_once_locks_survey_id
    ON survey_response_once_locks(survey_id);

CREATE INDEX IF NOT EXISTS idx_survey_response_once_locks_response_id
    ON survey_response_once_locks(response_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_survey_response_once_locks_survey_user
    ON survey_response_once_locks(survey_id, user_id)
    WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_survey_response_once_locks_survey_anonymous
    ON survey_response_once_locks(survey_id, anonymous_id)
    WHERE anonymous_id IS NOT NULL;
