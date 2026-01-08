# QuillLearn Express API Server

Simple Express.js backend API for the QuillLearn application.

## 🚀 Quick Start

### Run Both Frontend and Backend Together
```bash
npm run dev:all
```

This will start:
- **Vite dev server** on `http://localhost:5174` (frontend)
- **Express API server** on `http://localhost:3001` (backend)

### Run Only the API Server
```bash
# Production mode
npm run server

# Development mode (with auto-reload)
npm run server:dev
```

## 📡 API Endpoints

### Health Check
```bash
GET /api/health
```
Returns server status and timestamp.

**Example Response:**
```json
{
  "status": "ok",
  "message": "QuillLearn API is running",
  "timestamp": "2024-01-05T12:00:00.000Z"
}
```

### Get All Notes
```bash
GET /api/notes
```

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "First Note",
      "content": "Hello World",
      "createdAt": "2024-01-05T12:00:00.000Z"
    }
  ],
  "count": 1
}
```

### Get Single Note
```bash
GET /api/notes/:id
```

### Create Note
```bash
POST /api/notes
Content-Type: application/json

{
  "title": "My Note",
  "content": "Note content here"
}
```

**Example Response:**
```json
{
  "success": true,
  "message": "Note created successfully",
  "data": {
    "id": 1234567890,
    "title": "My Note",
    "content": "Note content here",
    "createdAt": "2024-01-05T12:00:00.000Z"
  }
}
```

### Update Note
```bash
PUT /api/notes/:id
Content-Type: application/json

{
  "title": "Updated Title",
  "content": "Updated content"
}
```

### Delete Note
```bash
DELETE /api/notes/:id
```

## 🧪 Testing the API

### Using curl
```bash
# Health check
curl http://localhost:3001/api/health

# Get all notes
curl http://localhost:3001/api/notes

# Create a note
curl -X POST http://localhost:3001/api/notes \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Note","content":"This is a test"}'

# Delete a note
curl -X DELETE http://localhost:3001/api/notes/1
```

### Using the Frontend
Navigate to `/api-example` in your React app to see a working example of API calls.

## 🔧 Configuration

### Port
Default port is `3001`. Change it by setting the `PORT` environment variable:

```bash
PORT=4000 npm run server
```

### CORS
CORS is enabled for all origins in development. Update `server/index.js` to restrict origins in production.

## 📁 Project Structure

```
server/
├── index.js          # Main Express server file
└── README.md         # This file
```

## 🔄 Vite Proxy

The Vite dev server is configured to proxy `/api/*` requests to `http://localhost:3001`.

This means in your React code, you can call:
```javascript
fetch('/api/notes')  // Automatically proxied to http://localhost:3001/api/notes
```

## 🗄️ Database Integration

Currently, the API returns mock data. To connect to a real database:

1. Install a database driver (e.g., `mongoose` for MongoDB, `pg` for PostgreSQL)
2. Create database connection in `server/db.js`
3. Replace mock responses with actual database queries

### Example with MongoDB:
```bash
npm install mongoose
```

```javascript
// server/db.js
const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/quilllearn');
```

## 📝 Next Steps

- [ ] Add database integration
- [ ] Add authentication (JWT)
- [ ] Add input validation (express-validator)
- [ ] Add rate limiting
- [ ] Add logging (morgan, winston)
- [ ] Add error handling middleware
- [ ] Add API documentation (Swagger)

