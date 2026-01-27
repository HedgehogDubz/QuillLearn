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
import { useAuth } from '../auth/AuthContext';
import DocumentHeader from '../components/DocumentHeader';
import { ConvertToSheetModal } from './ConvertToSheetModal';
import TagInput from '../components/TagInput';
import PublishModal from '../components/PublishModal';
import { MonacoCodeBlock, SUPPORTED_LANGUAGES } from '../components/MonacoCodeBlock';
import LoadingScreen from '../components/LoadingScreen';
import Editor, { loader } from '@monaco-editor/react';

// Configure Monaco to load workers from CDN for full IntelliSense support
loader.config({
    paths: {
        vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.55.0/min/vs'
    }
})
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

// ============ CUSTOM FORMULA BLOT (ATOMIC, NON-NAVIGABLE) ============

// @ts-ignore - Quill blot types are incomplete
const InlineEmbed = Quill.import('blots/embed')

// @ts-ignore - Extending Quill blot
class AtomicFormulaBlot extends InlineEmbed {
    static blotName = 'formula'
    static tagName = 'span'
    static className = 'ql-formula'

    // @ts-ignore
    static create(value: string) {
        // @ts-ignore
        const node = super.create() as HTMLElement

        // Make the formula non-editable and atomic
        node.setAttribute('contenteditable', 'false')
        node.setAttribute('data-value', value)

        // Render the formula using KaTeX
        if (typeof katex !== 'undefined') {
            try {
                katex.render(value, node, {
                    throwOnError: false,
                    displayMode: false
                })
            } catch (e) {
                node.textContent = value
            }
        } else {
            node.textContent = value
        }

        return node
    }

    // @ts-ignore
    static value(node: HTMLElement) {
        return node.getAttribute('data-value') || ''
    }

    // Override length to return 1 (atomic embed)
    length() {
        return 1
    }
}

// Register our custom formula blot (overwrites the default)
// @ts-ignore
Quill.register(AtomicFormulaBlot, true)

// ============ CUSTOM QUILL BLOT FOR MONACO CODE BLOCKS ============

// @ts-ignore - Quill blot types are incomplete
class MonacoCodeBlot extends BlockEmbed {
    static blotName = 'monacoCode'
    static tagName = 'div'
    static className = 'ql-monaco-code'

    // @ts-ignore
    static create(value: { code: string; language: string; id: string }) {
        // @ts-ignore
        const node = super.create() as HTMLElement
        node.setAttribute('contenteditable', 'false')
        node.setAttribute('data-code', encodeURIComponent(value.code || ''))
        node.setAttribute('data-language', value.language || 'javascript')
        node.setAttribute('data-id', value.id || `code-${Date.now()}`)

        // Add a placeholder that will be replaced by React
        node.innerHTML = `
            <div class="monaco-placeholder" data-id="${value.id}">
                <div class="monaco-placeholder-header">
                    <span class="monaco-placeholder-lang">${value.language || 'javascript'}</span>
                    <span class="monaco-placeholder-loading">Loading editor...</span>
                </div>
                <pre class="monaco-placeholder-code">${value.code?.substring(0, 200) || '// Code block'}${(value.code?.length || 0) > 200 ? '...' : ''}</pre>
            </div>
        `

        return node
    }

    // @ts-ignore
    static value(node: HTMLElement) {
        return {
            code: decodeURIComponent(node.getAttribute('data-code') || ''),
            language: node.getAttribute('data-language') || 'javascript',
            id: node.getAttribute('data-id') || ''
        }
    }

    // Override length to return 1 (atomic embed)
    length() {
        return 1
    }
}

// @ts-ignore
Quill.register(MonacoCodeBlot)

// ============ TYPE DEFINITIONS ============

type DrawingTool = 'brush' | 'line' | 'circle' | 'square' | 'bucket'

function Notes() {
    const { sessionId } = useParams<{ sessionId?: string }>()
    const navigate = useNavigate()
    const { user } = useAuth()

    // State
    const [title, setTitle] = useState('Untitled Document')
    const [content, setContent] = useState('')
    const [isSaved, setIsSaved] = useState(true)
    const [isLoading, setIsLoading] = useState(true)
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
    const [isReadOnly, setIsReadOnly] = useState(false)
    const [userPermission, setUserPermission] = useState<string | null>(null)
    const [showConvertModal, setShowConvertModal] = useState(false)
    const [showPublishModal, setShowPublishModal] = useState(false)
    const [tags, setTags] = useState<string[]>([])
    const [allUserTags, setAllUserTags] = useState<string[]>([])

    // LaTeX modal state
    const [showLatexModal, setShowLatexModal] = useState(false)
    const [latexInput, setLatexInput] = useState('')
    const [editingFormulaIndex, setEditingFormulaIndex] = useState<number | null>(null)
    const [isEditingExistingFormula, setIsEditingExistingFormula] = useState(false)
    const [latexMode, setLatexMode] = useState<'pure' | 'mixed'>('pure') // 'pure' = raw LaTeX, 'mixed' = text with $...$

    // Monaco code block state
    const [showCodeModal, setShowCodeModal] = useState(false)
    const [codeInput, setCodeInput] = useState('')
    const [codeLanguage, setCodeLanguage] = useState('javascript')
    const [editingCodeId, setEditingCodeId] = useState<string | null>(null)
    const [editingCodeIndex, setEditingCodeIndex] = useState<number | null>(null)
    const [codeBlocks, setCodeBlocks] = useState<Map<string, { code: string; language: string }>>(new Map())

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

    // Check user permission
    useEffect(() => {
        const checkPermission = async () => {
            if (!user?.id || !sessionId) {
                setIsReadOnly(false) // No user = new document, allow editing
                return
            }

            try {
                const response = await fetch(`/api/notes/${sessionId}/permission/${user.id}`)
                const result = await response.json()

                if (result.success) {
                    setUserPermission(result.permission)
                    // Set read-only if user only has view permission
                    const readOnly = result.permission === 'view'
                    setIsReadOnly(readOnly)

                    // Update Quill editor if it exists
                    if (quillRef.current) {
                        quillRef.current.enable(!readOnly)
                    }
                }
            } catch (error) {
                console.error('Error checking permission:', error)
                setIsReadOnly(false) // Default to editable on error
            }
        }

        checkPermission()
    }, [sessionId, user?.id])

    // Initialize Quill editor (only once)
    useEffect(() => {
        if (!editorRef.current || quillRef.current) return

        const quill = new Quill(editorRef.current, {
            theme: 'snow',
            modules: {
                // @ts-ignore - Quill keyboard bindings have dynamic 'this' context
                keyboard: {
                    bindings: {
                        // Custom keyboard shortcuts (this.quill is available at runtime)
                        strikethrough: {
                            key: 'D',
                            shortKey: true,
                            handler: function(range: any) {
                                // @ts-ignore
                                const format = this.quill.getFormat(range)
                                // @ts-ignore
                                this.quill.format('strike', !format.strike)
                            }
                        },
                        subscript: {
                            key: ',',
                            shortKey: true,
                            handler: function(range: any) {
                                // @ts-ignore
                                const format = this.quill.getFormat(range)
                                // @ts-ignore
                                this.quill.format('script', format.script === 'sub' ? false : 'sub')
                            }
                        },
                        superscript: {
                            key: '.',
                            shortKey: true,
                            handler: function(range: any) {
                                // @ts-ignore
                                const format = this.quill.getFormat(range)
                                // @ts-ignore
                                this.quill.format('script', format.script === 'super' ? false : 'super')
                            }
                        },
                        orderedList: {
                            key: '7',
                            shortKey: true,
                            shiftKey: true,
                            handler: function(range: any) {
                                // @ts-ignore
                                const format = this.quill.getFormat(range)
                                // @ts-ignore
                                this.quill.format('list', format.list === 'ordered' ? false : 'ordered')
                            }
                        },
                        bulletList: {
                            key: '8',
                            shortKey: true,
                            shiftKey: true,
                            handler: function(range: any) {
                                // @ts-ignore
                                const format = this.quill.getFormat(range)
                                // @ts-ignore
                                this.quill.format('list', format.list === 'bullet' ? false : 'bullet')
                            }
                        },
                        indent: {
                            key: ']',
                            shortKey: true,
                            handler: function() {
                                // @ts-ignore
                                this.quill.format('indent', '+1')
                            }
                        },
                        outdent: {
                            key: '[',
                            shortKey: true,
                            handler: function() {
                                // @ts-ignore
                                this.quill.format('indent', '-1')
                            }
                        },
                        // Tab key for list indentation
                        tab: {
                            key: 'Tab',
                            handler: function(range: any) {
                                // @ts-ignore
                                const format = this.quill.getFormat(range)
                                // Only indent if we're in a list
                                if (format.list) {
                                    // @ts-ignore
                                    this.quill.format('indent', '+1')
                                    return false // Prevent default tab behavior
                                }
                                return true // Allow default behavior (insert tab) when not in list
                            }
                        },
                        // Shift+Tab for list outdent
                        shiftTab: {
                            key: 'Tab',
                            shiftKey: true,
                            handler: function(range: any) {
                                // @ts-ignore
                                const format = this.quill.getFormat(range)
                                // Only outdent if we're in a list
                                if (format.list) {
                                    // @ts-ignore
                                    this.quill.format('indent', '-1')
                                    return false // Prevent default behavior
                                }
                                return true // Allow default behavior when not in list
                            }
                        },
                        blockquote: {
                            key: 'Q',
                            shortKey: true,
                            shiftKey: true,
                            handler: function(range: any) {
                                // @ts-ignore
                                const format = this.quill.getFormat(range)
                                // @ts-ignore
                                this.quill.format('blockquote', !format.blockquote)
                            }
                        },
                        codeBlock: {
                            key: 'E',
                            shortKey: true,
                            shiftKey: true,
                            handler: function() {
                                // Open Monaco code modal instead of inline code-block
                                setShowCodeModal(true)
                                setCodeInput('')
                                setCodeLanguage('javascript')
                                setEditingCodeId(null)
                                setEditingCodeIndex(null)
                                return false
                            }
                        },
                        alignLeft: {
                            key: 'L',
                            shortKey: true,
                            shiftKey: true,
                            handler: function() {
                                // @ts-ignore
                                this.quill.format('align', false)
                            }
                        },
                        alignCenter: {
                            key: 'C',
                            shortKey: true,
                            shiftKey: true,
                            handler: function() {
                                // @ts-ignore
                                this.quill.format('align', 'center')
                            }
                        },
                        alignRight: {
                            key: 'R',
                            shortKey: true,
                            shiftKey: true,
                            handler: function() {
                                // @ts-ignore
                                this.quill.format('align', 'right')
                            }
                        },
                        alignJustify: {
                            key: 'J',
                            shortKey: true,
                            shiftKey: true,
                            handler: function() {
                                // @ts-ignore
                                this.quill.format('align', 'justify')
                            }
                        },
                        clearFormat: {
                            key: '\\',
                            shortKey: true,
                            handler: function(range: any) {
                                if (range.length === 0) {
                                    // @ts-ignore
                                    const formats = this.quill.getFormat(range)
                                    for (const name in formats) {
                                        // @ts-ignore
                                        this.quill.format(name, false)
                                    }
                                } else {
                                    // @ts-ignore
                                    this.quill.removeFormat(range.index, range.length)
                                }
                            }
                        },
                        // Arrow key handling to skip over formulas (treat as atomic)
                        arrowRight: {
                            key: 'ArrowRight',
                            handler: function(range: any) {
                                if (range.length > 0) return true // Let default handle selections
                                // @ts-ignore
                                const [blot] = this.quill.getLeaf(range.index)
                                // @ts-ignore
                                if (blot && blot.statics && blot.statics.blotName === 'formula') {
                                    // Skip over the formula
                                    // @ts-ignore
                                    this.quill.setSelection(range.index + 1, 0, 'user')
                                    return false
                                }
                                // Check next character for formula
                                // @ts-ignore
                                const [nextBlot] = this.quill.getLeaf(range.index + 1)
                                // @ts-ignore
                                if (nextBlot && nextBlot.statics && nextBlot.statics.blotName === 'formula') {
                                    // @ts-ignore
                                    this.quill.setSelection(range.index + 2, 0, 'user')
                                    return false
                                }
                                return true // Default behavior
                            }
                        },
                        arrowLeft: {
                            key: 'ArrowLeft',
                            handler: function(range: any) {
                                if (range.length > 0) return true // Let default handle selections
                                if (range.index === 0) return true
                                // @ts-ignore
                                const [blot] = this.quill.getLeaf(range.index)
                                // @ts-ignore
                                if (blot && blot.statics && blot.statics.blotName === 'formula') {
                                    // Skip over the formula (move to before it)
                                    // @ts-ignore
                                    this.quill.setSelection(range.index - 1, 0, 'user')
                                    return false
                                }
                                // Check previous character for formula
                                // @ts-ignore
                                const [prevBlot] = this.quill.getLeaf(range.index - 1)
                                // @ts-ignore
                                if (prevBlot && prevBlot.statics && prevBlot.statics.blotName === 'formula') {
                                    // Skip over the formula
                                    // @ts-ignore
                                    this.quill.setSelection(range.index - 2, 0, 'user')
                                    return false
                                }
                                return true // Default behavior
                            }
                        }
                    }
                },
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
                        ['blockquote'],
                        ['link', 'image', 'video', 'formula'],
                        ['drawing', 'embedFile', 'monacoCode'], // Custom buttons - Monaco replaces code-block
                        ['clean'],
                        ['convertToSheet', 'publishToDiscover'] // AI conversion and publish buttons
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
                        },
                        convertToSheet: () => {
                            setShowConvertModal(true)
                        },
                        publishToDiscover: () => {
                            setShowPublishModal(true)
                        },
                        monacoCode: function(this: any) {
                            // Open code insert modal
                            const quill = this.quill
                            const range = quill.getSelection(true)

                            // Check if cursor is on an existing code block
                            if (range && range.length === 0) {
                                const [blot] = quill.getLeaf(range.index)
                                // @ts-ignore
                                if (blot && blot.statics && blot.statics.blotName === 'monacoCode') {
                                    // @ts-ignore
                                    const codeValue = decodeURIComponent(blot.domNode.getAttribute('data-code') || '')
                                    // @ts-ignore
                                    const langValue = blot.domNode.getAttribute('data-language') || 'javascript'
                                    // @ts-ignore
                                    const idValue = blot.domNode.getAttribute('data-id') || ''
                                    setCodeInput(codeValue)
                                    setCodeLanguage(langValue)
                                    setEditingCodeId(idValue)
                                    setEditingCodeIndex(range.index)
                                    setShowCodeModal(true)
                                    return
                                }
                            }

                            // New code block
                            setCodeInput('')
                            setCodeLanguage('javascript')
                            setEditingCodeId(null)
                            setEditingCodeIndex(range ? range.index : null)
                            setShowCodeModal(true)
                        },
                        formula: function(this: any) {
                            // Open custom LaTeX modal instead of default tooltip
                            const quill = this.quill
                            const range = quill.getSelection(true)

                            // Check if cursor is on an existing formula
                            if (range && range.length === 0) {
                                const [blot] = quill.getLeaf(range.index)
                                // @ts-ignore
                                if (blot && blot.statics && blot.statics.blotName === 'formula') {
                                    // @ts-ignore
                                    const formulaValue = blot.domNode.getAttribute('data-value')
                                    setLatexInput(formulaValue || '')
                                    setEditingFormulaIndex(range.index)
                                    setIsEditingExistingFormula(true)
                                    // When editing existing formulas, default to pure mode
                                    // (mixed mode formulas are stored as converted LaTeX)
                                    setLatexMode('pure')
                                    setShowLatexModal(true)
                                    return
                                }
                            }

                            // New formula
                            setLatexInput('')
                            setEditingFormulaIndex(range ? range.index : null)
                            setIsEditingExistingFormula(false)
                            setShowLatexModal(true)
                        },
                        image: async function(this: any) {
                            // Custom image handler - upload to Supabase Storage instead of base64
                            const input = document.createElement('input')
                            input.setAttribute('type', 'file')
                            input.setAttribute('accept', 'image/*')
                            input.click()

                            const quill = this.quill

                            input.onchange = async () => {
                                const file = input.files?.[0]
                                if (!file) return

                                try {
                                    console.log('🖼️ Uploading image from toolbar...')

                                    // Upload to Supabase Storage (images bucket)
                                    const formData = new FormData()
                                    formData.append('image', file)
                                    formData.append('userId', user?.id || 'anonymous')
                                    formData.append('sessionId', sessionId || '')

                                    const response = await fetch('/api/storage/upload-image', {
                                        method: 'POST',
                                        body: formData
                                    })

                                    const result = await response.json()

                                    if (!result.success) {
                                        console.error('Failed to upload image:', result.error)
                                        alert('Failed to upload image. Please try again.')
                                        return
                                    }

                                    // Insert image into editor
                                    const range = quill.getSelection(true)
                                    quill.insertEmbed(range.index, 'image', result.url)
                                    quill.setSelection(range.index + 1)



                                    console.log('✅ Image uploaded successfully')
                                } catch (error) {
                                    console.error('Error uploading image:', error)
                                    alert('Failed to upload image. Please try again.')
                                }
                            }
                        }
                    }
                },
                clipboard: {
                    matchVisual: false,
                    matchers: [
                        // Preserve KaTeX formula elements on paste
                        ['.ql-formula', function(_node: Element, delta: any) {
                            // The formula blot handles this via its value() method
                            return delta
                        }],
                        // Also match KaTeX rendered elements (for copy from other sources)
                        ['.katex', function(node: Element, _delta: any) {
                            // Try to extract the LaTeX from annotation or data attribute
                            const annotation = node.querySelector('annotation[encoding="application/x-tex"]')
                            if (annotation && annotation.textContent) {
                                // @ts-ignore - Delta constructor
                                const Delta = Quill.import('delta')
                                return new Delta().insert({ formula: annotation.textContent })
                            }
                            return _delta
                        }]
                    ]
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

        // Add clipboard matcher to preserve formulas on copy/paste
        // @ts-ignore - Quill clipboard module types are incomplete
        const clipboard = quill.getModule('clipboard') as any
        if (clipboard && clipboard.addMatcher) {
            // Match formula spans and preserve their LaTeX value
            clipboard.addMatcher('.ql-formula', (node: Element, delta: any) => {
                const latexValue = node.getAttribute('data-value')
                if (latexValue) {
                    // @ts-ignore - Delta constructor
                    const Delta = Quill.import('delta')
                    return new Delta().insert({ formula: latexValue })
                }
                return delta
            })

            // Match KaTeX rendered content (when pasting from external sources)
            clipboard.addMatcher('.katex', (node: Element, delta: any) => {
                // Try to find the LaTeX source in the annotation element
                const annotation = node.querySelector('annotation[encoding="application/x-tex"]')
                if (annotation && annotation.textContent) {
                    // @ts-ignore - Delta constructor
                    const Delta = Quill.import('delta')
                    return new Delta().insert({ formula: annotation.textContent })
                }
                return delta
            })

            // Also handle MathML-style annotations
            clipboard.addMatcher('annotation', (node: Element, delta: any) => {
                if (node.getAttribute('encoding') === 'application/x-tex' && node.textContent) {
                    // @ts-ignore - Delta constructor
                    const Delta = Quill.import('delta')
                    return new Delta().insert({ formula: node.textContent })
                }
                return delta
            })
        }

        // Add custom icons and tooltips to toolbar buttons
        setTimeout(() => {
            const toolbar = document.querySelector('.notes_editor_wrapper .ql-toolbar') as HTMLElement
            if (!toolbar) return

            // Move toolbar into sticky header container
            const toolbarContainer = document.getElementById('notes-toolbar-container')
            if (toolbarContainer && toolbar) {
                toolbarContainer.appendChild(toolbar)
                toolbar.style.display = 'flex'
            }

            // Detect if Mac for proper modifier key display
            const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
            const cmdKey = isMac ? '⌘' : 'Ctrl+'

            // Define tooltips with keyboard shortcuts
            const tooltips: Record<string, string> = {
                // Formatting
                '.ql-bold': `Bold (${cmdKey}B)`,
                '.ql-italic': `Italic (${cmdKey}I)`,
                '.ql-underline': `Underline (${cmdKey}U)`,
                '.ql-strike': `Strikethrough (${cmdKey}D)`,

                // Scripts
                '.ql-script[value="sub"]': `Subscript (${cmdKey},)`,
                '.ql-script[value="super"]': `Superscript (${cmdKey}.)`,

                // Lists
                '.ql-list[value="ordered"]': `Numbered List (${cmdKey}Shift+7)`,
                '.ql-list[value="bullet"]': `Bullet List (${cmdKey}Shift+8)`,

                // Indent
                '.ql-indent[value="-1"]': `Decrease Indent (${cmdKey}[)`,
                '.ql-indent[value="+1"]': `Increase Indent (${cmdKey}])`,

                // Blocks
                '.ql-blockquote': `Block Quote (${cmdKey}Shift+Q)`,

                // Media
                '.ql-link': `Insert Link (${cmdKey}K)`,
                '.ql-image': `Insert Image (${cmdKey}Shift+I)`,
                '.ql-video': `Insert Video (${cmdKey}Shift+V)`,
                '.ql-formula': `Insert Formula (${cmdKey}Shift+F)`,

                // Custom buttons
                '.ql-drawing': `Insert Drawing (${cmdKey}Shift+D)`,
                '.ql-monacoCode': `Code Block (${cmdKey}Shift+E)`,
                '.ql-embedFile': `Attach File (${cmdKey}Shift+A)`,
                '.ql-convertToSheet': `Convert to Sheet (${cmdKey}Shift+S)`,
                '.ql-publishToDiscover': 'Publish to Discover',

                // Clean
                '.ql-clean': `Clear Formatting (${cmdKey}\\)`,

                // Pickers (no shortcuts but still useful tooltips)
                '.ql-header .ql-picker-label': 'Heading Style',
                '.ql-font .ql-picker-label': 'Font Family',
                '.ql-size .ql-picker-label': 'Font Size',
                '.ql-color .ql-picker-label': 'Text Color',
                '.ql-background .ql-picker-label': 'Background Color',
                '.ql-align .ql-picker-label': `Text Alignment (${cmdKey}Shift+L/C/R/J)`,
            }

            // Create custom tooltip element
            let tooltipEl = document.getElementById('toolbar-tooltip')
            if (!tooltipEl) {
                tooltipEl = document.createElement('div')
                tooltipEl.id = 'toolbar-tooltip'
                tooltipEl.className = 'toolbar_tooltip'
                document.body.appendChild(tooltipEl)
            }

            let tooltipTimeout: ReturnType<typeof setTimeout> | null = null

            // Apply tooltips using data attribute
            for (const [selector, tooltip] of Object.entries(tooltips)) {
                const element = toolbar.querySelector(selector) as HTMLElement
                if (element) {
                    element.setAttribute('data-tooltip', tooltip)

                    // Show tooltip on mouseenter with delay
                    element.addEventListener('mouseenter', () => {
                        tooltipTimeout = setTimeout(() => {
                            const rect = element.getBoundingClientRect()
                            if (tooltipEl) {
                                tooltipEl.textContent = tooltip
                                tooltipEl.style.opacity = '1'
                                tooltipEl.style.visibility = 'visible'

                                // Position below the element
                                const tooltipRect = tooltipEl.getBoundingClientRect()
                                let left = rect.left + rect.width / 2 - tooltipRect.width / 2

                                // Keep within viewport
                                if (left < 8) left = 8
                                if (left + tooltipRect.width > window.innerWidth - 8) {
                                    left = window.innerWidth - tooltipRect.width - 8
                                }

                                tooltipEl.style.left = `${left}px`
                                tooltipEl.style.top = `${rect.bottom + 8}px`
                            }
                        }, 500) // 500ms delay before showing
                    })

                    // Hide tooltip on mouseleave
                    element.addEventListener('mouseleave', () => {
                        if (tooltipTimeout) {
                            clearTimeout(tooltipTimeout)
                            tooltipTimeout = null
                        }
                        if (tooltipEl) {
                            tooltipEl.style.opacity = '0'
                            tooltipEl.style.visibility = 'hidden'
                        }
                    })
                }
            }

            // Set custom button content with SVG icons (matching Quill's native style)
            const drawingButton = toolbar.querySelector('.ql-drawing')
            if (drawingButton) {
                // Pencil/drawing icon
                drawingButton.innerHTML = `<svg viewBox="0 0 18 18" width="18" height="18">
                    <path class="ql-stroke" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.5 2.5l5 5-9 9H2.5v-4l9-9z"/>
                    <path class="ql-stroke" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8.5 4.5l5 5"/>
                </svg>`
                drawingButton.setAttribute('title', 'Insert Drawing (Ctrl+Shift+D)')
            }

            const embedFileButton = toolbar.querySelector('.ql-embedFile')
            if (embedFileButton) {
                // Paperclip/attachment icon
                embedFileButton.innerHTML = `<svg viewBox="0 0 18 18" width="18" height="18">
                    <path class="ql-stroke" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.5 7.5l-6 6c-1.4 1.4-3.6 1.4-5 0s-1.4-3.6 0-5l6-6c.9-.9 2.4-.9 3.3 0s.9 2.4 0 3.3l-6 6c-.5.5-1.2.5-1.7 0s-.5-1.2 0-1.7l5-5"/>
                </svg>`
                embedFileButton.setAttribute('title', 'Attach File')
            }

            // Style the code-block button to match
            const codeBlockButton = toolbar.querySelector('.ql-code-block')
            if (codeBlockButton) {
                codeBlockButton.setAttribute('title', 'Code Block (Ctrl+Shift+E)')
            }

            const convertButton = toolbar.querySelector('.ql-convertToSheet')
            if (convertButton) {
                convertButton.innerHTML = '📊 Convert'
            }

            const publishButton = toolbar.querySelector('.ql-publishToDiscover')
            if (publishButton) {
                publishButton.innerHTML = '📢 Publish'
            }
        }, 50)

        // Add keyboard shortcuts for custom toolbar functions
        const handleKeyboardShortcuts = (e: KeyboardEvent) => {
            const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
            const cmdPressed = isMac ? e.metaKey : e.ctrlKey

            if (!cmdPressed || !e.shiftKey) return
            if (!quillRef.current) return

            const quill = quillRef.current

            switch (e.key.toUpperCase()) {
                case 'F': // Formula
                    e.preventDefault()
                    const range = quill.getSelection(true)
                    setLatexInput('')
                    setEditingFormulaIndex(range ? range.index : null)
                    setIsEditingExistingFormula(false)
                    setShowLatexModal(true)
                    break
                case 'D': // Drawing
                    e.preventDefault()
                    setShowDrawing(true)
                    break
                case 'A': // Attach file
                    e.preventDefault()
                    if (fileInputRef.current) {
                        fileInputRef.current.click()
                    }
                    break
                case 'I': // Image
                    e.preventDefault()
                    const imageBtn = document.querySelector('.ql-image') as HTMLButtonElement
                    if (imageBtn) imageBtn.click()
                    break
                case 'V': // Video
                    e.preventDefault()
                    const videoBtn = document.querySelector('.ql-video') as HTMLButtonElement
                    if (videoBtn) videoBtn.click()
                    break
                case 'S': // Convert to Sheet
                    e.preventDefault()
                    setShowConvertModal(true)
                    break
            }
        }

        // Add Ctrl+K for link (without shift)
        const handleLinkShortcut = (e: KeyboardEvent) => {
            const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)
            const cmdPressed = isMac ? e.metaKey : e.ctrlKey

            if (cmdPressed && e.key.toUpperCase() === 'K' && !e.shiftKey) {
                e.preventDefault()
                const linkBtn = document.querySelector('.ql-link') as HTMLButtonElement
                if (linkBtn) linkBtn.click()
            }
        }

        document.addEventListener('keydown', handleKeyboardShortcuts)
        document.addEventListener('keydown', handleLinkShortcut)

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

        // Intercept drag-and-drop images and upload to Supabase Storage
        quill.root.addEventListener('drop', async (e: DragEvent) => {
            const dataTransfer = e.dataTransfer
            if (!dataTransfer) return

            const files = Array.from(dataTransfer.files)
            const imageFile = files.find(file => file.type.startsWith('image/'))

            if (imageFile) {
                e.preventDefault() // Prevent default drop behavior

                try {
                    console.log('📥 Dropped image detected, uploading to Supabase Storage...')

                    // Upload to Supabase Storage
                    const formData = new FormData()
                    formData.append('image', imageFile)
                    formData.append('userId', user?.id || 'anonymous')
                    formData.append('sessionId', sessionId || '')

                    const response = await fetch('/api/storage/upload-image', {
                        method: 'POST',
                        body: formData
                    })

                    const result = await response.json()

                    if (result.success) {
                        // Insert the uploaded image URL at drop position
                        const range = quill.getSelection(true)
                        quill.insertEmbed(range.index, 'image', result.url)
                        quill.setSelection(range.index + 1)



                        console.log('✅ Dropped image uploaded successfully')
                    } else {
                        console.error('Failed to upload dropped image:', result.error)
                        alert('Failed to upload image. Please try again.')
                    }
                } catch (error) {
                    console.error('Error uploading dropped image:', error)
                    alert('Failed to upload image. Please try again.')
                }
            }
        })

        // Intercept pasted images and upload to Supabase Storage
        quill.root.addEventListener('paste', async (e: ClipboardEvent) => {
            const clipboardData = e.clipboardData
            if (!clipboardData) return

            const items = Array.from(clipboardData.items)
            const imageItem = items.find(item => item.type.startsWith('image/'))

            if (imageItem) {
                e.preventDefault() // Prevent default paste behavior

                const file = imageItem.getAsFile()
                if (!file) return

                try {
                    console.log('📋 Pasted image detected, uploading to Supabase Storage...')

                    // Upload to Supabase Storage
                    const formData = new FormData()
                    formData.append('image', file)
                    formData.append('userId', user?.id || 'anonymous')
                    formData.append('sessionId', sessionId || '')

                    const response = await fetch('/api/storage/upload-image', {
                        method: 'POST',
                        body: formData
                    })

                    const result = await response.json()

                    if (result.success) {
                        // Insert the uploaded image URL
                        const range = quill.getSelection(true)
                        quill.insertEmbed(range.index, 'image', result.url)
                        quill.setSelection(range.index + 1)



                        console.log('✅ Image uploaded successfully:', result.url)
                    } else {
                        console.error('Failed to upload pasted image:', result.error)
                        alert('Failed to upload image. Please try again.')
                    }
                } catch (error) {
                    console.error('Error uploading pasted image:', error)
                    alert('Failed to upload image. Please try again.')
                }
            }
        })

        // Handle content changes
        quill.on('text-change', async () => {
            const html = quill.root.innerHTML
            setContent(html)
            setIsSaved(false)

            // Auto-convert base64 images to Supabase Storage URLs
            const delta = quill.getContents()
            if (delta && delta.ops) {
                let hasChanges = false

                for (let i = 0; i < delta.ops.length; i++) {
                    const op = delta.ops[i]

                    // Check if this operation contains a base64 image
                    // @ts-ignore - Delta ops types are incomplete
                    if (op.insert?.image && typeof op.insert.image === 'string' && op.insert.image.startsWith('data:')) {
                        console.log('🔄 Found base64 image, converting to Supabase Storage...')

                        try {
                            // Convert base64 to blob
                            // @ts-ignore
                            const base64Data = op.insert.image
                            const response = await fetch(base64Data)
                            const blob = await response.blob()

                            // Upload to Supabase Storage
                            const formData = new FormData()
                            formData.append('image', blob, 'pasted-image.png')
                            formData.append('userId', user?.id || 'anonymous')
                            formData.append('sessionId', sessionId || '')

                            const uploadResponse = await fetch('/api/storage/upload-image', {
                                method: 'POST',
                                body: formData
                            })

                            const result = await uploadResponse.json()

                            if (result.success) {
                                // Find the position of this image in the editor
                                let position = 0
                                for (let j = 0; j < i; j++) {
                                    // @ts-ignore
                                    if (typeof delta.ops[j].insert === 'string') {
                                        // @ts-ignore
                                        position += delta.ops[j].insert.length
                                    } else {
                                        position += 1
                                    }
                                }

                                // Replace base64 image with URL
                                quill.deleteText(position, 1, 'silent')
                                quill.insertEmbed(position, 'image', result.url, 'silent')



                                hasChanges = true
                                console.log('✅ Base64 image converted to Supabase URL')
                            }
                        } catch (error) {
                            console.error('Error converting base64 image:', error)
                        }
                    }
                }

                if (hasChanges) {
                    console.log('✨ All base64 images have been converted to Supabase Storage!')
                }
            }
        })

        // Formula navigation is now atomic - cursor skips over formulas
        // Formulas can only be edited by clicking on them (handled by handleFormulaClick below)

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

                if (formulaValue && blot) {
                    // Get the index of this blot
                    // @ts-ignore - Quill internals
                    const formulaIndex = quill.getIndex(blot)

                    // Open our custom LaTeX modal instead of the default tooltip
                    setLatexInput(formulaValue)
                    setEditingFormulaIndex(formulaIndex)
                    setIsEditingExistingFormula(true)
                    // When editing existing formulas, default to pure mode
                    setLatexMode('pure')
                    setShowLatexModal(true)
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

        // Cleanup function
        return () => {
            document.removeEventListener('keydown', handleKeyboardShortcuts)
            document.removeEventListener('keydown', handleLinkShortcut)
            if (editorRef.current) {
                editorRef.current.removeEventListener('click', handleFormulaClick)
                editorRef.current.removeEventListener('click', handleDrawingClick)
            }
        }
    })

    // Load note data from API/Supabase (only once per session)
    useEffect(() => {
        if (!quillRef.current || isDataLoaded) return
        if (!sessionId) return

        const loadData = async () => {
            setIsLoading(true)
            const noteData = await loadNoteData(sessionId)

            if (noteData) {
                setTitle(noteData.title)
                setContent(noteData.content)

                // Restore drawings if they exist
                if (noteData.drawings) {
                    console.log('Loading drawings:', noteData.drawings)

                    // Convert old Supabase URLs to proxied URLs
                    const convertedDrawings = noteData.drawings.map((drawing: any) => {
                        if (drawing.url && drawing.url.includes('supabase.co/storage')) {
                            // Extract bucket and path from Supabase URL
                            // Example: https://xxx.supabase.co/storage/v1/object/public/images/userId/sessionId/file.png
                            // Convert to: /api/storage/image/images/userId/sessionId/file.png
                            const match = drawing.url.match(/\/storage\/v1\/object\/public\/(.+)/)
                            if (match) {
                                const fullPath = match[1] // e.g., "images/userId/sessionId/file.png"
                                drawing.url = `/api/storage/image/${fullPath}`
                                console.log('🔄 Converted Supabase URL to proxied URL:', drawing.url)
                            }
                        }
                        return drawing
                    })

                    setDrawings(convertedDrawings)
                }

                // Restore attachments if they exist
                if (noteData.attachments) {
                    setAttachments(noteData.attachments)
                }

                // Restore tags if they exist
                if (noteData.tags) {
                    setTags(noteData.tags)
                }

                // Prefer Delta format for loading (preserves all formatting)
                // Fall back to HTML if Delta is not available
                if (quillRef.current) {
                    if (noteData.delta) {
                        quillRef.current.setContents(noteData.delta)
                    } else if (noteData.content) {
                        quillRef.current.root.innerHTML = noteData.content
                    }

                    // Convert any Supabase image URLs in the content to proxied URLs
                    setTimeout(() => {
                        const images = quillRef.current?.root.querySelectorAll('img')
                        images?.forEach((img: HTMLImageElement) => {
                            if (img.src.includes('supabase.co/storage')) {
                                const match = img.src.match(/\/storage\/v1\/object\/public\/(.+)/)
                                if (match) {
                                    const fullPath = match[1]
                                    const newUrl = `/api/storage/image/${fullPath}`
                                    img.src = newUrl
                                    console.log('🔄 Converted image URL to proxied URL:', newUrl)
                                }
                            }
                        })
                    }, 100)
                }
            }

            setIsDataLoaded(true)
            setIsLoading(false)
        }

        loadData()
    }, [sessionId, isDataLoaded])

    // Fetch all user tags for suggestions
    useEffect(() => {
        const fetchUserTags = async () => {
            if (!user?.id) return
            try {
                const response = await fetch(`/api/notes/tags/all/${user.id}`)
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

    // Handle tag changes
    const handleTagsChange = async (newTags: string[]) => {
        setTags(newTags)
        if (!sessionId) return

        try {
            await fetch(`/api/notes/${sessionId}/tags`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tags: newTags, userId: user?.id })
            })
        } catch (error) {
            console.error('Error saving tags:', error)
        }
    }

    // Helper function to convert mixed mode input to a single LaTeX string
    // Text outside $...$ becomes \text{...}, text inside stays as LaTeX
    const convertToSingleLatex = (input: string): string => {
        // Split by $...$ patterns, keeping the delimiters for processing
        const parts = input.split(/(\$[^$]+\$)/g)

        return parts.map(part => {
            if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
                // This is LaTeX - extract content between $ signs (keep as-is)
                return part.slice(1, -1)
            } else if (part.trim()) {
                // This is regular text - wrap in \text{} for LaTeX
                // For special characters, we use Unicode equivalents or escape sequences
                // that work reliably in KaTeX's \text{} mode
                const escaped = part
                    .replace(/\\/g, '\u29F5')      // Use Unicode reverse solidus operator for backslash
                    .replace(/\^/g, '\u02C6')      // Use Unicode modifier letter circumflex
                    .replace(/~/g, '\u02DC')       // Use Unicode small tilde
                    .replace(/[&%$#_{}]/g, '\\$&') // Escape remaining special chars
                return `\\text{${escaped}}`
            } else {
                return ''
            }
        }).filter(Boolean).join('')
    }

    // Helper function to render mixed mode LaTeX for preview
    const renderMixedLatex = (input: string): string => {
        // Convert to single LaTeX and render
        const singleLatex = convertToSingleLatex(input)
        try {
            return katex.renderToString(singleLatex, {
                throwOnError: false,
                displayMode: false
            })
        } catch {
            // Fallback: try rendering each part separately
            const parts = input.split(/(\$[^$]+\$)/g)
            return parts.map(part => {
                if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
                    const latex = part.slice(1, -1)
                    try {
                        return katex.renderToString(latex, {
                            throwOnError: false,
                            displayMode: false
                        })
                    } catch {
                        return `<span style="color: red;">${part}</span>`
                    }
                } else {
                    return part
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/\n/g, '<br/>')
                }
            }).join('')
        }
    }

    // Handle LaTeX formula insertion
    const handleLatexInsert = () => {
        if (!quillRef.current || !latexInput.trim()) return

        const quill = quillRef.current
        let insertIndex = editingFormulaIndex ?? (quill.getLength() - 1)

        // If editing existing formula, delete it first (for both modes)
        if (editingFormulaIndex !== null && isEditingExistingFormula) {
            const [blot] = quill.getLeaf(editingFormulaIndex)
            // @ts-ignore
            if (blot && blot.statics && blot.statics.blotName === 'formula') {
                quill.deleteText(editingFormulaIndex, 1, 'silent')
            }
        }

        if (latexMode === 'mixed') {
            // Mixed mode: convert to single LaTeX formula with \text{} for non-math parts
            const singleLatex = convertToSingleLatex(latexInput)
            quill.insertEmbed(insertIndex, 'formula', singleLatex, 'user')
            quill.setSelection(insertIndex + 1, 0, 'silent')
        } else {
            // Pure mode: insert as single formula
            quill.insertEmbed(insertIndex, 'formula', latexInput.trim(), 'user')
            quill.setSelection(insertIndex + 1, 0, 'silent')
        }

        // Close modal and reset
        setShowLatexModal(false)
        setLatexInput('')
        setEditingFormulaIndex(null)
        setIsEditingExistingFormula(false)
    }

    // Handle LaTeX formula deletion
    const handleLatexDelete = () => {
        if (!quillRef.current || editingFormulaIndex === null) return

        const quill = quillRef.current

        // Since isEditingExistingFormula is true, we know there's a formula at this index
        // Delete the formula (formulas are 1 character length embeds)
        quill.deleteText(editingFormulaIndex, 1, 'user')

        // Close modal and reset
        setShowLatexModal(false)
        setLatexInput('')
        setEditingFormulaIndex(null)
        setIsEditingExistingFormula(false)
    }

    const handleLatexCancel = () => {
        setShowLatexModal(false)
        setLatexInput('')
        setEditingFormulaIndex(null)
        setIsEditingExistingFormula(false)
    }

    // Handle Monaco code block insertion
    const handleCodeInsert = () => {
        if (!quillRef.current) return

        const quill = quillRef.current
        const codeId = editingCodeId || `code-${Date.now()}`

        if (editingCodeIndex !== null && editingCodeId) {
            // Update existing code block
            quill.deleteText(editingCodeIndex, 1, 'user')
            quill.insertEmbed(editingCodeIndex, 'monacoCode', {
                code: codeInput,
                language: codeLanguage,
                id: codeId
            }, 'user')
        } else {
            // Insert new code block
            const range = quill.getSelection(true)
            const index = range ? range.index : quill.getLength()
            quill.insertEmbed(index, 'monacoCode', {
                code: codeInput,
                language: codeLanguage,
                id: codeId
            }, 'user')
            quill.setSelection(index + 1, 0, 'user')
        }

        // Update codeBlocks state for React rendering
        setCodeBlocks(prev => {
            const newMap = new Map(prev)
            newMap.set(codeId, { code: codeInput, language: codeLanguage })
            return newMap
        })

        // Trigger re-render of Monaco editors
        setTimeout(() => renderMonacoEditors(), 100)

        setShowCodeModal(false)
        setCodeInput('')
        setCodeLanguage('javascript')
        setEditingCodeId(null)
        setEditingCodeIndex(null)
        setIsSaved(false)
    }

    const handleCodeCancel = () => {
        setShowCodeModal(false)
        setCodeInput('')
        setCodeLanguage('javascript')
        setEditingCodeId(null)
        setEditingCodeIndex(null)
    }

    const handleCodeDelete = () => {
        if (!quillRef.current || editingCodeIndex === null) return

        const quill = quillRef.current
        quill.deleteText(editingCodeIndex, 1, 'user')

        // Remove from codeBlocks state
        if (editingCodeId) {
            setCodeBlocks(prev => {
                const newMap = new Map(prev)
                newMap.delete(editingCodeId)
                return newMap
            })
        }

        setShowCodeModal(false)
        setCodeInput('')
        setCodeLanguage('javascript')
        setEditingCodeId(null)
        setEditingCodeIndex(null)
        setIsSaved(false)
    }

    // Render Monaco editors in placeholders
    const renderMonacoEditors = useCallback(() => {
        if (!editorRef.current) return

        const placeholders = editorRef.current.querySelectorAll('.monaco-placeholder')
        placeholders.forEach(placeholder => {
            const id = placeholder.getAttribute('data-id')
            if (!id) return

            // Check if already rendered
            if (placeholder.querySelector('.monaco-code-block')) return

            const parentBlot = placeholder.closest('.ql-monaco-code')
            if (!parentBlot) return

            const code = decodeURIComponent(parentBlot.getAttribute('data-code') || '')
            const language = parentBlot.getAttribute('data-language') || 'javascript'

            // Clear placeholder and mount React component
            placeholder.innerHTML = ''

            // Create a container for the Monaco editor
            const container = document.createElement('div')
            container.className = 'monaco-react-container'
            placeholder.appendChild(container)

            // Use createRoot for React 18+
            import('react-dom/client').then(({ createRoot }) => {
                const root = createRoot(container)
                root.render(
                    <MonacoCodeBlock
                        code={code}
                        language={language}
                        onChange={(newCode) => {
                            // Update the blot's data attribute
                            parentBlot.setAttribute('data-code', encodeURIComponent(newCode))
                            setIsSaved(false)
                        }}
                        onLanguageChange={(newLang) => {
                            parentBlot.setAttribute('data-language', newLang)
                            // Update the language display
                            const langSpan = placeholder.querySelector('.monaco-placeholder-lang')
                            if (langSpan) langSpan.textContent = newLang
                            setIsSaved(false)
                        }}
                        onDelete={() => {
                            // Find the blot index and delete it
                            if (quillRef.current) {
                                const blots = editorRef.current?.querySelectorAll('.ql-monaco-code')
                                blots?.forEach((blot) => {
                                    if (blot === parentBlot) {
                                        // Find actual index in Quill
                                        const contents = quillRef.current!.getContents()
                                        let currentIndex = 0
                                        for (const op of contents.ops || []) {
                                            if (op.insert && typeof op.insert === 'object' && 'monacoCode' in op.insert) {
                                                if ((op.insert as any).monacoCode.id === id) {
                                                    quillRef.current!.deleteText(currentIndex, 1, 'user')
                                                    setIsSaved(false)
                                                    break
                                                }
                                            }
                                            currentIndex += typeof op.insert === 'string' ? op.insert.length : 1
                                        }
                                    }
                                })
                            }
                        }}
                        onEdit={() => {
                            // Find the index of this code block and open modal
                            if (quillRef.current) {
                                const contents = quillRef.current.getContents()
                                let currentIndex = 0
                                for (const op of contents.ops || []) {
                                    if (op.insert && typeof op.insert === 'object' && 'monacoCode' in op.insert) {
                                        if ((op.insert as any).monacoCode.id === id) {
                                            setCodeInput(code)
                                            setCodeLanguage(language)
                                            setEditingCodeId(id)
                                            setEditingCodeIndex(currentIndex)
                                            setShowCodeModal(true)
                                            break
                                        }
                                    }
                                    currentIndex += typeof op.insert === 'string' ? op.insert.length : 1
                                }
                            }
                        }}
                        readOnly={isReadOnly}
                    />
                )
            })
        })
    }, [isReadOnly])

    // Re-render Monaco editors when content changes
    useEffect(() => {
        const timeout = setTimeout(renderMonacoEditors, 200)
        return () => clearTimeout(timeout)
    }, [content, renderMonacoEditors])

    // Auto-save with debouncing
    const saveNote = useCallback(async () => {
        if (!sessionId || !quillRef.current) return

        // Get both HTML and Delta format for maximum compatibility
        const html = quillRef.current.root.innerHTML
        const delta = quillRef.current.getContents()

        const result = await saveNoteData(sessionId, user?.id || null, title, html, delta, drawings, attachments)

        if (result.success) {
            setIsSaved(true)
        } else {
            console.error('Failed to save note')
        }
    }, [sessionId, title, drawings, attachments, user?.id])

    // Auto-save effect
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
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const quill = quillRef.current
        if (!quill || !e.target.files || e.target.files.length === 0) return

        const file = e.target.files[0]

        // Check file size (limit to 10MB)
        const maxSize = 10 * 1024 * 1024 // 10MB
        if (file.size > maxSize) {
            alert('File size must be less than 10MB')
            return
        }

        try {
            // Upload to Supabase Storage
            const formData = new FormData()
            formData.append('file', file)
            formData.append('userId', user?.id || 'anonymous')
            formData.append('sessionId', sessionId || '')

            const response = await fetch('/api/storage/upload-attachment', {
                method: 'POST',
                body: formData
            })

            const result = await response.json()

            if (!result.success) {
                console.error('Failed to upload file:', result.error)
                alert('Failed to upload file. Please try again.')
                return
            }

            const fileId = crypto.randomUUID()
            const fileUrl = result.url

            // Create file attachment object
            const attachment: FileAttachment = {
                id: fileId,
                name: result.metadata.name,
                type: result.metadata.type,
                size: result.metadata.size,
                url: fileUrl,
                uploadedAt: Date.now()
            }

            // Add to attachments array
            setAttachments(prev => [...prev, attachment])

            // Insert file attachment into editor
            const range = quill.getSelection() || { index: quill.getLength() }
            quill.insertEmbed(range.index, 'fileAttachment', {
                id: fileId,
                name: attachment.name,
                dataURL: fileUrl, // Use URL instead of base64
                size: attachment.size
            })
            quill.insertText(range.index + 1, '\n')
            quill.setSelection(range.index + 2)

            // Trigger content update
            const html = quill.root.innerHTML
            setContent(html)
            setIsSaved(false)
        } catch (error) {
            console.error('Error uploading file:', error)
            alert('Failed to upload file. Please try again.')
        }

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
                    const drawing = drawings[editingDrawingIndex]
                    console.log('Loading drawing for edit:', drawing)
                    const img = new Image()



                    img.onload = () => {
                        console.log('Drawing loaded successfully')
                        ctx.drawImage(img, 0, 0)
                    }

                    img.onerror = (e) => {
                        console.error('Failed to load drawing:', e)
                        console.error('Drawing URL:', drawing.url || drawing.dataURL)
                    }

                    // Support both new URL format and legacy dataURL format
                    const imgSrc = drawing.url || drawing.dataURL || ''
                    console.log('Setting image src to:', imgSrc)
                    img.src = imgSrc
                    setHasBorder(drawing.hasBorder ?? true)
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

    const saveDrawing = async () => {
        const canvas = canvasRef.current
        const quill = quillRef.current
        if (!canvas || !quill) return

        // Convert canvas to blob for upload
        canvas.toBlob(async (blob) => {
            if (!blob) {
                console.error('Failed to convert canvas to blob')
                return
            }

            try {
                // Upload to Supabase Storage
                const formData = new FormData()
                formData.append('drawing', blob, 'drawing.png')
                formData.append('userId', user?.id || 'anonymous')
                formData.append('sessionId', sessionId || '')

                const response = await fetch('/api/storage/upload-drawing', {
                    method: 'POST',
                    body: formData
                })

                const result = await response.json()

                if (!result.success) {
                    console.error('Failed to upload drawing:', result.error)
                    alert('Failed to save drawing. Please try again.')
                    return
                }

                const imageUrl = result.url
                const newDrawing: DrawingData = {
                    url: imageUrl,
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
                        const imgSrc = img.src
                        if (imgSrc.startsWith('data:image/png') || imgSrc.includes('supabase')) {
                            if (drawingImageIndex === editingDrawingIndex) {
                                img.src = imageUrl
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
                    quill.insertEmbed(range.index, 'image', imageUrl)

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
            } catch (error) {
                console.error('Error uploading drawing:', error)
                alert('Failed to save drawing. Please try again.')
            }
        }, 'image/png')
    }

    // Show loading state while redirecting to new session
    if (!sessionId) {
        return <LoadingScreen type="note" message="Creating new note..." />
    }

    return (
        <>
            <Header />
            {/* Show loading overlay while data is loading - editor must still render for Quill to initialize */}
            {isLoading && <LoadingScreen type="note" message="Loading note..." />}
            <div className="notes_container">
                {/* Sticky Header - Title Bar + Toolbar together */}
                <div className="notes_sticky_header">
                    <div className="notes_title_bar">
                        <DocumentHeader
                            title={title}
                            onTitleChange={setTitle}
                            isSaved={isSaved}
                            placeholder="Untitled Document"
                            savedText="✓ Saved"
                            unsavedText="Saving..."
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
                    {/* Toolbar will be moved here by JS */}
                    <div id="notes-toolbar-container"></div>
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

                {/* Convert to Sheet Modal */}
                {showConvertModal && (
                    <ConvertToSheetModal
                        isOpen={showConvertModal}
                        onClose={() => setShowConvertModal(false)}
                        noteContent={content}
                        noteTitle={title}
                    />
                )}

                {/* Publish Modal */}
                {showPublishModal && user && sessionId && (
                    <PublishModal
                        isOpen={showPublishModal}
                        onClose={() => setShowPublishModal(false)}
                        sessionId={sessionId}
                        contentType="note"
                        currentUserId={user.id}
                        currentTitle={title}
                        currentTags={tags}
                    />
                )}

                {/* LaTeX Formula Modal */}
                {showLatexModal && (
                    <div className="latex_modal_overlay" onClick={handleLatexCancel}>
                        <div className="latex_modal" onClick={e => e.stopPropagation()}>
                            <div className="latex_modal_header">
                                <h3>📐 {editingFormulaIndex !== null ? 'Edit' : 'Insert'} LaTeX</h3>
                                <button className="latex_modal_close" onClick={handleLatexCancel}>×</button>
                            </div>
                            <div className="latex_modal_body">
                                {/* Mode Toggle */}
                                <div className="latex_mode_toggle">
                                    <button
                                        className={`latex_mode_btn ${latexMode === 'pure' ? 'active' : ''}`}
                                        onClick={() => setLatexMode('pure')}
                                    >
                                        Pure LaTeX
                                    </button>
                                    <button
                                        className={`latex_mode_btn ${latexMode === 'mixed' ? 'active' : ''}`}
                                        onClick={() => setLatexMode('mixed')}
                                    >
                                        Mixed (Text + $...$)
                                    </button>
                                </div>

                                <textarea
                                    className="latex_input"
                                    value={latexInput}
                                    onChange={e => setLatexInput(e.target.value)}
                                    placeholder={latexMode === 'pure'
                                        ? "Enter LaTeX formula...\n\nExamples:\nSingle line: x^2 + y^2 = z^2\n\nMulti-line with align:\n\\begin{aligned}\n  f(x) &= x^2 + 2x + 1 \\\\\n  &= (x + 1)^2\n\\end{aligned}\n\nFractions: \\frac{a}{b}\nSquare root: \\sqrt{x}"
                                        : "Mix text with LaTeX using $...$ delimiters\n\nExample:\nThe quadratic formula is $x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$ where $a$, $b$, and $c$ are coefficients.\n\nAnother example:\nFor $n \\geq 1$, we have $\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$"
                                    }
                                    rows={10}
                                    autoFocus
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && e.ctrlKey) {
                                            if (!latexInput.trim() && isEditingExistingFormula) {
                                                handleLatexDelete()
                                            } else {
                                                handleLatexInsert()
                                            }
                                        } else if (e.key === 'Escape') {
                                            handleLatexCancel()
                                        }
                                    }}
                                />
                                <div className="latex_preview">
                                    <span className="latex_preview_label">Preview:</span>
                                    <div className="latex_preview_content">
                                        {latexInput.trim() ? (
                                            <span
                                                dangerouslySetInnerHTML={{
                                                    __html: (() => {
                                                        try {
                                                            if (latexMode === 'mixed') {
                                                                return renderMixedLatex(latexInput)
                                                            } else {
                                                                return katex.renderToString(latexInput.trim(), {
                                                                    throwOnError: false,
                                                                    displayMode: true
                                                                })
                                                            }
                                                        } catch {
                                                            return '<span style="color: red;">Invalid LaTeX</span>'
                                                        }
                                                    })()
                                                }}
                                            />
                                        ) : (
                                            <span className="latex_preview_placeholder">
                                                {latexMode === 'pure'
                                                    ? 'Formula preview will appear here'
                                                    : 'Text and formula preview will appear here'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="latex_help">
                                    <details>
                                        <summary>LaTeX Help</summary>
                                        <div className="latex_help_content">
                                            {latexMode === 'mixed' ? (
                                                <>
                                                    <p><strong>Mixed mode:</strong> Wrap formulas in <code>$...$</code>, text stays as regular text.</p>
                                                    <p>Everything becomes a single clickable formula block.</p>
                                                    <p><strong>Example:</strong></p>
                                                    <code>The area is $A = \pi r^2$ for a circle</code>
                                                    <p><strong>Multiple formulas:</strong></p>
                                                    <code>If $x = 2$ and $y = 3$, then $x + y = 5$</code>
                                                </>
                                            ) : (
                                                <>
                                                    <p><strong>Multi-line equations:</strong></p>
                                                    <code>{`\\begin{aligned}\n  a &= b + c \\\\\n  d &= e + f\n\\end{aligned}`}</code>
                                                    <p><strong>Cases:</strong></p>
                                                    <code>{`f(x) = \\begin{cases}\n  x^2 & x \\geq 0 \\\\\n  -x^2 & x < 0\n\\end{cases}`}</code>
                                                </>
                                            )}
                                            <p><strong>Common symbols:</strong> \alpha, \beta, \sum, \int, \frac{`{a}{b}`}, \sqrt{`{x}`}</p>
                                        </div>
                                    </details>
                                </div>
                            </div>
                            <div className="latex_modal_footer">
                                <button className="latex_btn_cancel" onClick={handleLatexCancel}>Cancel</button>
                                {!latexInput.trim() && isEditingExistingFormula ? (
                                    <button
                                        className="latex_btn_delete"
                                        onClick={handleLatexDelete}
                                    >
                                        🗑️ Delete Formula
                                    </button>
                                ) : (
                                    <button
                                        className="latex_btn_insert"
                                        onClick={handleLatexInsert}
                                        disabled={!latexInput.trim()}
                                    >
                                        {editingFormulaIndex !== null ? 'Update' : 'Insert'}
                                    </button>
                                )}
                                <span className="latex_shortcut_hint">
                                    {!latexInput.trim() && isEditingExistingFormula
                                        ? 'Ctrl+Enter to delete'
                                        : 'Ctrl+Enter to insert'}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Monaco Code Block Modal */}
                {showCodeModal && (
                    <div className="code-insert-modal-overlay" onClick={handleCodeCancel}>
                        <div className="code-insert-modal" onClick={e => e.stopPropagation()}>
                            <div className="code-insert-modal-header">
                                <h3>💻 {editingCodeId ? 'Edit' : 'Insert'} Code Block</h3>
                                <button className="code-insert-modal-close" onClick={handleCodeCancel}>×</button>
                            </div>
                            <div className="code-insert-modal-body">
                                <div className="code-insert-language-row">
                                    <label>Language:</label>
                                    <select
                                        className="code-insert-language-select"
                                        value={codeLanguage}
                                        onChange={e => setCodeLanguage(e.target.value)}
                                    >
                                        {SUPPORTED_LANGUAGES.map(lang => (
                                            <option key={lang.id} value={lang.id}>{lang.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="code-insert-editor-wrapper">
                                    <Editor
                                        language={codeLanguage}
                                        value={codeInput}
                                        onChange={(value) => setCodeInput(value || '')}
                                        options={{
                                            minimap: { enabled: false },
                                            scrollBeyondLastLine: false,
                                            fontSize: 14,
                                            lineNumbers: 'on',
                                            automaticLayout: true,
                                            tabSize: 2,
                                            wordWrap: 'on',
                                            suggestOnTriggerCharacters: true,
                                            quickSuggestions: true,
                                            parameterHints: { enabled: true }
                                        }}
                                        theme="vs-dark"
                                    />
                                </div>
                            </div>
                            <div className="code-insert-modal-footer">
                                <button className="code-insert-btn code-insert-btn-cancel" onClick={handleCodeCancel}>
                                    Cancel
                                </button>
                                {editingCodeId && (
                                    <button className="code-insert-btn code-insert-btn-delete" onClick={handleCodeDelete}>
                                        🗑️ Delete
                                    </button>
                                )}
                                <button
                                    className="code-insert-btn code-insert-btn-insert"
                                    onClick={handleCodeInsert}
                                >
                                    {editingCodeId ? 'Update' : 'Insert'} Code
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}

export default Notes
