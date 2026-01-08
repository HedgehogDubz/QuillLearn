import { useState, useMemo, useEffect } from 'react'
import './Home.css'
import Header from '../header/header.tsx'
import type { SessionInfo } from '../gaurdian.ts'
import ModeModal from '../mode/mode.tsx'
import { useAuth } from '../auth/AuthContext'

// Extended SessionInfo to include type
type SessionWithType = SessionInfo & { type: 'sheet' | 'note' }

function Home() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<SessionWithType[]>([])
  const [filter, setFilter] = useState<'all' | 'sheets' | 'notes'>('all')
  const [selectedSheet, setSelectedSheet] = useState<SessionWithType | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch sessions from API when component mounts
  useEffect(() => {
    const fetchSessions = async () => {
      if (!user) {
        setLoading(false)
        return
      }

      try {
        // Fetch sheets
        const sheetsResponse = await fetch(`/api/sheets/user/${user.id}`)
        const sheetsResult = await sheetsResponse.json()

        // Fetch notes
        const notesResponse = await fetch(`/api/notes/user/${user.id}`)
        const notesResult = await notesResponse.json()

        const sheets: SessionWithType[] = sheetsResult.success && sheetsResult.data
          ? sheetsResult.data.map((sheet: any) => ({
              title: sheet.title || 'Untitled Sheet',
              storageKey: `sheet_${sheet.session_id}`,
              sessionId: sheet.session_id,
              lastTimeSaved: sheet.last_time_saved,
              type: 'sheet' as const
            }))
          : []

        const notes: SessionWithType[] = notesResult.success && notesResult.data
          ? notesResult.data.map((note: any) => ({
              title: note.title || 'Untitled Document',
              storageKey: `note_${note.session_id}`,
              sessionId: note.session_id,
              lastTimeSaved: note.last_time_saved,
              type: 'note' as const
            }))
          : []

        // Combine and sort by lastTimeSaved
        const allSessions = [...sheets, ...notes].sort(
          (a, b) => (b.lastTimeSaved || 0) - (a.lastTimeSaved || 0)
        )

        setSessions(allSessions)
      } catch (error) {
        console.error('Error fetching sessions:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSessions()
  }, [user])

  // Filter sessions based on selected filter
  const filteredSessions = useMemo(() => {
    if (filter === 'all') return sessions
    if (filter === 'sheets') return sessions.filter(s => s.type === 'sheet')
    return sessions.filter(s => s.type === 'note')
  }, [sessions, filter])

  const handleDelete = async (e: React.MouseEvent, session: SessionWithType) => {
    e.stopPropagation() // Prevent opening the modal when clicking delete

    try {
      // Delete from API
      const endpoint = session.type === 'sheet'
        ? `/api/sheets/${session.sessionId}`
        : `/api/notes/${session.sessionId}`

      const response = await fetch(endpoint, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Update the UI by removing the deleted session from state
        setSessions(sessions.filter(s => s.sessionId !== session.sessionId))
      } else {
        console.error('Failed to delete session')
        alert('Failed to delete. Please try again.')
      }
    } catch (error) {
      console.error('Error deleting session:', error)
      alert('Failed to delete. Please try again.')
    }
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

      {!user ? (
        <p>Please <a href="/login">log in</a> to see your sessions.</p>
      ) : loading ? (
        <p>Loading your sessions...</p>
      ) : (
        <>
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
                <button onClick={(e) => handleDelete(e, session)}>Delete</button>
              </div>
            ))
          )}
        </>
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
