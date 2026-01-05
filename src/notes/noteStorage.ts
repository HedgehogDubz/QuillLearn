/**
 * Note Storage Module
 * Handles saving and loading notes to/from localStorage
 * Similar to sheetStorage.ts for consistency across the application
 */

/**
 * DrawingData - Structure for storing canvas drawings
 * @property dataURL - Base64 encoded image data
 * @property width - Canvas width in pixels
 * @property height - Canvas height in pixels
 * @property hasBorder - Whether the drawing has a border
 */
export interface DrawingData {
    dataURL: string
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
 * @property dataURL - Base64 encoded file data
 * @property uploadedAt - Timestamp when file was uploaded
 */
export interface FileAttachment {
    id: string
    name: string
    type: string
    size: number
    dataURL: string
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
    content: string
    delta?: any // Quill Delta object
    drawings?: DrawingData[]
    attachments?: FileAttachment[]
    lastTimeSaved: number
}

// Constants
export const AUTO_SAVE_DEBOUNCE_MS = 1000; // Debounce auto-save by 1000ms (1 second)

/**
 * Helper function to get storage key for a session
 * @param sessionId - Unique session identifier
 * @returns Storage key for localStorage
 */
export function getStorageKey(sessionId: string): string {
    return `notes_session_${sessionId}`;
}

/**
 * Load saved note data from localStorage
 * @param sessionId - Unique session identifier
 * @returns NoteData object if found, null otherwise
 */
export function loadNoteData(sessionId: string): NoteData | null {
    try {
        const storageKey = getStorageKey(sessionId);
        const savedData = localStorage.getItem(storageKey);

        if (savedData) {
            const parsed = JSON.parse(savedData) as NoteData;
            return parsed;
        }
    } catch (error) {
        console.error('Error loading saved note data:', error);
    }

    return null;
}

/**
 * Save note data to localStorage
 * @param sessionId - Unique session identifier
 * @param title - Document title
 * @param content - HTML content from Quill
 * @param delta - Quill Delta object (optional)
 * @param drawings - Array of drawings (optional)
 * @param attachments - Array of file attachments (optional)
 * @returns Object with success status and serialized data
 */
export function saveNoteData(
    sessionId: string,
    title: string,
    content: string,
    delta?: any,
    drawings?: DrawingData[],
    attachments?: FileAttachment[]
): { success: boolean; serializedData: string | null } {
    try {
        const storageKey = getStorageKey(sessionId);

        const dataToSave: NoteData = {
            title,
            content,
            delta,
            drawings,
            attachments,
            lastTimeSaved: Date.now()
        };

        // Serialize data
        const serializedData = JSON.stringify(dataToSave);

        localStorage.setItem(storageKey, serializedData);
        return { success: true, serializedData };
    } catch (error) {
        // Handle localStorage quota exceeded or other errors
        console.error('Error saving note data:', error);
        if (error instanceof Error && error.name === 'QuotaExceededError') {
            console.warn('localStorage quota exceeded. Data not saved.');
        }
        return { success: false, serializedData: null };
    }
}

/**
 * Delete note data from localStorage
 * @param sessionId - Unique session identifier
 * @returns true if deleted successfully, false otherwise
 */
export function deleteNoteData(sessionId: string): boolean {
    try {
        const storageKey = getStorageKey(sessionId);
        localStorage.removeItem(storageKey);
        return true;
    } catch (error) {
        console.error('Error deleting note data:', error);
        return false;
    }
}

/**
 * Get all saved note sessions
 * @returns Array of session IDs
 */
export function getAllNoteSessions(): string[] {
    const sessions: string[] = [];

    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('notes_session_')) {
                const sessionId = key.replace('notes_session_', '');
                sessions.push(sessionId);
            }
        }
    } catch (error) {
        console.error('Error getting note sessions:', error);
    }

    return sessions;
}


/**
 * Update lastTimeSaved timestamp when accessing a note
 * @param sessionId - Unique session identifier
 */
export function updateLastAccessed(sessionId: string): void {
    try {
        const storageKey = getStorageKey(sessionId);
        const savedData = localStorage.getItem(storageKey);

        if (savedData) {
            const parsed = JSON.parse(savedData) as NoteData;
            parsed.lastTimeSaved = Date.now();
            localStorage.setItem(storageKey, JSON.stringify(parsed));
        }
    } catch (error) {
        console.error('Error updating last accessed time:', error);
    }
}

