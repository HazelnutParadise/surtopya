-- Preserve historical response answers when live survey questions are rewritten.
-- Response answers resolve question meaning from immutable survey version snapshots,
-- so they must not be deleted when draft/live question rows are replaced.

ALTER TABLE answers
    DROP CONSTRAINT IF EXISTS answers_question_id_fkey;

ALTER TABLE response_draft_answers
    DROP CONSTRAINT IF EXISTS response_draft_answers_question_id_fkey;
