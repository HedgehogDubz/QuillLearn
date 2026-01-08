/**
 * Supabase Client Configuration for Server
 *
 * Server-side Supabase client for database operations
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from server/.env
dotenv.config({ path: join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // Use service key on server for admin access

// Validate environment variables
if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables!');
    console.error('Please add SUPABASE_URL and SUPABASE_SERVICE_KEY to your server/.env file');
    console.error('See SUPABASE_SETUP_GUIDE.md for setup instructions');
    process.exit(1);
}

// Create Supabase client with service key (bypasses RLS)
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

console.log('✅ Supabase client initialized');

