/**
 * Public Sheet View
 * Read-only view of a public sheet with like and comment functionality
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import './PublicView.css'
import Header from '../header/header.tsx'
import { useAuth } from '../auth/AuthContext'
import Comments from './Comments.tsx'

interface SheetData {
    session_id: string
    title: string
    description: string
    rows: Array<{ data: string[] }>
    column_widths: number[]
    user_id: string
    user: { name: string; avatar_url: string | null }
    like_count: number
    view_count: number
    hasLiked: boolean
    created_at: string
    tags: string[]
}

function PublicSheet() {
    const { sessionId } = useParams()
    const { user } = useAuth()
    const navigate = useNavigate()
    const [sheet, setSheet] = useState<SheetData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [liked, setLiked] = useState(false)
    const [likeCount, setLikeCount] = useState(0)

    useEffect(() => {
        const fetchSheet = async () => {
            try {
                const response = await fetch(`/api/discover/sheet/${sessionId}?userId=${user?.id || ''}`)
                const result = await response.json()

                if (!result.success) {
                    setError(result.error || 'Failed to load sheet')
                    return
                }

                setSheet(result.data)
                setLiked(result.data.hasLiked)
                setLikeCount(result.data.like_count || 0)
            } catch (err) {
                setError('Failed to load sheet')
            } finally {
                setLoading(false)
            }
        }

        if (sessionId) fetchSheet()
    }, [sessionId, user?.id])

    const handleLike = async () => {
        if (!user) return

        try {
            const response = await fetch('/api/discover/like', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    contentType: 'sheet',
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

    const isOwner = user?.id === sheet?.user_id

    if (loading) {
        return (
            <div className="public-view-page">
                <Header />
                <div className="public-view-loading">Loading...</div>
            </div>
        )
    }

    if (error || !sheet) {
        return (
            <div className="public-view-page">
                <Header />
                <div className="public-view-error">
                    <h2>{error || 'Sheet not found'}</h2>
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
                        <h1>{sheet.title}</h1>
                        {sheet.description && <p className="description">{sheet.description}</p>}
                    </div>
                    <div className="public-view-meta">
                        <div className="author-info">
                            {sheet.user.avatar_url ? (
                                <img src={sheet.user.avatar_url} alt={sheet.user.name} className="author-avatar" />
                            ) : (
                                <div className="author-avatar-placeholder">{sheet.user.name[0]?.toUpperCase()}</div>
                            )}
                            <span>by {sheet.user.name}</span>
                        </div>
                        <div className="stats">
                            <span>👁️ {sheet.view_count || 0} views</span>
                            <button className={`like-btn ${liked ? 'liked' : ''}`} onClick={handleLike}>
                                {liked ? '❤️' : '🤍'} {likeCount}
                            </button>
                        </div>
                    </div>
                    {sheet.tags && sheet.tags.length > 0 && (
                        <div className="tags">
                            {sheet.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}
                        </div>
                    )}
                </div>

                <div className="sheet-preview">
                    <table className="sheet-table">
                        <tbody>
                            {sheet.rows.slice(0, 50).map((row, rowIdx) => (
                                <tr key={rowIdx}>
                                    {row.data.map((cell, colIdx) => (
                                        <td key={colIdx} style={{ minWidth: sheet.column_widths[colIdx] || 100 }}>
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {sheet.rows.length > 50 && (
                        <p className="truncated-notice">Showing first 50 of {sheet.rows.length} rows</p>
                    )}
                </div>

                <Comments contentType="sheet" contentId={sessionId!} contentOwnerId={sheet.user_id} />
            </div>
        </div>
    )
}

export default PublicSheet
