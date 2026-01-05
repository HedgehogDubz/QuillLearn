# Notes Component Structure

## Component Hierarchy

```
<Notes>
  ├── <Header />
  └── <div className="notes_container">
      ├── <div className="notes_title_bar">
      │   ├── <input className="notes_title_input" />
      │   └── <span className="notes_save_indicator" />
      │
      ├── <div className="notes_toolbar_actions">
      │   ├── <button>✏️ Drawing</button>
      │   └── <button>📊 Table</button>
      │
      ├── {showDrawing && <div className="notes_drawing_modal">
      │   └── <div className="notes_drawing_container">
      │       ├── <div className="notes_drawing_header">
      │       ├── <canvas ref={canvasRef} />
      │       └── <div className="notes_drawing_controls">
      │           ├── <button>Clear</button>
      │           └── <button>Save Drawing</button>
      │
      ├── <div className="notes_editor_wrapper">
      │   └── <ReactQuill>
      │       ├── Toolbar (Quill built-in)
      │       └── Editor (Quill built-in)
      │
      └── <div className="notes_shortcuts_hint">
          └── <details>
              ├── <summary>⌨️ Keyboard Shortcuts</summary>
              └── <div className="notes_shortcuts_grid">
```

## State Management

### Component State
```typescript
const [title, setTitle] = useState('Untitled Document')
const [content, setContent] = useState('')
const [isSaved, setIsSaved] = useState(true)
const [showDrawing, setShowDrawing] = useState(false)
const [drawings, setDrawings] = useState<DrawingData[]>([])
```

### Refs
```typescript
const quillRef = useRef<ReactQuill>(null)           // Editor instance
const saveTimeoutRef = useRef<number | undefined>() // Debounce timer
const canvasRef = useRef<HTMLCanvasElement>(null)   // Drawing canvas
const isDrawingRef = useRef(false)                  // Drawing state
```

## Data Flow

### Loading Data
```
URL (/notes/:sessionId)
  ↓
useParams → sessionId
  ↓
useEffect → localStorage.getItem(`notes_session_${sessionId}`)
  ↓
JSON.parse → NoteData
  ↓
setState(title, content)
```

### Saving Data
```
User types in editor
  ↓
onChange → setContent
  ↓
useEffect (dependency: content)
  ↓
setIsSaved(false)
  ↓
setTimeout (1000ms debounce)
  ↓
saveNote()
  ↓
localStorage.setItem(`notes_session_${sessionId}`, JSON.stringify(noteData))
  ↓
setIsSaved(true)
```

## Quill Configuration

### Toolbar Modules
```javascript
[
  [{ 'header': [1, 2, 3, 4, 5, 6, false] }],  // H1-H6
  [{ 'font': [] }],                            // Font family
  [{ 'size': ['small', false, 'large', 'huge'] }], // Font size
  ['bold', 'italic', 'underline', 'strike'],   // Text formatting
  [{ 'color': [] }, { 'background': [] }],     // Colors
  [{ 'script': 'sub' }, { 'script': 'super' }], // Sub/superscript
  [{ 'list': 'ordered' }, { 'list': 'bullet' }], // Lists
  [{ 'indent': '-1' }, { 'indent': '+1' }],    // Indentation
  [{ 'align': [] }],                           // Alignment
  ['blockquote', 'code-block'],                // Special blocks
  ['link', 'image', 'video', 'formula'],       // Media
  ['clean']                                    // Clear formatting
]
```

### History Module
```javascript
history: {
  delay: 1000,      // Undo delay
  maxStack: 50,     // Max undo steps
  userOnly: true    // Only user actions
}
```

## Event Handlers

### Drawing Canvas
```typescript
startDrawing(e: MouseEvent)  // onMouseDown
  → isDrawingRef.current = true
  → ctx.beginPath()

draw(e: MouseEvent)          // onMouseMove
  → if (isDrawingRef.current)
  → ctx.lineTo() + ctx.stroke()

stopDrawing()                // onMouseUp, onMouseLeave
  → isDrawingRef.current = false

clearCanvas()                // Clear button
  → ctx.clearRect()

saveDrawing()                // Save button
  → canvas.toDataURL()
  → setDrawings([...drawings, newDrawing])
  → setShowDrawing(false)
```

### Table Insertion
```typescript
insertTable()
  → quill.getSelection()
  → quill.clipboard.dangerouslyPasteHTML(tableHTML)
```

## CSS Architecture

### Layout Structure
```
.notes_container (max-width: 900px, centered)
  ├── .notes_title_bar (white card, shadow)
  ├── .notes_toolbar_actions (button row)
  ├── .notes_drawing_modal (fixed overlay)
  ├── .notes_editor_wrapper (paper-like)
  │   ├── .ql-toolbar (sticky, gray background)
  │   └── .ql-editor (white, 80px margins)
  └── .notes_shortcuts_hint (collapsible)
```

### Responsive Breakpoints
```css
@media (max-width: 768px) {
  /* Mobile optimizations */
  - Reduced padding
  - Smaller fonts
  - Single column shortcuts
}
```

## Key Functions

### Auto-save
```typescript
saveNote() {
  const noteData: NoteData = { title, content, lastModified }
  localStorage.setItem(storageKey, JSON.stringify(noteData))
  setIsSaved(true)
}
```

### Session Management
```typescript
useEffect(() => {
  if (!sessionId) {
    const newSessionId = crypto.randomUUID()
    navigate(`/notes/${newSessionId}`, { replace: true })
  }
}, [sessionId, navigate])
```

## Performance Optimizations

1. **Debounced Auto-save**: 1-second delay prevents excessive localStorage writes
2. **useCallback**: Memoizes saveNote function
3. **Refs for Drawing**: Avoids re-renders during drawing
4. **Conditional Rendering**: Drawing modal only when needed
5. **Quill's Virtual DOM**: Efficient text editing

## Accessibility

- Semantic HTML structure
- Keyboard shortcuts
- Focus management
- ARIA labels (via Quill)
- Responsive design
- High contrast colors

## Browser Storage

### localStorage Schema
```json
{
  "notes_session_abc-123": {
    "title": "My Document",
    "content": "<p>Rich HTML content...</p>",
    "lastModified": 1704067200000
  }
}
```

### Storage Limits
- ~5-10MB per domain
- Synchronous API
- Persistent across sessions
- Per-origin isolation

