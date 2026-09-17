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
  | 'forklift';

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
  left: SceneryScene;
  center: SceneryScene;
  right: SceneryScene;
}

const CONTAINER_HUES = [containerHues.red, containerHues.blue, containerHues.amber] as const;

/** design/scenery-spec.md §2.2, table rows 1–10 (0-indexed here). */
export const SHUNTING_SCENERY_RECIPES: readonly SceneryRecipe[] = [
  {
    name: 'Patio de Entrada',
    left: [{ kind: 'signagePost' }],
    center: [{ kind: 'warehouse', doors: 1, short: true }],
    right: [{ kind: 'lampPost' }],
  },
  {
    name: 'Nave de Carga',
    left: [{ kind: 'warehouse', doors: 3 }],
    center: [],
    right: [{ kind: 'containerStack', count: 2, hues: [containerHues.red, containerHues.blue] }],
  },
  {
    name: 'Patio de Contenedores',
    left: [{ kind: 'containerStack', count: 3 }],
    center: [],
    right: [{ kind: 'gantryCrane' }, { kind: 'containerStack', count: 2 }],
  },
  {
    name: 'Torre de Control',
    left: [{ kind: 'controlTower' }],
    center: [],
    right: [{ kind: 'warehouse', doors: 2, short: true }],
  },
  {
    name: 'Vía de Mantenimiento',
    left: [{ kind: 'signagePost' }],
    center: [{ kind: 'lampPost' }],
    right: [{ kind: 'forklift' }, { kind: 'containerStack', count: 2 }],
  },
  {
    // First hasRightLoco section (level 51) — deliberately mirrored (twin
    // control towers) to sell "the yard grew a second throat," per
    // scenery-spec.md §0/§2.2. Was a byte-for-byte copy of Sección 4
    // (Torre de Control) until QA caught the two sections rendering
    // identically — this recipe must stay distinct from index [3].
    name: 'Doble Vía',
    left: [{ kind: 'controlTower' }],
    center: [],
    right: [{ kind: 'controlTower' }],
  },
  {
    name: 'Muelle de Grúas',
    left: [{ kind: 'gantryCrane' }],
    center: [{ kind: 'containerStack', count: 2 }],
    right: [{ kind: 'gantryCrane' }],
  },
  {
    name: 'Terminal Intermodal',
    left: [{ kind: 'warehouse', doors: 2 }, { kind: 'containerStack', count: 2 }],
    center: [{ kind: 'lampPost' }],
    right: [{ kind: 'containerStack', count: 3, tall: true }],
  },
  {
    name: 'Gran Industria',
    left: [{ kind: 'controlTower', tall: true }, { kind: 'containerStack', count: 2 }],
    center: [],
    right: [{ kind: 'gantryCrane' }],
  },
  {
    name: 'Gran Terminal',
    left: [{ kind: 'controlTower' }],
    center: [{ kind: 'warehouse', doors: 2 }],
    right: [{ kind: 'gantryCrane' }, { kind: 'containerStack', count: 2 }],
  },
];

/** design/scenery-spec.md §2.2's final row — Clasificación's one fixed recipe. */
export const CLASSIFICATION_SCENERY_RECIPE: SceneryRecipe = {
  name: 'Patio de Clasificación',
  left: [{ kind: 'signagePost', arrow: true }],
  center: [],
  right: [{ kind: 'containerStack', count: 3, hues: Object.values(destinationColors).map((d) => d.fill).slice(0, 3) }],
};

/**
 * Foreground (Zone B) prop per section — a derivation on top of §2.2's own
 * table, which only specifies the sky band. §2.3 names bush clump/utility
 * cabinet/signage post/lamp post/forklift as the only Zone-B candidates;
 * this picks one per section that echoes that section's own sky-band motif
 * (or the cheapest generic filler where no motif fits), so the close-in
 * dressing feels like it belongs to the same section rather than being
 * generic clutter. `minMarginPlane` numbers are §2.3's own suggested floors.
 */
export interface ForegroundPick {
  kind: 'bushClump' | 'utilityCabinet' | 'signagePost' | 'lampPost' | 'forklift';
  minMarginPlane: number;
}

export const FOREGROUND_MIN_MARGIN: Record<ForegroundPick['kind'], number> = {
  bushClump: 16,
  utilityCabinet: 22,
  signagePost: 26,
  lampPost: 32,
  forklift: 34,
};

function pick(kind: ForegroundPick['kind']): ForegroundPick {
  return { kind, minMarginPlane: FOREGROUND_MIN_MARGIN[kind] };
}

/** One pick per shunting section, 0-indexed — see doc comment above. */
export const SHUNTING_FOREGROUND_RECIPES: readonly ForegroundPick[] = [
  pick('bushClump'), // 1 — Patio de Entrada: sparsest, cheapest filler
  pick('utilityCabinet'), // 2 — Nave de Carga
  pick('bushClump'), // 3 — Patio de Contenedores
  pick('signagePost'), // 4 — Torre de Control
  pick('forklift'), // 5 — Vía de Mantenimiento: echoes its own forklift motif
  pick('bushClump'), // 6 — Doble Vía: quiet, symmetric
  pick('utilityCabinet'), // 7 — Muelle de Grúas
  pick('lampPost'), // 8 — Terminal Intermodal: echoes its lamp posts
  pick('bushClump'), // 9 — Gran Industria
  pick('signagePost'), // 10 — Gran Terminal
];

/**
 * Classification never gets a Zone B pick — its containers must stay
 * sky-band/background-only per R5 (a foreground-tier container could read
 * as a wagon). See scenery-spec.md's Risk §6, "Container-hue confusion".
 */
export const CLASSIFICATION_FOREGROUND_RECIPE: ForegroundPick | null = null;

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

export function foregroundPickForSection(sectionIndex: number): ForegroundPick {
  const i = Math.min(Math.max(0, sectionIndex), SHUNTING_FOREGROUND_RECIPES.length - 1);
  return SHUNTING_FOREGROUND_RECIPES[i];
}

export { CONTAINER_HUES };
