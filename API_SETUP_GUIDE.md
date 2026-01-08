# 🚀 QuillLearn API Setup Guide

Your QuillLearn project now has a complete Express.js backend API server!

## 📦 What Was Added

### 1. **Express Server** (`server/index.js`)
- Full REST API with CRUD operations
- CORS enabled for frontend requests
- Error handling and logging
- Runs on port 3001

### 2. **NPM Scripts** (Updated `package.json`)
```json
{
  "server": "node server/index.js",           // Run server in production
  "server:dev": "nodemon server/index.js",    // Run with auto-reload
  "dev:all": "concurrently ..."               // Run frontend + backend together
}
```

### 3. **Vite Proxy Configuration** (`vite.config.ts`)
- Automatically proxies `/api/*` requests to Express server
- No need for full URLs in fetch calls

### 4. **Example React Component** (`src/api/apiExample.tsx`)
- Demonstrates all API operations (GET, POST, PUT, DELETE)
- Includes error handling and loading states
- Ready-to-use example code

### 5. **Dependencies Installed**
- `express` - Web framework
- `cors` - Enable cross-origin requests
- `nodemon` - Auto-reload during development
- `concurrently` - Run multiple processes

## 🎯 How to Use

### Start Everything at Once
```bash
npm run dev:all
```

This starts:
- ✅ **Frontend** at `http://localhost:5174`
- ✅ **Backend API** at `http://localhost:3001`

### Start Separately

**Frontend only:**
```bash
npm run dev
```

**Backend only:**
```bash
npm run server:dev
```

## 📡 Available API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Check server status |
| GET | `/api/notes` | Get all notes |
| GET | `/api/notes/:id` | Get single note |
| POST | `/api/notes` | Create new note |
| PUT | `/api/notes/:id` | Update note |
| DELETE | `/api/notes/:id` | Delete note |

## 💻 Example API Calls

### From React Component
```typescript
// GET request
const response = await fetch('/api/notes')
const data = await response.json()

// POST request
const response = await fetch('/api/notes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'My Note', content: 'Content here' })
})

// DELETE request
await fetch(`/api/notes/${id}`, { method: 'DELETE' })
```

### From Terminal (curl)
```bash
# Health check
curl http://localhost:3001/api/health

# Get all notes
curl http://localhost:3001/api/notes

# Create note
curl -X POST http://localhost:3001/api/notes \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","content":"Hello"}'
```

## 🔧 Configuration

### Change API Port
Edit `server/index.js`:
```javascript
const PORT = process.env.PORT || 3001;  // Change 3001 to your port
```

Or use environment variable:
```bash
PORT=4000 npm run server
```

### Update Vite Proxy
If you change the API port, update `vite.config.ts`:
```typescript
proxy: {
  '/api': {
    target: 'http://localhost:YOUR_PORT',  // Update this
    changeOrigin: true,
  }
}
```

## 📁 Project Structure

```
QuillLearn/
├── server/
│   ├── index.js          # Express server
│   └── README.md         # Server documentation
├── src/
│   ├── api/
│   │   ├── apiExample.tsx    # Example component
│   │   └── apiExample.css    # Styles
│   └── ...
├── vite.config.ts        # Vite config with proxy
├── package.json          # Updated scripts
└── API_SETUP_GUIDE.md    # This file
```

## 🎨 Try the Example

1. Start the servers:
   ```bash
   npm run dev:all
   ```

2. The API example component is ready at `src/api/apiExample.tsx`

3. Import it in your app to test the API:
   ```typescript
   import ApiExample from './api/apiExample'
   ```

## 🗄️ Next Steps: Add a Database

Currently using mock data. To add a real database:

### MongoDB Example
```bash
npm install mongoose
```

```javascript
// server/db.js
const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/quilllearn');

const NoteSchema = new mongoose.Schema({
  title: String,
  content: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Note', NoteSchema);
```

### PostgreSQL Example
```bash
npm install pg
```

## 🔒 Security Recommendations

Before deploying to production:

1. **Add authentication** (JWT, sessions)
2. **Validate input** (express-validator)
3. **Rate limiting** (express-rate-limit)
4. **Environment variables** for sensitive data
5. **HTTPS** in production
6. **Restrict CORS** to your domain only

## 📚 Resources

- [Express.js Documentation](https://expressjs.com/)
- [Vite Proxy Guide](https://vitejs.dev/config/server-options.html#server-proxy)
- [REST API Best Practices](https://restfulapi.net/)

---

**You're all set!** 🎉 Run `npm run dev:all` to start building with your new API server.

