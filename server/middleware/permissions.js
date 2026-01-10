/**
 * Permission Middleware
 * Checks user permissions for documents
 */

import { supabase } from '../config/supabase.js';

/**
 * Permission levels
 */
export const PERMISSION_LEVELS = {
    OWNER: 'owner',
    EDIT: 'edit',
    VIEW: 'view',
    NONE: 'none'
};

/**
 * Get user's permission level for a document
 * @param {string} table - 'sheets' or 'notes'
 * @param {string} sessionId - Document session ID
 * @param {string} userId - User ID to check
 * @returns {Promise<string>} Permission level
 */
export async function getUserPermission(table, sessionId, userId) {
    try {
        const { data, error } = await supabase
            .from(table)
            .select('user_id, edit_users, view_users')
            .eq('session_id', sessionId)
            .single();

        if (error || !data) {
            return PERMISSION_LEVELS.NONE;
        }

        // Check if user is owner
        if (data.user_id === userId) {
            return PERMISSION_LEVELS.OWNER;
        }

        // Check if user has edit access
        if (data.edit_users && data.edit_users.includes(userId)) {
            return PERMISSION_LEVELS.EDIT;
        }

        // Check if user has view access
        if (data.view_users && data.view_users.includes(userId)) {
            return PERMISSION_LEVELS.VIEW;
        }

        return PERMISSION_LEVELS.NONE;
    } catch (error) {
        console.error('Error checking permissions:', error);
        return PERMISSION_LEVELS.NONE;
    }
}

/**
 * Middleware to check if user has at least view permission
 */
export function requireViewPermission(table) {
    return async (req, res, next) => {
        const { sessionId } = req.params;
        const userId = req.headers['x-user-id']; // You'll need to set this from your auth system

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        const permission = await getUserPermission(table, sessionId, userId);

        if (permission === PERMISSION_LEVELS.NONE) {
            return res.status(403).json({
                success: false,
                error: 'You do not have permission to access this document'
            });
        }

        req.userPermission = permission;
        req.userId = userId;
        next();
    };
}

/**
 * Middleware to check if user has edit permission
 */
export function requireEditPermission(table) {
    return async (req, res, next) => {
        const { sessionId } = req.params;
        const userId = req.headers['x-user-id'];

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        const permission = await getUserPermission(table, sessionId, userId);

        if (permission !== PERMISSION_LEVELS.OWNER && permission !== PERMISSION_LEVELS.EDIT) {
            return res.status(403).json({
                success: false,
                error: 'You do not have permission to edit this document'
            });
        }

        req.userPermission = permission;
        req.userId = userId;
        next();
    };
}

/**
 * Middleware to check if user is owner
 */
export function requireOwnerPermission(table) {
    return async (req, res, next) => {
        const { sessionId } = req.params;
        const userId = req.headers['x-user-id'];

        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        const permission = await getUserPermission(table, sessionId, userId);

        if (permission !== PERMISSION_LEVELS.OWNER) {
            return res.status(403).json({
                success: false,
                error: 'Only the owner can perform this action'
            });
        }

        req.userPermission = permission;
        req.userId = userId;
        next();
    };
}

