/**
 * Note Viewer Component
 * Read-only view of note content with Quill rendering
 * Supports embedded drawings and attachments
 */

import { useEffect, useRef } from 'react'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'
import { type DrawingData, type FileAttachment } from '../notes/noteStorage'

export interface NoteViewerProps {
    html: string
    drawings?: DrawingData[]
    attachments?: FileAttachment[]
}

function NoteViewer({ html, drawings, attachments }: NoteViewerProps) {
    const editorRef = useRef<HTMLDivElement>(null)
    const quillRef = useRef<Quill | null>(null)

    // Initialize Quill in read-only mode
    useEffect(() => {
        if (!editorRef.current || quillRef.current) return

        quillRef.current = new Quill(editorRef.current, {
            theme: 'snow',
            readOnly: true,
            modules: {
                toolbar: false
            }
        })

        // Set the HTML content
        if (html) {
            quillRef.current.root.innerHTML = html
        }

        return () => {
            quillRef.current = null
        }
    }, [])

    // Update content when html changes
    useEffect(() => {
        if (quillRef.current && html) {
            quillRef.current.root.innerHTML = html
        }
    }, [html])

    return (
        <div className="note-viewer">
            {/* Drawings section */}
            {drawings && drawings.length > 0 && (
                <div className="note-viewer-drawings">
                    {drawings.map((drawing, index) => (
                        <div key={index} className="note-viewer-drawing">
                            <img src={drawing.url} alt={`Drawing ${index + 1}`} />
                        </div>
                    ))}
                </div>
            )}

            {/* Quill editor content */}
            <div className="note-viewer-content">
                <div ref={editorRef}></div>
            </div>

            {/* Attachments section */}
            {attachments && attachments.length > 0 && (
                <div className="note-viewer-attachments">
                    <h4>Attachments</h4>
                    <ul>
                        {attachments.map((attachment, index) => (
                            <li key={index}>
                                <a href={attachment.url} target="_blank" rel="noopener noreferrer">
                                    📎 {attachment.name} ({(attachment.size / 1024).toFixed(1)} KB)
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}

export default NoteViewer

