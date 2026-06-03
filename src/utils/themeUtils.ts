export function hexToRgb(hex: string) {
  const sanitized = hex.replace('#', '');
  if (sanitized.length === 3) {
    const r = parseInt(sanitized[0] + sanitized[0], 16);
    const g = parseInt(sanitized[1] + sanitized[1], 16);
    const b = parseInt(sanitized[2] + sanitized[2], 16);
    return { r, g, b };
  }
  const r = parseInt(sanitized.substring(0, 2), 16);
  const g = parseInt(sanitized.substring(2, 4), 16);
  const b = parseInt(sanitized.substring(4, 6), 16);
  return {
    r: isNaN(r) ? 0 : r,
    g: isNaN(g) ? 0 : g,
    b: isNaN(b) ? 0 : b
  };
}

/**
 * Calculates contrasting text color for a background hex color.
 * Priority:
 * 1. Branco (#ffffff)
 * 2. Preto (#000000)
 * 3. Vermelho (#ef4444) - Only for customized combinations
 */
export function getAutoTextColor(bgColorHex: string): string {
  try {
    const { r, g, b } = hexToRgb(bgColorHex);
    // Relative luminance formula: 0.299R + 0.587G + 0.114B
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // If it's a light background (luminance > 0.5), use black text
    if (luminance > 0.5) {
      return '#000000';
    } else {
      // If dark background (luminance <= 0.5), use white text (Priority 1)
      return '#ffffff';
    }
  } catch (e) {
    return '#ffffff';
  }
}
