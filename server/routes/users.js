/**
 * User Routes
 *
 * Handles user lookup and profile operations
 */

import express from 'express';
import User from '../models/User.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateUsername } from '../utils/auth.js';

const router = express.Router();

/**
 * GET /api/users/lookup?query=email_or_username
 * Look up a user by email or username
 * Returns user info without password
 */
router.get('/lookup', async (req, res) => {
    try {
        const { query } = req.query;

        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query parameter is required'
            });
        }

        // Try to find by email first
        let user = await User.findByEmail(query);
        
        // If not found by email, try username
        if (!user) {
            user = await User.findByUsername(query);
        }

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;

        res.json({
            success: true,
            user: userWithoutPassword
        });

    } catch (error) {
        console.error('User lookup error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error during user lookup'
        });
    }
});

/**
 * GET /api/users/:userId
 * Get user profile by ID
 */
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;

        res.json({
            success: true,
            user: userWithoutPassword
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

/**
 * PUT /api/users/:userId
 * Update user profile (username and/or avatar)
 * Requires authentication and can only update own profile
 */
router.put('/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const { username, avatar } = req.body;

        // Users can only update their own profile
        if (req.user.id !== userId) {
            return res.status(403).json({
                success: false,
                error: 'You can only update your own profile'
            });
        }

        const updates = {};

        // Validate and add username if provided
        if (username !== undefined) {
            const usernameValidation = validateUsername(username);
            if (!usernameValidation.valid) {
                return res.status(400).json({
                    success: false,
                    error: usernameValidation.message
                });
            }

            // Check if username is already taken by another user
            const existingUser = await User.findByUsername(username);
            if (existingUser && existingUser.id !== userId) {
                return res.status(400).json({
                    success: false,
                    error: 'Username is already taken'
                });
            }

            updates.username = username;
        }

        // Add avatar if provided (should be JSON string of pixel art grid)
        if (avatar !== undefined) {
            // Basic validation: should be a valid JSON string
            try {
                const parsed = JSON.parse(avatar);
                if (!Array.isArray(parsed) || parsed.length !== 10) {
                    return res.status(400).json({
                        success: false,
                        error: 'Avatar must be a 10x10 pixel grid'
                    });
                }
            } catch {
                return res.status(400).json({
                    success: false,
                    error: 'Avatar must be valid JSON'
                });
            }
            updates.avatar = avatar;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid fields to update'
            });
        }

        const updatedUser = await User.update(userId, updates);

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Remove password from response
        const { password: _, ...userWithoutPassword } = updatedUser;

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: userWithoutPassword
        });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error during profile update'
        });
    }
});

export default router;

