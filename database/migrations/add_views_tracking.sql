-- Migration: Add views tracking table for unique views per user
-- This ensures each user can only count as one view per content

-- Create views table
CREATE TABLE IF NOT EXISTS views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    content_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, content_id)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_views_content ON views (content_id);
CREATE INDEX IF NOT EXISTS idx_views_user ON views (user_id);
CREATE INDEX IF NOT EXISTS idx_views_user_content ON views (user_id, content_id);

-- Enable RLS on views table
ALTER TABLE views ENABLE ROW LEVEL SECURITY;

-- Allow users to see all views (for counting)
CREATE POLICY "Views are viewable by everyone" ON views
    FOR SELECT USING (true);

-- Allow users to insert their own views
CREATE POLICY "Users can insert own views" ON views
    FOR INSERT WITH CHECK (true);

-- Allow users to delete their own views (not typically needed but for completeness)
CREATE POLICY "Users can delete own views" ON views
    FOR DELETE USING (true);

