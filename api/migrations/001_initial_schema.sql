-- Surtopya Database Schema
-- Initial migration: Create core tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (basic info, Logto handles auth)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    logto_user_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    display_name VARCHAR(255),
    avatar_url TEXT,
    points_balance INTEGER DEFAULT 0,
    is_pro BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Surveys table
CREATE TABLE surveys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL DEFAULT 'Untitled Survey',
    description TEXT DEFAULT '',

    -- Visibility settings
    visibility VARCHAR(20) NOT NULL DEFAULT 'non-public' CHECK (visibility IN ('public', 'non-public')),
    is_published BOOLEAN DEFAULT FALSE,
    include_in_datasets BOOLEAN DEFAULT FALSE,
    published_count INTEGER DEFAULT 0,

    -- Theme settings (stored as JSONB)
    theme JSONB DEFAULT '{"primaryColor": "#9333ea", "backgroundColor": "#f9fafb", "fontFamily": "inter"}',

    -- Survey settings
    points_reward INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,

    -- Statistics
    response_count INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE
);

-- Questions table
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,

    -- Question type
    type VARCHAR(20) NOT NULL CHECK (type IN ('single', 'multi', 'text', 'short', 'long', 'rating', 'date', 'select', 'section')),

    -- Content
    title VARCHAR(1000) NOT NULL DEFAULT 'New Question',
    description TEXT,

    -- Options (for single/multi/select - stored as JSONB array)
    options JSONB DEFAULT '[]',

    -- Settings
    required BOOLEAN DEFAULT FALSE,
    points INTEGER DEFAULT 10,
    max_rating INTEGER DEFAULT 5,

    -- Logic rules (JSONB array)
    logic JSONB DEFAULT '[]',

    -- Ordering
    sort_order INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Survey responses table
CREATE TABLE responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Anonymous ID for non-logged-in users
    anonymous_id VARCHAR(255),

    -- Response status
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'abandoned')),

    -- Points awarded
    points_awarded INTEGER DEFAULT 0,

    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Individual question answers
CREATE TABLE answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    response_id UUID NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,

    -- Answer value (flexible JSONB to handle all question types)
    -- For single/select: {"value": "Option 1"}
    -- For multi: {"values": ["Option 1", "Option 2"]}
    -- For text/short/long: {"text": "..."}
    -- For rating: {"rating": 5}
    -- For date: {"date": "2024-01-15"}
    value JSONB NOT NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Each question can only be answered once per response
    UNIQUE(response_id, question_id)
);

-- Datasets table (for marketplace)
CREATE TABLE datasets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,

    -- Metadata
    title VARCHAR(500) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL DEFAULT 'Other',

    -- Access settings
    access_type VARCHAR(20) DEFAULT 'free' CHECK (access_type IN ('free', 'paid')),
    price INTEGER DEFAULT 0, -- in points

    -- Statistics
    download_count INTEGER DEFAULT 0,
    sample_size INTEGER DEFAULT 0,

    -- Availability
    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Points transactions table
CREATE TABLE points_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Transaction details
    amount INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('survey_reward', 'dataset_purchase', 'dataset_sale', 'admin_grant', 'referral')),
    description TEXT,

    -- References
    survey_id UUID REFERENCES surveys(id) ON DELETE SET NULL,
    dataset_id UUID REFERENCES datasets(id) ON DELETE SET NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_surveys_user_id ON surveys(user_id);
CREATE INDEX idx_surveys_visibility ON surveys(visibility);
CREATE INDEX idx_surveys_is_published ON surveys(is_published);
CREATE INDEX idx_questions_survey_id ON questions(survey_id);
CREATE INDEX idx_questions_sort_order ON questions(survey_id, sort_order);
CREATE INDEX idx_responses_survey_id ON responses(survey_id);
CREATE INDEX idx_responses_user_id ON responses(user_id);
CREATE INDEX idx_answers_response_id ON answers(response_id);
CREATE INDEX idx_answers_question_id ON answers(question_id);
CREATE INDEX idx_datasets_category ON datasets(category);
CREATE INDEX idx_datasets_is_active ON datasets(is_active);
CREATE INDEX idx_points_transactions_user_id ON points_transactions(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_surveys_updated_at BEFORE UPDATE ON surveys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_datasets_updated_at BEFORE UPDATE ON datasets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
