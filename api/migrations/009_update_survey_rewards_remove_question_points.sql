-- Remove per-question points; rewards are survey-level only.
ALTER TABLE questions
DROP COLUMN IF EXISTS points;

-- Expand points_transactions.type CHECK constraint to include 'survey_boost_spend'.
DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'points_transactions'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%type%'
  LIMIT 1;

  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE points_transactions DROP CONSTRAINT %I', conname);
  END IF;
END $$;

ALTER TABLE points_transactions
ADD CONSTRAINT points_transactions_type_check
CHECK (type IN (
  'survey_reward',
  'survey_boost_spend',
  'dataset_purchase',
  'dataset_sale',
  'admin_grant',
  'referral',
  'pro_monthly_grant'
));

