import React, { useRef, useState, useEffect } from 'react'
import './DrawingModal.css'

type DrawingTool = 'brush' | 'line' | 'circle' | 'square' | 'bucket'

export type CanvasSize = {
    width: number
    height: number
}

interface DrawingModalProps {
    isOpen: boolean
    onClose: () => void
    onSave: (blob: Blob, hasBorder: boolean, size: CanvasSize) => void
    initialImage?: string
    isEditing?: boolean
    canvasSize?: CanvasSize
    availableSizes?: CanvasSize[]
    title?: string
}

export function DrawingModal({
    isOpen,
    onClose,
    onSave,
    initialImage,
    isEditing = false,
    canvasSize = { width: 800, height: 400 },
    availableSizes,
    title = 'Drawing Canvas'
}: DrawingModalProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const isDrawingRef = useRef(false)
    const startPosRef = useRef<{ x: number; y: number } | null>(null)
    const canvasSnapshotRef = useRef<ImageData | null>(null)

    const [currentTool, setCurrentTool] = useState<DrawingTool>('brush')
    const [brushSize, setBrushSize] = useState(2)
    const [brushColor, setBrushColor] = useState('#000000')
    const [hasBorder, setHasBorder] = useState(true)
    const [selectedSize, setSelectedSize] = useState<CanvasSize>(canvasSize)

    // Initialize canvas with white background when modal opens
    useEffect(() => {
        if (isOpen && canvasRef.current) {
            const canvas = canvasRef.current
            const ctx = canvas.getContext('2d')
            if (ctx) {
                ctx.fillStyle = '#ffffff'
                ctx.fillRect(0, 0, canvas.width, canvas.height)

                // If editing, load the existing drawing
                if (isEditing && initialImage) {
                    const img = new Image()
                    img.onload = () => {
                        ctx.drawImage(img, 0, 0)
                    }
                    img.onerror = (e) => {
                        console.error('Failed to load drawing:', e)
                    }
                    img.src = initialImage
                }
            }
        }
    }, [isOpen, isEditing, initialImage, selectedSize])

    // Update selected size when canvasSize prop changes
    useEffect(() => {
        setSelectedSize(canvasSize)
    }, [canvasSize])

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
                ctx.arc(startX, startY, radius, 0, Math.PI * 2)
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

        startX = Math.floor(startX)
        startY = Math.floor(startY)

        const targetColor = getPixelColor(pixels, startX, startY, canvas.width)
        const fillColor = hexToRgb(brushColor)

        if (colorsMatch(targetColor, fillColor)) return

        const stack: [number, number][] = [[startX, startY]]
        const visited = new Set<string>()

        while (stack.length > 0) {
            const [x, y] = stack.pop()!

            if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue

            const key = `${x},${y}`
            if (visited.has(key)) continue
            visited.add(key)

            const currentColor = getPixelColor(pixels, x, y, canvas.width)
            if (!colorsMatch(currentColor, targetColor)) continue

            setPixelColor(pixels, x, y, canvas.width, fillColor)

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

    const clearCanvas = () => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    const handleSave = () => {
        const canvas = canvasRef.current
        if (!canvas) return

        canvas.toBlob((blob) => {
            if (blob) {
                onSave(blob, hasBorder, selectedSize)
            }
        }, 'image/png')
    }

    const handleSizeChange = (size: CanvasSize) => {
        // Save current canvas content
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

        // Update size
        setSelectedSize(size)

        // Restore content after size change
        setTimeout(() => {
            if (canvasRef.current) {
                const newCtx = canvasRef.current.getContext('2d')
                if (newCtx) {
                    newCtx.fillStyle = '#ffffff'
                    newCtx.fillRect(0, 0, size.width, size.height)
                    newCtx.putImageData(imageData, 0, 0)
                }
            }
        }, 0)
    }

    if (!isOpen) return null

    return (
        <div className="drawing_modal">
            <div className="drawing_container">
                <div className="drawing_header">
                    <h3>{isEditing ? 'Edit Drawing' : title}</h3>
                    <button onClick={onClose}>✕</button>
                </div>

                {/* Drawing Tools */}
                <div className="drawing_toolbar">
                    <div className="drawing_tools">
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

                    <div className="drawing_options">
                        <div className="drawing_option">
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

                        <div className="drawing_option">
                            <label>Color:</label>
                            <input
                                type="color"
                                value={brushColor}
                                onChange={(e) => setBrushColor(e.target.value)}
                            />
                        </div>

                        <div className="drawing_color_palette">
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

                        <div className="drawing_option">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={hasBorder}
                                    onChange={(e) => setHasBorder(e.target.checked)}
                                />
                                Border
                            </label>
                        </div>

                        {/* Canvas Size Selector */}
                        {availableSizes && availableSizes.length > 0 && (
                            <div className="drawing_option">
                                <label>Canvas Size:</label>
                                <select
                                    value={`${selectedSize.width}x${selectedSize.height}`}
                                    onChange={(e) => {
                                        const [width, height] = e.target.value.split('x').map(Number)
                                        handleSizeChange({ width, height })
                                    }}
                                >
                                    {availableSizes.map(size => (
                                        <option key={`${size.width}x${size.height}`} value={`${size.width}x${size.height}`}>
                                            {size.width} × {size.height}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                <canvas
                    ref={canvasRef}
                    width={selectedSize.width}
                    height={selectedSize.height}
                    className="drawing_canvas"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                />
                <div className="drawing_controls">
                    <button onClick={clearCanvas}>Clear</button>
                    <button onClick={handleSave} className="primary">
                        {isEditing ? 'Update Drawing' : 'Save Drawing'}
                    </button>
                </div>
            </div>
        </div>
    )
}

