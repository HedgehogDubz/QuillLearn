import React, { useState, useEffect, useCallback, useRef } from 'react';
import './ShareModal.css';
import { useAuth } from '../auth/AuthContext';

export type PermissionLevel = 'owner' | 'edit' | 'view' | 'none';

interface Collaborator {
  userId: string;
  username?: string;
  email?: string;
  permission: PermissionLevel;
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  documentType: 'sheet' | 'note';
  currentUserId: string;
  currentUserPermission: PermissionLevel;
  onShareUpdate?: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  sessionId,
  documentType,
  currentUserId,
  currentUserPermission,
  onShareUpdate
}) => {
  const { user } = useAuth();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [newUserInput, setNewUserInput] = useState('');
  const [newUserPermission, setNewUserPermission] = useState<'edit' | 'view'>('view');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [publicDescription, setPublicDescription] = useState('');
  const [publicLoading, setPublicLoading] = useState(false);
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const descriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Determine if current user can manage permissions
  const canManagePermissions = currentUserPermission === 'owner' || currentUserPermission === 'edit';
  const canGrantEdit = currentUserPermission === 'owner' || currentUserPermission === 'edit';

  useEffect(() => {
    if (isOpen) {
      loadCollaborators();
      loadPublicStatus();
    }
  }, [isOpen, sessionId]);

  // Auto-save description with debounce
  const autoSaveDescription = useCallback(async (description: string) => {
    if (!isPublic || currentUserPermission !== 'owner') return;

    try {
      const endpoint = documentType === 'sheet'
        ? `/api/sheets/${sessionId}/public-description`
        : `/api/notes/${sessionId}/public-description`;

      await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          description
        })
      });
    } catch (err) {
      console.error('Error auto-saving description:', err);
    }
  }, [isPublic, currentUserPermission, documentType, sessionId, currentUserId]);

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newDescription = e.target.value;
    setPublicDescription(newDescription);

    // Clear existing timeout
    if (descriptionTimeoutRef.current) {
      clearTimeout(descriptionTimeoutRef.current);
    }

    // Set new timeout for auto-save (1 second debounce)
    descriptionTimeoutRef.current = setTimeout(() => {
      autoSaveDescription(newDescription);
    }, 1000);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (descriptionTimeoutRef.current) {
        clearTimeout(descriptionTimeoutRef.current);
      }
    };
  }, []);

  const loadPublicStatus = async () => {
    try {
      const endpoint = documentType === 'sheet'
        ? `/api/sheets/${sessionId}`
        : `/api/notes/${sessionId}`;

      const response = await fetch(endpoint);
      const result = await response.json();

      if (result.success && result.data) {
        setIsPublic(result.data.is_public || false);
        setPublicDescription(result.data.description || '');
      }
    } catch (err) {
      console.error('Error loading public status:', err);
    }
  };

  const handleTogglePublic = async () => {
    if (currentUserPermission !== 'owner') {
      setError('Only the owner can change public visibility');
      return;
    }

    try {
      setPublicLoading(true);
      setError(null);

      const endpoint = documentType === 'sheet'
        ? `/api/sheets/${sessionId}/public`
        : `/api/notes/${sessionId}/public`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          username: user?.username || 'Anonymous',
          isPublic: !isPublic,
          description: publicDescription
        })
      });

      const result = await response.json();

      if (result.success) {
        setIsPublic(!isPublic);
        if (result.snapshotId) {
          setSnapshotId(result.snapshotId);
        }
        setSuccess(!isPublic ? 'Published to Discover! A snapshot copy has been created.' : 'Unpublished from Discover');
        onShareUpdate?.();
      } else {
        setError(result.error || 'Failed to update public status');
      }
    } catch (err) {
      console.error('Error toggling public:', err);
      setError('Failed to update public status');
    } finally {
      setPublicLoading(false);
    }
  };

  const loadCollaborators = async () => {
    try {
      setLoading(true);
      const endpoint = documentType === 'sheet'
        ? `/api/sheets/${sessionId}`
        : `/api/notes/${sessionId}`;

      const response = await fetch(endpoint);
      const result = await response.json();

      if (result.success && result.data) {
        const collabs: Collaborator[] = [];
        const userIds: string[] = [];

        // Add owner
        if (result.data.user_id) {
          collabs.push({
            userId: result.data.user_id,
            permission: 'owner'
          });
          userIds.push(result.data.user_id);
        }

        // Add edit users
        if (result.data.edit_users) {
          result.data.edit_users.forEach((userId: string) => {
            collabs.push({ userId, permission: 'edit' });
            userIds.push(userId);
          });
        }

        // Add view users
        if (result.data.view_users) {
          result.data.view_users.forEach((userId: string) => {
            collabs.push({ userId, permission: 'view' });
            userIds.push(userId);
          });
        }

        // Fetch usernames for all user IDs
        if (userIds.length > 0) {
          try {
            const lookupResponse = await fetch('/api/auth/lookup-users', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userIds })
            });
            const lookupResult = await lookupResponse.json();

            if (lookupResult.success && lookupResult.users) {
              // Update collaborators with usernames
              collabs.forEach(collab => {
                const userInfo = lookupResult.users[collab.userId];
                if (userInfo) {
                  collab.username = userInfo.username;
                  collab.email = userInfo.email;
                }
              });
            }
          } catch (lookupErr) {
            console.error('Error looking up usernames:', lookupErr);
          }
        }

        setCollaborators(collabs);
      }
    } catch (err) {
      console.error('Error loading collaborators:', err);
      setError('Failed to load collaborators');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUserInput.trim()) {
      setError('Please enter an email or username');
      return;
    }

    if (!canManagePermissions) {
      setError('You do not have permission to share this document');
      return;
    }

    if (!canGrantEdit && newUserPermission === 'edit') {
      setError('You can only grant view access');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const endpoint = documentType === 'sheet'
        ? `/api/sheets/${sessionId}/share`
        : `/api/notes/${sessionId}/share`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUserId,
          action: 'add',
          targetUser: newUserInput.trim(),
          permission: newUserPermission
        })
      });

      const result = await response.json();

      if (result.success) {
        // Show username and email if available from the response
        const addedUser = result.data?.added_user;
        let successMessage = `Successfully added with ${newUserPermission} access`;

        if (addedUser) {
          successMessage = `Successfully added ${addedUser.username} (${addedUser.email}) with ${newUserPermission} access`;
        } else {
          successMessage = `Successfully added ${newUserInput} with ${newUserPermission} access`;
        }

        setSuccess(successMessage);
        setNewUserInput('');
        await loadCollaborators();
        onShareUpdate?.();
      } else {
        setError(result.error || 'Failed to add user');
      }
    } catch (err) {
      console.error('Error adding user:', err);
      setError('Failed to add user');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = async (targetUser: string) => {
    if (!canManagePermissions) {
      setError('You do not have permission to remove users');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const endpoint = documentType === 'sheet'
        ? `/api/sheets/${sessionId}/share`
        : `/api/notes/${sessionId}/share`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUserId,
          action: 'remove',
          targetUser
        })
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(`Successfully removed ${targetUser}`);
        await loadCollaborators();
        onShareUpdate?.();
      } else {
        setError(result.error || 'Failed to remove user');
      }
    } catch (err) {
      console.error('Error removing user:', err);
      setError('Failed to remove user');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePermission = async (targetUser: string, newPermission: 'edit' | 'view') => {
    if (!canManagePermissions) {
      setError('You do not have permission to change permissions');
      return;
    }

    if (!canGrantEdit && newPermission === 'edit') {
      setError('You can only grant view access');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const endpoint = documentType === 'sheet'
        ? `/api/sheets/${sessionId}/share`
        : `/api/notes/${sessionId}/share`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUserId,
          action: 'change',
          targetUser,
          permission: newPermission
        })
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(`Successfully changed ${targetUser}'s permission to ${newPermission}`);
        await loadCollaborators();
        onShareUpdate?.();
      } else {
        setError(result.error || 'Failed to change permission');
      }
    } catch (err) {
      console.error('Error changing permission:', err);
      setError('Failed to change permission');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal" onClick={(e) => e.stopPropagation()}>
        <div className="share-modal-header">
          <h2>Share {documentType === 'sheet' ? 'Sheet' : 'Document'}</h2>
          <button className="share-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="share-modal-content">
          {error && <div className="share-modal-error">{error}</div>}
          {success && <div className="share-modal-success">{success}</div>}

          {canManagePermissions && (
            <div className="share-modal-add-user">
              <input
                type="text"
                placeholder="Enter email or username"
                value={newUserInput}
                onChange={(e) => setNewUserInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddUser()}
                disabled={loading}
              />
              <select
                value={newUserPermission}
                onChange={(e) => setNewUserPermission(e.target.value as 'edit' | 'view')}
                disabled={loading || !canGrantEdit}
              >
                {canGrantEdit && <option value="edit">Can edit</option>}
                <option value="view">Can view</option>
              </select>
              <button onClick={handleAddUser} disabled={loading}>
                Add
              </button>
            </div>
          )}

          <div className="share-modal-collaborators">
            <h3>People with access</h3>
            {loading && collaborators.length === 0 ? (
              <div className="share-modal-loading">Loading...</div>
            ) : (
              <ul>
                {collaborators.map((collab) => (
                  <li key={collab.userId} className="share-modal-collaborator">
                    <div className="collaborator-info">
                      <div className="collaborator-details">
                        <span className="collaborator-name">
                          {collab.username || 'Unknown User'}
                        </span>
                        {collab.email && (
                          <span className="collaborator-email">{collab.email}</span>
                        )}
                      </div>
                      <span className={`collaborator-badge ${collab.permission}`}>
                        {collab.permission === 'owner' && '👑 Owner'}
                        {collab.permission === 'edit' && '✏️ Can edit'}
                        {collab.permission === 'view' && '👁️ Can view'}
                      </span>
                    </div>
                    {canManagePermissions && collab.permission !== 'owner' && (
                      <div className="collaborator-actions">
                        {canGrantEdit && collab.permission !== 'edit' && (
                          <button
                            onClick={() => handleChangePermission(collab.userId, 'edit')}
                            disabled={loading}
                            className="btn-small"
                          >
                            Make editor
                          </button>
                        )}
                        {collab.permission !== 'view' && (
                          <button
                            onClick={() => handleChangePermission(collab.userId, 'view')}
                            disabled={loading}
                            className="btn-small"
                          >
                            Make viewer
                          </button>
                        )}
                        <button
                          onClick={() => handleRemoveUser(collab.userId)}
                          disabled={loading}
                          className="btn-small btn-danger"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Public Sharing Section */}
          {currentUserPermission === 'owner' && (
            <div className="share-modal-public">
              <h3>🌐 Public Sharing</h3>
              <p className="public-description">
                Publish a snapshot of this {documentType} to the Discover page.
                The published version won't change unless you update it.
              </p>

              <div className="public-toggle">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={handleTogglePublic}
                    disabled={publicLoading}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <span className={`public-status ${isPublic ? 'active' : ''}`}>
                  {isPublic ? 'Published' : 'Not Published'}
                </span>
              </div>

              {isPublic && (
                <div className="public-details">
                  <div className="public-info">
                    <span className="info-badge">📸 Snapshot published as: {user?.username || 'Anonymous'}</span>
                  </div>
                  <label>Description (auto-saves)</label>
                  <textarea
                    value={publicDescription}
                    onChange={handleDescriptionChange}
                    placeholder="Add a description to help others find your content..."
                    rows={2}
                    maxLength={200}
                  />
                  <p className="public-link">
                    🔗 <a href={`/discover/${documentType}/${snapshotId || sessionId}`} target="_blank" rel="noopener noreferrer">
                      View on Discover
                    </a>
                  </p>
                  <p className="public-note">
                    💡 To update the published content, toggle off and on again.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

