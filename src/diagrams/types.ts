/**
 * Diagram Types
 * Type definitions for diagram-based learning content
 */

// Image element in a diagram card
export interface DiagramImage {
    id: string
    src: string // Base64 data URL or storage URL
    x: number
    y: number
    width: number
    height: number
    zIndex: number
    opacity: number
    filters?: {
        brightness?: number
        contrast?: number
        saturate?: number
        hue?: number
    }
}

// Shape types supported in diagrams
export type ShapeType = 'arrow' | 'rectangle' | 'circle' | 'ellipse' | 'line' | 'polygon'

// Shape element in a diagram card
export interface DiagramShape {
    id: string
    type: ShapeType
    // For rectangles/ellipses: [x, y, width, height]
    // For lines/arrows: [x1, y1, x2, y2]
    // For polygons: [x1, y1, x2, y2, x3, y3, ...]
    // For circles: [cx, cy, radius]
    points: number[]
    color: string
    fillColor?: string
    strokeWidth: number
    zIndex: number
}

// Label shape types
export type LabelShapeType = 'point' | 'rectangle' | 'circle' | 'polygon'

// Label element in a diagram card (used for learning)
export interface DiagramLabel {
    id: string
    // Shape type determines how the label area is defined
    shapeType: LabelShapeType
    // For 'point': x, y is the marker position
    // For 'rectangle': x, y is top-left corner, width/height define size
    // For 'circle': x, y is center, width is diameter (height ignored)
    // For 'polygon': polygonPoints defines the vertices
    x: number
    y: number
    width?: number  // For rectangle and circle (diameter)
    height?: number // For rectangle only
    polygonPoints?: number[] // [x1, y1, x2, y2, ...] for polygon
    // Text properties (independent of shape size)
    text: string
    fontSize: number
    color: string
    backgroundColor?: string
    // Text position offset from shape center (optional)
    textOffsetX?: number
    textOffsetY?: number
}

// A single diagram card containing images, shapes, and labels
export interface DiagramCard {
    id: string
    images: DiagramImage[]
    shapes: DiagramShape[]
    labels: DiagramLabel[]
}

// Full diagram data structure
export interface DiagramData {
    id?: string
    session_id: string
    user_id: string | null
    title: string
    cards: DiagramCard[]
    tags: string[]
    description: string
    edit_users: string[]
    view_users: string[]
    is_public: boolean
    view_count: number
    like_count: number
    last_time_saved: number
    created_at?: string
    updated_at?: string
    // Default color for new labels (can be overridden per label)
    defaultLabelColor?: string
}

// Learn mode types
export type DiagramLearnMode = 'click-location' | 'type-label'
export type LabelDisplayMode = 'all-at-once' | 'one-by-one'

// Learn session state
export interface DiagramLearnState {
    mode: DiagramLearnMode
    labelDisplayMode: LabelDisplayMode
    currentCardIndex: number
    currentLabelIndex: number // For one-by-one mode
    correctCount: number
    incorrectCount: number
    answeredLabels: Set<string> // Label IDs that have been answered
    showAnswer: boolean // For flashcard-style reveal
}

// Editor tool types
export type EditorTool = 'select' | 'pan' | 'image' | 'arrow' | 'rectangle' | 'circle' | 'ellipse' | 'line' | 'polygon' | 'label'

// Editor state
export interface DiagramEditorState {
    selectedTool: EditorTool
    selectedElementId: string | null
    selectedElementType: 'image' | 'shape' | 'label' | null
    zoom: number
    panOffset: { x: number; y: number }
    isDrawing: boolean
    drawingPoints: number[]
}

// Helper function to create a new empty card
export function createEmptyCard(): DiagramCard {
    return {
        id: crypto.randomUUID(),
        images: [],
        shapes: [],
        labels: []
    }
}

// Helper function to create a new diagram
export function createEmptyDiagram(sessionId: string, userId: string | null): DiagramData {
    return {
        session_id: sessionId,
        user_id: userId,
        title: 'Untitled Diagram',
        cards: [createEmptyCard()],
        tags: [],
        description: '',
        edit_users: [],
        view_users: [],
        is_public: false,
        view_count: 0,
        like_count: 0,
        last_time_saved: Date.now()
    }
}

