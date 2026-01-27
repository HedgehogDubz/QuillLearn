-- Migration: Add 'diagram' to published_content content_type constraint
-- This allows diagrams to be published to the Discover page

-- Update the CHECK constraint on published_content to include 'diagram'
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'published_content') THEN
        ALTER TABLE published_content DROP CONSTRAINT IF EXISTS published_content_content_type_check;
        ALTER TABLE published_content ADD CONSTRAINT published_content_content_type_check
            CHECK (content_type IN ('sheet', 'note', 'diagram'));
    END IF;
END $$;

-- Add comment for documentation
COMMENT ON CONSTRAINT published_content_content_type_check ON published_content IS 'Allows sheet, note, and diagram content types';

