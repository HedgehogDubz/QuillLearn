-- Create published_content table
-- This stores snapshots of notes/sheets that users publish to Discover
-- Separate from the main tables to keep published content immutable

CREATE TABLE IF NOT EXISTS published_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Link to original content
    original_session_id TEXT NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('sheet', 'note')),
    
    -- Publisher info
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    publisher_username TEXT NOT NULL,
    
    -- Content metadata
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Snapshot of the actual content (JSON)
    content JSONB NOT NULL,
    
    -- Visibility
    is_public BOOLEAN DEFAULT true,
    
    -- Stats
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    
    -- Timestamps
    published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one published version per original content
    UNIQUE(original_session_id, content_type)
);

-- Create indexes for efficient querying
CREATE INDEX idx_published_content_user_id ON published_content(user_id);
CREATE INDEX idx_published_content_type ON published_content(content_type);
CREATE INDEX idx_published_content_is_public ON published_content(is_public);
CREATE INDEX idx_published_content_published_at ON published_content(published_at DESC);
CREATE INDEX idx_published_content_like_count ON published_content(like_count DESC);
CREATE INDEX idx_published_content_tags ON published_content USING GIN(tags);

-- Update likes table to support published_content
-- content_id will now be the published_content id (UUID as text)
-- This is backward compatible

-- Add RLS policies
ALTER TABLE published_content ENABLE ROW LEVEL SECURITY;

-- Anyone can view public content
CREATE POLICY "Public content is viewable by everyone" 
    ON published_content FOR SELECT 
    USING (is_public = true);

-- Users can view their own content (public or private)
CREATE POLICY "Users can view own content" 
    ON published_content FOR SELECT 
    USING (auth.uid() = user_id);

-- Only owner can insert/update/delete
CREATE POLICY "Users can insert own content" 
    ON published_content FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own content" 
    ON published_content FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own content" 
    ON published_content FOR DELETE 
    USING (auth.uid() = user_id);

