/**
 * Public Content Header Component
 * Shared header for displaying published content with author info, likes, and views
 */

import { useAuth } from '../auth/AuthContext'
import './PublicView.css'

interface PublicContentHeaderProps {
    title: string
    description?: string
    tags?: string[]
    author: { name: string; avatar_url: string | null }
    publishedAt: string
    viewCount: number
    likeCount: number
    liked: boolean
    onLikeToggle: () => void
    onBack: () => void
}

function PublicContentHeader({
    title,
    description,
    tags,
    author,
    publishedAt,
    viewCount,
    likeCount,
    liked,
    onLikeToggle,
    onBack
}: PublicContentHeaderProps) {
    const { user } = useAuth()

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric'
        })
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
                    {author.avatar_url ? (
                        <img src={author.avatar_url} alt={author.name} className="author-avatar" />
                    ) : (
                        <div className="author-avatar-placeholder">{author.name[0]?.toUpperCase()}</div>
                    )}
                    <span>by {author.name}</span>
                    <span className="publish-date">• {formatDate(publishedAt)}</span>
                </div>
                <div className="stats">
                    <span>👁️ {viewCount || 0} views</span>
                    <button 
                        className={`like-btn ${liked ? 'liked' : ''}`} 
                        onClick={onLikeToggle}
                        disabled={!user}
                        title={user ? (liked ? 'Unlike' : 'Like') : 'Login to like'}
                    >
                        {liked ? '❤️' : '🤍'} {likeCount}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default PublicContentHeader

