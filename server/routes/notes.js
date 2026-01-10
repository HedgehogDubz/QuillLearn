/**
 * Notes API Routes
 *
 * Handles CRUD operations for notes data
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { getUserPermission, PERMISSION_LEVELS } from '../middleware/permissions.js';
import User from '../models/User.js';

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

        // If note exists, check if user has edit permission
        if (existing && userId) {
            const userPermission = await getUserPermission('notes', sessionId, userId);

            // Only allow edit if user is owner or has edit permission
            if (userPermission === PERMISSION_LEVELS.VIEW) {
                return res.status(403).json({
                    success: false,
                    error: 'You only have view access to this note. Cannot save changes.'
                });
            }

            if (userPermission === PERMISSION_LEVELS.NONE) {
                return res.status(403).json({
                    success: false,
                    error: 'You do not have permission to edit this note.'
                });
            }
        }

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
 * GET /api/notes/:sessionId/permission/:userId
 * Get user's permission level for a specific note
 */
router.get('/:sessionId/permission/:userId', async (req, res) => {
    try {
        const { sessionId, userId } = req.params;

        const permission = await getUserPermission('notes', sessionId, userId);

        res.json({
            success: true,
            permission: permission
        });
    } catch (error) {
        console.error('Error getting note permission:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get permission',
            message: error.message
        });
    }
});

/**
 * GET /api/notes/user/:userId
 * Get all notes for a user (owned + shared)
 */
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        // Get notes owned by user
        const { data: ownedNotes, error: ownedError } = await supabase
            .from('notes')
            .select('session_id, title, last_time_saved, created_at, content, user_id, edit_users, view_users')
            .eq('user_id', userId)
            .order('last_time_saved', { ascending: false });

        if (ownedError) throw ownedError;

        // Get all notes to filter for shared ones
        const { data: allNotes, error: allError } = await supabase
            .from('notes')
            .select('session_id, title, last_time_saved, created_at, content, user_id, edit_users, view_users')
            .order('last_time_saved', { ascending: false });

        if (allError) throw allError;

        // Filter notes where user has edit or view access
        const sharedNotes = (allNotes || []).filter(note => {
            if (note.user_id === userId) return false; // Skip owned notes
            return (note.edit_users && note.edit_users.includes(userId)) ||
                   (note.view_users && note.view_users.includes(userId));
        });

        // Combine and add permission info
        const allUserNotes = [
            ...(ownedNotes || []).map(note => ({
                ...note,
                permission: PERMISSION_LEVELS.OWNER
            })),
            ...sharedNotes.map(note => ({
                ...note,
                permission: note.edit_users && note.edit_users.includes(userId)
                    ? PERMISSION_LEVELS.EDIT
                    : PERMISSION_LEVELS.VIEW
            }))
        ];

        res.json({
            success: true,
            data: allUserNotes
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
 * POST /api/notes/:sessionId/share
 * Manage sharing permissions for a note
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

        // Get current note data
        const { data: note, error: fetchError } = await supabase
            .from('notes')
            .select('user_id, edit_users, view_users')
            .eq('session_id', sessionId)
            .single();

        if (fetchError || !note) {
            return res.status(404).json({
                success: false,
                error: 'Note not found'
            });
        }

        // Check if user has permission to share
        const userPermission = await getUserPermission('notes', sessionId, userId);
        if (userPermission === PERMISSION_LEVELS.NONE || userPermission === PERMISSION_LEVELS.VIEW) {
            return res.status(403).json({
                success: false,
                error: 'You do not have permission to share this note'
            });
        }

        let editUsers = note.edit_users || [];
        let viewUsers = note.view_users || [];

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

        // Update the note
        const { error: updateError } = await supabase
            .from('notes')
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

