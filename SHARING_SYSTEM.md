# QuillLearn Sharing & Collaboration System

## Overview

QuillLearn now includes a comprehensive sharing and real-time collaboration system that allows users to:
- Share sheets and notes with other users
- Grant different permission levels (owner, edit, view)
- See who else is currently viewing/editing a document
- Track cursor positions in real-time
- Collaborate simultaneously on documents

## Features

### 1. Permission Levels

- **👑 Owner**: Full control - can edit, share, and delete the document
- **✏️ Edit**: Can edit the document and share it with others
- **👁️ View**: Can only view the document, no editing allowed

### 2. Share Modal

The `ShareModal` component provides a user-friendly interface for managing permissions:

- Add users by email or user ID
- Choose permission level (edit or view)
- See all current collaborators
- Change permission levels
- Remove users from the document

**Usage:**
```tsx
import { ShareModal } from '../components/ShareModal';

<ShareModal
  isOpen={shareModalOpen}
  onClose={() => setShareModalOpen(false)}
  sessionId={session.sessionId}
  documentType="sheet" // or "note"
  currentUserId={user.id}
  currentUserPermission="owner"
  onShareUpdate={() => {
    // Refresh data after sharing changes
  }}
/>
```

### 3. Real-time Presence

The `PresenceService` tracks who is currently viewing/editing a document:

**Usage:**
```tsx
import { PresenceService } from '../collaboration/PresenceService';

const presenceService = new PresenceService(
  sessionId,
  'sheet',
  userId,
  userName,
  userEmail
);

// Start tracking
await presenceService.start();

// Subscribe to presence updates
presenceService.subscribe((users) => {
  console.log('Active users:', users);
});

// Update cursor position
await presenceService.updateCursor({ row: 0, col: 0 });

// Stop tracking when leaving
await presenceService.stop();
```

### 4. Active Users Display

The `ActiveUsers` component shows who else is currently in the document:

```tsx
import { ActiveUsers } from '../collaboration/ActiveUsers';

<ActiveUsers users={activeUsers} />
```

### 5. Cursor Overlay

The `CursorOverlay` component displays other users' cursor positions:

```tsx
import { CursorOverlay } from '../collaboration/CursorOverlay';

<CursorOverlay users={activeUsers} />
```

## Database Schema

### Sharing Columns

Both `sheets` and `notes` tables include:
- `user_id` (TEXT) - The document owner
- `edit_users` (TEXT[]) - Array of user IDs with edit permissions
- `view_users` (TEXT[]) - Array of user IDs with view permissions

### Presence Table

```sql
CREATE TABLE document_presence (
  id UUID PRIMARY KEY,
  session_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_email TEXT,
  user_name TEXT,
  cursor_position JSONB,
  last_seen TIMESTAMP WITH TIME ZONE,
  UNIQUE(session_id, document_type, user_id)
);
```

## API Endpoints

### Sharing Endpoints

**POST /api/sheets/:sessionId/share**
**POST /api/notes/:sessionId/share**

Manage sharing permissions for a document.

Request body:
```json
{
  "userId": "current-user-id",
  "action": "add" | "remove" | "change",
  "targetUser": "user-to-share-with",
  "permission": "edit" | "view"
}
```

### Presence Endpoints

**POST /api/presence/:sessionId**
Update user presence.

**GET /api/presence/:sessionId?documentType=sheet|note**
Get all active users for a document.

**DELETE /api/presence/:sessionId**
Remove user presence when leaving.

## Setup Instructions

### 1. Run Database Migration

Execute the SQL in `database/migrations/add_sharing_columns.sql` in your Supabase SQL Editor:

1. Go to Supabase Dashboard → SQL Editor
2. Copy the migration file contents
3. Run the SQL

This will:
- Add sharing columns to sheets and notes tables
- Create the document_presence table
- Update Row Level Security policies
- Create necessary indexes

### 2. Update Environment Variables

No additional environment variables needed - uses existing Supabase configuration.

### 3. Start the Server

The presence routes are automatically included when you start the server:

```bash
cd server
npm start
```

## Usage Examples

### Sharing a Document

1. Navigate to the home page
2. Find the document you want to share
3. Click the "Share" button
4. Enter the user's email or ID
5. Select permission level (edit or view)
6. Click "Add"

### Viewing Shared Documents

Shared documents automatically appear on your home page with a permission badge:
- 👑 for documents you own
- ✏️ for documents you can edit
- 👁️ for documents you can only view

### Real-time Collaboration

When multiple users open the same document:
1. Active users appear in the top-right corner
2. Each user's cursor is shown with their color
3. Changes sync automatically (implementation depends on document type)

## Testing

Run the Playwright tests to verify sharing functionality:

```bash
npx playwright test tests/sharing.spec.ts
```

Tests cover:
- Share modal functionality
- Permission management
- Real-time presence
- Cursor synchronization
- Multi-user collaboration

## Security Considerations

1. **Row Level Security**: Supabase RLS policies ensure users can only access documents they own or have been shared with
2. **Permission Validation**: API endpoints validate user permissions before allowing actions
3. **User Authentication**: All endpoints require user authentication via `x-user-id` header

## Future Enhancements

- [ ] Email notifications when documents are shared
- [ ] Comment threads on documents
- [ ] Version history and conflict resolution
- [ ] Offline support with sync
- [ ] Mobile app support
- [ ] Advanced permission settings (e.g., expiring links)

