import { useState, useMemo, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import './learn.css'
import Header from '../header/header.tsx'
import type { SheetInfo } from '../gaurdian.ts';
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
}

// ============ Helper Functions ============

// Get all spreadsheet sessions from localStorage
function getSessionsFromLocalStorage(): SheetInfo[] {
  const sessions: SheetInfo[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('spreadsheet_session_')) {
      const sessionId = key.replace('spreadsheet_session_', '')
      sessions.push({
        title: JSON.parse(localStorage.getItem(key) || '').title,
        storageKey: key,
        sessionId: sessionId
      })
    }
  }
  return sessions
}

// Load session data from localStorage - first row is headers, rest are cards
function loadSessionData(sessionId: string): SessionData | null {
  try {
    const storageKey = `spreadsheet_session_${sessionId}`
    const savedData = localStorage.getItem(storageKey)

    if (savedData) {
      const parsed = JSON.parse(savedData)
      let rawData: string[][] | null = null

      // Handle new format (has 'rows' property)
      if (parsed.rows && Array.isArray(parsed.rows)) {
        rawData = parsed.rows.map((row: { data: string[] }) => row.data)
      }
      // Handle legacy format (has 'grid' property)
      else if (parsed.grid && Array.isArray(parsed.grid)) {
        rawData = parsed.grid
      }

      if (rawData && rawData.length > 0) {
        // First row is headers
        const headers = rawData[0].map((h, i) => h.trim() || `Column ${i + 1}`)

        // Rest are flashcards (filter out empty rows)
        const cards: FlashcardItem[] = rawData
          .slice(1)
          .filter(row => row.some(cell => cell.trim() !== ''))
          .map(data => ({ data, difficulty: 0, seen: false, masteredOnFirstTry: false }))

        return { headers, cards }
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



// ============ Flashcard Study Component ============

interface FlashcardStudyProps {
  initialData: SessionData
  sessionId: string
}

function FlashcardStudy({ initialData, sessionId }: FlashcardStudyProps) {
  // State for flashcard deck
  const [deck, setDeck] = useState<FlashcardItem[]>(initialData.cards)
  const headers = initialData.headers

  // State for column selection (which columns are questions vs answers)
  const [questionColumns, setQuestionColumns] = useState<Set<number>>(new Set([0]))
  const [answerColumns, setAnswerColumns] = useState<Set<number>>(new Set([1]))

  // State for showing/hiding the answer
  const [showAnswer, setShowAnswer] = useState(false)

  // State for keyboard shortcut visual feedback
  const [activeKey, setActiveKey] = useState<string | null>(null)

  // State for showing banned cards modal
  const [showBanList, setShowBanList] = useState(false)

  // State for navigation history (stores deck snapshots for going back)
  const [cardHistory, setCardHistory] = useState<FlashcardItem[][]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  // Calculate max difficulty based on deck size
  const maxDifficulty = useMemo(() => calculateMaxDifficulty(deck.length), [deck.length])

  // Get the current card (first item in deck)
  const currentCard = deck.length > 0 ? deck[0] : null

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

    if (item.difficulty === 0) {
      // Already mastered: move to end
      newDeck.shift()
      newDeck.push(item)
    } else {
      // Decrease difficulty, then calculate move position
      // Cards closer to mastery (lower difficulty) move FURTHER back
      // Formula: 2^(maxDifficulty - newDifficulty)
      item.difficulty = Math.max(0, item.difficulty - 1)
      const moveBackPositions = Math.pow(2, maxDifficulty - item.difficulty)
      newDeck.shift()
      const insertPosition = Math.min(moveBackPositions, newDeck.length)
      newDeck.splice(insertPosition, 0, item)
    }

    setDeck(newDeck)
    setShowAnswer(false)
  }, [currentCard, deck, maxDifficulty, historyIndex])

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
    const moveBackPositions = 2

    newDeck.shift()
    const insertPosition = Math.min(moveBackPositions, newDeck.length)
    newDeck.splice(insertPosition, 0, item)

    setDeck(newDeck)
    setShowAnswer(false)
  }, [currentCard, deck, maxDifficulty, historyIndex])

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

    // If difficulty is 0, move to end; otherwise use spaced repetition formula
    newDeck.shift()
    if (item.difficulty === 0) {
      newDeck.push(item)
    } else {
      const moveBackPositions = Math.pow(2, maxDifficulty - item.difficulty)
      const insertPosition = Math.min(moveBackPositions, newDeck.length)
      newDeck.splice(insertPosition, 0, item)
    }

    setDeck(newDeck)
    setShowAnswer(false)
  }, [currentCard, deck, maxDifficulty, historyIndex])

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
        <h1>Learn</h1>
        <p>Session: {sessionId}</p>
        <p>No flashcards available. The session data may be empty.</p>
        <a href="/learn">← Back to sessions</a>
      </>
    )
  }

  return (
    <div className="learn_container">
      <Header />
      <h1>Learn</h1>
      <p className="learn_session_info">Session: {sessionId.substring(0, 8)}...</p>

      {/* Column Selection Controls */}
      <div className="learn_column_controls">
        <h3>Column Settings</h3>
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
        <span>Not Seen: {notSeenCount}</span>
        <span>Learning: {learningCount}</span>
        <span>Mastered: {masteredCount}</span>
        <span
          className={`learn_banned_stat ${bannedCards.length > 0 ? 'clickable' : ''}`}
          onClick={() => bannedCards.length > 0 && setShowBanList(true)}
        >
          Banned: {bannedCards.length}
        </span>
        <span>Difficulty: {currentCard?.difficulty ?? 0}</span>
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
                {currentCard?.data.map((cell, i) => (
                  questionColumns.has(i) && (
                    <div key={i} className="learn_card_field">
                      <span className="learn_card_label">{headers[i]}</span>
                      <span className="learn_card_value">
                        {cell || <span className="empty">(empty)</span>}
                      </span>
                    </div>
                  )
                ))}
              </div>
            </div>

            {/* Back - Answer */}
            <div className="learn_card_face learn_card_back">
              <div className="learn_card_section answer">
                {currentCard?.data.map((cell, i) => (
                  answerColumns.has(i) && (
                    <div key={i} className="learn_card_field">
                      <span className="learn_card_label">{headers[i]}</span>
                      <span className="learn_card_value">
                        {cell || <span className="empty">(empty)</span>}
                      </span>
                    </div>
                  )
                ))}
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
  const [sessions] = useState<SessionInfo[]>(getSessionsFromLocalStorage())

  // If we have a sessionId, load data and show flashcard study
  if (sessionId) {
    const data = loadSessionData(sessionId)

    if (!data || data.cards.length === 0) {
      return (
        <>
          <Header />
          <h1>Learn</h1>
          <p>No data found for session: {sessionId}</p>
          <a href="/learn">← Back to sessions</a>
        </>
      )
    }

    return <FlashcardStudy initialData={data} sessionId={sessionId} />
  }

  // No sessionId - show list of available sessions
  return (
    <>
      <Header />
      <h1>Learn</h1>
      <p>Select a session to learn from:</p>

      {sessions.length === 0 ? (
        <p>No sessions found. <a href="/sheets">Create a new sheet</a> first.</p>
      ) : (
        <div className="learn_sessions">
          {sessions.map((session) => (
            <div key={session.storageKey} className="learn_session_item">
              <a href={`/learn/${session.sessionId}`}>{session.sessionId}</a>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

export default Learn
