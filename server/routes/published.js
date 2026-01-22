/**
 * Published Content Routes
 *
 * Handles publishing, managing, and retrieving published content
 */

import express from 'express';
import { supabase } from '../config/supabase.js';

const router = express.Router();

/**
 * GET /api/published
 * Get all published content for the current user
 */
router.get('/', async (req, res) => {
    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ success: false, error: 'User ID required' });
        }

        const { data, error } = await supabase
            .from('published_content')
            .select('*')
            .eq('user_id', userId)
            .order('published_at', { ascending: false });

        if (error) throw error;

        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Error fetching published content:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch published content' });
    }
});

/**
 * POST /api/published/:contentType/:sessionId
 * Publish or update a note/sheet
 */
router.post('/:contentType/:sessionId', async (req, res) => {
    try {
        const { contentType, sessionId } = req.params;
        const { userId, username, description, tags } = req.body;

        if (!['sheet', 'note'].includes(contentType)) {
            return res.status(400).json({ success: false, error: 'Invalid content type' });
        }

        if (!userId) {
            return res.status(400).json({ success: false, error: 'User ID required' });
        }

        // Fetch the original content
        const table = contentType === 'sheet' ? 'sheets' : 'notes';
        const { data: original, error: fetchError } = await supabase
            .from(table)
            .select('*')
            .eq('session_id', sessionId)
            .single();

        if (fetchError || !original) {
            return res.status(404).json({ success: false, error: `${contentType} not found` });
        }

        // Check ownership
        if (original.user_id !== userId) {
            return res.status(403).json({ success: false, error: 'Only the owner can publish' });
        }

        // Prepare content snapshot
        let contentSnapshot;
        if (contentType === 'sheet') {
            contentSnapshot = {
                rows: original.rows,
                column_widths: original.column_widths
            };
        } else {
            contentSnapshot = {
                content: original.content
            };
        }

        // Check if already published
        const { data: existing } = await supabase
            .from('published_content')
            .select('id')
            .eq('original_session_id', sessionId)
            .eq('content_type', contentType)
            .single();

        if (existing) {
            // Update existing published content
            const { error: updateError } = await supabase
                .from('published_content')
                .update({
                    title: original.title,
                    description: description || original.description || '',
                    tags: tags || original.tags || [],
                    content: contentSnapshot,
                    publisher_username: username || 'Anonymous',
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id);

            if (updateError) throw updateError;

            res.json({
                success: true,
                message: 'Published content updated',
                publishedId: existing.id
            });
        } else {
            // Create new published content
            const { data: newPublished, error: insertError } = await supabase
                .from('published_content')
                .insert({
                    original_session_id: sessionId,
                    content_type: contentType,
                    user_id: userId,
                    publisher_username: username || 'Anonymous',
                    title: original.title,
                    description: description || '',
                    tags: tags || original.tags || [],
                    content: contentSnapshot,
                    is_public: true
                })
                .select('id')
                .single();

            if (insertError) throw insertError;

            res.json({
                success: true,
                message: 'Content published to Discover',
                publishedId: newPublished.id
            });
        }
    } catch (error) {
        console.error('Error publishing content:', error);
        res.status(500).json({ success: false, error: 'Failed to publish', message: error.message });
    }
});

/**
 * PATCH /api/published/:id
 * Update published content (visibility, description, tags)
 */
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, isPublic, description, tags } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, error: 'User ID required' });
        }

        // Check ownership
        const { data: published, error: fetchError } = await supabase
            .from('published_content')
            .select('user_id')
            .eq('id', id)
            .single();

        if (fetchError || !published) {
            return res.status(404).json({ success: false, error: 'Published content not found' });
        }

        if (published.user_id !== userId) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }

        // Build update object
        const updates = { updated_at: new Date().toISOString() };
        if (typeof isPublic === 'boolean') updates.is_public = isPublic;
        if (description !== undefined) updates.description = description;
        if (tags !== undefined) updates.tags = tags;

        const { error: updateError } = await supabase
            .from('published_content')
            .update(updates)
            .eq('id', id);

        if (updateError) throw updateError;

        res.json({ success: true, message: 'Updated successfully' });
    } catch (error) {
        console.error('Error updating published content:', error);
        res.status(500).json({ success: false, error: 'Failed to update' });
    }
});

/**
 * DELETE /api/published/:id
 * Delete published content
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({ success: false, error: 'User ID required' });
        }

        // Check ownership
        const { data: published, error: fetchError } = await supabase
            .from('published_content')
            .select('user_id')
            .eq('id', id)
            .single();

        if (fetchError || !published) {
            return res.status(404).json({ success: false, error: 'Published content not found' });
        }

        if (published.user_id !== userId) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }

        // Delete associated likes first
        await supabase
            .from('likes')
            .delete()
            .eq('content_id', id);

        // Delete the published content
        const { error: deleteError } = await supabase
            .from('published_content')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        res.json({ success: true, message: 'Deleted successfully' });
    } catch (error) {
        console.error('Error deleting published content:', error);
        res.status(500).json({ success: false, error: 'Failed to delete' });
    }
});

/**
 * GET /api/published/status/:contentType/:sessionId
 * Check if content is published and get its info
 */
router.get('/status/:contentType/:sessionId', async (req, res) => {
    try {
        const { contentType, sessionId } = req.params;

        const { data, error } = await supabase
            .from('published_content')
            .select('*')
            .eq('original_session_id', sessionId)
            .eq('content_type', contentType)
            .single();

        if (error || !data) {
            return res.json({ success: true, data: null });
        }

        res.json({ success: true, data });
    } catch (error) {
        console.error('Error checking publish status:', error);
        res.status(500).json({ success: false, error: 'Failed to check status' });
    }
});

/**
 * GET /api/published/:id
 * Get a specific published content by ID
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.query;

        const { data, error } = await supabase
            .from('published_content')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            return res.status(404).json({ success: false, error: 'Not found' });
        }

        // Check if public or user is owner
        if (!data.is_public && data.user_id !== userId) {
            return res.status(403).json({ success: false, error: 'This content is not public' });
        }

        // Increment view count (don't increment for owner)
        if (data.user_id !== userId) {
            await supabase
                .from('published_content')
                .update({ view_count: (data.view_count || 0) + 1 })
                .eq('id', id);
        }

        // Check if current user has liked this
        let hasLiked = false;
        if (userId) {
            const { data: likeData } = await supabase
                .from('likes')
                .select('id')
                .eq('user_id', userId)
                .eq('content_id', id)
                .single();
            hasLiked = !!likeData;
        }

        res.json({
            success: true,
            data: { ...data, hasLiked }
        });
    } catch (error) {
        console.error('Error fetching published content:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch' });
    }
});

/**
 * POST /api/published/:id/republish
 * Update the snapshot with latest content from original
 */
router.post('/:id/republish', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, username } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, error: 'User ID required' });
        }

        // Get published content
        const { data: published, error: fetchError } = await supabase
            .from('published_content')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !published) {
            return res.status(404).json({ success: false, error: 'Published content not found' });
        }

        if (published.user_id !== userId) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }

        // Fetch latest original content
        const table = published.content_type === 'sheet' ? 'sheets' : 'notes';
        const { data: original, error: origError } = await supabase
            .from(table)
            .select('*')
            .eq('session_id', published.original_session_id)
            .single();

        if (origError || !original) {
            return res.status(404).json({ success: false, error: 'Original content not found' });
        }

        // Prepare updated snapshot
        let contentSnapshot;
        if (published.content_type === 'sheet') {
            contentSnapshot = {
                rows: original.rows,
                column_widths: original.column_widths
            };
        } else {
            contentSnapshot = {
                content: original.content
            };
        }

        // Update published content
        const { error: updateError } = await supabase
            .from('published_content')
            .update({
                title: original.title,
                tags: original.tags || [],
                content: contentSnapshot,
                publisher_username: username || published.publisher_username,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (updateError) throw updateError;

        res.json({ success: true, message: 'Content republished with latest changes' });
    } catch (error) {
        console.error('Error republishing:', error);
        res.status(500).json({ success: false, error: 'Failed to republish' });
    }
});

export default router;
