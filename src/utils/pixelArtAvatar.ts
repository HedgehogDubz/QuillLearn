/**
 * Pixel Art Avatar Generator
 *
 * Generates and renders 10x10 pixel art avatars
 * Avatar data is stored as a 2D array of color hex strings
 */

// Default color palette for random generation
export const DEFAULT_PALETTE = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#96CEB4', // Mint
  '#FFEAA7', // Yellow
  '#DDA0DD', // Plum
  '#98D8C8', // Sea Green
  '#F7DC6F', // Gold
  '#BB8FCE', // Purple
  '#85C1E9', // Sky Blue
  '#F8B500', // Orange
  '#00CED1', // Dark Cyan
];

// Default background color (used instead of transparent)
export const DEFAULT_BG_COLOR = '#2D3748';

export const GRID_SIZE = 10;

export type PixelGrid = string[][];

/**
 * Generate a random pixel art avatar
 * Creates a symmetrical pattern for aesthetic appeal
 * No transparent pixels - uses background color instead
 */
export function generateRandomAvatar(palette: string[] = DEFAULT_PALETTE, bgColor: string = DEFAULT_BG_COLOR): PixelGrid {
  const grid: PixelGrid = [];
  const halfWidth = Math.ceil(GRID_SIZE / 2);

  for (let y = 0; y < GRID_SIZE; y++) {
    const row: string[] = [];
    for (let x = 0; x < halfWidth; x++) {
      // Random chance for pixel to be colored vs background
      const hasColor = Math.random() > 0.3;
      const color = hasColor
        ? palette[Math.floor(Math.random() * palette.length)]
        : bgColor;
      row.push(color);
    }

    // Mirror the row for symmetry
    const mirroredPart = [...row].reverse();
    if (GRID_SIZE % 2 === 0) {
      grid.push([...row, ...mirroredPart]);
    } else {
      // For odd width, don't duplicate the middle column
      grid.push([...row, ...mirroredPart.slice(1)]);
    }
  }

  return grid;
}

/**
 * Serialize pixel grid to JSON string for storage
 */
export function serializeAvatar(grid: PixelGrid): string {
  return JSON.stringify(grid);
}

/**
 * Deserialize JSON string to pixel grid
 */
export function deserializeAvatar(data: string): PixelGrid | null {
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed) && parsed.length === GRID_SIZE) {
      return parsed as PixelGrid;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Create a blank avatar grid
 */
export function createBlankAvatar(fillColor: string = DEFAULT_BG_COLOR): PixelGrid {
  return Array(GRID_SIZE).fill(null).map(() =>
    Array(GRID_SIZE).fill(fillColor)
  );
}

/**
 * Generate a deterministic avatar based on a seed string (like user ID)
 * No transparent pixels - uses background color instead
 */
export function generateSeededAvatar(seed: string, palette: string[] = DEFAULT_PALETTE, bgColor: string = DEFAULT_BG_COLOR): PixelGrid {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  // Use hash as seed for pseudo-random generation
  const seededRandom = (index: number) => {
    const x = Math.sin(hash + index) * 10000;
    return x - Math.floor(x);
  };

  const grid: PixelGrid = [];
  const halfWidth = Math.ceil(GRID_SIZE / 2);
  let randomIndex = 0;

  for (let y = 0; y < GRID_SIZE; y++) {
    const row: string[] = [];
    for (let x = 0; x < halfWidth; x++) {
      const hasColor = seededRandom(randomIndex++) > 0.3;
      const colorIndex = Math.floor(seededRandom(randomIndex++) * palette.length);
      const color = hasColor ? palette[colorIndex] : bgColor;
      row.push(color);
    }

    const mirroredPart = [...row].reverse();
    if (GRID_SIZE % 2 === 0) {
      grid.push([...row, ...mirroredPart]);
    } else {
      grid.push([...row, ...mirroredPart.slice(1)]);
    }
  }

  return grid;
}

/**
 * Convert an image to pixel art grid
 * Resizes and samples the image to fit the grid
 */
export function imageToPixelArt(imageData: ImageData): PixelGrid {
  const grid: PixelGrid = [];
  const cellWidth = imageData.width / GRID_SIZE;
  const cellHeight = imageData.height / GRID_SIZE;

  for (let y = 0; y < GRID_SIZE; y++) {
    const row: string[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      // Sample the center of each cell
      const sampleX = Math.floor(x * cellWidth + cellWidth / 2);
      const sampleY = Math.floor(y * cellHeight + cellHeight / 2);
      const pixelIndex = (sampleY * imageData.width + sampleX) * 4;

      const r = imageData.data[pixelIndex];
      const g = imageData.data[pixelIndex + 1];
      const b = imageData.data[pixelIndex + 2];
      const a = imageData.data[pixelIndex + 3];

      // If pixel is mostly transparent, use background color
      if (a < 128) {
        row.push(DEFAULT_BG_COLOR);
      } else {
        row.push(rgbToHex(r, g, b));
      }
    }
    grid.push(row);
  }

  return grid;
}

/**
 * Extract dominant colors from an image to create a palette
 */
export function extractPaletteFromImage(imageData: ImageData, numColors: number = 12): string[] {
  const colorCounts = new Map<string, number>();

  // Sample pixels throughout the image
  const step = Math.max(1, Math.floor(imageData.data.length / 4 / 1000));

  for (let i = 0; i < imageData.data.length; i += step * 4) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];
    const a = imageData.data[i + 3];

    // Skip transparent pixels
    if (a < 128) continue;

    // Quantize colors to reduce noise (round to nearest 16)
    const qr = Math.round(r / 32) * 32;
    const qg = Math.round(g / 32) * 32;
    const qb = Math.round(b / 32) * 32;

    const hex = rgbToHex(qr, qg, qb);
    colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
  }

  // Sort by frequency and take top colors
  const sortedColors = Array.from(colorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([color]) => color)
    .slice(0, numColors);

  // If we don't have enough colors, pad with defaults
  while (sortedColors.length < numColors) {
    const defaultColor = DEFAULT_PALETTE[sortedColors.length % DEFAULT_PALETTE.length];
    if (!sortedColors.includes(defaultColor)) {
      sortedColors.push(defaultColor);
    } else {
      sortedColors.push(DEFAULT_PALETTE[(sortedColors.length + 1) % DEFAULT_PALETTE.length]);
    }
  }

  return sortedColors;
}

/**
 * Convert RGB values to hex color string
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.min(255, Math.max(0, x)).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('').toUpperCase();
}

/**
 * Convert hex color string to RGB values
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Migrate old avatar data that may contain 'transparent' to use background color
 */
export function migrateAvatar(grid: PixelGrid, bgColor: string = DEFAULT_BG_COLOR): PixelGrid {
  return grid.map(row =>
    row.map(color => color === 'transparent' ? bgColor : color)
  );
}

