/**
 * Note Storage Module
 * Handles saving and loading notes to/from localStorage
 * Similar to sheetStorage.ts for consistency across the application
 */

/**
 * DrawingData - Structure for storing canvas drawings
 * @property url - URL to the drawing in Supabase Storage (or dataURL for backward compatibility)
 * @property width - Canvas width in pixels
 * @property height - Canvas height in pixels
 * @property hasBorder - Whether the drawing has a border
 */
export interface DrawingData {
    url?: string // New: URL from Supabase Storage
    dataURL?: string // Deprecated: kept for backward compatibility
    width: number
    height: number
    hasBorder?: boolean
}

/**
 * FileAttachment - Structure for storing file attachments
 * @property id - Unique identifier for the file
 * @property name - Original file name
 * @property type - MIME type of the file
 * @property size - File size in bytes
 * @property url - URL to the file in Supabase Storage (or dataURL for backward compatibility)
 * @property uploadedAt - Timestamp when file was uploaded
 */
export interface FileAttachment {
    id: string
    name: string
    type: string
    size: number
    url?: string // New: URL from Supabase Storage
    dataURL?: string // Deprecated: kept for backward compatibility
    uploadedAt: number
}

/**
 * NoteData - Structure for storing note information in localStorage
 * @property title - Document title
 * @property content - Rich text content (HTML format from Quill)
 * @property delta - Quill Delta format (preserves all formatting)
 * @property drawings - Array of saved drawings
 * @property attachments - Array of file attachments
 * @property lastTimeSaved - Timestamp of last save
 */
export interface NoteData {
    title: string
    userId: string | null
    content: string
    delta?: any // Quill Delta object
    drawings?: DrawingData[]
    attachments?: FileAttachment[]
    lastTimeSaved: number
}

// Constants
export const AUTO_SAVE_DEBOUNCE_MS = 1000; // Debounce auto-save by 1000ms (1 second)

/**
 * Load saved note data from API/Supabase
 * @param sessionId - Unique session identifier
 * @returns NoteData object if found, null otherwise
 */
export async function loadNoteData(sessionId: string): Promise<NoteData | null> {
    try {
        const response = await fetch(`/api/notes/${sessionId}`);
        const result = await response.json();

        if (result.success && result.data) {
            const data = result.data;
            return {
                title: data.title,
                userId: data.user_id,
                content: data.content,
                delta: data.delta,
                drawings: data.drawings,
                attachments: data.attachments,
                lastTimeSaved: data.last_time_saved
            };
        }
    } catch (error) {
        console.error('Error loading saved note data:', error);
    }

    return null;
}

/**
 * Save note data to API/Supabase
 * @param sessionId - Unique session identifier
 * @param userId - User ID
 * @param title - Document title
 * @param content - HTML content from Quill
 * @param delta - Quill Delta object (optional)
 * @param drawings - Array of drawings (optional)
 * @param attachments - Array of file attachments (optional)
 * @returns Object with success status and serialized data
 */
export async function saveNoteData(
    sessionId: string,
    userId: string | null,
    title: string,
    content: string,
    delta?: any,
    drawings?: DrawingData[],
    attachments?: FileAttachment[]
): Promise<{ success: boolean; serializedData: string | null }> {
    try {
        const dataToSave = {
            sessionId,
            userId,
            title,
            content,
            delta,
            drawings,
            attachments
        };

        // Serialize data
        const serializedData = JSON.stringify(dataToSave);

        const response = await fetch('/api/notes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: serializedData
        });

        const result = await response.json();

        if (result.success) {
            return { success: true, serializedData };
        } else {
            console.error('Failed to save note:', result.error);
            return { success: false, serializedData: null };
        }
    } catch (error) {
        console.error('Error saving note data:', error);
        return { success: false, serializedData: null };
    }
}

/**
 * Delete note data via API
 * @param sessionId - Unique session identifier
 * @returns true if deleted successfully, false otherwise
 */
export async function deleteNoteData(sessionId: string): Promise<boolean> {
    try {
        const response = await fetch(`/api/notes/${sessionId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        return result.success;
    } catch (error) {
        console.error('Error deleting note data:', error);
        return false;
    }
}

/**
 * Get all saved note sessions for a user
 * @param userId - User ID
 * @returns Array of session data
 */
export async function getAllNoteSessions(userId: string): Promise<Array<{session_id: string, title: string, last_time_saved: number}>> {
    try {
        const response = await fetch(`/api/notes/user/${userId}`);
        const result = await response.json();
        return result.success ? result.data : [];
    } catch (error) {
        console.error('Error getting note sessions:', error);
        return [];
    }
}

/**
 * Update lastTimeSaved timestamp when accessing a note
 * Note: This is now handled automatically by the API when loading/saving
 * @param sessionId - Unique session identifier
 */
export function updateLastAccessed(sessionId: string): void {
    // No-op: timestamp is updated automatically by the API
    console.log('Last accessed time will be updated by API for session:', sessionId);
}

