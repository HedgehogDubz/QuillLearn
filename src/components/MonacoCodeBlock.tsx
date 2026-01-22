import React, { useRef, useEffect, useState } from 'react'
import Editor, { loader } from '@monaco-editor/react'
import type { OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import './MonacoCodeBlock.css'

// Configure Monaco to load workers from CDN for full IntelliSense support
loader.config({
    paths: {
        vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.55.0/min/vs'
    }
})

// Supported languages with display names
export const SUPPORTED_LANGUAGES = [
    { id: 'javascript', name: 'JavaScript' },
    { id: 'typescript', name: 'TypeScript' },
    { id: 'python', name: 'Python' },
    { id: 'java', name: 'Java' },
    { id: 'cpp', name: 'C++' },
    { id: 'c', name: 'C' },
    { id: 'csharp', name: 'C#' },
    { id: 'go', name: 'Go' },
    { id: 'rust', name: 'Rust' },
    { id: 'ruby', name: 'Ruby' },
    { id: 'php', name: 'PHP' },
    { id: 'swift', name: 'Swift' },
    { id: 'kotlin', name: 'Kotlin' },
    { id: 'ocaml', name: 'OCaml' },
    { id: 'html', name: 'HTML' },
    { id: 'css', name: 'CSS' },
    { id: 'scss', name: 'SCSS' },
    { id: 'json', name: 'JSON' },
    { id: 'xml', name: 'XML' },
    { id: 'yaml', name: 'YAML' },
    { id: 'markdown', name: 'Markdown' },
    { id: 'sql', name: 'SQL' },
    { id: 'shell', name: 'Shell/Bash' },
    { id: 'powershell', name: 'PowerShell' },
    { id: 'plaintext', name: 'Plain Text' }
]

interface MonacoCodeBlockProps {
    code: string
    language: string
    onChange?: (code: string) => void
    onLanguageChange?: (language: string) => void
    readOnly?: boolean
    height?: number
    onDelete?: () => void
    onEdit?: () => void
}

export function MonacoCodeBlock({
    code,
    language,
    onChange,
    onLanguageChange,
    readOnly = false,
    height = 200,
    onDelete,
    onEdit
}: MonacoCodeBlockProps) {
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
    const [isHovered, setIsHovered] = useState(false)
    const [currentHeight, setCurrentHeight] = useState(height)
    const [currentLanguage, setCurrentLanguage] = useState(language)

    // Sync language prop with local state
    useEffect(() => {
        setCurrentLanguage(language)
    }, [language])

    const handleEditorMount: OnMount = (editor, monaco) => {
        editorRef.current = editor

        // Auto-resize based on content
        const updateHeight = () => {
            const contentHeight = Math.min(500, Math.max(100, editor.getContentHeight()))
            setCurrentHeight(contentHeight)
            editor.layout()
        }

        editor.onDidContentSizeChange(updateHeight)
        updateHeight()

        // Prevent Enter key from bubbling to Quill
        editor.onKeyDown((e) => {
            // Stop propagation for Enter and other important keys
            if (e.keyCode === monaco.KeyCode.Enter ||
                e.keyCode === monaco.KeyCode.Backspace ||
                e.keyCode === monaco.KeyCode.Delete ||
                e.keyCode === monaco.KeyCode.Tab) {
                e.stopPropagation()
            }
        })
    }

    const handleChange = (value: string | undefined) => {
        if (onChange && value !== undefined) {
            onChange(value)
        }
    }

    // Update editor layout when height changes
    useEffect(() => {
        if (editorRef.current) {
            editorRef.current.layout()
        }
    }, [currentHeight])

    const handleLanguageChange = (newLang: string) => {
        setCurrentLanguage(newLang)
        onLanguageChange?.(newLang)
    }

    // Stop keyboard events from bubbling to Quill
    const handleKeyDown = (e: React.KeyboardEvent) => {
        e.stopPropagation()
    }

    return (
        <div
            className="monaco-code-block"
            contentEditable={false}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onKeyDown={handleKeyDown}
            onKeyUp={(e) => e.stopPropagation()}
            onKeyPress={(e) => e.stopPropagation()}
        >
            <div className="monaco-code-header">
                <select
                    className="monaco-language-select"
                    value={currentLanguage}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    disabled={readOnly}
                >
                    {SUPPORTED_LANGUAGES.map(lang => (
                        <option key={lang.id} value={lang.id}>{lang.name}</option>
                    ))}
                </select>
                <div className="monaco-header-buttons">
                    {!readOnly && isHovered && onEdit && (
                        <button
                            className="monaco-edit-btn"
                            onClick={onEdit}
                            title="Edit in modal"
                        >
                            ✎
                        </button>
                    )}
                    {!readOnly && isHovered && (
                        <button
                            className="monaco-delete-btn"
                            onClick={onDelete}
                            title="Delete code block"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>
            <div className="monaco-editor-container" style={{ height: currentHeight, position: 'relative' }}>
                <Editor
                    height="100%"
                    width="100%"
                    language={currentLanguage}
                    value={code}
                    onChange={handleChange}
                    onMount={handleEditorMount}
                    options={{
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        fontSize: 13,
                        lineNumbers: 'on',
                        lineNumbersMinChars: 3,
                        readOnly,
                        automaticLayout: true,
                        tabSize: 2,
                        wordWrap: 'on',
                        folding: true,
                        suggestOnTriggerCharacters: true,
                        quickSuggestions: true,
                        parameterHints: { enabled: true },
                        formatOnPaste: true,
                        formatOnType: true,
                        padding: { top: 8, bottom: 8 },
                        scrollbar: {
                            vertical: 'auto',
                            horizontal: 'auto',
                            verticalScrollbarSize: 8,
                            horizontalScrollbarSize: 8
                        }
                    }}
                    theme="vs-dark"
                />
            </div>
        </div>
    )
}

