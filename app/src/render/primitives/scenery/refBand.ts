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
 * The horizontal slots new per-section props render in, in 960-wide
 * reference-band units (scenery-spec.md §2.2). Each slot is a (x0, x1) box; a
 * prop is centred/scaled to fit inside it.
 *
 * `left`/`center`/`right` are the ORIGINAL three slots (unchanged — every
 * existing recipe keeps addressing them by these exact names/bounds).
 *
 * `edgeLeft`/`edgeRight`/`gapLeft`/`gapRight` close the four structurally
 * empty stretches those three slots left behind (0–60, 260–380, 580–700,
 * 900–960 — 37.5% of the band's width, on every section, regardless of
 * track count). This only became visible on wide viewports (see the user
 * report that added these slots) because the gaps scale with `sx = width /
 * REF_W` just like everything else — small in absolute dp on a narrow phone,
 * large on a wide window. `edgeLeft`/`edgeRight` sit near the band's true
 * ends and are populated in EVERY recipe (including the sparsest) so the
 * canvas never reads as dead-stopping at its own edges; `gapLeft`/`gapRight`
 * bridge the two inter-slot gaps and are populated in MOST recipes (the
 * default), with a fully-bare gap being the deliberate exception, not the
 * norm.
 */
export const SCENERY_SLOTS = {
  edgeLeft: { x0: 4, x1: 52 },
  left: { x0: 60, x1: 260 },
  gapLeft: { x0: 272, x1: 368 },
  center: { x0: 380, x1: 580 },
  gapRight: { x0: 592, x1: 688 },
  right: { x0: 700, x1: 900 },
  edgeRight: { x0: 908, x1: 956 },
} as const;

export type SceneryFixedSlot = keyof typeof SCENERY_SLOTS;
