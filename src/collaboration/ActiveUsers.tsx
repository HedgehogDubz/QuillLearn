import React from 'react';
import './ActiveUsers.css';
import type { UserPresence } from './PresenceService';

interface ActiveUsersProps {
  users: UserPresence[];
}

export const ActiveUsers: React.FC<ActiveUsersProps> = ({ users }) => {
  if (users.length === 0) {
    return null;
  }

  return (
    <div className="active-users">
      <div className="active-users-label">Active now:</div>
      <div className="active-users-list">
        {users.map((user) => (
          <div
            key={user.userId}
            className="active-user-avatar"
            style={{ backgroundColor: user.color }}
            title={user.userName || user.userEmail || user.userId}
          >
            {(user.userName || user.userEmail || user.userId).charAt(0).toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  );
};

