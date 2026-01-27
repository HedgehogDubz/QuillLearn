/**
 * DiagramViewer Component
 * Read-only viewer for published diagram content
 */

import { useState } from 'react'
import type { DiagramCard, DiagramLabel } from '../diagrams/types'
import './DiagramViewer.css'

interface DiagramViewerProps {
    cards: DiagramCard[]
}

function DiagramViewer({ cards }: DiagramViewerProps) {
    const [currentCardIndex, setCurrentCardIndex] = useState(0)
    const currentCard = cards[currentCardIndex] || null

    if (!cards || cards.length === 0) {
        return (
            <div className="diagram-viewer-empty">
                <p>No diagram content available.</p>
            </div>
        )
    }

    // Calculate centroid for polygon labels
    const getPolygonCentroid = (points: number[]) => {
        let sumX = 0, sumY = 0
        const numPoints = points.length / 2
        for (let i = 0; i < points.length; i += 2) {
            sumX += points[i]
            sumY += points[i + 1]
        }
        return { x: sumX / numPoints, y: sumY / numPoints }
    }

    // Get label marker position based on shape type
    // Position marker on the left side of the label box for better readability
    const getLabelMarkerPosition = (label: DiagramLabel) => {
        const shapeType = label.shapeType || 'point'
        if (shapeType === 'rectangle') {
            // Position marker on the left side, vertically centered
            return { x: label.x + 16, y: label.y + (label.height || 60) / 2 }
        } else if (shapeType === 'circle') {
            // Position marker on the left side of the circle's bounding box
            return { x: label.x + 16, y: label.y + (label.width || 100) / 2 }
        } else if (shapeType === 'polygon' && label.polygonPoints && label.polygonPoints.length >= 6) {
            return getPolygonCentroid(label.polygonPoints)
        }
        return { x: label.x, y: label.y }
    }

    return (
        <div className="diagram-viewer">
            {/* Card navigation */}
            {cards.length > 1 && (
                <div className="diagram-viewer-nav">
                    <button 
                        onClick={() => setCurrentCardIndex(Math.max(0, currentCardIndex - 1))}
                        disabled={currentCardIndex === 0}
                    >
                        ← Previous
                    </button>
                    <span>Card {currentCardIndex + 1} of {cards.length}</span>
                    <button 
                        onClick={() => setCurrentCardIndex(Math.min(cards.length - 1, currentCardIndex + 1))}
                        disabled={currentCardIndex === cards.length - 1}
                    >
                        Next →
                    </button>
                </div>
            )}

            {/* Diagram canvas */}
            <div className="diagram-viewer-canvas-container">
                <svg
                    viewBox="0 0 800 600"
                    preserveAspectRatio="xMidYMid meet"
                    className="diagram-viewer-canvas"
                >
                    {/* Background */}
                    <rect x="0" y="0" width="800" height="600" fill="var(--color-surface-elevated, #1a1a2e)" />

                    {/* Images */}
                    {currentCard?.images.sort((a, b) => a.zIndex - b.zIndex).map(image => (
                        <image
                            key={image.id}
                            href={image.src}
                            x={image.x}
                            y={image.y}
                            width={image.width}
                            height={image.height}
                            opacity={image.opacity}
                        />
                    ))}

                    {/* Shapes */}
                    {currentCard?.shapes.sort((a, b) => a.zIndex - b.zIndex).map(shape => {
                        if (shape.type === 'rectangle') {
                            const [x1, y1, x2, y2] = shape.points
                            return (
                                <rect
                                    key={shape.id}
                                    x={Math.min(x1, x2)}
                                    y={Math.min(y1, y2)}
                                    width={Math.abs(x2 - x1)}
                                    height={Math.abs(y2 - y1)}
                                    fill={shape.fillColor || 'transparent'}
                                    stroke={shape.color}
                                    strokeWidth={shape.strokeWidth}
                                    rx="4"
                                />
                            )
                        }
                        if (shape.type === 'circle') {
                            const [x1, y1, x2, y2] = shape.points
                            const cx = (x1 + x2) / 2
                            const cy = (y1 + y2) / 2
                            const r = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)) / 2
                            return (
                                <circle
                                    key={shape.id}
                                    cx={cx} cy={cy} r={r}
                                    fill={shape.fillColor || 'transparent'}
                                    stroke={shape.color}
                                    strokeWidth={shape.strokeWidth}
                                />
                            )
                        }
                        if (shape.type === 'ellipse') {
                            const [x1, y1, x2, y2] = shape.points
                            return (
                                <ellipse
                                    key={shape.id}
                                    cx={(x1 + x2) / 2}
                                    cy={(y1 + y2) / 2}
                                    rx={Math.abs(x2 - x1) / 2}
                                    ry={Math.abs(y2 - y1) / 2}
                                    fill={shape.fillColor || 'transparent'}
                                    stroke={shape.color}
                                    strokeWidth={shape.strokeWidth}
                                />
                            )
                        }
                        if (shape.type === 'line') {
                            const [x1, y1, x2, y2] = shape.points
                            return (
                                <line key={shape.id} x1={x1} y1={y1} x2={x2} y2={y2}
                                    stroke={shape.color} strokeWidth={shape.strokeWidth} />
                            )
                        }
                        if (shape.type === 'polygon') {
                            return (
                                <polygon key={shape.id}
                                    points={shape.points.reduce((acc, val, i) =>
                                        i % 2 === 0 ? acc + (i > 0 ? ' ' : '') + val : acc + ',' + val, ''
                                    )}
                                    fill={shape.fillColor || 'transparent'}
                                    stroke={shape.color}
                                    strokeWidth={shape.strokeWidth}
                                />
                            )
                        }
                        if (shape.type === 'arrow') {
                            const [x1, y1, x2, y2] = shape.points
                            const angle = Math.atan2(y2 - y1, x2 - x1)
                            const headLen = 15
                            return (
                                <g key={shape.id}>
                                    <line x1={x1} y1={y1} x2={x2} y2={y2}
                                        stroke={shape.color} strokeWidth={shape.strokeWidth} />
                                    <polygon
                                        points={`${x2},${y2} ${x2 - headLen * Math.cos(angle - Math.PI / 6)},${y2 - headLen * Math.sin(angle - Math.PI / 6)} ${x2 - headLen * Math.cos(angle + Math.PI / 6)},${y2 - headLen * Math.sin(angle + Math.PI / 6)}`}
                                        fill={shape.color}
                                    />
                                </g>
                            )
                        }
                        return null
                    })}

                    {/* Labels with shapes */}
                    {currentCard?.labels.map((label, idx) => {
                        const shapeType = label.shapeType || 'point'
                        const markerPos = getLabelMarkerPosition(label)

                        return (
                            <g key={label.id}>
                                {/* Shape outline */}
                                {shapeType === 'rectangle' && (
                                    <rect
                                        x={label.x} y={label.y}
                                        width={label.width || 100} height={label.height || 60}
                                        fill="rgba(0, 212, 255, 0.1)"
                                        stroke="#00d4ff" strokeWidth="1" rx="4"
                                    />
                                )}
                                {shapeType === 'circle' && (
                                    <circle
                                        cx={label.x + (label.width || 100) / 2}
                                        cy={label.y + (label.width || 100) / 2}
                                        r={(label.width || 100) / 2}
                                        fill="rgba(0, 212, 255, 0.1)"
                                        stroke="#00d4ff" strokeWidth="1"
                                    />
                                )}
                                {shapeType === 'polygon' && label.polygonPoints && label.polygonPoints.length >= 6 && (
                                    <polygon
                                        points={label.polygonPoints.reduce((acc, val, i) =>
                                            i % 2 === 0 ? acc + (i > 0 ? ' ' : '') + val : acc + ',' + val, ''
                                        )}
                                        fill="rgba(0, 212, 255, 0.1)"
                                        stroke="#00d4ff" strokeWidth="1"
                                    />
                                )}
                                {/* Marker */}
                                <circle cx={markerPos.x} cy={markerPos.y} r="12"
                                    fill="rgba(0, 212, 255, 0.8)" stroke="#00d4ff" strokeWidth="2" />
                                <text x={markerPos.x} y={markerPos.y + 5}
                                    fill="white" fontSize="12" textAnchor="middle" fontWeight="bold">
                                    {idx + 1}
                                </text>
                                {/* Label text */}
                                <text
                                    x={markerPos.x + 18}
                                    y={markerPos.y + 5}
                                    fill="#00d4ff"
                                    fontSize={label.fontSize || 14}
                                    fontWeight="bold"
                                >
                                    {label.text}
                                </text>
                            </g>
                        )
                    })}
                </svg>
            </div>
        </div>
    )
}

export default DiagramViewer

