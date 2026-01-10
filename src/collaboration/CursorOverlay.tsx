import React from 'react';
import './CursorOverlay.css';
import type { UserPresence } from './PresenceService';

interface CursorOverlayProps {
  users: UserPresence[];
  containerRef?: React.RefObject<HTMLElement>;
}

export const CursorOverlay: React.FC<CursorOverlayProps> = ({ users }) => {
  return (
    <div className="cursor-overlay">
      {users.map((user) => {
        if (!user.cursorPosition) return null;

        const { x, y } = user.cursorPosition;
        if (x === undefined || y === undefined) return null;

        return (
          <div
            key={user.userId}
            className="remote-cursor"
            style={{
              left: `${x}px`,
              top: `${y}px`,
              borderColor: user.color
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2 2L18 10L10 12L8 18L2 2Z"
                fill={user.color}
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            <div
              className="remote-cursor-label"
              style={{ backgroundColor: user.color }}
            >
              {user.userName || user.userEmail || user.userId}
            </div>
          </div>
        );
      })}
    </div>
  );
};

