# Testing User Lookup in Sharing System

## What Changed

The sharing system now accepts **email or username** instead of requiring the full user ID. The system will:

1. Look up the user by email first
2. If not found, look up by username
3. If still not found, try as a user ID (backward compatibility)
4. Convert to user ID before saving to the database
5. Return user info (id, username, email) in the response

## API Endpoints

### 1. User Lookup Endpoint

**GET /api/users/lookup?query=email_or_username**

Test with curl:
```bash
# Look up by email
curl "http://localhost:3001/api/users/lookup?query=test@example.com"

# Look up by username
curl "http://localhost:3001/api/users/lookup?query=testuser"
```

Expected response:
```json
{
  "success": true,
  "user": {
    "id": "1767823816309e9lq2r5xc",
    "email": "test@example.com",
    "username": "testuser",
    "createdAt": "2026-01-07T22:10:16.309Z",
    "updatedAt": "2026-01-07T22:10:16.309Z"
  }
}
```

### 2. Share with Email/Username

**POST /api/sheets/:sessionId/share**
**POST /api/notes/:sessionId/share**

Test with curl:
```bash
# Share using email
curl -X POST http://localhost:3001/api/sheets/YOUR_SESSION_ID/share \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_USER_ID",
    "action": "add",
    "targetUser": "test@example.com",
    "permission": "edit"
  }'

# Share using username
curl -X POST http://localhost:3001/api/sheets/YOUR_SESSION_ID/share \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_USER_ID",
    "action": "add",
    "targetUser": "testuser",
    "permission": "view"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Sharing permissions updated successfully",
  "data": {
    "edit_users": ["1767823816309e9lq2r5xc"],
    "view_users": [],
    "added_user": {
      "id": "1767823816309e9lq2r5xc",
      "email": "test@example.com",
      "username": "testuser"
    }
  }
}
```

## Testing in the UI

1. **Start the server:**
   ```bash
   cd server
   npm start
   ```

2. **Start the frontend:**
   ```bash
   npm run dev
   ```

3. **Test the ShareModal:**
   - Create a new sheet or note
   - Click the "Share" button
   - In the input field, enter:
     - An email: `test@example.com`
     - OR a username: `testuser`
     - OR a user ID: `1767823816309e9lq2r5xc`
   - Select permission level (edit or view)
   - Click "Add"

4. **Expected behavior:**
   - Success message shows: "Successfully added testuser (test@example.com) with edit access"
   - The user appears in the collaborators list
   - The database stores the user ID (not the email/username)

## Test Users

From `server/data/users.json`:

| Email | Username | User ID |
|-------|----------|---------|
| test@example.com | testuser | 1767823816309e9lq2r5xc |
| tristankenshin@gmail.com | HedgehogDubz | 1767824603624rbxchigmw |
| a@gmail.com | Hoggo | 1767940447407oatymz7si |

## Verification

After sharing, verify in Supabase:

1. Go to Supabase Dashboard → Table Editor
2. Open the `sheets` or `notes` table
3. Find your document by `session_id`
4. Check the `edit_users` or `view_users` column
5. Should contain the **user ID** (not email/username)

Example:
```json
{
  "session_id": "abc123",
  "user_id": "1767824603624rbxchigmw",
  "edit_users": ["1767823816309e9lq2r5xc"],
  "view_users": ["1767940447407oatymz7si"]
}
```

## Error Cases

### User Not Found
```bash
curl -X POST http://localhost:3001/api/sheets/SESSION_ID/share \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_USER_ID",
    "action": "add",
    "targetUser": "nonexistent@email.com",
    "permission": "edit"
  }'
```

Expected response:
```json
{
  "success": false,
  "error": "User not found. Please check the email or username."
}
```

### Missing Fields
```bash
curl -X POST http://localhost:3001/api/sheets/SESSION_ID/share \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "YOUR_USER_ID",
    "action": "add"
  }'
```

Expected response:
```json
{
  "success": false,
  "error": "Missing required fields: userId, action, targetUser"
}
```

## Benefits

1. ✅ **User-friendly**: Users can share by email or username instead of copying IDs
2. ✅ **Backward compatible**: Still accepts user IDs
3. ✅ **Database integrity**: Always stores user IDs in the database
4. ✅ **Better UX**: Success message shows username and email
5. ✅ **Error handling**: Clear error messages when user not found

