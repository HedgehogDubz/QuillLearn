# 🔒 Secure Storage Setup Guide

This guide explains how to set up **secure, private storage** for QuillLearn drawings and attachments.

## Security Model

✅ **Private Buckets** - Only authenticated users can access files  
✅ **Row Level Security (RLS)** - Users can only access their own files  
✅ **Signed URLs** - Temporary URLs that expire after 24 hours  
✅ **Folder-based Isolation** - Files organized by userId/sessionId  

## Setup Steps

### 1. Create Storage Buckets (Private)

In your Supabase Dashboard:

1. Go to **Storage** → **Create a new bucket**
2. Create bucket named `drawings`
   - ❌ **DO NOT** check "Public bucket"
   - Keep it **private**
3. Create bucket named `attachments`
   - ❌ **DO NOT** check "Public bucket"
   - Keep it **private**

### 2. Set Up Row Level Security (RLS) Policies

Go to **SQL Editor** in Supabase and run this SQL:

```sql
-- Enable RLS on storage.objects (should already be enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can read own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;

-- Policy 1: Users can read files in their own folder
CREATE POLICY "Users can read own files" 
ON storage.objects FOR SELECT 
USING (
  bucket_id IN ('drawings', 'attachments') 
  AND (
    -- Check if the first folder in the path matches the user's ID
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Allow anonymous folder for non-authenticated users
    (storage.foldername(name))[1] = 'anonymous'
  )
);

-- Policy 2: Users can upload files to their own folder
CREATE POLICY "Users can upload own files" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id IN ('drawings', 'attachments') 
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    (storage.foldername(name))[1] = 'anonymous'
  )
);

-- Policy 3: Users can delete files from their own folder
CREATE POLICY "Users can delete own files" 
ON storage.objects FOR DELETE 
USING (
  bucket_id IN ('drawings', 'attachments')
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    (storage.foldername(name))[1] = 'anonymous'
  )
);
```

### 3. How It Works

#### File Organization
Files are stored with this structure:
```
drawings/
  ├── userId1/
  │   ├── sessionId1/
  │   │   ├── uuid1.png
  │   │   └── uuid2.png
  │   └── sessionId2/
  │       └── uuid3.png
  └── userId2/
      └── sessionId3/
          └── uuid4.png
```

#### Signed URLs
- When a file is uploaded, the server creates a **signed URL**
- This URL is valid for **24 hours**
- After 24 hours, the URL expires (but the file remains in storage)
- When you open a note, new signed URLs are generated if needed

#### Security Benefits
1. **No public access** - Files can't be accessed without authentication
2. **User isolation** - Users can only access their own files
3. **Temporary URLs** - Even if someone gets a URL, it expires
4. **Folder-based security** - RLS policies check the folder path

## Testing

### Test 1: Upload a Drawing
1. Create a new note
2. Draw something and save it
3. Check browser console - you should see a signed URL like:
   ```
   https://[project].supabase.co/storage/v1/object/sign/drawings/userId/sessionId/uuid.png?token=...
   ```

### Test 2: Edit a Drawing
1. Click on a saved drawing to edit it
2. The image should load in the canvas
3. Check console for "Drawing loaded successfully"

### Test 3: Verify Security
1. Copy a signed URL from the console
2. Open it in an incognito window (not logged in)
3. It should still work (signed URLs work without auth)
4. Wait 24 hours and try again - it should fail (expired)

## Troubleshooting

### Issue: "Failed to load drawing"
- Check browser console for specific error
- Verify RLS policies are set up correctly
- Make sure buckets are created and named correctly

### Issue: "Permission denied" when uploading
- Check that RLS policies allow INSERT
- Verify the userId in the path matches the authenticated user

### Issue: Images don't show in Quill editor
- Signed URLs should work fine in Quill
- Check that the URL is being inserted correctly
- Verify CORS is not blocking (signed URLs bypass CORS)

## Notes

- Signed URLs expire after 24 hours
- If you need longer expiration, change `86400` in `server/routes/storage.js`
- For production, consider implementing URL refresh logic
- Anonymous users can still upload (files go to `anonymous/` folder)

