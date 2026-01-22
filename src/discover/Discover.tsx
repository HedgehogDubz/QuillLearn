/**
 * Discover Page
 * Browse public sheets and notes from the community
 * Uses the published_content table for all public content
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import './Discover.css'
import Header from '../header/header.tsx'

interface PublicContent {
    id: string  // UUID from published_content table
    session_id: string  // Original session_id for reference
    title: string
    description: string
    type: 'sheet' | 'note'
    user_id: string
    user: {
        name: string
        avatar_url: string | null
    }
    published_at: string
    updated_at: string
    like_count: number
    view_count: number
    tags: string[]
    content?: any  // JSON content (rows for sheets, HTML for notes)
}

type SortOption = 'recent' | 'popular' | 'views' | 'oldest'
type TypeFilter = 'all' | 'sheets' | 'notes'

function Discover() {
    const navigate = useNavigate()
    const [content, setContent] = useState<PublicContent[]>([])
    const [loading, setLoading] = useState(true)
    const [sort, setSort] = useState<SortOption>('recent')
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [selectedTags, setSelectedTags] = useState<string[]>([])
    const [availableTags, setAvailableTags] = useState<string[]>([])
    const [hasMore, setHasMore] = useState(false)
    const [offset, setOffset] = useState(0)
    const LIMIT = 20

    // Fetch available tags
    useEffect(() => {
        const fetchTags = async () => {
            try {
                const response = await fetch('/api/discover/tags')
                const result = await response.json()
                if (result.success) {
                    setAvailableTags(result.data)
                }
            } catch (error) {
                console.error('Error fetching tags:', error)
            }
        }
        fetchTags()
    }, [])

    const fetchContent = useCallback(async (reset = false) => {
        try {
            setLoading(true)
            const currentOffset = reset ? 0 : offset
            const params = new URLSearchParams({
                sort,
                type: typeFilter,
                limit: LIMIT.toString(),
                offset: currentOffset.toString(),
                search
            })
            if (selectedTags.length > 0) {
                params.set('tags', selectedTags.join(','))
            }

            const response = await fetch(`/api/discover?${params}`)
            const result = await response.json()

            if (result.success) {
                if (reset) {
                    setContent(result.data)
                    setOffset(LIMIT)
                } else {
                    setContent(prev => [...prev, ...result.data])
                    setOffset(currentOffset + LIMIT)
                }
                // Check if we got fewer items than requested
                setHasMore(result.data.length === LIMIT)
            }
        } catch (error) {
            console.error('Error fetching public content:', error)
        } finally {
            setLoading(false)
        }
    }, [sort, typeFilter, search, selectedTags, offset])

    useEffect(() => {
        fetchContent(true)
    }, [sort, typeFilter, search, selectedTags])

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        setSearch(searchInput)
    }

    const handleContentClick = (item: PublicContent) => {
        // Navigate using the published_content id
        navigate(`/discover/content/${item.id}`)
    }

    const toggleTag = (tag: string) => {
        setSelectedTags(prev =>
            prev.includes(tag)
                ? prev.filter(t => t !== tag)
                : [...prev, tag]
        )
    }

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    const getPreview = (item: PublicContent) => {
        if (item.description) return item.description
        if (item.type === 'note' && item.content) {
            // Content is HTML string for notes
            const stripped = String(item.content).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
            return stripped.substring(0, 150) + (stripped.length > 150 ? '...' : '')
        }
        if (item.type === 'sheet' && item.content) {
            // Content is { rows: [...], column_widths: [...] } for sheets
            const rows = item.content.rows || []
            return `${rows.length} rows`
        }
        return 'No preview available'
    }

    return (
        <div className="discover-page">
            <Header />
            <div className="discover-container">
                <div className="discover-header">
                    <h1>Discover</h1>
                    <p>Explore public sheets and notes from the community</p>
                </div>

                <div className="discover-controls">
                    <form className="discover-search" onSubmit={handleSearch}>
                        <input
                            type="text"
                            placeholder="Search public content..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                        />
                        <button type="submit">Search</button>
                    </form>

                    <div className="discover-filters">
                        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}>
                            <option value="all">All Types</option>
                            <option value="sheets">Sheets Only</option>
                            <option value="notes">Notes Only</option>
                        </select>

                        <select value={sort} onChange={(e) => setSort(e.target.value as SortOption)}>
                            <option value="recent">Most Recent</option>
                            <option value="popular">Most Liked</option>
                            <option value="views">Most Viewed</option>
                            <option value="oldest">Oldest First</option>
                        </select>
                    </div>
                </div>

                {/* Tag filter */}
                {availableTags.length > 0 && (
                    <div className="discover-tags-filter">
                        <span className="tags-label">Filter by tags:</span>
                        <div className="tags-list">
                            {availableTags.slice(0, 10).map(tag => (
                                <button
                                    key={tag}
                                    className={`tag-filter ${selectedTags.includes(tag) ? 'active' : ''}`}
                                    onClick={() => toggleTag(tag)}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {loading && content.length === 0 ? (
                    <div className="discover-loading">
                        <div className="loading-spinner"></div>
                        <p>Loading content...</p>
                    </div>
                ) : content.length === 0 ? (
                    <div className="discover-empty">
                        <p>No public content found</p>
                        {search && <p className="discover-empty-hint">Try a different search term</p>}
                    </div>
                ) : (
                    <>
                        <div className="discover-grid">
                            {content.map((item) => (
                                <div
                                    key={item.id}
                                    className={`discover-card ${item.type}`}
                                    onClick={() => handleContentClick(item)}
                                >
                                    <div className="discover-card-header">
                                        <span className={`discover-card-type ${item.type}`}>
                                            {item.type === 'sheet' ? '📊' : '📝'} {item.type}
                                        </span>
                                        <span className="discover-card-date">{formatDate(item.published_at)}</span>
                                    </div>
                                    <h3 className="discover-card-title">{item.title}</h3>
                                    <p className="discover-card-preview">{getPreview(item)}</p>
                                    <div className="discover-card-footer">
                                        <div className="discover-card-author">
                                            {item.user.avatar_url ? (
                                                <img src={item.user.avatar_url} alt={item.user.name} className="author-avatar" />
                                            ) : (
                                                <div className="author-avatar-placeholder">{item.user.name[0]?.toUpperCase()}</div>
                                            )}
                                            <span>{item.user.name}</span>
                                        </div>
                                        <div className="discover-card-stats">
                                            <span className="stat">❤️ {item.like_count || 0}</span>
                                            <span className="stat">👁️ {item.view_count || 0}</span>
                                        </div>
                                    </div>
                                    {item.tags && item.tags.length > 0 && (
                                        <div className="discover-card-tags">
                                            {item.tags.slice(0, 3).map(tag => (
                                                <span key={tag} className="tag">{tag}</span>
                                            ))}
                                            {item.tags.length > 3 && <span className="tag more">+{item.tags.length - 3}</span>}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {hasMore && (
                            <div className="discover-load-more">
                                <button onClick={() => fetchContent(false)} disabled={loading}>
                                    {loading ? 'Loading...' : 'Load More'}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

export default Discover
