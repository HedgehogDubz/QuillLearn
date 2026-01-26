/**
 * Discover Routes
 *
 * Handles public content discovery, likes, and comments
 * Now uses the published_content table for all public content
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import User from '../models/User.js';

const router = express.Router();

/**
 * GET /api/discover
 * Get all public content from published_content table with sorting options
 */
router.get('/', async (req, res) => {
    try {
        const { sort = 'recent', type = 'all', limit = 20, offset = 0, search = '', tags = '' } = req.query;

        let query = supabase
            .from('published_content')
            .select('*')
            .eq('is_public', true);

        // Filter by content type
        if (type === 'sheets') {
            query = query.eq('content_type', 'sheet');
        } else if (type === 'notes') {
            query = query.eq('content_type', 'note');
        }

        // Apply search filter
        if (search) {
            query = query.ilike('title', `%${search}%`);
        }

        // Apply tag filter
        if (tags) {
            const tagList = tags.split(',').map(t => t.trim());
            query = query.contains('tags', tagList);
        }

        // Apply sorting
        switch (sort) {
            case 'popular':
                query = query.order('like_count', { ascending: false });
                break;
            case 'views':
                query = query.order('view_count', { ascending: false });
                break;
            case 'oldest':
                query = query.order('published_at', { ascending: true });
                break;
            case 'recent':
            default:
                query = query.order('published_at', { ascending: false });
                break;
        }

        // Apply pagination
        query = query.range(Number(offset), Number(offset) + Number(limit) - 1);

        const { data, error } = await query;
        if (error) throw error;

        // Get unique user IDs to look up avatars
        const userIds = [...new Set((data || []).map(item => item.user_id))];

        // Look up user avatars
        const userAvatars = {};
        for (const userId of userIds) {
            try {
                const user = await User.findById(userId);
                if (user) {
                    userAvatars[userId] = user.avatar || null;
                }
            } catch (e) {
                // Ignore lookup errors
            }
        }

        // Transform results for frontend compatibility
        const results = (data || []).map(item => ({
            id: item.id,
            session_id: item.original_session_id,
            title: item.title,
            description: item.description,
            type: item.content_type,
            user_id: item.user_id,
            like_count: item.like_count || 0,
            view_count: item.view_count || 0,
            tags: item.tags || [],
            published_at: item.published_at,
            updated_at: item.updated_at,
            content: item.content,
            user: {
                name: item.publisher_username,
                avatar: userAvatars[item.user_id] || null
            }
        }));

        res.json({
            success: true,
            data: results,
            total: results.length
        });
    } catch (error) {
        console.error('Error fetching public content:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch public content',
            message: error.message
        });
    }
});

/**
 * GET /api/discover/user/:userId
 * Get all published content by a specific user
 */
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const { data, error } = await supabase
            .from('published_content')
            .select('*')
            .eq('user_id', userId)
            .order('published_at', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            data: data || []
        });
    } catch (error) {
        console.error('Error fetching user published content:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user published content',
            message: error.message
        });
    }
});

/**
 * GET /api/discover/hot
 * Get HOT content - items with the most likes in the past 7 days
 */
router.get('/hot', async (req, res) => {
    try {
        const { type = 'all', limit = 10 } = req.query;
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        // Get likes from the past 7 days
        // content_id for published_content is the UUID id
        const { data: recentLikes, error: likesError } = await supabase
            .from('likes')
            .select('content_id')
            .gte('created_at', sevenDaysAgo);

        if (likesError) throw likesError;

        // Count likes per content
        const likeCounts = {};
        (recentLikes || []).forEach(like => {
            likeCounts[like.content_id] = (likeCounts[like.content_id] || 0) + 1;
        });

        // Get all public published content
        let query = supabase
            .from('published_content')
            .select('*')
            .eq('is_public', true);

        if (type === 'sheets') {
            query = query.eq('content_type', 'sheet');
        } else if (type === 'notes') {
            query = query.eq('content_type', 'note');
        }

        const { data: allContent, error: contentError } = await query;
        if (contentError) throw contentError;

        // Get unique user IDs to look up avatars
        const hotUserIds = [...new Set((allContent || []).map(item => item.user_id))];
        const hotUserAvatars = {};
        for (const userId of hotUserIds) {
            try {
                const user = await User.findById(userId);
                if (user) {
                    hotUserAvatars[userId] = user.avatar || null;
                }
            } catch (e) {
                // Ignore lookup errors
            }
        }

        // Add recent like counts and sort
        const hotItems = (allContent || [])
            .map(item => ({
                id: item.id,
                session_id: item.original_session_id,
                title: item.title,
                description: item.description,
                type: item.content_type,
                user_id: item.user_id,
                like_count: item.like_count || 0,
                view_count: item.view_count || 0,
                tags: item.tags || [],
                published_at: item.published_at,
                content: item.content,
                recentLikes: likeCounts[item.id] || 0,
                user: { name: item.publisher_username || 'Anonymous', avatar: hotUserAvatars[item.user_id] || null }
            }))
            .filter(item => item.recentLikes > 0)
            .sort((a, b) => b.recentLikes - a.recentLikes)
            .slice(0, Number(limit));

        res.json({
            success: true,
            data: hotItems
        });
    } catch (error) {
        console.error('Error fetching hot content:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch hot content',
            message: error.message
        });
    }
});

/**
 * GET /api/discover/content/:id
 * Get a specific published content by ID (increments view count)
 */
router.get('/content/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.query;

        const { data, error } = await supabase
            .from('published_content')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ success: false, error: 'Content not found' });
            }
            throw error;
        }

        // Check if public
        if (!data.is_public) {
            return res.status(403).json({ success: false, error: 'This content is not public' });
        }

        // Track unique views - only count once per user
        if (userId && data.user_id !== userId) {
            // Check if user has already viewed this content
            const { data: existingView } = await supabase
                .from('views')
                .select('id')
                .eq('user_id', userId)
                .eq('content_id', id)
                .single();

            if (!existingView) {
                // Insert view record
                await supabase.from('views').insert({
                    user_id: userId,
                    content_id: id
                });

                // Increment view count
                await supabase
                    .from('published_content')
                    .update({ view_count: (data.view_count || 0) + 1 })
                    .eq('id', id);
            }
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

        // Look up user avatar
        let userAvatar = null;
        try {
            const contentUser = await User.findById(data.user_id);
            if (contentUser) {
                userAvatar = contentUser.avatar || null;
            }
        } catch (e) {
            // Ignore lookup errors
        }

        res.json({
            success: true,
            data: {
                id: data.id,
                session_id: data.original_session_id,
                title: data.title,
                description: data.description,
                type: data.content_type,
                content: data.content,
                tags: data.tags || [],
                like_count: data.like_count || 0,
                view_count: data.view_count || 0,
                published_at: data.published_at,
                user_id: data.user_id,
                user: {
                    name: data.publisher_username || 'Anonymous',
                    avatar: userAvatar
                },
                hasLiked
            }
        });
    } catch (error) {
        console.error('Error fetching published content:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch content', message: error.message });
    }
});

/**
 * POST /api/discover/like
 * Like or unlike published content
 * Now uses published_content table - contentId is the published_content id
 */
router.post('/like', async (req, res) => {
    try {
        const { userId, contentId } = req.body;

        if (!userId || !contentId) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        // Check if already liked
        const { data: existingLike } = await supabase
            .from('likes')
            .select('id')
            .eq('user_id', userId)
            .eq('content_id', contentId)
            .single();

        if (existingLike) {
            // Unlike - remove the like
            const { error: deleteError } = await supabase
                .from('likes')
                .delete()
                .eq('id', existingLike.id);

            if (deleteError) throw deleteError;

            // Decrement like count atomically
            const { data: content } = await supabase
                .from('published_content')
                .select('like_count')
                .eq('id', contentId)
                .single();

            await supabase
                .from('published_content')
                .update({ like_count: Math.max(0, (content?.like_count || 1) - 1) })
                .eq('id', contentId);

            res.json({ success: true, liked: false });
        } else {
            // Like - try to insert (will fail if duplicate due to UNIQUE constraint)
            const { error: insertError } = await supabase.from('likes').insert({
                user_id: userId,
                content_type: 'published',
                content_id: contentId
            });

            // If insert failed due to duplicate, user already liked
            if (insertError) {
                console.error('Like insert error:', insertError.code, insertError.message);
                if (insertError.code === '23505') { // Unique violation
                    return res.json({ success: true, liked: true, message: 'Already liked' });
                }
                if (insertError.code === '23514') { // Check constraint violation
                    // The CHECK constraint doesn't allow 'published' - need to run migration
                    console.error('CHECK constraint violation - run update_likes_constraint.sql migration');
                }
                throw insertError;
            }

            // Increment like count
            const { data: content } = await supabase
                .from('published_content')
                .select('like_count')
                .eq('id', contentId)
                .single();

            await supabase
                .from('published_content')
                .update({ like_count: (content?.like_count || 0) + 1 })
                .eq('id', contentId);

            res.json({ success: true, liked: true });
        }
    } catch (error) {
        console.error('Error toggling like:', error);
        res.status(500).json({ success: false, error: 'Failed to toggle like', message: error.message });
    }
});

/**
 * GET /api/discover/comments/:contentId
 * Get comments for published content
 */
router.get('/comments/:contentId', async (req, res) => {
    try {
        const { contentId } = req.params;

        const { data, error } = await supabase
            .from('comments')
            .select('*')
            .eq('content_id', contentId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        res.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch comments', message: error.message });
    }
});

/**
 * POST /api/discover/comments
 * Add a comment to published content
 */
router.post('/comments', async (req, res) => {
    try {
        const { userId, userName, userAvatar, contentId, text } = req.body;

        if (!userId || !userName || !contentId || !text) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const { data, error } = await supabase
            .from('comments')
            .insert({
                user_id: userId,
                user_name: userName,
                user_avatar: userAvatar || null,
                content_type: 'published',
                content_id: contentId,
                text: text.trim()
            })
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ success: false, error: 'Failed to add comment', message: error.message });
    }
});

/**
 * DELETE /api/discover/comments/:commentId
 * Delete a comment (only by comment owner or content owner)
 */
router.delete('/comments/:commentId', async (req, res) => {
    try {
        const { commentId } = req.params;
        const { userId, contentOwnerId } = req.body;

        // Get the comment
        const { data: comment, error: fetchError } = await supabase
            .from('comments')
            .select('*')
            .eq('id', commentId)
            .single();

        if (fetchError || !comment) {
            return res.status(404).json({ success: false, error: 'Comment not found' });
        }

        // Check if user can delete (comment owner or content owner)
        if (comment.user_id !== userId && contentOwnerId !== userId) {
            return res.status(403).json({ success: false, error: 'Not authorized to delete this comment' });
        }

        const { error } = await supabase.from('comments').delete().eq('id', commentId);

        if (error) throw error;

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ success: false, error: 'Failed to delete comment', message: error.message });
    }
});

/**
 * GET /api/discover/tags
 * Get all unique tags from published content
 */
router.get('/tags', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('published_content')
            .select('tags')
            .eq('is_public', true);

        if (error) throw error;

        // Flatten and dedupe tags
        const allTags = new Set();
        (data || []).forEach(item => {
            (item.tags || []).forEach(tag => allTags.add(tag));
        });

        res.json({
            success: true,
            data: Array.from(allTags).sort()
        });
    } catch (error) {
        console.error('Error fetching tags:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch tags' });
    }
});

/**
 * POST /api/discover/copy/:id
 * Copy published content to user's library
 */
router.post('/copy/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, error: 'Must be logged in to copy content' });
        }

        // Fetch the published content
        const { data: published, error: fetchError } = await supabase
            .from('published_content')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !published) {
            return res.status(404).json({ success: false, error: 'Content not found' });
        }

        // Generate a new session ID for the copy
        const newSessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const copyTitle = `${published.title} (Copy)`;

        if (published.content_type === 'sheet') {
            // Copy as a sheet
            const content = published.content;
            const { error: insertError } = await supabase
                .from('sheets')
                .insert({
                    session_id: newSessionId,
                    user_id: userId,
                    title: copyTitle,
                    rows: content.rows || [],
                    column_widths: content.column_widths || [],
                    tags: published.tags || [],
                    last_time_saved: Date.now(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });

            if (insertError) throw insertError;

            res.json({
                success: true,
                message: 'Sheet copied to your library',
                sessionId: newSessionId,
                type: 'sheet'
            });
        } else {
            // Copy as a note
            const content = published.content;
            const { error: insertError } = await supabase
                .from('notes')
                .insert({
                    session_id: newSessionId,
                    user_id: userId,
                    title: copyTitle,
                    content: content.content || '',
                    delta: content.delta || null,
                    drawings: content.drawings || null,
                    attachments: content.attachments || null,
                    tags: published.tags || [],
                    last_time_saved: Date.now(),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });

            if (insertError) throw insertError;

            res.json({
                success: true,
                message: 'Note copied to your library',
                sessionId: newSessionId,
                type: 'note'
            });
        }
    } catch (error) {
        console.error('Error copying content:', error);
        res.status(500).json({ success: false, error: 'Failed to copy content', message: error.message });
    }
});

export default router;

