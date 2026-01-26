/**
 * Comments Component
 * Display and manage comments for published content
 * Uses the published_content id for all operations
 */

import { useState, useEffect } from 'react'
import { useAuth } from '../auth/AuthContext'
import './Comments.css'
import PixelAvatar from '../components/PixelAvatar'

interface Comment {
    id: string
    user_id: string
    user_name: string
    user_avatar: string | null
    text: string
    created_at: string
}

interface CommentsProps {
    contentId: string  // published_content id
    contentOwnerId: string
}

function Comments({ contentId, contentOwnerId }: CommentsProps) {
    const { user } = useAuth()
    const [comments, setComments] = useState<Comment[]>([])
    const [newComment, setNewComment] = useState('')
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        fetchComments()
    }, [contentId])

    const fetchComments = async () => {
        try {
            const response = await fetch(`/api/discover/comments/${contentId}`)
            const result = await response.json()
            if (result.success) {
                setComments(result.data)
            }
        } catch (err) {
            console.error('Failed to fetch comments:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!user || !newComment.trim() || submitting) return

        setSubmitting(true)
        try {
            const response = await fetch('/api/discover/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    userName: user.name || user.email?.split('@')[0] || 'Anonymous',
                    userAvatar: user.avatar_url || null,
                    contentId,
                    text: newComment.trim()
                })
            })
            const result = await response.json()

            if (result.success) {
                setComments(prev => [...prev, result.data])
                setNewComment('')
            }
        } catch (err) {
            console.error('Failed to add comment:', err)
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (commentId: string) => {
        if (!user) return

        try {
            const response = await fetch(`/api/discover/comments/${commentId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    contentOwnerId
                })
            })
            const result = await response.json()

            if (result.success) {
                setComments(prev => prev.filter(c => c.id !== commentId))
            }
        } catch (err) {
            console.error('Failed to delete comment:', err)
        }
    }

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diff = now.getTime() - date.getTime()
        const minutes = Math.floor(diff / 60000)
        const hours = Math.floor(diff / 3600000)
        const days = Math.floor(diff / 86400000)

        if (minutes < 1) return 'Just now'
        if (minutes < 60) return `${minutes}m ago`
        if (hours < 24) return `${hours}h ago`
        if (days < 7) return `${days}d ago`
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    const canDelete = (comment: Comment) => {
        return user && (user.id === comment.user_id || user.id === contentOwnerId)
    }

    return (
        <div className="comments-section">
            <h3>Comments ({comments.length})</h3>

            {user ? (
                <form className="comment-form" onSubmit={handleSubmit}>
                    <div className="comment-input-wrapper">
                        <PixelAvatar
                            avatarData={user.avatar}
                            userId={user.id}
                            size={32}
                            className="comment-avatar"
                        />
                        <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Write a comment..."
                            rows={2}
                        />
                    </div>
                    <button type="submit" disabled={!newComment.trim() || submitting}>
                        {submitting ? 'Posting...' : 'Post Comment'}
                    </button>
                </form>
            ) : (
                <p className="login-prompt">Log in to leave a comment</p>
            )}

            {loading ? (
                <div className="comments-loading">Loading comments...</div>
            ) : comments.length === 0 ? (
                <div className="no-comments">No comments yet. Be the first!</div>
            ) : (
                <div className="comments-list">
                    {comments.map(comment => (
                        <div key={comment.id} className="comment">
                            <div className="comment-header">
                                <PixelAvatar
                                    avatarData={comment.user_avatar}
                                    userId={comment.user_id}
                                    size={32}
                                    className="comment-avatar"
                                />
                                <div className="comment-meta">
                                    <span className="comment-author">{comment.user_name}</span>
                                    <span className="comment-date">{formatDate(comment.created_at)}</span>
                                </div>
                                {canDelete(comment) && (
                                    <button className="delete-btn" onClick={() => handleDelete(comment.id)}>×</button>
                                )}
                            </div>
                            <p className="comment-text">{comment.text}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default Comments
