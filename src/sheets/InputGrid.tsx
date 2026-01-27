import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import './InputGrid.css'
import { loadSheetData, saveSheetData, AUTO_SAVE_DEBOUNCE_MS } from './sheetStorage'
import { ImageUploadModal } from './ImageUploadModal'
import { DrawingModal, type CanvasSize } from '../components/DrawingModal'
import { useAuth } from '../auth/AuthContext'
import DocumentHeader from '../components/DocumentHeader'
import TagInput from '../components/TagInput'
import PublishModal from '../components/PublishModal'
import LoadingScreen from '../components/LoadingScreen'

// Constants
const DRAG_THRESHOLD = 5; // Minimum distance in pixels to count as a drag (not just a click)
const DEFAULT_COLUMN_WIDTH = 250;
const INITIAL_ROWS = 10;
const INITIAL_COLS = 2;
const INITIAL_COLUMN_COUNT = 6;
const RIGHT_PADDING = 2000; // Extra scrollable space on the right side to allow unlimited column expansion
const MAX_HISTORY = 50; // Maximum number of undo states to keep

// Types
type Grid = string[][]

type SelectionRange = {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
} | null;

type HistoryState = {
    grid: Grid;
    columnWidths: number[];
    selection: SelectionRange;
    focusedCell: { row: number; col: number } | null;
    actionDescription: string;
};

type ContextMenu = {
    x: number;
    y: number;
    rowIndex: number;
} | null;

type ColumnContextMenu = {
    x: number;
    y: number;
    colIndex: number;
} | null;

// Helper functions
function makeGrid(rows: number, cols: number): Grid {
    return Array.from({ length: rows }, () => Array(cols).fill(''))
}

function copyGrid(grid: Grid): Grid {
    return grid.map(row => row.slice())
}

// Image handling helpers
function insertImageIntoCell(cellValue: string, imageData: string): string {
    // Insert image at the end of the cell content
    const imageMarker = `|||IMG:${imageData}|||`;
    return cellValue ? `${cellValue}\n${imageMarker}` : imageMarker;
}

function parseCellContent(value: string): { text: string; images: string[] } {
    // Updated regex to match both data URLs and regular URLs (like /api/storage/image/...)
    const imageRegex = /\|\|\|IMG:([^|]+)\|\|\|/g;
    const images: string[] = [];
    let match;

    while ((match = imageRegex.exec(value)) !== null) {
        images.push(match[1]);
    }

    // Remove image markers from text (don't trim - preserve spaces!)
    const text = value.replace(imageRegex, '').replace(/^\n+|\n+$/g, '');

    return { text, images };
}

// Memoized Cell component for performance optimization
interface CellProps {
    row: number;
    col: number;
    value: string;
    isSelected: boolean;
    columnWidth: number;
    inputRef: (el: HTMLTextAreaElement | null) => void;
    onChange: (value: string) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
    onFocus: () => void;
    onBlur: () => void;
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseUp: () => void;
    autoResizeTextarea: (el: HTMLTextAreaElement) => void;
    onAddImage?: (row: number, col: number) => void;
    onAddDrawing?: (row: number, col: number) => void;
    isHeaderRow?: boolean;
    readOnly?: boolean;
}

const Cell = React.memo(({
    row,
    col,
    value,
    isSelected,
    columnWidth,
    inputRef,
    onChange,
    onKeyDown,
    onPaste,
    onFocus,
    onBlur,
    onMouseDown,
    onMouseUp,
    autoResizeTextarea,
    onAddImage,
    onAddDrawing,
    isHeaderRow = false,
    readOnly = false
}: CellProps) => {
    const { text, images } = parseCellContent(value);
    const hasImages = images.length > 0;
    const canAddMoreImages = images.length < 2; // Maximum 2 images per cell

    return (
        <td
            key={`${row}-${col}`}
            className={`sheet_cell ${isSelected ? 'sheet_cell_selected' : ''} ${hasImages ? 'sheet_cell_has_images' : ''} ${readOnly ? 'sheet_cell_readonly' : ''} sheet_cell_row_${row} sheet_cell_col_${col}`}
            style={{ width: columnWidth }}
            data-row={row}
            data-col={col}
        >
            {/* Images displayed above textarea */}
            {hasImages && (
                <div className="sheet_cell_images">
                    {images.map((imgSrc, idx) => (
                        <div key={idx} className="sheet_cell_image">
                            <img src={imgSrc} alt="" />
                        </div>
                    ))}
                </div>
            )}

            <textarea
                className="sheet_input"
                value={text}
                readOnly={readOnly}
                ref={(el) => {
                    inputRef(el);
                    if (el) {
                        autoResizeTextarea(el);
                    }
                }}
                onChange={(e) => {
                    if (readOnly) return;
                    // Preserve images when editing text
                    const newValue = images.length > 0
                        ? `${e.target.value}\n${images.map(img => `|||IMG:${img}|||`).join('\n')}`
                        : e.target.value;
                    onChange(newValue);
                    autoResizeTextarea(e.target);
                }}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
                onFocus={onFocus}
                onBlur={onBlur}
                rows={1}
                placeholder={hasImages ? '' : undefined}
            />

            {/* Selection overlay - positioned above textarea */}
            <div
                className="sheet_selection_layer"
                onMouseDown={onMouseDown}
                onMouseUp={onMouseUp}
            />

            {/* Add image button - only for non-header rows and if less than 2 images and not read-only */}
            {!isHeaderRow && !readOnly && onAddImage && canAddMoreImages && (
                <button
                    className="sheet_add_image_btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        onAddImage(row, col);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    title="Add image (max 2)"
                >
                    📷
                </button>
            )}

            {/* Add drawing button - only for non-header rows and if less than 2 images and not read-only */}
            {!isHeaderRow && !readOnly && onAddDrawing && canAddMoreImages && (
                <button
                    className="sheet_add_drawing_btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        onAddDrawing(row, col);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    title="Add drawing (max 2 images total)"
                >
                    ✏️
                </button>
            )}
        </td>
    );
}, (prevProps, nextProps) => {
    // Custom comparison function - only re-render if these props change
    return (
        prevProps.value === nextProps.value &&
        prevProps.isSelected === nextProps.isSelected &&
        prevProps.columnWidth === nextProps.columnWidth &&
        prevProps.readOnly === nextProps.readOnly
    );
});

Cell.displayName = 'Cell';

interface InputGridProps {
    sessionId: string;
}

function InputGrid({ sessionId }: InputGridProps) {
    // Get user from auth context
    const { user } = useAuth();

    // Initialize with default values
    const defaultGrid = makeGrid(INITIAL_ROWS, INITIAL_COLS);
    const defaultColumnWidths = Array(INITIAL_COLUMN_COUNT).fill(DEFAULT_COLUMN_WIDTH);

    const [grid, setGrid] = useState<Grid>(defaultGrid);
    const [columnWidths, setColumnWidths] = useState<number[]>(defaultColumnWidths);
    const [title, setTitle] = useState<string>("Untitled Sheet");
    const [isSaved, setIsSaved] = useState<boolean>(true);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isReadOnly, setIsReadOnly] = useState<boolean>(false);
    const [userPermission, setUserPermission] = useState<string | null>(null);
    const [tags, setTags] = useState<string[]>([]);
    const [allUserTags, setAllUserTags] = useState<string[]>([]);
    const [resizingColumn, setResizingColumn] = useState<number | null>(null);
    const resizeStartX = useRef<number>(0);
    const resizeStartWidth = useRef<number>(0);

    // Undo history state
    const [history, setHistory] = useState<HistoryState[]>([]);
    const [lastActionDescription, setLastActionDescription] = useState<string>("");
    const isUndoing = useRef<boolean>(false);

    // Track cell editing for undo - save the entire state when editing starts
    const editingCell = useRef<{
        row: number;
        col: number;
        originalValue: string;
        savedState: HistoryState;
    } | null>(null);

    // Multi-cell selection state
    const [selection, setSelection] = useState<SelectionRange>(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const selectionStart = useRef<{ row: number; col: number } | null>(null);
    const hasDragged = useRef<boolean>(false);
    const dragStartPos = useRef<{ x: number; y: number } | null>(null);
    const justCompletedDrag = useRef<boolean>(false); // Track if we just completed a drag to ignore next click

    // Context menu state for row operations
    const [contextMenu, setContextMenu] = useState<ContextMenu>(null);

    // Context menu state for column operations
    const [columnContextMenu, setColumnContextMenu] = useState<ColumnContextMenu>(null);

    // Image upload modal state
    const [imageModalOpen, setImageModalOpen] = useState(false);
    const [imageTargetCell, setImageTargetCell] = useState<{ row: number; col: number } | null>(null);

    // Drawing modal state
    const [drawingModalOpen, setDrawingModalOpen] = useState(false);
    const [drawingTargetCell, setDrawingTargetCell] = useState<{ row: number; col: number } | null>(null);

    // Publish modal state
    const [publishModalOpen, setPublishModalOpen] = useState(false);

    // Square canvas sizes for sheets
    const SQUARE_CANVAS_SIZES: CanvasSize[] = [
        { width: 200, height: 200 },
        { width: 400, height: 400 },
        { width: 600, height: 600 }
    ];
    const [selectedCanvasSize, _setSelectedCanvasSize] = useState<CanvasSize>(SQUARE_CANVAS_SIZES[1]); // Default to 400x400

    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;

    // Load data on mount
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            const data = await loadSheetData(sessionId, defaultGrid, defaultColumnWidths);
            setGrid(data.grid);
            setColumnWidths(data.columnWidths);
            setTitle(data.title);
            setTags(data.tags);
            setIsLoading(false);
        };
        loadData();
    }, [sessionId]); // Only run on mount or when sessionId changes

    // Check user permission
    useEffect(() => {
        const checkPermission = async () => {
            if (!user?.id) {
                setIsReadOnly(false); // No user = new document, allow editing
                return;
            }

            try {
                const response = await fetch(`/api/sheets/${sessionId}/permission/${user.id}`);
                const result = await response.json();

                if (result.success) {
                    setUserPermission(result.permission);
                    // Set read-only if user only has view permission
                    setIsReadOnly(result.permission === 'view');
                }
            } catch (error) {
                console.error('Error checking permission:', error);
                setIsReadOnly(false); // Default to editable on error
            }
        };

        checkPermission();
    }, [sessionId, user?.id]);

    // Fetch all user tags for suggestions
    useEffect(() => {
        const fetchUserTags = async () => {
            if (!user?.id) return;
            try {
                const response = await fetch(`/api/sheets/tags/all/${user.id}`);
                const result = await response.json();
                if (result.success) {
                    setAllUserTags(result.data || []);
                }
            } catch (error) {
                console.error('Error fetching user tags:', error);
            }
        };
        fetchUserTags();
    }, [user?.id]);

    // Handle tag changes
    const handleTagsChange = async (newTags: string[]) => {
        setTags(newTags);
        try {
            await fetch(`/api/sheets/${sessionId}/tags`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tags: newTags, userId: user?.id })
            });
        } catch (error) {
            console.error('Error saving tags:', error);
        }
    };

    // Auto-save functionality with debouncing
    const saveTimeoutRef = useRef<number | null>(null);
    const lastSavedDataRef = useRef<string | null>(null);

    // Memoized save function using the storage utility
    const saveToLocalStorage = useCallback(async () => {
        const result = await saveSheetData(sessionId, user?.id || null, title, grid, columnWidths, lastSavedDataRef.current);
        if (result.success && result.serializedData) {
            lastSavedDataRef.current = result.serializedData;
            setIsSaved(true);
        }
    }, [sessionId, title, grid, columnWidths, user?.id]);

    // Mark as unsaved when data changes
    useEffect(() => {
        if (!isLoading) {
            setIsSaved(false);
        }
    }, [grid, columnWidths, title, isLoading]);

    // Debounced auto-save: save after AUTO_SAVE_DEBOUNCE_MS ms of inactivity
    useEffect(() => {
        // Clear any pending save
        if (saveTimeoutRef.current !== null) {
            clearTimeout(saveTimeoutRef.current);
        }

        // Schedule a new save
        saveTimeoutRef.current = window.setTimeout(() => {
            saveToLocalStorage();
        }, AUTO_SAVE_DEBOUNCE_MS);

        // Cleanup on unmount
        return () => {
            if (saveTimeoutRef.current !== null) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [grid, columnWidths, title, saveToLocalStorage]);

    // Calculate total table width and dynamic right padding
    const totalTableWidth = useMemo(() => {
        return columnWidths.slice(0, cols).reduce((sum, width) => sum + width, 0);
    }, [columnWidths, cols]);

    // Dynamic right padding: always provide EXTRA space beyond the table
    // Padding = table width + minimum padding, so there's always room to expand
    const dynamicRightPadding = totalTableWidth + RIGHT_PADDING;

    // Helper function to get the currently focused cell
    const getFocusedCell = useCallback((): { row: number; col: number } | null => {
        const activeElement = document.activeElement;
        if (!activeElement || activeElement.tagName !== 'TEXTAREA') {
            return null;
        }

        // Find which cell this textarea belongs to
        for (let r = 0; r < inputRefs.current.length; r++) {
            for (let c = 0; c < (inputRefs.current[r]?.length ?? 0); c++) {
                if (inputRefs.current[r][c] === activeElement) {
                    return { row: r, col: c };
                }
            }
        }
        return null;
    }, []);

    // Save current state to history before making changes
    const saveToHistory = useCallback((actionDescription: string) => {
        if (isUndoing.current) return; // Don't save history during undo

        setHistory((prev) => {
            const newHistory = [
                ...prev,
                {
                    grid: copyGrid(grid),
                    columnWidths: [...columnWidths],
                    selection: selection,
                    focusedCell: getFocusedCell(),
                    actionDescription
                }
            ];
            // Keep only the last MAX_HISTORY states
            return newHistory.slice(-MAX_HISTORY);
        });
    }, [grid, columnWidths, selection, getFocusedCell]);

    // Undo the last action
    const undo = useCallback(() => {
        if (history.length === 0) return;

        isUndoing.current = true;

        const lastState = history[history.length - 1];
        setGrid(copyGrid(lastState.grid));
        setColumnWidths([...lastState.columnWidths]);
        setSelection(lastState.selection);
        setLastActionDescription(`Undone: ${lastState.actionDescription}`);

        // Remove the last state from history
        setHistory((prev) => prev.slice(0, -1));

        // Restore focus to the cell that was focused when this state was saved
        // Use setTimeout to ensure focus happens after React state updates complete
        setTimeout(() => {
            if (lastState.focusedCell) {
                const { row, col } = lastState.focusedCell;
                const el = inputRefs.current[row]?.[col];
                el?.focus();
                el?.select();
            }
            isUndoing.current = false;
        }, 0);
    }, [history]);

    const canUndo = history.length > 0;

    const ensureRefSize = useCallback((r: number, c: number) => {
        if (!inputRefs.current[r]) inputRefs.current[r] = [];
        if (inputRefs.current[r].length < c) {
            inputRefs.current[r].length = c;
        }
    }, []);
    const addRow = useCallback(() => {
        saveToHistory("Add row");
        setGrid((prev) => {
            const next = copyGrid(prev);
            next.push(Array.from({ length: cols }, () => ""));
            return next;
        });
    }, [cols, saveToHistory]);

    const insertRowAbove = useCallback((rowIndex: number) => {
        saveToHistory(`Insert row above ${rowIndex + 1}`);
        setGrid((prev) => {
            const next = copyGrid(prev);
            next.splice(rowIndex, 0, Array.from({ length: cols }, () => ""));
            return next;
        });
        setContextMenu(null);
    }, [cols, saveToHistory]);

    const insertRowBelow = useCallback((rowIndex: number) => {
        saveToHistory(`Insert row below ${rowIndex + 1}`);
        setGrid((prev) => {
            const next = copyGrid(prev);
            next.splice(rowIndex + 1, 0, Array.from({ length: cols }, () => ""));
            return next;
        });
        setContextMenu(null);
    }, [cols, saveToHistory]);

    // Column operations
    const insertColumnBefore = useCallback((colIndex: number) => {
        saveToHistory(`Insert column before ${colIndex + 1}`);
        setGrid((prev) => {
            const next = copyGrid(prev);
            for (const row of next) {
                row.splice(colIndex, 0, "");
            }
            return next;
        });
        setColumnWidths((prev) => {
            const newWidths = [...prev];
            newWidths.splice(colIndex, 0, DEFAULT_COLUMN_WIDTH);
            return newWidths;
        });
        setColumnContextMenu(null);
    }, [saveToHistory]);

    const insertColumnAfter = useCallback((colIndex: number) => {
        saveToHistory(`Insert column after ${colIndex + 1}`);
        setGrid((prev) => {
            const next = copyGrid(prev);
            for (const row of next) {
                row.splice(colIndex + 1, 0, "");
            }
            return next;
        });
        setColumnWidths((prev) => {
            const newWidths = [...prev];
            newWidths.splice(colIndex + 1, 0, DEFAULT_COLUMN_WIDTH);
            return newWidths;
        });
        setColumnContextMenu(null);
    }, [saveToHistory]);

    const deleteColumn = useCallback((colIndex: number) => {
        // Don't allow deleting if only one column remains
        if (cols <= 1) {
            alert("Cannot delete the last column");
            return;
        }

        saveToHistory(`Delete column ${colIndex + 1}`);
        setGrid((prev) => {
            const next = copyGrid(prev);
            for (const row of next) {
                row.splice(colIndex, 1);
            }
            return next;
        });
        setColumnWidths((prev) => {
            const newWidths = [...prev];
            newWidths.splice(colIndex, 1);
            return newWidths;
        });
        setColumnContextMenu(null);
    }, [cols, saveToHistory]);

    const addCol = useCallback(() => {
        saveToHistory("Add column");
        setGrid((prev) => {
            const next = copyGrid(prev);
            for (const row of next) row.push("");
            return next;
        });
        setColumnWidths((prev) => [...prev, 120]);
    }, [saveToHistory]);

    const isRowEmpty = useCallback((r: number) => grid[r].every((v) => v.trim() === ""), [grid]);
    const isColEmpty = useCallback(
        (c: number) => grid.every((row) => (row[c] ?? "").trim() === ""),
        [grid]
    );
    const maybeAutoExpand = useCallback(
        (r: number, _c: number, value: string) => {
            if (value.trim() === "") return;

            // If user typed in last row and it's not empty, add another row
            if (r === rows - 1 && !isRowEmpty(r)) {
                setGrid((prev) => {
                    const next = copyGrid(prev);
                    next.push(Array.from({ length: cols }, () => ""));
                    return next;
                });
            }
        },
        [cols, rows, isRowEmpty, isColEmpty]
    );

    const setCell = useCallback(
        (r: number, c: number, value: string) => {
            setGrid((prev) => {
                const next = copyGrid(prev);
                next[r][c] = value;
                return next;
            });
            maybeAutoExpand(r, c, value);
        },
        [maybeAutoExpand]
    );

    // Handle cell focus - save the entire state before editing starts
    const handleCellFocus = useCallback((r: number, c: number) => {
        editingCell.current = {
            row: r,
            col: c,
            originalValue: grid[r]?.[c] || '',
            savedState: {
                grid: copyGrid(grid),
                columnWidths: [...columnWidths],
                selection: selection,
                focusedCell: { row: r, col: c },
                actionDescription: `Edit cell ${String.fromCharCode(65 + c)}${r + 1}`
            }
        };
    }, [grid, columnWidths, selection]);

    // Handle cell blur - add saved state to history if value changed
    const handleCellBlur = useCallback((r: number, c: number) => {
        if (editingCell.current &&
            editingCell.current.row === r &&
            editingCell.current.col === c) {
            const currentValue = grid[r]?.[c] || '';
            if (currentValue !== editingCell.current.originalValue) {
                // Add the saved state (from before editing) to history
                if (!isUndoing.current) {
                    const savedState = editingCell.current.savedState;
                    setHistory((prev) => {
                        const newHistory = [...prev, savedState];
                        return newHistory.slice(-MAX_HISTORY);
                    });
                }
            }
            editingCell.current = null;
        }
    }, [grid]);

    const autoResizeTextarea = useCallback((textarea: HTMLTextAreaElement) => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }, []);
    const focusCell = useCallback((r: number, c: number) => {
        // Use requestAnimationFrame to ensure focus happens after React updates
        requestAnimationFrame(() => {
            const el = inputRefs.current[r]?.[c];
            if (el) {
                el.focus();
                el.select();
            }
        });
    }, []);

    // Paste handler for clipboard data from spreadsheets
    const handlePaste = useCallback(
        (e: React.ClipboardEvent<HTMLTextAreaElement>, startRow: number, startCol: number) => {
            e.preventDefault();

            // Get clipboard data
            const pastedText = e.clipboardData.getData('text');

            if (!pastedText || pastedText.trim() === '') {
                return; // Empty clipboard
            }

            // Save history before paste
            saveToHistory("Paste");

            // Parse TSV data (tab-separated values from spreadsheets)
            // Rows are separated by newlines, columns by tabs
            const rows = pastedText.split('\n').map(row => row.split('\t'));

            // Remove trailing empty row if present (common when copying from spreadsheets)
            if (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
                rows.pop();
            }

            if (rows.length === 0) {
                return; // No data to paste
            }

            const pasteRowCount = rows.length;
            const pasteColCount = Math.max(...rows.map(row => row.length));

            // Calculate how many rows and columns we need
            const requiredRows = startRow + pasteRowCount;
            const requiredCols = startCol + pasteColCount;

            // Expand grid if necessary
            setGrid((prev) => {
                let next = copyGrid(prev);

                // Add rows if needed
                while (next.length < requiredRows) {
                    next.push(Array.from({ length: next[0]?.length ?? 0 }, () => ""));
                }

                // Add columns if needed
                const currentCols = next[0]?.length ?? 0;
                if (currentCols < requiredCols) {
                    const colsToAdd = requiredCols - currentCols;
                    for (const row of next) {
                        for (let i = 0; i < colsToAdd; i++) {
                            row.push("");
                        }
                    }
                    // Update column widths
                    setColumnWidths((prevWidths) => [
                        ...prevWidths,
                        ...Array(colsToAdd).fill(120)
                    ]);
                }

                // Populate the grid with pasted data
                for (let r = 0; r < pasteRowCount; r++) {
                    for (let c = 0; c < rows[r].length; c++) {
                        const targetRow = startRow + r;
                        const targetCol = startCol + c;
                        if (targetRow < next.length && targetCol < next[targetRow].length) {
                            next[targetRow][targetCol] = rows[r][c] || '';
                        }
                    }
                }

                return next;
            });

            // After pasting, focus on the cell after the pasted range
            // This matches Excel/Google Sheets behavior
            setTimeout(() => {
                const lastRow = Math.min(startRow + pasteRowCount - 1, grid.length - 1);
                const lastCol = Math.min(startCol + pasteColCount - 1, (grid[0]?.length ?? 1) - 1);
                focusCell(lastRow, lastCol);
            }, 50);
        },
        [grid, focusCell]
    );

    // Memoized Set of selected cell keys for O(1) lookup - huge performance improvement
    const selectedCellsSet = useMemo(() => {
        const set = new Set<string>();
        if (!selection) return set;

        const minRow = Math.min(selection.startRow, selection.endRow);
        const maxRow = Math.max(selection.startRow, selection.endRow);
        const minCol = Math.min(selection.startCol, selection.endCol);
        const maxCol = Math.max(selection.startCol, selection.endCol);

        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                set.add(`${r}-${c}`);
            }
        }
        return set;
    }, [selection]);

    // Helper function to check if a cell is in the selection - now O(1) instead of O(1) but with Set lookup
    const isCellSelected = useCallback((row: number, col: number): boolean => {
        return selectedCellsSet.has(`${row}-${col}`);
    }, [selectedCellsSet]);

    // Get selected cells data as TSV
    const getSelectedDataAsTSV = useCallback((): string => {
        if (!selection) return '';

        const minRow = Math.min(selection.startRow, selection.endRow);
        const maxRow = Math.max(selection.startRow, selection.endRow);
        const minCol = Math.min(selection.startCol, selection.endCol);
        const maxCol = Math.max(selection.startCol, selection.endCol);

        const selectedData: string[] = [];
        for (let r = minRow; r <= maxRow; r++) {
            const rowData: string[] = [];
            for (let c = minCol; c <= maxCol; c++) {
                rowData.push(grid[r]?.[c] || '');
            }
            selectedData.push(rowData.join('\t'));
        }
        return selectedData.join('\n');
    }, [selection, grid]);

    // Copy selected cells
    const handleCopy = useCallback(() => {
        if (!selection) return;
        const data = getSelectedDataAsTSV();
        navigator.clipboard.writeText(data);
    }, [selection, getSelectedDataAsTSV]);

    // Cut selected cells
    const handleCut = useCallback(() => {
        if (!selection) return;

        saveToHistory("Cut");

        const data = getSelectedDataAsTSV();
        navigator.clipboard.writeText(data);

        // Clear the selected cells
        const minRow = Math.min(selection.startRow, selection.endRow);
        const maxRow = Math.max(selection.startRow, selection.endRow);
        const minCol = Math.min(selection.startCol, selection.endCol);
        const maxCol = Math.max(selection.startCol, selection.endCol);

        setGrid((prev) => {
            const next = copyGrid(prev);
            for (let r = minRow; r <= maxRow; r++) {
                for (let c = minCol; c <= maxCol; c++) {
                    if (next[r] && next[r][c] !== undefined) {
                        next[r][c] = '';
                    }
                }
            }
            return next;
        });
    }, [selection, getSelectedDataAsTSV, saveToHistory]);

    // Delete selected cells
    const handleDelete = useCallback(() => {
        if (!selection) return;

        saveToHistory("Delete");

        const minRow = Math.min(selection.startRow, selection.endRow);
        const maxRow = Math.max(selection.startRow, selection.endRow);
        const minCol = Math.min(selection.startCol, selection.endCol);
        const maxCol = Math.max(selection.startCol, selection.endCol);

        setGrid((prev) => {
            const next = copyGrid(prev);
            for (let r = minRow; r <= maxRow; r++) {
                for (let c = minCol; c <= maxCol; c++) {
                    if (next[r] && next[r][c] !== undefined) {
                        next[r][c] = '';
                    }
                }
            }
            return next;
        });
    }, [selection, saveToHistory]);

    // Image handlers
    const handleAddImage = useCallback((row: number, col: number) => {
        setImageTargetCell({ row, col });
        setImageModalOpen(true);
    }, []);

    const handleImageSelect = useCallback((imageData: string) => {
        if (imageTargetCell) {
            saveToHistory('Add image');
            const { row, col } = imageTargetCell;
            setGrid((prev) => {
                const next = copyGrid(prev);
                const currentValue = next[row][col];
                next[row][col] = insertImageIntoCell(currentValue, imageData);
                return next;
            });
        }
        setImageModalOpen(false);
        setImageTargetCell(null);
    }, [imageTargetCell, saveToHistory]);

    // Drawing handlers
    const handleAddDrawing = useCallback((row: number, col: number) => {
        setDrawingTargetCell({ row, col });
        setDrawingModalOpen(true);
    }, []);

    const handleDrawingSave = useCallback(async (blob: Blob, _hasBorder: boolean, _size: CanvasSize) => {
        if (!drawingTargetCell) return;

        try {
            // Upload drawing to Supabase Storage
            const formData = new FormData();
            formData.append('drawing', blob, 'drawing.png');
            formData.append('userId', user?.id || 'anonymous');
            formData.append('sessionId', sessionId);

            const response = await fetch('/api/storage/upload-drawing', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (!result.success) {
                console.error('Failed to upload drawing:', result.error);
                alert('Failed to save drawing. Please try again.');
                return;
            }

            const imageUrl = result.url;

            // Create image data URL with border styling
            const imageData = imageUrl;

            saveToHistory('Add drawing');
            const { row, col } = drawingTargetCell;
            setGrid((prev) => {
                const next = copyGrid(prev);
                const currentValue = next[row][col];
                next[row][col] = insertImageIntoCell(currentValue, imageData);
                return next;
            });

            setDrawingModalOpen(false);
            setDrawingTargetCell(null);
        } catch (error) {
            console.error('Error uploading drawing:', error);
            alert('Failed to save drawing. Please try again.');
        }
    }, [drawingTargetCell, saveToHistory, user?.id, sessionId]);

    // Column header right-click handler
    const handleColumnContextMenu = useCallback((e: React.MouseEvent, colIndex: number) => {
        e.preventDefault();
        e.stopPropagation();

        setColumnContextMenu({
            x: e.clientX,
            y: e.clientY,
            colIndex
        });
        setContextMenu(null); // Close row context menu if open
    }, []);

    // Mouse selection handlers
    const handleMouseDown = useCallback((e: React.MouseEvent, row: number, col: number) => {
        // Close context menus if open
        setContextMenu(null);
        setColumnContextMenu(null);

        // Start potential selection - but don't create selection yet
        // Only create selection if user drags beyond threshold
        e.preventDefault();
        setIsSelecting(true);
        selectionStart.current = { row, col };
        dragStartPos.current = { x: e.clientX, y: e.clientY };
        hasDragged.current = false;
        // Don't set selection yet - wait for drag beyond threshold
    }, []);

    const handleMouseUp = useCallback((row: number, col: number) => {
        // Don't rely on isSelecting state - use selectionStart ref instead
        // because the state might be stale in the callback closure
        if (selectionStart.current) {
            // Check if clicking on an already-selected cell from a PREVIOUS selection
            const clickedCellIsSelected = isCellSelected(row, col);
            const wasPreviousSelection = clickedCellIsSelected && !hasDragged.current;

            // If clicking on a cell from a previous selection (not from current drag), clear and edit
            if (wasPreviousSelection && selection) {
                setSelection(null);
                focusCell(row, col);
            }
            // If we dragged beyond threshold, keep the selection (even if it's 1x1)
            else if (hasDragged.current) {
                // Keep the selection that was set in the mousemove handler
                // Don't focus any cell - just keep the selection visible
                // Set flag to ignore the next click event (which will fire after mouseup)
                justCompletedDrag.current = true;
            }
            // If no drag happened (didn't move beyond threshold), it's a single click - focus the cell
            else {
                setSelection(null);
                focusCell(row, col);
            }
        }

        setIsSelecting(false);
        selectionStart.current = null;
        dragStartPos.current = null;
        hasDragged.current = false;
    }, [selection, focusCell, isCellSelected]);

    // Global mouse up listener to end selection
    React.useEffect(() => {
        const handleGlobalMouseUp = () => {
            setIsSelecting(false);
        };

        if (isSelecting) {
            document.addEventListener('mouseup', handleGlobalMouseUp);
            return () => {
                document.removeEventListener('mouseup', handleGlobalMouseUp);
            };
        }
    }, [isSelecting]);

    // Global mousemove handler for drag selection
    React.useEffect(() => {
        if (!isSelecting) return;

        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (!selectionStart.current || !dragStartPos.current) return;

            // Calculate distance from drag start position
            const dx = e.clientX - dragStartPos.current.x;
            const dy = e.clientY - dragStartPos.current.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Only start selection if we've moved beyond the threshold
            if (distance < DRAG_THRESHOLD) return;

            // Find which element is under the mouse
            const element = document.elementFromPoint(e.clientX, e.clientY);
            if (!element) return;

            // Check if it's a selection layer or inside a cell
            const cell = element.closest('.sheet_cell') as HTMLElement;
            if (!cell) return;

            // Get the cell's row and column from data attributes
            const rowStr = cell.getAttribute('data-row');
            const colStr = cell.getAttribute('data-col');
            if (rowStr === null || colStr === null) return;

            const row = parseInt(rowStr, 10);
            const col = parseInt(colStr, 10);

            // Mark that we've dragged beyond threshold
            // If this is the first time we're dragging, blur any focused cell to stop editing
            if (!hasDragged.current) {
                // Blur the currently focused element (if it's a textarea)
                if (document.activeElement instanceof HTMLTextAreaElement) {
                    document.activeElement.blur();
                }
            }
            hasDragged.current = true;

            // Update selection
            setSelection({
                startRow: selectionStart.current.row,
                startCol: selectionStart.current.col,
                endRow: row,
                endCol: col
            });
        };

        document.addEventListener('mousemove', handleGlobalMouseMove);
        return () => {
            document.removeEventListener('mousemove', handleGlobalMouseMove);
        };
    }, [isSelecting, DRAG_THRESHOLD]);

    // Global click handler to clear selection when clicking outside the grid
    React.useEffect(() => {
        const handleGlobalClick = (e: MouseEvent) => {
            // If we just completed a drag, ignore this click event
            if (justCompletedDrag.current) {
                justCompletedDrag.current = false;
                return;
            }

            if (!selection) return;

            const target = e.target as HTMLElement;
            // Check if click is outside the grid (not on a cell, textarea, or selection layer)
            const isClickInsideGrid = target.closest('.sheet_cell') ||
                                     target.closest('.sheet_input') ||
                                     target.closest('.sheet_selection_layer');

            if (!isClickInsideGrid) {
                setSelection(null);
            }
        };

        document.addEventListener('click', handleGlobalClick);
        return () => {
            document.removeEventListener('click', handleGlobalClick);
        };
    }, [selection]);

    // Global paste handler for selections
    const handleGlobalPaste = useCallback(async () => {
        if (!selection) return;

        try {
            const pastedText = await navigator.clipboard.readText();

            if (!pastedText || pastedText.trim() === '') {
                return;
            }

            saveToHistory("Paste");

            // Parse TSV data
            const rows = pastedText.split('\n').map(row => row.split('\t'));

            // Remove trailing empty row if present
            if (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
                rows.pop();
            }

            if (rows.length === 0) {
                return;
            }

            const pasteRowCount = rows.length;
            const pasteColCount = Math.max(...rows.map(row => row.length));

            // Use the top-left corner of the selection as the start point
            const startRow = Math.min(selection.startRow, selection.endRow);
            const startCol = Math.min(selection.startCol, selection.endCol);

            // Calculate how many rows and columns we need
            const requiredRows = startRow + pasteRowCount;
            const requiredCols = startCol + pasteColCount;

            setGrid((prev) => {
                let next = copyGrid(prev);

                // Expand grid if needed
                while (next.length < requiredRows) {
                    next.push(Array(next[0].length).fill(''));
                }
                while (next[0].length < requiredCols) {
                    next = next.map(row => [...row, '']);
                }

                // Paste the data
                for (let r = 0; r < pasteRowCount; r++) {
                    for (let c = 0; c < rows[r].length; c++) {
                        const targetRow = startRow + r;
                        const targetCol = startCol + c;
                        if (targetRow < next.length && targetCol < next[0].length) {
                            next[targetRow][targetCol] = rows[r][c] || '';
                        }
                    }
                }

                return next;
            });

            // Update column widths if we added columns
            if (requiredCols > columnWidths.length) {
                setColumnWidths(prev => {
                    const newWidths = [...prev];
                    while (newWidths.length < requiredCols) {
                        newWidths.push(DEFAULT_COLUMN_WIDTH);
                    }
                    return newWidths;
                });
            }

            // Clear selection after paste
            setSelection(null);
        } catch (error) {
            console.error('Failed to paste:', error);
        }
    }, [selection, saveToHistory, columnWidths]);

    // Global keyboard listener for selection operations and undo
    React.useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            // Handle undo (Ctrl+Z or Cmd+Z)
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
                return;
            }

            if (!selection) return;

            // Handle Escape to clear selection
            if (e.key === 'Escape') {
                e.preventDefault();
                setSelection(null);
                return;
            }

            // Handle copy, cut, paste, delete for selections
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
                e.preventDefault();
                handleCopy();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
                e.preventDefault();
                handleCut();
            } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
                e.preventDefault();
                handleGlobalPaste();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                // Only handle if not focused on a textarea
                const activeElement = document.activeElement;
                if (activeElement?.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    handleDelete();
                }
            }
        };

        document.addEventListener('keydown', handleGlobalKeyDown);
        return () => {
            document.removeEventListener('keydown', handleGlobalKeyDown);
        };
    }, [selection, handleCopy, handleCut, handleDelete, handleGlobalPaste, undo]);

    //Keyboard Inputs
    const onKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>, r: number, c: number) => {
            const key = e.key;
            const textarea = e.currentTarget;
            const value = textarea.value;
            const selectionStart = textarea.selectionStart;
            const selectionEnd = textarea.selectionEnd;
            const hasSelection = selectionStart !== selectionEnd;

            // Handle copy, cut, delete for selections
            if (selection && (e.ctrlKey || e.metaKey)) {
                if (key.toLowerCase() === 'c') {
                    e.preventDefault();
                    handleCopy();
                    return;
                } else if (key.toLowerCase() === 'x') {
                    e.preventDefault();
                    handleCut();
                    return;
                }
            }

            if (selection && (key === 'Delete' || key === 'Backspace')) {
                e.preventDefault();
                handleDelete();
                return;
            }

            // Tab navigation (always moves between cells)
            if (key === "Tab") {
                e.preventDefault();
                if (e.shiftKey) {
                    // Move left
                    if (c > 0) {
                        focusCell(r, c - 1);
                    } else if (r > 0) {
                        // Wrap to end of previous row
                        focusCell(r - 1, (grid[0]?.length ?? 1) - 1);
                    }
                } else {
                    // Move right
                    if (c < (grid[0]?.length ?? 1) - 1) {
                        focusCell(r, c + 1);
                    } else if (r < grid.length - 1) {
                        // Wrap to start of next row
                        focusCell(r + 1, 0);
                    }
                }
                setSelection(null);
                return;
            }

            // Enter navigation
            if (key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                focusCell(Math.min(r + 1, grid.length - 1), c);
                setSelection(null);
                return;
            }

            // Arrow key navigation
            // Navigate if: Ctrl is held, OR cursor is at edge of content, OR cell is empty
            if (key === "ArrowDown") {
                // Navigate down if Ctrl held, or cursor at end of text, or no text
                if (e.ctrlKey || selectionStart === value.length || value === '') {
                    e.preventDefault();
                    focusCell(Math.min(r + 1, grid.length - 1), c);
                    setSelection(null);
                }
            } else if (key === "ArrowUp") {
                // Navigate up if Ctrl held, or cursor at start of text, or no text
                if (e.ctrlKey || selectionStart === 0 || value === '') {
                    e.preventDefault();
                    focusCell(Math.max(r - 1, 0), c);
                    setSelection(null);
                }
            } else if (key === "ArrowRight") {
                // Navigate right if Ctrl held, or cursor at end (no text selection)
                if (e.ctrlKey || (!hasSelection && selectionStart === value.length)) {
                    e.preventDefault();
                    focusCell(r, Math.min(c + 1, (grid[0]?.length ?? 1) - 1));
                    setSelection(null);
                }
            } else if (key === "ArrowLeft") {
                // Navigate left if Ctrl held, or cursor at start (no text selection)
                if (e.ctrlKey || (!hasSelection && selectionStart === 0)) {
                    e.preventDefault();
                    focusCell(r, Math.max(c - 1, 0));
                    setSelection(null);
                }
            } else if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === "c") {
                // Let default copy happen (or handled above for selections)
            }
        },
        [focusCell, grid, selection, handleCopy, handleCut, handleDelete]
    );
    const colHeaders = useMemo(() => {
        // A, B, C... Z, AA...
        const toName = (n: number) => {
            let s = "";
            let x = n + 1;
            while (x > 0) {
                const m = (x - 1) % 26;
                s = String.fromCharCode(65 + m) + s;
                x = Math.floor((x - 1) / 26);
            }
            return s;
        };
        return Array.from({ length: cols }, (_, i) => toName(i));
    }, [cols]);

    // Column resizing handlers
    const handleResizeStart = useCallback((e: React.MouseEvent, colIndex: number) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent event from bubbling to header

        // Save history before resize
        saveToHistory(`Resize column ${String.fromCharCode(65 + colIndex)}`);

        setResizingColumn(colIndex);
        resizeStartX.current = e.clientX;
        resizeStartWidth.current = columnWidths[colIndex];
    }, [columnWidths, saveToHistory]);

    const handleResizeMove = useCallback((e: MouseEvent) => {
        if (resizingColumn === null) return;

        const delta = e.clientX - resizeStartX.current;
        const newWidth = Math.max(50, resizeStartWidth.current + delta);
        setColumnWidths((prev) => {
            const next = [...prev];
            next[resizingColumn] = newWidth;
            return next;
        });
    }, [resizingColumn]);

    const handleResizeEnd = useCallback(() => {
        setResizingColumn(null);
    }, []);

    // Attach global mouse listeners for column resizing
    React.useEffect(() => {
        if (resizingColumn !== null) {
            document.addEventListener('mousemove', handleResizeMove);
            document.addEventListener('mouseup', handleResizeEnd);
            return () => {
                document.removeEventListener('mousemove', handleResizeMove);
                document.removeEventListener('mouseup', handleResizeEnd);
            };
        }
    }, [resizingColumn, handleResizeMove, handleResizeEnd]);

    // Close context menu when clicking elsewhere or pressing Escape
    React.useEffect(() => {
        if (!contextMenu) return;

        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Close if clicking outside the context menus and not on headers
            if (!target.closest('.sheet_context_menu') && !target.closest('.sheet_rowHeader') && !target.closest('.sheet_colHeader')) {
                setContextMenu(null);
                setColumnContextMenu(null);
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setContextMenu(null);
                setColumnContextMenu(null);
            }
        };

        // Use a small delay to prevent the same click that opened the menu from closing it
        const timeoutId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }, 0);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [contextMenu]);

    // Keep refs to inputs for keyboard navigation
    const inputRefs = useRef<(HTMLTextAreaElement | null)[][]>([]);

    // Show loading screen while data is loading
    if (isLoading) {
        return <LoadingScreen type="sheet" message="Loading sheet..." />;
    }

    return (
        <div className="sheet_container">
            <div className="sheet_sticky_header">
                <div className="sheet_title_bar">
                    <DocumentHeader
                        title={title}
                        onTitleChange={setTitle}
                        isSaved={isSaved}
                        placeholder="Untitled Sheet"
                        savedText="✓ Saved"
                        unsavedText="● Unsaved"
                        readOnly={isReadOnly}
                        permission={userPermission as 'owner' | 'editor' | 'view' | null}
                    />
                    <TagInput
                        tags={tags}
                        onTagsChange={handleTagsChange}
                        readOnly={isReadOnly}
                        placeholder="Add tags..."
                        suggestions={allUserTags}
                    />
                </div>
                <div className="sheet_toolbar">
                    <button className="sheet_btn" onClick={addRow} disabled={isReadOnly}>+ Row</button>
                    <button className="sheet_btn" onClick={addCol} disabled={isReadOnly}>+ Column</button>
                    <button
                        className="sheet_btn"
                        onClick={undo}
                        disabled={!canUndo || isReadOnly}
                        title={canUndo ? "Undo (Ctrl+Z / ⌘+Z)" : "Nothing to undo"}
                    >
                        ↶ Undo
                    </button>
                    <button
                        className="sheet_btn sheet_btn_publish"
                        onClick={() => setPublishModalOpen(true)}
                        title="Publish to Discover"
                    >
                        📢 Publish
                    </button>
                    <div className="sheet_hint">
                        {isReadOnly ? "View-only mode - You cannot edit this sheet" : (lastActionDescription || "Tip: type in last row/col to auto-expand")}
                    </div>
                </div>
            </div>

            <div className="sheet_wrap">
                <div style={{ paddingRight: `${dynamicRightPadding}px` }}>
                    <table className="sheet_table">
                    <thead>
                        <tr>
                            <th className="sheet_corner" />
                            {colHeaders.map((h, colIndex) => (
                                <th
                                    key={h}
                                    className={'sheet_colHeader'}
                                    style={{ width: columnWidths[colIndex] }}
                                    onContextMenu={(e) => handleColumnContextMenu(e, colIndex)}
                                >
                                    {/* Left resize handle - resizes the PREVIOUS column (to the left) */}
                                    {colIndex > 0 && (
                                        <div
                                            className="sheet_resize_handle sheet_resize_handle_left"
                                            onMouseDown={(e) => handleResizeStart(e, colIndex - 1)}
                                        />
                                    )}
                                    <div className="sheet_colHeader_content">
                                        <span>{h}</span>
                                    </div>
                                    {/* Right resize handle - resizes the CURRENT column */}
                                    <div
                                        className="sheet_resize_handle sheet_resize_handle_right"
                                        onMouseDown={(e) => handleResizeStart(e, colIndex)}
                                    />
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {grid.map((row, r) => {
                            // Ensure ref array exists for this row
                            ensureRefSize(r, cols);

                            return (
                                <tr key={r}>
                                    <th
                                        className="sheet_rowHeader"
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            setContextMenu({
                                                x: e.clientX,
                                                y: e.clientY,
                                                rowIndex: r
                                            });
                                        }}
                                    >
                                        {r + 1}
                                    </th>

                                    {row.map((value, c) => {
                                        const isSelected = selectedCellsSet.has(`${r}-${c}`);

                                        return (
                                            <Cell
                                                key={`${r}-${c}`}
                                                row={r}
                                                col={c}
                                                value={value}
                                                isSelected={isSelected}
                                                columnWidth={columnWidths[c]}
                                                inputRef={(el) => {
                                                    inputRefs.current[r][c] = el;
                                                }}
                                                onChange={(newValue) => setCell(r, c, newValue)}
                                                onKeyDown={(e) => onKeyDown(e, r, c)}
                                                onPaste={(e) => handlePaste(e, r, c)}
                                                onFocus={() => {
                                                    if (!selectedCellsSet.has(`${r}-${c}`)) {
                                                        setSelection(null);
                                                    }
                                                    handleCellFocus(r, c);
                                                }}
                                                onBlur={() => handleCellBlur(r, c)}
                                                onMouseDown={(e) => handleMouseDown(e, r, c)}
                                                onMouseUp={() => handleMouseUp(r, c)}
                                                autoResizeTextarea={autoResizeTextarea}
                                                onAddImage={handleAddImage}
                                                onAddDrawing={handleAddDrawing}
                                                isHeaderRow={r === 0}
                                                readOnly={isReadOnly}
                                            />
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                </div>
            </div>

            {/* optional debug */}
            <pre className="sheet_debug">{JSON.stringify(grid, null, 2)}</pre>

            {/* Context menu for row operations */}
            {contextMenu && (
                <div
                    className="sheet_context_menu"
                    style={{
                        position: 'fixed',
                        left: contextMenu.x,
                        top: contextMenu.y,
                        zIndex: 1000
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        className="sheet_context_menu_item"
                        onClick={() => insertRowAbove(contextMenu.rowIndex)}
                    >
                        Insert Row Above
                    </button>
                    <button
                        className="sheet_context_menu_item"
                        onClick={() => insertRowBelow(contextMenu.rowIndex)}
                    >
                        Insert Row Below
                    </button>
                </div>
            )}

            {/* Context menu for column operations */}
            {columnContextMenu && (
                <div
                    className="sheet_context_menu"
                    style={{
                        position: 'fixed',
                        left: columnContextMenu.x,
                        top: columnContextMenu.y,
                        zIndex: 1000
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        className="sheet_context_menu_item"
                        onClick={() => insertColumnBefore(columnContextMenu.colIndex)}
                    >
                        Insert Column Before
                    </button>
                    <button
                        className="sheet_context_menu_item"
                        onClick={() => insertColumnAfter(columnContextMenu.colIndex)}
                    >
                        Insert Column After
                    </button>
                    <button
                        className="sheet_context_menu_item sheet_context_menu_item_danger"
                        onClick={() => deleteColumn(columnContextMenu.colIndex)}
                    >
                        Delete Column
                    </button>
                </div>
            )}

            {/* Image upload modal */}
            <ImageUploadModal
                isOpen={imageModalOpen}
                onClose={() => {
                    setImageModalOpen(false);
                    setImageTargetCell(null);
                }}
                onImageSelect={handleImageSelect}
            />

            {/* Drawing modal */}
            <DrawingModal
                isOpen={drawingModalOpen}
                onClose={() => {
                    setDrawingModalOpen(false);
                    setDrawingTargetCell(null);
                }}
                onSave={handleDrawingSave}
                canvasSize={selectedCanvasSize}
                availableSizes={SQUARE_CANVAS_SIZES}
                title="Drawing Canvas (Square)"
            />

            {/* Publish modal */}
            {publishModalOpen && user && (
                <PublishModal
                    isOpen={publishModalOpen}
                    onClose={() => setPublishModalOpen(false)}
                    sessionId={sessionId}
                    contentType="sheet"
                    currentUserId={user.id}
                    currentTitle={title}
                    currentTags={tags}
                />
            )}
        </div>
    )
}

export default InputGrid