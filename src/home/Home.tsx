import { useState, useMemo, useEffect, useRef } from 'react'
import './Home.css'
import Header from '../header/header.tsx'
import type { SessionInfo } from '../gaurdian.ts'
import ModeModal from '../mode/mode.tsx'
import { useAuth } from '../auth/AuthContext'
import PublishModal from '../components/PublishModal'
import { SheetIcon, NoteIcon, DiagramIcon, PublishIcon, TagIcon, CheckIcon, HeartIcon, ViewIcon, SearchIcon } from '../components/Icons'
import '../components/Icons.css'

// Extended SessionInfo to include type and created_at
type SessionWithType = SessionInfo & {
  type: 'sheet' | 'note' | 'diagram'
  created_at?: number
  content?: string // For search functionality
  tags?: string[] // Tags for organization
  isPublished?: boolean // Whether this session is published
  publishedId?: string // ID of the published content
  publishedStats?: { like_count: number; view_count: number } // Stats for published content
}

// Published content type
type PublishedContent = {
  id: string
  original_session_id: string
  content_type: 'sheet' | 'note' | 'diagram'
  title: string
  description: string
  tags: string[]
  published_at: string
  like_count: number
  view_count: number
}

function Home() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<SessionWithType[]>([])
  const [filter, setFilter] = useState<'all' | 'sheets' | 'notes' | 'diagrams' | 'published'>('all')
  const [sortBy, setSortBy] = useState<'lastSaved' | 'title' | 'dateCreated'>('lastSaved')
  const [selectedSheet, setSelectedSheet] = useState<SessionWithType | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [publishModalOpen, setPublishModalOpen] = useState(false)
  const [publishModalSession, setPublishModalSession] = useState<SessionWithType | null>(null)
  const [allTags, setAllTags] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [tagSearchQuery, setTagSearchQuery] = useState('')
  const [publishedContent, setPublishedContent] = useState<PublishedContent[]>([])
  const [loadingPublished, setLoadingPublished] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const tagSearchInputRef = useRef<HTMLInputElement>(null)
  // Fetch sessions from API
  const fetchSessions = async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      // Fetch sheets, notes, diagrams, and published content in parallel
      const [sheetsResponse, notesResponse, diagramsResponse, publishedResponse] = await Promise.all([
        fetch(`/api/sheets/user/${user.id}`),
        fetch(`/api/notes/user/${user.id}`),
        fetch(`/api/diagrams/user/${user.id}`),
        fetch(`/api/discover/user/${user.id}`)
      ])

      const [sheetsResult, notesResult, diagramsResult, publishedResult] = await Promise.all([
        sheetsResponse.json(),
        notesResponse.json(),
        diagramsResponse.json(),
        publishedResponse.json()
      ])

      // Create a map of published session IDs for quick lookup (includes stats and tags)
      const publishedMap = new Map<string, { id: string; like_count: number; view_count: number; tags: string[] }>()
      if (publishedResult.success && publishedResult.data) {
        publishedResult.data.forEach((pub: PublishedContent) => {
          publishedMap.set(pub.original_session_id, {
            id: pub.id,
            like_count: pub.like_count,
            view_count: pub.view_count,
            tags: pub.tags || []
          })
        })
        setPublishedContent(publishedResult.data)
      }

      const sheets: SessionWithType[] = sheetsResult.success && sheetsResult.data
        ? sheetsResult.data.map((sheet: any) => {
            // Extract text content from rows for search
            let content = '';
            if (sheet.rows && Array.isArray(sheet.rows)) {
              content = sheet.rows.map((row: any) =>
                Object.values(row || {}).join(' ')
              ).join(' ');
            }

            const publishedData = publishedMap.get(sheet.session_id);
            // Use tags from published_content if available (published items), otherwise from sheets table
            const tags = publishedData?.tags?.length ? publishedData.tags : (sheet.tags || []);
            return {
              title: sheet.title || 'Untitled Sheet',
              storageKey: `sheet_${sheet.session_id}`,
              sessionId: sheet.session_id,
              lastTimeSaved: sheet.last_time_saved,
              created_at: sheet.created_at,
              type: 'sheet' as const,
              content,
              permission: sheet.permission || 'owner',
              tags: tags,
              isPublished: !!publishedData,
              publishedId: publishedData?.id,
              publishedStats: publishedData ? { like_count: publishedData.like_count, view_count: publishedData.view_count } : undefined
            };
          })
        : []

      const notes: SessionWithType[] = notesResult.success && notesResult.data
        ? notesResult.data.map((note: any) => {
            // Strip HTML tags from content for search
            const content = note.content
              ? note.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
              : '';

            const publishedData = publishedMap.get(note.session_id);
            // Use tags from published_content if available (published items), otherwise from notes table
            const tags = publishedData?.tags?.length ? publishedData.tags : (note.tags || []);
            return {
              title: note.title || 'Untitled Document',
              storageKey: `note_${note.session_id}`,
              sessionId: note.session_id,
              lastTimeSaved: note.last_time_saved,
              created_at: note.created_at,
              type: 'note' as const,
              content,
              permission: note.permission || 'owner',
              tags: tags,
              isPublished: !!publishedData,
              publishedId: publishedData?.id,
              publishedStats: publishedData ? { like_count: publishedData.like_count, view_count: publishedData.view_count } : undefined
            };
          })
        : []

      const diagrams: SessionWithType[] = diagramsResult.success && diagramsResult.data
        ? diagramsResult.data.map((diagram: any) => {
            // Note: cards data is not fetched in the list view for performance
            // Search by title only for diagrams (cards would be too large for OCR diagrams)
            const publishedData = publishedMap.get(diagram.session_id);
            // Use tags from published_content if available (published diagrams), otherwise from diagrams table
            const tags = publishedData?.tags?.length ? publishedData.tags : (diagram.tags || []);
            return {
              title: diagram.title || 'Untitled Diagram',
              storageKey: `diagram_${diagram.session_id}`,
              sessionId: diagram.session_id,
              lastTimeSaved: diagram.last_time_saved,
              created_at: diagram.created_at,
              type: 'diagram' as const,
              content: '', // Diagrams are searched by title only (cards not fetched for performance)
              permission: diagram.permission || 'owner',
              tags: tags,
              isPublished: !!publishedData,
              publishedId: publishedData?.id,
              publishedStats: publishedData ? { like_count: publishedData.like_count, view_count: publishedData.view_count } : undefined
            };
          })
        : []

      // Combine sheets, notes, and diagrams (don't sort here - will sort in useMemo)
      const allSessions = [...sheets, ...notes, ...diagrams]

      // Extract all unique tags from all sessions
      const tagsSet = new Set<string>();
      allSessions.forEach(s => s.tags?.forEach(t => tagsSet.add(t)));
      setAllTags(Array.from(tagsSet).sort());

      setSessions(allSessions)
    } catch (error) {
      console.error('Error fetching sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch sessions when component mounts
  useEffect(() => {
    fetchSessions()
  }, [user])

  // Refresh published content when filter changes to 'published' (for fresh data)
  useEffect(() => {
    const refreshPublished = async () => {
      if (!user || filter !== 'published') return
      // Only refresh if we already have some published content loaded
      // (to avoid duplicate fetches on initial load)
      if (publishedContent.length === 0 && !loading) {
        setLoadingPublished(true)
        try {
          const response = await fetch(`/api/discover/user/${user.id}`)
          const result = await response.json()
          if (result.success && result.data) {
            setPublishedContent(result.data)
          }
        } catch (error) {
          console.error('Error fetching published content:', error)
        } finally {
          setLoadingPublished(false)
        }
      }
    }

    refreshPublished()
  }, [user, filter, loading])

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

  // Filter sessions based on selected filter, search query, and tags
  const filteredSessions = useMemo(() => {
    let filtered = sortedSessions;

    // Apply type filter
    if (filter === 'sheets') {
      filtered = filtered.filter(s => s.type === 'sheet');
    } else if (filter === 'notes') {
      filtered = filtered.filter(s => s.type === 'note');
    } else if (filter === 'diagrams') {
      filtered = filtered.filter(s => s.type === 'diagram');
    }

    // Apply tag filter - show sessions that have ANY of the selected tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter(s =>
        s.tags?.some(tag => selectedTags.includes(tag))
      );
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
  }, [sortedSessions, filter, searchQuery, selectedTags])

  // Filter available tags based on tag search
  const filteredTags = useMemo(() => {
    if (!tagSearchQuery.trim()) return allTags;
    const query = tagSearchQuery.toLowerCase();
    return allTags.filter(tag => tag.toLowerCase().includes(query));
  }, [allTags, tagSearchQuery])

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  }

  const clearTagFilters = () => {
    setSelectedTags([]);
    setTagSearchQuery('');
  }

  const handleDelete = async (e: React.MouseEvent, session: SessionWithType) => {
    e.stopPropagation() // Prevent opening the modal when clicking delete

    try {
      // Delete from API based on session type
      let endpoint: string
      if (session.type === 'sheet') {
        endpoint = `/api/sheets/${session.sessionId}`
      } else if (session.type === 'note') {
        endpoint = `/api/notes/${session.sessionId}`
      } else {
        endpoint = `/api/diagrams/${session.sessionId}`
      }

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
    // Navigate to editor based on session type
    // (Published sessions can be viewed via the "Live" badge link)
    if (session.type === 'sheet') {
      setSelectedSheet(session)
    } else if (session.type === 'note') {
      window.location.href = `/notes/${session.sessionId}`
    } else {
      window.location.href = `/diagrams/${session.sessionId}`
    }
  }

  const handleCloseModal = () => {
    setSelectedSheet(null)
  }

  return (
    <div className="home_container">
      <Header/>
      <br></br>
      <div className="home_actions">
        <button className="home_new_sheet_btn">
          <a href="/sheets">New Sheet</a>
        </button>
        <button className="home_new_note_btn">
          <a href="/notes">New Note</a>
        </button>
        <button className="home_new_diagram_btn">
          <a href="/diagrams">New Diagram</a>
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
            <button
              className={filter === 'diagrams' ? 'active' : ''}
              onClick={() => setFilter('diagrams')}
            >
              Diagrams
            </button>
            <button
              className={filter === 'published' ? 'active' : ''}
              onClick={() => setFilter('published')}
            >
              <PublishIcon size={14} /> Published
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
            <span onClick={() => searchInputRef.current?.focus()}>
              <SearchIcon size={14} />
              <input
                ref={searchInputRef}
                type="text"
                className="search-sessions-input"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </span>
          </div>

          {/* Tag filtering section */}
          {allTags.length > 0 && (
            <div className="home_tag_filter">
              <div className="tag_filter_header">
                <span className="tag_filter_label"><TagIcon size={14} /> Filter by tags:</span>
                <input
                  ref={tagSearchInputRef}
                  type="text"
                  className="tag_search_input"
                  placeholder="Search tags..."
                  value={tagSearchQuery}
                  onChange={(e) => setTagSearchQuery(e.target.value)}
                />
                {selectedTags.length > 0 && (
                  <button className="clear_tags_btn" onClick={clearTagFilters}>
                    Clear filters
                  </button>
                )}
              </div>
              <div className="tag_list">
                {filteredTags.map(tag => (
                  <button
                    key={tag}
                    className={`tag_filter_btn ${selectedTags.includes(tag) ? 'selected' : ''}`}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                    {selectedTags.includes(tag) && <CheckIcon size={12} />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Published content view */}
          {filter === 'published' ? (
            loadingPublished ? (
              <p>Loading your published content...</p>
            ) : publishedContent.length === 0 ? (
              <div className="published_empty">
                <p>You haven't published any content yet.</p>
                <p>Publish your sheets and notes to share them with the community on the <a href="/discover">Discover</a> page!</p>
              </div>
            ) : (
              <div className="published_list">
                {publishedContent.map((item) => (
                  <div key={item.id} className="home_sheet_item published_item">
                    <div className="home_sheet_main">
                      <a
                        href={`/discover/${item.id}`}
                        className="home_sheet_link"
                      >
                        {item.content_type === 'sheet' ? <SheetIcon size={14} /> : item.content_type === 'note' ? <NoteIcon size={14} /> : <DiagramIcon size={14} color="#a855f7" />} {item.title}
                        <span className="published_badge"><PublishIcon size={12} /> Published</span>
                      </a>
                      {item.tags && item.tags.length > 0 && (
                        <div className="home_sheet_tags">
                          {item.tags.map(tag => (
                            <span key={tag} className="home_tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="published_stats">
                        <span><HeartIcon size={12} filled /> {item.like_count}</span>
                        <span><ViewIcon size={12} /> {item.view_count}</span>
                        <span>Published {new Date(item.published_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="home_sheet_actions">
                      <a href={`/${item.content_type === 'sheet' ? 'sheets' : item.content_type === 'note' ? 'notes' : 'diagrams'}/${item.original_session_id}`} className="edit-original-btn">
                        Edit Original
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Unified list of sessions */
            filteredSessions.length === 0 ? (
              <p>
                {filter === 'all'
                  ? 'No sessions yet. Create a sheet or note to get started!'
                  : filter === 'sheets'
                  ? 'No sheets yet. Create one to get started!'
                  : 'No notes yet. Create one to get started!'}
              </p>
            ) : (
              filteredSessions.map((session) => (
                <div
                  key={session.storageKey}
                  className={`home_sheet_item ${session.type} ${session.isPublished ? 'is-published' : ''}`}
                  onClick={() => handleSessionClick(session)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="home_sheet_main">
                    <div className="home_sheet_title_row">
                      <span className="home_sheet_link">
                        {session.type === 'sheet' ? <SheetIcon size={14} /> : session.type === 'note' ? <NoteIcon size={14} /> : <DiagramIcon size={14} color="#a855f7" />} {session.title}
                      </span>
                      {session.isPublished && (
                        <a
                          href={`/discover/${session.publishedId}`}
                          className="published-indicator"
                          title="View on Discover"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span>Live</span>
                        </a>
                      )}
                    </div>
                    <div className="tags_and_stats">
                      {session.isPublished && session.publishedStats && (
                        <span className="home_published_stats">
                          <span><ViewIcon size={12} /> {session.publishedStats.view_count}</span>
                          <span><HeartIcon size={12} filled /> {session.publishedStats.like_count}</span>
                        </span>
                      )}
                      {session.tags && session.tags.length > 0 && (
                        <span className="home_sheet_tags">
                          {session.tags.map(tag => (
                            <span
                              key={tag}
                              className={`home_tag ${selectedTags.includes(tag) ? 'active' : ''}`}
                              onClick={(e) => { e.stopPropagation(); toggleTag(tag); }}
                            >
                              {tag}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="home_sheet_actions">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPublishModalSession(session);
                        setPublishModalOpen(true);
                      }}
                      className={`publish-button ${session.isPublished ? 'is-published' : ''}`}
                    >

                      {session.isPublished ?
                        (<><PublishIcon size={12} color='var(--color-success-500)'/> Manage</>):
                        (<><PublishIcon size={12} color={session.type === 'note' ? 'var(--color-warning-500)' : session.type === 'diagram' ? '#a855f7' : 'var(--color-accent-500)'}/> Publish</>)
                      }
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, session)}
                      className="home_delete_btn"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )
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

      {publishModalOpen && publishModalSession && user && (
        <PublishModal
          isOpen={publishModalOpen}
          onClose={() => {
            setPublishModalOpen(false);
            setPublishModalSession(null);
            fetchSessions(); // Refresh data after modal closes
          }}
          sessionId={publishModalSession.sessionId}
          contentType={publishModalSession.type}
          currentUserId={user.id}
          currentTitle={publishModalSession.title}
          currentTags={publishModalSession.tags || []}
        />
      )}
    </div>
  )
}

export default Home
