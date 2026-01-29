/**
 * Express API Server for QuillLearn
 *
 * Simple backend server with example API routes
 * Runs on port 3001 by default
 */

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import sheetsRoutes from './routes/sheets.js';
import notesRoutes from './routes/notes.js';
import diagramsRoutes from './routes/diagrams.js';
import storageRoutes from './routes/storage.js';
import chatRoutes from './routes/chat.js';
import notesToSheetsRoutes from './routes/notes-to-sheets.js';
import presenceRoutes from './routes/presence.js';
import usersRoutes from './routes/users.js';
import discoverRoutes from './routes/discover.js';
import publishedRoutes from './routes/published.js';
import ttsRoutes from './routes/tts.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: [
        'http://localhost:5174',
        'http://localhost:5175',
        'http://localhost:5176',
        'http://localhost:5177',
        'http://localhost:5178',
        'http://localhost:5179',
        'http://localhost:5180',
        'https://quilllearn.vercel.app'
    ],
    credentials: true // Allow cookies to be sent
}));
app.use(express.json({ limit: '50mb' })); // Parse JSON request bodies (increased limit for large notes with images)
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // Parse URL-encoded bodies
app.use(cookieParser()); // Parse cookies

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// ============ API ROUTES ============

// Authentication routes
app.use('/api/auth', authRoutes);

// Sheets routes
app.use('/api/sheets', sheetsRoutes);

// Notes routes
app.use('/api/notes', notesRoutes);

// Diagrams routes
app.use('/api/diagrams', diagramsRoutes);

// Storage routes
app.use('/api/storage', storageRoutes);

// Chat routes (AI)
//app.use('/api/chat', chatRoutes);
app.use('/api/notes-to-sheets', notesToSheetsRoutes);

// Presence routes (real-time collaboration)
app.use('/api/presence', presenceRoutes);



// User routes
app.use('/api/users', usersRoutes);

// Discover routes (public content, likes, comments)
app.use('/api/discover', discoverRoutes);

// Published content routes
app.use('/api/published', publishedRoutes);

// Text-to-Speech routes
app.use('/api/tts', ttsRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 QuillLearn API Server running on http://localhost:${PORT}`);
    console.log(`📝 API endpoints available at http://localhost:${PORT}/api`);
    console.log(`\nAvailable routes:`);
    console.log(`  Authentication:`);
    console.log(`    POST   /api/auth/register`);
    console.log(`    POST   /api/auth/login`);
    console.log(`    POST   /api/auth/logout`);
    console.log(`    GET    /api/auth/me`);
    console.log(`\n  Sheets:`);
    console.log(`    GET    /api/sheets/:sessionId`);
    console.log(`    POST   /api/sheets`);
    console.log(`    GET    /api/sheets/user/:userId`);
    console.log(`    DELETE /api/sheets/:sessionId`);
    console.log(`\n  Notes:`);
    console.log(`    GET    /api/notes/:sessionId`);
    console.log(`    POST   /api/notes`);
    console.log(`    GET    /api/notes/user/:userId`);
    console.log(`    DELETE /api/notes/:sessionId\n`);
});

