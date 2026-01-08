/**
 * Authentication Routes
 * 
 * Handles user registration, login, and logout
 */

import express from 'express';
import User from '../models/User.js';
import { 
    hashPassword, 
    comparePassword, 
    generateToken,
    isValidEmail,
    validatePassword,
    validateUsername
} from '../utils/auth.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user account
 */
router.post('/register', async (req, res) => {
    try {
        const { email, username, password } = req.body;
        
        // Validate required fields
        if (!email || !username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email, username, and password are required'
            });
        }
        
        // Validate email format
        if (!isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }
        
        // Validate username
        const usernameValidation = validateUsername(username);
        if (!usernameValidation.valid) {
            return res.status(400).json({
                success: false,
                error: usernameValidation.message
            });
        }
        
        // Validate password strength
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({
                success: false,
                error: passwordValidation.message
            });
        }
        
        // Check if email already exists
        const existingEmail = await User.findByEmail(email);
        if (existingEmail) {
            return res.status(409).json({
                success: false,
                error: 'Email already registered'
            });
        }
        
        // Check if username already exists
        const existingUsername = await User.findByUsername(username);
        if (existingUsername) {
            return res.status(409).json({
                success: false,
                error: 'Username already taken'
            });
        }
        
        // Hash password
        const hashedPassword = await hashPassword(password);
        
        // Create user
        const user = await User.create({
            email,
            username,
            password: hashedPassword
        });
        
        // Generate JWT token
        const token = generateToken(user);
        
        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;
        
        // Set token in HTTP-only cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // HTTPS only in production
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        
        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            user: userWithoutPassword,
            token
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error during registration'
        });
    }
});

/**
 * POST /api/auth/login
 * Login with email/username and password
 */
router.post('/login', async (req, res) => {
    try {
        const { emailOrUsername, password } = req.body;
        
        // Validate required fields
        if (!emailOrUsername || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email/username and password are required'
            });
        }
        
        // Find user by email or username
        let user = await User.findByEmail(emailOrUsername);
        if (!user) {
            user = await User.findByUsername(emailOrUsername);
        }
        
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }
        
        // Verify password
        const isValidPassword = await comparePassword(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Generate JWT token
        const token = generateToken(user);

        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;

        // Set token in HTTP-only cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.json({
            success: true,
            message: 'Login successful',
            user: userWithoutPassword,
            token
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error during login'
        });
    }
});

/**
 * POST /api/auth/logout
 * Logout user by clearing the token cookie
 */
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

/**
 * GET /api/auth/me
 * Get current user information (requires authentication)
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

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
 * GET /api/auth/verify
 * Verify if the current token is valid
 */
router.get('/verify', authenticateToken, (req, res) => {
    res.json({
        success: true,
        valid: true,
        user: req.user
    });
});

export default router;

