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
                upsert: false
            });

        if (error) throw error;

        // Create a signed URL (expires in 24 hours)
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('drawings')
            .createSignedUrl(fileName, 86400); // 86400 seconds = 24 hours

        if (signedUrlError) throw signedUrlError;

        res.json({
            success: true,
            url: signedUrlData.signedUrl,
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
                upsert: false
            });

        if (error) throw error;

        // Create a signed URL (expires in 24 hours)
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('attachments')
            .createSignedUrl(fileName, 86400); // 86400 seconds = 24 hours

        if (signedUrlError) throw signedUrlError;

        res.json({
            success: true,
            url: signedUrlData.signedUrl,
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

