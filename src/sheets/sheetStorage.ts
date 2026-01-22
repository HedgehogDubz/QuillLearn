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
    lastTimeSaved: number;
    userId: string | null;
};

// Constants
export const AUTO_SAVE_DEBOUNCE_MS = 1000; // Debounce auto-save by 1000ms (1 second) for better performance

// Convert RowData[] to Grid (string[][])
export function rowDataToGrid(rows: RowData[]): Grid {
    return rows.map(row => row.data);
}

// Convert Grid to RowData[]
export function gridToRowData(grid: Grid): RowData[] {
    return grid.map(row => ({ data: row }));
}

// Load saved data from API/Supabase
export async function loadSheetData(
    sessionId: string,
    defaultGrid: Grid,
    defaultColumnWidths: number[]
): Promise<{ title: string; grid: Grid; columnWidths: number[]; tags: string[] }> {
    try {
        const response = await fetch(`/api/sheets/${sessionId}`);
        const result = await response.json();

        if (result.success && result.data) {
            const data = result.data;
            return {
                title: data.title,
                grid: rowDataToGrid(data.rows),
                columnWidths: data.column_widths,
                tags: data.tags || []
            };
        }
    } catch (error) {
        console.error('Error loading saved spreadsheet data:', error);
    }

    // Return default data if no saved data or error
    return {
        title: "Untitled Sheet",
        grid: defaultGrid,
        columnWidths: defaultColumnWidths,
        tags: []
    };
}

// Save data to API/Supabase
export async function saveSheetData(
    sessionId: string,
    userId: string | null,
    title: string,
    grid: Grid,
    columnWidths: number[],
    lastSavedData: string | null
): Promise<{ success: boolean; serializedData: string | null }> {
    try {
        const dataToSave = {
            sessionId,
            userId,
            title,
            rows: gridToRowData(grid),
            columnWidths
        };

        // Serialize data for comparison
        const serializedData = JSON.stringify(dataToSave);

        // Only save if data has actually changed (optimization)
        if (serializedData === lastSavedData) {
            return { success: true, serializedData: lastSavedData };
        }

        const response = await fetch('/api/sheets', {
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
            console.error('Failed to save sheet:', result.error);
            return { success: false, serializedData: null };
        }
    } catch (error) {
        console.error('Error saving spreadsheet data:', error);
        return { success: false, serializedData: null };
    }
}

// Update lastTimeSaved timestamp when accessing a sheet
// Note: This is now handled automatically by the API when loading/saving
export function updateLastAccessed(sessionId: string): void {
    // No-op: timestamp is updated automatically by the API
    console.log('Last accessed time will be updated by API for session:', sessionId);
}


