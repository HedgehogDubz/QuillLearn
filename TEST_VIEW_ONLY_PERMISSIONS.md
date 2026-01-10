# Testing View-Only Permission Enforcement

## What Changed

Server-side permission checks have been added to prevent view-only users from editing documents.

### Endpoints Updated

1. **POST /api/sheets** - Save/update sheet data
2. **POST /api/notes** - Save/update note data

Both endpoints now check user permissions before allowing updates.

---

## Permission Logic

### For Existing Documents (Updates)

When a user tries to save changes to an existing document:

1. **Owner** (user_id matches) → ✅ Can edit
2. **Edit User** (in edit_users array) → ✅ Can edit
3. **View User** (in view_users array) → ❌ **403 Forbidden**
4. **No Permission** (not in any list) → ❌ **403 Forbidden**

### For New Documents (Creation)

When creating a new document:
- ✅ Anyone can create (they become the owner)
- No permission check needed

---

## Error Responses

### View-Only User Tries to Edit Sheet

**Request:**
```bash
curl -X POST http://localhost:3001/api/sheets \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "existing-sheet-id",
    "userId": "view-only-user-id",
    "title": "My Sheet",
    "rows": [[{"value": "Modified"}]],
    "columnWidths": [100]
  }'
```

**Response:**
```json
{
  "success": false,
  "error": "You only have view access to this sheet. Cannot save changes."
}
```

**Status Code:** 403 Forbidden

---

### View-Only User Tries to Edit Note

**Request:**
```bash
curl -X POST http://localhost:3001/api/notes \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "existing-note-id",
    "userId": "view-only-user-id",
    "title": "My Note",
    "content": "Modified content"
  }'
```

**Response:**
```json
{
  "success": false,
  "error": "You only have view access to this note. Cannot save changes."
}
```

**Status Code:** 403 Forbidden

---

### User with No Permission Tries to Edit

**Response:**
```json
{
  "success": false,
  "error": "You do not have permission to edit this sheet."
}
```

**Status Code:** 403 Forbidden

---

## Testing Steps

### Setup

1. **Create a test sheet/note as User A:**
   ```bash
   # User A creates a sheet
   curl -X POST http://localhost:3001/api/sheets \
     -H "Content-Type: application/json" \
     -d '{
       "sessionId": "test-sheet-123",
       "userId": "user-a-id",
       "title": "Test Sheet",
       "rows": [[{"value": "Original"}]],
       "columnWidths": [100]
     }'
   ```

2. **Share with User B as view-only:**
   ```bash
   # User A shares with User B (view permission)
   curl -X POST http://localhost:3001/api/sheets/test-sheet-123/share \
     -H "Content-Type: application/json" \
     -d '{
       "userId": "user-a-id",
       "action": "add",
       "targetUser": "user-b-email@example.com",
       "permission": "view"
     }'
   ```

3. **Share with User C as editor:**
   ```bash
   # User A shares with User C (edit permission)
   curl -X POST http://localhost:3001/api/sheets/test-sheet-123/share \
     -H "Content-Type: application/json" \
     -d '{
       "userId": "user-a-id",
       "action": "add",
       "targetUser": "user-c-email@example.com",
       "permission": "edit"
     }'
   ```

### Test Cases

#### Test 1: Owner Can Edit ✅

```bash
curl -X POST http://localhost:3001/api/sheets \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-sheet-123",
    "userId": "user-a-id",
    "title": "Test Sheet",
    "rows": [[{"value": "Modified by Owner"}]],
    "columnWidths": [100]
  }'
```

**Expected:** 200 OK, sheet updated successfully

---

#### Test 2: Editor Can Edit ✅

```bash
curl -X POST http://localhost:3001/api/sheets \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-sheet-123",
    "userId": "user-c-id",
    "title": "Test Sheet",
    "rows": [[{"value": "Modified by Editor"}]],
    "columnWidths": [100]
  }'
```

**Expected:** 200 OK, sheet updated successfully

---

#### Test 3: View-Only User CANNOT Edit ❌

```bash
curl -X POST http://localhost:3001/api/sheets \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-sheet-123",
    "userId": "user-b-id",
    "title": "Test Sheet",
    "rows": [[{"value": "Modified by Viewer"}]],
    "columnWidths": [100]
  }'
```

**Expected:** 403 Forbidden
```json
{
  "success": false,
  "error": "You only have view access to this sheet. Cannot save changes."
}
```

---

#### Test 4: Unauthorized User CANNOT Edit ❌

```bash
curl -X POST http://localhost:3001/api/sheets \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-sheet-123",
    "userId": "random-user-id",
    "title": "Test Sheet",
    "rows": [[{"value": "Hacked"}]],
    "columnWidths": [100]
  }'
```

**Expected:** 403 Forbidden
```json
{
  "success": false,
  "error": "You do not have permission to edit this sheet."
}
```

---

## Testing in the UI

### Manual Testing

1. **Login as User A** (owner)
   - Create a new sheet
   - Verify you can edit and save ✅

2. **Share with User B** (view permission)
   - Use ShareModal to add User B with "Can view" permission

3. **Login as User B** (viewer)
   - Open the shared sheet
   - Try to edit a cell
   - Try to save
   - **Expected:** Error message appears, changes not saved ❌

4. **Share with User C** (edit permission)
   - Login as User A
   - Use ShareModal to add User C with "Can edit" permission

5. **Login as User C** (editor)
   - Open the shared sheet
   - Edit cells
   - Save changes
   - **Expected:** Changes saved successfully ✅

---

## Implementation Details

### Code Changes

**server/routes/sheets.js** (lines 57-139):
```javascript
// If sheet exists, check if user has edit permission
if (existing && userId) {
    const userPermission = await getUserPermission('sheets', sessionId, userId);
    
    // Only allow edit if user is owner or has edit permission
    if (userPermission === PERMISSION_LEVELS.VIEW) {
        return res.status(403).json({
            success: false,
            error: 'You only have view access to this sheet. Cannot save changes.'
        });
    }
    
    if (userPermission === PERMISSION_LEVELS.NONE) {
        return res.status(403).json({
            success: false,
            error: 'You do not have permission to edit this sheet.'
        });
    }
}
```

**server/routes/notes.js** (lines 57-141):
- Same logic as sheets

---

## Security Benefits

1. ✅ **Server-side enforcement** - Cannot be bypassed by client
2. ✅ **Consistent with sharing system** - Uses same permission levels
3. ✅ **Clear error messages** - Users know why they can't edit
4. ✅ **Protects data integrity** - View-only users cannot modify documents
5. ✅ **Works with existing permission system** - No database changes needed

---

## Next Steps

After testing, you may want to:
- [ ] Add client-side UI to disable editing for view-only users
- [ ] Show a "Read-only" indicator in the UI
- [ ] Add toast notifications when save fails due to permissions
- [ ] Implement real-time permission updates (if permissions change while viewing)

