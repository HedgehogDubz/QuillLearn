import { useState, useMemo } from 'react'
import './Home.css'
import Header from '../header/header.tsx'
import type { SessionInfo } from '../gaurdian.ts'
import ModeModal from '../mode/mode.tsx'

// Extended SessionInfo to include type
type SessionWithType = SessionInfo & { type: 'sheet' | 'note' }

function getSheetsFromLocalStorage(): SessionWithType[] {
  const sheets: SessionWithType[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('spreadsheet_session_')) {
      // Extract the session ID by removing the 'spreadsheet_session_' prefix
      const sessionId = key.replace('spreadsheet_session_', '')
      const data = JSON.parse(localStorage.getItem(key) || '{}')
      sheets.push({
        title: data.title || 'Untitled Sheet',
        storageKey: key,
        sessionId: sessionId,
        lastTimeSaved: data.lastTimeSaved,
        type: 'sheet'
      })
    }
  }
  return sheets
}

function getNotesFromLocalStorage(): SessionWithType[] {
  const notes: SessionWithType[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('notes_session_')) {
      // Extract the session ID by removing the 'notes_session_' prefix
      const sessionId = key.replace('notes_session_', '')
      const noteData = JSON.parse(localStorage.getItem(key) || '{}')
      notes.push({
        title: noteData.title || 'Untitled Document',
        storageKey: key,
        sessionId: sessionId,
        lastTimeSaved: noteData.lastTimeSaved,
        type: 'note'
      })
    }
  }
  return notes
}

function Home() {
  const [sessions, setSessions] = useState<SessionWithType[]>(() => {
    // Combine sheets and notes into one array
    const allSessions = [...getSheetsFromLocalStorage(), ...getNotesFromLocalStorage()]
    // Sort by lastTimeSaved (most recent first)
    return allSessions.sort((a, b) => (b.lastTimeSaved || 0) - (a.lastTimeSaved || 0))
  })
  const [filter, setFilter] = useState<'all' | 'sheets' | 'notes'>('all')
  const [selectedSheet, setSelectedSheet] = useState<SessionWithType | null>(null)

  // Filter sessions based on selected filter
  const filteredSessions = useMemo(() => {
    if (filter === 'all') return sessions
    if (filter === 'sheets') return sessions.filter(s => s.type === 'sheet')
    return sessions.filter(s => s.type === 'note')
  }, [sessions, filter])

  const handleDelete = (e: React.MouseEvent, storageKey: string) => {
    e.stopPropagation() // Prevent opening the modal when clicking delete
    localStorage.removeItem(storageKey)
    // Update the UI by removing the deleted session from state
    setSessions(sessions.filter(session => session.storageKey !== storageKey))
  }

  const handleSessionClick = (session: SessionWithType) => {
    // Only show modal for sheets, navigate directly for notes
    if (session.type === 'sheet') {
      setSelectedSheet(session)
    } else {
      window.location.href = `/notes/${session.sessionId}`
    }
  }

  const handleCloseModal = () => {
    setSelectedSheet(null)
  }

  return (
    <>
      <Header />
      <h1>Home</h1>
      <div className="home_actions">
        <button>
          <a href="/sheets">New Sheet</a>
        </button>
        <button>
          <a href="/notes">New Note</a>
        </button>
      </div>

      {/* Filter buttons */}
      <div className="home_filter_buttons">
        <button
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className={filter === 'sheets' ? 'active' : ''}
          onClick={() => setFilter('sheets')}
        >
          Sheets
        </button>
        <button
          className={filter === 'notes' ? 'active' : ''}
          onClick={() => setFilter('notes')}
        >
          Notes
        </button>
      </div>

      {/* Unified list of sessions */}
      <h2>
        {filter === 'all' ? 'Recent' : filter === 'sheets' ? 'Sheets' : 'Notes'}
      </h2>
      {filteredSessions.length === 0 ? (
        <p>
          {filter === 'all'
            ? 'No sessions yet. Create a sheet or note to get started!'
            : filter === 'sheets'
            ? 'No sheets yet. Create one to get started!'
            : 'No notes yet. Create one to get started!'}
        </p>
      ) : (
        filteredSessions.map((session) => (
          <div key={session.storageKey} className="home_sheet_item">
            <span
              className="home_sheet_link"
              onClick={() => handleSessionClick(session)}
              style={{ cursor: 'pointer' }}
            >
              {session.type === 'sheet' ? '📊' : '📝'} {session.title}
            </span>
            <button onClick={(e) => handleDelete(e, session.storageKey)}>Delete</button>
          </div>
        ))
      )}

      {selectedSheet && (
        <ModeModal
          sessionId={selectedSheet.sessionId}
          title={selectedSheet.title}
          onClose={handleCloseModal}
        />
      )}
    </>
  )
}

export default Home
