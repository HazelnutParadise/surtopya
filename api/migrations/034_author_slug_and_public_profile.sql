-- Add author slug and public profile visibility settings.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS author_slug VARCHAR(255),
ADD COLUMN IF NOT EXISTS public_show_display_name BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS public_show_avatar_url BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS public_show_bio BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS public_show_location BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS public_show_phone BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS public_show_email BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill temporary slugs for existing users so every member has an author page.
UPDATE users
SET author_slug = 'u-' || SUBSTRING(REPLACE(id::text, '-', '') FROM 1 FOR 8)
WHERE author_slug IS NULL OR BTRIM(author_slug) = '';

ALTER TABLE users
ALTER COLUMN author_slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_author_slug_unique
ON users (author_slug);

-- Store old slugs after username changes for permanent redirect support.
CREATE TABLE IF NOT EXISTS author_slug_redirects (
    old_slug VARCHAR(255) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_author_slug_redirects_user_id
ON author_slug_redirects (user_id);
