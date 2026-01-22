/**
 * PublishModal Component
 * Modal for publishing content to the Discover page
 * Creates a snapshot in the published_content table
 */

import React, { useState, useEffect } from 'react';
import './PublishModal.css';
import TagInput from './TagInput';
import { useAuth } from '../auth/AuthContext';

interface PublishModalProps {
    isOpen: boolean;
    onClose: () => void;
    sessionId: string;
    contentType: 'sheet' | 'note';
    currentUserId: string;
    currentTitle: string;
    currentTags: string[];
    onPublishSuccess?: (publishedId: string) => void;
}

interface PublishedInfo {
    id: string;
    title: string;
    description: string;
    tags: string[];
    published_at: string;
    like_count: number;
    view_count: number;
    publisher_username: string;
}

export const PublishModal: React.FC<PublishModalProps> = ({
    isOpen,
    onClose,
    sessionId,
    contentType,
    currentUserId,
    currentTitle,
    currentTags,
    onPublishSuccess
}) => {
    const { user } = useAuth();
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState<string[]>(currentTags);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [publishedInfo, setPublishedInfo] = useState<PublishedInfo | null>(null);
    const [checkingStatus, setCheckingStatus] = useState(true);
    const [publishAnonymously, setPublishAnonymously] = useState(false);

    // Check if already published
    useEffect(() => {
        if (isOpen) {
            checkPublishStatus();
        }
    }, [isOpen, sessionId]);

    const checkPublishStatus = async () => {
        setCheckingStatus(true);
        try {
            const response = await fetch(`/api/published/status/${contentType}/${sessionId}`);
            const result = await response.json();

            if (result.success && result.data) {
                setPublishedInfo(result.data);
                setDescription(result.data.description || '');
                setTags(result.data.tags || currentTags);
                // Check if currently published anonymously
                setPublishAnonymously(result.data.publisher_username === 'Anonymous');
            } else {
                setPublishedInfo(null);
                setDescription('');
                setTags(currentTags);
            }
        } catch (err) {
            console.error('Error checking publish status:', err);
        } finally {
            setCheckingStatus(false);
        }
    };

    const handlePublish = async () => {
        setLoading(true);
        setError(null);

        try {
            const username = publishAnonymously ? 'Anonymous' : (user?.username || user?.email || 'Anonymous');

            const response = await fetch(`/api/published/${contentType}/${sessionId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUserId,
                    username,
                    description: description.trim(),
                    tags
                })
            });

            const result = await response.json();

            if (result.success) {
                await checkPublishStatus();
                onPublishSuccess?.(result.publishedId);
            } else {
                setError(result.error || 'Failed to publish');
            }
        } catch (err) {
            setError('Failed to publish content');
        } finally {
            setLoading(false);
        }
    };

    const handleUnpublish = async () => {
        if (!publishedInfo) return;

        if (!confirm('Are you sure you want to unpublish this content? It will be removed from Discover.')) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/published/${publishedInfo.id}?userId=${currentUserId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                setPublishedInfo(null);
                setDescription('');
            } else {
                setError(result.error || 'Failed to unpublish');
            }
        } catch (err) {
            setError('Failed to unpublish content');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    if (!isOpen) return null;

    return (
        <div className="publish-modal-overlay" onClick={onClose}>
            <div className="publish-modal" onClick={(e) => e.stopPropagation()}>
                <div className="publish-modal-header">
                    <h2>📢 Publish to Discover</h2>
                    <button className="publish-modal-close" onClick={onClose}>×</button>
                </div>

                <div className="publish-modal-content">
                    {error && <div className="publish-modal-error">{error}</div>}

                    {checkingStatus ? (
                        <div className="publish-modal-loading">Checking publish status...</div>
                    ) : publishedInfo ? (
                        <>
                            <div className="publish-status published">
                                <span className="status-icon">✅</span>
                                <div className="status-info">
                                    <strong>Published to Discover</strong>
                                    <span className="publish-date">Published {formatDate(publishedInfo.published_at)}</span>
                                </div>
                            </div>

                            <div className="publish-stats">
                                <span>👁️ {publishedInfo.view_count} views</span>
                                <span>❤️ {publishedInfo.like_count} likes</span>
                            </div>

                            <div className="publish-form">
                                <label>
                                    <span>Description</span>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Add a description for your published content..."
                                        rows={3}
                                    />
                                </label>

                                <label>
                                    <span>Tags</span>
                                    <TagInput tags={tags} onTagsChange={setTags} />
                                </label>

                            </div>

                            <div className="publish-modal-actions">
                                <button
                                    className="btn-update"
                                    onClick={() => {
                                        setPublishAnonymously(false);
                                        handlePublish();
                                    }}
                                    disabled={loading}
                                >
                                    {loading && !publishAnonymously ? 'Updating...' : `🔄 Update as ${user?.username || user?.email || 'Anonymous'}`}
                                </button>
                                <button
                                    className="btn-update-anonymous"
                                    onClick={() => {
                                        setPublishAnonymously(true);
                                        handlePublish();
                                    }}
                                    disabled={loading}
                                >
                                    {loading && publishAnonymously ? 'Updating...' : '🕵️ Update Anonymously'}
                                </button>
                                <button
                                    className="btn-unpublish"
                                    onClick={handleUnpublish}
                                    disabled={loading}
                                >
                                    Unpublish
                                </button>
                            </div>

                            <a
                                href={`/discover/content/${publishedInfo.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="view-published-link"
                            >
                                View on Discover →
                            </a>
                        </>
                    ) : (
                        <>
                            <div className="publish-status not-published">
                                <span className="status-icon">📝</span>
                                <div className="status-info">
                                    <strong>Not Published</strong>
                                    <span>Share your {contentType} with the community</span>
                                </div>
                            </div>

                            <div className="publish-form">
                                <label>
                                    <span>Title</span>
                                    <input type="text" value={currentTitle} disabled />
                                </label>

                                <label>
                                    <span>Description (optional)</span>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Add a description to help others understand your content..."
                                        rows={3}
                                    />
                                </label>

                                <label>
                                    <span>Tags</span>
                                    <TagInput tags={tags} onTagsChange={setTags} />
                                </label>

                            </div>

                            <div className="publish-modal-actions">
                                <button
                                    className="btn-publish"
                                    onClick={() => {
                                        setPublishAnonymously(false);
                                        handlePublish();
                                    }}
                                    disabled={loading}
                                >
                                    {loading && !publishAnonymously ? 'Publishing...' : `🚀 Publish as ${user?.username || user?.email || 'Anonymous'}`}
                                </button>
                                <button
                                    className="btn-publish-anonymous"
                                    onClick={() => {
                                        setPublishAnonymously(true);
                                        handlePublish();
                                    }}
                                    disabled={loading}
                                >
                                    {loading && publishAnonymously ? 'Publishing...' : '🕵️ Publish Anonymously'}
                                </button>
                            </div>

                            <p className="publish-note">
                                Publishing creates a snapshot of your current content.
                                You can update it anytime to sync changes.
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PublishModal;

