ALTER TABLE questions
ADD COLUMN IF NOT EXISTS min_selections INTEGER,
ADD COLUMN IF NOT EXISTS max_selections INTEGER,
ADD COLUMN IF NOT EXISTS default_destination_question_id TEXT;
