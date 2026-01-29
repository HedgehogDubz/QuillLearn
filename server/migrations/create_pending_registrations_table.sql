-- Create pending_registrations table
-- This stores registration requests until email is verified
-- Once verified, the user is created and the pending registration is deleted

CREATE TABLE IF NOT EXISTS pending_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,  -- Already hashed
    avatar TEXT DEFAULT '[]',
    verification_token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_pending_registrations_email ON pending_registrations(email);
CREATE INDEX idx_pending_registrations_username ON pending_registrations(username);
CREATE INDEX idx_pending_registrations_token ON pending_registrations(verification_token);
CREATE INDEX idx_pending_registrations_expires ON pending_registrations(expires_at);

-- Auto-cleanup expired pending registrations (optional - run periodically)
-- DELETE FROM pending_registrations WHERE expires_at < NOW();

