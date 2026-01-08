# 🚀 Quick Start Guide - Supabase Integration

## ⚡ TL;DR - Get Running in 5 Minutes

### 1. Create Supabase Project
- Go to [supabase.com](https://supabase.com)
- Create new project
- Copy **Project URL** and **service_role key** from Settings → API

### 2. Create Tables
In Supabase SQL Editor, paste and run:
```sql
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

CREATE INDEX idx_sheets_session_id ON sheets(session_id);
CREATE INDEX idx_sheets_user_id ON sheets(user_id);
CREATE INDEX idx_notes_session_id ON notes(session_id);
CREATE INDEX idx_notes_user_id ON notes(user_id);

ALTER TABLE sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access" ON sheets USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON notes USING (true) WITH CHECK (true);
```

### 3. Configure Server
```bash
cd server
cp .env.example .env
```

Edit `server/.env`:
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
JWT_SECRET=change-this-to-something-random
PORT=3001
```

### 4. Start Application
```bash
npm run dev:all
```

### 5. Test It!
- Open http://localhost:5174
- Create a sheet or note
- Check Supabase dashboard → Table Editor to see your data!

## 📦 What's Included

✅ Express API server with Supabase integration  
✅ Automatic data persistence to cloud database  
✅ API endpoints for sheets and notes  
✅ Async data loading in frontend  
✅ Migration utility for existing localStorage data  

## 🔧 Migrate Existing Data (Optional)

If you have existing data in localStorage:

1. Open browser console on http://localhost:5174
2. Run:
```javascript
await window.migrateToSupabase('your-user-id-or-null')
```

## 📚 Full Documentation

- **Complete Setup**: See `SUPABASE_SETUP_GUIDE.md`
- **Migration Details**: See `MIGRATION_SUMMARY.md`

## 🆘 Common Issues

**"Missing Supabase environment variables"**
→ Make sure `server/.env` exists with correct values

**Data not saving**
→ Check browser console and server terminal for errors

**CORS errors**
→ Your frontend port should be in `server/index.js` CORS whitelist

---

**That's it!** You're now using Supabase for data persistence! 🎉

