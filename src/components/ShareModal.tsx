import React, { useState, useEffect } from 'react';
import './ShareModal.css';

export type PermissionLevel = 'owner' | 'edit' | 'view' | 'none';

interface Collaborator {
  userId: string;
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
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [newUserInput, setNewUserInput] = useState('');
  const [newUserPermission, setNewUserPermission] = useState<'edit' | 'view'>('view');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Determine if current user can manage permissions
  const canManagePermissions = currentUserPermission === 'owner' || currentUserPermission === 'edit';
  const canGrantEdit = currentUserPermission === 'owner' || currentUserPermission === 'edit';

  useEffect(() => {
    if (isOpen) {
      loadCollaborators();
    }
  }, [isOpen, sessionId]);

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
        
        // Add owner
        if (result.data.user_id) {
          collabs.push({
            userId: result.data.user_id,
            permission: 'owner'
          });
        }

        // Add edit users
        if (result.data.edit_users) {
          result.data.edit_users.forEach((userId: string) => {
            collabs.push({ userId, permission: 'edit' });
          });
        }

        // Add view users
        if (result.data.view_users) {
          result.data.view_users.forEach((userId: string) => {
            collabs.push({ userId, permission: 'view' });
          });
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
                      <span className="collaborator-id">{collab.userId}</span>
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
        </div>
      </div>
    </div>
  );
};

