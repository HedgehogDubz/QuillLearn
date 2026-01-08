/**
 * Notes API Routes
 *
 * Handles CRUD operations for notes data
 */

import express from 'express';
import { supabase } from '../config/supabase.js';

const router = express.Router();

/**
 * GET /api/notes/:sessionId
 * Load note data by session ID
 */
router.get('/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const { data, error } = await supabase
            .from('notes')
            .select('*')
            .eq('session_id', sessionId)
            .single();

        if (error) {
            // If not found, return null (not an error)
            if (error.code === 'PGRST116') {
                return res.json({
                    success: true,
                    data: null
                });
            }
            throw error;
        }

        res.json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('Error loading note:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load note data',
            message: error.message
        });
    }
});

/**
 * POST /api/notes
 * Save or update note data
 */
router.post('/', async (req, res) => {
    try {
        const { sessionId, userId, title, content, delta, drawings, attachments } = req.body;

        // Validation
        if (!sessionId || !title || content === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: sessionId, title, content'
            });
        }

        // Check if note with this session_id already exists
        const { data: existing } = await supabase
            .from('notes')
            .select('id')
            .eq('session_id', sessionId)
            .single();

        const noteData = {
            session_id: sessionId,
            user_id: userId || null,
            title: title,
            content: content,
            delta: delta || null,
            drawings: drawings || null,
            attachments: attachments || null,
            last_time_saved: Date.now(),
            updated_at: new Date().toISOString()
        };

        let result;
        if (existing) {
            // Update existing note
            result = await supabase
                .from('notes')
                .update(noteData)
                .eq('session_id', sessionId)
                .select()
                .single();
        } else {
            // Insert new note
            result = await supabase
                .from('notes')
                .insert(noteData)
                .select()
                .single();
        }

        if (result.error) throw result.error;

        res.json({
            success: true,
            message: 'Note saved successfully',
            data: result.data
        });
    } catch (error) {
        console.error('Error saving note:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save note data',
            message: error.message
        });
    }
});

/**
 * GET /api/notes/user/:userId
 * Get all notes for a user
 */
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const { data, error } = await supabase
            .from('notes')
            .select('session_id, title, last_time_saved')
            .eq('user_id', userId)
            .order('last_time_saved', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            data: data || []
        });
    } catch (error) {
        console.error('Error fetching user notes:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user notes',
            message: error.message
        });
    }
});

/**
 * DELETE /api/notes/:sessionId
 * Delete a note
 */
router.delete('/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const { error } = await supabase
            .from('notes')
            .delete()
            .eq('session_id', sessionId);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Note deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting note:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete note',
            message: error.message
        });
    }
});

export default router;

