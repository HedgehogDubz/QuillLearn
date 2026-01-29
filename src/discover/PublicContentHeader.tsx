/**
 * Public Content Header Component
 * Shared header for displaying published content with author info, likes, and views
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { authFetch } from '../utils/api'
import './PublicView.css'
import { ViewIcon, HeartIcon, CopyIcon } from '../components/Icons'
import '../components/Icons.css'
import PixelAvatar from '../components/PixelAvatar'

interface PublicContentHeaderProps {
    contentId: string
    title: string
    description?: string
    tags?: string[]
    author: { name: string; avatar?: string | null; userId?: string }
    publishedAt: string
    viewCount: number
    likeCount: number
    liked: boolean
    liking?: boolean
    onLikeToggle: () => void
    onBack: () => void
}

function PublicContentHeader({
    contentId,
    title,
    description,
    tags,
    author,
    publishedAt,
    viewCount,
    likeCount,
    liked,
    liking = false,
    onLikeToggle,
    onBack
}: PublicContentHeaderProps) {
    const { user } = useAuth()
    const navigate = useNavigate()
    const [copying, setCopying] = useState(false)

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric'
        })
    }

    const handleCopy = async () => {
        if (!user || copying) return

        setCopying(true)
        try {
            const response = await authFetch(`/api/discover/copy/${contentId}`, {
                method: 'POST',
                body: JSON.stringify({ userId: user.id })
            })

            const result = await response.json()

            if (result.success) {
                // Navigate to the copied content
                const path = result.type === 'sheet'
                    ? `/sheets/${result.sessionId}`
                    : result.type === 'diagram'
                        ? `/diagrams/${result.sessionId}`
                        : `/notes/${result.sessionId}`
                navigate(path)
            } else {
                alert(result.error || 'Failed to copy content')
            }
        } catch (err) {
            console.error('Failed to copy:', err)
            alert('Failed to copy content')
        } finally {
            setCopying(false)
        }
    }

    return (
        <div className="public-view-header">
            <button className="back-btn" onClick={onBack}>← Back</button>
            <div className="public-view-title-section">
                <h1>{title}</h1>
                {description && <p className="description">{description}</p>}
                {tags && tags.length > 0 && (
                    <div className="content-tags">
                        {tags.map(tag => (
                            <span key={tag} className="tag">{tag}</span>
                        ))}
                    </div>
                )}
            </div>
            <div className="public-view-meta">
                <div className="author-info">
                    <PixelAvatar
                        avatarData={author.avatar}
                        userId={author.userId || 'unknown'}
                        size={32}
                        className="author-avatar"
                    />
                    <span>by {author.name}</span>
                    <span className="publish-date">• {formatDate(publishedAt)}</span>
                </div>
                <div className="stats">
                    <span><ViewIcon size={14} /> {viewCount || 0} views</span>
                    <button
                        className={`like-btn ${liked ? 'liked' : ''}`}
                        onClick={onLikeToggle}
                        disabled={!user || liking}
                        title={user ? (liked ? 'Unlike' : 'Like') : 'Login to like'}
                    >
                        <HeartIcon size={14} filled={liked} /> {likeCount}
                    </button>
                    <button
                        className="copy-btn"
                        onClick={handleCopy}
                        disabled={!user || copying}
                        title={user ? 'Save a copy to your library that you can edit' : 'Login to save a copy'}
                    >
                        <CopyIcon size={14} /> {copying ? 'Saving...' : 'Save to Library'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default PublicContentHeader

