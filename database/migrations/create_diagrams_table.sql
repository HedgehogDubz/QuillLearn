-- Migration: Create diagrams table for diagram-based learning
-- Each diagram contains cards with images, shapes, and labels for interactive learning

-- Create diagrams table
CREATE TABLE IF NOT EXISTS diagrams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT UNIQUE NOT NULL,
    user_id TEXT,
    title TEXT NOT NULL DEFAULT 'Untitled Diagram',
    
    -- Cards array stored as JSONB
    -- Each card: { id, images: [{id, src, x, y, width, height, zIndex, opacity, filters}], 
    --              shapes: [{id, type, points, color, strokeWidth, zIndex}],
    --              labels: [{id, x, y, text, fontSize, color}] }
    cards JSONB DEFAULT '[]'::jsonb,
    
    -- Metadata
    tags TEXT[] DEFAULT '{}',
    description TEXT DEFAULT '',
    
    -- Sharing
    edit_users TEXT[] DEFAULT '{}',
    view_users TEXT[] DEFAULT '{}',
    is_public BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    
    -- Timestamps
    last_time_saved BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_diagrams_session_id ON diagrams (session_id);
CREATE INDEX IF NOT EXISTS idx_diagrams_user_id ON diagrams (user_id);
CREATE INDEX IF NOT EXISTS idx_diagrams_tags ON diagrams USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_diagrams_is_public ON diagrams (is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_diagrams_last_time_saved ON diagrams (last_time_saved DESC);

-- Update likes table to allow 'diagram' content type (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'likes') THEN
        ALTER TABLE likes DROP CONSTRAINT IF EXISTS likes_content_type_check;
        ALTER TABLE likes ADD CONSTRAINT likes_content_type_check
            CHECK (content_type IN ('sheet', 'note', 'published', 'diagram'));
    END IF;
END $$;

-- Update document_presence table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'document_presence') THEN
        ALTER TABLE document_presence DROP CONSTRAINT IF EXISTS document_presence_document_type_check;
        ALTER TABLE document_presence ADD CONSTRAINT document_presence_document_type_check
            CHECK (document_type IN ('sheet', 'note', 'diagram'));
    END IF;
END $$;

-- Comments for documentation
COMMENT ON TABLE diagrams IS 'Stores diagram-based learning content with labeled images';
COMMENT ON COLUMN diagrams.cards IS 'JSONB array of diagram cards, each containing images, shapes, and labels';
COMMENT ON COLUMN diagrams.session_id IS 'Unique session identifier for the diagram';

