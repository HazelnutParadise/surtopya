-- De-identification workflow, dataset versioning, and paid purchase entitlement.

INSERT INTO system_settings (key, value)
VALUES ('deid_chunk_size', '50')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS survey_deid_state (
    survey_id UUID PRIMARY KEY REFERENCES surveys(id) ON DELETE CASCADE,
    last_processed_response_created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_survey_deid_state_updated_at ON survey_deid_state;
CREATE TRIGGER update_survey_deid_state_updated_at
BEFORE UPDATE ON survey_deid_state
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS survey_deid_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL CHECK (
        status IN ('pending', 'in_progress', 'awaiting_review', 'reviewed', 'no_data', 'cancelled')
    ),
    trigger_source VARCHAR(30) NOT NULL DEFAULT 'manual',
    triggered_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    current_chunk_index INTEGER NOT NULL DEFAULT 0 CHECK (current_chunk_index >= 0),
    chunk_size INTEGER NOT NULL DEFAULT 50 CHECK (chunk_size > 0),
    total_chunks INTEGER NOT NULL DEFAULT 0 CHECK (total_chunks >= 0),
    columns_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    rows_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    masked_cells_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    review_action VARCHAR(20) CHECK (review_action IN ('merge', 'create')),
    target_dataset_id UUID REFERENCES datasets(id) ON DELETE SET NULL,
    reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    no_data_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_survey_deid_jobs_survey_status
    ON survey_deid_jobs(survey_id, status);
CREATE INDEX IF NOT EXISTS idx_survey_deid_jobs_created_at
    ON survey_deid_jobs(created_at DESC);

DROP TRIGGER IF EXISTS update_survey_deid_jobs_updated_at ON survey_deid_jobs;
CREATE TRIGGER update_survey_deid_jobs_updated_at
BEFORE UPDATE ON survey_deid_jobs
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS survey_deid_job_rows (
    job_id UUID NOT NULL REFERENCES survey_deid_jobs(id) ON DELETE CASCADE,
    response_id UUID NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
    response_created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (job_id, response_id)
);

CREATE INDEX IF NOT EXISTS idx_survey_deid_job_rows_response_id
    ON survey_deid_job_rows(response_id);

CREATE TABLE IF NOT EXISTS survey_deid_mask_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES survey_deid_jobs(id) ON DELETE CASCADE,
    response_id UUID REFERENCES responses(id) ON DELETE SET NULL,
    row_no INTEGER NOT NULL CHECK (row_no >= 1),
    col_no INTEGER NOT NULL CHECK (col_no >= 1),
    mask_id VARCHAR(64) NOT NULL,
    reason TEXT,
    original_value_hash TEXT NOT NULL,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by_agent_id UUID REFERENCES agent_admin_accounts(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (job_id, mask_id)
);

CREATE INDEX IF NOT EXISTS idx_survey_deid_mask_events_job_id
    ON survey_deid_mask_events(job_id);

CREATE TABLE IF NOT EXISTS dataset_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL CHECK (version_number >= 1),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    access_type VARCHAR(20) NOT NULL CHECK (access_type IN ('free', 'paid')),
    price INTEGER NOT NULL DEFAULT 0,
    sample_size INTEGER NOT NULL DEFAULT 0,
    file_path TEXT NOT NULL DEFAULT '',
    file_name TEXT NOT NULL DEFAULT '',
    file_size BIGINT NOT NULL DEFAULT 0,
    mime_type TEXT NOT NULL DEFAULT '',
    download_count INTEGER NOT NULL DEFAULT 0,
    published_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    published_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (dataset_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_dataset_versions_dataset_id_version
    ON dataset_versions(dataset_id, version_number DESC);

ALTER TABLE datasets
    ADD COLUMN IF NOT EXISTS current_published_version_id UUID,
    ADD COLUMN IF NOT EXISTS current_published_version_number INTEGER,
    ADD COLUMN IF NOT EXISTS has_unpublished_changes BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS entitlement_policy VARCHAR(40) NOT NULL DEFAULT 'purchased_only';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'datasets_entitlement_policy_check'
          AND conrelid = 'datasets'::regclass
    ) THEN
        ALTER TABLE datasets
            ADD CONSTRAINT datasets_entitlement_policy_check
            CHECK (entitlement_policy IN ('purchased_only', 'all_versions_if_any_purchase'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'datasets_current_published_version_id_fk'
          AND conrelid = 'datasets'::regclass
    ) THEN
        ALTER TABLE datasets
            ADD CONSTRAINT datasets_current_published_version_id_fk
            FOREIGN KEY (current_published_version_id)
            REFERENCES dataset_versions(id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS dataset_drafts (
    dataset_id UUID PRIMARY KEY REFERENCES datasets(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    access_type VARCHAR(20) NOT NULL CHECK (access_type IN ('free', 'paid')),
    price INTEGER NOT NULL DEFAULT 0,
    sample_size INTEGER NOT NULL DEFAULT 0,
    file_path TEXT NOT NULL DEFAULT '',
    file_name TEXT NOT NULL DEFAULT '',
    file_size BIGINT NOT NULL DEFAULT 0,
    mime_type TEXT NOT NULL DEFAULT '',
    source_deid_job_id UUID REFERENCES survey_deid_jobs(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_dataset_drafts_updated_at ON dataset_drafts;
CREATE TRIGGER update_dataset_drafts_updated_at
BEFORE UPDATE ON dataset_drafts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS dataset_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    dataset_version_id UUID NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
    price_paid INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, dataset_version_id)
);

CREATE INDEX IF NOT EXISTS idx_dataset_purchases_user_dataset
    ON dataset_purchases(user_id, dataset_id);

WITH inserted_versions AS (
    INSERT INTO dataset_versions (
        id,
        dataset_id,
        version_number,
        title,
        description,
        category,
        access_type,
        price,
        sample_size,
        file_path,
        file_name,
        file_size,
        mime_type,
        download_count,
        published_at,
        created_at
    )
    SELECT
        uuid_generate_v4(),
        d.id,
        1,
        d.title,
        d.description,
        d.category,
        d.access_type,
        d.price,
        d.sample_size,
        d.file_path,
        d.file_name,
        d.file_size,
        d.mime_type,
        d.download_count,
        COALESCE(d.updated_at, d.created_at, NOW()),
        COALESCE(d.created_at, NOW())
    FROM datasets d
    WHERE NOT EXISTS (
        SELECT 1
        FROM dataset_versions existing
        WHERE existing.dataset_id = d.id
          AND existing.version_number = 1
    )
    RETURNING dataset_id, id, version_number
)
UPDATE datasets d
SET current_published_version_id = iv.id,
    current_published_version_number = iv.version_number,
    has_unpublished_changes = FALSE
FROM inserted_versions iv
WHERE d.id = iv.dataset_id
  AND (d.current_published_version_id IS NULL OR d.current_published_version_number IS NULL);

WITH first_versions AS (
    SELECT DISTINCT ON (dataset_id)
        dataset_id,
        id,
        version_number,
        title,
        description,
        category,
        access_type,
        price,
        sample_size,
        file_path,
        file_name,
        file_size,
        mime_type
    FROM dataset_versions
    ORDER BY dataset_id, version_number ASC
)
UPDATE datasets d
SET current_published_version_id = fv.id,
    current_published_version_number = fv.version_number
FROM first_versions fv
WHERE d.id = fv.dataset_id
  AND (d.current_published_version_id IS NULL OR d.current_published_version_number IS NULL);

INSERT INTO dataset_drafts (
    dataset_id,
    title,
    description,
    category,
    access_type,
    price,
    sample_size,
    file_path,
    file_name,
    file_size,
    mime_type
)
SELECT
    d.id,
    d.title,
    d.description,
    d.category,
    d.access_type,
    d.price,
    d.sample_size,
    d.file_path,
    d.file_name,
    d.file_size,
    d.mime_type
FROM datasets d
ON CONFLICT (dataset_id) DO NOTHING;
