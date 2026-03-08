-- Add per-survey login requirement and anonymous points claim workflow.

ALTER TABLE surveys
ADD COLUMN IF NOT EXISTS require_login_to_respond BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS anonymous_response_point_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    response_id UUID NOT NULL UNIQUE REFERENCES responses(id) ON DELETE CASCADE,
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    claim_token UUID NOT NULL UNIQUE,
    points_awarded INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'claimed', 'forfeited')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    claimed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    claimed_at TIMESTAMP WITH TIME ZONE,
    forfeited_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anonymous_response_point_claims_claim_token
    ON anonymous_response_point_claims(claim_token);

CREATE INDEX IF NOT EXISTS idx_anonymous_response_point_claims_status
    ON anonymous_response_point_claims(status);
