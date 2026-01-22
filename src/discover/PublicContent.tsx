/**
 * Public Content View
 * Unified read-only view of published content (sheets and notes)
 * with like and comment functionality
 *
 * Uses dedicated viewer components for clean read-only display
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import './PublicView.css'
import Header from '../header/header.tsx'
import { useAuth } from '../auth/AuthContext'
import Comments from './Comments.tsx'
import PublicContentHeader from './PublicContentHeader.tsx'
import NoteViewer from './NoteViewer.tsx'
import SheetViewer from './SheetViewer.tsx'

interface ContentData {
    id: string
    session_id: string
    title: string
    description: string
    type: 'sheet' | 'note'
    content: any  // JSON for sheets, HTML/object for notes
    tags: string[]
    user_id: string
    user: { name: string; avatar_url: string | null }
    like_count: number
    view_count: number
    hasLiked: boolean
    published_at: string
}

function PublicContent() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { user } = useAuth()
    const [content, setContent] = useState<ContentData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [liked, setLiked] = useState(false)
    const [likeCount, setLikeCount] = useState(0)

    useEffect(() => {
        const fetchContent = async () => {
            try {
                const response = await fetch(`/api/discover/content/${id}?userId=${user?.id || ''}`)
                const result = await response.json()

                if (!result.success) {
                    setError(result.error || 'Failed to load content')
                    return
                }

                setContent(result.data)
                setLiked(result.data.hasLiked)
                setLikeCount(result.data.like_count || 0)
            } catch (err) {
                setError('Failed to load content')
            } finally {
                setLoading(false)
            }
        }

        if (id) fetchContent()
    }, [id, user?.id])

    // Extract note content (can be HTML string or object with html/drawings)
    const getNoteHtml = (): string => {
        if (!content || content.type !== 'note') return ''
        const noteContent = content.content
        if (typeof noteContent === 'string') return noteContent
        return noteContent?.html || noteContent?.content || ''
    }

    const getNoteDrawings = () => {
        if (!content || content.type !== 'note') return undefined
        if (typeof content.content === 'object') return content.content?.drawings
        return undefined
    }

    const getNoteAttachments = () => {
        if (!content || content.type !== 'note') return undefined
        if (typeof content.content === 'object') return content.content?.attachments
        return undefined
    }

    const handleLike = async () => {
        if (!user) return

        try {
            const response = await fetch('/api/discover/like', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    contentId: id
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

    if (error || !content) {
        return (
            <div className="public-view-page">
                <Header />
                <div className="public-view-error">
                    <h2>{error || 'Content not found'}</h2>
                    <button onClick={() => navigate('/discover')}>Back to Discover</button>
                </div>
            </div>
        )
    }

    return (
        <div className="public-view-page">
            <Header />
            <div className="public-view-container">
                {/* Shared header component with title, author, likes, views */}
                <PublicContentHeader
                    title={content.title}
                    description={content.description}
                    tags={content.tags}
                    author={content.user}
                    publishedAt={content.published_at}
                    viewCount={content.view_count}
                    likeCount={likeCount}
                    liked={liked}
                    onLikeToggle={handleLike}
                    onBack={() => navigate('/discover')}
                />

                {/* Render content using viewer components */}
                <div className="public-content-wrapper">
                    {content.type === 'note' ? (
                        <NoteViewer
                            html={getNoteHtml()}
                            drawings={getNoteDrawings()}
                            attachments={getNoteAttachments()}
                        />
                    ) : (
                        <SheetViewer
                            rows={content.content?.rows || []}
                            columnWidths={content.content?.column_widths}
                        />
                    )}
                </div>

                <Comments contentId={id!} contentOwnerId={content.user_id} />
            </div>
        </div>
    )
}

export default PublicContent