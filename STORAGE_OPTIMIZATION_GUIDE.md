# 🚀 Storage Optimization Guide

## Problem
Drawings and file attachments stored as base64 in the database are causing slow saves because:
- Base64 encoding increases file size by ~33%
- Large JSONB columns slow down database queries
- Every save sends megabytes of data over the network

## Solution: Supabase Storage

Use **Supabase Storage** (object storage) for large files and store only URLs in the database.

---

## 📋 Step-by-Step Implementation

### Step 1: Install Required Dependencies

```bash
npm install multer uuid
npm install --save-dev @types/multer
```

### Step 2: Create Storage Buckets in Supabase

1. Go to **Supabase Dashboard** → **Storage**
2. Click **New Bucket**
3. Create two buckets:
   - Name: `drawings`, Public: ✅ Yes
   - Name: `attachments`, Public: ✅ Yes

4. Or run this SQL in **SQL Editor**:

```sql
-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('drawings', 'drawings', true),
  ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public Access" ON storage.objects 
FOR SELECT USING ( bucket_id IN ('drawings', 'attachments') );

-- Allow authenticated users to upload
CREATE POLICY "Authenticated Upload" ON storage.objects 
FOR INSERT WITH CHECK ( 
  bucket_id IN ('drawings', 'attachments') 
  AND (auth.role() = 'authenticated' OR auth.role() = 'anon')
);

-- Allow users to delete files
CREATE POLICY "Authenticated Delete" ON storage.objects 
FOR DELETE USING ( 
  bucket_id IN ('drawings', 'attachments')
  AND (auth.role() = 'authenticated' OR auth.role() = 'anon')
);
```

### Step 3: Update Database Schema

The `notes` table structure will change from storing base64 to URLs:

**Before:**
```json
{
  "drawings": [
    {
      "dataURL": "data:image/png;base64,iVBORw0KG...", // HUGE!
      "width": 800,
      "height": 600
    }
  ]
}
```

**After:**
```json
{
  "drawings": [
    {
      "url": "https://xxx.supabase.co/storage/v1/object/public/drawings/...",
      "width": 800,
      "height": 600
    }
  ]
}
```

### Step 4: Update Frontend Code

#### Update `noteStorage.ts` interface:

```typescript
export interface DrawingData {
    url: string  // Changed from dataURL
    width: number
    height: number
    hasBorder?: boolean
}

export interface FileAttachment {
    id: string
    name: string
    type: string
    size: number
    url: string  // Changed from dataURL
    uploadedAt: number
}
```

#### Update drawing save function in `notes.tsx`:

```typescript
const saveDrawing = async () => {
    const canvas = canvasRef.current
    const quill = quillRef.current
    if (!canvas || !quill) return

    // Convert canvas to blob instead of dataURL
    canvas.toBlob(async (blob) => {
        if (!blob) return

        // Upload to Supabase Storage
        const formData = new FormData()
        formData.append('drawing', blob, 'drawing.png')
        formData.append('userId', user?.id || 'anonymous')
        formData.append('sessionId', sessionId)

        const response = await fetch('/api/storage/upload-drawing', {
            method: 'POST',
            body: formData
        })

        const result = await response.json()

        if (result.success) {
            const newDrawing: DrawingData = {
                url: result.url,  // Store URL instead of dataURL
                width: canvas.width,
                height: canvas.height,
                hasBorder
            }

            // Insert into editor
            const range = quill.getSelection() || { index: quill.getLength() }
            quill.insertEmbed(range.index, 'image', result.url)
            
            setDrawings([...drawings, newDrawing])
            setShowDrawing(false)
        }
    }, 'image/png')
}
```

### Step 5: Update File Upload

```typescript
const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const quill = quillRef.current
    if (!quill || !e.target.files || e.target.files.length === 0) return

    const file = e.target.files[0]

    // Upload to Supabase Storage
    const formData = new FormData()
    formData.append('file', file)
    formData.append('userId', user?.id || 'anonymous')
    formData.append('sessionId', sessionId)

    const response = await fetch('/api/storage/upload-attachment', {
        method: 'POST',
        body: formData
    })

    const result = await response.json()

    if (result.success) {
        const attachment: FileAttachment = {
            id: crypto.randomUUID(),
            name: result.metadata.name,
            type: result.metadata.type,
            size: result.metadata.size,
            url: result.url,  // Store URL instead of dataURL
            uploadedAt: Date.now()
        }

        setAttachments(prev => [...prev, attachment])

        // Insert into editor
        const range = quill.getSelection() || { index: quill.getLength() }
        quill.insertEmbed(range.index, 'fileAttachment', {
            id: attachment.id,
            name: attachment.name,
            dataURL: result.url,  // Use URL
            size: attachment.size
        })
    }
}
```

---

## ✅ Benefits After Implementation

- ⚡ **10-100x faster saves** - Only small JSON with URLs
- 💾 **Smaller database** - Binary data in object storage
- 🚀 **Parallel uploads** - Upload files while editing
- 📦 **Better scalability** - Storage designed for large files

---

## 🔄 Migration Strategy

For existing data with base64:
1. Keep old data working (backward compatible)
2. New saves use storage URLs
3. Optionally migrate old base64 to storage in background

---

## 📚 Next Steps

1. ✅ Install dependencies: `npm install multer uuid`
2. ✅ Create storage buckets in Supabase
3. ✅ API routes already created in `server/routes/storage.js`
4. ⏳ Update frontend to use new upload endpoints
5. ⏳ Test with a drawing and file upload

Need help with any step? Let me know!

