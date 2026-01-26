/**
 * User Model
 * 
 * Handles user data storage and retrieval
 * Currently uses JSON file storage - can be replaced with database
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const USERS_FILE = path.join(__dirname, '../data/users.json');

/**
 * User Schema:
 * {
 *   id: string (UUID)
 *   email: string (unique)
 *   username: string (unique)
 *   password: string (hashed with bcrypt)
 *   avatar: string (JSON string of 10x10 pixel art grid, default: "[]")
 *   createdAt: string (ISO date)
 *   updatedAt: string (ISO date)
 * }
 */

class User {
    /**
     * Initialize users file if it doesn't exist
     */
    static async initialize() {
        try {
            await fs.access(USERS_FILE);
        } catch {
            // File doesn't exist, create it
            const dataDir = path.dirname(USERS_FILE);
            await fs.mkdir(dataDir, { recursive: true });
            await fs.writeFile(USERS_FILE, JSON.stringify([], null, 2));
        }
    }

    /**
     * Get all users
     */
    static async getAll() {
        await this.initialize();
        const data = await fs.readFile(USERS_FILE, 'utf-8');
        return JSON.parse(data);
    }

    /**
     * Save users array to file
     */
    static async save(users) {
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
    }

    /**
     * Find user by email
     */
    static async findByEmail(email) {
        const users = await this.getAll();
        return users.find(u => u.email.toLowerCase() === email.toLowerCase());
    }

    /**
     * Find user by username
     */
    static async findByUsername(username) {
        const users = await this.getAll();
        return users.find(u => u.username.toLowerCase() === username.toLowerCase());
    }

    /**
     * Find user by ID
     */
    static async findById(id) {
        const users = await this.getAll();
        return users.find(u => u.id === id);
    }

    /**
     * Create a new user
     */
    static async create(userData) {
        const users = await this.getAll();
        
        // Generate simple ID (in production, use UUID)
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        
        const newUser = {
            id,
            email: userData.email,
            username: userData.username,
            password: userData.password, // Should already be hashed
            avatar: userData.avatar || '[]', // Default to empty array (will generate on client)
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        users.push(newUser);
        await this.save(users);
        
        return newUser;
    }

    /**
     * Update user
     */
    static async update(id, updates) {
        const users = await this.getAll();
        const index = users.findIndex(u => u.id === id);
        
        if (index === -1) {
            return null;
        }
        
        users[index] = {
            ...users[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        
        await this.save(users);
        return users[index];
    }

    /**
     * Delete user
     */
    static async delete(id) {
        const users = await this.getAll();
        const filtered = users.filter(u => u.id !== id);
        
        if (filtered.length === users.length) {
            return false; // User not found
        }
        
        await this.save(filtered);
        return true;
    }
}

export default User;

