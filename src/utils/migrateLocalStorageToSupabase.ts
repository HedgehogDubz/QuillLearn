/**
 * Migration Utility: localStorage to Supabase
 * 
 * This utility helps migrate existing localStorage data to Supabase.
 * Run this once after setting up Supabase to preserve existing data.
 */

/**
 * Migrate all sheets from localStorage to Supabase
 */
export async function migrateSheets(userId: string | null): Promise<{success: number, failed: number}> {
    let success = 0;
    let failed = 0;

    try {
        // Find all sheet sessions in localStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('spreadsheet_session_')) {
                const sessionId = key.replace('spreadsheet_session_', '');
                const savedData = localStorage.getItem(key);

                if (savedData) {
                    try {
                        const parsed = JSON.parse(savedData);
                        
                        // Send to API
                        const response = await fetch('/api/sheets', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                sessionId,
                                userId: userId || parsed.userId || null,
                                title: parsed.title,
                                rows: parsed.rows,
                                columnWidths: parsed.columnWidths || parsed.column_widths
                            })
                        });

                        const result = await response.json();
                        if (result.success) {
                            success++;
                            console.log(`✅ Migrated sheet: ${parsed.title}`);
                        } else {
                            failed++;
                            console.error(`❌ Failed to migrate sheet: ${parsed.title}`, result.error);
                        }
                    } catch (error) {
                        failed++;
                        console.error(`❌ Error migrating sheet ${sessionId}:`, error);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error during sheet migration:', error);
    }

    return { success, failed };
}

/**
 * Migrate all notes from localStorage to Supabase
 */
export async function migrateNotes(userId: string | null): Promise<{success: number, failed: number}> {
    let success = 0;
    let failed = 0;

    try {
        // Find all note sessions in localStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('notes_session_')) {
                const sessionId = key.replace('notes_session_', '');
                const savedData = localStorage.getItem(key);

                if (savedData) {
                    try {
                        const parsed = JSON.parse(savedData);
                        
                        // Send to API
                        const response = await fetch('/api/notes', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                sessionId,
                                userId: userId || parsed.userId || null,
                                title: parsed.title,
                                content: parsed.content,
                                delta: parsed.delta,
                                drawings: parsed.drawings,
                                attachments: parsed.attachments
                            })
                        });

                        const result = await response.json();
                        if (result.success) {
                            success++;
                            console.log(`✅ Migrated note: ${parsed.title}`);
                        } else {
                            failed++;
                            console.error(`❌ Failed to migrate note: ${parsed.title}`, result.error);
                        }
                    } catch (error) {
                        failed++;
                        console.error(`❌ Error migrating note ${sessionId}:`, error);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error during note migration:', error);
    }

    return { success, failed };
}

/**
 * Migrate all data from localStorage to Supabase
 * Call this function from the browser console after logging in
 */
export async function migrateAllData(userId: string | null = null): Promise<void> {
    console.log('🚀 Starting migration from localStorage to Supabase...');
    
    const sheetsResult = await migrateSheets(userId);
    console.log(`\n📊 Sheets Migration Complete:`);
    console.log(`   ✅ Success: ${sheetsResult.success}`);
    console.log(`   ❌ Failed: ${sheetsResult.failed}`);
    
    const notesResult = await migrateNotes(userId);
    console.log(`\n📝 Notes Migration Complete:`);
    console.log(`   ✅ Success: ${notesResult.success}`);
    console.log(`   ❌ Failed: ${notesResult.failed}`);
    
    console.log(`\n🎉 Migration Complete!`);
    console.log(`   Total Success: ${sheetsResult.success + notesResult.success}`);
    console.log(`   Total Failed: ${sheetsResult.failed + notesResult.failed}`);
}

// Make it available globally for easy access from console
if (typeof window !== 'undefined') {
    (window as any).migrateToSupabase = migrateAllData;
}

