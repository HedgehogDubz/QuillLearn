/**
 * Sheets API Routes
 *
 * Handles CRUD operations for spreadsheet data
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { getUserPermission, PERMISSION_LEVELS } from '../middleware/permissions.js';
import User from '../models/User.js';

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
 * GET /api/sheets/:sessionId/permission/:userId
 * Get user's permission level for a specific sheet
 */
router.get('/:sessionId/permission/:userId', async (req, res) => {
    try {
        const { sessionId, userId } = req.params;

        const permission = await getUserPermission('sheets', sessionId, userId);

        res.json({
            success: true,
            permission: permission
        });
    } catch (error) {
        console.error('Error getting sheet permission:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get permission',
            message: error.message
        });
    }
});

/**
 * GET /api/sheets/user/:userId
 * Get all sheets for a user (owned + shared)
 */
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        // Get sheets owned by user
        const { data: ownedSheets, error: ownedError } = await supabase
            .from('sheets')
            .select('session_id, title, last_time_saved, created_at, rows, user_id, edit_users, view_users')
            .eq('user_id', userId)
            .order('last_time_saved', { ascending: false });

        if (ownedError) throw ownedError;

        // Get all sheets to filter for shared ones
        const { data: allSheets, error: allError } = await supabase
            .from('sheets')
            .select('session_id, title, last_time_saved, created_at, rows, user_id, edit_users, view_users')
            .order('last_time_saved', { ascending: false });

        if (allError) throw allError;

        // Filter sheets where user has edit or view access
        const sharedSheets = (allSheets || []).filter(sheet => {
            if (sheet.user_id === userId) return false; // Skip owned sheets
            return (sheet.edit_users && sheet.edit_users.includes(userId)) ||
                   (sheet.view_users && sheet.view_users.includes(userId));
        });

        // Combine and add permission info
        const allUserSheets = [
            ...(ownedSheets || []).map(sheet => ({
                ...sheet,
                permission: PERMISSION_LEVELS.OWNER
            })),
            ...sharedSheets.map(sheet => ({
                ...sheet,
                permission: sheet.edit_users && sheet.edit_users.includes(userId)
                    ? PERMISSION_LEVELS.EDIT
                    : PERMISSION_LEVELS.VIEW
            }))
        ];

        res.json({
            success: true,
            data: allUserSheets
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
 * POST /api/sheets/:sessionId/share
 * Manage sharing permissions for a sheet
 */
router.post('/:sessionId/share', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { userId, action, targetUser, permission } = req.body;

        // Validation
        if (!userId || !action || !targetUser) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userId, action, targetUser'
            });
        }

        // Look up target user by email or username to get their ID
        let targetUserId = targetUser;
        let targetUserInfo = null;

        // Try to find user by email first
        let user = await User.findByEmail(targetUser);

        // If not found by email, try username
        if (!user) {
            user = await User.findByUsername(targetUser);
        }

        // If not found by email or username, assume it's already a user ID
        if (!user) {
            user = await User.findById(targetUser);
        }

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found. Please check the email or username.'
            });
        }

        targetUserId = user.id;
        targetUserInfo = {
            id: user.id,
            email: user.email,
            username: user.username
        };

        // Get current sheet data
        const { data: sheet, error: fetchError } = await supabase
            .from('sheets')
            .select('user_id, edit_users, view_users')
            .eq('session_id', sessionId)
            .single();

        if (fetchError || !sheet) {
            return res.status(404).json({
                success: false,
                error: 'Sheet not found'
            });
        }

        // Check if user has permission to share
        const userPermission = await getUserPermission('sheets', sessionId, userId);
        if (userPermission === PERMISSION_LEVELS.NONE || userPermission === PERMISSION_LEVELS.VIEW) {
            return res.status(403).json({
                success: false,
                error: 'You do not have permission to share this sheet'
            });
        }

        let editUsers = sheet.edit_users || [];
        let viewUsers = sheet.view_users || [];

        if (action === 'add') {
            // Add user to appropriate permission list
            if (permission === 'edit') {
                if (!editUsers.includes(targetUserId)) {
                    editUsers.push(targetUserId);
                }
                // Remove from view if they were there
                viewUsers = viewUsers.filter(u => u !== targetUserId);
            } else if (permission === 'view') {
                if (!viewUsers.includes(targetUserId)) {
                    viewUsers.push(targetUserId);
                }
                // Remove from edit if they were there
                editUsers = editUsers.filter(u => u !== targetUserId);
            }
        } else if (action === 'remove') {
            // Remove user from both lists
            editUsers = editUsers.filter(u => u !== targetUserId);
            viewUsers = viewUsers.filter(u => u !== targetUserId);
        } else if (action === 'change') {
            // Change permission level
            if (permission === 'edit') {
                if (!editUsers.includes(targetUserId)) {
                    editUsers.push(targetUserId);
                }
                viewUsers = viewUsers.filter(u => u !== targetUserId);
            } else if (permission === 'view') {
                if (!viewUsers.includes(targetUserId)) {
                    viewUsers.push(targetUserId);
                }
                editUsers = editUsers.filter(u => u !== targetUserId);
            }
        }

        // Update the sheet
        const { error: updateError } = await supabase
            .from('sheets')
            .update({
                edit_users: editUsers,
                view_users: viewUsers
            })
            .eq('session_id', sessionId);

        if (updateError) throw updateError;

        res.json({
            success: true,
            message: 'Sharing permissions updated successfully',
            data: {
                edit_users: editUsers,
                view_users: viewUsers,
                added_user: targetUserInfo // Include user info in response
            }
        });
    } catch (error) {
        console.error('Error updating sharing permissions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update sharing permissions',
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

