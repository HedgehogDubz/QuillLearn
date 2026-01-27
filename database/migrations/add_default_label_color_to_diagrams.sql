-- Migration: Add default_label_color column to diagrams table
-- This allows users to set a default color for new labels in diagrams

-- Add default_label_color column to diagrams table
ALTER TABLE diagrams
ADD COLUMN IF NOT EXISTS default_label_color TEXT DEFAULT '#ffffff';

-- Add comment for documentation
COMMENT ON COLUMN diagrams.default_label_color IS 'Default color for new labels in the diagram. Can be overridden per label.';

