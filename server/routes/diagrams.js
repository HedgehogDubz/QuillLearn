/**
 * Diagrams API Routes
 *
 * Handles CRUD operations for diagram-based learning content
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { getUserPermission, PERMISSION_LEVELS } from '../middleware/permissions.js';

const router = express.Router();

/**
 * POST /api/diagrams
 * Save or update diagram data
 * NOTE: POST routes should come before parameterized GET routes
 */
router.post('/', async (req, res) => {
    try {
        const { sessionId, userId, title, cards, tags, description, defaultLabelColor } = req.body;

        // Validation
        if (!sessionId || !title) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: sessionId, title'
            });
        }

        // Check if diagram with this session_id already exists
        const { data: existing } = await supabase
            .from('diagrams')
            .select('id')
            .eq('session_id', sessionId)
            .single();

        // If diagram exists, check if user has edit permission
        if (existing && userId) {
            const userPermission = await getUserPermission('diagrams', sessionId, userId);

            if (userPermission === PERMISSION_LEVELS.VIEW) {
                return res.status(403).json({
                    success: false,
                    error: 'You only have view access to this diagram. Cannot save changes.'
                });
            }

            if (userPermission === PERMISSION_LEVELS.NONE) {
                return res.status(403).json({
                    success: false,
                    error: 'You do not have permission to edit this diagram.'
                });
            }
        }

        const diagramData = {
            session_id: sessionId,
            user_id: userId || null,
            title: title,
            cards: cards || [],
            tags: tags || [],
            description: description || '',
            last_time_saved: Date.now(),
            updated_at: new Date().toISOString()
        };

        let result;
        if (existing) {
            // Update existing diagram
            result = await supabase
                .from('diagrams')
                .update(diagramData)
                .eq('session_id', sessionId)
                .select()
                .single();
        } else {
            // Insert new diagram
            result = await supabase
                .from('diagrams')
                .insert(diagramData)
                .select()
                .single();
        }

        if (result.error) throw result.error;

        res.json({
            success: true,
            message: 'Diagram saved successfully',
            data: result.data
        });
    } catch (error) {
        console.error('Error saving diagram:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save diagram data',
            message: error.message
        });
    }
});

/**
 * GET /api/diagrams/user/:userId
 * Get all diagrams for a user (owned + shared)
 * Query params:
 *   - includeCards=true: Include cards data (needed for label counting)
 * NOTE: This route MUST come before /:sessionId routes to avoid "user" being matched as sessionId
 */
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const includeCards = req.query.includeCards === 'true';

        console.log(`[diagrams/user] Fetching diagrams for userId: ${userId}`);

        // Build select query - include cards only when requested
        const selectFields = includeCards
            ? 'session_id, title, last_time_saved, created_at, cards, user_id, edit_users, view_users, tags'
            : 'session_id, title, last_time_saved, created_at, user_id, edit_users, view_users, tags';

        // Get diagrams owned by user
        const { data: ownedDiagrams, error: ownedError } = await supabase
            .from('diagrams')
            .select(selectFields)
            .eq('user_id', userId)
            .order('last_time_saved', { ascending: false });

        if (ownedError) throw ownedError;

        // Get all diagrams to filter for shared ones
        const { data: allDiagrams, error: allError } = await supabase
            .from('diagrams')
            .select(selectFields)
            .order('last_time_saved', { ascending: false });

        if (allError) throw allError;

        // Filter diagrams where user has edit or view access
        const sharedDiagrams = (allDiagrams || []).filter(diagram => {
            if (diagram.user_id === userId) return false; // Skip owned diagrams
            return (diagram.edit_users && diagram.edit_users.includes(userId)) ||
                   (diagram.view_users && diagram.view_users.includes(userId));
        });

        // Combine and add permission info
        const allUserDiagrams = [
            ...(ownedDiagrams || []).map(diagram => ({
                ...diagram,
                permission: PERMISSION_LEVELS.OWNER
            })),
            ...sharedDiagrams.map(diagram => ({
                ...diagram,
                permission: diagram.edit_users && diagram.edit_users.includes(userId)
                    ? PERMISSION_LEVELS.EDIT
                    : PERMISSION_LEVELS.VIEW
            }))
        ];

        console.log(`[diagrams/user] Returning ${allUserDiagrams.length} diagrams`);
        if (allUserDiagrams.length > 0) {
            console.log(`[diagrams/user] First diagram tags:`, allUserDiagrams[0].tags);
        }

        res.json({
            success: true,
            data: allUserDiagrams
        });
    } catch (error) {
        console.error('Error fetching user diagrams:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user diagrams',
            message: error.message
        });
    }
});

/**
 * GET /api/diagrams/tags/all/:userId
 * Get all unique tags used by a user across all their diagrams
 * NOTE: This route MUST come before /:sessionId routes to avoid "tags" being matched as sessionId
 */
router.get('/tags/all/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const { data, error } = await supabase
            .from('diagrams')
            .select('tags')
            .eq('user_id', userId);

        if (error) throw error;

        // Extract unique tags from all diagrams
        const allTags = new Set();
        data?.forEach(diagram => {
            if (diagram.tags && Array.isArray(diagram.tags)) {
                diagram.tags.forEach(tag => allTags.add(tag));
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
 * GET /api/diagrams/:sessionId/permission/:userId
 * Get user's permission level for a specific diagram
 */
router.get('/:sessionId/permission/:userId', async (req, res) => {
    try {
        const { sessionId, userId } = req.params;

        console.log(`Permission check requested: sessionId=${sessionId}, userId=${userId}`);
        const permission = await getUserPermission('diagrams', sessionId, userId);
        console.log(`Permission result: ${permission}`);

        res.json({
            success: true,
            permission: permission
        });
    } catch (error) {
        console.error('Error getting diagram permission:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get permission',
            message: error.message
        });
    }
});

/**
 * DELETE /api/diagrams/:sessionId
 * Delete a diagram
 */
router.delete('/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const { error } = await supabase
            .from('diagrams')
            .delete()
            .eq('session_id', sessionId);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Diagram deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting diagram:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete diagram',
            message: error.message
        });
    }
});

/**
 * PUT /api/diagrams/:sessionId/tags
 * Update tags for a diagram
 */
router.put('/:sessionId/tags', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { tags, userId } = req.body;

        console.log(`[diagrams/tags] PUT request for sessionId: ${sessionId}, tags:`, tags);

        if (!Array.isArray(tags)) {
            return res.status(400).json({
                success: false,
                error: 'Tags must be an array'
            });
        }

        // Check user permission
        if (userId) {
            const userPermission = await getUserPermission('diagrams', sessionId, userId);
            if (userPermission === PERMISSION_LEVELS.VIEW || userPermission === PERMISSION_LEVELS.NONE) {
                return res.status(403).json({
                    success: false,
                    error: 'You do not have permission to edit tags for this diagram.'
                });
            }
        }

        const { data, error } = await supabase
            .from('diagrams')
            .update({ tags, updated_at: new Date().toISOString() })
            .eq('session_id', sessionId)
            .select()
            .single();

        if (error) throw error;

        console.log(`[diagrams/tags] Tags updated successfully for sessionId: ${sessionId}, result:`, data?.tags);

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
 * GET /api/diagrams/:sessionId
 * Load diagram data by session ID
 * NOTE: This generic parameterized route should come AFTER specific routes like /user/:userId
 */
router.get('/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const { data, error } = await supabase
            .from('diagrams')
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

        // If diagram has no tags, check published_content for tags
        if (data && (!data.tags || data.tags.length === 0)) {
            const { data: publishedData } = await supabase
                .from('published_content')
                .select('tags')
                .eq('original_session_id', sessionId)
                .single();

            if (publishedData?.tags?.length > 0) {
                data.tags = publishedData.tags;
            }
        }

        res.json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('Error loading diagram:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load diagram data',
            message: error.message
        });
    }
});

export default router;

