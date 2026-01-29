/**
 * User Model
 *
 * Handles user data storage and retrieval using Supabase
 */

import { supabase } from '../config/supabase.js';

/**
 * User Schema (Supabase table: users):
 * {
 *   id: UUID (auto-generated)
 *   email: string (unique)
 *   username: string (unique)
 *   password: string (hashed with bcrypt)
 *   avatar: string (JSON string of 10x10 pixel art grid, default: "[]")
 *   email_verified: boolean (default: false)
 *   verification_token: string | null
 *   verification_token_expires: timestamptz | null
 *   reset_token: string | null
 *   reset_token_expires: timestamptz | null
 *   created_at: timestamptz
 *   updated_at: timestamptz
 * }
 */

// Helper to convert snake_case DB fields to camelCase for API responses
function toCamelCase(user) {
    if (!user) return null;
    return {
        id: user.id,
        email: user.email,
        username: user.username,
        password: user.password,
        avatar: user.avatar,
        emailVerified: user.email_verified,
        verificationToken: user.verification_token,
        verificationTokenExpires: user.verification_token_expires,
        resetToken: user.reset_token,
        resetTokenExpires: user.reset_token_expires,
        createdAt: user.created_at,
        updatedAt: user.updated_at
    };
}

// Helper to convert camelCase to snake_case for DB operations
function toSnakeCase(data) {
    const result = {};
    if (data.email !== undefined) result.email = data.email;
    if (data.username !== undefined) result.username = data.username;
    if (data.password !== undefined) result.password = data.password;
    if (data.avatar !== undefined) result.avatar = data.avatar;
    if (data.emailVerified !== undefined) result.email_verified = data.emailVerified;
    if (data.verificationToken !== undefined) result.verification_token = data.verificationToken;
    if (data.verificationTokenExpires !== undefined) result.verification_token_expires = data.verificationTokenExpires;
    if (data.resetToken !== undefined) result.reset_token = data.resetToken;
    if (data.resetTokenExpires !== undefined) result.reset_token_expires = data.resetTokenExpires;
    return result;
}

class User {
    /**
     * Find user by email
     */
    static async findByEmail(email) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .ilike('email', email)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error finding user by email:', error);
        }
        return toCamelCase(data);
    }

    /**
     * Find user by username
     */
    static async findByUsername(username) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .ilike('username', username)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error finding user by username:', error);
        }
        return toCamelCase(data);
    }

    /**
     * Find user by ID
     */
    static async findById(id) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error finding user by ID:', error);
        }
        return toCamelCase(data);
    }

    /**
     * Find user by verification token
     */
    static async findByVerificationToken(token) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('verification_token', token)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error finding user by verification token:', error);
        }
        return toCamelCase(data);
    }

    /**
     * Find user by reset token
     */
    static async findByResetToken(token) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('reset_token', token)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error finding user by reset token:', error);
        }
        return toCamelCase(data);
    }

    /**
     * Create a new user
     */
    static async create(userData) {
        const insertData = {
            email: userData.email,
            username: userData.username,
            password: userData.password,
            avatar: userData.avatar || '[]',
            email_verified: userData.emailVerified || false,
            verification_token: userData.verificationToken || null,
            verification_token_expires: userData.verificationTokenExpires || null,
            reset_token: null,
            reset_token_expires: null
        };

        const { data, error } = await supabase
            .from('users')
            .insert(insertData)
            .select()
            .single();

        if (error) {
            console.error('Error creating user:', error);
            throw error;
        }

        return toCamelCase(data);
    }

    /**
     * Update user
     */
    static async update(id, updates) {
        const updateData = toSnakeCase(updates);

        const { data, error } = await supabase
            .from('users')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating user:', error);
            return null;
        }

        return toCamelCase(data);
    }

    /**
     * Delete user
     */
    static async delete(id) {
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting user:', error);
            return false;
        }

        return true;
    }

    /**
     * Get all users (for admin purposes)
     */
    static async getAll() {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error getting all users:', error);
            return [];
        }

        return data.map(toCamelCase);
    }
}

export default User;
