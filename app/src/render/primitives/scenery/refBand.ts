/**
 * Shared geometry constants for the sky band, factored out so `IsoSky.tsx`
 * (the pre-existing sun/stars/hill/water-tower/gantry backdrop) and
 * `IsoScenery.tsx` (the new per-section prop kit, design/scenery-spec.md)
 * agree on the same normalized band and never duplicate the hill polyline.
 *
 * Both files scale this 960×200 reference band to `width × horizonY` at
 * render time — see either file's `sx`/`sy` derivation.
 */

export const REF_W = 960;
export const REF_H = 200;

/** Reference hill silhouette, in 960×200 space. Identical in every section —
 *  see scenery-spec.md §2.1, "the one constant that says 'same yard'". */
export const HILL = [
  [0, 168],
  [130, 128],
  [260, 158],
  [390, 132],
  [560, 168],
  [700, 140],
  [860, 164],
  [960, 146],
] as const;

/** Reference star field, in 960×200 space: [x, y, r]. */
export const STARS = [
  [80, 28, 1.4],
  [150, 54, 1],
  [260, 22, 1.2],
  [360, 46, 1],
  [470, 16, 1.4],
  [560, 42, 1],
  [680, 24, 1.2],
  [770, 52, 1],
  [860, 18, 1.4],
  [920, 58, 1],
] as const;

/**
 * Fence line band (scenery-spec.md §2.1's "second constant"): runs the FULL
 * width just above the horizon, in every section, on both shunting and
 * classification boards. y is in 960×200 reference units.
 */
export const FENCE_Y0 = 150;
export const FENCE_Y1 = 168;

/**
 * The three fixed horizontal slots new per-section props render in, in
 * 960-wide reference-band units (scenery-spec.md §2.2). Each slot is a
 * (x0, x1) box; a prop is centred/scaled to fit inside it.
 */
export const SCENERY_SLOTS = {
  left: { x0: 60, x1: 260 },
  center: { x0: 380, x1: 580 },
  right: { x0: 700, x1: 900 },
} as const;

export type SceneryFixedSlot = keyof typeof SCENERY_SLOTS;
