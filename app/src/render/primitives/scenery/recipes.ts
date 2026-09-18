/**
 * Per-section scenery recipes — design/scenery-spec.md §2.2 (Zone A / sky
 * band) plus a derived Zone B (foreground apron) pick per section, gated by
 * `foregroundMarginPlane` at render time (see IsoScenery.tsx / §2.3).
 *
 * Pure data + pure lookup functions — no React/Skia imports — so the
 * recipe table is trivially unit-testable and shared between the shunting
 * and classification boards.
 *
 * `SHUNTING_SECTION_SIZE` is imported from `src/controller/sections.ts`
 * rather than re-declared, per the spec's explicit instruction not to
 * re-implement that arithmetic.
 */

import { SHUNTING_SECTION_SIZE } from '../../../controller/sections';
import { containerHues, destinationColors } from '../../../../design/tokens';

export type SceneryPropKind =
  | 'signagePost'
  | 'warehouse'
  | 'lampPost'
  | 'containerStack'
  | 'controlTower'
  | 'gantryCrane'
  | 'forklift'
  | 'bushClump';

export interface SceneryElement {
  kind: SceneryPropKind;
  /** Warehouse only: how many roller doors (1–3). */
  doors?: 1 | 2 | 3;
  /** Warehouse/controlTower: a visually shorter/taller variant of the same prop. */
  short?: boolean;
  tall?: boolean;
  /** ContainerStack only: how many boxes side by side. */
  count?: 2 | 3;
  /** ContainerStack only: fixed hues to use instead of the default set. */
  hues?: readonly string[];
  /** SignagePost only: draw the "sorting" arrow (Clasificación's wink, R5). */
  arrow?: boolean;
}

/** One sky-band slot's contents — 0, 1 or (rarely) 2 props side by side. */
export type SceneryScene = SceneryElement[];

export interface SceneryRecipe {
  name: string;
  /** Near the band's true left/right ends (scenery-spec.md's slot-gap fix) —
   *  populated in EVERY recipe, sparsest included, so the canvas never reads
   *  as dead-stopping at its own horizontal edges on a wide viewport. */
  edgeLeft: SceneryScene;
  left: SceneryScene;
  /** Bridges the left↔center inter-slot gap — populated by default; a bare
   *  gap is the deliberate exception, not the norm (scenery-spec.md). */
  gapLeft: SceneryScene;
  center: SceneryScene;
  /** Bridges the center↔right inter-slot gap — same default-populated rule
   *  as `gapLeft`. */
  gapRight: SceneryScene;
  right: SceneryScene;
  edgeRight: SceneryScene;
}

const CONTAINER_HUES = [containerHues.red, containerHues.blue, containerHues.amber] as const;

/** Cheapest, smallest filler for the new edge/gap slots — a small silhouette
 *  bush clump, reused at sky-band scale (see `intrinsicBox`'s 'bushClump'
 *  case in IsoScenery.tsx). */
const BUSH: SceneryElement = { kind: 'bushClump' };

/** design/scenery-spec.md §2.2, table rows 1–10 (0-indexed here). Each row's
 *  `edgeLeft`/`gapLeft`/`gapRight`/`edgeRight` close the four structural
 *  slot gaps (see refBand.ts) while keeping the section's own left/center/
 *  right personality unchanged. */
export const SHUNTING_SCENERY_RECIPES: readonly SceneryRecipe[] = [
  {
    name: 'Patio de Entrada',
    edgeLeft: [BUSH],
    left: [{ kind: 'signagePost' }],
    gapLeft: [BUSH],
    center: [{ kind: 'warehouse', doors: 1, short: true }],
    gapRight: [BUSH],
    right: [{ kind: 'lampPost' }],
    edgeRight: [BUSH],
  },
  {
    name: 'Nave de Carga',
    edgeLeft: [BUSH],
    left: [{ kind: 'warehouse', doors: 3 }],
    gapLeft: [{ kind: 'signagePost' }],
    center: [],
    gapRight: [BUSH],
    right: [{ kind: 'containerStack', count: 2, hues: [containerHues.red, containerHues.blue] }],
    edgeRight: [{ kind: 'lampPost' }],
  },
  {
    name: 'Patio de Contenedores',
    edgeLeft: [BUSH],
    left: [{ kind: 'containerStack', count: 3 }],
    gapLeft: [BUSH],
    center: [],
    gapRight: [BUSH],
    right: [{ kind: 'gantryCrane' }, { kind: 'containerStack', count: 2 }],
    edgeRight: [BUSH],
  },
  {
    name: 'Torre de Control',
    edgeLeft: [BUSH],
    left: [{ kind: 'controlTower' }],
    gapLeft: [{ kind: 'lampPost' }],
    center: [],
    gapRight: [BUSH],
    right: [{ kind: 'warehouse', doors: 2, short: true }],
    edgeRight: [BUSH],
  },
  {
    name: 'Vía de Mantenimiento',
    edgeLeft: [BUSH],
    left: [{ kind: 'signagePost' }],
    gapLeft: [BUSH],
    center: [{ kind: 'lampPost' }],
    gapRight: [BUSH],
    right: [{ kind: 'forklift' }, { kind: 'containerStack', count: 2 }],
    edgeRight: [BUSH],
  },
  {
    // First hasRightLoco section (level 51) — deliberately mirrored (twin
    // control towers) to sell "the yard grew a second throat," per
    // scenery-spec.md §0/§2.2. Was a byte-for-byte copy of Sección 4
    // (Torre de Control) until QA caught the two sections rendering
    // identically — this recipe must stay distinct from index [3]. The new
    // gap/edge filler stays MIRRORED (same kind both sides) so the symmetry
    // isn't undone by the slot-gap fix.
    name: 'Doble Vía',
    edgeLeft: [BUSH],
    left: [{ kind: 'controlTower' }],
    gapLeft: [{ kind: 'lampPost' }],
    center: [],
    gapRight: [{ kind: 'lampPost' }],
    right: [{ kind: 'controlTower' }],
    edgeRight: [BUSH],
  },
  {
    name: 'Muelle de Grúas',
    edgeLeft: [BUSH],
    left: [{ kind: 'gantryCrane' }],
    gapLeft: [BUSH],
    center: [{ kind: 'containerStack', count: 2 }],
    gapRight: [BUSH],
    right: [{ kind: 'gantryCrane' }],
    edgeRight: [BUSH],
  },
  {
    name: 'Terminal Intermodal',
    edgeLeft: [{ kind: 'signagePost' }],
    left: [{ kind: 'warehouse', doors: 2 }, { kind: 'containerStack', count: 2 }],
    gapLeft: [BUSH],
    center: [{ kind: 'lampPost' }],
    gapRight: [BUSH],
    right: [{ kind: 'containerStack', count: 3, tall: true }],
    edgeRight: [BUSH],
  },
  {
    name: 'Gran Industria',
    edgeLeft: [BUSH],
    left: [{ kind: 'controlTower', tall: true }, { kind: 'containerStack', count: 2 }],
    gapLeft: [BUSH],
    center: [],
    gapRight: [{ kind: 'lampPost' }],
    right: [{ kind: 'gantryCrane' }],
    edgeRight: [BUSH],
  },
  {
    name: 'Gran Terminal',
    edgeLeft: [BUSH],
    left: [{ kind: 'controlTower' }],
    gapLeft: [{ kind: 'lampPost' }],
    center: [{ kind: 'warehouse', doors: 2 }],
    gapRight: [BUSH],
    right: [{ kind: 'gantryCrane' }, { kind: 'containerStack', count: 2 }],
    edgeRight: [{ kind: 'signagePost' }],
  },
];

/** design/scenery-spec.md §2.2's final row — Clasificación's one fixed recipe. */
export const CLASSIFICATION_SCENERY_RECIPE: SceneryRecipe = {
  name: 'Patio de Clasificación',
  edgeLeft: [BUSH],
  left: [{ kind: 'signagePost', arrow: true }],
  gapLeft: [BUSH],
  center: [],
  gapRight: [BUSH],
  right: [{ kind: 'containerStack', count: 3, hues: Object.values(destinationColors).map((d) => d.fill).slice(0, 3) }],
  edgeRight: [BUSH],
};

/**
 * Foreground (Zone B) props per section — a derivation on top of §2.2's own
 * table, which only specifies the sky band. §2.3 names bush clump/utility
 * cabinet/signage post/lamp post/forklift as the only Zone-B candidates.
 *
 * Each section gets a LIST of 1–3 picks (not a single centered one — see the
 * user report that widened this) so a sparse section (generous
 * `foregroundMarginPlane`) can spread several small props across the
 * foreground strip's width instead of leaving it almost entirely bare below
 * a single centred item. `offsetU` places a pick along the car-column width
 * (0 = its left edge, 1 = its right edge, 0.5 = centred); each pick is STILL
 * gated independently by its own `minMarginPlane` (R3 now applies per item,
 * not once per section) — a denser level thins the list down naturally,
 * never squeezing anything to fit.
 *
 * Track counts per shunting level (`assets/levels/shunting/*.json`) confirm
 * which sections actually run sparse: Sección 1 is 3–4 tracks, Sección 2 is
 * 4–5, Secciones 3–4 are a flat 5, Sección 5 ramps 5→6, Secciones 6–7 are a
 * flat 6, and Secciones 8–10 (the densest) are a flat 7. Picks below are
 * biased accordingly: 2–3 picks for Secciones 1–5, 1–2 for 6–7, and back
 * down to a single pick for 8–10 where the apron floor is tightest.
 */
export interface ForegroundPick {
  kind: 'bushClump' | 'utilityCabinet' | 'signagePost' | 'lampPost' | 'forklift';
  minMarginPlane: number;
  /** Fractional position across the car-column width — see doc comment above. */
  offsetU: number;
}

export const FOREGROUND_MIN_MARGIN: Record<ForegroundPick['kind'], number> = {
  bushClump: 16,
  utilityCabinet: 22,
  signagePost: 26,
  lampPost: 32,
  forklift: 34,
};

function pick(kind: ForegroundPick['kind'], offsetU = 0.5): ForegroundPick {
  return { kind, minMarginPlane: FOREGROUND_MIN_MARGIN[kind], offsetU };
}

/** 1–3 picks per shunting section, 0-indexed — see doc comment above. */
export const SHUNTING_FOREGROUND_RECIPES: readonly ForegroundPick[][] = [
  // 1 — Patio de Entrada: sparsest section (3–4 tracks) → 3 picks, spread wide.
  [pick('bushClump', 0.16), pick('utilityCabinet', 0.5), pick('bushClump', 0.84)],
  // 2 — Nave de Carga (4–5 tracks): echoes its own utility-cabinet motif + a companion bush.
  [pick('utilityCabinet', 0.25), pick('bushClump', 0.75)],
  // 3 — Patio de Contenedores (5 tracks): quiet, symmetric-feeling pair.
  [pick('bushClump', 0.3), pick('bushClump', 0.7)],
  // 4 — Torre de Control (5 tracks): echoes its own signage + a companion bush.
  [pick('signagePost', 0.28), pick('bushClump', 0.72)],
  // 5 — Vía de Mantenimiento (5–6 tracks): echoes its own forklift motif + a companion bush.
  [pick('forklift', 0.55), pick('bushClump', 0.15)],
  // 6 — Doble Vía (6 tracks, first hasRightLoco): quiet, mirrored placement either
  // side of centre to match the section's symmetric backdrop.
  [pick('bushClump', 0.3), pick('bushClump', 0.7)],
  // 7 — Muelle de Grúas (6 tracks, symmetric twin gantries): mirrored cabinets either side.
  [pick('utilityCabinet', 0.3), pick('utilityCabinet', 0.7)],
  // 8 — Terminal Intermodal (7 tracks, dense): single pick, echoes its lamp posts.
  [pick('lampPost', 0.5)],
  // 9 — Gran Industria (7 tracks, dense): single pick, cheapest filler.
  [pick('bushClump', 0.5)],
  // 10 — Gran Terminal (7 tracks, dense finale): single pick, echoes its signage.
  [pick('signagePost', 0.5)],
];

/**
 * Classification never gets a Zone B pick — its containers must stay
 * sky-band/background-only per R5 (a foreground-tier container could read
 * as a wagon). See scenery-spec.md's Risk §6, "Container-hue confusion".
 */
export const CLASSIFICATION_FOREGROUND_RECIPE: readonly ForegroundPick[] | null = null;

/**
 * `levelId` (1-based) → 0-based shunting section index, reusing
 * `SHUNTING_SECTION_SIZE` rather than re-deriving it.
 */
export function sceneryRecipeIndexForLevel(levelId: number): number {
  const idx = Math.floor((Math.max(1, levelId) - 1) / SHUNTING_SECTION_SIZE);
  return Math.min(idx, SHUNTING_SCENERY_RECIPES.length - 1);
}

export function sceneryRecipeForSection(sectionIndex: number): SceneryRecipe {
  const i = Math.min(Math.max(0, sectionIndex), SHUNTING_SCENERY_RECIPES.length - 1);
  return SHUNTING_SCENERY_RECIPES[i];
}

export function foregroundPickForSection(sectionIndex: number): readonly ForegroundPick[] {
  const i = Math.min(Math.max(0, sectionIndex), SHUNTING_FOREGROUND_RECIPES.length - 1);
  return SHUNTING_FOREGROUND_RECIPES[i];
}

export { CONTAINER_HUES };
