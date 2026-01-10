-- Migration: Add sharing columns to sheets and notes tables
-- This enables collaborative editing and viewing permissions

-- Add sharing columns to sheets table
ALTER TABLE sheets
ADD COLUMN IF NOT EXISTS edit_users TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS view_users TEXT[] DEFAULT '{}';

-- Add sharing columns to notes table
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS edit_users TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS view_users TEXT[] DEFAULT '{}';

-- Create indexes for better query performance on sharing columns
CREATE INDEX IF NOT EXISTS idx_sheets_edit_users ON sheets USING GIN (edit_users);
CREATE INDEX IF NOT EXISTS idx_sheets_view_users ON sheets USING GIN (view_users);
CREATE INDEX IF NOT EXISTS idx_notes_edit_users ON notes USING GIN (edit_users);
CREATE INDEX IF NOT EXISTS idx_notes_view_users ON notes USING GIN (view_users);

-- Update RLS policies to allow access based on sharing permissions
-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for all users" ON sheets;
DROP POLICY IF EXISTS "Enable insert access for all users" ON sheets;
DROP POLICY IF EXISTS "Enable update access for all users" ON sheets;
DROP POLICY IF EXISTS "Enable delete access for all users" ON sheets;

DROP POLICY IF EXISTS "Enable read access for all users" ON notes;
DROP POLICY IF EXISTS "Enable insert access for all users" ON notes;
DROP POLICY IF EXISTS "Enable update access for all users" ON notes;
DROP POLICY IF EXISTS "Enable delete access for all users" ON notes;

-- Sheets policies
-- Allow users to read sheets they own or have been shared with
CREATE POLICY "Users can read own or shared sheets" ON sheets
  FOR SELECT USING (
    user_id = current_setting('app.current_user_id', true) OR
    current_setting('app.current_user_id', true) = ANY(edit_users) OR
    current_setting('app.current_user_id', true) = ANY(view_users)
  );

-- Allow users to insert their own sheets
CREATE POLICY "Users can insert own sheets" ON sheets
  FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true));

-- Allow users to update sheets they own or have edit access to
CREATE POLICY "Users can update own or edit-shared sheets" ON sheets
  FOR UPDATE USING (
    user_id = current_setting('app.current_user_id', true) OR
    current_setting('app.current_user_id', true) = ANY(edit_users)
  );

-- Allow users to delete only their own sheets
CREATE POLICY "Users can delete own sheets" ON sheets
  FOR DELETE USING (user_id = current_setting('app.current_user_id', true));

-- Notes policies
-- Allow users to read notes they own or have been shared with
CREATE POLICY "Users can read own or shared notes" ON notes
  FOR SELECT USING (
    user_id = current_setting('app.current_user_id', true) OR
    current_setting('app.current_user_id', true) = ANY(edit_users) OR
    current_setting('app.current_user_id', true) = ANY(view_users)
  );

-- Allow users to insert their own notes
CREATE POLICY "Users can insert own notes" ON notes
  FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true));

-- Allow users to update notes they own or have edit access to
CREATE POLICY "Users can update own or edit-shared notes" ON notes
  FOR UPDATE USING (
    user_id = current_setting('app.current_user_id', true) OR
    current_setting('app.current_user_id', true) = ANY(edit_users)
  );

-- Allow users to delete only their own notes
CREATE POLICY "Users can delete own notes" ON notes
  FOR DELETE USING (user_id = current_setting('app.current_user_id', true));

-- Create a table for tracking real-time presence (who's currently viewing/editing)
CREATE TABLE IF NOT EXISTS document_presence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('sheet', 'note')),
  user_id TEXT NOT NULL,
  user_email TEXT,
  user_name TEXT,
  cursor_position JSONB,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, document_type, user_id)
);

-- Create index for presence queries
CREATE INDEX IF NOT EXISTS idx_presence_session ON document_presence(session_id, document_type);
CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON document_presence(last_seen);

-- Enable RLS on presence table
ALTER TABLE document_presence ENABLE ROW LEVEL SECURITY;

-- Allow users to read presence for documents they have access to
CREATE POLICY "Users can read presence for accessible documents" ON document_presence
  FOR SELECT USING (true);

-- Allow users to insert/update their own presence
CREATE POLICY "Users can manage own presence" ON document_presence
  FOR ALL USING (user_id = current_setting('app.current_user_id', true));

-- Create a function to clean up stale presence records (older than 5 minutes)
CREATE OR REPLACE FUNCTION cleanup_stale_presence()
RETURNS void AS $$
BEGIN
  DELETE FROM document_presence
  WHERE last_seen < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- Note: You'll need to set up a cron job or scheduled function to call cleanup_stale_presence() periodically

