/**
 * Sheet Viewer Component
 * Read-only view of sheet content with proper image and text rendering
 */

import './SheetViewer.css'

export interface SheetViewerProps {
    rows: { data: string[] }[]
    columnWidths?: number[]
}

// Parse cell content to extract text and images (same logic as InputGrid)
function parseCellContent(value: string): { text: string; images: string[] } {
    if (!value) return { text: '', images: [] }
    const imageRegex = /\|\|\|IMG:([^|]+)\|\|\|/g
    const images: string[] = []
    let match

    while ((match = imageRegex.exec(value)) !== null) {
        images.push(match[1])
    }

    // Remove image markers from text
    const text = value.replace(imageRegex, '').replace(/^\n+|\n+$/g, '')

    return { text, images }
}

function SheetViewer({ rows, columnWidths }: SheetViewerProps) {
    if (!rows || rows.length === 0) {
        return (
            <div className="sheet-viewer-empty">
                <p>No data to display</p>
            </div>
        )
    }

    // Limit display to 100 rows for performance
    const displayRows = rows.slice(0, 100)
    const hasMoreRows = rows.length > 100

    return (
        <div className="sheet-viewer">
            <div className="sheet-viewer-table-wrapper">
                <table className="sheet-viewer-table">
                    <tbody>
                        {displayRows.map((row, rowIdx) => (
                            <tr key={rowIdx} className={rowIdx === 0 ? 'sheet-viewer-header-row' : ''}>
                                {row.data.map((cell, colIdx) => {
                                    const { text, images } = parseCellContent(cell || '')
                                    const width = columnWidths?.[colIdx] || 120

                                    return (
                                        <td 
                                            key={colIdx} 
                                            style={{ minWidth: width, maxWidth: width * 2 }}
                                            className="sheet-viewer-cell"
                                        >
                                            {images.length > 0 && (
                                                <div className="sheet-viewer-cell-images">
                                                    {images.map((imgSrc, idx) => (
                                                        <img 
                                                            key={idx} 
                                                            src={imgSrc} 
                                                            alt="" 
                                                            className="sheet-viewer-cell-image"
                                                            loading="lazy"
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                            {text && (
                                                <span className="sheet-viewer-cell-text">{text}</span>
                                            )}
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {hasMoreRows && (
                <p className="sheet-viewer-truncated">
                    Showing first 100 of {rows.length} rows
                </p>
            )}
        </div>
    )
}

export default SheetViewer

