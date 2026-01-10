/**
 * User Routes
 * 
 * Handles user lookup and profile operations
 */

import express from 'express';
import User from '../models/User.js';

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

export default router;

