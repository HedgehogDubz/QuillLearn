type Grid = string[][]

// New row-based data structure for better extensibility
export type RowData = {
    data: string[];  
};

// New format with row objects
export type SavedSpreadsheetData = {
    title: string;
    rows: RowData[];
    columnWidths: number[];
};

// Constants
export const AUTO_SAVE_DEBOUNCE_MS = 1000; // Debounce auto-save by 1000ms (1 second) for better performance

// Helper function to get storage key for a session
export function getStorageKey(sessionId: string): string {
    return `spreadsheet_session_${sessionId}`;
}

// Convert RowData[] to Grid (string[][])
export function rowDataToGrid(rows: RowData[]): Grid {
    return rows.map(row => row.data);
}

// Convert Grid to RowData[]
export function gridToRowData(grid: Grid): RowData[] {
    return grid.map(row => ({ data: row }));
}

// Load saved data from localStorage
export function loadSheetData(
    sessionId: string,
    defaultGrid: Grid,
    defaultColumnWidths: number[]
): { title:string; grid: Grid; columnWidths: number[] } {
    try {
        const storageKey = getStorageKey(sessionId);
        const savedData = localStorage.getItem(storageKey);

        if (savedData) {
            const parsed = JSON.parse(savedData);

            // Check if it's the new format (has 'rows' property)
            if (parsed.rows && Array.isArray(parsed.rows) && Array.isArray(parsed.columnWidths)) {
                const newFormat = parsed as SavedSpreadsheetData;
                return {
                    title: newFormat.title,
                    grid: rowDataToGrid(newFormat.rows),
                    columnWidths: newFormat.columnWidths
                };
            }

            
        }
    } catch (error) {
        console.error('Error loading saved spreadsheet data:', error);
    }

    // Return default data if no saved data or error
    return {
        title: "Untitled Sheet " + sessionId,
        grid: defaultGrid,
        columnWidths: defaultColumnWidths
    };
}

// Save data to localStorage
// Returns true if saved successfully, false otherwise
export function saveSheetData(
    sessionId: string,
    title: string,
    grid: Grid,
    columnWidths: number[],
    lastSavedData: string | null
): { success: boolean; serializedData: string | null } {
    try {
        const storageKey = getStorageKey(sessionId);

        //if non have same title, save data
        //if other session has same title, return title + (1) but check if that exists first, if that exists then return title + (2) and so on
        let saveTitle = title;
        let counter = 1;
        while (true) {
            let titleExists = false;
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith('spreadsheet_session_') && key !== storageKey) {
                const savedData = localStorage.getItem(key);
                if (savedData) {
                    const parsed = JSON.parse(savedData);
                    if (parsed.title === title) {
                        return { success: false, serializedData: null };
                    }
                }
            }
            }
            if (!titleExists) {
                break;
            }
            saveTitle = title + " (" + counter + ")";
            counter++;
        }

        const dataToSave: SavedSpreadsheetData = {
            title: saveTitle,
            rows: gridToRowData(grid),
            columnWidths
        };

        // Serialize data
        const serializedData = JSON.stringify(dataToSave);

        // Only save if data has actually changed (optimization)
        if (serializedData === lastSavedData) {
            return { success: true, serializedData: lastSavedData };
        }

        localStorage.setItem(storageKey, serializedData);
        return { success: true, serializedData };
    } catch (error) {
        // Handle localStorage quota exceeded or other errors
        console.error('Error saving spreadsheet data:', error);
        if (error instanceof Error && error.name === 'QuotaExceededError') {
            console.warn('localStorage quota exceeded. Data not saved.');
        }
        return { success: false, serializedData: null };
    }
}

