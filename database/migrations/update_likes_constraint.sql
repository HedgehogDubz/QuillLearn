-- Migration: Update likes table to support published content
-- This allows liking published_content items

-- Drop the old CHECK constraint
ALTER TABLE likes DROP CONSTRAINT IF EXISTS likes_content_type_check;

-- Add new CHECK constraint that includes 'published'
ALTER TABLE likes ADD CONSTRAINT likes_content_type_check 
    CHECK (content_type IN ('sheet', 'note', 'published'));

-- Ensure the UNIQUE constraint exists (for preventing duplicate likes)
-- This should already exist, but adding IF NOT EXISTS for safety
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'likes_user_id_content_type_content_id_key'
    ) THEN
        ALTER TABLE likes ADD CONSTRAINT likes_user_id_content_type_content_id_key 
            UNIQUE(user_id, content_type, content_id);
    END IF;
END $$;

