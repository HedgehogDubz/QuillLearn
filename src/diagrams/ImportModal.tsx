/**
 * ImportModal Component
 * Modal for importing images/PDFs with optional OCR text detection
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { createWorker, Worker } from 'tesseract.js'
import type { DiagramImage, DiagramLabel, DiagramShape } from './types'
import './ImportModal.css'

// Set up PDF.js worker - use unpkg CDN which has the latest versions
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

interface ImportModalProps {
    isOpen: boolean
    onClose: () => void
    onImport: (image: DiagramImage, labels?: DiagramLabel[], shapes?: DiagramShape[]) => void
    defaultLabelColor: string
    currentImageCount: number
}

type ImportMode = 'normal' | 'ocr'

interface OCRWord {
    text: string
    bbox: {
        x0: number
        y0: number
        x1: number
        y1: number
    }
}

export default function ImportModal({
    isOpen,
    onClose,
    onImport,
    defaultLabelColor,
    currentImageCount
}: ImportModalProps) {
    const [mode, setMode] = useState<ImportMode>('normal')
    const [isProcessing, setIsProcessing] = useState(false)
    const [progress, setProgress] = useState(0)
    const [progressText, setProgressText] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Handle paste from clipboard
    const handlePaste = useCallback(async (e: ClipboardEvent) => {
        if (!isOpen || isProcessing) return

        const items = e.clipboardData?.items
        if (!items) return

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault()
                const file = item.getAsFile()
                if (file) {
                    if (mode === 'normal') {
                        handleNormalImport(file)
                    } else {
                        handleOCRImport(file)
                    }
                }
                return
            }
        }
    }, [isOpen, isProcessing, mode])

    // Add paste event listener when modal is open
    useEffect(() => {
        if (isOpen) {
            document.addEventListener('paste', handlePaste)
            return () => document.removeEventListener('paste', handlePaste)
        }
    }, [isOpen, handlePaste])

    if (!isOpen) return null

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (mode === 'normal') {
            handleNormalImport(file)
        } else {
            handleOCRImport(file)
        }

        e.target.value = ''
    }

    const handleNormalImport = (file: File) => {
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
                    zIndex: currentImageCount,
                    opacity: 1
                }
                onImport(newImage)
                onClose()
            }
            img.src = src
        }
        reader.readAsDataURL(file)
    }

    const handleOCRImport = async (file: File) => {
        setIsProcessing(true)
        setProgress(0)
        setProgressText('Loading file...')

        try {
            let imageDataUrl: string
            let imgWidth: number
            let imgHeight: number

            // Handle PDF or image
            if (file.type === 'application/pdf') {
                setProgressText('Converting PDF to image...')
                const result = await convertPDFToImage(file)
                imageDataUrl = result.dataUrl
                imgWidth = result.width
                imgHeight = result.height
            } else {
                const result = await loadImage(file)
                imageDataUrl = result.dataUrl
                imgWidth = result.width
                imgHeight = result.height
            }

            setProgress(20)
            setProgressText('Running OCR text detection...')

            // Run OCR
            const words = await runOCR(imageDataUrl, (p) => {
                setProgress(20 + p * 0.6)
            })

            setProgress(80)

            if (words.length === 0) {
                setProgressText('No text detected. Importing image without labels...')
            } else {
                setProgressText(`Creating ${words.length} labels and masks...`)
            }

            // Create the image with white rectangles over text
            const { maskedImageUrl, labels, shapes } = await createMaskedImageAndLabels(
                imageDataUrl,
                imgWidth,
                imgHeight,
                words,
                defaultLabelColor,
                currentImageCount
            )

            setProgress(100)
            setProgressText('Done!')

            console.log(`OCR Import complete: ${labels.length} labels created`)

            const newImage: DiagramImage = {
                id: crypto.randomUUID(),
                src: maskedImageUrl,
                x: 50,
                y: 50,
                width: Math.min(imgWidth, 700),
                height: Math.min(imgWidth, 700) * (imgHeight / imgWidth),
                zIndex: currentImageCount,
                opacity: 1
            }

            onImport(newImage, labels, shapes)
            onClose()
        } catch (error) {
            console.error('OCR Import error:', error)
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            alert(`Failed to process file: ${errorMessage}`)
        } finally {
            setIsProcessing(false)
            setProgress(0)
            setProgressText('')
        }
    }

    const convertPDFToImage = async (file: File): Promise<{ dataUrl: string; width: number; height: number }> => {
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        const page = await pdf.getPage(1)

        const scale = 2 // Higher quality
        const viewport = page.getViewport({ scale })

        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height

        const ctx = canvas.getContext('2d')!
        await page.render({ canvasContext: ctx, viewport }).promise

        return {
            dataUrl: canvas.toDataURL('image/png'),
            width: viewport.width,
            height: viewport.height
        }
    }

    const loadImage = (file: File): Promise<{ dataUrl: string; width: number; height: number }> => {
        return new Promise((resolve) => {
            const reader = new FileReader()
            reader.onload = (event) => {
                const dataUrl = event.target?.result as string
                const img = new Image()
                img.onload = () => {
                    resolve({ dataUrl, width: img.width, height: img.height })
                }
                img.src = dataUrl
            }
            reader.readAsDataURL(file)
        })
    }

    // Check if text contains only valid characters (letters, numbers, common punctuation)
    const isValidText = (text: string): boolean => {
        // Must have at least 2 characters and contain mostly letters/numbers
        if (text.length < 2) return false
        // Allow letters, numbers, spaces, hyphens, apostrophes
        const validPattern = /^[a-zA-Z0-9\s\-']+$/
        if (!validPattern.test(text)) return false
        // Must contain at least one letter
        if (!/[a-zA-Z]/.test(text)) return false
        return true
    }

    // Advanced image preprocessing for better OCR based on developer best practices
    const preprocessImage = (imageUrl: string): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image()
            img.onload = () => {
                // Scale up 3x for better OCR (higher DPI helps significantly)
                const scale = 3
                const border = 20

                const canvas = document.createElement('canvas')
                canvas.width = img.width * scale + border * 2
                canvas.height = img.height * scale + border * 2
                const ctx = canvas.getContext('2d')!

                // Fill with white (border)
                ctx.fillStyle = '#ffffff'
                ctx.fillRect(0, 0, canvas.width, canvas.height)

                // Draw scaled image with border offset - keep original colors
                // Tesseract's internal preprocessing often works better than manual
                ctx.drawImage(img, border, border, img.width * scale, img.height * scale)

                console.log('Preprocessed image size:', canvas.width, 'x', canvas.height)
                resolve(canvas.toDataURL('image/png'))
            }
            img.src = imageUrl
        })
    }

    // Merge words that are horizontally adjacent (on the same line)
    // Does NOT merge vertically stacked words
    const mergeHorizontallyCloseWords = (words: OCRWord[]): OCRWord[] => {
        if (words.length === 0) return words

        const merged: OCRWord[] = []
        const used = new Set<number>()

        // Sort by X position (left to right)
        const sorted = [...words].sort((a, b) => a.bbox.x0 - b.bbox.x0)

        for (let i = 0; i < sorted.length; i++) {
            if (used.has(i)) continue

            const group: OCRWord[] = [sorted[i]]
            used.add(i)

            // Find all words on the same horizontal line
            let changed = true
            while (changed) {
                changed = false
                for (let j = 0; j < sorted.length; j++) {
                    if (used.has(j)) continue

                    const candidate = sorted[j]

                    // Check if candidate is on the same line as any word in the group
                    for (const groupWord of group) {
                        const groupHeight = groupWord.bbox.y1 - groupWord.bbox.y0
                        const candidateHeight = candidate.bbox.y1 - candidate.bbox.y0
                        const avgHeight = (groupHeight + candidateHeight) / 2

                        // Check vertical alignment - must be on the same line
                        // Words are on the same line if their vertical centers are close
                        const groupCenterY = (groupWord.bbox.y0 + groupWord.bbox.y1) / 2
                        const candidateCenterY = (candidate.bbox.y0 + candidate.bbox.y1) / 2
                        const verticalDiff = Math.abs(groupCenterY - candidateCenterY)

                        // Must be within 50% of average height to be considered same line
                        const isOnSameLine = verticalDiff < avgHeight * 0.5

                        if (!isOnSameLine) continue

                        // Check horizontal proximity
                        const groupWidth = groupWord.bbox.x1 - groupWord.bbox.x0
                        const candidateWidth = candidate.bbox.x1 - candidate.bbox.x0
                        const avgWidth = (groupWidth + candidateWidth) / 2

                        // Calculate horizontal gap
                        const horizontalGap = Math.max(
                            candidate.bbox.x0 - groupWord.bbox.x1,
                            groupWord.bbox.x0 - candidate.bbox.x1
                        )

                        // Allow merge if horizontal gap is reasonable (less than 1x average width)
                        const isHorizontallyClose = horizontalGap < avgWidth * 1.0

                        if (isOnSameLine && isHorizontallyClose) {
                            group.push(candidate)
                            used.add(j)
                            changed = true
                            break
                        }
                    }
                }
            }

            // Merge the group into a single word
            if (group.length > 0) {
                // Sort group by X position (left to right)
                group.sort((a, b) => a.bbox.x0 - b.bbox.x0)

                const mergedWord: OCRWord = {
                    text: group.map(w => w.text).join(' '),
                    bbox: {
                        x0: Math.min(...group.map(w => w.bbox.x0)),
                        y0: Math.min(...group.map(w => w.bbox.y0)),
                        x1: Math.max(...group.map(w => w.bbox.x1)),
                        y1: Math.max(...group.map(w => w.bbox.y1))
                    }
                }
                merged.push(mergedWord)
            }
        }

        return merged
    }

    const runOCR = async (imageUrl: string, onProgress: (p: number) => void): Promise<OCRWord[]> => {
        console.log('Starting OCR...')

        // Preprocess image (scale up for better detection)
        console.log('Preprocessing image...')
        const processedImage = await preprocessImage(imageUrl)

        // Create worker with logger for progress tracking
        const worker: Worker = await createWorker('eng', 1, {
            logger: (m) => {
                if (m.status === 'recognizing text' && typeof m.progress === 'number') {
                    onProgress(m.progress)
                }
            }
        })

        try {
            // PSM 11 = Sparse text - Find as much text as possible in no particular order
            // This is ideal for diagrams with scattered labels
            // PSM 12 = Sparse text with OSD
            await worker.setParameters({
                tessedit_pageseg_mode: '11',
            })

            console.log('Running OCR with PSM 11 (sparse text)...')
            let result = await worker.recognize(processedImage, {}, { tsv: true })
            let { data } = result

            console.log('OCR raw text detected:', data.text)

            // If sparse text mode didn't find much, try PSM 3 (automatic)
            if (!data.text || data.text.trim().length < 10) {
                console.log('Sparse text found little, trying PSM 3 (automatic)...')
                await worker.setParameters({
                    tessedit_pageseg_mode: '3',
                })
                result = await worker.recognize(processedImage, {}, { tsv: true })
                data = result.data
                console.log('OCR raw text detected (PSM 3):', data.text)
            }

            let words: OCRWord[] = []

            // Parse TSV output to get word positions
            // Note: Coordinates are from preprocessed image (3x scale + 20px border)
            // We need to map them back to original image coordinates
            const preprocessScale = 3
            const preprocessBorder = 20

            if (data.tsv) {
                const lines = data.tsv.split('\n')
                console.log('TSV lines:', lines.length)

                for (let i = 1; i < lines.length; i++) { // Skip header row
                    const parts = lines[i].split('\t')
                    if (parts.length >= 12) {
                        const level = parseInt(parts[0])
                        const left = parseInt(parts[6])
                        const top = parseInt(parts[7])
                        const width = parseInt(parts[8])
                        const height = parseInt(parts[9])
                        const conf = parseInt(parts[10])
                        const text = parts[11]?.trim()

                        // Level 5 = word level
                        if (level === 5 && text) {
                            console.log(`Word: "${text}" conf=${conf} valid=${isValidText(text)}`)
                        }

                        // Filter criteria:
                        // - Must be valid text (letters, numbers, etc.)
                        // - Short words (2-3 chars) need high confidence (80+) to avoid garbage
                        // - Longer words can have lower confidence (50+)
                        const minConfidence = text && text.length <= 3 ? 80 : 50

                        if (level === 5 && text && conf >= minConfidence && isValidText(text)) {
                            // Map coordinates back to original image space
                            // Subtract border, then divide by scale
                            const origX0 = (left - preprocessBorder) / preprocessScale
                            const origY0 = (top - preprocessBorder) / preprocessScale
                            const origX1 = (left + width - preprocessBorder) / preprocessScale
                            const origY1 = (top + height - preprocessBorder) / preprocessScale

                            words.push({
                                text: text,
                                bbox: {
                                    x0: Math.max(0, origX0),
                                    y0: Math.max(0, origY0),
                                    x1: origX1,
                                    y1: origY1
                                }
                            })
                        }
                    }
                }
            }

            console.log(`OCR detected ${words.length} valid words before merging`)
            console.log('Words:', words.map(w => `${w.text} conf (${w.bbox.x0.toFixed(0)},${w.bbox.y0.toFixed(0)})`))

            // Merge horizontally adjacent words (same line only, no vertical merging)
            words = mergeHorizontallyCloseWords(words)

            console.log(`After horizontal merging: ${words.length} labels`)
            if (words.length > 0) {
                console.log('Labels:', words.map(w => w.text))
            }
            return words
        } finally {
            await worker.terminate()
        }
    }

    const createMaskedImageAndLabels = async (
        imageUrl: string,
        imgWidth: number,
        _imgHeight: number, // Not used - original image is preserved, shapes cover text instead
        words: OCRWord[],
        labelColor: string,
        zIndexStart: number
    ): Promise<{ maskedImageUrl: string; labels: DiagramLabel[]; shapes: DiagramShape[] }> => {
        // No longer modify the image - just return it as-is
        // Instead, we create filled shapes to cover the text
        const maskedImageUrl = imageUrl
        const maxWidth = 700
        const scale = Math.min(maxWidth / imgWidth, 1)
        const padding = 4

        // Create filled white rectangles to cover the detected text areas
        const shapes: DiagramShape[] = words.map((word, index) => {
            // Use same coordinate calculation as labels, with padding to fully cover text
            const x = 50 + word.bbox.x0 * scale
            const y = 50 + word.bbox.y0 * scale
            const wordWidth = (word.bbox.x1 - word.bbox.x0) * scale
            const wordHeight = (word.bbox.y1 - word.bbox.y0) * scale

            return {
                id: crypto.randomUUID(),
                type: 'rectangle' as const,
                points: [x - padding, y - padding, x + wordWidth + padding, y + wordHeight + padding],
                color: '#cccccc',
                fillColor: '#ffffff',
                strokeWidth: 1,
                zIndex: zIndexStart + index
            }
        })

        const labels: DiagramLabel[] = words.map((word) => {
            const wordWidth = (word.bbox.x1 - word.bbox.x0) * scale
            const wordHeight = (word.bbox.y1 - word.bbox.y0) * scale
            const x = 50 + word.bbox.x0 * scale
            const y = 50 + word.bbox.y0 * scale

            // For multi-line text, calculate appropriate font size
            const lineCount = word.text.split('\n').length
            const singleLineHeight = wordHeight / lineCount
            const fontSize = Math.max(10, Math.min(14, singleLineHeight * 0.7))

            return {
                id: crypto.randomUUID(),
                shapeType: 'rectangle' as const,
                // Match the shape position (which uses x - padding, y - padding)
                x: x - padding,
                y: y - padding,
                width: wordWidth + padding * 2,
                height: wordHeight + padding * 2,
                text: word.text.replace(/\n/g, ' '), // Join multi-line into single line for label
                fontSize,
                color: labelColor,
                textOffsetX: 0,
                textOffsetY: 0
            }
        })

        return { maskedImageUrl, labels, shapes }
    }



    return (
        <div className="import_modal_overlay" onClick={onClose}>
            <div className="import_modal" onClick={(e) => e.stopPropagation()}>
                <div className="import_modal_header">
                    <h2>Import Image</h2>
                    <button className="import_modal_close" onClick={onClose}>×</button>
                </div>

                <div className="import_modal_content">
                    <div className="import_mode_selector">
                        <button
                            className={`import_mode_btn ${mode === 'normal' ? 'active' : ''}`}
                            onClick={() => setMode('normal')}
                            disabled={isProcessing}
                        >
                            <span className="import_mode_icon">🖼️</span>
                            <span className="import_mode_label">Normal Import</span>
                            <span className="import_mode_desc">Import image as-is</span>
                        </button>
                        <button
                            className={`import_mode_btn ${mode === 'ocr' ? 'active' : ''}`}
                            onClick={() => setMode('ocr')}
                            disabled={isProcessing}
                        >
                            <span className="import_mode_icon">🔍</span>
                            <span className="import_mode_label">Smart Import (OCR)</span>
                            <span className="import_mode_desc">Auto-detect text & create labels</span>
                        </button>
                    </div>

                    {isProcessing ? (
                        <div className="import_progress">
                            <div className="import_progress_bar">
                                <div
                                    className="import_progress_fill"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <p className="import_progress_text">{progressText}</p>
                        </div>
                    ) : (
                        <div className="import_dropzone" onClick={() => fileInputRef.current?.click()}>
                            <span className="import_dropzone_icon">📁</span>
                            <p>Click to select a file</p>
                            <p className="import_dropzone_paste">or paste an image (Ctrl/Cmd+V)</p>
                            <p className="import_dropzone_hint">
                                {mode === 'normal'
                                    ? 'Supports: PNG, JPG, GIF, WebP'
                                    : 'Supports: PNG, JPG, PDF (first page)'}
                            </p>
                        </div>
                    )}
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept={mode === 'normal' ? 'image/*' : 'image/*,application/pdf'}
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                />
            </div>
        </div>
    )
}