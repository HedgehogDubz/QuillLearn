import { useState, useMemo, useEffect } from 'react'
import './Home.css'
import Header from '../header/header.tsx'
import type { SessionInfo } from '../gaurdian.ts'
import ModeModal from '../mode/mode.tsx'
import { useAuth } from '../auth/AuthContext'

// Extended SessionInfo to include type and created_at
type SessionWithType = SessionInfo & {
  type: 'sheet' | 'note'
  created_at?: number
  content?: string // For search functionality
}

function Home() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<SessionWithType[]>([])
  const [filter, setFilter] = useState<'all' | 'sheets' | 'notes'>('all')
  const [sortBy, setSortBy] = useState<'lastSaved' | 'title' | 'dateCreated'>('lastSaved')
  const [selectedSheet, setSelectedSheet] = useState<SessionWithType | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
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
          ? sheetsResult.data.map((sheet: any) => {
              // Extract text content from rows for search
              let content = '';
              if (sheet.rows && Array.isArray(sheet.rows)) {
                content = sheet.rows.map((row: any) =>
                  Object.values(row || {}).join(' ')
                ).join(' ');
              }

              return {
                title: sheet.title || 'Untitled Sheet',
                storageKey: `sheet_${sheet.session_id}`,
                sessionId: sheet.session_id,
                lastTimeSaved: sheet.last_time_saved,
                created_at: sheet.created_at,
                type: 'sheet' as const,
                content
              };
            })
          : []

        const notes: SessionWithType[] = notesResult.success && notesResult.data
          ? notesResult.data.map((note: any) => {
              // Strip HTML tags from content for search
              const content = note.content
                ? note.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
                : '';

              return {
                title: note.title || 'Untitled Document',
                storageKey: `note_${note.session_id}`,
                sessionId: note.session_id,
                lastTimeSaved: note.last_time_saved,
                created_at: note.created_at,
                type: 'note' as const,
                content
              };
            })
          : []

        // Combine sheets and notes (don't sort here - will sort in useMemo)
        const allSessions = [...sheets, ...notes]

        setSessions(allSessions)
      } catch (error) {
        console.error('Error fetching sessions:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSessions()
  }, [user])

  // Sort sessions based on selected sort option
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      if (sortBy === 'lastSaved') {
        return (b.lastTimeSaved || 0) - (a.lastTimeSaved || 0)
      } else if (sortBy === 'title') {
        return a.title.localeCompare(b.title)
      } else if (sortBy === 'dateCreated') {
        return (b.created_at || 0) - (a.created_at || 0)
      }
      return 0
    })
  }, [sessions, sortBy])

  // Filter sessions based on selected filter and search query
  const filteredSessions = useMemo(() => {
    let filtered = sortedSessions;

    // Apply type filter
    if (filter === 'sheets') {
      filtered = filtered.filter(s => s.type === 'sheet');
    } else if (filter === 'notes') {
      filtered = filtered.filter(s => s.type === 'note');
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();

      // Separate sessions into title matches and content matches
      const titleMatches: SessionWithType[] = [];
      const contentMatches: SessionWithType[] = [];

      filtered.forEach(session => {
        const titleMatch = session.title.toLowerCase().includes(query);
        const contentMatch = session.content?.toLowerCase().includes(query);

        if (titleMatch) {
          titleMatches.push(session);
        } else if (contentMatch) {
          contentMatches.push(session);
        }
      });

      // Return title matches first, then content matches
      return [...titleMatches, ...contentMatches];
    }

    return filtered;
  }, [sortedSessions, filter, searchQuery])

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
            <span>
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
            </span>
            <span>
              Sort By:
              <select
                id="sort-by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'lastSaved' | 'title' | 'dateCreated')}
              >
                <option value="lastSaved">Last Saved</option>
                <option value="title">A-Z</option>
                <option value="dateCreated">Date Created</option>
              </select>
            </span>
            <span>
              <input
                type="text"
                className="search-sessions-input"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </span>
          </div>

          {/* Unified list of sessions */}
    
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
