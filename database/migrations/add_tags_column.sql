-- Migration: Add tags column to sheets and notes tables
-- This enables tagging functionality for organizing documents

-- Add tags column to sheets table
ALTER TABLE sheets
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Add tags column to notes table
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Create GIN indexes for efficient tag searching and filtering
CREATE INDEX IF NOT EXISTS idx_sheets_tags ON sheets USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_notes_tags ON notes USING GIN (tags);

-- Example queries enabled by this migration:
-- 
-- Get all documents with a specific tag:
-- SELECT * FROM sheets WHERE 'math' = ANY(tags);
-- SELECT * FROM notes WHERE 'math' = ANY(tags);
--
-- Get all documents with any of multiple tags:
-- SELECT * FROM sheets WHERE tags && ARRAY['math', 'science'];
--
-- Get all documents with all specified tags:
-- SELECT * FROM sheets WHERE tags @> ARRAY['math', 'homework'];
--
-- Get all unique tags used by a user:
-- SELECT DISTINCT unnest(tags) as tag FROM sheets WHERE user_id = 'user123'
-- UNION
-- SELECT DISTINCT unnest(tags) as tag FROM notes WHERE user_id = 'user123';

