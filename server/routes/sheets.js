/**
 * Sheets API Routes
 *
 * Handles CRUD operations for spreadsheet data
 */

import express from 'express';
import { supabase } from '../config/supabase.js';

const router = express.Router();

/**
 * GET /api/sheets/:sessionId
 * Load sheet data by session ID
 */
router.get('/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const { data, error } = await supabase
            .from('sheets')
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
        console.error('Error loading sheet:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load sheet data',
            message: error.message
        });
    }
});

/**
 * POST /api/sheets
 * Save or update sheet data
 */
router.post('/', async (req, res) => {
    try {
        const { sessionId, userId, title, rows, columnWidths } = req.body;

        // Validation
        if (!sessionId || !title || !rows || !columnWidths) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: sessionId, title, rows, columnWidths'
            });
        }

        // Check if sheet with this session_id already exists
        const { data: existing } = await supabase
            .from('sheets')
            .select('id')
            .eq('session_id', sessionId)
            .single();

        const sheetData = {
            session_id: sessionId,
            user_id: userId || null,
            title: title,
            rows: rows,
            column_widths: columnWidths,
            last_time_saved: Date.now(),
            updated_at: new Date().toISOString()
        };

        let result;
        if (existing) {
            // Update existing sheet
            result = await supabase
                .from('sheets')
                .update(sheetData)
                .eq('session_id', sessionId)
                .select()
                .single();
        } else {
            // Insert new sheet
            result = await supabase
                .from('sheets')
                .insert(sheetData)
                .select()
                .single();
        }

        if (result.error) throw result.error;

        res.json({
            success: true,
            message: 'Sheet saved successfully',
            data: result.data
        });
    } catch (error) {
        console.error('Error saving sheet:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save sheet data',
            message: error.message
        });
    }
});

/**
 * GET /api/sheets/user/:userId
 * Get all sheets for a user
 */
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const { data, error } = await supabase
            .from('sheets')
            .select('session_id, title, last_time_saved')
            .eq('user_id', userId)
            .order('last_time_saved', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            data: data || []
        });
    } catch (error) {
        console.error('Error fetching user sheets:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user sheets',
            message: error.message
        });
    }
});

/**
 * DELETE /api/sheets/:sessionId
 * Delete a sheet
 */
router.delete('/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const { error } = await supabase
            .from('sheets')
            .delete()
            .eq('session_id', sessionId);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Sheet deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting sheet:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete sheet',
            message: error.message
        });
    }
});

export default router;

