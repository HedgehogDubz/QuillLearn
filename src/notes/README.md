# Notes Component - Comprehensive Documentation

## Overview
A full-featured, Google Docs-style rich text note-taking application built with React, TypeScript, and Quill.js.

## Features

### 📝 Rich Text Editing
- **Text Formatting**: Bold, Italic, Underline, Strikethrough
- **Font Customization**: 
  - Font families (Serif, Sans-serif, Monospace)
  - Font sizes (Small, Normal, Large, Huge)
  - Text color and background/highlight color
- **Text Alignment**: Left, Center, Right, Justify
- **Lists**: Ordered (numbered) and Bulleted lists
- **Indentation**: Increase/decrease indent levels

### 📐 Document Structure
- **Headers**: H1 through H6 for hierarchical organization
- **Blockquotes**: For quotations and callouts
- **Code Blocks**: Syntax-highlighted code sections
- **Inline Code**: Monospace inline code snippets

### 🎨 Advanced Content
- **Links**: Insert and edit hyperlinks
- **Images**: Upload and embed images
- **Videos**: Embed video content
- **Tables**: Insert 3x3 tables (expandable)
- **Math Equations**: LaTeX support via KaTeX
  - Inline formulas
  - Block equations

### ✏️ Drawing Canvas
- Resizable drawing canvas (800x400px default)
- Freehand drawing with mouse
- Clear and save functionality
- Drawings stored as base64 images

### 💾 Data Persistence
- **Auto-save**: Automatic saving with 1-second debounce
- **localStorage**: Session-based storage using `notes_session_${sessionId}`
- **Session Management**: UUID-based session IDs in URL
- **Save Indicator**: Visual feedback (✓ Saved / Saving...)

### ⌨️ Keyboard Shortcuts
- `Ctrl/Cmd + B` - Bold
- `Ctrl/Cmd + I` - Italic
- `Ctrl/Cmd + U` - Underline
- `Ctrl/Cmd + Z` - Undo
- `Ctrl/Cmd + Y` - Redo
- `Ctrl/Cmd + K` - Insert Link

### 🎨 UI/UX Design
- **Paper-like Appearance**: White background with subtle shadows
- **Generous Margins**: 80px horizontal padding for readability
- **Sticky Toolbar**: Always accessible formatting options
- **Responsive Design**: Mobile and desktop optimized
- **Clean Interface**: Minimal, Google Docs-inspired design

## Technical Implementation

### Dependencies
```json
{
  "react-quill": "^2.0.0",
  "quill": "^2.0.3",
  "katex": "^0.16.11"
}
```

### File Structure
```
src/notes/
├── notes.tsx       # Main component (359 lines)
├── notes.css       # Styling (504 lines)
└── README.md       # This file
```

### Data Structure
```typescript
interface NoteData {
    title: string        // Document title
    content: string      // HTML content from Quill
    lastModified: number // Unix timestamp
}

interface DrawingData {
    dataURL: string      // Base64 image
    width: number        // Canvas width
    height: number       // Canvas height
}
```

### Storage Key Format
```
notes_session_${sessionId}
```

## Usage

### Accessing Notes
Navigate to `/notes` or `/notes/:sessionId`

### Creating a New Note
1. Visit `/notes` - a new session ID will be generated
2. Start typing in the editor
3. Changes auto-save every second

### Loading an Existing Note
1. Visit `/notes/:sessionId` with a valid session ID
2. Note data loads automatically from localStorage

### Inserting Tables
1. Click the "📊 Table" button in the toolbar
2. A 3x3 table is inserted at cursor position
3. Click cells to edit content

### Using the Drawing Canvas
1. Click "✏️ Drawing" button
2. Draw on the canvas with mouse
3. Click "Save Drawing" to insert into document
4. Click "Clear" to erase and start over

### Math Equations
1. Click the formula (ƒ) button in toolbar
2. Enter LaTeX syntax (e.g., `E = mc^2`)
3. Equation renders inline or as block

## Customization

### Changing Editor Padding
Edit `notes.css`:
```css
.notes_editor_wrapper .ql-editor {
  padding: 60px 80px; /* Adjust as needed */
}
```

### Modifying Auto-save Delay
Edit `notes.tsx`:
```typescript
saveTimeoutRef.current = setTimeout(() => {
    saveNote()
}, 1000) // Change delay in milliseconds
```

### Adding Custom Fonts
1. Add font to Quill toolbar config in `notes.tsx`
2. Add CSS rules in `notes.css`

## Browser Compatibility
- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Responsive design

## Known Limitations
- Tables are basic (no advanced formatting)
- Drawing canvas is modal-based (not inline)
- No collaborative editing
- No export to PDF/Word (browser print only)
- localStorage has ~5-10MB limit per domain

## Future Enhancements
- [ ] Export to PDF/Word
- [ ] Advanced table editing
- [ ] Inline drawing canvas
- [ ] Cloud sync
- [ ] Collaborative editing
- [ ] Version history
- [ ] Templates
- [ ] Dark mode

## Troubleshooting

### Styles not loading
Ensure Quill CSS is imported:
```typescript
import 'react-quill/dist/quill.snow.css'
import 'katex/dist/katex.min.css'
```

### Auto-save not working
Check browser console for localStorage errors. Some browsers block localStorage in private/incognito mode.

### Math formulas not rendering
Verify KaTeX is properly registered:
```typescript
import katex from 'katex'
window.katex = katex
```

