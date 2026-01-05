/**
 * Notes Component - Comprehensive Rich Text Note-Taking Application
 *
 * Features:
 * - Google Docs-style rich text editor with Quill.js
 * - Auto-save with debouncing (1 second delay)
 * - Session-based localStorage persistence
 * - Rich formatting: Bold, Italic, Underline, Strike-through
 * - Font customization: Family, Size, Color, Background
 * - Text alignment and indentation
 * - Lists: Ordered and Bulleted
 * - Headers (H1-H6) for document structure
 * - Code blocks and inline code
 * - Blockquotes
 * - Links, Images, Videos
 * - LaTeX math equations (inline and block)
 * - Drawing canvas with save functionality
 * - Undo/Redo support
 * - Copy/paste with formatting preservation
 * - Paper-like document appearance
 * - Responsive design for mobile and desktop
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'
import 'katex/dist/katex.min.css'
import './notes.css'
import Header from '../header/header.tsx'
import {
    loadNoteData,
    saveNoteData,
    AUTO_SAVE_DEBOUNCE_MS,
    type DrawingData,
    type FileAttachment
} from './noteStorage'

// Register KaTeX module for math equations
// @ts-ignore - Quill modules don't have proper types
import katex from 'katex'
// @ts-ignore
window.katex = katex

// ============ CUSTOM QUILL BLOT FOR FILE ATTACHMENTS ============

// @ts-ignore - Quill blot types are incomplete
const BlockEmbed = Quill.import('blots/block/embed')

// Helper function to format file size
function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

// @ts-ignore - Extending Quill blot
class FileAttachmentBlot extends BlockEmbed {
    static blotName = 'fileAttachment'
    static tagName = 'div'
    static className = 'file-attachment'

    // @ts-ignore
    static create(value: { id: string; name: string; dataURL: string; size: number }) {
        // @ts-ignore
        const node = super.create() as HTMLElement
        node.setAttribute('contenteditable', 'false')
        node.setAttribute('data-file-id', value.id)
        node.setAttribute('data-file-name', value.name)
        node.setAttribute('data-file-url', value.dataURL)
        node.setAttribute('data-file-size', value.size.toString())

        // Create download link
        const link = document.createElement('a')
        link.href = value.dataURL
        link.download = value.name
        link.className = 'file-attachment-link'
        link.innerHTML = `
            <span class="file-icon">📎</span>
            <span class="file-name">${value.name}</span>
            <span class="file-size">(${formatFileSize(value.size)})</span>
        `

        node.appendChild(link)
        return node
    }

    // @ts-ignore
    static value(node: HTMLElement) {
        return {
            id: node.getAttribute('data-file-id'),
            name: node.getAttribute('data-file-name'),
            dataURL: node.getAttribute('data-file-url'),
            size: parseInt(node.getAttribute('data-file-size') || '0')
        }
    }
}

// @ts-ignore
Quill.register(FileAttachmentBlot)

// ============ TYPE DEFINITIONS ============

type DrawingTool = 'brush' | 'line' | 'circle' | 'square' | 'bucket'

function Notes() {
    const { sessionId } = useParams<{ sessionId?: string }>()
    const navigate = useNavigate()

    // State
    const [title, setTitle] = useState('Untitled Document')
    const [content, setContent] = useState('')
    const [isSaved, setIsSaved] = useState(true)
    const [showDrawing, setShowDrawing] = useState(false)
    const [drawings, setDrawings] = useState<DrawingData[]>([])
    const [attachments, setAttachments] = useState<FileAttachment[]>([])
    const [isDataLoaded, setIsDataLoaded] = useState(false)

    // Drawing tool state
    const [currentTool, setCurrentTool] = useState<DrawingTool>('brush')
    const [brushSize, setBrushSize] = useState(2)
    const [brushColor, setBrushColor] = useState('#000000')
    const [hasBorder, setHasBorder] = useState(true)
    const [editingDrawingIndex, setEditingDrawingIndex] = useState<number | null>(null)

    // Refs
    const quillRef = useRef<Quill | null>(null)
    const editorRef = useRef<HTMLDivElement>(null)
    const saveTimeoutRef = useRef<number | undefined>(undefined)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const isDrawingRef = useRef(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const startPosRef = useRef<{ x: number; y: number } | null>(null)
    const canvasSnapshotRef = useRef<ImageData | null>(null)

    // Generate session ID if not present
    useEffect(() => {
        if (!sessionId) {
            const newSessionId = crypto.randomUUID()
            navigate(`/notes/${newSessionId}`, { replace: true })
        } else {
            // Reset data loaded flag when session changes
            setIsDataLoaded(false)
        }
    }, [sessionId, navigate])

    // Initialize Quill editor (only once)
    useEffect(() => {
        if (!editorRef.current || quillRef.current) return

        const quill = new Quill(editorRef.current, {
            theme: 'snow',
            modules: {
                toolbar: {
                    container: [
                        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                        [{ 'font': [] }],
                        [{ 'size': ['small', false, 'large', 'huge'] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'color': [] }, { 'background': [] }],
                        [{ 'script': 'sub' }, { 'script': 'super' }],
                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                        [{ 'indent': '-1' }, { 'indent': '+1' }],
                        [{ 'align': [] }],
                        ['blockquote', 'code-block'],
                        ['link', 'image', 'video', 'formula'],
                        ['drawing', 'embedFile'], // Custom buttons
                        ['clean']
                    ],
                    handlers: {
                        drawing: () => {
                            setShowDrawing(!showDrawing)
                        },
                        embedFile: () => {
                            // Trigger the hidden file input
                            if (fileInputRef.current) {
                                fileInputRef.current.click()
                            }
                        }
                    }
                },
                clipboard: {
                    matchVisual: false
                },
                history: {
                    delay: 1000,
                    maxStack: 50,
                    userOnly: true
                }
            },
            placeholder: 'Start writing your notes...'
        })

        quillRef.current = quill

        // Add custom icons to custom buttons (use setTimeout to ensure DOM is ready)
        const editorElement = editorRef.current
        setTimeout(() => {
            const drawingButton = editorElement.querySelector('.ql-drawing')
            if (drawingButton) {
                drawingButton.innerHTML = '✏️'
                drawingButton.setAttribute('title', 'Insert Drawing')
            }

            const embedFileButton = editorElement.querySelector('.ql-embedFile')
            if (embedFileButton) {
                embedFileButton.innerHTML = '📎'
                embedFileButton.setAttribute('title', 'Attach File (Any Type)')
            }
        }, 10) // Small delay to ensure Quill has rendered the toolbar

        // Override tooltip save to replace formulas instead of creating new ones
        // @ts-ignore - Quill theme types are incomplete
        if (quill.theme && quill.theme.tooltip) {
            // @ts-ignore
            const tooltip = quill.theme.tooltip
            // @ts-ignore
            const originalSave = tooltip.save.bind(tooltip)

            // @ts-ignore
            tooltip.save = function() {
                // Check if we're editing a formula and have a selection
                // @ts-ignore
                const mode = this.root.getAttribute('data-mode')
                if (mode === 'formula') {
                    const range = quill.getSelection(true)
                    if (range && range.length > 0) {
                        // Delete the selected formula before inserting the new one
                        quill.deleteText(range.index, range.length, 'user')
                        // Update the selection to the deletion point
                        quill.setSelection(range.index, 0, 'silent')
                    }
                }
                // Call the original save method
                originalSave()
            }
        }

        // Handle content changes
        quill.on('text-change', () => {
            const html = quill.root.innerHTML
            setContent(html)
            setIsSaved(false)
        })

        // Handle formula editing on click
        quill.on('selection-change', (range, _oldRange, source) => {
            if (range == null) return
            if (range.length === 0 && source === 'user') {
                // Check if cursor is on a formula
                const [blot] = quill.getLeaf(range.index)
                // @ts-ignore - Blot types are incomplete
                if (blot && blot.statics && blot.statics.blotName === 'formula') {
                    // Get the formula value
                    // @ts-ignore - domNode is an Element
                    const formulaValue = blot.domNode.getAttribute('data-value')

                    // Select the formula so it gets replaced when saving
                    quill.setSelection(range.index, 1, 'silent')

                    // Show the tooltip for editing
                    // @ts-ignore - Quill theme types are incomplete
                    if (quill.theme && quill.theme.tooltip) {
                        // @ts-ignore
                        quill.theme.tooltip.edit('formula', formulaValue)
                    }
                }
            }
        })

        // Handle direct clicks on formula elements (for better UX)
        const handleFormulaClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            // Find the closest .ql-formula element
            const formulaElement = target.closest('.ql-formula')
            if (formulaElement && formulaElement.classList.contains('ql-formula')) {
                e.preventDefault()
                e.stopPropagation()

                // Get the formula value
                const formulaValue = formulaElement.getAttribute('data-value')

                // Find the blot for this formula element
                // @ts-ignore - Quill internals
                const blot = quill.scroll.find(formulaElement)

                // Show the tooltip for editing
                // @ts-ignore - Quill theme types are incomplete
                if (quill.theme && quill.theme.tooltip && formulaValue && blot) {
                    // Get the index of this blot
                    // @ts-ignore - Quill internals
                    const formulaIndex = quill.getIndex(blot)

                    // Select the formula so it gets replaced when saving
                    quill.setSelection(formulaIndex, 1, 'silent')

                    // @ts-ignore
                    const tooltip = quill.theme.tooltip

                    // First, show the tooltip to get its dimensions
                    // @ts-ignore
                    tooltip.edit('formula', formulaValue)

                    // Get the bounding boxes
                    const bounds = formulaElement.getBoundingClientRect()
                    const editorBounds = quill.root.getBoundingClientRect()
                    // @ts-ignore
                    const tooltipElement = tooltip.root as HTMLElement

                    // Wait for tooltip to render to get accurate dimensions
                    setTimeout(() => {
                        const tooltipWidth = tooltipElement.offsetWidth

                        // Calculate position to the right of the formula
                        let left = bounds.left - editorBounds.left + bounds.width + 10 // 10px gap
                        const top = bounds.top - editorBounds.top

                        // Check if tooltip would go off-screen to the right
                        const containerWidth = editorBounds.width
                        if (left + tooltipWidth > containerWidth) {
                            // Position to the left of the formula instead
                            left = bounds.left - editorBounds.left - tooltipWidth - 10
                        }

                        // Make sure it doesn't go off-screen to the left
                        if (left < 0) {
                            left = 10 // Small margin from left edge
                        }

                        // Set the position
                        tooltipElement.style.left = `${left}px`
                        tooltipElement.style.top = `${top}px`
                        tooltipElement.classList.remove('ql-flip')
                    }, 0)
                }
            }
        }

        // Handle clicks on drawing images to enable editing
        const handleDrawingClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement
            if (target.tagName === 'IMG' && target.getAttribute('src')?.startsWith('data:image/png')) {
                e.preventDefault()
                e.stopPropagation()

                // Find which drawing this is
                const images = quill.root.querySelectorAll('img')
                let actualDrawingIndex = 0
                let foundIndex = -1

                images.forEach((img) => {
                    if (img.getAttribute('src')?.startsWith('data:image/png')) {
                        if (img === target) {
                            foundIndex = actualDrawingIndex
                        }
                        actualDrawingIndex++
                    }
                })

                if (foundIndex === -1) return

                // Add edit button overlay
                const existingOverlay = document.querySelector('.drawing-edit-overlay')
                if (existingOverlay) {
                    existingOverlay.remove()
                }

                const imgRect = target.getBoundingClientRect()

                const overlay = document.createElement('div')
                overlay.className = 'drawing-edit-overlay'
                overlay.style.position = 'fixed'
                overlay.style.top = `${imgRect.top}px`
                overlay.style.left = `${imgRect.left}px`
                overlay.style.width = `${imgRect.width}px`
                overlay.style.height = `${imgRect.height}px`
                overlay.style.border = '2px solid #1a73e8'
                overlay.style.borderRadius = '4px'
                overlay.style.pointerEvents = 'none'
                overlay.style.zIndex = '1000'

                const editButton = document.createElement('button')
                editButton.textContent = '✏️ Edit'
                editButton.className = 'drawing-edit-button'
                editButton.style.position = 'absolute'
                editButton.style.top = '8px'
                editButton.style.right = '8px'
                editButton.style.padding = '6px 12px'
                editButton.style.background = '#1a73e8'
                editButton.style.color = 'white'
                editButton.style.border = 'none'
                editButton.style.borderRadius = '4px'
                editButton.style.cursor = 'pointer'
                editButton.style.fontSize = '14px'
                editButton.style.fontWeight = '500'
                editButton.style.pointerEvents = 'auto'
                editButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)'

                editButton.onclick = () => {
                    editDrawing(foundIndex)
                    overlay.remove()
                }

                overlay.appendChild(editButton)
                document.body.appendChild(overlay)

                // Remove overlay when clicking elsewhere
                const removeOverlay = (e: MouseEvent) => {
                    if (!overlay.contains(e.target as Node) && e.target !== target) {
                        overlay.remove()
                        document.removeEventListener('click', removeOverlay)
                    }
                }
                setTimeout(() => {
                    document.addEventListener('click', removeOverlay)
                }, 0)
            }
        }

        // Add click listener to editor
        if (editorRef.current) {
            editorRef.current.addEventListener('click', handleFormulaClick)
            editorRef.current.addEventListener('click', handleDrawingClick)
        }
    })

    // Load note data from localStorage (only once per session)
    useEffect(() => {
        if (!sessionId || !quillRef.current || isDataLoaded) return

        const noteData = loadNoteData(sessionId)

        if (noteData) {
            setTitle(noteData.title)
            setContent(noteData.content)

            // Restore drawings if they exist
            if (noteData.drawings) {
                setDrawings(noteData.drawings)
            }

            // Restore attachments if they exist
            if (noteData.attachments) {
                setAttachments(noteData.attachments)
            }

            // Prefer Delta format for loading (preserves all formatting)
            // Fall back to HTML if Delta is not available
            if (quillRef.current) {
                if (noteData.delta) {
                    quillRef.current.setContents(noteData.delta)
                } else if (noteData.content) {
                    quillRef.current.root.innerHTML = noteData.content
                }
            }
        }

        setIsDataLoaded(true)
    }, [sessionId, isDataLoaded])

    // Auto-save with debouncing
    const saveNote = useCallback(() => {
        if (!sessionId || !quillRef.current) return

        // Get both HTML and Delta format for maximum compatibility
        const html = quillRef.current.root.innerHTML
        const delta = quillRef.current.getContents()

        const result = saveNoteData(sessionId, title, html, delta, drawings, attachments)

        if (result.success) {
            setIsSaved(true)
        } else {
            console.error('Failed to save note')
        }
    }, [sessionId, title, drawings, attachments])

    useEffect(() => {
        setIsSaved(false)

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current)
        }

        saveTimeoutRef.current = setTimeout(() => {
            saveNote()
        }, AUTO_SAVE_DEBOUNCE_MS)

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current)
            }
        }
    }, [title, content, saveNote])

    // Handle file upload (any file type)
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const quill = quillRef.current
        if (!quill || !e.target.files || e.target.files.length === 0) return

        const file = e.target.files[0]

        // Check file size (limit to 10MB to avoid localStorage issues)
        const maxSize = 10 * 1024 * 1024 // 10MB
        if (file.size > maxSize) {
            alert('File size must be less than 10MB')
            return
        }

        // Convert to base64 and insert
        const reader = new FileReader()
        reader.onload = (event) => {
            if (event.target?.result) {
                const dataURL = event.target.result as string
                const fileId = crypto.randomUUID()

                // Create file attachment object
                const attachment: FileAttachment = {
                    id: fileId,
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    dataURL: dataURL,
                    uploadedAt: Date.now()
                }

                // Add to attachments array
                setAttachments(prev => [...prev, attachment])

                // Insert file attachment into editor
                const range = quill.getSelection() || { index: quill.getLength() }
                quill.insertEmbed(range.index, 'fileAttachment', {
                    id: fileId,
                    name: file.name,
                    dataURL: dataURL,
                    size: file.size
                })
                quill.insertText(range.index + 1, '\n')
                quill.setSelection(range.index + 2)

                // Trigger content update
                const html = quill.root.innerHTML
                setContent(html)
                setIsSaved(false)
            }
        }
        reader.readAsDataURL(file)

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    // Drawing canvas handlers
    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        isDrawingRef.current = true
        const rect = canvas.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        startPosRef.current = { x, y }

        // Save canvas state for shape tools
        if (currentTool !== 'brush' && currentTool !== 'bucket') {
            canvasSnapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
        }

        if (currentTool === 'brush') {
            // Draw a dot immediately on click
            ctx.fillStyle = brushColor
            ctx.beginPath()
            ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
            ctx.fill()

            // Start the path for continuous drawing
            ctx.beginPath()
            ctx.moveTo(x, y)
        } else if (currentTool === 'bucket') {
            floodFill(x, y, ctx, canvas)
        }
    }

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawingRef.current) return

        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const rect = canvas.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        if (currentTool === 'brush') {
            ctx.lineTo(x, y)
            ctx.strokeStyle = brushColor
            ctx.lineWidth = brushSize
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            ctx.stroke()
        } else if (currentTool !== 'bucket' && startPosRef.current && canvasSnapshotRef.current) {
            // Restore canvas for preview
            ctx.putImageData(canvasSnapshotRef.current, 0, 0)

            ctx.strokeStyle = brushColor
            ctx.fillStyle = brushColor
            ctx.lineWidth = brushSize

            const startX = startPosRef.current.x
            const startY = startPosRef.current.y
            const width = x - startX
            const height = y - startY

            if (currentTool === 'line') {
                ctx.beginPath()
                ctx.moveTo(startX, startY)
                ctx.lineTo(x, y)
                ctx.stroke()
            } else if (currentTool === 'circle') {
                const radius = Math.sqrt(width * width + height * height)
                ctx.beginPath()
                ctx.arc(startX, startY, radius, 0, 2 * Math.PI)
                ctx.stroke()
            } else if (currentTool === 'square') {
                ctx.strokeRect(startX, startY, width, height)
            }
        }
    }

    const stopDrawing = () => {
        isDrawingRef.current = false
        startPosRef.current = null
        canvasSnapshotRef.current = null
    }

    // Flood fill algorithm for bucket tool
    const floodFill = (startX: number, startY: number, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const pixels = imageData.data

        // Round coordinates to integers
        startX = Math.floor(startX)
        startY = Math.floor(startY)

        const targetColor = getPixelColor(pixels, startX, startY, canvas.width)
        const fillColor = hexToRgb(brushColor)

        if (colorsMatch(targetColor, fillColor)) return

        const stack: [number, number][] = [[startX, startY]]
        const visited = new Set<string>()

        while (stack.length > 0) {
            const [x, y] = stack.pop()!

            // Check bounds
            if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue

            // Check if already visited
            const key = `${x},${y}`
            if (visited.has(key)) continue
            visited.add(key)

            const currentColor = getPixelColor(pixels, x, y, canvas.width)
            if (!colorsMatch(currentColor, targetColor)) continue

            setPixelColor(pixels, x, y, canvas.width, fillColor)

            // Add neighbors to stack
            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
        }

        ctx.putImageData(imageData, 0, 0)
    }

    const getPixelColor = (pixels: Uint8ClampedArray, x: number, y: number, width: number) => {
        const index = (y * width + x) * 4
        return [pixels[index], pixels[index + 1], pixels[index + 2], pixels[index + 3]]
    }

    const setPixelColor = (pixels: Uint8ClampedArray, x: number, y: number, width: number, color: number[]) => {
        const index = (y * width + x) * 4
        pixels[index] = color[0]
        pixels[index + 1] = color[1]
        pixels[index + 2] = color[2]
        pixels[index + 3] = 255
    }

    const hexToRgb = (hex: string): number[] => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
        return result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16)
        ] : [0, 0, 0]
    }

    const colorsMatch = (a: number[], b: number[]) => {
        return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
    }

    // Initialize canvas with white background when modal opens
    useEffect(() => {
        if (showDrawing && canvasRef.current) {
            const canvas = canvasRef.current
            const ctx = canvas.getContext('2d')
            if (ctx) {
                ctx.fillStyle = '#ffffff'
                ctx.fillRect(0, 0, canvas.width, canvas.height)

                // If editing, load the existing drawing
                if (editingDrawingIndex !== null && drawings[editingDrawingIndex]) {
                    const img = new Image()
                    img.onload = () => {
                        ctx.drawImage(img, 0, 0)
                    }
                    img.src = drawings[editingDrawingIndex].dataURL
                    setHasBorder(drawings[editingDrawingIndex].hasBorder ?? true)
                }
            }
        }
    }, [showDrawing, editingDrawingIndex, drawings])

    const editDrawing = (index: number) => {
        setEditingDrawingIndex(index)
        setShowDrawing(true)
    }

    const clearCanvas = () => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        // Fill with white background
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    const saveDrawing = () => {
        const canvas = canvasRef.current
        const quill = quillRef.current
        if (!canvas || !quill) return

        const dataURL = canvas.toDataURL()
        const newDrawing: DrawingData = {
            dataURL,
            width: canvas.width,
            height: canvas.height,
            hasBorder
        }

        if (editingDrawingIndex !== null) {
            // Update existing drawing
            const updatedDrawings = [...drawings]
            updatedDrawings[editingDrawingIndex] = newDrawing
            setDrawings(updatedDrawings)

            // Update the image in the editor
            const images = quill.root.querySelectorAll('img')
            let drawingImageIndex = 0
            images.forEach((img) => {
                if (img.src.startsWith('data:image/png')) {
                    if (drawingImageIndex === editingDrawingIndex) {
                        img.src = dataURL
                        if (hasBorder) {
                            img.style.border = '1px solid #ddd'
                        } else {
                            img.style.border = 'none'
                        }
                    }
                    drawingImageIndex++
                }
            })
            setEditingDrawingIndex(null)
        } else {
            // Insert new drawing
            const range = quill.getSelection() || { index: quill.getLength() }
            quill.insertEmbed(range.index, 'image', dataURL)

            // Add border styling if enabled
            setTimeout(() => {
                const images = quill.root.querySelectorAll('img')
                const lastImage = images[images.length - 1] as HTMLImageElement
                if (lastImage && hasBorder) {
                    lastImage.style.border = '1px solid #ddd'
                    lastImage.style.borderRadius = '4px'
                }
            }, 0)

            quill.insertText(range.index + 1, '\n')
            quill.setSelection(range.index + 2)
            setDrawings([...drawings, newDrawing])
        }

        setShowDrawing(false)
        clearCanvas()

        // Trigger content update
        const html = quill.root.innerHTML
        setContent(html)
        setIsSaved(false)
    }

    // Show loading state while redirecting to new session
    if (!sessionId) {
        return (
            <>
                <Header />
                <div className="notes_container">
                    <div style={{ textAlign: 'center', padding: '40px', color: '#5f6368' }}>
                        <p>Creating new note...</p>
                    </div>
                </div>
            </>
        )
    }

    return (
        <>
            <Header />
            <div className="notes_container">
                {/* Title Bar */}
                <div className="notes_title_bar">
                    <input
                        type="text"
                        className="notes_title_input"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Untitled Document"
                    />
                    <span className={`notes_save_indicator ${isSaved ? 'saved' : 'unsaved'}`}>
                        {isSaved ? '✓ Saved' : 'Saving...'}
                    </span>
                </div>

                {/* Hidden file input for any file type */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="*/*"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                />

                {/* Drawing Canvas Modal */}
                {showDrawing && (
                    <div className="notes_drawing_modal">
                        <div className="notes_drawing_container">
                            <div className="notes_drawing_header">
                                <h3>{editingDrawingIndex !== null ? 'Edit Drawing' : 'Drawing Canvas'}</h3>
                                <button onClick={() => {
                                    setShowDrawing(false)
                                    setEditingDrawingIndex(null)
                                }}>✕</button>
                            </div>

                            {/* Drawing Tools */}
                            <div className="notes_drawing_toolbar">
                                <div className="notes_drawing_tools">
                                    <button
                                        className={currentTool === 'brush' ? 'active' : ''}
                                        onClick={() => setCurrentTool('brush')}
                                        title="Brush"
                                    >
                                        🖌️
                                    </button>
                                    <button
                                        className={currentTool === 'line' ? 'active' : ''}
                                        onClick={() => setCurrentTool('line')}
                                        title="Line"
                                    >
                                        📏
                                    </button>
                                    <button
                                        className={currentTool === 'circle' ? 'active' : ''}
                                        onClick={() => setCurrentTool('circle')}
                                        title="Circle"
                                    >
                                        ⭕
                                    </button>
                                    <button
                                        className={currentTool === 'square' ? 'active' : ''}
                                        onClick={() => setCurrentTool('square')}
                                        title="Square"
                                    >
                                        ⬜
                                    </button>
                                    <button
                                        className={currentTool === 'bucket' ? 'active' : ''}
                                        onClick={() => setCurrentTool('bucket')}
                                        title="Fill"
                                    >
                                        🪣
                                    </button>
                                </div>

                                <div className="notes_drawing_options">
                                    <div className="notes_drawing_option">
                                        <label>Size:</label>
                                        <input
                                            type="range"
                                            min="1"
                                            max="20"
                                            value={brushSize}
                                            onChange={(e) => setBrushSize(Number(e.target.value))}
                                        />
                                        <span>{brushSize}px</span>
                                    </div>

                                    <div className="notes_drawing_option">
                                        <label>Color:</label>
                                        <input
                                            type="color"
                                            value={brushColor}
                                            onChange={(e) => setBrushColor(e.target.value)}
                                        />
                                    </div>

                                    <div className="notes_drawing_color_palette">
                                        {['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'].map(color => (
                                            <button
                                                key={color}
                                                className={brushColor === color ? 'active' : ''}
                                                style={{ backgroundColor: color, border: color === '#ffffff' ? '1px solid #ddd' : 'none' }}
                                                onClick={() => setBrushColor(color)}
                                                title={color}
                                            />
                                        ))}
                                    </div>

                                    <div className="notes_drawing_option">
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={hasBorder}
                                                onChange={(e) => setHasBorder(e.target.checked)}
                                            />
                                            Border
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <canvas
                                ref={canvasRef}
                                width={800}
                                height={400}
                                className="notes_canvas"
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                            />
                            <div className="notes_drawing_controls">
                                <button onClick={clearCanvas}>Clear</button>
                                <button onClick={saveDrawing} className="primary">
                                    {editingDrawingIndex !== null ? 'Update Drawing' : 'Save Drawing'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Rich Text Editor */}
                <div className="notes_editor_wrapper">
                    <div ref={editorRef}></div>
                </div>

                {/* Keyboard Shortcuts Help */}
                <div className="notes_shortcuts_hint">
                    <details>
                        <summary>⌨️ Keyboard Shortcuts</summary>
                        <div className="notes_shortcuts_grid">
                            <div><kbd>Ctrl/Cmd + B</kbd> Bold</div>
                            <div><kbd>Ctrl/Cmd + I</kbd> Italic</div>
                            <div><kbd>Ctrl/Cmd + U</kbd> Underline</div>
                            <div><kbd>Ctrl/Cmd + Z</kbd> Undo</div>
                            <div><kbd>Ctrl/Cmd + Y</kbd> Redo</div>
                            <div><kbd>Ctrl/Cmd + K</kbd> Insert Link</div>
                        </div>
                    </details>
                </div>
            </div>
        </>
    )
}

export default Notes
