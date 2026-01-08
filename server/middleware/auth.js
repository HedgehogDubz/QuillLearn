/**
 * Authentication Middleware
 * 
 * Protects routes by verifying JWT tokens
 */

import { verifyToken } from '../utils/auth.js';

/**
 * Middleware to verify JWT token from cookies or Authorization header
 * Adds user data to req.user if token is valid
 */
export function authenticateToken(req, res, next) {
    // Try to get token from cookie first
    let token = req.cookies?.token;
    
    // If not in cookie, try Authorization header
    if (!token) {
        const authHeader = req.headers['authorization'];
        token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    }
    
    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Access denied. No token provided.'
        });
    }
    
    const decoded = verifyToken(token);
    
    if (!decoded) {
        return res.status(403).json({
            success: false,
            error: 'Invalid or expired token.'
        });
    }
    
    // Add user data to request object
    req.user = decoded;
    next();
}

/**
 * Optional authentication middleware
 * Adds user data if token exists, but doesn't require it
 */
export function optionalAuth(req, res, next) {
    let token = req.cookies?.token;
    
    if (!token) {
        const authHeader = req.headers['authorization'];
        token = authHeader && authHeader.split(' ')[1];
    }
    
    if (token) {
        const decoded = verifyToken(token);
        if (decoded) {
            req.user = decoded;
        }
    }
    
    next();
}

