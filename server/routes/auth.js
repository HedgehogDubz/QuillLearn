/**
 * Authentication Routes
 *
 * Handles user registration, login, logout, email verification, and password reset
 */

import express from 'express';
import User from '../models/User.js';
import { supabase } from '../config/supabase.js';
import {
    hashPassword,
    comparePassword,
    generateToken,
    isValidEmail,
    validatePassword,
    validateUsername,
    generateVerificationToken,
    generateResetToken,
    isTokenExpired
} from '../utils/auth.js';
import { authenticateToken } from '../middleware/auth.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/email.js';

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user account (no email verification required)
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

        // Create user account directly (no email verification)
        const user = await User.create({
            email,
            username,
            password: hashedPassword,
            avatar: '[]',
            emailVerified: true // Skip email verification
        });

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

        res.status(201).json({
            success: true,
            message: 'Account created successfully!',
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

/**
 * POST /api/auth/lookup-users
 * Look up usernames by user IDs
 */
router.post('/lookup-users', async (req, res) => {
    try {
        const { userIds } = req.body;

        if (!Array.isArray(userIds)) {
            return res.status(400).json({
                success: false,
                error: 'userIds must be an array'
            });
        }

        const users = await User.getAll();
        const userMap = {};

        userIds.forEach(id => {
            const user = users.find(u => u.id === id);
            if (user) {
                userMap[id] = {
                    username: user.username,
                    email: user.email
                };
            } else {
                userMap[id] = {
                    username: 'Unknown User',
                    email: null
                };
            }
        });

        res.json({
            success: true,
            users: userMap
        });
    } catch (error) {
        console.error('Lookup users error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

/**
 * POST /api/auth/verify-email
 * Verify email and create the user account
 */
router.post('/verify-email', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Verification token is required'
            });
        }

        // Find pending registration by verification token
        const { data: pending, error: findError } = await supabase
            .from('pending_registrations')
            .select('*')
            .eq('verification_token', token)
            .single();

        if (findError || !pending) {
            return res.status(400).json({
                success: false,
                error: 'Invalid verification token. Please register again.'
            });
        }

        // Check if token has expired
        if (new Date(pending.expires_at) < new Date()) {
            // Delete expired pending registration
            await supabase
                .from('pending_registrations')
                .delete()
                .eq('id', pending.id);

            return res.status(400).json({
                success: false,
                error: 'Verification token has expired. Please register again.'
            });
        }

        // Check again if email or username was taken while pending
        const existingEmail = await User.findByEmail(pending.email);
        if (existingEmail) {
            await supabase
                .from('pending_registrations')
                .delete()
                .eq('id', pending.id);
            return res.status(409).json({
                success: false,
                error: 'Email was already registered by another user. Please register with a different email.'
            });
        }

        const existingUsername = await User.findByUsername(pending.username);
        if (existingUsername) {
            await supabase
                .from('pending_registrations')
                .delete()
                .eq('id', pending.id);
            return res.status(409).json({
                success: false,
                error: 'Username was already taken by another user. Please register with a different username.'
            });
        }

        // Create the actual user account (email already verified!)
        const user = await User.create({
            email: pending.email,
            username: pending.username,
            password: pending.password, // Already hashed
            avatar: pending.avatar || '[]',
            emailVerified: true // Account is verified since they clicked the link
        });

        // Delete the pending registration
        await supabase
            .from('pending_registrations')
            .delete()
            .eq('id', pending.id);

        res.json({
            success: true,
            message: 'Email verified successfully! You can now log in.'
        });

    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error during email verification'
        });
    }
});

/**
 * POST /api/auth/resend-verification
 * Resend verification email (checks pending_registrations first, then users table)
 */
router.post('/resend-verification', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email is required'
            });
        }

        // First check if there's a pending registration
        const { data: pending } = await supabase
            .from('pending_registrations')
            .select('*')
            .eq('email', email)
            .single();

        if (pending) {
            // Generate new verification token
            const { token: verificationToken, expires: verificationExpires } = generateVerificationToken();

            // Update pending registration with new token
            await supabase
                .from('pending_registrations')
                .update({
                    verification_token: verificationToken,
                    expires_at: verificationExpires
                })
                .eq('id', pending.id);

            // Send verification email
            await sendVerificationEmail(email, verificationToken, pending.username);

            return res.json({
                success: true,
                message: 'Verification email sent'
            });
        }

        // Check if user exists in users table (legacy flow - shouldn't happen anymore)
        const user = await User.findByEmail(email);

        if (!user) {
            // Don't reveal if email exists
            return res.json({
                success: true,
                message: 'If an account exists with this email, a verification link has been sent.'
            });
        }

        if (user.emailVerified) {
            return res.status(400).json({
                success: false,
                error: 'Email is already verified. You can log in.'
            });
        }

        // Legacy: user exists but not verified (shouldn't happen with new flow)
        const { token: verificationToken, expires: verificationExpires } = generateVerificationToken();

        await User.update(user.id, {
            verificationToken,
            verificationTokenExpires: verificationExpires
        });

        await sendVerificationEmail(email, verificationToken, user.username);

        res.json({
            success: true,
            message: 'Verification email sent'
        });

    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset email
 */
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email is required'
            });
        }

        const user = await User.findByEmail(email);

        // Always return success to prevent email enumeration
        if (!user) {
            return res.json({
                success: true,
                message: 'If an account exists with this email, a password reset link has been sent.'
            });
        }

        // Generate reset token
        const { token: resetToken, expires: resetExpires } = generateResetToken();

        await User.update(user.id, {
            resetToken,
            resetTokenExpires: resetExpires
        });

        // Send password reset email
        await sendPasswordResetEmail(email, resetToken, user.username);

        res.json({
            success: true,
            message: 'If an account exists with this email, a password reset link has been sent.'
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({
                success: false,
                error: 'Token and new password are required'
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

        // Find user by reset token
        const user = await User.findByResetToken(token);

        if (!user) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or expired reset token'
            });
        }

        // Check if token has expired
        if (isTokenExpired(user.resetTokenExpires)) {
            return res.status(400).json({
                success: false,
                error: 'Reset token has expired. Please request a new one.'
            });
        }

        // Hash new password
        const hashedPassword = await hashPassword(password);

        // Update user password and clear reset token
        await User.update(user.id, {
            password: hashedPassword,
            resetToken: null,
            resetTokenExpires: null
        });

        res.json({
            success: true,
            message: 'Password reset successfully. You can now login with your new password.'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error during password reset'
        });
    }
});

/**
 * GET /api/auth/verify-reset-token/:token
 * Verify if a reset token is valid (for frontend validation)
 */
router.get('/verify-reset-token/:token', async (req, res) => {
    try {
        const { token } = req.params;

        const user = await User.findByResetToken(token);

        if (!user || isTokenExpired(user.resetTokenExpires)) {
            return res.json({
                success: false,
                valid: false,
                error: 'Invalid or expired reset token'
            });
        }

        res.json({
            success: true,
            valid: true
        });

    } catch (error) {
        console.error('Verify reset token error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error'
        });
    }
});

export default router;
