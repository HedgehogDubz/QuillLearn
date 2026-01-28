-- Migration script: Migrate users to UUID and update all foreign key references
-- This script:
-- 1. Creates users table with UUID primary key
-- 2. Inserts existing users with new UUIDs
-- 3. Updates all foreign key references in sheets, notes, diagrams, published_content, document_presence
--
-- RUN THIS IN A SINGLE TRANSACTION in Supabase SQL Editor

BEGIN;

-- Step 1: Create a temporary mapping table to track old ID -> new UUID
CREATE TEMP TABLE user_id_mapping (
    old_id TEXT PRIMARY KEY,
    new_id UUID NOT NULL
);

-- Step 2: Drop and recreate users table with UUID
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    avatar TEXT DEFAULT '[]',
    email_verified BOOLEAN DEFAULT FALSE,
    verification_token TEXT,
    verification_token_expires TIMESTAMPTZ,
    reset_token TEXT,
    reset_token_expires TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_verification_token ON users(verification_token);
CREATE INDEX idx_users_reset_token ON users(reset_token);

-- Create trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Step 3: Insert users and capture the mapping
-- testuser
WITH inserted AS (
    INSERT INTO users (email, username, password, avatar, email_verified, created_at, updated_at)
    VALUES ('test@example.com', 'testuser', '$2b$10$cobuRR4Td/mFS.eUVJrcJOz63wV9uXErE2rZ6i0yRs9YIHTI/jMgu', '[]', false, '2026-01-07T22:10:16.309Z'::timestamptz, '2026-01-07T22:10:16.309Z'::timestamptz)
    RETURNING id
)
INSERT INTO user_id_mapping (old_id, new_id) SELECT '1767823816309e9lq2r5xc', id FROM inserted;

-- HedgehogDubz
WITH inserted AS (
    INSERT INTO users (email, username, password, avatar, email_verified, created_at, updated_at)
    VALUES ('tristankenshin@gmail.com', 'HedgehogDubz', '$2b$10$.eTPrR7ndBdy0MUWuPalGO8ii28HcUcPrE.ylNjZcaxCbBF.Su4cq',
    '[[\"#BB8FCE\",\"#2D3748\",\"#2D3748\",\"#F8B500\",\"#FF6B6B\",\"#FF6B6B\",\"#F8B500\",\"#2D3748\",\"#2D3748\",\"#BB8FCE\"],[\"#4ECDC4\",\"#2D3748\",\"#FFEAA7\",\"#2D3748\",\"#2D3748\",\"#2D3748\",\"#2D3748\",\"#FFEAA7\",\"#2D3748\",\"#4ECDC4\"],[\"#2D3748\",\"#98D8C8\",\"#DDA0DD\",\"#FF6B6B\",\"#45B7D1\",\"#45B7D1\",\"#FF6B6B\",\"#DDA0DD\",\"#98D8C8\",\"#2D3748\"],[\"#2D3748\",\"#FF6B6B\",\"#4ECDC4\",\"#2D3748\",\"#BB8FCE\",\"#BB8FCE\",\"#2D3748\",\"#4ECDC4\",\"#FF6B6B\",\"#2D3748\"],[\"#2D3748\",\"#4ECDC4\",\"#2D3748\",\"#2D3748\",\"#FFEAA7\",\"#FFEAA7\",\"#2D3748\",\"#2D3748\",\"#4ECDC4\",\"#2D3748\"],[\"#FFEAA7\",\"#4ECDC4\",\"#00CED1\",\"#2D3748\",\"#85C1E9\",\"#85C1E9\",\"#2D3748\",\"#00CED1\",\"#4ECDC4\",\"#FFEAA7\"],[\"#BB8FCE\",\"#2D3748\",\"#96CEB4\",\"#45B7D1\",\"#98D8C8\",\"#98D8C8\",\"#45B7D1\",\"#96CEB4\",\"#2D3748\",\"#BB8FCE\"],[\"#2D3748\",\"#DDA0DD\",\"#4ECDC4\",\"#FF6B6B\",\"#96CEB4\",\"#96CEB4\",\"#FF6B6B\",\"#4ECDC4\",\"#DDA0DD\",\"#2D3748\"],[\"#2D3748\",\"#FFEAA7\",\"#96CEB4\",\"#DDA0DD\",\"#2D3748\",\"#2D3748\",\"#DDA0DD\",\"#96CEB4\",\"#FFEAA7\",\"#2D3748\"],[\"#FF6B6B\",\"#00CED1\",\"#2D3748\",\"#4ECDC4\",\"#BB8FCE\",\"#BB8FCE\",\"#4ECDC4\",\"#2D3748\",\"#00CED1\",\"#FF6B6B\"]]',
    false, '2026-01-07T22:23:23.624Z'::timestamptz, '2026-01-27T09:05:19.248Z'::timestamptz)
    RETURNING id
)
INSERT INTO user_id_mapping (old_id, new_id) SELECT '1767824603624rbxchigmw', id FROM inserted;

-- Hoggo
WITH inserted AS (
    INSERT INTO users (email, username, password, avatar, email_verified, created_at, updated_at)
    VALUES ('a@gmail.com', 'Hoggo', '$2b$10$YN5Op0b7YjOOWZl2Oq/Nyu1PUlgjYo9Sk2/wYkvQpyjOybW.1vlXy', '[]', false, '2026-01-09T06:34:07.407Z'::timestamptz, '2026-01-09T06:34:07.407Z'::timestamptz)
    RETURNING id
)
INSERT INTO user_id_mapping (old_id, new_id) SELECT '1767940447407oatymz7si', id FROM inserted;

-- Hedgehog
WITH inserted AS (
    INSERT INTO users (email, username, password, avatar, email_verified, created_at, updated_at)
    VALUES ('twinata@sas.upenn.edu', 'Hedgehog', '$2b$10$5xZ.BfGn1mgpP4pTIuWlQeSB7qdGRmlyD8XS6POjbR0KC3NDpWJDm', '[]', false, '2026-01-22T08:00:38.025Z'::timestamptz, '2026-01-22T08:00:38.025Z'::timestamptz)
    RETURNING id
)
INSERT INTO user_id_mapping (old_id, new_id) SELECT '1769068838025ox32hltv9', id FROM inserted;

-- Show the mapping for verification
SELECT * FROM user_id_mapping;

-- Step 4: Update foreign keys in all tables

-- Update sheets.user_id
UPDATE sheets
SET user_id = m.new_id::text
FROM user_id_mapping m
WHERE sheets.user_id = m.old_id;

-- Update sheets.edit_users array
UPDATE sheets
SET edit_users = (
    SELECT array_agg(COALESCE(m.new_id::text, u))
    FROM unnest(sheets.edit_users) AS u
    LEFT JOIN user_id_mapping m ON m.old_id = u
)
WHERE edit_users IS NOT NULL AND array_length(edit_users, 1) > 0;

-- Update sheets.view_users array
UPDATE sheets
SET view_users = (
    SELECT array_agg(COALESCE(m.new_id::text, u))
    FROM unnest(sheets.view_users) AS u
    LEFT JOIN user_id_mapping m ON m.old_id = u
)
WHERE view_users IS NOT NULL AND array_length(view_users, 1) > 0;

-- Update notes.user_id
UPDATE notes
SET user_id = m.new_id::text
FROM user_id_mapping m
WHERE notes.user_id = m.old_id;

-- Update notes.edit_users array
UPDATE notes
SET edit_users = (
    SELECT array_agg(COALESCE(m.new_id::text, u))
    FROM unnest(notes.edit_users) AS u
    LEFT JOIN user_id_mapping m ON m.old_id = u
)
WHERE edit_users IS NOT NULL AND array_length(edit_users, 1) > 0;

-- Update notes.view_users array
UPDATE notes
SET view_users = (
    SELECT array_agg(COALESCE(m.new_id::text, u))
    FROM unnest(notes.view_users) AS u
    LEFT JOIN user_id_mapping m ON m.old_id = u
)
WHERE view_users IS NOT NULL AND array_length(view_users, 1) > 0;

-- Update diagrams.user_id
UPDATE diagrams
SET user_id = m.new_id::text
FROM user_id_mapping m
WHERE diagrams.user_id = m.old_id;

-- Update diagrams.edit_users array
UPDATE diagrams
SET edit_users = (
    SELECT array_agg(COALESCE(m.new_id::text, u))
    FROM unnest(diagrams.edit_users) AS u
    LEFT JOIN user_id_mapping m ON m.old_id = u
)
WHERE edit_users IS NOT NULL AND array_length(edit_users, 1) > 0;

-- Update diagrams.view_users array
UPDATE diagrams
SET view_users = (
    SELECT array_agg(COALESCE(m.new_id::text, u))
    FROM unnest(diagrams.view_users) AS u
    LEFT JOIN user_id_mapping m ON m.old_id = u
)
WHERE view_users IS NOT NULL AND array_length(view_users, 1) > 0;

-- Update document_presence.user_id (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'document_presence') THEN
        UPDATE document_presence
        SET user_id = m.new_id::text
        FROM user_id_mapping m
        WHERE document_presence.user_id = m.old_id;
    END IF;
END $$;

-- Update published_content.user_id (if table exists)
-- Since published_content.user_id is UUID, we need to cast appropriately
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'published_content') THEN
        UPDATE published_content
        SET user_id = m.new_id
        FROM user_id_mapping m
        WHERE published_content.user_id::text = m.old_id;
    END IF;
END $$;

-- Step 5: Verify the migration
SELECT 'Users:' as table_name, count(*) as count FROM users
UNION ALL
SELECT 'ID Mappings:', count(*) FROM user_id_mapping
UNION ALL
SELECT 'Sheets updated:', count(*) FROM sheets WHERE user_id IN (SELECT new_id::text FROM user_id_mapping)
UNION ALL
SELECT 'Notes updated:', count(*) FROM notes WHERE user_id IN (SELECT new_id::text FROM user_id_mapping)
UNION ALL
SELECT 'Diagrams updated:', count(*) FROM diagrams WHERE user_id IN (SELECT new_id::text FROM user_id_mapping);

-- Show the new user IDs
SELECT id, email, username FROM users ORDER BY created_at;

COMMIT;

