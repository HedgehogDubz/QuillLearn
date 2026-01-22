/**
 * Supabase Client Configuration
 * 
 * Initializes and exports the Supabase client for database operations
 */

import { createClient } from '@supabase/supabase-js'

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables!')
    console.error('Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file')
}

// Create and export the Supabase client
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    }
})

// Database types for TypeScript
export type Database = {
    public: {
        Tables: {
            sheets: {
                Row: {
                    id: string
                    session_id: string
                    user_id: string | null
                    title: string
                    rows: Array<{ data: string[] }>
                    column_widths: number[]
                    tags: string[]
                    last_time_saved: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    session_id: string
                    user_id?: string | null
                    title: string
                    rows: Array<{ data: string[] }>
                    column_widths: number[]
                    tags?: string[]
                    last_time_saved: number
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    session_id?: string
                    user_id?: string | null
                    title?: string
                    rows?: Array<{ data: string[] }>
                    column_widths?: number[]
                    tags?: string[]
                    last_time_saved?: number
                    created_at?: string
                    updated_at?: string
                }
            }
            notes: {
                Row: {
                    id: string
                    session_id: string
                    user_id: string | null
                    title: string
                    content: string
                    delta: any
                    drawings: Array<{
                        dataURL: string
                        width: number
                        height: number
                        hasBorder?: boolean
                    }> | null
                    attachments: Array<{
                        id: string
                        name: string
                        type: string
                        size: number
                        dataURL: string
                        uploadedAt: number
                    }> | null
                    tags: string[]
                    last_time_saved: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    session_id: string
                    user_id?: string | null
                    title: string
                    content: string
                    delta?: any
                    drawings?: Array<{
                        dataURL: string
                        width: number
                        height: number
                        hasBorder?: boolean
                    }> | null
                    attachments?: Array<{
                        id: string
                        name: string
                        type: string
                        size: number
                        dataURL: string
                        uploadedAt: number
                    }> | null
                    tags?: string[]
                    last_time_saved: number
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    session_id?: string
                    user_id?: string | null
                    title?: string
                    content?: string
                    delta?: any
                    drawings?: Array<{
                        dataURL: string
                        width: number
                        height: number
                        hasBorder?: boolean
                    }> | null
                    attachments?: Array<{
                        id: string
                        name: string
                        type: string
                        size: number
                        dataURL: string
                        uploadedAt: number
                    }> | null
                    tags?: string[]
                    last_time_saved?: number
                    created_at?: string
                    updated_at?: string
                }
            }
        }
    }
}

