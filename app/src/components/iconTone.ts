/** True when a `#rrggbb` colour is light (relative luminance); anything else counts as dark. */
function isLight(hex: string): boolean {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const lum = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  return lum > 128;
}

/**
 * Translucent overlay that turns one palette colour into a second livery
 * tone for the entry-screen icons (LocoIcon, ClassificationIcon): white over
 * a dark colour, black over a light one, so the two tones stay distinct in
 * every time-of-day pass. Paint it on top of a shape already filled with
 * `color`.
 */
export function secondToneOverlay(color: string): { fill: string; fillOpacity: number } {
  return isLight(color) ? { fill: '#000', fillOpacity: 0.3 } : { fill: '#fff', fillOpacity: 0.4 };
}
