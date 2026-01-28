-- Migration script to import existing users from users.json to Supabase
-- Run this AFTER running create_users_table.sql
-- 
-- Note: The old string IDs will be replaced with UUIDs
-- Passwords are already hashed with bcrypt, so they'll work as-is

-- Insert existing users
-- Using ON CONFLICT to skip duplicates if you run this multiple times

INSERT INTO users (email, username, password, avatar, email_verified, created_at, updated_at)
VALUES 
    -- testuser
    (
        'test@example.com',
        'testuser',
        '$2b$10$cobuRR4Td/mFS.eUVJrcJOz63wV9uXErE2rZ6i0yRs9YIHTI/jMgu',
        '[]',
        false,
        '2026-01-07T22:10:16.309Z'::timestamptz,
        '2026-01-07T22:10:16.309Z'::timestamptz
    ),
    -- HedgehogDubz
    (
        'tristankenshin@gmail.com',
        'HedgehogDubz',
        '$2b$10$.eTPrR7ndBdy0MUWuPalGO8ii28HcUcPrE.ylNjZcaxCbBF.Su4cq',
        '[[\"#BB8FCE\",\"#2D3748\",\"#2D3748\",\"#F8B500\",\"#FF6B6B\",\"#FF6B6B\",\"#F8B500\",\"#2D3748\",\"#2D3748\",\"#BB8FCE\"],[\"#4ECDC4\",\"#2D3748\",\"#FFEAA7\",\"#2D3748\",\"#2D3748\",\"#2D3748\",\"#2D3748\",\"#FFEAA7\",\"#2D3748\",\"#4ECDC4\"],[\"#2D3748\",\"#98D8C8\",\"#DDA0DD\",\"#FF6B6B\",\"#45B7D1\",\"#45B7D1\",\"#FF6B6B\",\"#DDA0DD\",\"#98D8C8\",\"#2D3748\"],[\"#2D3748\",\"#FF6B6B\",\"#4ECDC4\",\"#2D3748\",\"#BB8FCE\",\"#BB8FCE\",\"#2D3748\",\"#4ECDC4\",\"#FF6B6B\",\"#2D3748\"],[\"#2D3748\",\"#4ECDC4\",\"#2D3748\",\"#2D3748\",\"#FFEAA7\",\"#FFEAA7\",\"#2D3748\",\"#2D3748\",\"#4ECDC4\",\"#2D3748\"],[\"#FFEAA7\",\"#4ECDC4\",\"#00CED1\",\"#2D3748\",\"#85C1E9\",\"#85C1E9\",\"#2D3748\",\"#00CED1\",\"#4ECDC4\",\"#FFEAA7\"],[\"#BB8FCE\",\"#2D3748\",\"#96CEB4\",\"#45B7D1\",\"#98D8C8\",\"#98D8C8\",\"#45B7D1\",\"#96CEB4\",\"#2D3748\",\"#BB8FCE\"],[\"#2D3748\",\"#DDA0DD\",\"#4ECDC4\",\"#FF6B6B\",\"#96CEB4\",\"#96CEB4\",\"#FF6B6B\",\"#4ECDC4\",\"#DDA0DD\",\"#2D3748\"],[\"#2D3748\",\"#FFEAA7\",\"#96CEB4\",\"#DDA0DD\",\"#2D3748\",\"#2D3748\",\"#DDA0DD\",\"#96CEB4\",\"#FFEAA7\",\"#2D3748\"],[\"#FF6B6B\",\"#00CED1\",\"#2D3748\",\"#4ECDC4\",\"#BB8FCE\",\"#BB8FCE\",\"#4ECDC4\",\"#2D3748\",\"#00CED1\",\"#FF6B6B\"]]',
        false,
        '2026-01-07T22:23:23.624Z'::timestamptz,
        '2026-01-27T09:05:19.248Z'::timestamptz
    ),
    -- Hoggo
    (
        'a@gmail.com',
        'Hoggo',
        '$2b$10$YN5Op0b7YjOOWZl2Oq/Nyu1PUlgjYo9Sk2/wYkvQpyjOybW.1vlXy',
        '[]',
        false,
        '2026-01-09T06:34:07.407Z'::timestamptz,
        '2026-01-09T06:34:07.407Z'::timestamptz
    ),
    -- Hedgehog
    (
        'twinata@sas.upenn.edu',
        'Hedgehog',
        '$2b$10$5xZ.BfGn1mgpP4pTIuWlQeSB7qdGRmlyD8XS6POjbR0KC3NDpWJDm',
        '[]',
        false,
        '2026-01-22T08:00:38.025Z'::timestamptz,
        '2026-01-22T08:00:38.025Z'::timestamptz
    )
ON CONFLICT (email) DO NOTHING;

-- Note: Skipped duplicate playwright test users (same email/username)
-- If you need them, you'll need to give them unique emails

-- Verify the migration
SELECT id, email, username, email_verified, created_at FROM users ORDER BY created_at;

