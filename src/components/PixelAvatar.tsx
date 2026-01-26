/**
 * PixelAvatar Component
 * Renders pixel art avatars as SVG
 * Used across the app for user avatars
 */

import React, { useMemo } from 'react';
import { 
  deserializeAvatar, 
  generateSeededAvatar, 
  migrateAvatar,
  GRID_SIZE,
  DEFAULT_BG_COLOR
} from '../utils/pixelArtAvatar';

interface PixelAvatarProps {
  avatarData?: string | null;
  userId: string;
  size?: number;
  className?: string;
}

const PixelAvatar: React.FC<PixelAvatarProps> = ({ 
  avatarData, 
  userId, 
  size = 36,
  className = ''
}) => {
  const grid = useMemo(() => {
    if (avatarData) {
      const parsed = deserializeAvatar(avatarData);
      if (parsed) return migrateAvatar(parsed);
    }
    return generateSeededAvatar(userId);
  }, [avatarData, userId]);

  const pixelSize = size / GRID_SIZE;

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      style={{ borderRadius: '4px', overflow: 'hidden' }}
    >
      {/* Background */}
      <rect x={0} y={0} width={size} height={size} fill={DEFAULT_BG_COLOR} />
      
      {/* Pixels */}
      {grid.map((row, y) =>
        row.map((color, x) => (
          color !== 'transparent' && color !== DEFAULT_BG_COLOR && (
            <rect
              key={`${x}-${y}`}
              x={x * pixelSize}
              y={y * pixelSize}
              width={pixelSize}
              height={pixelSize}
              fill={color}
            />
          )
        ))
      )}
    </svg>
  );
};

export default PixelAvatar;

