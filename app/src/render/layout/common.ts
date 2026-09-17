/**
 * Shared geometry helpers for the Skia board layout modules
 * (src/render/layout/shuntingLayout.ts, classificationLayout.ts).
 *
 * Pure, framework-free math — importable from Node/Jest.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Point-in-rect test with optional symmetric padding (hitSlop) applied to the rect. */
export function inRectPad(px: number, py: number, r: Rect, pad = 0): boolean {
  return (
    px >= r.x - pad &&
    px <= r.x + r.width + pad &&
    py >= r.y - pad &&
    py <= r.y + r.height + pad
  );
}

/**
 * Car width/gap that fits `count` slots within `available` px, clamped to
 * [min, max] — port of the reference's `getCarDims`/design-system §2.2 clamp
 * formula, shared by both boards (shunting capacity, classification
 * arrSlots/clasSlots).
 */
export function fitCarDims(
  count: number,
  available: number,
  gap: number,
  min: number,
  max: number
): { width: number; gap: number } {
  if (count <= 0) return { width: max, gap };
  const raw = Math.floor((available - (count - 1) * gap) / count);
  return { width: clamp(raw, min, max), gap };
}

/**
 * Along-track (plane-u) footprint reserved for a dead-end buffer stop —
 * shared between the layout that carves the room out of the fixed
 * `capacityColumnWidth` column (shuntingLayout.ts) and the primitive that
 * draws the stop itself (primitives/BufferStop.tsx), so the two can never
 * drift out of sync. Fixed plane-unit constants rather than a fraction of
 * `ballastWidth`: they bound HORIZONTAL room in a column whose width is
 * itself fixed by design/tokens.ts, not something that grows with the rail's
 * own gauge (the buffer's cross-gauge sizing, which *should* track
 * `ballastWidth`, is computed inside BufferStop.tsx from the `ballastWidth`
 * prop it already receives).
 *
 *   … last car … ⟵BUFFER_STOP_GAP⟶ [ BUFFER_STOP_DEPTH: heads‧beam‧block ] ⟵BUFFER_STOP_BADGE_GAP⟶ "n/cap" …
 */
export const BUFFER_STOP_GAP = 4;
export const BUFFER_STOP_DEPTH = 16;
export const BUFFER_STOP_BADGE_GAP = 6;
