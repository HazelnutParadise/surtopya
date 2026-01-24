-- Add locale preference to users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS locale VARCHAR(10) NOT NULL DEFAULT 'zh-TW';
