-- Migration: Add public sharing features to sheets and notes tables
-- This enables public sharing, likes, comments, and view tracking

-- Add public sharing columns to sheets table
ALTER TABLE sheets
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

-- Add public sharing columns to notes table  
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

-- Create indexes for efficient public content querying
CREATE INDEX IF NOT EXISTS idx_sheets_is_public ON sheets (is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_notes_is_public ON notes (is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_sheets_like_count ON sheets (like_count DESC);
CREATE INDEX IF NOT EXISTS idx_notes_like_count ON notes (like_count DESC);

-- Create likes table
CREATE TABLE IF NOT EXISTS likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('sheet', 'note')),
    content_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, content_type, content_id)
);

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_avatar TEXT,
    content_type TEXT NOT NULL CHECK (content_type IN ('sheet', 'note')),
    content_id TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for likes and comments
CREATE INDEX IF NOT EXISTS idx_likes_content ON likes (content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON likes (user_id);
CREATE INDEX IF NOT EXISTS idx_comments_content ON comments (content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments (created_at DESC);

-- Add RLS policies (if using Row Level Security)
-- Enable RLS on likes table
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- Allow users to see all likes
CREATE POLICY "Likes are viewable by everyone" ON likes
    FOR SELECT USING (true);

-- Allow users to insert their own likes
CREATE POLICY "Users can insert own likes" ON likes
    FOR INSERT WITH CHECK (true);

-- Allow users to delete their own likes
CREATE POLICY "Users can delete own likes" ON likes
    FOR DELETE USING (true);

-- Enable RLS on comments table
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Allow everyone to view comments
CREATE POLICY "Comments are viewable by everyone" ON comments
    FOR SELECT USING (true);

-- Allow users to insert comments
CREATE POLICY "Users can insert comments" ON comments
    FOR INSERT WITH CHECK (true);

-- Allow users to update their own comments
CREATE POLICY "Users can update own comments" ON comments
    FOR UPDATE USING (true);

-- Allow users to delete their own comments
CREATE POLICY "Users can delete own comments" ON comments
    FOR DELETE USING (true);

