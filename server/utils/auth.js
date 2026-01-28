/**
 * Authentication Utilities
 *
 * Handles password hashing, JWT token generation, and validation
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Secret key for JWT - In production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = '7d'; // Token expires in 7 days
const SALT_ROUNDS = 10; // bcrypt salt rounds

// Token expiration times
const VERIFICATION_TOKEN_EXPIRES = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TOKEN_EXPIRES = 60 * 60 * 1000; // 1 hour

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
export async function hashPassword(password) {
    return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a plain text password with a hashed password
 * @param {string} password - Plain text password
 * @param {string} hashedPassword - Hashed password from database
 * @returns {Promise<boolean>} True if passwords match
 */
export async function comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
}

/**
 * Generate a JWT token for a user
 * @param {object} user - User object
 * @returns {string} JWT token
 */
export function generateToken(user) {
    // Only include non-sensitive data in the token
    const payload = {
        id: user.id,
        email: user.email,
        username: user.username
    };
    
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN
    });
}

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token
 * @returns {object|null} Decoded token payload or null if invalid
 */
export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean} True if valid email format
 */
export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} { valid: boolean, message: string }
 */
export function validatePassword(password) {
    if (password.length < 8) {
        return {
            valid: false,
            message: 'Password must be at least 8 characters long'
        };
    }
    
    if (!/[A-Z]/.test(password)) {
        return {
            valid: false,
            message: 'Password must contain at least one uppercase letter'
        };
    }
    
    if (!/[a-z]/.test(password)) {
        return {
            valid: false,
            message: 'Password must contain at least one lowercase letter'
        };
    }
    
    if (!/[0-9]/.test(password)) {
        return {
            valid: false,
            message: 'Password must contain at least one number'
        };
    }
    
    return {
        valid: true,
        message: 'Password is valid'
    };
}

/**
 * Validate username
 * @param {string} username - Username to validate
 * @returns {object} { valid: boolean, message: string }
 */
export function validateUsername(username) {
    if (username.length < 3) {
        return {
            valid: false,
            message: 'Username must be at least 3 characters long'
        };
    }
    
    if (username.length > 20) {
        return {
            valid: false,
            message: 'Username must be less than 20 characters'
        };
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return {
            valid: false,
            message: 'Username can only contain letters, numbers, and underscores'
        };
    }

    return {
        valid: true,
        message: 'Username is valid'
    };
}

/**
 * Generate a secure random token for email verification
 * @returns {{token: string, expires: string}} Token and expiration date
 */
export function generateVerificationToken() {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRES).toISOString();
    return { token, expires };
}

/**
 * Generate a secure random token for password reset
 * @returns {{token: string, expires: string}} Token and expiration date
 */
export function generateResetToken() {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + RESET_TOKEN_EXPIRES).toISOString();
    return { token, expires };
}

/**
 * Check if a token has expired
 * @param {string} expiresAt - ISO date string
 * @returns {boolean} True if expired
 */
export function isTokenExpired(expiresAt) {
    if (!expiresAt) return true;
    return new Date(expiresAt) < new Date();
}
