/**
 * DiagramEditor Component
 * 
 * A visual editor for creating diagram-based learning content.
 * Features:
 * - Multiple image upload and positioning
 * - Shape tools (arrows, rectangles, circles, lines, polygons)
 * - Label placement for learning mode
 * - Z-index management
 * - Card navigation
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Header from '../header/header'
import { useAuth } from '../auth/AuthContext'
import TagInput from '../components/TagInput'
import type {
    DiagramData,
    DiagramCard,
    DiagramImage,
    DiagramShape,
    DiagramLabel,
    EditorTool,
    ShapeType,
    LabelShapeType
} from './types'
import { createEmptyCard, createEmptyDiagram } from './types'
import ImportModal from './ImportModal'
import './DiagramEditor.css'

// Auto-save debounce time
const AUTO_SAVE_DEBOUNCE_MS = 1000

function DiagramEditor() {
    const { sessionId } = useParams<{ sessionId?: string }>()
    const navigate = useNavigate()
    const { user } = useAuth()

    // Core state
    const [diagram, setDiagram] = useState<DiagramData | null>(null)
    const [currentCardIndex, setCurrentCardIndex] = useState(0)
    const [title, setTitle] = useState('Untitled Diagram')
    const [isSaved, setIsSaved] = useState(true)
    const [isLoading, setIsLoading] = useState(true)
    const [isReadOnly, setIsReadOnly] = useState(false)

    // Editor state
    const [selectedTool, setSelectedTool] = useState<EditorTool>('select')
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
    const [selectedElementType, setSelectedElementType] = useState<'image' | 'shape' | 'label' | null>(null)
    const [zoom, setZoom] = useState(1)
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })

    // Multi-selection state
    const [selectedElements, setSelectedElements] = useState<Array<{ id: string; type: 'image' | 'shape' | 'label' }>>([])
    const [isSelectionBoxActive, setIsSelectionBoxActive] = useState(false)
    const [selectionBoxStart, setSelectionBoxStart] = useState<{ x: number; y: number } | null>(null)
    const [selectionBoxEnd, setSelectionBoxEnd] = useState<{ x: number; y: number } | null>(null)

    // Drawing state
    const [isDrawing, setIsDrawing] = useState(false)
    const [drawingStart, setDrawingStart] = useState<{ x: number; y: number } | null>(null)
    const [currentShapeColor, setCurrentShapeColor] = useState('#00d4ff')
    const [currentShapeFillColor, setCurrentShapeFillColor] = useState<string | undefined>(undefined)
    const [currentShapeFillEnabled, setCurrentShapeFillEnabled] = useState(false)
    const [currentStrokeWidth, setCurrentStrokeWidth] = useState(2)
    const [currentLabelText, setCurrentLabelText] = useState('')
    const [showLabelInput, setShowLabelInput] = useState(false)
    const [labelInputPosition, setLabelInputPosition] = useState({ x: 0, y: 0 })

    // Resize/drag state
    const [isDragging, setIsDragging] = useState(false)
    const [isResizing, setIsResizing] = useState(false)
    const [resizeHandle, setResizeHandle] = useState<string | null>(null)
    const [dragStart, setDragStart] = useState<{ x: number; y: number; elemX: number; elemY: number; elemW?: number; elemH?: number; polygonPoints?: number[]; shapePoints?: number[]; textOffsetX?: number; textOffsetY?: number } | null>(null)
    const [isDraggingText, setIsDraggingText] = useState(false)

    // Edit panel position state (for draggable panels)
    const [editPanelPos, setEditPanelPos] = useState<{ x: number; y: number } | null>(null)
    const [isDraggingPanel, setIsDraggingPanel] = useState(false)
    const [panelDragStart, setPanelDragStart] = useState<{ x: number; y: number; panelX: number; panelY: number } | null>(null)

    // Label font size and shape state
    const [currentLabelFontSize, setCurrentLabelFontSize] = useState(16)
    const [currentLabelShapeType, setCurrentLabelShapeType] = useState<LabelShapeType>('point')
    const [currentLabelWidth, setCurrentLabelWidth] = useState(100)
    const [currentLabelHeight, setCurrentLabelHeight] = useState(60)
    const [defaultLabelColor, setDefaultLabelColor] = useState('#000000')

    // Tag management state
    const [tags, setTags] = useState<string[]>([])
    const [allUserTags, setAllUserTags] = useState<string[]>([])

    // Import modal state
    const [showImportModal, setShowImportModal] = useState(false)

    // Polygon drawing state
    const [isDrawingPolygon, setIsDrawingPolygon] = useState(false)
    const [polygonPoints, setPolygonPoints] = useState<number[]>([])
    const [selectedPolygonVertex, setSelectedPolygonVertex] = useState<number | null>(null)

    // Label shape drawing state (for rectangle/circle labels)
    const [isDrawingLabelShape, setIsDrawingLabelShape] = useState(false)
    const [labelShapeStart, setLabelShapeStart] = useState<{ x: number; y: number } | null>(null)
    const [labelShapeEnd, setLabelShapeEnd] = useState<{ x: number; y: number } | null>(null)

    // Undo history state
    const [history, setHistory] = useState<DiagramCard[]>([])
    const [historyIndex, setHistoryIndex] = useState(-1)
    const isUndoingRef = useRef(false)

    // Refs
    const svgRef = useRef<SVGSVGElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const saveTimeoutRef = useRef<number | undefined>(undefined)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const labelInputRef = useRef<HTMLDivElement>(null)

    // Track current mouse position during drawing
    const [currentDrawEnd, setCurrentDrawEnd] = useState<{ x: number; y: number } | null>(null)

    // Get current card
    const currentCard = diagram?.cards[currentCardIndex] || null

    // Helper to clear selection
    const clearSelection = useCallback(() => {
        setSelectedElementId(null)
        setSelectedElementType(null)
        setSelectedElements([])
    }, [])

    // Generate session ID if not present
    useEffect(() => {
        console.log('DiagramEditor mounted, sessionId:', sessionId, 'user:', user?.id)
        if (!sessionId) {
            const newSessionId = crypto.randomUUID()
            console.log('No sessionId, navigating to new diagram:', newSessionId)
            navigate(`/diagrams/${newSessionId}`, { replace: true })
        }
    }, [sessionId, navigate])

    // Load diagram data
    useEffect(() => {
        const loadDiagram = async () => {
            if (!sessionId) return

            setIsLoading(true)
            try {
                const response = await fetch(`/api/diagrams/${sessionId}`)
                const result = await response.json()

                if (result.success && result.data) {
                    setDiagram(result.data)
                    setTitle(result.data.title)
                    setTags(result.data.tags || [])
                    if (result.data.default_label_color) {
                        setDefaultLabelColor(result.data.default_label_color)
                    }
                } else {
                    // Create new diagram
                    const newDiagram = createEmptyDiagram(sessionId, user?.id || null)
                    setDiagram(newDiagram)
                }
            } catch (error) {
                console.error('Error loading diagram:', error)
                const newDiagram = createEmptyDiagram(sessionId, user?.id || null)
                setDiagram(newDiagram)
            } finally {
                setIsLoading(false)
            }
        }

        loadDiagram()
    }, [sessionId, user?.id])

    // Fetch all user tags for suggestions
    useEffect(() => {
        const fetchUserTags = async () => {
            if (!user?.id) return
            try {
                const response = await fetch(`/api/diagrams/tags/all/${user.id}`)
                const result = await response.json()
                if (result.success) {
                    setAllUserTags(result.data || [])
                }
            } catch (error) {
                console.error('Error fetching user tags:', error)
            }
        }
        fetchUserTags()
    }, [user?.id])

    // Check user permission
    useEffect(() => {
        const checkPermission = async () => {
            if (!user?.id || !sessionId) {
                setIsReadOnly(false)
                return
            }

            try {
                const response = await fetch(`/api/diagrams/${sessionId}/permission/${user.id}`)
                const result = await response.json()

                if (result.success) {
                    setIsReadOnly(result.permission === 'view')
                }
            } catch (error) {
                console.error('Error checking permission:', error)
                setIsReadOnly(false)
            }
        }

        checkPermission()
    }, [sessionId, user?.id])

    // Handle tag changes
    const handleTagsChange = async (newTags: string[]) => {
        setTags(newTags)
        if (!sessionId) return

        try {
            await fetch(`/api/diagrams/${sessionId}/tags`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tags: newTags, userId: user?.id })
            })
        } catch (error) {
            console.error('Error saving tags:', error)
        }
    }

    // Auto-save
    const saveDiagram = useCallback(async () => {
        if (!diagram || !sessionId || isReadOnly) return

        try {
            const response = await fetch('/api/diagrams', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    userId: user?.id || null,
                    title,
                    cards: diagram.cards,
                    tags: tags,
                    description: diagram.description,
                    defaultLabelColor: defaultLabelColor
                })
            })

            const result = await response.json()
            if (result.success) {
                setIsSaved(true)
            }
        } catch (error) {
            console.error('Error saving diagram:', error)
        }
    }, [diagram, sessionId, user?.id, title, tags, isReadOnly, defaultLabelColor])

    // Trigger auto-save on changes
    useEffect(() => {
        if (!diagram || isLoading) return

        setIsSaved(false)
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current)
        }
        saveTimeoutRef.current = window.setTimeout(saveDiagram, AUTO_SAVE_DEBOUNCE_MS)

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current)
            }
        }
    }, [diagram, title, saveDiagram, isLoading])

    // Update card helper with undo history
    const updateCurrentCard = useCallback((updater: (card: DiagramCard) => DiagramCard) => {
        if (!diagram) return

        // Save current state to history before making changes (unless we're undoing/redoing)
        if (!isUndoingRef.current) {
            const currentState = diagram.cards[currentCardIndex]
            setHistory(prev => {
                // Truncate any future history if we're not at the end
                const newHistory = prev.slice(0, historyIndex + 1)
                // Add current state and limit history size
                return [...newHistory, JSON.parse(JSON.stringify(currentState))].slice(-50)
            })
            setHistoryIndex(prev => Math.min(prev + 1, 49))
        }

        setDiagram(prev => {
            if (!prev) return prev
            const newCards = [...prev.cards]
            newCards[currentCardIndex] = updater(newCards[currentCardIndex])
            return { ...prev, cards: newCards }
        })
    }, [diagram, currentCardIndex, historyIndex])

    // Undo function
    const undo = useCallback(() => {
        if (historyIndex < 0 || !diagram) return

        isUndoingRef.current = true

        // Save current state for redo before undoing
        const currentState = diagram.cards[currentCardIndex]

        // Get the previous state from history
        const previousState = history[historyIndex]

        // Update history to include current state for redo
        setHistory(prev => {
            const newHistory = [...prev]
            if (historyIndex === prev.length - 1) {
                // We're at the end, add current state
                newHistory.push(JSON.parse(JSON.stringify(currentState)))
            }
            return newHistory
        })

        // Apply the previous state
        setDiagram(prev => {
            if (!prev) return prev
            const newCards = [...prev.cards]
            newCards[currentCardIndex] = JSON.parse(JSON.stringify(previousState))
            return { ...prev, cards: newCards }
        })

        setHistoryIndex(prev => prev - 1)

        setTimeout(() => {
            isUndoingRef.current = false
        }, 0)
    }, [historyIndex, history, diagram, currentCardIndex])

    // Redo function
    const redo = useCallback(() => {
        if (historyIndex >= history.length - 1 || !diagram) return

        isUndoingRef.current = true

        const nextState = history[historyIndex + 2] || history[historyIndex + 1]
        if (!nextState) {
            isUndoingRef.current = false
            return
        }

        setDiagram(prev => {
            if (!prev) return prev
            const newCards = [...prev.cards]
            newCards[currentCardIndex] = JSON.parse(JSON.stringify(nextState))
            return { ...prev, cards: newCards }
        })

        setHistoryIndex(prev => prev + 1)

        setTimeout(() => {
            isUndoingRef.current = false
        }, 0)
    }, [historyIndex, history, diagram, currentCardIndex])

    // Image upload handler
    const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || !currentCard) return

        Array.from(files).forEach(file => {
            const reader = new FileReader()
            reader.onload = (event) => {
                const src = event.target?.result as string
                const img = new Image()
                img.onload = () => {
                    const newImage: DiagramImage = {
                        id: crypto.randomUUID(),
                        src,
                        x: 50,
                        y: 50,
                        width: Math.min(img.width, 400),
                        height: Math.min(img.height, 400) * (img.height / img.width),
                        zIndex: currentCard.images.length,
                        opacity: 1
                    }
                    updateCurrentCard(card => ({
                        ...card,
                        images: [...card.images, newImage]
                    }))
                }
                img.src = src
            }
            reader.readAsDataURL(file)
        })

        e.target.value = ''
    }, [currentCard, updateCurrentCard])

    // Handle paste for images
    const handlePaste = useCallback((e: ClipboardEvent) => {
        // Don't handle paste if import modal is open (it has its own paste handler)
        if (!currentCard || isReadOnly || showImportModal) return

        const items = e.clipboardData?.items
        if (!items) return

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault()
                const blob = items[i].getAsFile()
                if (!blob) continue

                const reader = new FileReader()
                reader.onload = (event) => {
                    const src = event.target?.result as string
                    const img = new window.Image()
                    img.onload = () => {
                        const newImage: DiagramImage = {
                            id: crypto.randomUUID(),
                            src,
                            x: 50,
                            y: 50,
                            width: Math.min(img.width, 400),
                            height: Math.min(img.height, 400) * (img.height / img.width),
                            zIndex: currentCard.images.length,
                            opacity: 1
                        }
                        updateCurrentCard(card => ({
                            ...card,
                            images: [...card.images, newImage]
                        }))
                    }
                    img.src = src
                }
                reader.readAsDataURL(blob)
                break // Only handle first image
            }
        }
    }, [currentCard, updateCurrentCard, isReadOnly, showImportModal])

    // Set up paste event listener
    useEffect(() => {
        document.addEventListener('paste', handlePaste)
        return () => document.removeEventListener('paste', handlePaste)
    }, [handlePaste])

    // Add new card
    const addCard = useCallback(() => {
        if (!diagram) return
        setDiagram(prev => {
            if (!prev) return prev
            return { ...prev, cards: [...prev.cards, createEmptyCard()] }
        })
        setCurrentCardIndex(diagram.cards.length)
    }, [diagram])

    // Delete current card
    const deleteCard = useCallback(() => {
        if (!diagram || diagram.cards.length <= 1) return
        setDiagram(prev => {
            if (!prev) return prev
            const newCards = prev.cards.filter((_, i) => i !== currentCardIndex)
            return { ...prev, cards: newCards }
        })
        setCurrentCardIndex(Math.max(0, currentCardIndex - 1))
    }, [diagram, currentCardIndex])

    // Delete selected element(s)
    const deleteSelectedElement = useCallback(() => {
        // Handle multi-selection delete
        if (selectedElements.length > 0) {
            const imageIds = new Set(selectedElements.filter(e => e.type === 'image').map(e => e.id))
            const shapeIds = new Set(selectedElements.filter(e => e.type === 'shape').map(e => e.id))
            const labelIds = new Set(selectedElements.filter(e => e.type === 'label').map(e => e.id))

            updateCurrentCard(card => ({
                ...card,
                images: card.images.filter(img => !imageIds.has(img.id)),
                shapes: card.shapes.filter(s => !shapeIds.has(s.id)),
                labels: card.labels.filter(l => !labelIds.has(l.id))
            }))
            setSelectedElements([])
            setSelectedElementId(null)
            setSelectedElementType(null)
            return
        }

        // Handle single selection delete
        if (!selectedElementId || !selectedElementType) return

        updateCurrentCard(card => {
            if (selectedElementType === 'image') {
                return { ...card, images: card.images.filter(img => img.id !== selectedElementId) }
            } else if (selectedElementType === 'shape') {
                return { ...card, shapes: card.shapes.filter(s => s.id !== selectedElementId) }
            } else if (selectedElementType === 'label') {
                return { ...card, labels: card.labels.filter(l => l.id !== selectedElementId) }
            }
            return card
        })
        setSelectedElementId(null)
        setSelectedElementType(null)
    }, [selectedElementId, selectedElementType, selectedElements, updateCurrentCard])

    // Z-index controls
    const bringToFront = useCallback(() => {
        if (!selectedElementId || selectedElementType !== 'image') return
        updateCurrentCard(card => {
            const maxZ = Math.max(...card.images.map(img => img.zIndex), 0)
            return {
                ...card,
                images: card.images.map(img =>
                    img.id === selectedElementId ? { ...img, zIndex: maxZ + 1 } : img
                )
            }
        })
    }, [selectedElementId, selectedElementType, updateCurrentCard])

    const sendToBack = useCallback(() => {
        if (!selectedElementId || selectedElementType !== 'image') return
        updateCurrentCard(card => {
            const minZ = Math.min(...card.images.map(img => img.zIndex), 0)
            return {
                ...card,
                images: card.images.map(img =>
                    img.id === selectedElementId ? { ...img, zIndex: minZ - 1 } : img
                )
            }
        })
    }, [selectedElementId, selectedElementType, updateCurrentCard])

    // SVG mouse handlers - get coordinates relative to SVG viewBox
    const getSvgCoords = useCallback((e: React.MouseEvent) => {
        const svg = svgRef.current
        if (!svg) return { x: 0, y: 0 }
        const rect = svg.getBoundingClientRect()
        // Scale from screen coordinates to SVG viewBox coordinates (800x600)
        const scaleX = 800 / rect.width
        const scaleY = 600 / rect.height
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        }
    }, [])

    const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
        if (isReadOnly) return
        const coords = getSvgCoords(e)

        if (selectedTool === 'select') {
            // Check if clicking on an element
            if (currentCard) {
                // Check labels first (top layer)
                for (const label of [...currentCard.labels].reverse()) {
                    const labelWidth = label.text.length * label.fontSize * 0.6 + 8
                    const labelHeight = label.fontSize * 1.4
                    if (coords.x >= label.x - 4 && coords.x <= label.x - 4 + labelWidth &&
                        coords.y >= label.y - label.fontSize && coords.y <= label.y - label.fontSize + labelHeight) {
                        setSelectedElementId(label.id)
                        setSelectedElementType('label')
                        setSelectedElements([])
                        return
                    }
                }
                // Check shapes
                for (const shape of [...currentCard.shapes].reverse()) {
                    // Simple bounding box check for shapes
                    const [x1, y1, x2, y2] = shape.points
                    const minX = Math.min(x1, x2 || x1)
                    const maxX = Math.max(x1, x2 || x1)
                    const minY = Math.min(y1, y2 || y1)
                    const maxY = Math.max(y1, y2 || y1)
                    if (coords.x >= minX - 10 && coords.x <= maxX + 10 &&
                        coords.y >= minY - 10 && coords.y <= maxY + 10) {
                        setSelectedElementId(shape.id)
                        setSelectedElementType('shape')
                        setSelectedElements([])
                        return
                    }
                }
                // Check images (sorted by z-index)
                const sortedImages = [...currentCard.images].sort((a, b) => b.zIndex - a.zIndex)
                for (const img of sortedImages) {
                    if (coords.x >= img.x && coords.x <= img.x + img.width &&
                        coords.y >= img.y && coords.y <= img.y + img.height) {
                        setSelectedElementId(img.id)
                        setSelectedElementType('image')
                        setSelectedElements([])
                        return
                    }
                }
            }
            // No element clicked - start selection box
            setSelectedElementId(null)
            setSelectedElementType(null)
            setSelectedElements([])
            setIsSelectionBoxActive(true)
            setSelectionBoxStart(coords)
            setSelectionBoxEnd(coords)
        } else if (selectedTool === 'label') {
            // Check if we're in polygon mode
            if (currentLabelShapeType === 'polygon') {
                // Add point to polygon
                setPolygonPoints(prev => [...prev, coords.x, coords.y])
                if (!isDrawingPolygon) {
                    setIsDrawingPolygon(true)
                }
            } else if (currentLabelShapeType === 'rectangle' || currentLabelShapeType === 'circle') {
                // Start drawing rectangle/circle label shape
                setIsDrawingLabelShape(true)
                setLabelShapeStart(coords)
                setLabelShapeEnd(coords)
            } else {
                // Point label - place immediately
                setLabelInputPosition(coords)
                setShowLabelInput(true)
                setCurrentLabelText('')
            }
        } else if (['arrow', 'rectangle', 'circle', 'line'].includes(selectedTool)) {
            setIsDrawing(true)
            setDrawingStart(coords)
            setCurrentDrawEnd(coords)
        }
    }, [selectedTool, currentCard, getSvgCoords, isReadOnly, currentLabelShapeType, isDrawingPolygon])

    // Handle drag/resize move - defined before handleCanvasMouseMove to avoid reference error
    const handleDragMove = useCallback((e: React.MouseEvent) => {
        if ((!isDragging && !isResizing) || !dragStart || !selectedElementId) return

        const coords = getSvgCoords(e)
        const dx = coords.x - dragStart.x
        const dy = coords.y - dragStart.y

        if (isDragging && selectedElementType === 'image') {
            updateCurrentCard(card => ({
                ...card,
                images: card.images.map(img =>
                    img.id === selectedElementId
                        ? { ...img, x: dragStart.elemX + dx, y: dragStart.elemY + dy }
                        : img
                )
            }))
        } else if (isDragging && selectedElementType === 'label') {
            // Check if we're dragging the text independently
            if (isDraggingText) {
                updateCurrentCard(card => ({
                    ...card,
                    labels: card.labels.map(label => {
                        if (label.id !== selectedElementId) return label
                        return {
                            ...label,
                            textOffsetX: (dragStart.textOffsetX || 0) + dx,
                            textOffsetY: (dragStart.textOffsetY || 0) + dy
                        }
                    })
                }))
            } else if (selectedPolygonVertex !== null) {
                // Dragging a polygon vertex
                updateCurrentCard(card => ({
                    ...card,
                    labels: card.labels.map(label => {
                        if (label.id !== selectedElementId || !label.polygonPoints) return label
                        const newPoints = [...label.polygonPoints]
                        newPoints[selectedPolygonVertex * 2] = dragStart.elemX + dx
                        newPoints[selectedPolygonVertex * 2 + 1] = dragStart.elemY + dy
                        // Recalculate centroid
                        let sumX = 0, sumY = 0
                        const numPoints = newPoints.length / 2
                        for (let i = 0; i < newPoints.length; i += 2) {
                            sumX += newPoints[i]
                            sumY += newPoints[i + 1]
                        }
                        return { ...label, polygonPoints: newPoints, x: sumX / numPoints, y: sumY / numPoints }
                    })
                }))
            } else {
                // Regular label drag (move entire label)
                updateCurrentCard(card => ({
                    ...card,
                    labels: card.labels.map(label => {
                        if (label.id !== selectedElementId) return label
                        // For polygon labels, also move all polygon points using original stored points
                        if (label.shapeType === 'polygon' && dragStart.polygonPoints) {
                            const newPoints = dragStart.polygonPoints.map((val, i) =>
                                i % 2 === 0 ? val + dx : val + dy
                            )
                            return { ...label, x: dragStart.elemX + dx, y: dragStart.elemY + dy, polygonPoints: newPoints }
                        }
                        return { ...label, x: dragStart.elemX + dx, y: dragStart.elemY + dy }
                    })
                }))
            }
        } else if (isResizing && selectedElementType === 'image' && dragStart.elemW && dragStart.elemH) {
            let newW = dragStart.elemW
            let newH = dragStart.elemH
            let newX = dragStart.elemX
            let newY = dragStart.elemY

            // Calculate new dimensions based on handle
            if (resizeHandle?.includes('e')) newW = Math.max(20, dragStart.elemW + dx)
            if (resizeHandle?.includes('w')) { newW = Math.max(20, dragStart.elemW - dx); newX = dragStart.elemX + dx }
            if (resizeHandle?.includes('s')) newH = Math.max(20, dragStart.elemH + dy)
            if (resizeHandle?.includes('n')) { newH = Math.max(20, dragStart.elemH - dy); newY = dragStart.elemY + dy }

            updateCurrentCard(card => ({
                ...card,
                images: card.images.map(img =>
                    img.id === selectedElementId
                        ? { ...img, x: newX, y: newY, width: newW, height: newH }
                        : img
                )
            }))
        } else if (isResizing && selectedElementType === 'label' && dragStart.elemW !== undefined) {
            const label = currentCard?.labels.find(l => l.id === selectedElementId)
            if (!label) return

            let newW = dragStart.elemW
            let newH = dragStart.elemH || 60
            let newX = dragStart.elemX
            let newY = dragStart.elemY
            const shapeType = label.shapeType || 'point'

            if (shapeType === 'rectangle') {
                // Rectangle: support all 4 corners
                if (resizeHandle?.includes('e')) newW = Math.max(30, dragStart.elemW + dx)
                if (resizeHandle?.includes('w')) { newW = Math.max(30, dragStart.elemW - dx); newX = dragStart.elemX + dx }
                if (resizeHandle?.includes('s')) newH = Math.max(30, newH + dy)
                if (resizeHandle?.includes('n')) { newH = Math.max(30, newH - dy); newY = dragStart.elemY + dy }
            } else if (shapeType === 'circle') {
                // Circle: only adjust width (diameter) with east handle
                if (resizeHandle === 'e') newW = Math.max(30, dragStart.elemW + dx * 2)
            }

            updateCurrentCard(card => ({
                ...card,
                labels: card.labels.map(l =>
                    l.id === selectedElementId
                        ? { ...l, x: newX, y: newY, width: newW, height: newH }
                        : l
                )
            }))
        } else if (isDragging && selectedElementType === 'shape' && dragStart.shapePoints) {
            // Move shape by moving all points
            const newPoints = dragStart.shapePoints.map((val, i) =>
                i % 2 === 0 ? val + dx : val + dy
            )
            updateCurrentCard(card => ({
                ...card,
                shapes: card.shapes.map(shape =>
                    shape.id === selectedElementId
                        ? { ...shape, points: newPoints }
                        : shape
                )
            }))
        } else if (isResizing && selectedElementType === 'shape' && dragStart.shapePoints) {
            const shape = currentCard?.shapes.find(s => s.id === selectedElementId)
            if (!shape) return

            const [x1, y1, x2, y2] = dragStart.shapePoints
            let newPoints = [...dragStart.shapePoints]

            // For line/arrow shapes, resize by moving endpoints
            if (shape.type === 'line' || shape.type === 'arrow') {
                if (resizeHandle === 'start') {
                    newPoints = [x1 + dx, y1 + dy, x2, y2]
                } else if (resizeHandle === 'end') {
                    newPoints = [x1, y1, x2 + dx, y2 + dy]
                }
            } else if (shape.type === 'rectangle') {
                // Rectangle resize with corner handles
                const minX = Math.min(x1, x2)
                const minY = Math.min(y1, y2)
                const maxX = Math.max(x1, x2)
                const maxY = Math.max(y1, y2)

                let newMinX = minX, newMinY = minY, newMaxX = maxX, newMaxY = maxY

                if (resizeHandle?.includes('w')) newMinX = Math.min(minX + dx, maxX - 10)
                if (resizeHandle?.includes('e')) newMaxX = Math.max(maxX + dx, minX + 10)
                if (resizeHandle?.includes('n')) newMinY = Math.min(minY + dy, maxY - 10)
                if (resizeHandle?.includes('s')) newMaxY = Math.max(maxY + dy, minY + 10)

                newPoints = [newMinX, newMinY, newMaxX, newMaxY]
            } else if (shape.type === 'circle') {
                // Circle resize by adjusting radius
                const cx = (x1 + x2) / 2
                const cy = (y1 + y2) / 2
                const originalRadius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)) / 2
                const newRadius = Math.max(10, originalRadius + dx)

                // Recalculate points based on new radius
                newPoints = [cx - newRadius, cy - newRadius, cx + newRadius, cy + newRadius]
            }

            updateCurrentCard(card => ({
                ...card,
                shapes: card.shapes.map(s =>
                    s.id === selectedElementId
                        ? { ...s, points: newPoints }
                        : s
                )
            }))
        }
    }, [isDragging, isResizing, dragStart, selectedElementId, selectedElementType, resizeHandle, getSvgCoords, updateCurrentCard, currentCard, selectedPolygonVertex])

    // Handle drag/resize end - defined before handleCanvasMouseUp to avoid reference error
    const handleDragEnd = useCallback(() => {
        setIsDragging(false)
        setIsResizing(false)
        setResizeHandle(null)
        setDragStart(null)
        setSelectedPolygonVertex(null)
        setIsDraggingText(false)
    }, [])

    const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
        // Handle drag/resize
        if (isDragging || isResizing) {
            handleDragMove(e)
            return
        }
        // Handle selection box drawing
        if (isSelectionBoxActive && selectionBoxStart) {
            const coords = getSvgCoords(e)
            setSelectionBoxEnd(coords)
            return
        }
        // Handle label shape drawing (rectangle/circle labels)
        if (isDrawingLabelShape && labelShapeStart) {
            const coords = getSvgCoords(e)
            setLabelShapeEnd(coords)
            return
        }
        // Handle drawing
        if (!isDrawing || !drawingStart) return
        const coords = getSvgCoords(e)
        setCurrentDrawEnd(coords)
    }, [isDrawing, drawingStart, getSvgCoords, isDragging, isResizing, handleDragMove, isDrawingLabelShape, labelShapeStart, isSelectionBoxActive, selectionBoxStart])

    const handleCanvasMouseUp = useCallback((e: React.MouseEvent) => {
        // Handle drag/resize end
        if (isDragging || isResizing) {
            handleDragEnd()
            return
        }

        // Handle selection box end
        if (isSelectionBoxActive && selectionBoxStart && selectionBoxEnd && currentCard) {
            const minX = Math.min(selectionBoxStart.x, selectionBoxEnd.x)
            const maxX = Math.max(selectionBoxStart.x, selectionBoxEnd.x)
            const minY = Math.min(selectionBoxStart.y, selectionBoxEnd.y)
            const maxY = Math.max(selectionBoxStart.y, selectionBoxEnd.y)

            // Only select if box has meaningful size
            if (maxX - minX > 5 || maxY - minY > 5) {
                const selected: Array<{ id: string; type: 'image' | 'shape' | 'label' }> = []

                // Check labels
                for (const label of currentCard.labels) {
                    const labelWidth = label.text.length * label.fontSize * 0.6 + 8
                    const labelHeight = label.fontSize * 1.4
                    const labelX = label.x - 4
                    const labelY = label.y - label.fontSize

                    // Check if label intersects with selection box
                    if (labelX < maxX && labelX + labelWidth > minX &&
                        labelY < maxY && labelY + labelHeight > minY) {
                        selected.push({ id: label.id, type: 'label' })
                    }
                }

                // Check shapes
                for (const shape of currentCard.shapes) {
                    const [x1, y1, x2, y2] = shape.points
                    const shapeMinX = Math.min(x1, x2 || x1)
                    const shapeMaxX = Math.max(x1, x2 || x1)
                    const shapeMinY = Math.min(y1, y2 || y1)
                    const shapeMaxY = Math.max(y1, y2 || y1)

                    // Check if shape intersects with selection box
                    if (shapeMinX < maxX && shapeMaxX > minX &&
                        shapeMinY < maxY && shapeMaxY > minY) {
                        selected.push({ id: shape.id, type: 'shape' })
                    }
                }

                // Check images
                for (const img of currentCard.images) {
                    // Check if image intersects with selection box
                    if (img.x < maxX && img.x + img.width > minX &&
                        img.y < maxY && img.y + img.height > minY) {
                        selected.push({ id: img.id, type: 'image' })
                    }
                }

                setSelectedElements(selected)
            }

            setIsSelectionBoxActive(false)
            setSelectionBoxStart(null)
            setSelectionBoxEnd(null)
            return
        }

        // Handle label shape drawing end (rectangle/circle labels)
        if (isDrawingLabelShape && labelShapeStart) {
            const coords = getSvgCoords(e)
            const distance = Math.sqrt(Math.pow(coords.x - labelShapeStart.x, 2) + Math.pow(coords.y - labelShapeStart.y, 2))

            if (distance > 10) {
                // Calculate position and dimensions
                const x = Math.min(labelShapeStart.x, coords.x)
                const y = Math.min(labelShapeStart.y, coords.y)
                const width = Math.abs(coords.x - labelShapeStart.x)
                const height = currentLabelShapeType === 'circle'
                    ? width // Circle uses width for both
                    : Math.abs(coords.y - labelShapeStart.y)

                // Set the dimensions for the label
                setCurrentLabelWidth(Math.max(30, width))
                setCurrentLabelHeight(Math.max(30, height))

                // Position label input at center of shape
                const centerX = currentLabelShapeType === 'circle'
                    ? labelShapeStart.x + (coords.x > labelShapeStart.x ? width / 2 : -width / 2)
                    : x + width / 2
                const centerY = currentLabelShapeType === 'circle'
                    ? labelShapeStart.y + (coords.y > labelShapeStart.y ? width / 2 : -width / 2)
                    : y + height / 2

                // Store the top-left corner for label creation
                setLabelInputPosition({
                    x: currentLabelShapeType === 'circle' ? centerX - width / 2 : x,
                    y: currentLabelShapeType === 'circle' ? centerY - width / 2 : y
                })
                setShowLabelInput(true)
                setCurrentLabelText('')
            }

            setIsDrawingLabelShape(false)
            setLabelShapeStart(null)
            setLabelShapeEnd(null)
            return
        }

        if (!isDrawing || !drawingStart) {
            setCurrentDrawEnd(null)
            return
        }
        const coords = getSvgCoords(e)

        // Only create shape if there's meaningful movement (at least 5 pixels)
        const distance = Math.sqrt(Math.pow(coords.x - drawingStart.x, 2) + Math.pow(coords.y - drawingStart.y, 2))
        if (distance > 5) {
            const newShape: DiagramShape = {
                id: crypto.randomUUID(),
                type: selectedTool as ShapeType,
                points: [drawingStart.x, drawingStart.y, coords.x, coords.y],
                color: currentShapeColor,
                fillColor: currentShapeFillEnabled ? currentShapeFillColor || '#ffffff' : undefined,
                strokeWidth: currentStrokeWidth,
                zIndex: currentCard?.shapes.length || 0
            }

            updateCurrentCard(card => ({
                ...card,
                shapes: [...card.shapes, newShape]
            }))
        }

        setIsDrawing(false)
        setDrawingStart(null)
        setCurrentDrawEnd(null)
    }, [isDrawing, drawingStart, selectedTool, currentShapeColor, currentShapeFillEnabled, currentShapeFillColor, currentStrokeWidth, currentCard, getSvgCoords, updateCurrentCard, isDragging, isResizing, handleDragEnd, isDrawingLabelShape, labelShapeStart, currentLabelShapeType, isSelectionBoxActive, selectionBoxStart, selectionBoxEnd])

    // Add label
    const addLabel = useCallback(() => {
        if (!currentLabelText.trim()) {
            setShowLabelInput(false)
            return
        }

        const newLabel: DiagramLabel = {
            id: crypto.randomUUID(),
            shapeType: currentLabelShapeType,
            x: labelInputPosition.x,
            y: labelInputPosition.y,
            width: currentLabelShapeType !== 'point' ? currentLabelWidth : undefined,
            height: currentLabelShapeType === 'rectangle' ? currentLabelHeight : undefined,
            text: currentLabelText.trim(),
            fontSize: currentLabelFontSize,
            color: defaultLabelColor,
            textOffsetX: 0,
            textOffsetY: 0
        }

        updateCurrentCard(card => ({
            ...card,
            labels: [...card.labels, newLabel]
        }))

        setShowLabelInput(false)
        setCurrentLabelText('')
    }, [currentLabelText, labelInputPosition, currentLabelFontSize, currentLabelShapeType, currentLabelWidth, currentLabelHeight, updateCurrentCard, defaultLabelColor])

    // Finish polygon drawing and show label input
    const finishPolygonDrawing = useCallback(() => {
        if (polygonPoints.length < 6) {
            // Need at least 3 points (6 values)
            setPolygonPoints([])
            setIsDrawingPolygon(false)
            return
        }

        // Calculate centroid for label input position
        let sumX = 0, sumY = 0
        const numPoints = polygonPoints.length / 2
        for (let i = 0; i < polygonPoints.length; i += 2) {
            sumX += polygonPoints[i]
            sumY += polygonPoints[i + 1]
        }
        const centroidX = sumX / numPoints
        const centroidY = sumY / numPoints

        setLabelInputPosition({ x: centroidX, y: centroidY })
        setShowLabelInput(true)
        setCurrentLabelText('')
    }, [polygonPoints])

    // Add polygon label (called when user submits the label text)
    const addPolygonLabel = useCallback(() => {
        if (!currentLabelText.trim() || polygonPoints.length < 6) {
            setShowLabelInput(false)
            setPolygonPoints([])
            setIsDrawingPolygon(false)
            return
        }

        // Calculate centroid
        let sumX = 0, sumY = 0
        const numPoints = polygonPoints.length / 2
        for (let i = 0; i < polygonPoints.length; i += 2) {
            sumX += polygonPoints[i]
            sumY += polygonPoints[i + 1]
        }

        const newLabel: DiagramLabel = {
            id: crypto.randomUUID(),
            shapeType: 'polygon',
            x: sumX / numPoints, // centroid x
            y: sumY / numPoints, // centroid y
            polygonPoints: [...polygonPoints],
            text: currentLabelText.trim(),
            fontSize: currentLabelFontSize,
            color: defaultLabelColor,
            textOffsetX: 0,
            textOffsetY: 0
        }

        updateCurrentCard(card => ({
            ...card,
            labels: [...card.labels, newLabel]
        }))

        setShowLabelInput(false)
        setCurrentLabelText('')
        setPolygonPoints([])
        setIsDrawingPolygon(false)
    }, [currentLabelText, polygonPoints, currentLabelFontSize, updateCurrentCard, defaultLabelColor])

    // Handle double-click to finish polygon
    const handleCanvasDoubleClick = useCallback((e: React.MouseEvent) => {
        if (selectedTool === 'label' && currentLabelShapeType === 'polygon' && isDrawingPolygon) {
            e.preventDefault()
            e.stopPropagation()
            finishPolygonDrawing()
        }
    }, [selectedTool, currentLabelShapeType, isDrawingPolygon, finishPolygonDrawing])

    // Handle element drag start
    const handleElementDragStart = useCallback((e: React.MouseEvent, elementId: string, elementType: 'image' | 'label' | 'shape') => {
        if (selectedTool !== 'select' || isReadOnly) return
        e.stopPropagation()

        const coords = getSvgCoords(e)

        if (elementType === 'image' && currentCard) {
            const img = currentCard.images.find(i => i.id === elementId)
            if (img) {
                setIsDragging(true)
                setSelectedElementId(elementId)
                setSelectedElementType('image')
                setDragStart({ x: coords.x, y: coords.y, elemX: img.x, elemY: img.y })
            }
        } else if (elementType === 'label' && currentCard) {
            const label = currentCard.labels.find(l => l.id === elementId)
            if (label) {
                setIsDragging(true)
                setSelectedElementId(elementId)
                setSelectedElementType('label')
                setDragStart({
                    x: coords.x,
                    y: coords.y,
                    elemX: label.x,
                    elemY: label.y,
                    // Store original polygon points for proper drag calculation
                    polygonPoints: label.polygonPoints ? [...label.polygonPoints] : undefined
                })
            }
        } else if (elementType === 'shape' && currentCard) {
            const shape = currentCard.shapes.find(s => s.id === elementId)
            if (shape) {
                setIsDragging(true)
                setSelectedElementId(elementId)
                setSelectedElementType('shape')
                // Store the first point as the reference for dragging
                // Also store all original points for proper calculation
                setDragStart({
                    x: coords.x,
                    y: coords.y,
                    elemX: shape.points[0],
                    elemY: shape.points[1],
                    // Store original shape points
                    shapePoints: [...shape.points]
                })
            }
        }
    }, [selectedTool, isReadOnly, getSvgCoords, currentCard])

    // Handle resize start
    const handleResizeStart = useCallback((e: React.MouseEvent, elementId: string, handle: string, elementType: 'image' | 'label' | 'shape') => {
        if (selectedTool !== 'select' || isReadOnly) return
        e.stopPropagation()

        const coords = getSvgCoords(e)

        if (elementType === 'image' && currentCard) {
            const img = currentCard.images.find(i => i.id === elementId)
            if (img) {
                setIsResizing(true)
                setResizeHandle(handle)
                setSelectedElementId(elementId)
                setSelectedElementType('image')
                setDragStart({ x: coords.x, y: coords.y, elemX: img.x, elemY: img.y, elemW: img.width, elemH: img.height })
            }
        } else if (elementType === 'label' && currentCard) {
            const label = currentCard.labels.find(l => l.id === elementId)
            if (label) {
                setIsResizing(true)
                setResizeHandle(handle)
                setSelectedElementId(elementId)
                setSelectedElementType('label')
                setDragStart({
                    x: coords.x,
                    y: coords.y,
                    elemX: label.x,
                    elemY: label.y,
                    elemW: label.width || 100,
                    elemH: label.height || 60
                })
            }
        } else if (elementType === 'shape' && currentCard) {
            const shape = currentCard.shapes.find(s => s.id === elementId)
            if (shape) {
                setIsResizing(true)
                setResizeHandle(handle)
                setSelectedElementId(elementId)
                setSelectedElementType('shape')
                setDragStart({
                    x: coords.x,
                    y: coords.y,
                    elemX: shape.points[0],
                    elemY: shape.points[1],
                    // Store original shape points for resize calculation
                    shapePoints: [...shape.points]
                })
            }
        }
    }, [selectedTool, isReadOnly, getSvgCoords, currentCard])

    // Handle text drag start (for moving label text independently)
    const handleTextDragStart = useCallback((e: React.MouseEvent, labelId: string) => {
        if (selectedTool !== 'select' || isReadOnly) return
        e.stopPropagation()
        const coords = getSvgCoords(e)
        const label = currentCard?.labels.find(l => l.id === labelId)
        if (!label) return

        setIsDragging(true)
        setIsDraggingText(true)
        setSelectedElementId(labelId)
        setSelectedElementType('label')
        setDragStart({
            x: coords.x,
            y: coords.y,
            elemX: label.x,
            elemY: label.y,
            textOffsetX: label.textOffsetX || 0,
            textOffsetY: label.textOffsetY || 0
        })
    }, [selectedTool, isReadOnly, getSvgCoords, currentCard])

    // Reset label text position to center
    const resetLabelTextPosition = useCallback(() => {
        if (!selectedElementId || selectedElementType !== 'label') return
        updateCurrentCard(card => ({
            ...card,
            labels: card.labels.map(label =>
                label.id === selectedElementId
                    ? { ...label, textOffsetX: 0, textOffsetY: 0 }
                    : label
            )
        }))
    }, [selectedElementId, selectedElementType, updateCurrentCard])

    // Panel drag handlers
    const handlePanelDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDraggingPanel(true)
        const currentX = editPanelPos?.x ?? 0
        const currentY = editPanelPos?.y ?? 0
        setPanelDragStart({ x: e.clientX, y: e.clientY, panelX: currentX, panelY: currentY })
    }, [editPanelPos])

    const handlePanelDragMove = useCallback((e: MouseEvent) => {
        if (!isDraggingPanel || !panelDragStart) return
        const dx = e.clientX - panelDragStart.x
        const dy = e.clientY - panelDragStart.y
        setEditPanelPos({ x: panelDragStart.panelX + dx, y: panelDragStart.panelY + dy })
    }, [isDraggingPanel, panelDragStart])

    const handlePanelDragEnd = useCallback(() => {
        setIsDraggingPanel(false)
        setPanelDragStart(null)
    }, [])

    // Effect to handle panel dragging with document-level mouse events
    useEffect(() => {
        if (isDraggingPanel) {
            document.addEventListener('mousemove', handlePanelDragMove)
            document.addEventListener('mouseup', handlePanelDragEnd)
            return () => {
                document.removeEventListener('mousemove', handlePanelDragMove)
                document.removeEventListener('mouseup', handlePanelDragEnd)
            }
        }
    }, [isDraggingPanel, handlePanelDragMove, handlePanelDragEnd])

    // Reset panel position when selection changes
    useEffect(() => {
        setEditPanelPos(null)
    }, [selectedElementId])

    // Update label font size
    const updateLabelFontSize = useCallback((newSize: number) => {
        if (!selectedElementId || selectedElementType !== 'label') return
        updateCurrentCard(card => ({
            ...card,
            labels: card.labels.map(label =>
                label.id === selectedElementId
                    ? { ...label, fontSize: newSize }
                    : label
            )
        }))
    }, [selectedElementId, selectedElementType, updateCurrentCard])

    // Update label text
    const updateLabelText = useCallback((newText: string) => {
        if (!selectedElementId || selectedElementType !== 'label') return
        updateCurrentCard(card => ({
            ...card,
            labels: card.labels.map(label =>
                label.id === selectedElementId
                    ? { ...label, text: newText }
                    : label
            )
        }))
    }, [selectedElementId, selectedElementType, updateCurrentCard])

    // Update label color
    const updateLabelColor = useCallback((newColor: string) => {
        if (!selectedElementId || selectedElementType !== 'label') return
        updateCurrentCard(card => ({
            ...card,
            labels: card.labels.map(label =>
                label.id === selectedElementId
                    ? { ...label, color: newColor }
                    : label
            )
        }))
    }, [selectedElementId, selectedElementType, updateCurrentCard])

    // Update label shape type
    const updateLabelShapeType = useCallback((newShapeType: LabelShapeType) => {
        if (!selectedElementId || selectedElementType !== 'label') return
        updateCurrentCard(card => ({
            ...card,
            labels: card.labels.map(label =>
                label.id === selectedElementId
                    ? {
                        ...label,
                        shapeType: newShapeType,
                        // Add default dimensions if switching to non-point shape
                        width: newShapeType !== 'point' ? (label.width || 100) : undefined,
                        height: newShapeType === 'rectangle' ? (label.height || 60) : undefined
                    }
                    : label
            )
        }))
    }, [selectedElementId, selectedElementType, updateCurrentCard])

    // Update label dimensions
    const updateLabelDimensions = useCallback((width: number, height: number) => {
        if (!selectedElementId || selectedElementType !== 'label') return
        updateCurrentCard(card => ({
            ...card,
            labels: card.labels.map(label =>
                label.id === selectedElementId
                    ? { ...label, width, height }
                    : label
            )
        }))
    }, [selectedElementId, selectedElementType, updateCurrentCard])

    // Update shape color
    const updateShapeColor = useCallback((newColor: string) => {
        if (!selectedElementId || selectedElementType !== 'shape') return
        updateCurrentCard(card => ({
            ...card,
            shapes: card.shapes.map(shape =>
                shape.id === selectedElementId
                    ? { ...shape, color: newColor }
                    : shape
            )
        }))
    }, [selectedElementId, selectedElementType, updateCurrentCard])

    // Update shape stroke width
    const updateShapeStrokeWidth = useCallback((newWidth: number) => {
        if (!selectedElementId || selectedElementType !== 'shape') return
        updateCurrentCard(card => ({
            ...card,
            shapes: card.shapes.map(shape =>
                shape.id === selectedElementId
                    ? { ...shape, strokeWidth: newWidth }
                    : shape
            )
        }))
    }, [selectedElementId, selectedElementType, updateCurrentCard])

    // Update shape fill color
    const updateShapeFillColor = useCallback((newFillColor: string | undefined) => {
        if (!selectedElementId || selectedElementType !== 'shape') return
        updateCurrentCard(card => ({
            ...card,
            shapes: card.shapes.map(shape =>
                shape.id === selectedElementId
                    ? { ...shape, fillColor: newFillColor }
                    : shape
            )
        }))
    }, [selectedElementId, selectedElementType, updateCurrentCard])

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Undo: Ctrl+Z (or Cmd+Z on Mac)
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault()
                undo()
                return
            }
            // Redo: Ctrl+Shift+Z or Ctrl+Y (or Cmd+Shift+Z / Cmd+Y on Mac)
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault()
                redo()
                return
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if ((selectedElementId || selectedElements.length > 0) && !showLabelInput) {
                    e.preventDefault()
                    deleteSelectedElement()
                }
            }
            if (e.key === 'Escape') {
                clearSelection()
                setShowLabelInput(false)
                // Cancel polygon drawing
                if (isDrawingPolygon) {
                    setPolygonPoints([])
                    setIsDrawingPolygon(false)
                }
            }
            // Enter to finish polygon drawing
            if (e.key === 'Enter' && isDrawingPolygon && !showLabelInput) {
                e.preventDefault()
                finishPolygonDrawing()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [selectedElementId, selectedElements, showLabelInput, deleteSelectedElement, isDrawingPolygon, finishPolygonDrawing, undo, redo, clearSelection])

    // Click outside to close label input
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (showLabelInput && labelInputRef.current && !labelInputRef.current.contains(e.target as Node)) {
                // Don't close if clicking on the SVG canvas (that's how we place labels)
                if (svgRef.current && svgRef.current.contains(e.target as Node)) {
                    return
                }
                setShowLabelInput(false)
                setCurrentLabelText('')
                // Also cancel polygon drawing if active
                if (isDrawingPolygon) {
                    setPolygonPoints([])
                    setIsDrawingPolygon(false)
                }
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [showLabelInput, isDrawingPolygon])

    // Loading state
    if (isLoading) {
        return (
            <div className="diagram_editor">
                <Header />
                <div className="diagram_loading">Loading diagram...</div>
            </div>
        )
    }

    const tools: { id: EditorTool; icon: string; label: string }[] = [
        { id: 'select', icon: '↖', label: 'Select' },
        { id: 'image', icon: '🖼', label: 'Image' },
        { id: 'arrow', icon: '→', label: 'Arrow' },
        { id: 'rectangle', icon: '□', label: 'Rectangle' },
        { id: 'circle', icon: '○', label: 'Circle' },
        { id: 'line', icon: '/', label: 'Line' }
    ]

    return (
        <div className="diagram_editor">
            <Header />

            <div className="diagram_header">
                <div className="diagram_title_row">
                    <input
                        type="text"
                        className="diagram_title_input"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Untitled Diagram"
                        disabled={isReadOnly}
                    />
                    <TagInput
                        tags={tags}
                        onTagsChange={handleTagsChange}
                        readOnly={isReadOnly}
                        placeholder="Add tags..."
                        suggestions={allUserTags}
                    />
                </div>
                <div className="diagram_header_actions">
                    <span className={`diagram_save_status ${isSaved ? 'saved' : 'unsaved'}`}>
                        {isSaved ? '✓ Saved' : '● Saving...'}
                    </span>
                    <button
                        className="diagram_learn_btn"
                        onClick={() => navigate(`/learn/diagram/${sessionId}`)}
                    >
                        Learn Mode
                    </button>
                </div>
            </div>

            <div className="diagram_workspace">
                {/* Toolbar */}
                <div className="diagram_toolbar">
                    {/* Label Tool - Highlighted and Separate */}
                    <div className="diagram_label_tool_section">
                        <button
                            className={`diagram_label_tool_btn ${selectedTool === 'label' ? 'active' : ''}`}
                            onClick={() => {
                                setSelectedTool('label')
                                clearSelection()
                            }}
                            title="Label Tool - Add labels to your diagram for learning"
                            disabled={isReadOnly}
                        >
                            <span className="label_tool_icon">🏷️</span>
                            <span className="label_tool_text">Label</span>
                        </button>
                    </div>

                    <div className="diagram_tool_divider" />

                    <div className="diagram_tool_group">
                        {tools.map(tool => (
                            <button
                                key={tool.id}
                                className={`diagram_tool_btn ${selectedTool === tool.id ? 'active' : ''}`}
                                onClick={() => {
                                    if (tool.id === 'image') {
                                        setShowImportModal(true)
                                    } else {
                                        setSelectedTool(tool.id)
                                        // Clear selection when switching to a non-select tool
                                        if (tool.id !== 'select') {
                                            clearSelection()
                                        }
                                    }
                                }}
                                title={tool.label}
                                disabled={isReadOnly}
                            >
                                {tool.icon}
                            </button>
                        ))}
                    </div>

                    <div className="diagram_tool_divider" />

                    {/* Undo/Redo buttons */}
                    <div className="diagram_tool_group">
                        <button
                            className="diagram_tool_btn"
                            onClick={undo}
                            disabled={isReadOnly || historyIndex < 0}
                            title="Undo (Ctrl+Z)"
                        >
                            ↶
                        </button>
                        <button
                            className="diagram_tool_btn"
                            onClick={redo}
                            disabled={isReadOnly || historyIndex >= history.length - 1}
                            title="Redo (Ctrl+Y)"
                        >
                            ↷
                        </button>
                    </div>

                    <div className="diagram_tool_divider" />

                    <div className="diagram_tool_group">
                        <label className="diagram_color_picker">
                            <span>Stroke:</span>
                            <input
                                type="color"
                                value={currentShapeColor}
                                onChange={(e) => setCurrentShapeColor(e.target.value)}
                                disabled={isReadOnly}
                            />
                        </label>
                        <label className="diagram_stroke_width">
                            <span>Width:</span>
                            <input
                                type="range"
                                min="0"
                                max="10"
                                value={currentStrokeWidth}
                                onChange={(e) => setCurrentStrokeWidth(Number(e.target.value))}
                                disabled={isReadOnly}
                            />
                        </label>
                        <label className="diagram_fill_toggle">
                            <input
                                type="checkbox"
                                checked={currentShapeFillEnabled}
                                onChange={(e) => setCurrentShapeFillEnabled(e.target.checked)}
                                disabled={isReadOnly}
                            />
                            <span>Fill</span>
                        </label>
                        {currentShapeFillEnabled && (
                            <label className="diagram_color_picker">
                                <input
                                    type="color"
                                    value={currentShapeFillColor || '#ffffff'}
                                    onChange={(e) => setCurrentShapeFillColor(e.target.value)}
                                    disabled={isReadOnly}
                                />
                            </label>
                        )}
                    </div>

                    <div className="diagram_tool_divider" />

                    {selectedElementId && selectedElementType === 'image' && (
                        <div className="diagram_tool_group">
                            <button onClick={bringToFront} disabled={isReadOnly} title="Bring to Front">
                                ↑ Front
                            </button>
                            <button onClick={sendToBack} disabled={isReadOnly} title="Send to Back">
                                ↓ Back
                            </button>
                        </div>
                    )}

                    {/* Label shape type selector - shown when label tool is selected */}
                    {selectedTool === 'label' && (
                        <div className="diagram_label_shape_selector">
                            <span>Shape:</span>
                            <div className="diagram_label_shape_buttons">
                                <button
                                    className={`diagram_shape_btn ${currentLabelShapeType === 'point' ? 'active' : ''}`}
                                    onClick={() => setCurrentLabelShapeType('point')}
                                    disabled={isReadOnly}
                                    title="Point marker"
                                >
                                    ●
                                </button>
                                <button
                                    className={`diagram_shape_btn ${currentLabelShapeType === 'rectangle' ? 'active' : ''}`}
                                    onClick={() => setCurrentLabelShapeType('rectangle')}
                                    disabled={isReadOnly}
                                    title="Rectangle area"
                                >
                                    ▢
                                </button>
                                <button
                                    className={`diagram_shape_btn ${currentLabelShapeType === 'circle' ? 'active' : ''}`}
                                    onClick={() => setCurrentLabelShapeType('circle')}
                                    disabled={isReadOnly}
                                    title="Circle area"
                                >
                                    ○
                                </button>
                                <button
                                    className={`diagram_shape_btn ${currentLabelShapeType === 'polygon' ? 'active' : ''}`}
                                    onClick={() => setCurrentLabelShapeType('polygon')}
                                    disabled={isReadOnly}
                                    title="Polygon area (click to add points, double-click to finish)"
                                >
                                    ⬡
                                </button>
                            </div>
                            {(currentLabelShapeType === 'rectangle' || currentLabelShapeType === 'circle') && (
                                <div className="diagram_label_size_controls">
                                    <label>
                                        W: <input
                                            type="number"
                                            min="20"
                                            max="400"
                                            value={currentLabelWidth}
                                            onChange={(e) => setCurrentLabelWidth(Number(e.target.value))}
                                            disabled={isReadOnly}
                                        />
                                    </label>
                                    {currentLabelShapeType === 'rectangle' && (
                                        <label>
                                            H: <input
                                                type="number"
                                                min="20"
                                                max="400"
                                                value={currentLabelHeight}
                                                onChange={(e) => setCurrentLabelHeight(Number(e.target.value))}
                                                disabled={isReadOnly}
                                            />
                                        </label>
                                    )}
                                </div>
                            )}
                            {currentLabelShapeType === 'polygon' && (
                                <div className="diagram_polygon_hint">
                                    {isDrawingPolygon
                                        ? `${polygonPoints.length / 2} points - Double-click or press Enter to finish`
                                        : 'Click on canvas to start drawing polygon'}
                                </div>
                            )}
                            <div className="diagram_default_color_control">
                                <label>
                                    Default Color:
                                    <input
                                        type="color"
                                        value={defaultLabelColor}
                                        onChange={(e) => setDefaultLabelColor(e.target.value)}
                                        disabled={isReadOnly}
                                    />
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Delete button for non-label selected elements (labels use the edit panel) */}
                    {selectedElementId && selectedElementType !== 'label' && (
                        <button
                            className="diagram_delete_btn"
                            onClick={deleteSelectedElement}
                            disabled={isReadOnly}
                        >
                            🗑 Delete
                        </button>
                    )}

                    {/* Delete button for multi-selection */}
                    {selectedElements.length > 0 && (
                        <button
                            className="diagram_delete_btn"
                            onClick={deleteSelectedElement}
                            disabled={isReadOnly}
                        >
                            🗑 Delete {selectedElements.length} items
                        </button>
                    )}
                </div>

                {/* Canvas area */}
                <div className="diagram_canvas_container" ref={containerRef}>
                    <svg
                        ref={svgRef}
                        className="diagram_canvas"
                        viewBox="0 0 800 600"
                        preserveAspectRatio="xMidYMid meet"
                        data-tool={selectedTool}
                        onMouseDown={handleCanvasMouseDown}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={handleCanvasMouseUp}
                        onMouseLeave={handleCanvasMouseUp}
                        onDoubleClick={handleCanvasDoubleClick}
                        onDragStart={(e) => e.preventDefault()}
                    >
                        {/* Background */}
                        <rect width="100%" height="100%" fill="#1a1a1a" />

                        {/* Images */}
                        {currentCard?.images
                            .sort((a, b) => a.zIndex - b.zIndex)
                            .map(img => (
                                <g key={img.id}>
                                    <image
                                        href={img.src}
                                        x={img.x}
                                        y={img.y}
                                        width={img.width}
                                        height={img.height}
                                        opacity={img.opacity}
                                        className={selectedElementId === img.id ? 'selected' : ''}
                                        style={{ cursor: selectedTool === 'select' ? 'move' : 'default' }}
                                        onMouseDown={(e) => handleElementDragStart(e, img.id, 'image')}
                                    />
                                    {/* Resize handles for selected images */}
                                    {selectedElementId === img.id && selectedTool === 'select' && !isReadOnly && (
                                        <>
                                            {/* Corner handles */}
                                            <rect x={img.x - 5} y={img.y - 5} width={10} height={10} fill="#00d4ff"
                                                  style={{ cursor: 'nw-resize' }} onMouseDown={(e) => handleResizeStart(e, img.id, 'nw', 'image')} />
                                            <rect x={img.x + img.width - 5} y={img.y - 5} width={10} height={10} fill="#00d4ff"
                                                  style={{ cursor: 'ne-resize' }} onMouseDown={(e) => handleResizeStart(e, img.id, 'ne', 'image')} />
                                            <rect x={img.x - 5} y={img.y + img.height - 5} width={10} height={10} fill="#00d4ff"
                                                  style={{ cursor: 'sw-resize' }} onMouseDown={(e) => handleResizeStart(e, img.id, 'sw', 'image')} />
                                            <rect x={img.x + img.width - 5} y={img.y + img.height - 5} width={10} height={10} fill="#00d4ff"
                                                  style={{ cursor: 'se-resize' }} onMouseDown={(e) => handleResizeStart(e, img.id, 'se', 'image')} />
                                            {/* Edge handles */}
                                            <rect x={img.x + img.width / 2 - 5} y={img.y - 5} width={10} height={10} fill="#00d4ff"
                                                  style={{ cursor: 'n-resize' }} onMouseDown={(e) => handleResizeStart(e, img.id, 'n', 'image')} />
                                            <rect x={img.x + img.width / 2 - 5} y={img.y + img.height - 5} width={10} height={10} fill="#00d4ff"
                                                  style={{ cursor: 's-resize' }} onMouseDown={(e) => handleResizeStart(e, img.id, 's', 'image')} />
                                            <rect x={img.x - 5} y={img.y + img.height / 2 - 5} width={10} height={10} fill="#00d4ff"
                                                  style={{ cursor: 'w-resize' }} onMouseDown={(e) => handleResizeStart(e, img.id, 'w', 'image')} />
                                            <rect x={img.x + img.width - 5} y={img.y + img.height / 2 - 5} width={10} height={10} fill="#00d4ff"
                                                  style={{ cursor: 'e-resize' }} onMouseDown={(e) => handleResizeStart(e, img.id, 'e', 'image')} />
                                        </>
                                    )}
                                </g>
                            ))}

                        {/* Shapes */}
                        {currentCard?.shapes.map(shape => {
                            const [x1, y1, x2, y2] = shape.points
                            const isSelected = selectedElementId === shape.id
                            const shapeStyle = { cursor: selectedTool === 'select' ? 'move' : 'default' }

                            if (shape.type === 'rectangle') {
                                const minX = Math.min(x1, x2)
                                const minY = Math.min(y1, y2)
                                const width = Math.abs(x2 - x1)
                                const height = Math.abs(y2 - y1)
                                return (
                                    <g key={shape.id}>
                                        <rect
                                            x={minX}
                                            y={minY}
                                            width={width}
                                            height={height}
                                            stroke={shape.strokeWidth > 0 ? shape.color : 'none'}
                                            strokeWidth={shape.strokeWidth}
                                            fill={shape.fillColor || 'transparent'}
                                            className={isSelected ? 'selected' : ''}
                                            style={shapeStyle}
                                            onMouseDown={(e) => handleElementDragStart(e, shape.id, 'shape')}
                                        />
                                        {/* Resize handles for selected rectangle */}
                                        {isSelected && selectedTool === 'select' && !isReadOnly && (
                                            <>
                                                <rect x={minX - 4} y={minY - 4} width={8} height={8} fill="#00d4ff"
                                                      style={{ cursor: 'nwse-resize' }} onMouseDown={(e) => handleResizeStart(e, shape.id, 'nw', 'shape')} />
                                                <rect x={minX + width - 4} y={minY - 4} width={8} height={8} fill="#00d4ff"
                                                      style={{ cursor: 'nesw-resize' }} onMouseDown={(e) => handleResizeStart(e, shape.id, 'ne', 'shape')} />
                                                <rect x={minX - 4} y={minY + height - 4} width={8} height={8} fill="#00d4ff"
                                                      style={{ cursor: 'nesw-resize' }} onMouseDown={(e) => handleResizeStart(e, shape.id, 'sw', 'shape')} />
                                                <rect x={minX + width - 4} y={minY + height - 4} width={8} height={8} fill="#00d4ff"
                                                      style={{ cursor: 'nwse-resize' }} onMouseDown={(e) => handleResizeStart(e, shape.id, 'se', 'shape')} />
                                            </>
                                        )}
                                    </g>
                                )
                            }
                            if (shape.type === 'circle') {
                                const cx = (x1 + x2) / 2
                                const cy = (y1 + y2) / 2
                                const r = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)) / 2
                                return (
                                    <g key={shape.id}>
                                        <circle
                                            cx={cx}
                                            cy={cy}
                                            r={r}
                                            stroke={shape.strokeWidth > 0 ? shape.color : 'none'}
                                            strokeWidth={shape.strokeWidth}
                                            fill={shape.fillColor || 'transparent'}
                                            className={isSelected ? 'selected' : ''}
                                            style={shapeStyle}
                                            onMouseDown={(e) => handleElementDragStart(e, shape.id, 'shape')}
                                        />
                                        {/* Resize handle for selected circle (right edge) */}
                                        {isSelected && selectedTool === 'select' && !isReadOnly && (
                                            <rect x={cx + r - 4} y={cy - 4} width={8} height={8} fill="#00d4ff"
                                                  style={{ cursor: 'ew-resize' }} onMouseDown={(e) => handleResizeStart(e, shape.id, 'e', 'shape')} />
                                        )}
                                    </g>
                                )
                            }
                            if (shape.type === 'line') {
                                return (
                                    <g key={shape.id}>
                                        {/* Invisible wider line for easier selection */}
                                        <line
                                            x1={x1}
                                            y1={y1}
                                            x2={x2}
                                            y2={y2}
                                            stroke="transparent"
                                            strokeWidth={Math.max(shape.strokeWidth, 10)}
                                            style={shapeStyle}
                                            onMouseDown={(e) => handleElementDragStart(e, shape.id, 'shape')}
                                        />
                                        <line
                                            x1={x1}
                                            y1={y1}
                                            x2={x2}
                                            y2={y2}
                                            stroke={shape.color}
                                            strokeWidth={shape.strokeWidth}
                                            className={isSelected ? 'selected' : ''}
                                            pointerEvents="none"
                                        />
                                        {/* Endpoint handles for selected line */}
                                        {isSelected && selectedTool === 'select' && !isReadOnly && (
                                            <>
                                                <circle cx={x1} cy={y1} r={5} fill="#00d4ff"
                                                        style={{ cursor: 'move' }} onMouseDown={(e) => handleResizeStart(e, shape.id, 'start', 'shape')} />
                                                <circle cx={x2} cy={y2} r={5} fill="#00d4ff"
                                                        style={{ cursor: 'move' }} onMouseDown={(e) => handleResizeStart(e, shape.id, 'end', 'shape')} />
                                            </>
                                        )}
                                    </g>
                                )
                            }
                            if (shape.type === 'arrow') {
                                const angle = Math.atan2(y2 - y1, x2 - x1)
                                const headLen = 15
                                return (
                                    <g key={shape.id} className={isSelected ? 'selected' : ''}>
                                        {/* Invisible wider line for easier selection */}
                                        <line
                                            x1={x1}
                                            y1={y1}
                                            x2={x2}
                                            y2={y2}
                                            stroke="transparent"
                                            strokeWidth={Math.max(shape.strokeWidth, 10)}
                                            style={shapeStyle}
                                            onMouseDown={(e) => handleElementDragStart(e, shape.id, 'shape')}
                                        />
                                        <line
                                            x1={x1}
                                            y1={y1}
                                            x2={x2}
                                            y2={y2}
                                            stroke={shape.color}
                                            strokeWidth={shape.strokeWidth}
                                            pointerEvents="none"
                                        />
                                        <polygon
                                            points={`
                                                ${x2},${y2}
                                                ${x2 - headLen * Math.cos(angle - Math.PI / 6)},${y2 - headLen * Math.sin(angle - Math.PI / 6)}
                                                ${x2 - headLen * Math.cos(angle + Math.PI / 6)},${y2 - headLen * Math.sin(angle + Math.PI / 6)}
                                            `}
                                            fill={shape.color}
                                            pointerEvents="none"
                                        />
                                        {/* Endpoint handles for selected arrow */}
                                        {isSelected && selectedTool === 'select' && !isReadOnly && (
                                            <>
                                                <circle cx={x1} cy={y1} r={5} fill="#00d4ff"
                                                        style={{ cursor: 'move' }} onMouseDown={(e) => handleResizeStart(e, shape.id, 'start', 'shape')} />
                                                <circle cx={x2} cy={y2} r={5} fill="#00d4ff"
                                                        style={{ cursor: 'move' }} onMouseDown={(e) => handleResizeStart(e, shape.id, 'end', 'shape')} />
                                            </>
                                        )}
                                    </g>
                                )
                            }
                            return null
                        })}

                        {/* Drawing preview */}
                        {isDrawing && drawingStart && currentDrawEnd && (() => {
                            const start = drawingStart
                            const end = currentDrawEnd
                            const type = selectedTool as ShapeType
                            const previewFill = currentShapeFillEnabled ? (currentShapeFillColor || '#ffffff') : 'none'

                            if (type === 'rectangle') {
                                return (
                                    <rect
                                        x={Math.min(start.x, end.x)}
                                        y={Math.min(start.y, end.y)}
                                        width={Math.abs(end.x - start.x)}
                                        height={Math.abs(end.y - start.y)}
                                        stroke={currentStrokeWidth > 0 ? currentShapeColor : 'none'}
                                        strokeWidth={currentStrokeWidth}
                                        fill={previewFill}
                                        opacity={0.6}
                                        strokeDasharray="5,5"
                                    />
                                )
                            }
                            if (type === 'circle') {
                                const cx = (start.x + end.x) / 2
                                const cy = (start.y + end.y) / 2
                                const r = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)) / 2
                                return (
                                    <circle
                                        cx={cx}
                                        cy={cy}
                                        r={r}
                                        stroke={currentStrokeWidth > 0 ? currentShapeColor : 'none'}
                                        strokeWidth={currentStrokeWidth}
                                        fill={previewFill}
                                        opacity={0.6}
                                        strokeDasharray="5,5"
                                    />
                                )
                            }
                            if (type === 'line') {
                                return (
                                    <line
                                        x1={start.x}
                                        y1={start.y}
                                        x2={end.x}
                                        y2={end.y}
                                        stroke={currentShapeColor}
                                        strokeWidth={currentStrokeWidth}
                                        opacity={0.6}
                                        strokeDasharray="5,5"
                                    />
                                )
                            }
                            if (type === 'arrow') {
                                const angle = Math.atan2(end.y - start.y, end.x - start.x)
                                const headLen = 15
                                return (
                                    <g opacity={0.6}>
                                        <line
                                            x1={start.x}
                                            y1={start.y}
                                            x2={end.x}
                                            y2={end.y}
                                            stroke={currentShapeColor}
                                            strokeWidth={currentStrokeWidth}
                                            strokeDasharray="5,5"
                                        />
                                        <polygon
                                            points={`
                                                ${end.x},${end.y}
                                                ${end.x - headLen * Math.cos(angle - Math.PI / 6)},${end.y - headLen * Math.sin(angle - Math.PI / 6)}
                                                ${end.x - headLen * Math.cos(angle + Math.PI / 6)},${end.y - headLen * Math.sin(angle + Math.PI / 6)}
                                            `}
                                            fill={currentShapeColor}
                                        />
                                    </g>
                                )
                            }
                            return null
                        })()}

                        {/* Label shape drawing preview (rectangle/circle) */}
                        {isDrawingLabelShape && labelShapeStart && labelShapeEnd && (() => {
                            const start = labelShapeStart
                            const end = labelShapeEnd
                            const width = Math.abs(end.x - start.x)
                            const height = Math.abs(end.y - start.y)

                            if (currentLabelShapeType === 'rectangle') {
                                return (
                                    <rect
                                        x={Math.min(start.x, end.x)}
                                        y={Math.min(start.y, end.y)}
                                        width={width}
                                        height={height}
                                        fill="rgba(0, 212, 255, 0.2)"
                                        stroke="#00d4ff"
                                        strokeWidth="2"
                                        strokeDasharray="5,5"
                                        rx="4"
                                    />
                                )
                            }
                            if (currentLabelShapeType === 'circle') {
                                // Circle uses width for diameter
                                const cx = start.x + (end.x > start.x ? width / 2 : -width / 2)
                                const cy = start.y + (end.y > start.y ? width / 2 : -width / 2)
                                return (
                                    <circle
                                        cx={cx}
                                        cy={cy}
                                        r={width / 2}
                                        fill="rgba(0, 212, 255, 0.2)"
                                        stroke="#00d4ff"
                                        strokeWidth="2"
                                        strokeDasharray="5,5"
                                    />
                                )
                            }
                            return null
                        })()}

                        {/* Labels */}
                        {currentCard?.labels.map(label => {
                            const shapeType = label.shapeType || 'point'
                            const isSelected = selectedElementId === label.id
                            // Calculate text position (centered on shape)
                            const textX = label.x + (label.textOffsetX || 0)
                            const textY = label.y + (label.textOffsetY || 0)

                            return (
                                <g
                                    key={label.id}
                                    className={isSelected ? 'selected' : ''}
                                    style={{ cursor: selectedTool === 'select' ? 'move' : 'default' }}
                                    onMouseDown={(e) => handleElementDragStart(e, label.id, 'label')}
                                >
                                    {/* Shape rendering based on shapeType */}
                                    {shapeType === 'point' && (
                                        <>
                                            <circle
                                                cx={label.x}
                                                cy={label.y}
                                                r={isSelected ? 10 : 8}
                                                fill={isSelected ? 'rgba(0, 212, 255, 0.6)' : 'rgba(0, 212, 255, 0.4)'}
                                                stroke="#00d4ff"
                                                strokeWidth={isSelected ? '2' : '1'}
                                            />
                                            <rect
                                                x={label.x + 12}
                                                y={label.y - label.fontSize / 2 - 2}
                                                width={label.text.length * label.fontSize * 0.6 + 8}
                                                height={label.fontSize * 1.4}
                                                fill={isSelected ? 'rgba(0, 212, 255, 0.4)' : 'rgba(0, 212, 255, 0.2)'}
                                                stroke="#00d4ff"
                                                strokeWidth={isSelected ? '2' : '1'}
                                                rx="4"
                                            />
                                        </>
                                    )}
                                    {shapeType === 'rectangle' && (
                                        <rect
                                            x={label.x}
                                            y={label.y}
                                            width={label.width || 100}
                                            height={label.height || 60}
                                            fill={isSelected ? 'rgba(0, 212, 255, 0.3)' : 'rgba(0, 212, 255, 0.15)'}
                                            stroke="#00d4ff"
                                            strokeWidth={isSelected ? '2' : '1'}
                                            rx="4"
                                        />
                                    )}
                                    {shapeType === 'circle' && (
                                        <circle
                                            cx={label.x + (label.width || 100) / 2}
                                            cy={label.y + (label.width || 100) / 2}
                                            r={(label.width || 100) / 2}
                                            fill={isSelected ? 'rgba(0, 212, 255, 0.3)' : 'rgba(0, 212, 255, 0.15)'}
                                            stroke="#00d4ff"
                                            strokeWidth={isSelected ? '2' : '1'}
                                        />
                                    )}
                                    {shapeType === 'polygon' && label.polygonPoints && label.polygonPoints.length >= 6 && (
                                        <polygon
                                            points={label.polygonPoints.reduce((acc: string, val: number, i: number) => {
                                                if (i % 2 === 0) return acc + (i > 0 ? ' ' : '') + val
                                                return acc + ',' + val
                                            }, '')}
                                            fill={isSelected ? 'rgba(0, 212, 255, 0.3)' : 'rgba(0, 212, 255, 0.15)'}
                                            stroke="#00d4ff"
                                            strokeWidth={isSelected ? '2' : '1'}
                                        />
                                    )}

                                    {/* Text label - positioned based on shape type with offset */}
                                    {(() => {
                                        // Calculate base text position
                                        const baseTextX = shapeType === 'point' ? label.x + 16 : shapeType === 'polygon' ? label.x : label.x + (label.width || 100) / 2
                                        const baseTextY = shapeType === 'point' ? label.y + label.fontSize / 3 : shapeType === 'polygon' ? label.y + label.fontSize / 3 : label.y + (shapeType === 'rectangle' ? (label.height || 60) / 2 : (label.width || 100) / 2) + label.fontSize / 3
                                        // Apply offset
                                        const finalTextX = baseTextX + (label.textOffsetX || 0)
                                        const finalTextY = baseTextY + (label.textOffsetY || 0)

                                        return (
                                            <g>
                                                {/* Connection line from shape to text when offset */}
                                                {isSelected && (label.textOffsetX || label.textOffsetY) && (
                                                    <line
                                                        x1={shapeType === 'point' ? label.x : shapeType === 'polygon' ? label.x : label.x + (label.width || 100) / 2}
                                                        y1={shapeType === 'point' ? label.y : shapeType === 'polygon' ? label.y : label.y + (shapeType === 'rectangle' ? (label.height || 60) / 2 : (label.width || 100) / 2)}
                                                        x2={finalTextX}
                                                        y2={finalTextY - label.fontSize / 3}
                                                        stroke="#00d4ff"
                                                        strokeWidth="1"
                                                        strokeDasharray="4,4"
                                                        opacity="0.5"
                                                    />
                                                )}
                                                <text
                                                    x={finalTextX}
                                                    y={finalTextY}
                                                    fill={label.color}
                                                    fontSize={label.fontSize}
                                                    fontFamily="system-ui"
                                                    textAnchor={shapeType === 'point' ? 'start' : 'middle'}
                                                    style={{ cursor: isSelected && selectedTool === 'select' ? 'move' : 'default' }}
                                                    onMouseDown={(e) => handleTextDragStart(e, label.id)}
                                                >
                                                    {label.text}
                                                </text>
                                                {/* Text drag handle indicator when selected */}
                                                {isSelected && selectedTool === 'select' && !isReadOnly && (
                                                    <circle
                                                        cx={finalTextX + (shapeType === 'point' ? label.text.length * label.fontSize * 0.3 : 0)}
                                                        cy={finalTextY - label.fontSize / 2}
                                                        r={5}
                                                        fill="#ff6b6b"
                                                        stroke="#ffffff"
                                                        strokeWidth="1"
                                                        style={{ cursor: 'move' }}
                                                        onMouseDown={(e) => handleTextDragStart(e, label.id)}
                                                    />
                                                )}
                                            </g>
                                        )
                                    })()}

                                    {/* Resize handles for selected labels with shapes */}
                                    {isSelected && selectedTool === 'select' && !isReadOnly && shapeType !== 'point' && (
                                        <>
                                            {/* Corner handles for rectangle */}
                                            {shapeType === 'rectangle' && (
                                                <>
                                                    <rect x={label.x - 4} y={label.y - 4} width={8} height={8} fill="#00d4ff" style={{ cursor: 'nwse-resize' }}
                                                          onMouseDown={(e) => handleResizeStart(e, label.id, 'nw', 'label')} />
                                                    <rect x={label.x + (label.width || 100) - 4} y={label.y - 4} width={8} height={8} fill="#00d4ff" style={{ cursor: 'nesw-resize' }}
                                                          onMouseDown={(e) => handleResizeStart(e, label.id, 'ne', 'label')} />
                                                    <rect x={label.x - 4} y={label.y + (label.height || 60) - 4} width={8} height={8} fill="#00d4ff" style={{ cursor: 'nesw-resize' }}
                                                          onMouseDown={(e) => handleResizeStart(e, label.id, 'sw', 'label')} />
                                                    <rect x={label.x + (label.width || 100) - 4} y={label.y + (label.height || 60) - 4} width={8} height={8} fill="#00d4ff" style={{ cursor: 'nwse-resize' }}
                                                          onMouseDown={(e) => handleResizeStart(e, label.id, 'se', 'label')} />
                                                </>
                                            )}
                                            {/* Single handle for circle (right edge to resize radius) */}
                                            {shapeType === 'circle' && (
                                                <rect
                                                    x={label.x + (label.width || 100) - 4}
                                                    y={label.y + (label.width || 100) / 2 - 4}
                                                    width={8}
                                                    height={8}
                                                    fill="#00d4ff"
                                                    style={{ cursor: 'ew-resize' }}
                                                    onMouseDown={(e) => handleResizeStart(e, label.id, 'e', 'label')}
                                                />
                                            )}
                                            {/* Vertex handles for polygon */}
                                            {shapeType === 'polygon' && label.polygonPoints && (
                                                <>
                                                    {Array.from({ length: label.polygonPoints.length / 2 }).map((_, i) => (
                                                        <circle
                                                            key={`vertex-${i}`}
                                                            cx={label.polygonPoints![i * 2]}
                                                            cy={label.polygonPoints![i * 2 + 1]}
                                                            r={6}
                                                            fill="#00d4ff"
                                                            stroke="#ffffff"
                                                            strokeWidth="2"
                                                            style={{ cursor: 'move' }}
                                                            onMouseDown={(e) => {
                                                                e.stopPropagation()
                                                                setSelectedPolygonVertex(i)
                                                                setIsDragging(true)
                                                                setSelectedElementId(label.id)
                                                                setSelectedElementType('label')
                                                                const coords = getSvgCoords(e)
                                                                setDragStart({ x: coords.x, y: coords.y, elemX: label.polygonPoints![i * 2], elemY: label.polygonPoints![i * 2 + 1] })
                                                            }}
                                                        />
                                                    ))}
                                                </>
                                            )}
                                        </>
                                    )}
                                </g>
                            )
                        })}

                        {/* Polygon drawing preview (while clicking points) */}
                        {isDrawingPolygon && polygonPoints.length >= 2 && !showLabelInput && (
                            <g>
                                {/* Lines connecting points */}
                                <polyline
                                    points={polygonPoints.reduce((acc, val, i) => {
                                        if (i % 2 === 0) return acc + (i > 0 ? ' ' : '') + val
                                        return acc + ',' + val
                                    }, '')}
                                    fill="none"
                                    stroke="#00d4ff"
                                    strokeWidth="2"
                                    strokeDasharray="5,5"
                                />
                                {/* Vertex circles */}
                                {Array.from({ length: polygonPoints.length / 2 }).map((_, i) => (
                                    <circle
                                        key={i}
                                        cx={polygonPoints[i * 2]}
                                        cy={polygonPoints[i * 2 + 1]}
                                        r={6}
                                        fill={i === 0 ? '#ff6b6b' : '#00d4ff'}
                                        stroke="#ffffff"
                                        strokeWidth="2"
                                        style={{ cursor: 'pointer' }}
                                    />
                                ))}
                                {/* Point numbers */}
                                {Array.from({ length: polygonPoints.length / 2 }).map((_, i) => (
                                    <text
                                        key={`label-${i}`}
                                        x={polygonPoints[i * 2]}
                                        y={polygonPoints[i * 2 + 1] - 12}
                                        fill="#ffffff"
                                        fontSize="12"
                                        textAnchor="middle"
                                    >
                                        {i + 1}
                                    </text>
                                ))}
                            </g>
                        )}

                        {/* Label preview when typing */}
                        {showLabelInput && (
                            <g opacity={0.6}>
                                {/* Shape preview based on currentLabelShapeType */}
                                {currentLabelShapeType === 'point' && (
                                    <>
                                        <circle
                                            cx={labelInputPosition.x}
                                            cy={labelInputPosition.y}
                                            r={8}
                                            fill="rgba(0, 212, 255, 0.4)"
                                            stroke="#00d4ff"
                                            strokeWidth="1"
                                            strokeDasharray="3,3"
                                        />
                                        {currentLabelText && (
                                            <rect
                                                x={labelInputPosition.x + 12}
                                                y={labelInputPosition.y - currentLabelFontSize / 2 - 2}
                                                width={currentLabelText.length * currentLabelFontSize * 0.6 + 8}
                                                height={currentLabelFontSize * 1.4}
                                                fill="rgba(0, 212, 255, 0.2)"
                                                stroke="#00d4ff"
                                                strokeWidth="1"
                                                strokeDasharray="3,3"
                                                rx="4"
                                            />
                                        )}
                                    </>
                                )}
                                {currentLabelShapeType === 'rectangle' && (
                                    <rect
                                        x={labelInputPosition.x}
                                        y={labelInputPosition.y}
                                        width={currentLabelWidth}
                                        height={currentLabelHeight}
                                        fill="rgba(0, 212, 255, 0.15)"
                                        stroke="#00d4ff"
                                        strokeWidth="1"
                                        strokeDasharray="3,3"
                                        rx="4"
                                    />
                                )}
                                {currentLabelShapeType === 'circle' && (
                                    <circle
                                        cx={labelInputPosition.x + currentLabelWidth / 2}
                                        cy={labelInputPosition.y + currentLabelWidth / 2}
                                        r={currentLabelWidth / 2}
                                        fill="rgba(0, 212, 255, 0.15)"
                                        stroke="#00d4ff"
                                        strokeWidth="1"
                                        strokeDasharray="3,3"
                                    />
                                )}
                                {currentLabelShapeType === 'polygon' && polygonPoints.length >= 6 && (
                                    <>
                                        <polygon
                                            points={polygonPoints.reduce((acc, val, i) => {
                                                if (i % 2 === 0) return acc + (i > 0 ? ' ' : '') + val
                                                return acc + ',' + val
                                            }, '')}
                                            fill="rgba(0, 212, 255, 0.15)"
                                            stroke="#00d4ff"
                                            strokeWidth="1"
                                            strokeDasharray="3,3"
                                        />
                                        {/* Vertex markers */}
                                        {Array.from({ length: polygonPoints.length / 2 }).map((_, i) => (
                                            <circle
                                                key={i}
                                                cx={polygonPoints[i * 2]}
                                                cy={polygonPoints[i * 2 + 1]}
                                                r={4}
                                                fill="#00d4ff"
                                            />
                                        ))}
                                    </>
                                )}

                                {/* Text preview */}
                                {currentLabelText && (
                                    <text
                                        x={currentLabelShapeType === 'point' ? labelInputPosition.x + 16 : labelInputPosition.x + currentLabelWidth / 2}
                                        y={currentLabelShapeType === 'point' ? labelInputPosition.y + currentLabelFontSize / 3 : labelInputPosition.y + (currentLabelShapeType === 'rectangle' ? currentLabelHeight / 2 : currentLabelWidth / 2) + currentLabelFontSize / 3}
                                        fill="#ffffff"
                                        fontSize={currentLabelFontSize}
                                        fontFamily="system-ui"
                                        textAnchor={currentLabelShapeType === 'point' ? 'start' : 'middle'}
                                    >
                                        {currentLabelText}
                                    </text>
                                )}
                            </g>
                        )}

                        {/* Selection indicator */}
                        {selectedElementId && selectedElementType === 'image' && currentCard && (
                            (() => {
                                const img = currentCard.images.find(i => i.id === selectedElementId)
                                if (!img) return null
                                return (
                                    <rect
                                        x={img.x - 2}
                                        y={img.y - 2}
                                        width={img.width + 4}
                                        height={img.height + 4}
                                        fill="none"
                                        stroke="#00d4ff"
                                        strokeWidth="2"
                                        strokeDasharray="5,5"
                                    />
                                )
                            })()
                        )}

                        {/* Selection box preview */}
                        {isSelectionBoxActive && selectionBoxStart && selectionBoxEnd && (
                            <rect
                                x={Math.min(selectionBoxStart.x, selectionBoxEnd.x)}
                                y={Math.min(selectionBoxStart.y, selectionBoxEnd.y)}
                                width={Math.abs(selectionBoxEnd.x - selectionBoxStart.x)}
                                height={Math.abs(selectionBoxEnd.y - selectionBoxStart.y)}
                                fill="rgba(0, 212, 255, 0.1)"
                                stroke="#00d4ff"
                                strokeWidth="1"
                                strokeDasharray="4,4"
                            />
                        )}

                        {/* Multi-selection highlights */}
                        {selectedElements.length > 0 && currentCard && selectedElements.map(sel => {
                            if (sel.type === 'image') {
                                const img = currentCard.images.find(i => i.id === sel.id)
                                if (!img) return null
                                return (
                                    <rect
                                        key={sel.id}
                                        x={img.x - 2}
                                        y={img.y - 2}
                                        width={img.width + 4}
                                        height={img.height + 4}
                                        fill="none"
                                        stroke="#ff6b6b"
                                        strokeWidth="2"
                                        strokeDasharray="5,5"
                                    />
                                )
                            }
                            if (sel.type === 'shape') {
                                const shape = currentCard.shapes.find(s => s.id === sel.id)
                                if (!shape) return null
                                const [x1, y1, x2, y2] = shape.points
                                const minX = Math.min(x1, x2 || x1)
                                const maxX = Math.max(x1, x2 || x1)
                                const minY = Math.min(y1, y2 || y1)
                                const maxY = Math.max(y1, y2 || y1)
                                return (
                                    <rect
                                        key={sel.id}
                                        x={minX - 5}
                                        y={minY - 5}
                                        width={maxX - minX + 10}
                                        height={maxY - minY + 10}
                                        fill="none"
                                        stroke="#ff6b6b"
                                        strokeWidth="2"
                                        strokeDasharray="5,5"
                                    />
                                )
                            }
                            if (sel.type === 'label') {
                                const label = currentCard.labels.find(l => l.id === sel.id)
                                if (!label) return null
                                const labelWidth = label.text.length * label.fontSize * 0.6 + 8
                                const labelHeight = label.fontSize * 1.4
                                return (
                                    <rect
                                        key={sel.id}
                                        x={label.x - 6}
                                        y={label.y - label.fontSize - 2}
                                        width={labelWidth + 4}
                                        height={labelHeight + 4}
                                        fill="none"
                                        stroke="#ff6b6b"
                                        strokeWidth="2"
                                        strokeDasharray="5,5"
                                    />
                                )
                            }
                            return null
                        })}
                    </svg>

                    {/* Label input overlay */}
                    {showLabelInput && svgRef.current && (() => {
                        // Convert SVG coordinates to screen coordinates for the overlay
                        const svg = svgRef.current
                        const rect = svg.getBoundingClientRect()
                        const scaleX = rect.width / 800
                        const scaleY = rect.height / 600
                        const screenX = labelInputPosition.x * scaleX
                        const screenY = labelInputPosition.y * scaleY

                        return (
                            <div
                                ref={labelInputRef}
                                className="diagram_label_input_overlay"
                                style={{
                                    left: screenX,
                                    top: screenY
                                }}
                            >
                                <input
                                    type="text"
                                    value={currentLabelText}
                                    onChange={(e) => setCurrentLabelText(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            if (isDrawingPolygon) addPolygonLabel()
                                            else addLabel()
                                        }
                                        if (e.key === 'Escape') {
                                            setShowLabelInput(false)
                                            if (isDrawingPolygon) {
                                                setPolygonPoints([])
                                                setIsDrawingPolygon(false)
                                            }
                                        }
                                    }}
                                    placeholder="Enter label text..."
                                    autoFocus
                                />
                                <div className="diagram_label_font_size">
                                    <span>Size:</span>
                                    <input
                                        type="range"
                                        min="10"
                                        max="32"
                                        value={currentLabelFontSize}
                                        onChange={(e) => setCurrentLabelFontSize(parseInt(e.target.value))}
                                    />
                                    <span>{currentLabelFontSize}px</span>
                                </div>
                                <button onClick={isDrawingPolygon ? addPolygonLabel : addLabel}>Add</button>
                            </div>
                        )
                    })()}

                    {/* Floating label edit panel - appears when a label is selected */}
                    {selectedElementId && selectedElementType === 'label' && currentCard && !isReadOnly && (() => {
                        const selectedLabel = currentCard.labels.find(l => l.id === selectedElementId)
                        if (!selectedLabel) return null

                        return (
                            <div
                                className="diagram_label_edit_panel"
                                style={editPanelPos ? {
                                    top: `calc(var(--space-4) + ${editPanelPos.y}px)`,
                                    right: `calc(var(--space-4) - ${editPanelPos.x}px)`
                                } : undefined}
                            >
                                <div
                                    className="diagram_panel_drag_handle"
                                    onMouseDown={handlePanelDragStart}
                                >
                                    <span className="diagram_panel_drag_icon">⋮⋮</span>
                                    <h4>Edit Label</h4>
                                </div>

                                <div className="diagram_edit_field">
                                    <label>Text</label>
                                    <input
                                        type="text"
                                        value={selectedLabel.text}
                                        onChange={(e) => updateLabelText(e.target.value)}
                                        placeholder="Label text..."
                                    />
                                </div>

                                <div className="diagram_edit_field">
                                    <label>Font Size</label>
                                    <div className="diagram_edit_row">
                                        <input
                                            type="range"
                                            min="10"
                                            max="48"
                                            value={selectedLabel.fontSize}
                                            onChange={(e) => updateLabelFontSize(parseInt(e.target.value))}
                                        />
                                        <span>{selectedLabel.fontSize}px</span>
                                    </div>
                                </div>

                                <div className="diagram_edit_field">
                                    <label>Text Color</label>
                                    <div className="diagram_edit_row">
                                        <input
                                            type="color"
                                            value={selectedLabel.color}
                                            onChange={(e) => updateLabelColor(e.target.value)}
                                        />
                                        <span>{selectedLabel.color}</span>
                                    </div>
                                </div>

                                <div className="diagram_edit_field">
                                    <label>Shape Type</label>
                                    <div className="diagram_edit_shape_buttons">
                                        <button
                                            className={selectedLabel.shapeType === 'point' ? 'active' : ''}
                                            onClick={() => updateLabelShapeType('point')}
                                            title="Point"
                                        >●</button>
                                        <button
                                            className={selectedLabel.shapeType === 'rectangle' ? 'active' : ''}
                                            onClick={() => updateLabelShapeType('rectangle')}
                                            title="Rectangle"
                                        >▢</button>
                                        <button
                                            className={selectedLabel.shapeType === 'circle' ? 'active' : ''}
                                            onClick={() => updateLabelShapeType('circle')}
                                            title="Circle"
                                        >○</button>
                                        <button
                                            className={selectedLabel.shapeType === 'polygon' ? 'active' : ''}
                                            disabled
                                            title="Polygon (create new to draw polygon)"
                                        >⬡</button>
                                    </div>
                                </div>

                                {/* Polygon info */}
                                {selectedLabel.shapeType === 'polygon' && selectedLabel.polygonPoints && (
                                    <div className="diagram_edit_field">
                                        <label>Polygon</label>
                                        <span className="diagram_edit_polygon_info">
                                            {selectedLabel.polygonPoints.length / 2} vertices (drag to adjust)
                                        </span>
                                    </div>
                                )}

                                {(selectedLabel.shapeType === 'rectangle' || selectedLabel.shapeType === 'circle') && (
                                    <div className="diagram_edit_field">
                                        <label>Size</label>
                                        <div className="diagram_edit_size_inputs">
                                            <div>
                                                <span>W:</span>
                                                <input
                                                    type="number"
                                                    value={selectedLabel.width || 100}
                                                    onChange={(e) => updateLabelDimensions(
                                                        parseInt(e.target.value) || 100,
                                                        selectedLabel.height || 60
                                                    )}
                                                    min="30"
                                                />
                                            </div>
                                            {selectedLabel.shapeType === 'rectangle' && (
                                                <div>
                                                    <span>H:</span>
                                                    <input
                                                        type="number"
                                                        value={selectedLabel.height || 60}
                                                        onChange={(e) => updateLabelDimensions(
                                                            selectedLabel.width || 100,
                                                            parseInt(e.target.value) || 60
                                                        )}
                                                        min="30"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Text Position */}
                                <div className="diagram_edit_field">
                                    <label>Text Position</label>
                                    <div className="diagram_edit_row">
                                        <span className="diagram_text_offset_info">
                                            {(selectedLabel.textOffsetX || selectedLabel.textOffsetY)
                                                ? `Offset: ${Math.round(selectedLabel.textOffsetX || 0)}, ${Math.round(selectedLabel.textOffsetY || 0)}`
                                                : 'Centered (drag red dot to move)'}
                                        </span>
                                    </div>
                                    {(selectedLabel.textOffsetX || selectedLabel.textOffsetY) && (
                                        <button
                                            className="diagram_reset_text_btn"
                                            onClick={resetLabelTextPosition}
                                        >
                                            Reset to Center
                                        </button>
                                    )}
                                </div>

                                <button
                                    className="diagram_edit_delete_btn"
                                    onClick={deleteSelectedElement}
                                >
                                    🗑 Delete Label
                                </button>
                            </div>
                        )
                    })()}

                    {/* Floating shape edit panel - appears when a shape is selected */}
                    {selectedElementId && selectedElementType === 'shape' && currentCard && !isReadOnly && (() => {
                        const selectedShape = currentCard.shapes.find(s => s.id === selectedElementId)
                        if (!selectedShape) return null

                        return (
                            <div
                                className="diagram_label_edit_panel diagram_shape_edit_panel"
                                style={editPanelPos ? {
                                    top: `calc(var(--space-4) + ${editPanelPos.y}px)`,
                                    right: `calc(var(--space-4) - ${editPanelPos.x}px)`
                                } : undefined}
                            >
                                <div
                                    className="diagram_panel_drag_handle"
                                    onMouseDown={handlePanelDragStart}
                                >
                                    <span className="diagram_panel_drag_icon">⋮⋮</span>
                                    <h4>Edit Shape</h4>
                                </div>

                                <div className="diagram_edit_field">
                                    <label>Color</label>
                                    <div className="diagram_edit_row">
                                        <input
                                            type="color"
                                            value={selectedShape.color}
                                            onChange={(e) => updateShapeColor(e.target.value)}
                                        />
                                        <span>{selectedShape.color}</span>
                                    </div>
                                </div>

                                <div className="diagram_edit_field">
                                    <label>Stroke Width</label>
                                    <div className="diagram_edit_row">
                                        <input
                                            type="range"
                                            min="0"
                                            max="20"
                                            value={selectedShape.strokeWidth}
                                            onChange={(e) => updateShapeStrokeWidth(parseInt(e.target.value))}
                                        />
                                        <span>{selectedShape.strokeWidth}px</span>
                                    </div>
                                </div>

                                <div className="diagram_edit_field">
                                    <label>Fill</label>
                                    <div className="diagram_edit_row">
                                        <input
                                            type="checkbox"
                                            checked={!!selectedShape.fillColor}
                                            onChange={(e) => updateShapeFillColor(e.target.checked ? '#ffffff' : undefined)}
                                        />
                                        {selectedShape.fillColor && (
                                            <>
                                                <input
                                                    type="color"
                                                    value={selectedShape.fillColor}
                                                    onChange={(e) => updateShapeFillColor(e.target.value)}
                                                />
                                                <span>{selectedShape.fillColor}</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="diagram_edit_field">
                                    <label>Type</label>
                                    <span className="diagram_edit_shape_type">{selectedShape.type}</span>
                                </div>

                                <button
                                    className="diagram_edit_delete_btn"
                                    onClick={deleteSelectedElement}
                                >
                                    🗑 Delete Shape
                                </button>
                            </div>
                        )
                    })()}
                </div>

                {/* Card navigation */}
                <div className="diagram_card_nav">
                    <button
                        onClick={() => setCurrentCardIndex(Math.max(0, currentCardIndex - 1))}
                        disabled={currentCardIndex === 0}
                    >
                        ← Prev
                    </button>
                    <span className="diagram_card_indicator">
                        Card {currentCardIndex + 1} of {diagram?.cards.length || 1}
                    </span>
                    <button
                        onClick={() => setCurrentCardIndex(Math.min((diagram?.cards.length || 1) - 1, currentCardIndex + 1))}
                        disabled={currentCardIndex >= (diagram?.cards.length || 1) - 1}
                    >
                        Next →
                    </button>
                    <button onClick={addCard} disabled={isReadOnly} className="diagram_add_card_btn">
                        + Add Card
                    </button>
                    {(diagram?.cards.length || 0) > 1 && (
                        <button onClick={deleteCard} disabled={isReadOnly} className="diagram_delete_card_btn">
                            Delete Card
                        </button>
                    )}
                </div>
            </div>

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                style={{ display: 'none' }}
            />

            {/* Import Modal */}
            <ImportModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
                onImport={(image, labels, shapes) => {
                    if (!currentCard) return
                    updateCurrentCard(card => ({
                        ...card,
                        images: [...card.images, image],
                        labels: labels ? [...card.labels, ...labels] : card.labels,
                        shapes: shapes ? [...card.shapes, ...shapes] : card.shapes
                    }))
                    setShowImportModal(false)
                }}
                defaultLabelColor={defaultLabelColor}
                currentImageCount={currentCard?.images.length || 0}
            />
        </div>
    )
}

export default DiagramEditor

