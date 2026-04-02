-- Preserve historical response answers when live survey questions are rewritten.
-- Response answers resolve question meaning from immutable survey version snapshots,
-- so they must not be deleted when draft/live question rows are replaced.
-- Do not reintroduce cascade FKs from answers or response_draft_answers back to questions:
-- SaveQuestionsTx rewrites live questions, while analytics/export read semantics from
-- survey_versions snapshots plus the stored answer payloads.

ALTER TABLE answers
    DROP CONSTRAINT IF EXISTS answers_question_id_fkey;

ALTER TABLE response_draft_answers
    DROP CONSTRAINT IF EXISTS response_draft_answers_question_id_fkey;
