# 🗄️ Supabase Integration Guide

Your QuillLearn project now uses Supabase for data persistence instead of localStorage!

## 📋 Prerequisites

1. A Supabase account (free tier works great!)
2. Node.js and npm installed

## 🚀 Setup Steps

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in your project details:
   - **Name**: QuillLearn (or your preferred name)
   - **Database Password**: Choose a strong password
   - **Region**: Select closest to your users
4. Wait for the project to be created (~2 minutes)

### 2. Get Your API Credentials

1. In your Supabase dashboard, go to **Project Settings** (gear icon)
2. Click on **API** in the sidebar
3. Copy the following:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **service_role key** (under "Project API keys" - this is the secret key)

⚠️ **Important**: Use the `service_role` key for the server, NOT the `anon` key!

### 3. Create Database Tables

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy and paste this SQL:

\`\`\`sql
-- Table for spreadsheet data
CREATE TABLE sheets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  user_id TEXT,
  title TEXT NOT NULL,
  rows JSONB NOT NULL,
  column_widths INTEGER[] NOT NULL,
  last_time_saved BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for notes data
CREATE TABLE notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  user_id TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  delta JSONB,
  drawings JSONB,
  attachments JSONB,
  last_time_saved BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_sheets_session_id ON sheets(session_id);
CREATE INDEX idx_sheets_user_id ON sheets(user_id);
CREATE INDEX idx_notes_session_id ON notes(session_id);
CREATE INDEX idx_notes_user_id ON notes(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now - you can restrict later based on user_id)
CREATE POLICY "Enable read access for all users" ON sheets FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON sheets FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON sheets FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON sheets FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON notes FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON notes FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON notes FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON notes FOR DELETE USING (true);
\`\`\`

4. Click **Run** to execute the SQL

### 4. Install Dependencies

\`\`\`bash
npm install @supabase/supabase-js dotenv
\`\`\`

### 5. Configure Environment Variables

Create a `.env` file in the **server** directory:

\`\`\`bash
cd server
cp .env.example .env
\`\`\`

Edit `server/.env` and add your credentials:

\`\`\`env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
JWT_SECRET=your-super-secret-key-change-this
NODE_ENV=development
PORT=3001
\`\`\`

⚠️ **Security Note**: Never commit `.env` files to git! They're already in `.gitignore`.

### 6. Start Your Servers

\`\`\`bash
# From the project root
npm run dev:all
\`\`\`

This starts both:
- Frontend (Vite) on `http://localhost:5174`
- Backend (Express) on `http://localhost:3001`

## 🎯 What Changed?

### Architecture Flow

**Before (localStorage):**
\`\`\`
Frontend → localStorage (browser only)
\`\`\`

**After (Supabase):**
\`\`\`
Frontend → Express API → Supabase → Express API → Frontend
\`\`\`

### Files Modified

1. **Server-side:**
   - `server/config/supabase.js` - Supabase client configuration
   - `server/routes/sheets.js` - API routes for sheets
   - `server/routes/notes.js` - API routes for notes
   - `server/index.js` - Updated to use new routes

2. **Client-side:**
   - `src/sheets/sheetStorage.ts` - Now calls API instead of localStorage
   - `src/notes/noteStorage.ts` - Now calls API instead of localStorage
   - `src/sheets/InputGrid.tsx` - Updated to handle async data loading
   - `src/notes/notes.tsx` - Updated to handle async data loading

## 📡 API Endpoints

### Sheets
- `GET /api/sheets/:sessionId` - Load a sheet
- `POST /api/sheets` - Save/update a sheet
- `GET /api/sheets/user/:userId` - Get all sheets for a user
- `DELETE /api/sheets/:sessionId` - Delete a sheet

### Notes
- `GET /api/notes/:sessionId` - Load a note
- `POST /api/notes` - Save/update a note
- `GET /api/notes/user/:userId` - Get all notes for a user
- `DELETE /api/notes/:sessionId` - Delete a note

## 🔒 Security Best Practices

1. **Row Level Security (RLS)**: Currently set to allow all. Update policies to restrict by user_id:

\`\`\`sql
-- Example: Only allow users to see their own sheets
DROP POLICY "Enable read access for all users" ON sheets;
CREATE POLICY "Users can read own sheets" ON sheets 
  FOR SELECT USING (auth.uid()::text = user_id);
\`\`\`

2. **Environment Variables**: Never expose service_role key to frontend
3. **Authentication**: Integrate with Supabase Auth for better user management

## 🐛 Troubleshooting

### "Missing Supabase environment variables"
- Make sure `server/.env` exists and has correct values
- Restart the server after adding environment variables

### "Failed to load sheet/note data"
- Check that tables were created successfully in Supabase
- Verify API credentials are correct
- Check browser console and server logs for errors

### CORS errors
- Make sure your frontend URL is in the CORS whitelist in `server/index.js`

## 📚 Next Steps

- [ ] Migrate existing localStorage data to Supabase (optional)
- [ ] Implement user-specific data filtering
- [ ] Add real-time collaboration with Supabase Realtime
- [ ] Set up proper RLS policies based on user authentication
- [ ] Add data backup/export functionality

---

**You're all set!** 🎉 Your data is now persisted in Supabase and accessible from any device!

