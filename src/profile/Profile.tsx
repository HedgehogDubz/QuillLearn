import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { authFetch } from '../utils/api';
import type { PixelGrid } from '../utils/pixelArtAvatar';
import {
  generateSeededAvatar,
  generateRandomAvatar,
  serializeAvatar,
  deserializeAvatar,
  DEFAULT_PALETTE,
  DEFAULT_BG_COLOR,
  GRID_SIZE,
  imageToPixelArt,
  extractPaletteFromImage,
  migrateAvatar
} from '../utils/pixelArtAvatar';
import './Profile.css';

const Profile: React.FC = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [username, setUsername] = useState(user?.username || '');
  const [avatar, setAvatar] = useState<PixelGrid>(() => {
    if (user?.avatar) {
      const parsed = deserializeAvatar(user.avatar);
      if (parsed) return migrateAvatar(parsed); // Migrate transparent to bg color
    }
    return user?.id ? generateSeededAvatar(user.id) : generateRandomAvatar();
  });
  const [palette, setPalette] = useState<string[]>(DEFAULT_PALETTE);
  const [selectedColor, setSelectedColor] = useState(DEFAULT_PALETTE[0]);
  const [customColorInput, setCustomColorInput] = useState('#FF0000');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPaletteEditor, setShowPaletteEditor] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const handlePixelClick = useCallback((row: number, col: number) => {
    setAvatar(prev => {
      const newGrid = prev.map(r => [...r]);
      // Toggle between selected color and background color (no transparent)
      newGrid[row][col] = newGrid[row][col] === selectedColor ? DEFAULT_BG_COLOR : selectedColor;
      return newGrid;
    });
  }, [selectedColor]);

  const handleRandomize = () => {
    setAvatar(generateRandomAvatar(palette));
  };

  const handleClear = () => {
    setAvatar(Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(DEFAULT_BG_COLOR)));
  };

  const handleAddCustomColor = () => {
    if (customColorInput && !palette.includes(customColorInput.toUpperCase())) {
      setPalette(prev => [...prev, customColorInput.toUpperCase()]);
      setSelectedColor(customColorInput.toUpperCase());
    }
  };

  const handleRemoveColor = (colorToRemove: string) => {
    if (palette.length > 1) {
      setPalette(prev => prev.filter(c => c !== colorToRemove));
      if (selectedColor === colorToRemove) {
        setSelectedColor(palette[0] === colorToRemove ? palette[1] : palette[0]);
      }
    }
  };

  const handleResetPalette = () => {
    setPalette(DEFAULT_PALETTE);
    setSelectedColor(DEFAULT_PALETTE[0]);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Resize image to a reasonable size for processing
        const maxSize = 100;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);

        // Convert to pixel art
        const newAvatar = imageToPixelArt(imageData);
        setAvatar(newAvatar);

        // Extract palette from image
        const newPalette = extractPaletteFromImage(imageData);
        setPalette(newPalette);
        setSelectedColor(newPalette[0]);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await authFetch(`/api/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          username: username !== user.username ? username : undefined,
          avatar: serializeAvatar(avatar)
        })
      });

      const data = await response.json();

      if (data.success) {
        updateUser({ username, avatar: serializeAvatar(avatar) });
        setSuccess('Profile updated successfully!');
      } else {
        setError(data.error || 'Failed to update profile');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="profile-page">
      <div className="profile-container">
        <h1 className="profile-title">Edit Profile</h1>
        
        {error && <div className="profile-error">{error}</div>}
        {success && <div className="profile-success">{success}</div>}

        <div className="profile-section">
          <label className="profile-label">Avatar</label>
          <div className="avatar-editor">
            <div className="pixel-grid">
              {avatar.map((row, rowIndex) => (
                <div key={rowIndex} className="pixel-row">
                  {row.map((color, colIndex) => (
                    <div
                      key={colIndex}
                      className="pixel"
                      style={{ backgroundColor: color === 'transparent' ? 'var(--bg-secondary)' : color }}
                      onClick={() => handlePixelClick(rowIndex, colIndex)}
                    />
                  ))}
                </div>
              ))}
            </div>
            
            <div className="avatar-controls">
              <div className="palette-header">
                <span className="palette-label">Color Palette</span>
                <button
                  className="palette-toggle-btn"
                  onClick={() => setShowPaletteEditor(!showPaletteEditor)}
                >
                  {showPaletteEditor ? 'Hide Editor' : 'Edit Palette'}
                </button>
              </div>

              <div className="color-palette">
                {palette.map(color => (
                  <div key={color} className="color-swatch-container">
                    <button
                      className={`color-swatch ${selectedColor === color ? 'selected' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setSelectedColor(color)}
                    />
                    {showPaletteEditor && (
                      <button
                        className="remove-color-btn"
                        onClick={() => handleRemoveColor(color)}
                        title="Remove color"
                      >×</button>
                    )}
                  </div>
                ))}
                <button
                  className={`color-swatch bg-color ${selectedColor === DEFAULT_BG_COLOR ? 'selected' : ''}`}
                  style={{ backgroundColor: DEFAULT_BG_COLOR }}
                  onClick={() => setSelectedColor(DEFAULT_BG_COLOR)}
                  title="Background color (eraser)"
                />
              </div>

              {showPaletteEditor && (
                <div className="palette-editor">
                  <div className="add-color-row">
                    <input
                      type="color"
                      value={customColorInput}
                      onChange={(e) => setCustomColorInput(e.target.value)}
                      className="color-picker"
                    />
                    <input
                      type="text"
                      value={customColorInput}
                      onChange={(e) => setCustomColorInput(e.target.value)}
                      className="color-input"
                      placeholder="#FF0000"
                    />
                    <button onClick={handleAddCustomColor} className="btn-small">Add</button>
                  </div>
                  <button onClick={handleResetPalette} className="btn-small btn-secondary">
                    Reset to Default
                  </button>
                </div>
              )}

              <div className="avatar-buttons">
                <button onClick={handleRandomize} className="btn-secondary">Randomize</button>
                <button onClick={handleClear} className="btn-secondary">Clear</button>
                <button onClick={() => fileInputRef.current?.click()} className="btn-secondary">
                  Import Image
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
          </div>
        </div>

        <div className="profile-section">
          <label className="profile-label" htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="profile-input"
            placeholder="Enter username"
          />
        </div>

        <div className="profile-actions">
          <button onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;

