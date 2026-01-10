/**
 * Presence API Routes
 * Handles real-time presence tracking for collaborative editing
 */

import express from 'express';
import { supabase } from '../config/supabase.js';

const router = express.Router();

/**
 * POST /api/presence/:sessionId
 * Update user presence for a document
 */
router.post('/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { documentType, userId, userName, userEmail, cursorPosition } = req.body;

        if (!documentType || !userId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: documentType, userId'
            });
        }

        // Upsert presence record
        const { error } = await supabase
            .from('document_presence')
            .upsert({
                session_id: sessionId,
                document_type: documentType,
                user_id: userId,
                user_name: userName,
                user_email: userEmail,
                cursor_position: cursorPosition,
                last_seen: new Date().toISOString()
            }, {
                onConflict: 'session_id,document_type,user_id'
            });

        if (error) throw error;

        res.json({
            success: true,
            message: 'Presence updated successfully'
        });
    } catch (error) {
        console.error('Error updating presence:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update presence',
            message: error.message
        });
    }
});

/**
 * GET /api/presence/:sessionId
 * Get all active users for a document
 */
router.get('/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { documentType } = req.query;

        if (!documentType) {
            return res.status(400).json({
                success: false,
                error: 'Missing required query parameter: documentType'
            });
        }

        // Get presence records updated in the last 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

        const { data, error } = await supabase
            .from('document_presence')
            .select('*')
            .eq('session_id', sessionId)
            .eq('document_type', documentType)
            .gte('last_seen', fiveMinutesAgo)
            .order('last_seen', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            data: data || []
        });
    } catch (error) {
        console.error('Error fetching presence:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch presence',
            message: error.message
        });
    }
});

/**
 * DELETE /api/presence/:sessionId
 * Remove user presence when they leave
 */
router.delete('/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { documentType, userId } = req.body;

        if (!documentType || !userId) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: documentType, userId'
            });
        }

        const { error } = await supabase
            .from('document_presence')
            .delete()
            .eq('session_id', sessionId)
            .eq('document_type', documentType)
            .eq('user_id', userId);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Presence removed successfully'
        });
    } catch (error) {
        console.error('Error removing presence:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove presence',
            message: error.message
        });
    }
});

/**
 * POST /api/presence/cleanup
 * Clean up stale presence records (older than 5 minutes)
 */
router.post('/cleanup', async (req, res) => {
    try {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

        const { error } = await supabase
            .from('document_presence')
            .delete()
            .lt('last_seen', fiveMinutesAgo);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Stale presence records cleaned up'
        });
    } catch (error) {
        console.error('Error cleaning up presence:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to clean up presence',
            message: error.message
        });
    }
});

export default router;

