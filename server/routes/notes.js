/**
 * Notes API Routes
 *
 * Handles CRUD operations for notes data
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { getUserPermission, PERMISSION_LEVELS } from '../middleware/permissions.js';

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
            .select('session_id, title, last_time_saved, created_at, content, user_id, edit_users, view_users, tags')
            .eq('user_id', userId)
            .order('last_time_saved', { ascending: false });

        if (ownedError) throw ownedError;

        // Get all notes to filter for shared ones
        const { data: allNotes, error: allError } = await supabase
            .from('notes')
            .select('session_id, title, last_time_saved, created_at, content, user_id, edit_users, view_users, tags')
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
 * DELETE /api/notes/:sessionId
 * Delete a note (also unpublishes if published)
 */
router.delete('/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        // First, check if this note is published and delete the published version
        const { data: published } = await supabase
            .from('published_content')
            .select('id')
            .eq('original_session_id', sessionId)
            .eq('content_type', 'note')
            .single();

        if (published) {
            // Delete associated likes first
            await supabase
                .from('likes')
                .delete()
                .eq('content_id', published.id);

            // Delete the published content
            await supabase
                .from('published_content')
                .delete()
                .eq('id', published.id);
        }

        // Now delete the note itself
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

/**
 * PUT /api/notes/:sessionId/tags
 * Update tags for a note
 */
router.put('/:sessionId/tags', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { tags, userId } = req.body;

        if (!Array.isArray(tags)) {
            return res.status(400).json({
                success: false,
                error: 'Tags must be an array'
            });
        }

        // Check user permission
        if (userId) {
            const userPermission = await getUserPermission('notes', sessionId, userId);
            if (userPermission === PERMISSION_LEVELS.VIEW || userPermission === PERMISSION_LEVELS.NONE) {
                return res.status(403).json({
                    success: false,
                    error: 'You do not have permission to edit tags for this note.'
                });
            }
        }

        const { data, error } = await supabase
            .from('notes')
            .update({ tags, updated_at: new Date().toISOString() })
            .eq('session_id', sessionId)
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Tags updated successfully',
            data: data
        });
    } catch (error) {
        console.error('Error updating tags:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update tags',
            message: error.message
        });
    }
});

/**
 * GET /api/notes/tags/all/:userId
 * Get all unique tags used by a user across all their notes
 */
router.get('/tags/all/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const { data, error } = await supabase
            .from('notes')
            .select('tags')
            .eq('user_id', userId);

        if (error) throw error;

        // Extract unique tags from all notes
        const allTags = new Set();
        data?.forEach(note => {
            if (note.tags && Array.isArray(note.tags)) {
                note.tags.forEach(tag => allTags.add(tag));
            }
        });

        res.json({
            success: true,
            data: Array.from(allTags).sort()
        });
    } catch (error) {
        console.error('Error fetching tags:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch tags',
            message: error.message
        });
    }
});

/**
 * POST /api/notes/:sessionId/public
 * Publish a note - creates a snapshot copy that's publicly visible
 */
router.post('/:sessionId/public', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { userId, username, isPublic, description } = req.body;

        if (!userId || typeof isPublic !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userId, isPublic'
            });
        }

        // Verify ownership
        const { data: note, error: fetchError } = await supabase
            .from('notes')
            .select('*')
            .eq('session_id', sessionId)
            .single();

        if (fetchError || !note) {
            return res.status(404).json({ success: false, error: 'Note not found' });
        }

        if (note.user_id !== userId) {
            return res.status(403).json({ success: false, error: 'Only the owner can publish this note' });
        }

        if (isPublic) {
            // Check if there's already a published snapshot for this note
            const { data: existingSnapshot } = await supabase
                .from('notes')
                .select('session_id, published_at')
                .eq('original_session_id', sessionId)
                .eq('is_snapshot', true)
                .single();

            if (existingSnapshot) {
                // Update existing snapshot with current content
                const { error: updateError } = await supabase
                    .from('notes')
                    .update({
                        title: note.title,
                        content: note.content,
                        delta: note.delta,
                        drawings: note.drawings,
                        attachments: note.attachments,
                        tags: note.tags,
                        description: description || note.description,
                        is_public: true,
                        updated_at: new Date().toISOString()
                        // Don't update published_at - keep original
                    })
                    .eq('session_id', existingSnapshot.session_id);

                if (updateError) throw updateError;

                // Mark original as having a published version
                await supabase
                    .from('notes')
                    .update({ is_public: true })
                    .eq('session_id', sessionId);

                res.json({
                    success: true,
                    isPublic: true,
                    snapshotId: existingSnapshot.session_id,
                    message: 'Published note updated'
                });
            } else {
                // Create new snapshot
                const snapshotId = `${sessionId}-pub-${Date.now()}`;
                const { error: insertError } = await supabase
                    .from('notes')
                    .insert({
                        session_id: snapshotId,
                        user_id: userId,
                        title: note.title,
                        content: note.content,
                        delta: note.delta,
                        drawings: note.drawings,
                        attachments: note.attachments,
                        tags: note.tags,
                        description: description || '',
                        is_public: true,
                        is_snapshot: true,
                        original_session_id: sessionId,
                        publisher_username: username || 'Anonymous',
                        publisher_user_id: userId,
                        published_at: new Date().toISOString(),
                        like_count: 0,
                        view_count: 0,
                        last_time_saved: Date.now(),
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });

                if (insertError) throw insertError;

                // Mark original as having a published version
                await supabase
                    .from('notes')
                    .update({ is_public: true })
                    .eq('session_id', sessionId);

                res.json({
                    success: true,
                    isPublic: true,
                    snapshotId,
                    message: 'Note published to Discover'
                });
            }
        } else {
            // Unpublish - delete the snapshot
            const { data: snapshot } = await supabase
                .from('notes')
                .select('session_id')
                .eq('original_session_id', sessionId)
                .eq('is_snapshot', true)
                .single();

            if (snapshot) {
                await supabase
                    .from('notes')
                    .delete()
                    .eq('session_id', snapshot.session_id);
            }

            // Mark original as not public
            await supabase
                .from('notes')
                .update({ is_public: false })
                .eq('session_id', sessionId);

            res.json({ success: true, isPublic: false, message: 'Note unpublished' });
        }
    } catch (error) {
        console.error('Error publishing note:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to publish note',
            message: error.message
        });
    }
});

/**
 * PATCH /api/notes/:sessionId/public-description
 * Update the description for a published note
 */
router.patch('/:sessionId/public-description', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { userId, description } = req.body;

        // Find the snapshot
        const { data: snapshot } = await supabase
            .from('notes')
            .select('session_id, user_id')
            .eq('original_session_id', sessionId)
            .eq('is_snapshot', true)
            .single();

        if (!snapshot) {
            return res.status(404).json({ success: false, error: 'No published version found' });
        }

        if (snapshot.user_id !== userId) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }

        await supabase
            .from('notes')
            .update({ description })
            .eq('session_id', snapshot.session_id);

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating description:', error);
        res.status(500).json({ success: false, error: 'Failed to update description' });
    }
});

export default router;

