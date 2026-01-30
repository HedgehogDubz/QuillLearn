import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import './learn.css'
import Header from '../header/header.tsx'
import type { SessionInfo } from '../gaurdian.ts';
import { updateLastAccessed } from '../sheets/sheetStorage.ts'
import { useAuth } from '../auth/AuthContext'
import { authFetch } from '../utils/api'
import { SheetIcon, DiagramIcon } from '../components/Icons'
import '../components/Icons.css'
// ============ Types ============


// Flashcard item with difficulty for spaced repetition
interface FlashcardItem {
    data: string[]
    difficulty: number
    seen: boolean // Has this card been answered at least once?
    masteredOnFirstTry: boolean // Was this card marked correct on first attempt?
}

// Session data with headers
interface SessionData {
    headers: string[]
    cards: FlashcardItem[]
    title: string
}

// ============ Helper Functions ============

// Parse cell content to extract text and images
function parseCellContent(value: string): { text: string; images: string[] } {
    // Updated regex to match both data URLs and regular URLs (like /api/storage/image/...)
    const imageRegex = /\|\|\|IMG:([^|]+)\|\|\|/g;
    const images: string[] = [];
    let match;

    while ((match = imageRegex.exec(value)) !== null) {
        images.push(match[1]);
    }

    // Remove image markers from text
    const text = value.replace(imageRegex, '').trim();

    return { text, images };
}

// Render cell content with text and images
function renderCellContent(cellValue: string) {
    const { text, images } = parseCellContent(cellValue);

    if (images.length === 0 && !text) {
        return <span className="empty">(empty)</span>;
    }

    // Limit to maximum 2 images
    const displayImages = images.slice(0, 2);

    // Determine text size based on length
    const getTextSizeClass = (text: string) => {
        const length = text.length;
        if (length > 300) return 'learn_cell_text_xs';
        if (length > 200) return 'learn_cell_text_sm';
        if (length > 100) return 'learn_cell_text_md';
        return 'learn_cell_text_lg';
    };

    return (
        <div className="learn_cell_content">
            {text && <div className={`learn_cell_text ${getTextSizeClass(text)}`}>{text}</div>}
            {displayImages.length > 0 && (
                <div className="learn_cell_images_container">
                    {displayImages.map((imgSrc, idx) => (
                        <div key={idx} className="learn_cell_image">
                            <img src={imgSrc} alt="" />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Extended session info with type
type LearnSessionInfo = SessionInfo & {
    type: 'sheet' | 'diagram'
    labelCount?: number // For diagrams - number of labels to learn
}

// Get all learnable sessions from API (sheets and diagrams)
async function getSessionsFromAPI(userId: string): Promise<LearnSessionInfo[]> {
    try {
        // Fetch sheets and diagrams in parallel
        // Note: For diagrams, we need cards data to count labels
        const [sheetsResponse, diagramsResponse] = await Promise.all([
            authFetch(`/api/sheets/user/${userId}`),
            authFetch(`/api/diagrams/user/${userId}?includeCards=true`)
        ])

        const [sheetsResult, diagramsResult] = await Promise.all([
            sheetsResponse.json(),
            diagramsResponse.json()
        ])

        const sessions: LearnSessionInfo[] = []

        // Add sheets
        if (sheetsResult.success && sheetsResult.data) {
            sheetsResult.data.forEach((sheet: any) => {
                sessions.push({
                    title: sheet.title || 'Untitled Sheet',
                    storageKey: `sheet_${sheet.session_id}`,
                    sessionId: sheet.session_id,
                    lastTimeSaved: sheet.last_time_saved,
                    type: 'sheet'
                })
            })
        }

        // Add diagrams (only those with labels)
        if (diagramsResult.success && diagramsResult.data) {
            diagramsResult.data.forEach((diagram: any) => {
                // Count total labels across all cards
                const labelCount = diagram.cards?.reduce((total: number, card: any) =>
                    total + (card.labels?.length || 0), 0) || 0

                // Only include diagrams that have labels to learn
                if (labelCount > 0) {
                    sessions.push({
                        title: diagram.title || 'Untitled Diagram',
                        storageKey: `diagram_${diagram.session_id}`,
                        sessionId: diagram.session_id,
                        lastTimeSaved: diagram.last_time_saved,
                        type: 'diagram',
                        labelCount
                    })
                }
            })
        }

        // Sort by last saved time (most recent first)
        sessions.sort((a, b) => (b.lastTimeSaved || 0) - (a.lastTimeSaved || 0))

        return sessions
    } catch (error) {
        console.error('Error fetching sessions:', error)
    }
    return []
}

// Load session data from API - first row is headers, rest are cards
async function loadSessionData(sessionId: string): Promise<SessionData | null> {
    try {
        const response = await authFetch(`/api/sheets/${sessionId}`)
        const result = await response.json()

        if (result.success && result.data) {
            const data = result.data
            const title = data.title || 'Untitled Sheet'
            let rawData: string[][] | null = null

            // Handle rows format from API
            if (data.rows && Array.isArray(data.rows)) {
                rawData = data.rows.map((row: { data: string[] }) => row.data)
            }

            if (rawData && rawData.length > 0) {
                // First row is headers
                const headers = rawData[0].map((h, i) => h.trim() || `Column ${i + 1}`)

                // Rest are flashcards (filter out empty rows)
                const cards: FlashcardItem[] = rawData
                    .slice(1)
                    .filter(row => row.some(cell => cell.trim() !== ''))
                    .map(data => ({ data, difficulty: 0, seen: false, masteredOnFirstTry: false }))

                return { headers, cards, title }
            }
        }
    } catch (error) {
        console.error('Error loading session data:', error)
    }
    return null
}

// Calculate max difficulty: largest n where 2^n <= data.length
function calculateMaxDifficulty(dataLength: number): number {
    if (dataLength <= 1) return 0
    return Math.floor(Math.log2(dataLength))
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



interface FlashcardStudyProps {
    initialData: SessionData
    sessionId: string
}

function FlashcardStudy({ initialData, sessionId }: FlashcardStudyProps) {
    // Update lastTimeSaved when entering learn mode
    useEffect(() => {
        updateLastAccessed(sessionId);
    }, [sessionId]);

    // State for flashcard deck
    const [deck, setDeck] = useState<FlashcardItem[]>(initialData.cards)
    const headers = initialData.headers
    const title = initialData.title

    // State for column selection (which columns are questions vs answers)
    const [questionColumns, setQuestionColumns] = useState<Set<number>>(new Set([0]))
    const [answerColumns, setAnswerColumns] = useState<Set<number>>(new Set([1]))

    // State for learning mode
    const [learningMode, setLearningMode] = useState<'spaced' | 'random' | 'sequential'>('spaced')

    // State for showing/hiding the answer
    const [showAnswer, setShowAnswer] = useState(false)

    // State for keyboard shortcut visual feedback
    const [activeKey, setActiveKey] = useState<string | null>(null)

    // State for showing banned cards modal
    const [showBanList, setShowBanList] = useState(false)

    // State for navigation history (stores deck snapshots for going back)
    const [cardHistory, setCardHistory] = useState<FlashcardItem[][]>([])
    const [historyIndex, setHistoryIndex] = useState(-1)

    // State for display mode (grid vs unified)
    const [displayMode, setDisplayMode] = useState<'grid' | 'unified'>('grid')

    // Voice mode state
    const [voiceEnabled, setVoiceEnabled] = useState(false)
    const [availableLanguages, setAvailableLanguages] = useState<{ code: string; name: string }[]>([])
    const [selectedLanguage, setSelectedLanguage] = useState<string>('en')
    const [isSpeaking, setIsSpeaking] = useState(false)
    const lastSpokenCardRef = useRef<string | null>(null)
    const lastSpokenSideRef = useRef<'question' | 'answer' | null>(null)
    const currentAudioRef = useRef<HTMLAudioElement | null>(null)

    // Calculate max difficulty based on deck size
    const maxDifficulty = useMemo(() => calculateMaxDifficulty(deck.length), [deck.length])

    // Get the current card (first item in deck)
    const currentCard = deck.length > 0 ? deck[0] : null

    // Load available languages for TTS
    useEffect(() => {
        authFetch('/api/tts/languages')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.languages) {
                    setAvailableLanguages(data.languages)
                }
            })
            .catch(err => console.error('Failed to load TTS languages:', err))
    }, [])

    // Speech synthesis function using Google Translate TTS API
    const speakText = useCallback((text: string) => {
        if (!voiceEnabled || !text.trim()) return

        // Stop any currently playing audio
        if (currentAudioRef.current) {
            currentAudioRef.current.pause()
            currentAudioRef.current = null
        }

        // Remove image markers and clean up text
        const cleanText = text.replace(/\|\|\|IMG:[^|]+\|\|\|/g, '').trim()
        if (!cleanText) return

        setIsSpeaking(true)

        // Create audio element and play from our TTS API
        const audio = new Audio(`/api/tts/speak?text=${encodeURIComponent(cleanText)}&lang=${selectedLanguage}`)
        currentAudioRef.current = audio

        audio.onended = () => {
            setIsSpeaking(false)
            currentAudioRef.current = null
        }
        audio.onerror = () => {
            setIsSpeaking(false)
            currentAudioRef.current = null
            console.error('TTS audio playback failed')
        }

        audio.play().catch(err => {
            setIsSpeaking(false)
            currentAudioRef.current = null
            console.error('TTS audio play error:', err)
        })
    }, [voiceEnabled, selectedLanguage])

    // Get text content from columns for speaking
    const getColumnText = useCallback((columns: Set<number>, cardData: string[]) => {
        return Array.from(columns)
            .map(colIndex => {
                const { text } = parseCellContent(cardData[colIndex] || '')
                return text
            })
            .filter(t => t.trim())
            .join('. ')
    }, [])

    // Speak when card changes (new card)
    useEffect(() => {
        if (!voiceEnabled || !currentCard) return

        const cardId = currentCard.data.join('|')

        // Only speak if this is a new card
        if (lastSpokenCardRef.current !== cardId) {
            // New card - speak question
            lastSpokenCardRef.current = cardId
            lastSpokenSideRef.current = 'question'
            const textToSpeak = getColumnText(questionColumns, currentCard.data)
            speakText(textToSpeak)
        }
    }, [voiceEnabled, currentCard, questionColumns, getColumnText, speakText, showAnswer])

    // Speak when card flips to answer
    useEffect(() => {
        if (!voiceEnabled || !currentCard) return

        const cardId = currentCard.data.join('|')

        if (showAnswer && lastSpokenSideRef.current !== 'answer' && lastSpokenCardRef.current === cardId) {
            // Card just flipped to answer
            lastSpokenSideRef.current = 'answer'
            const textToSpeak = getColumnText(answerColumns, currentCard.data)
            speakText(textToSpeak)
        } else if (!showAnswer && lastSpokenSideRef.current === 'answer') {
            // Reset when flipped back to question
            lastSpokenSideRef.current = 'question'
        }
    }, [voiceEnabled, currentCard, showAnswer, answerColumns, getColumnText, speakText])

    // Stop speaking when voice mode is disabled
    useEffect(() => {
        if (!voiceEnabled) {
            if (currentAudioRef.current) {
                currentAudioRef.current.pause()
                currentAudioRef.current = null
            }
            setIsSpeaking(false)
        }
    }, [voiceEnabled])

    // Toggle a column between question/answer/neither
    const toggleQuestionColumn = (colIndex: number) => {
        const newQuestionCols = new Set(questionColumns)
        const newAnswerCols = new Set(answerColumns)

        if (questionColumns.has(colIndex)) {
            newQuestionCols.delete(colIndex)
        } else {
            newQuestionCols.add(colIndex)
            newAnswerCols.delete(colIndex)
        }

        setQuestionColumns(newQuestionCols)
        setAnswerColumns(newAnswerCols)
    }

    const toggleAnswerColumn = (colIndex: number) => {
        const newQuestionCols = new Set(questionColumns)
        const newAnswerCols = new Set(answerColumns)

        if (answerColumns.has(colIndex)) {
            newAnswerCols.delete(colIndex)
        } else {
            newAnswerCols.add(colIndex)
            newQuestionCols.delete(colIndex)
        }

        setQuestionColumns(newQuestionCols)
        setAnswerColumns(newAnswerCols)
    }

    const handleLearningModeChange = (mode: 'spaced' | 'random' | 'sequential') => {
        setLearningMode(mode)
        // Reset deck with fresh cards when switching modes
        const freshDeck: FlashcardItem[] = initialData.cards.map(card => ({
            ...card,
            difficulty: 0,
            seen: false,
            masteredOnFirstTry: false
        }))
        // Shuffle for spaced and random modes, keep order for sequential
        if (mode === 'sequential') {
            setDeck(freshDeck)
        } else {
            setDeck(shuffleArray(freshDeck))
        }
        // Reset all state
        setShowAnswer(false)
        setCardHistory([])
        setHistoryIndex(-1)
    }

    // Ban all correct cards (cards with difficulty 0 that have been seen)
    const banCorrectCards = useCallback(() => {
        setDeck(prevDeck => prevDeck.map(item =>
            item.difficulty === 0 && item.seen ? { ...item, difficulty: -1 } : item
        ))
    }, [])

    // Helper function to insert a card at a random position in the deck
    const insertAtRandomPosition = (deckWithoutCard: FlashcardItem[], card: FlashcardItem): FlashcardItem[] => {
        const randomPosition = Math.floor(Math.random() * (deckWithoutCard.length + 1))
        const newDeck = [...deckWithoutCard]
        newDeck.splice(randomPosition, 0, card)
        return newDeck
    }

    // Handle "Correct" button click
    const handleCorrect = useCallback(() => {
        if (!currentCard || deck.length === 0) return

        // Save to history before modifying
        setCardHistory(prev => [...prev.slice(0, historyIndex + 1), deck])
        setHistoryIndex(prev => prev + 1)

        const newDeck = [...deck]
        const item = { ...newDeck[0] }

        // Check if this is the first time seeing this card
        const isFirstAttempt = !item.seen
        item.seen = true

        // If marked correct on first attempt, track it
        if (isFirstAttempt) {
            item.masteredOnFirstTry = true
        }

        // Update difficulty
        if (item.difficulty > 0) {
            item.difficulty = Math.max(0, item.difficulty - 1)
        }

        // Remove card from front
        newDeck.shift()

        // Position card based on learning mode
        if (learningMode === 'random') {
            // Random mode: insert at random position
            const finalDeck = insertAtRandomPosition(newDeck, item)
            setDeck(finalDeck)
        } else if (learningMode === 'sequential') {
            // Sequential mode: always move to end
            newDeck.push(item)
            setDeck(newDeck)
        } else {
            // Spaced mode: use spaced repetition algorithm
            if (item.difficulty === 0) {
                newDeck.push(item)
            } else {
                const moveBackPositions = Math.pow(2, maxDifficulty - item.difficulty)
                const insertPosition = Math.min(moveBackPositions, newDeck.length)
                newDeck.splice(insertPosition, 0, item)
            }
            setDeck(newDeck)
        }

        setShowAnswer(false)
    }, [currentCard, deck, maxDifficulty, historyIndex, learningMode])

    // Handle "Incorrect" button click
    const handleIncorrect = useCallback(() => {
        if (!currentCard || deck.length === 0) return

        // Save to history before modifying
        setCardHistory(prev => [...prev.slice(0, historyIndex + 1), deck])
        setHistoryIndex(prev => prev + 1)

        const newDeck = [...deck]
        const item = { ...newDeck[0] }

        item.seen = true
        item.masteredOnFirstTry = false
        item.difficulty = maxDifficulty

        // Remove card from front
        newDeck.shift()

        // Position card based on learning mode
        if (learningMode === 'random') {
            // Random mode: insert at random position
            const finalDeck = insertAtRandomPosition(newDeck, item)
            setDeck(finalDeck)
        } else if (learningMode === 'sequential') {
            // Sequential mode: always move to end
            newDeck.push(item)
            setDeck(newDeck)
        } else {
            // Spaced mode: incorrect cards go back 2 positions
            const moveBackPositions = 2
            const insertPosition = Math.min(moveBackPositions, newDeck.length)
            newDeck.splice(insertPosition, 0, item)
            setDeck(newDeck)
        }

        setShowAnswer(false)
    }, [currentCard, deck, maxDifficulty, historyIndex, learningMode])

    // Handle "Unsure" button click - sets difficulty to maxDifficulty - 2
    const handleUnsure = useCallback(() => {
        if (!currentCard || deck.length === 0) return

        // Save to history before modifying
        setCardHistory(prev => [...prev.slice(0, historyIndex + 1), deck])
        setHistoryIndex(prev => prev + 1)

        const newDeck = [...deck]
        const item = { ...newDeck[0] }

        item.seen = true
        item.masteredOnFirstTry = false
        // Set difficulty to max - 2, but at least 0
        item.difficulty = Math.max(0, maxDifficulty - 2)

        // Remove card from front
        newDeck.shift()

        // Position card based on learning mode
        if (learningMode === 'random') {
            // Random mode: insert at random position
            const finalDeck = insertAtRandomPosition(newDeck, item)
            setDeck(finalDeck)
        } else if (learningMode === 'sequential') {
            // Sequential mode: always move to end
            newDeck.push(item)
            setDeck(newDeck)
        } else {
            // Spaced mode: use spaced repetition algorithm
            if (item.difficulty === 0) {
                newDeck.push(item)
            } else {
                const moveBackPositions = Math.pow(2, maxDifficulty - item.difficulty)
                const insertPosition = Math.min(moveBackPositions, newDeck.length)
                newDeck.splice(insertPosition, 0, item)
            }
            setDeck(newDeck)
        }

        setShowAnswer(false)
    }, [currentCard, deck, maxDifficulty, historyIndex, learningMode])

    // Handle "Ban" button click - sets difficulty to -1
    const handleBan = useCallback(() => {
        if (!currentCard || deck.length === 0) return

        // Save to history before modifying
        setCardHistory(prev => [...prev.slice(0, historyIndex + 1), deck])
        setHistoryIndex(prev => prev + 1)

        const newDeck = [...deck]
        const item = { ...newDeck[0] }

        item.difficulty = -1 // Banned

        // Move banned card to end of deck
        newDeck.shift()
        newDeck.push(item)

        setDeck(newDeck)
        setShowAnswer(false)
    }, [currentCard, deck, historyIndex])

    // Unban a card by index
    const handleUnban = useCallback((cardIndex: number) => {
        const newDeck = [...deck]
        const bannedCards = newDeck.filter(item => item.difficulty === -1)
        const targetCard = bannedCards[cardIndex]

        if (targetCard) {
            const deckIndex = newDeck.findIndex(item => item === targetCard)
            if (deckIndex !== -1) {
                newDeck[deckIndex] = { ...newDeck[deckIndex], difficulty: 0 }
                setDeck(newDeck)
            }
        }
    }, [deck])

    // Restart session: reset all difficulties to 0
    const handleRestart = useCallback(() => {
        const resetDeck = initialData.cards.map(item => ({ ...item, difficulty: 0 }))
        setDeck(shuffleArray(resetDeck))
        setShowAnswer(false)
    }, [initialData.cards])

    // Shuffle the deck
    const handleShuffle = useCallback(() => {
        setDeck(shuffleArray(deck))
        setShowAnswer(false)
    }, [deck])

    // Toggle answer visibility
    const handleToggleAnswer = useCallback(() => {
        setShowAnswer(prev => !prev)
    }, [])

    // Navigate to previous card (go back in history)
    const handlePrevCard = useCallback(() => {
        if (historyIndex < 0 || cardHistory.length === 0) return

        if (historyIndex >= 0) {
            // Restore previous deck state
            setDeck(cardHistory[historyIndex])
            setHistoryIndex(prev => prev - 1)
            setShowAnswer(false)
        }
    }, [historyIndex, cardHistory])

    // Navigate to next card (without modifying difficulty)
    const handleNextCard = useCallback(() => {
        if (!currentCard || deck.length <= 1) return
        if (currentCard.difficulty === -1) return // Skip banned cards
        // Save current state to history
        setCardHistory(prev => [...prev.slice(0, historyIndex + 1), deck])
        setHistoryIndex(prev => prev + 1)

        // Rotate deck: move first card to end
        const newDeck = [...deck.slice(1), deck[0]]
        setDeck(newDeck)
        setShowAnswer(false)
    }, [currentCard, deck, historyIndex])

    // Check if we can go back
    const canGoBack = historyIndex >= 0

    // Auto-skip banned cards - if current card is banned, cycle to next
    useEffect(() => {
        if (currentCard && currentCard.difficulty === -1) {
            // Find the next non-banned card
            const nonBannedIndex = deck.findIndex(item => item.difficulty !== -1)
            if (nonBannedIndex > 0) {
                // Rotate deck so non-banned card is first
                const newDeck = [...deck.slice(nonBannedIndex), ...deck.slice(0, nonBannedIndex)]
                setDeck(newDeck)
                setShowAnswer(false)
            }
        }
    }, [currentCard, deck])

    const difficultyToColor = (difficulty: number) => {
        const growthFactor = 100
        const redZero = 1.33696676691; //value gets red graph to 0 at 1
        const greenZero = 1.14483213353; //value gets green graph to 20 at 0 (red is darker than green)
        const xTransform = 0.1;
        const maxRGBLevel = 255;
        const difficultyPercent = difficulty / (maxDifficulty || 1)
        const r = -1 * Math.pow(growthFactor, redZero * (1 - difficultyPercent - xTransform)) + maxRGBLevel
        const g = -1 * Math.pow(growthFactor, greenZero * (-1 + difficultyPercent + xTransform + 1)) + maxRGBLevel + 140
        const b = 140
        console.log(r + " " + g + " " + b);
        return `${Math.min(255, Math.max(0, r))}, ${Math.min(255, Math.max(0, g))}, ${Math.min(255, Math.max(0, b))}`
    }


    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger if user is typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return
            }

            const key = e.key.toLowerCase()

            // Show visual feedback
            const showFeedback = (keyName: string) => {
                setActiveKey(keyName)
                setTimeout(() => setActiveKey(null), 150)
            }

            // Space: Toggle answer visibility
            if (e.code === 'Space') {
                e.preventDefault()
                showFeedback('Space')
                handleToggleAnswer()
                return
            }

            // D or Tab: Correct (when answer is visible)
            if ((key === 'd' || e.code === 'Tab') && showAnswer) {
                e.preventDefault()
                showFeedback(key === 'd' ? 'D' : 'Tab')
                handleCorrect()
                return
            }

            // S: Unsure (when answer is visible)
            if (key === 's' && showAnswer) {
                e.preventDefault()
                showFeedback('S')
                handleUnsure()
                return
            }

            // A or Shift: Incorrect (when answer is visible)
            if ((key === 'a' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') && showAnswer) {
                e.preventDefault()
                showFeedback(key === 'a' ? 'A' : 'Shift')
                handleIncorrect()
                return
            }

            // X: Ban (when answer is visible)
            if (key === 'x' && showAnswer) {
                e.preventDefault()
                showFeedback('X')
                handleBan()
                return
            }

            // Q: Shuffle
            if (key === 'q') {
                e.preventDefault()
                showFeedback('Q')
                handleShuffle()
                return
            }

            // R: Restart
            if (key === 'r') {
                e.preventDefault()
                showFeedback('R')
                handleRestart()
                return
            }

            // Left Arrow: Previous card
            if (e.code === 'ArrowLeft' && canGoBack) {
                e.preventDefault()
                showFeedback('←')
                handlePrevCard()
                return
            }

            // Right Arrow: Next card
            if (e.code === 'ArrowRight') {
                e.preventDefault()
                showFeedback('→')
                handleNextCard()
                return
            }

            // V: Toggle voice mode
            if (key === 'v') {
                e.preventDefault()
                showFeedback('V')
                setVoiceEnabled(prev => !prev)
                return
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [showAnswer, handleCorrect, handleIncorrect, handleUnsure, handleBan, handleShuffle, handleRestart, handleToggleAnswer, handlePrevCard, handleNextCard, canGoBack])

    // Calculate progress stats
    const bannedCards = deck.filter(item => item.difficulty === -1)
    const activeCards = deck.filter(item => item.difficulty !== -1)
    // Mastered: cards that have been seen AND have difficulty 0 (either correct on first try, or worked through all difficulties)
    const masteredCount = activeCards.filter(item => item.seen && item.difficulty === 0).length
    // Learning: cards that have been seen but still have difficulty > 0
    const learningCount = activeCards.filter(item => item.seen && item.difficulty > 0).length
    // Not seen yet: cards that haven't been answered
    const notSeenCount = activeCards.filter(item => !item.seen).length

    // Handle case where all non-banned cards have been processed
    const hasActiveCards = activeCards.length > 0


    if (!hasActiveCards && bannedCards.length > 0) {
        // All cards are banned
        return (
            <div className="learn_container">
                <Header />
                <h1>Learn</h1>
                <p>All cards have been banned!</p>
                <button className="learn_btn secondary" onClick={() => setShowBanList(true)}>
                    View Banned Cards ({bannedCards.length})
                </button>
                <a href="/learn" className="learn_btn secondary" style={{ marginLeft: '8px' }}>
                    ← Back
                </a>

                {/* Ban List Modal */}
                {showBanList && (
                    <div className="learn_modal_overlay" onClick={() => setShowBanList(false)}>
                        <div className="learn_modal" onClick={e => e.stopPropagation()}>
                            <h3>Banned Cards ({bannedCards.length})</h3>
                            <div className="learn_ban_list">
                                {bannedCards.map((card, i) => (
                                    <div key={i} className="learn_ban_item">
                                        <span className="learn_ban_preview">
                                            {card.data.slice(0, 2).join(' / ')}
                                        </span>
                                        <button className="learn_unban_btn" onClick={() => handleUnban(i)}>
                                            Unban
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button className="learn_btn secondary" onClick={() => setShowBanList(false)}>
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    if (deck.length === 0) {
        return (
            <>
                <Header />
                <h1 className="learn_title">{title}</h1>
                <p>No flashcards available. The session data may be empty.</p>
                <a href="/learn">← Back to sessions</a>
            </>
        )
    }

    return (
        <div className="learn_container">
            <Header />
            <h1 className="learn_title">{title}</h1>

            {/* Controls Row - Learning Mode and Display Mode on same line */}
            <div className="learn_controls_row">
                {/* Learning Mode Segmented Control */}
                <div className="learn_segmented_control">
                    <button
                        className={`learn_segment ${learningMode === 'spaced' ? 'active' : ''}`}
                        onClick={() => handleLearningModeChange('spaced')}
                    >
                        Spaced
                    </button>
                    <button
                        className={`learn_segment ${learningMode === 'random' ? 'active' : ''}`}
                        onClick={() => handleLearningModeChange('random')}
                    >
                        Random
                    </button>
                    <button
                        className={`learn_segment ${learningMode === 'sequential' ? 'active' : ''}`}
                        onClick={() => handleLearningModeChange('sequential')}
                    >
                        Sequential
                    </button>
                </div>

                {/* Display Mode Segmented Control */}
                <div className="learn_segmented_control">
                    <button
                        className={`learn_segment ${displayMode === 'grid' ? 'active' : ''}`}
                        onClick={() => setDisplayMode('grid')}
                        title="Multi-Card Grid View"
                    >
                        Grid
                    </button>
                    <button
                        className={`learn_segment ${displayMode === 'unified' ? 'active' : ''}`}
                        onClick={() => setDisplayMode('unified')}
                        title="Single Unified Card View"
                    >
                        Compact
                    </button>
                </div>
            </div>

            {/* Column Selection Controls */}
            <div className="learn_column_controls">
                <div className="learn_column_grid">
                    {headers.map((header, i) => (
                        <div key={i} className="learn_column_option">
                            <span className="learn_column_label">{header}</span>
                            <div className="learn_column_buttons">
                                <button
                                    className={`learn_col_btn ${questionColumns.has(i) ? 'active question' : ''}`}
                                    onClick={() => toggleQuestionColumn(i)}
                                >
                                    Q
                                </button>
                                <button
                                    className={`learn_col_btn ${answerColumns.has(i) ? 'active answer' : ''}`}
                                    onClick={() => toggleAnswerColumn(i)}
                                >
                                    A
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Progress Stats */}
            <div className="learn_progress">
                <span className="learn_progress_stat">Not Seen: {notSeenCount}</span>
                <span className="learn_progress_stat">Learning: {learningCount}</span>
                <span className="learn_progress_stat">Mastered: {masteredCount}</span>
                <span
                    className={`learn_banned_stat ${bannedCards.length > 0 ? 'clickable' : ''} "learn_progress_stat"`}
                    onClick={() => bannedCards.length > 0 && setShowBanList(true)}
                >
                    Banned: {bannedCards.length}
                </span>
                <span
                    style={{ backgroundColor: `rgb(${difficultyToColor(currentCard?.difficulty ?? 0)})` }}
                    className = "learn_progress_stat"
                >
                    Difficulty: {currentCard?.difficulty ?? 0}
                </span>
                <button
                    className="learn_ban_correct_btn"
                    onClick={banCorrectCards}
                    title="Ban all cards you've gotten correct (mastered)"
                >
                    Ban Correct
                </button>
            </div>

            
            {/* Flashcard with Navigation Arrows */}
            <div className="learn_flashcard_nav_container">
                {/* Left Arrow - Previous Card */}
                <button
                    className={`learn_nav_arrow left ${!canGoBack ? 'disabled' : ''} ${activeKey === '←' ? 'active' : ''}`}
                    onClick={handlePrevCard}
                    disabled={!canGoBack}
                    title="Previous card (←)"
                >
                    ←
                </button>

                {/* Centered Flashcard - Click anywhere to flip */}
                <div className="learn_flashcard_wrapper">
                    <div
                        className={`learn_flashcard_card ${showAnswer ? 'flipped' : ''}`}
                        onClick={handleToggleAnswer}
                    >
                        {/* Front - Question */}
                        <div className="learn_card_face learn_card_front">
                            <div className="learn_card_section question">
                                <div className={`learn_cards_grid ${displayMode === 'unified' && questionColumns.size > 1 ? 'unified_mode' : ''}`}>
                                    {(() => {
                                        const questionCols = Array.from(questionColumns);

                                        // Only render cards for actual question columns (no empty placeholders)
                                        return questionCols.map((colIndex, idx) => {
                                            return (
                                                <div key={idx} className="learn_individual_card">
                                                    <div className="learn_card_field">
                                                        <span className="learn_card_label">{headers[colIndex]}</span>
                                                        <div className="learn_card_value">
                                                            {renderCellContent(currentCard?.data[colIndex] || '')}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* Back - Answer */}
                        <div className="learn_card_face learn_card_back">
                            <div className="learn_card_section answer">
                                <div className={`learn_cards_grid ${displayMode === 'unified' && answerColumns.size > 1 ? 'unified_mode' : ''}`}>
                                    {(() => {
                                        const answerCols = Array.from(answerColumns);

                                        // Only render cards for actual answer columns (no empty placeholders)
                                        return answerCols.map((colIndex, idx) => {
                                            return (
                                                <div key={idx} className="learn_individual_card">
                                                    <div className="learn_card_field">
                                                        <span className="learn_card_label">{headers[colIndex]}</span>
                                                        <div className="learn_card_value">
                                                            {renderCellContent(currentCard?.data[colIndex] || '')}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Arrow - Next Card */}
                <button
                    className={`learn_nav_arrow right ${activeKey === '→' ? 'active' : ''}`}
                    onClick={handleNextCard}
                    title="Next card (→)"
                >
                    →
                </button>
            </div>

            {/* Mobile Navigation Arrows - shown below card on mobile */}
            <div className="learn_mobile_nav">
                <button
                    className={`learn_nav_arrow ${!canGoBack ? 'disabled' : ''} ${activeKey === '←' ? 'active' : ''}`}
                    onClick={handlePrevCard}
                    disabled={!canGoBack}
                >
                    ←
                </button>
                <span className="learn_mobile_nav_hint">Swipe or tap arrows</span>
                <button
                    className={`learn_nav_arrow ${activeKey === '→' ? 'active' : ''}`}
                    onClick={handleNextCard}
                >
                    →
                </button>
            </div>

            {/* Response Buttons */}
            <div className="learn_response_buttons">
                {showAnswer ? (
                    <>
                        <button
                            className={`learn_btn incorrect ${activeKey === 'A' || activeKey === 'Shift' ? 'active' : ''}`}
                            onClick={handleIncorrect}
                        >
                            ✗ Incorrect
                            <span className="learn_shortcut_hint">A</span>
                        </button>
                        <button
                            className={`learn_btn unsure ${activeKey === 'S' ? 'active' : ''}`}
                            onClick={handleUnsure}
                        >
                            ~ Unsure
                            <span className="learn_shortcut_hint">S</span>
                        </button>
                        <button
                            className={`learn_btn correct ${activeKey === 'D' || activeKey === 'Tab' ? 'active' : ''}`}
                            onClick={handleCorrect}
                        >
                            ✓ Correct
                            <span className="learn_shortcut_hint">D</span>
                        </button>
                        <button
                            className={`learn_btn ban ${activeKey === 'X' ? 'active' : ''}`}
                            onClick={handleBan}
                        >
                            🚫 Ban
                            <span className="learn_shortcut_hint">X</span>
                        </button>
                    </>
                ) : (
                    <p className="learn_hint">Press Space to flip the card</p>
                )}
            </div>

            {/* Control Buttons */}
            <div className="learn_control_buttons">
                <button
                    className={`learn_btn secondary ${activeKey === 'Q' ? 'active' : ''}`}
                    onClick={handleShuffle}
                >
                    🔀 Shuffle
                    <span className="learn_shortcut_hint">Q</span>
                </button>
                <button
                    className={`learn_btn secondary ${activeKey === 'R' ? 'active' : ''}`}
                    onClick={handleRestart}
                >
                    🔄 Restart
                    <span className="learn_shortcut_hint">R</span>
                </button>
                <a href="/learn" className="learn_btn secondary">
                    ← Back
                </a>
            </div>

            {/* Voice Mode Controls */}
            <div className="learn_voice_controls">
                <button
                    className={`learn_voice_toggle ${voiceEnabled ? 'active' : ''} ${isSpeaking ? 'speaking' : ''}`}
                    onClick={() => setVoiceEnabled(!voiceEnabled)}
                    title={voiceEnabled ? 'Disable voice mode' : 'Enable voice mode'}
                >
                    {isSpeaking ? '🔊' : voiceEnabled ? '🔈' : '🔇'}
                    <span>{voiceEnabled ? 'Voice On' : 'Voice Off'}</span>
                </button>

                {voiceEnabled && (
                    <div className="learn_voice_selector">
                        <label htmlFor="language-select">Language:</label>
                        <select
                            id="language-select"
                            value={selectedLanguage}
                            onChange={(e) => setSelectedLanguage(e.target.value)}
                        >
                            {availableLanguages.map(lang => (
                                <option key={lang.code} value={lang.code}>
                                    {lang.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {voiceEnabled && (
                    <button
                        className="learn_voice_test"
                        onClick={() => {
                            if (currentCard) {
                                const textToSpeak = getColumnText(
                                    showAnswer ? answerColumns : questionColumns,
                                    currentCard.data
                                )
                                speakText(textToSpeak)
                            }
                        }}
                        title="Read current card aloud"
                    >
                        🗣️ Read Card
                    </button>
                )}
            </div>

            {/* Keyboard Shortcuts Legend */}
            <div className="learn_shortcuts_legend">
                <h4>⌨️ Keyboard Shortcuts</h4>
                <div className="learn_shortcuts_grid">
                    <div className="learn_shortcut_item">
                        <kbd>Space</kbd>
                        <span>Flip card</span>
                    </div>
                    <div className="learn_shortcut_item">
                        <kbd>←</kbd>
                        <span>Previous</span>
                    </div>
                    <div className="learn_shortcut_item">
                        <kbd>→</kbd>
                        <span>Next</span>
                    </div>
                    <div className="learn_shortcut_item">
                        <kbd>A</kbd> / <kbd>Shift</kbd>
                        <span>Incorrect</span>
                    </div>
                    <div className="learn_shortcut_item">
                        <kbd>S</kbd>
                        <span>Unsure</span>
                    </div>
                    <div className="learn_shortcut_item">
                        <kbd>D</kbd> / <kbd>Tab</kbd>
                        <span>Correct</span>
                    </div>
                    <div className="learn_shortcut_item">
                        <kbd>X</kbd>
                        <span>Ban card</span>
                    </div>
                    <div className="learn_shortcut_item">
                        <kbd>Q</kbd>
                        <span>Shuffle</span>
                    </div>
                    <div className="learn_shortcut_item">
                        <kbd>R</kbd>
                        <span>Restart</span>
                    </div>
                    <div className="learn_shortcut_item">
                        <kbd>V</kbd>
                        <span>Voice mode</span>
                    </div>
                </div>
            </div>

            {/* Ban List Modal */}
            {showBanList && (
                <div className="learn_modal_overlay" onClick={() => setShowBanList(false)}>
                    <div className="learn_modal" onClick={e => e.stopPropagation()}>
                        <h3>🚫 Banned Cards ({bannedCards.length})</h3>
                        {bannedCards.length === 0 ? (
                            <p className="learn_ban_empty">No banned cards</p>
                        ) : (
                            <div className="learn_ban_list">
                                {bannedCards.map((card, i) => (
                                    <div key={i} className="learn_ban_item">
                                        <span className="learn_ban_preview">
                                            {card.data.slice(0, 2).join(' / ')}
                                        </span>
                                        <button className="learn_unban_btn" onClick={() => handleUnban(i)}>
                                            Unban
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <button className="learn_btn secondary" onClick={() => setShowBanList(false)}>
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Debug info */}
            <details className="learn_debug">
                <summary>Debug Info</summary>
                <pre>{JSON.stringify(deck.slice(0, 5), null, 2)}</pre>
            </details>
        </div>
    )
}

// ============ Main Learn Component ============

function Learn() {
    const { sessionId } = useParams<{ sessionId?: string }>()
    const { user } = useAuth()
    const [sessions, setSessions] = useState<LearnSessionInfo[]>([])
    const [sessionData, setSessionData] = useState<SessionData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [filter, setFilter] = useState<'all' | 'sheets' | 'diagrams'>('all')
    const [searchQuery, setSearchQuery] = useState('')

    // Filter sessions based on selected filter and search query (must be before any returns)
    const filteredSessions = useMemo(() => {
        let result = sessions

        // Filter by type
        if (filter !== 'all') {
            result = result.filter(s => s.type === (filter === 'sheets' ? 'sheet' : 'diagram'))
        }

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim()
            result = result.filter(s => s.title.toLowerCase().includes(query))
        }

        return result
    }, [sessions, filter, searchQuery])

    // Count sessions by type
    const sheetCount = useMemo(() => sessions.filter(s => s.type === 'sheet').length, [sessions])
    const diagramCount = useMemo(() => sessions.filter(s => s.type === 'diagram').length, [sessions])

    // Fetch sessions list when component mounts (no sessionId)
    useEffect(() => {
        if (!sessionId && user) {
            const fetchSessions = async () => {
                setLoading(true)
                const data = await getSessionsFromAPI(user.id)
                setSessions(data)
                setLoading(false)
            }
            fetchSessions()
        }
    }, [sessionId, user])

    // Fetch specific session data when sessionId is provided
    useEffect(() => {
        if (sessionId) {
            const fetchSessionData = async () => {
                setLoading(true)
                setError(null)
                const data = await loadSessionData(sessionId)

                if (!data || data.cards.length === 0) {
                    setError('No data found for this session')
                } else {
                    setSessionData(data)
                }
                setLoading(false)
            }
            fetchSessionData()
        }
    }, [sessionId])

    // If we have a sessionId, show flashcard study or error
    if (sessionId) {
        if (loading) {
            return (
                <>
                    <Header />
                    <h1>Learn</h1>
                    <p>Loading session data...</p>
                </>
            )
        }

        if (error || !sessionData) {
            return (
                <>
                    <Header />
                    <h1>Learn</h1>
                    <p>{error || 'No data found for session: ' + sessionId}</p>
                    <a href="/learn">← Back to sessions</a>
                </>
            )
        }

        return <FlashcardStudy initialData={sessionData} sessionId={sessionId} />
    }

    // No sessionId - show list of available sessions
    if (!user) {
        return (
            <>
                <Header />
                <h1>Learn</h1>
                <p>Please <a href="/login">log in</a> to see your sessions.</p>
            </>
        )
    }

    if (loading) {
        return (
            <>
                <Header />
                <h1>Learn</h1>
                <p>Loading your sessions...</p>
            </>
        )
    }

    return (
        <div className="learn_page_container">
            <Header />
            <div className="learn_page_header">
                <h1>Learn</h1>
                <p className="learn_page_subtitle">Select a session to start learning</p>
            </div>

            {sessions.length === 0 ? (
                <div className="learn_empty_state">
                    <p>No learnable sessions found.</p>
                    <p>Create a <a href="/sheets">sheet</a> or add labels to a <a href="/diagrams">diagram</a> to get started!</p>
                </div>
            ) : (
                <>
                    {/* Search and filter controls */}
                    <div className="learn_controls">
                        {/* Search input */}
                        <div className="learn_search">
                            <input
                                type="text"
                                placeholder="Search sessions..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="learn_search_input"
                            />
                            {searchQuery && (
                                <button
                                    className="learn_search_clear"
                                    onClick={() => setSearchQuery('')}
                                >
                                    ×
                                </button>
                            )}
                        </div>

                        {/* Filter buttons */}
                        <div className="learn_filter_buttons">
                            <button
                                className={filter === 'all' ? 'active' : ''}
                                onClick={() => setFilter('all')}
                            >
                                All ({sessions.length})
                            </button>
                            <button
                                className={filter === 'sheets' ? 'active' : ''}
                                onClick={() => setFilter('sheets')}
                            >
                                <SheetIcon size={14} /> Sheets ({sheetCount})
                            </button>
                            <button
                                className={filter === 'diagrams' ? 'active' : ''}
                                onClick={() => setFilter('diagrams')}
                            >
                                <DiagramIcon size={14} color="#a855f7" /> Diagrams ({diagramCount})
                            </button>
                        </div>
                    </div>

                    {/* Session list */}
                    <div className="learn_sessions_list">
                        {filteredSessions.length === 0 ? (
                            <div className="learn_no_results">
                                No sessions match your search.
                            </div>
                        ) : (
                            filteredSessions.map((session) => (
                                <a
                                    key={session.storageKey}
                                    href={session.type === 'sheet'
                                        ? `/learn/${session.sessionId}`
                                        : `/learn/diagram/${session.sessionId}`}
                                    className={`learn_session_card ${session.type}`}
                                >
                                    <div className="learn_session_icon">
                                        {session.type === 'sheet'
                                            ? <SheetIcon size={20} />
                                            : <DiagramIcon size={20} color="#a855f7" />}
                                    </div>
                                    <div className="learn_session_info">
                                        <span className="learn_session_title">{session.title}</span>
                                        <span className="learn_session_meta">
                                            {session.type === 'sheet' ? 'Flashcards' : `${session.labelCount} labels`}
                                            {session.lastTimeSaved && (
                                                <> · Last opened {new Date(session.lastTimeSaved).toLocaleDateString()}</>
                                            )}
                                        </span>
                                    </div>
                                    <div className="learn_session_arrow">→</div>
                                </a>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    )
}

export default Learn
