/**
 * DiagramLearn Component
 * 
 * Learn mode for diagram-based content with two modes:
 * 1. Click Location: Given a label name, click where it is on the image
 * 2. Type Label: Given label locations, type the label names
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Header from '../header/header'
import { useAuth } from '../auth/AuthContext'
import type { DiagramData, DiagramCard, DiagramLabel, DiagramLearnMode, LabelDisplayMode } from './types'
import './DiagramLearn.css'

// Card item with difficulty for spaced repetition
interface CardItem {
    card: DiagramCard
    difficulty: number
    seen: boolean
    masteredOnFirstTry: boolean
}

// Label item with difficulty for spaced repetition (within a card)
interface LabelItem {
    label: DiagramLabel
    difficulty: number
    seen: boolean
    masteredOnFirstTry: boolean
}

// Shuffle array using Fisher-Yates algorithm
function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
}

// Insert item at random position in array
function insertAtRandomPosition<T>(array: T[], item: T): T[] {
    const newArray = [...array]
    const position = Math.floor(Math.random() * (newArray.length + 1))
    newArray.splice(position, 0, item)
    return newArray
}

// Calculate max difficulty: largest n where 2^n <= data.length
function calculateMaxDifficulty(dataLength: number): number {
    if (dataLength <= 1) return 0
    return Math.floor(Math.log2(dataLength))
}

function DiagramLearn() {
    const { sessionId } = useParams<{ sessionId?: string }>()
    const navigate = useNavigate()
    useAuth() // For authentication check

    // Core state
    const [diagram, setDiagram] = useState<DiagramData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Learn mode state
    const [mode, setMode] = useState<DiagramLearnMode>('click-location')
    const [labelDisplayMode, setLabelDisplayMode] = useState<LabelDisplayMode>('all-at-once')

    // Card learning mode (order of cards)
    const [cardLearningMode, setCardLearningMode] = useState<'spaced' | 'random' | 'sequential'>('spaced')
    const [deck, setDeck] = useState<CardItem[]>([])

    // Label learning mode (order of labels within a card)
    const [labelLearningMode, setLabelLearningMode] = useState<'spaced' | 'random' | 'sequential'>('sequential')
    const [labelDeck, setLabelDeck] = useState<LabelItem[]>([])

    const [correctCount, setCorrectCount] = useState(0)
    const [incorrectCount, setIncorrectCount] = useState(0)
    const [answeredLabels, setAnsweredLabels] = useState<Set<string>>(new Set())
    const [incorrectLabels, setIncorrectLabels] = useState<Set<string>>(new Set()) // Track which labels have been marked incorrect
    const [showAnswer, setShowAnswer] = useState(false)
    const [userInput, setUserInput] = useState('')
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null)
    const [clickFeedback, setClickFeedback] = useState<{ x: number; y: number; correct: boolean } | null>(null)

    // All-at-once mode: selected label for text input
    const [selectedLabelForInput, setSelectedLabelForInput] = useState<string | null>(null)
    const [inputPosition, setInputPosition] = useState<{ x: number; y: number } | null>(null)

    // Calculate max difficulty for spaced repetition (cards)
    const maxDifficulty = useMemo(() => calculateMaxDifficulty(deck.length), [deck.length])

    // Calculate max difficulty for label spaced repetition
    const labelMaxDifficulty = useMemo(() => calculateMaxDifficulty(labelDeck.length), [labelDeck.length])

    // Get current card from deck
    const currentCardItem = deck[0] || null
    const currentCard = currentCardItem?.card || null

    // Get current label from label deck (for one-by-one mode)
    const currentLabelItem = labelDeck[0] || null
    const currentLabel = currentLabelItem?.label || null

    // Get all labels for the current card (for all-at-once mode)
    const currentLabels = currentCard?.labels || []
    const unansweredLabels = currentLabels.filter(l => !answeredLabels.has(l.id))

    // Load diagram data and initialize deck
    useEffect(() => {
        const loadDiagram = async () => {
            if (!sessionId) return

            setIsLoading(true)
            try {
                const response = await fetch(`/api/diagrams/${sessionId}`)
                const result = await response.json()

                if (result.success && result.data) {
                    setDiagram(result.data)
                    // Check if diagram has any labels
                    const hasLabels = result.data.cards.some((card: DiagramCard) => card.labels.length > 0)
                    if (!hasLabels) {
                        setError('This diagram has no labels to learn. Add labels in edit mode first.')
                    } else {
                        // Initialize deck with cards
                        const initialDeck: CardItem[] = result.data.cards.map((card: DiagramCard) => ({
                            card,
                            difficulty: 0,
                            seen: false,
                            masteredOnFirstTry: false
                        }))
                        // Shuffle for spaced and random modes, keep order for sequential
                        if (cardLearningMode === 'sequential') {
                            setDeck(initialDeck)
                        } else {
                            setDeck(shuffleArray(initialDeck))
                        }
                    }
                } else {
                    setError('Diagram not found')
                }
            } catch (err) {
                console.error('Error loading diagram:', err)
                setError('Failed to load diagram')
            } finally {
                setIsLoading(false)
            }
        }

        loadDiagram()
    }, [sessionId])

    // Initialize label deck when current card changes
    useEffect(() => {
        if (!currentCard) {
            setLabelDeck([])
            return
        }

        // Initialize label deck with labels from current card
        const initialLabelDeck: LabelItem[] = currentCard.labels.map((label: DiagramLabel) => ({
            label,
            difficulty: 0,
            seen: false,
            masteredOnFirstTry: false
        }))

        // Shuffle for spaced and random modes, keep order for sequential
        if (labelLearningMode === 'sequential') {
            setLabelDeck(initialLabelDeck)
        } else {
            setLabelDeck(shuffleArray(initialLabelDeck))
        }

        // Reset label state
        setAnsweredLabels(new Set())
        setIncorrectLabels(new Set())
        setShowAnswer(false)
        setUserInput('')
        setFeedback(null)
        setClickFeedback(null)
        setSelectedLabelForInput(null)
        setInputPosition(null)
    }, [currentCardItem?.card.id, labelLearningMode])

    // Point-in-polygon algorithm (ray casting)
    const isPointInPolygon = useCallback((x: number, y: number, points: number[]): boolean => {
        let inside = false
        for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
            const xi = points[i], yi = points[i + 1]
            const xj = points[j], yj = points[j + 1]

            const intersect = ((yi > y) !== (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
            if (intersect) inside = !inside
        }
        return inside
    }, [])

    // Handle moving to the next label (after answering current label)
    const handleNextLabel = useCallback((wasCorrect: boolean) => {
        if (!currentLabelItem || labelDeck.length <= 1) return

        const item = { ...currentLabelItem }
        const newLabelDeck = [...labelDeck]
        newLabelDeck.shift() // Remove from front

        // Check if this is the first time seeing this label
        const isFirstAttempt = !item.seen
        item.seen = true

        // Update label based on performance
        if (wasCorrect) {
            // Label mastered - decrease difficulty
            if (item.difficulty > 0) {
                item.difficulty = Math.max(0, item.difficulty - 1)
            }
            if (isFirstAttempt) {
                item.masteredOnFirstTry = true
            }
        } else {
            // Got it wrong - set to max difficulty
            item.difficulty = labelMaxDifficulty
            item.masteredOnFirstTry = false
        }

        // Position label based on learning mode
        if (labelLearningMode === 'random') {
            setLabelDeck(insertAtRandomPosition(newLabelDeck, item))
        } else if (labelLearningMode === 'sequential') {
            newLabelDeck.push(item)
            setLabelDeck(newLabelDeck)
        } else {
            // Spaced mode: use spaced repetition algorithm
            if (item.difficulty === 0) {
                // Mastered - go to end
                newLabelDeck.push(item)
            } else {
                // Position based on difficulty
                const moveBackPositions = Math.pow(2, labelMaxDifficulty - item.difficulty)
                const insertPosition = Math.min(moveBackPositions, newLabelDeck.length)
                newLabelDeck.splice(insertPosition, 0, item)
            }
            setLabelDeck(newLabelDeck)
        }
    }, [currentLabelItem, labelDeck, labelLearningMode, labelMaxDifficulty])

    // Handle click on canvas (for click-location mode)
    const handleCanvasClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (mode !== 'click-location' || !currentLabel || answeredLabels.has(currentLabel.id)) return

        const svg = e.currentTarget
        const rect = svg.getBoundingClientRect()
        // Scale from screen coordinates to SVG viewBox coordinates (800x600)
        const scaleX = 800 / rect.width
        const scaleY = 600 / rect.height
        const x = (e.clientX - rect.left) * scaleX
        const y = (e.clientY - rect.top) * scaleY

        // Check if click is within the label's shape area
        const shapeType = currentLabel.shapeType || 'point'
        let isCorrect = false

        if (shapeType === 'point') {
            // Point: check distance from marker position
            const tolerance = 40 // pixels in SVG coordinates
            const distance = Math.sqrt(Math.pow(x - currentLabel.x, 2) + Math.pow(y - currentLabel.y, 2))
            isCorrect = distance <= tolerance
        } else if (shapeType === 'rectangle') {
            // Rectangle: check if click is within bounding box
            const labelX = currentLabel.x
            const labelY = currentLabel.y
            const labelW = currentLabel.width || 100
            const labelH = currentLabel.height || 60
            isCorrect = x >= labelX && x <= labelX + labelW && y >= labelY && y <= labelY + labelH
        } else if (shapeType === 'circle') {
            // Circle: check if distance from center is less than radius
            const centerX = currentLabel.x + (currentLabel.width || 100) / 2
            const centerY = currentLabel.y + (currentLabel.width || 100) / 2
            const radius = (currentLabel.width || 100) / 2
            const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2))
            isCorrect = distance <= radius
        } else if (shapeType === 'polygon' && currentLabel.polygonPoints && currentLabel.polygonPoints.length >= 6) {
            // Polygon: use point-in-polygon algorithm
            isCorrect = isPointInPolygon(x, y, currentLabel.polygonPoints)
        }

        setClickFeedback({ x, y, correct: isCorrect })

        // First attempt determines the score - mark as answered immediately
        const isFirstAttempt = !answeredLabels.has(currentLabel.id)

        if (isFirstAttempt) {
            // Mark as answered on first attempt
            setAnsweredLabels(prev => new Set([...prev, currentLabel.id]))

            if (isCorrect) {
                setCorrectCount(prev => prev + 1)
                setFeedback('correct')
            } else {
                setIncorrectCount(prev => prev + 1)
                setIncorrectLabels(prev => new Set([...prev, currentLabel.id]))
                setFeedback('incorrect')
            }
        }

        // Move to next label after delay using label deck
        setTimeout(() => {
            if (labelDeck.length > 1) {
                handleNextLabel(isCorrect)
            }
            setFeedback(null)
            setClickFeedback(null)
        }, 1000)
    }, [mode, currentLabel, labelDeck.length, answeredLabels, isPointInPolygon, handleNextLabel])

    // Handle typing answer (for type-label mode - one-by-one)
    const handleSubmitAnswer = useCallback(() => {
        if (mode !== 'type-label' || !currentLabel) return

        const isCorrect = userInput.trim().toLowerCase() === currentLabel.text.toLowerCase()

        // First attempt determines the score
        const isFirstAttempt = !answeredLabels.has(currentLabel.id)

        if (isFirstAttempt) {
            // Mark as answered on first attempt
            setAnsweredLabels(prev => new Set([...prev, currentLabel.id]))

            if (isCorrect) {
                setCorrectCount(prev => prev + 1)
                setFeedback('correct')
            } else {
                setIncorrectCount(prev => prev + 1)
                setIncorrectLabels(prev => new Set([...prev, currentLabel.id]))
                setFeedback('incorrect')
            }
        }

        // Show answer and move to next after delay using label deck
        setShowAnswer(true)
        setTimeout(() => {
            if (labelDisplayMode === 'one-by-one' && labelDeck.length > 1) {
                handleNextLabel(isCorrect)
            }
            setShowAnswer(false)
            setUserInput('')
            setFeedback(null)
        }, 1500)
    }, [mode, currentLabel, userInput, labelDisplayMode, labelDeck.length, answeredLabels, handleNextLabel])

    // Handle clicking on a numbered label (for type-label mode - all-at-once)
    const handleLabelNumberClick = useCallback((e: React.MouseEvent, label: DiagramLabel, screenX: number, screenY: number) => {
        if (mode !== 'type-label' || labelDisplayMode !== 'all-at-once') return
        if (answeredLabels.has(label.id)) return // Already answered

        e.stopPropagation()
        setSelectedLabelForInput(label.id)
        setInputPosition({ x: screenX, y: screenY })
        setUserInput('')
    }, [mode, labelDisplayMode, answeredLabels])

    // Handle submitting answer for all-at-once mode
    const handleSubmitLabelAnswer = useCallback(() => {
        if (!selectedLabelForInput) return
        const label = currentLabels.find(l => l.id === selectedLabelForInput)
        if (!label) return

        const isCorrect = userInput.trim().toLowerCase() === label.text.toLowerCase()

        // First attempt determines the score
        const isFirstAttempt = !answeredLabels.has(label.id)

        if (isFirstAttempt) {
            // Mark as answered on first attempt
            setAnsweredLabels(prev => new Set([...prev, label.id]))

            if (isCorrect) {
                setCorrectCount(prev => prev + 1)
                setFeedback('correct')
            } else {
                setIncorrectCount(prev => prev + 1)
                setIncorrectLabels(prev => new Set([...prev, label.id]))
                setFeedback('incorrect')
            }
        }

        setSelectedLabelForInput(null)
        setInputPosition(null)
        setUserInput('')

        setTimeout(() => {
            setFeedback(null)
        }, 1500)
    }, [selectedLabelForInput, userInput, currentLabels, answeredLabels])

    // Handle card learning mode change
    const handleCardLearningModeChange = useCallback((newMode: 'spaced' | 'random' | 'sequential') => {
        setCardLearningMode(newMode)
        if (!diagram) return

        // Reset deck based on new mode
        const resetDeck: CardItem[] = diagram.cards.map((card: DiagramCard) => ({
            card,
            difficulty: 0,
            seen: false,
            masteredOnFirstTry: false
        }))

        // Shuffle for spaced and random modes, keep order for sequential
        if (newMode === 'sequential') {
            setDeck(resetDeck)
        } else {
            setDeck(shuffleArray(resetDeck))
        }

        // Reset all state
        setCorrectCount(0)
        setIncorrectCount(0)
        setAnsweredLabels(new Set())
        setIncorrectLabels(new Set())
        setShowAnswer(false)
        setUserInput('')
        setFeedback(null)
        setClickFeedback(null)
        setSelectedLabelForInput(null)
        setInputPosition(null)
    }, [diagram])

    // Handle label learning mode change
    const handleLabelLearningModeChange = useCallback((newMode: 'spaced' | 'random' | 'sequential') => {
        setLabelLearningMode(newMode)
        // Reset label deck immediately with new mode
        if (!currentCardItem) return
        const currentLabels = currentCardItem.card.labels
        const initialLabelDeck: LabelItem[] = currentLabels.map((label: DiagramLabel) => ({
            label,
            difficulty: 0,
            seen: false,
            masteredOnFirstTry: false
        }))
        // Shuffle for spaced and random modes, keep order for sequential
        if (newMode === 'sequential') {
            setLabelDeck(initialLabelDeck)
        } else {
            setLabelDeck(shuffleArray(initialLabelDeck))
        }
        // Reset label state
        setAnsweredLabels(new Set())
        setIncorrectLabels(new Set())
        setShowAnswer(false)
        setUserInput('')
        setFeedback(null)
        setClickFeedback(null)
        setSelectedLabelForInput(null)
        setInputPosition(null)
    }, [currentCardItem])

    // Handle moving to the next card (after completing current card's labels)
    const handleNextCard = useCallback((wasCorrect: boolean) => {
        if (!currentCardItem || deck.length <= 1) return

        const item = { ...currentCardItem }
        const newDeck = [...deck]
        newDeck.shift() // Remove from front

        // Check if this is the first time seeing this card
        const isFirstAttempt = !item.seen
        item.seen = true

        // Update card based on performance
        // Spaced repetition: difficulty represents how "hard" the card is
        // Higher difficulty = card appears sooner, lower difficulty = card appears later
        if (wasCorrect) {
            // Card mastered - decrease difficulty (will appear later)
            if (item.difficulty > 0) {
                item.difficulty = Math.max(0, item.difficulty - 1)
            }
            if (isFirstAttempt) {
                item.masteredOnFirstTry = true
            }
        } else {
            // Got some wrong - set to max difficulty (will appear sooner)
            item.difficulty = maxDifficulty
            item.masteredOnFirstTry = false
        }

        // Position card based on learning mode
        if (cardLearningMode === 'random') {
            setDeck(insertAtRandomPosition(newDeck, item))
        } else if (cardLearningMode === 'sequential') {
            newDeck.push(item)
            setDeck(newDeck)
        } else {
            // Spaced mode: use spaced repetition algorithm
            // Cards with difficulty 0 go to the end (mastered)
            // Cards with higher difficulty appear sooner (need more practice)
            if (item.difficulty === 0) {
                // Mastered - go to end
                newDeck.push(item)
            } else {
                // Position based on difficulty: 2^(maxDifficulty - difficulty)
                // Higher difficulty = smaller exponent = closer to front
                const moveBackPositions = Math.pow(2, maxDifficulty - item.difficulty)
                const insertPosition = Math.min(moveBackPositions, newDeck.length)
                newDeck.splice(insertPosition, 0, item)
            }
            setDeck(newDeck)
        }
    }, [currentCardItem, deck, cardLearningMode, maxDifficulty])

    // Restart learning
    const restart = useCallback(() => {
        if (!diagram) return

        // Reset deck
        const resetDeck: CardItem[] = diagram.cards.map((card: DiagramCard) => ({
            card,
            difficulty: 0,
            seen: false,
            masteredOnFirstTry: false
        }))

        // Shuffle for spaced and random modes, keep order for sequential
        if (cardLearningMode === 'sequential') {
            setDeck(resetDeck)
        } else {
            setDeck(shuffleArray(resetDeck))
        }

        setCorrectCount(0)
        setIncorrectCount(0)
        setAnsweredLabels(new Set())
        setIncorrectLabels(new Set())
        setShowAnswer(false)
        setUserInput('')
        setFeedback(null)
        setClickFeedback(null)
        setSelectedLabelForInput(null)
        setInputPosition(null)
    }, [diagram, cardLearningMode])

    // Keyboard handler for space to reveal / enter to submit
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (mode === 'type-label' && e.key === 'Enter' && userInput.trim()) {
                e.preventDefault()
                handleSubmitAnswer()
            }
            if (mode === 'type-label' && e.key === ' ' && !userInput && labelDisplayMode === 'one-by-one') {
                e.preventDefault()
                setShowAnswer(true)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [mode, userInput, handleSubmitAnswer, labelDisplayMode])

    // Check if card is complete
    const isCardComplete = unansweredLabels.length === 0 && currentLabels.length > 0
    const totalLabels = diagram?.cards.reduce((sum, card) => sum + card.labels.length, 0) || 0
    const progress = totalLabels > 0 ? Math.round((answeredLabels.size / currentLabels.length) * 100) : 0

    // Loading state
    if (isLoading) {
        return (
            <div className="diagram_learn">
                <Header />
                <div className="diagram_learn_loading">Loading diagram...</div>
            </div>
        )
    }

    // Error state
    if (error) {
        return (
            <div className="diagram_learn">
                <Header />
                <div className="diagram_learn_error">
                    <p>{error}</p>
                    <button onClick={() => navigate(`/diagrams/${sessionId}`)}>
                        Go to Editor
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="diagram_learn">
            <Header />

            <div className="diagram_learn_header">
                <h1 className="diagram_learn_title">{diagram?.title || 'Untitled Diagram'}</h1>
                <button
                    className="diagram_learn_edit_btn"
                    onClick={() => navigate(`/diagrams/${sessionId}`)}
                >
                    Edit Mode
                </button>
            </div>

            <div className="diagram_learn_controls">
                {/* Mode selector */}
                <div className="diagram_learn_segmented">
                    <button
                        className={mode === 'click-location' ? 'active' : ''}
                        onClick={() => { setMode('click-location'); restart(); }}
                    >
                        Click Location
                    </button>
                    <button
                        className={mode === 'type-label' ? 'active' : ''}
                        onClick={() => { setMode('type-label'); restart(); }}
                    >
                        Type Label
                    </button>
                </div>

                {/* Label display mode (only for type-label) */}
                {mode === 'type-label' && (
                    <div className="diagram_learn_segmented">
                        <button
                            className={labelDisplayMode === 'all-at-once' ? 'active' : ''}
                            onClick={() => { setLabelDisplayMode('all-at-once'); restart(); }}
                        >
                            All Labels
                        </button>
                        <button
                            className={labelDisplayMode === 'one-by-one' ? 'active' : ''}
                            onClick={() => { setLabelDisplayMode('one-by-one'); restart(); }}
                        >
                            One by One
                        </button>
                    </div>
                )}

                {/* Card learning mode selector */}
                <div className="diagram_learn_mode_group">
                    <span className="diagram_learn_mode_label">Cards:</span>
                    <div className="diagram_learn_segmented">
                        <button
                            className={cardLearningMode === 'spaced' ? 'active' : ''}
                            onClick={() => handleCardLearningModeChange('spaced')}
                        >
                            Spaced
                        </button>
                        <button
                            className={cardLearningMode === 'random' ? 'active' : ''}
                            onClick={() => handleCardLearningModeChange('random')}
                        >
                            Random
                        </button>
                        <button
                            className={cardLearningMode === 'sequential' ? 'active' : ''}
                            onClick={() => handleCardLearningModeChange('sequential')}
                        >
                            Sequential
                        </button>
                    </div>
                </div>

                {/* Label learning mode selector */}
                <div className="diagram_learn_mode_group">
                    <span className="diagram_learn_mode_label">Labels:</span>
                    <div className="diagram_learn_segmented">
                        <button
                            className={labelLearningMode === 'spaced' ? 'active' : ''}
                            onClick={() => handleLabelLearningModeChange('spaced')}
                        >
                            Spaced
                        </button>
                        <button
                            className={labelLearningMode === 'random' ? 'active' : ''}
                            onClick={() => handleLabelLearningModeChange('random')}
                        >
                            Random
                        </button>
                        <button
                            className={labelLearningMode === 'sequential' ? 'active' : ''}
                            onClick={() => handleLabelLearningModeChange('sequential')}
                        >
                            Sequential
                        </button>
                    </div>
                </div>

                {/* Score display */}
                <div className="diagram_learn_score">
                    <span className="score_correct">✓ {correctCount}</span>
                    <span className="score_incorrect">✗ {incorrectCount}</span>
                </div>

                <button className="diagram_learn_restart_btn" onClick={restart}>
                    Restart
                </button>
            </div>

            <div className="diagram_learn_workspace">
                {/* Prompt area */}
                <div className="diagram_learn_prompt">
                    {mode === 'click-location' && currentLabel && !isCardComplete && (
                        <p>Click on: <strong>{currentLabel.text}</strong></p>
                    )}
                    {mode === 'type-label' && labelDisplayMode === 'one-by-one' && currentLabel && !isCardComplete && (
                        <div className="diagram_learn_input_area">
                            <p>What is this label?</p>
                            <input
                                type="text"
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                placeholder="Type your answer..."
                                disabled={showAnswer}
                                autoFocus
                            />
                            <button onClick={handleSubmitAnswer} disabled={!userInput.trim() || showAnswer}>
                                Submit
                            </button>
                            {showAnswer && (
                                <p className="diagram_learn_answer">
                                    Answer: <strong>{currentLabel.text}</strong>
                                </p>
                            )}
                        </div>
                    )}
                    {mode === 'type-label' && labelDisplayMode === 'all-at-once' && !isCardComplete && (
                        <p>Type the labels shown on the diagram</p>
                    )}
                    {isCardComplete && (
                        <p className="diagram_learn_complete">
                            Card complete! {deck.length > 1
                                ? 'Click Next to continue.'
                                : 'You finished all cards!'}
                        </p>
                    )}
                </div>

                {/* Canvas area */}
                <div className="diagram_learn_canvas_container">
                    <svg
                        className="diagram_learn_canvas"
                        viewBox="0 0 800 600"
                        preserveAspectRatio="xMidYMid meet"
                        onClick={handleCanvasClick}
                    >
                        {/* Background */}
                        <rect width="100%" height="100%" fill="#1a1a1a" />

                        {/* Images */}
                        {currentCard?.images
                            .sort((a, b) => a.zIndex - b.zIndex)
                            .map(img => (
                                <image
                                    key={img.id}
                                    href={img.src}
                                    x={img.x}
                                    y={img.y}
                                    width={img.width}
                                    height={img.height}
                                    opacity={img.opacity}
                                />
                            ))}

                        {/* Shapes */}
                        {currentCard?.shapes.map(shape => {
                            const [x1, y1, x2, y2] = shape.points
                            if (shape.type === 'rectangle') {
                                return (
                                    <rect
                                        key={shape.id}
                                        x={Math.min(x1, x2)}
                                        y={Math.min(y1, y2)}
                                        width={Math.abs(x2 - x1)}
                                        height={Math.abs(y2 - y1)}
                                        stroke={shape.color}
                                        strokeWidth={shape.strokeWidth}
                                        fill={shape.fillColor || 'none'}
                                    />
                                )
                            }
                            if (shape.type === 'circle') {
                                const cx = (x1 + x2) / 2
                                const cy = (y1 + y2) / 2
                                const r = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)) / 2
                                return (
                                    <circle
                                        key={shape.id}
                                        cx={cx}
                                        cy={cy}
                                        r={r}
                                        stroke={shape.color}
                                        strokeWidth={shape.strokeWidth}
                                        fill={shape.fillColor || 'none'}
                                    />
                                )
                            }
                            if (shape.type === 'line') {
                                return (
                                    <line
                                        key={shape.id}
                                        x1={x1}
                                        y1={y1}
                                        x2={x2}
                                        y2={y2}
                                        stroke={shape.color}
                                        strokeWidth={shape.strokeWidth}
                                    />
                                )
                            }
                            if (shape.type === 'arrow') {
                                const angle = Math.atan2(y2 - y1, x2 - x1)
                                const headLen = 15
                                return (
                                    <g key={shape.id}>
                                        <line
                                            x1={x1}
                                            y1={y1}
                                            x2={x2}
                                            y2={y2}
                                            stroke={shape.color}
                                            strokeWidth={shape.strokeWidth}
                                        />
                                        <polygon
                                            points={`
                                                ${x2},${y2}
                                                ${x2 - headLen * Math.cos(angle - Math.PI / 6)},${y2 - headLen * Math.sin(angle - Math.PI / 6)}
                                                ${x2 - headLen * Math.cos(angle + Math.PI / 6)},${y2 - headLen * Math.sin(angle + Math.PI / 6)}
                                            `}
                                            fill={shape.color}
                                        />
                                    </g>
                                )
                            }
                            return null
                        })}

                        {/* Labels - shown based on mode */}
                        {mode === 'type-label' && currentCard?.labels.map((label, idx) => {
                            // In one-by-one mode, only show the current label from the label deck
                            const isCurrentLabel = currentLabel?.id === label.id
                            const shouldShow = labelDisplayMode === 'all-at-once' || isCurrentLabel
                            const isAnswered = answeredLabels.has(label.id)
                            const isSelected = selectedLabelForInput === label.id
                            const shapeType = label.shapeType || 'point'

                            if (!shouldShow && labelDisplayMode === 'one-by-one') return null

                            // Get screen coordinates for click handler
                            const svgElement = document.querySelector('.diagram_learn_canvas')
                            const rect = svgElement?.getBoundingClientRect()

                            // Calculate center position for different shape types
                            let markerX = label.x
                            let markerY = label.y
                            if (shapeType === 'rectangle') {
                                markerX = label.x + (label.width || 100) / 2
                                markerY = label.y + (label.height || 60) / 2
                            } else if (shapeType === 'circle') {
                                markerX = label.x + (label.width || 100) / 2
                                markerY = label.y + (label.width || 100) / 2
                            } else if (shapeType === 'polygon' && label.polygonPoints && label.polygonPoints.length >= 6) {
                                // Calculate centroid for polygon
                                let sumX = 0, sumY = 0
                                const numPoints = label.polygonPoints.length / 2
                                for (let i = 0; i < label.polygonPoints.length; i += 2) {
                                    sumX += label.polygonPoints[i]
                                    sumY += label.polygonPoints[i + 1]
                                }
                                markerX = sumX / numPoints
                                markerY = sumY / numPoints
                            }

                            const screenX = rect ? markerX * (rect.width / 800) : 0
                            const screenY = rect ? markerY * (rect.height / 600) : 0

                            return (
                                <g key={label.id}>
                                    {/* Show shape outline for non-point shapes */}
                                    {shapeType === 'rectangle' && (
                                        <rect
                                            x={label.x}
                                            y={label.y}
                                            width={label.width || 100}
                                            height={label.height || 60}
                                            fill={isAnswered ? 'rgba(34, 197, 94, 0.2)' : 'rgba(0, 212, 255, 0.1)'}
                                            stroke={isAnswered ? '#22c55e' : '#00d4ff'}
                                            strokeWidth="1"
                                            strokeDasharray={isAnswered ? 'none' : '4,4'}
                                            rx="4"
                                        />
                                    )}
                                    {shapeType === 'circle' && (
                                        <circle
                                            cx={label.x + (label.width || 100) / 2}
                                            cy={label.y + (label.width || 100) / 2}
                                            r={(label.width || 100) / 2}
                                            fill={isAnswered ? 'rgba(34, 197, 94, 0.2)' : 'rgba(0, 212, 255, 0.1)'}
                                            stroke={isAnswered ? '#22c55e' : '#00d4ff'}
                                            strokeWidth="1"
                                            strokeDasharray={isAnswered ? 'none' : '4,4'}
                                        />
                                    )}
                                    {shapeType === 'polygon' && label.polygonPoints && label.polygonPoints.length >= 6 && (
                                        <polygon
                                            points={label.polygonPoints.reduce((acc, val, i) =>
                                                i % 2 === 0 ? acc + (i > 0 ? ' ' : '') + val : acc + ',' + val, ''
                                            )}
                                            fill={isAnswered ? 'rgba(34, 197, 94, 0.2)' : 'rgba(0, 212, 255, 0.1)'}
                                            stroke={isAnswered ? '#22c55e' : '#00d4ff'}
                                            strokeWidth="1"
                                            strokeDasharray={isAnswered ? 'none' : '4,4'}
                                        />
                                    )}

                                    {/* Label marker dot - clickable in all-at-once mode */}
                                    <circle
                                        cx={markerX}
                                        cy={markerY}
                                        r={isSelected ? 16 : 12}
                                        fill={isAnswered ? 'rgba(34, 197, 94, 0.8)' : isSelected ? 'rgba(0, 212, 255, 1)' : 'rgba(0, 212, 255, 0.8)'}
                                        stroke={isAnswered ? '#22c55e' : '#00d4ff'}
                                        strokeWidth={isSelected ? 3 : 2}
                                        style={{
                                            cursor: labelDisplayMode === 'all-at-once' && !isAnswered ? 'pointer' : 'default',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onClick={(e) => {
                                            if (labelDisplayMode === 'all-at-once' && !isAnswered) {
                                                handleLabelNumberClick(e, label, screenX, screenY)
                                            }
                                        }}
                                    />
                                    <text
                                        x={markerX}
                                        y={markerY + 5}
                                        fill="white"
                                        fontSize={isSelected ? 14 : 12}
                                        textAnchor="middle"
                                        fontWeight="bold"
                                        style={{ pointerEvents: 'none' }}
                                    >
                                        {idx + 1}
                                    </text>
                                    {/* Show label text if answered or showing answer */}
                                    {(isAnswered || (showAnswer && isCurrentLabel)) && (
                                        <text
                                            x={markerX + 20}
                                            y={markerY + 5}
                                            fill="#22c55e"
                                            fontSize={14}
                                            fontWeight="bold"
                                        >
                                            {label.text}
                                        </text>
                                    )}
                                </g>
                            )
                        })}

                        {/* Click-location mode: show answered labels */}
                        {mode === 'click-location' && currentCard?.labels.map((label) => {
                            const isAnswered = answeredLabels.has(label.id)
                            if (!isAnswered) return null

                            const shapeType = label.shapeType || 'point'

                            return (
                                <g key={label.id}>
                                    {/* Shape rendering based on shapeType */}
                                    {shapeType === 'point' && (
                                        <>
                                            <circle
                                                cx={label.x}
                                                cy={label.y}
                                                r={10}
                                                fill="rgba(34, 197, 94, 0.5)"
                                                stroke="#22c55e"
                                                strokeWidth="2"
                                            />
                                            <rect
                                                x={label.x + 12}
                                                y={label.y - label.fontSize / 2 - 2}
                                                width={label.text.length * label.fontSize * 0.6 + 8}
                                                height={label.fontSize * 1.4}
                                                fill="rgba(34, 197, 94, 0.3)"
                                                stroke="#22c55e"
                                                strokeWidth="2"
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
                                            fill="rgba(34, 197, 94, 0.3)"
                                            stroke="#22c55e"
                                            strokeWidth="2"
                                            rx="4"
                                        />
                                    )}
                                    {shapeType === 'circle' && (
                                        <circle
                                            cx={label.x + (label.width || 100) / 2}
                                            cy={label.y + (label.width || 100) / 2}
                                            r={(label.width || 100) / 2}
                                            fill="rgba(34, 197, 94, 0.3)"
                                            stroke="#22c55e"
                                            strokeWidth="2"
                                        />
                                    )}
                                    {shapeType === 'polygon' && label.polygonPoints && label.polygonPoints.length >= 6 && (
                                        <polygon
                                            points={label.polygonPoints.reduce((acc, val, i) =>
                                                i % 2 === 0 ? acc + (i > 0 ? ' ' : '') + val : acc + ',' + val, ''
                                            )}
                                            fill="rgba(34, 197, 94, 0.3)"
                                            stroke="#22c55e"
                                            strokeWidth="2"
                                        />
                                    )}

                                    {/* Text label - calculate polygon centroid for text positioning */}
                                    {(() => {
                                        let textX = label.x + 16
                                        let textY = label.y + label.fontSize / 3
                                        let textAnchor: 'start' | 'middle' | 'end' = 'start'

                                        if (shapeType === 'rectangle') {
                                            textX = label.x + (label.width || 100) / 2
                                            textY = label.y + (label.height || 60) / 2 + label.fontSize / 3
                                            textAnchor = 'middle'
                                        } else if (shapeType === 'circle') {
                                            textX = label.x + (label.width || 100) / 2
                                            textY = label.y + (label.width || 100) / 2 + label.fontSize / 3
                                            textAnchor = 'middle'
                                        } else if (shapeType === 'polygon' && label.polygonPoints && label.polygonPoints.length >= 6) {
                                            // Calculate centroid
                                            let sumX = 0, sumY = 0
                                            const numPoints = label.polygonPoints.length / 2
                                            for (let i = 0; i < label.polygonPoints.length; i += 2) {
                                                sumX += label.polygonPoints[i]
                                                sumY += label.polygonPoints[i + 1]
                                            }
                                            textX = sumX / numPoints
                                            textY = sumY / numPoints + label.fontSize / 3
                                            textAnchor = 'middle'
                                        }

                                        return (
                                            <text
                                                x={textX}
                                                y={textY}
                                                fill="#22c55e"
                                                fontSize={label.fontSize}
                                                fontFamily="system-ui"
                                                fontWeight="bold"
                                                textAnchor={textAnchor}
                                            >
                                                {label.text}
                                            </text>
                                        )
                                    })()}
                                </g>
                            )
                        })}

                        {/* Click feedback */}
                        {clickFeedback && (
                            <g>
                                <circle
                                    cx={clickFeedback.x}
                                    cy={clickFeedback.y}
                                    r={20}
                                    fill={clickFeedback.correct ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'}
                                    stroke={clickFeedback.correct ? '#22c55e' : '#ef4444'}
                                    strokeWidth={3}
                                >
                                    <animate
                                        attributeName="r"
                                        from="20"
                                        to="40"
                                        dur="0.5s"
                                        fill="freeze"
                                    />
                                    <animate
                                        attributeName="opacity"
                                        from="1"
                                        to="0"
                                        dur="0.5s"
                                        fill="freeze"
                                    />
                                </circle>
                            </g>
                        )}
                    </svg>

                    {/* Feedback overlay */}
                    {feedback && (
                        <div className={`diagram_learn_feedback ${feedback}`}>
                            {feedback === 'correct' ? '✓ Correct!' : '✗ Incorrect'}
                        </div>
                    )}

                    {/* Input overlay for all-at-once mode */}
                    {selectedLabelForInput && inputPosition && (
                        <div
                            className="diagram_learn_label_input"
                            style={{
                                position: 'absolute',
                                left: inputPosition.x + 20,
                                top: inputPosition.y - 10,
                                zIndex: 1000
                            }}
                        >
                            <input
                                type="text"
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSubmitLabelAnswer()
                                    if (e.key === 'Escape') {
                                        setSelectedLabelForInput(null)
                                        setInputPosition(null)
                                        setUserInput('')
                                    }
                                }}
                                placeholder="Type the label..."
                                autoFocus
                            />
                            <button onClick={handleSubmitLabelAnswer}>Submit</button>
                            <button
                                className="cancel_btn"
                                onClick={() => {
                                    setSelectedLabelForInput(null)
                                    setInputPosition(null)
                                    setUserInput('')
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>

                {/* Progress bar */}
                <div className="diagram_learn_progress">
                    <div className="progress_bar">
                        <div
                            className="progress_fill"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <span className="progress_text">
                        {answeredLabels.size} / {currentLabels.length} labels
                    </span>
                </div>

                {/* Card navigation */}
                <div className="diagram_learn_card_nav">
                    <span className="card_indicator">
                        {deck.length} card{deck.length !== 1 ? 's' : ''} remaining
                    </span>
                    <button
                        onClick={() => {
                            // Calculate if card was mastered (all labels correct on first try)
                            const wasCorrect = incorrectLabels.size === 0 && currentLabels.length > 0
                            handleNextCard(wasCorrect)
                        }}
                        disabled={!isCardComplete || deck.length <= 1}
                    >
                        Next Card →
                    </button>
                </div>
            </div>
        </div>
    )
}

export default DiagramLearn
