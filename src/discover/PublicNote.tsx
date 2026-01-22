/**
 * Public Note View
 * Read-only view of a public note with like and comment functionality
 */

import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import './PublicView.css'
import Header from '../header/header.tsx'
import { useAuth } from '../auth/AuthContext'
import Comments from './Comments.tsx'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'

interface NoteData {
    session_id: string
    title: string
    description: string
    content: string
    delta: any
    user_id: string
    user: { name: string; avatar_url: string | null }
    like_count: number
    view_count: number
    hasLiked: boolean
    created_at: string
    tags: string[]
}

function PublicNote() {
    const { sessionId } = useParams()
    const { user } = useAuth()
    const navigate = useNavigate()
    const [note, setNote] = useState<NoteData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [liked, setLiked] = useState(false)
    const [likeCount, setLikeCount] = useState(0)
    const editorRef = useRef<HTMLDivElement>(null)
    const quillRef = useRef<Quill | null>(null)

    useEffect(() => {
        const fetchNote = async () => {
            try {
                const response = await fetch(`/api/discover/note/${sessionId}?userId=${user?.id || ''}`)
                const result = await response.json()

                if (!result.success) {
                    setError(result.error || 'Failed to load note')
                    return
                }

                setNote(result.data)
                setLiked(result.data.hasLiked)
                setLikeCount(result.data.like_count || 0)
            } catch (err) {
                setError('Failed to load note')
            } finally {
                setLoading(false)
            }
        }

        if (sessionId) fetchNote()
    }, [sessionId, user?.id])

    // Initialize read-only Quill editor
    useEffect(() => {
        if (!note || !editorRef.current || quillRef.current) return

        const quill = new Quill(editorRef.current, {
            theme: 'snow',
            readOnly: true,
            modules: {
                toolbar: false
            }
        })

        // Load content
        if (note.delta) {
            quill.setContents(note.delta)
        } else if (note.content) {
            quill.root.innerHTML = note.content
        }

        quillRef.current = quill
    }, [note])

    const handleLike = async () => {
        if (!user) return

        try {
            const response = await fetch('/api/discover/like', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    contentType: 'note',
                    contentId: sessionId
                })
            })
            const result = await response.json()

            if (result.success) {
                setLiked(result.liked)
                setLikeCount(prev => result.liked ? prev + 1 : prev - 1)
            }
        } catch (err) {
            console.error('Failed to toggle like:', err)
        }
    }

    if (loading) {
        return (
            <div className="public-view-page">
                <Header />
                <div className="public-view-loading">Loading...</div>
            </div>
        )
    }

    if (error || !note) {
        return (
            <div className="public-view-page">
                <Header />
                <div className="public-view-error">
                    <h2>{error || 'Note not found'}</h2>
                    <button onClick={() => navigate('/discover')}>Back to Discover</button>
                </div>
            </div>
        )
    }

    return (
        <div className="public-view-page">
            <Header />
            <div className="public-view-container">
                <div className="public-view-header">
                    <button className="back-btn" onClick={() => navigate('/discover')}>← Back</button>
                    <div className="public-view-title-section">
                        <h1>{note.title}</h1>
                        {note.description && <p className="description">{note.description}</p>}
                    </div>
                    <div className="public-view-meta">
                        <div className="author-info">
                            {note.user.avatar_url ? (
                                <img src={note.user.avatar_url} alt={note.user.name} className="author-avatar" />
                            ) : (
                                <div className="author-avatar-placeholder">{note.user.name[0]?.toUpperCase()}</div>
                            )}
                            <span>by {note.user.name}</span>
                        </div>
                        <div className="stats">
                            <span>👁️ {note.view_count || 0} views</span>
                            <button className={`like-btn ${liked ? 'liked' : ''}`} onClick={handleLike}>
                                {liked ? '❤️' : '🤍'} {likeCount}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="note-preview">
                    <div ref={editorRef} className="note-content-viewer"></div>
                </div>

                <Comments contentType="note" contentId={sessionId!} contentOwnerId={note.user_id} />
            </div>
        </div>
    )
}

export default PublicNote
