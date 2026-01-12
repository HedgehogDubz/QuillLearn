/**
 * Storage Routes
 * Handles file uploads to Supabase Storage for drawings and attachments
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    }
});

/**
 * POST /api/storage/upload-drawing
 * Upload a canvas drawing to Supabase Storage
 */
router.post('/upload-drawing', upload.single('drawing'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file provided'
            });
        }

        const { userId, sessionId } = req.body;
        const fileId = uuidv4();
        const fileName = `${userId || 'anonymous'}/${sessionId}/${fileId}.png`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from('drawings')
            .upload(fileName, req.file.buffer, {
                contentType: 'image/png',
                upsert: false,
                cacheControl: '3600' // Cache for 1 hour
            });

        if (error) throw error;

        // Return proxied URL to avoid CORS issues
        const proxiedUrl = `/api/storage/image/drawings/${fileName}`;

        res.json({
            success: true,
            url: proxiedUrl,
            path: data.path
        });
    } catch (error) {
        console.error('Error uploading drawing:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to upload drawing',
            message: error.message
        });
    }
});

/**
 * POST /api/storage/upload-image
 * Upload an image to Supabase Storage (for pasted/toolbar images)
 */
router.post('/upload-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file provided'
            });
        }

        const { userId, sessionId } = req.body;
        const fileId = uuidv4();
        const fileExt = req.file.originalname?.split('.').pop() || 'png';
        const fileName = `${userId || 'anonymous'}/${sessionId}/${fileId}.${fileExt}`;

        // Upload to Supabase Storage (images bucket)
        const { data, error } = await supabase.storage
            .from('images')
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: false,
                cacheControl: '3600' // Cache for 1 hour
            });

        if (error) throw error;

        // Return proxied URL to avoid CORS issues
        const proxiedUrl = `/api/storage/image/images/${fileName}`;

        res.json({
            success: true,
            url: proxiedUrl,
            path: data.path,
            metadata: {
                name: req.file.originalname,
                type: req.file.mimetype,
                size: req.file.size
            }
        });
    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to upload image',
            message: error.message
        });
    }
});

/**
 * POST /api/storage/upload-attachment
 * Upload a file attachment to Supabase Storage
 */
router.post('/upload-attachment', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file provided'
            });
        }

        const { userId, sessionId } = req.body;
        const fileId = uuidv4();
        const fileExt = req.file.originalname.split('.').pop();
        const fileName = `${userId || 'anonymous'}/${sessionId}/${fileId}.${fileExt}`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from('attachments')
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: false,
                cacheControl: '3600' // Cache for 1 hour
            });

        if (error) throw error;

        // Return proxied URL to avoid CORS issues
        const proxiedUrl = `/api/storage/image/attachments/${fileName}`;

        res.json({
            success: true,
            url: proxiedUrl,
            path: data.path,
            metadata: {
                name: req.file.originalname,
                type: req.file.mimetype,
                size: req.file.size
            }
        });
    } catch (error) {
        console.error('Error uploading attachment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to upload attachment',
            message: error.message
        });
    }
});

/**
 * GET /api/storage/image/:bucket/:userId/:sessionId/:filename
 * Proxy images from Supabase Storage to avoid CORS issues
 */
router.get('/image/:bucket/:userId/:sessionId/:filename', async (req, res) => {
    try {
        // Extract bucket and path
        const { bucket, userId, sessionId, filename } = req.params;
        const filePath = `${userId}/${sessionId}/${filename}`;

        if (!['drawings', 'attachments', 'images'].includes(bucket)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid bucket name'
            });
        }

        // Download the file from Supabase Storage
        const { data, error } = await supabase.storage
            .from(bucket)
            .download(filePath);

        if (error) throw error;

        // Set appropriate headers
        res.setHeader('Content-Type', data.type || 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Access-Control-Allow-Origin', '*');

        // Convert blob to buffer and send
        const buffer = Buffer.from(await data.arrayBuffer());
        res.send(buffer);
    } catch (error) {
        console.error('Error proxying image:', error);
        res.status(404).json({
            success: false,
            error: 'Image not found',
            message: error.message
        });
    }
});

/**
 * DELETE /api/storage/delete
 * Delete a file from Supabase Storage
 * Expects: { bucket: string, path: string } in request body
 */
router.delete('/delete', async (req, res) => {
    try {
        const { bucket, path } = req.body;

        if (!bucket || !path) {
            return res.status(400).json({
                success: false,
                error: 'Missing bucket or path'
            });
        }

        if (!['drawings', 'attachments'].includes(bucket)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid bucket name'
            });
        }

        const { error } = await supabase.storage
            .from(bucket)
            .remove([path]);

        if (error) throw error;

        res.json({
            success: true,
            message: 'File deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete file',
            message: error.message
        });
    }
});

export default router;

