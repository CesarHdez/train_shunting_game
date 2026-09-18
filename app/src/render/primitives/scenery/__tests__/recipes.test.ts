/**
 * Pure lookup coverage for the scenery recipe table (design/scenery-spec.md
 * §2.2/§2.3) — no React/Skia involved, so this runs under plain Jest.
 */

import { SHUNTING_SECTION_SIZE } from '../../../../controller/sections';
import {
  CLASSIFICATION_FOREGROUND_RECIPE,
  CLASSIFICATION_SCENERY_RECIPE,
  FOREGROUND_MIN_MARGIN,
  SHUNTING_FOREGROUND_RECIPES,
  SHUNTING_SCENERY_RECIPES,
  foregroundPickForSection,
  sceneryRecipeForSection,
  sceneryRecipeIndexForLevel,
} from '../recipes';

describe('sceneryRecipeIndexForLevel', () => {
  it('groups levels into the same 10-level sections as controller/sections.ts', () => {
    expect(sceneryRecipeIndexForLevel(1)).toBe(0);
    expect(sceneryRecipeIndexForLevel(SHUNTING_SECTION_SIZE)).toBe(0);
    expect(sceneryRecipeIndexForLevel(SHUNTING_SECTION_SIZE + 1)).toBe(1);
    expect(sceneryRecipeIndexForLevel(51)).toBe(5); // hasRightLoco turns on here — Sección 6, index 5
    expect(sceneryRecipeIndexForLevel(100)).toBe(9);
  });

  it('clamps out-of-range level ids instead of throwing', () => {
    expect(sceneryRecipeIndexForLevel(0)).toBe(0);
    expect(sceneryRecipeIndexForLevel(-5)).toBe(0);
    expect(sceneryRecipeIndexForLevel(10_000)).toBe(SHUNTING_SCENERY_RECIPES.length - 1);
  });
});

describe('SHUNTING_SCENERY_RECIPES', () => {
  it('has exactly 10 sections, one per Sección 1–10', () => {
    expect(SHUNTING_SCENERY_RECIPES).toHaveLength(10);
  });

  it('every recipe is reachable and stable via sceneryRecipeForSection', () => {
    for (let i = 0; i < SHUNTING_SCENERY_RECIPES.length; i++) {
      expect(sceneryRecipeForSection(i)).toBe(SHUNTING_SCENERY_RECIPES[i]);
    }
  });

  it('clamps an out-of-range section index rather than returning undefined', () => {
    expect(sceneryRecipeForSection(-1)).toBe(SHUNTING_SCENERY_RECIPES[0]);
    expect(sceneryRecipeForSection(999)).toBe(SHUNTING_SCENERY_RECIPES[9]);
  });

  it('Sección 6 (index 5) and Sección 7 (index 6) go symmetric left/right, per the hasRightLoco coincidence', () => {
    const seccion6 = SHUNTING_SCENERY_RECIPES[5];
    const seccion7 = SHUNTING_SCENERY_RECIPES[6];
    expect(seccion6.left[0]?.kind).toBe('controlTower');
    expect(seccion6.right[0]?.kind).toBe('controlTower');
    expect(seccion7.left[0]?.kind).toBe('gantryCrane');
    expect(seccion7.right[0]?.kind).toBe('gantryCrane');
  });

  it('never mixes destinationColors hues into a shunting-section container stack (R5)', () => {
    // Fixed absolute containerHues only — see design/tokens.ts's containerHues
    // doc comment on why these must stay visually distinct from wagon cues.
    const destinationFillHexes = ['#E14B4B', '#3E8EDE', '#47B26B', '#E9C63F', '#9B6BD6'];
    for (const recipe of SHUNTING_SCENERY_RECIPES) {
      for (const scene of [recipe.left, recipe.center, recipe.right]) {
        for (const el of scene) {
          if (el.kind === 'containerStack' && el.hues) {
            for (const hue of el.hues) expect(destinationFillHexes).not.toContain(hue);
          }
        }
      }
    }
  });
});

describe('CLASSIFICATION_SCENERY_RECIPE', () => {
  it('is the one recipe that intentionally reuses destinationColors (R5)', () => {
    const stack = CLASSIFICATION_SCENERY_RECIPE.right[0];
    expect(stack?.kind).toBe('containerStack');
    expect(stack?.hues).toEqual(['#E14B4B', '#3E8EDE', '#47B26B']);
  });

  it('has no foreground pick — containers stay sky-band/background-only (R5)', () => {
    expect(CLASSIFICATION_FOREGROUND_RECIPE).toBeNull();
  });
});

describe('foregroundPickForSection / SHUNTING_FOREGROUND_RECIPES', () => {
  it('has exactly one pick LIST per shunting section, each with 1-3 picks', () => {
    expect(SHUNTING_FOREGROUND_RECIPES).toHaveLength(10);
    for (const picks of SHUNTING_FOREGROUND_RECIPES) {
      expect(picks.length).toBeGreaterThanOrEqual(1);
      expect(picks.length).toBeLessThanOrEqual(3);
    }
  });

  it('every pick carries the §2.3 floor for its own kind and a valid offsetU', () => {
    for (const picks of SHUNTING_FOREGROUND_RECIPES) {
      for (const p of picks) {
        expect(p.minMarginPlane).toBe(FOREGROUND_MIN_MARGIN[p.kind]);
        expect(p.offsetU).toBeGreaterThanOrEqual(0);
        expect(p.offsetU).toBeLessThanOrEqual(1);
      }
    }
  });

  it('biases sparser sections (lower track counts) toward more picks than the densest ones', () => {
    // Sección 1 (3-4 tracks, sparsest) vs Secciones 8-10 (7 tracks, densest).
    expect(SHUNTING_FOREGROUND_RECIPES[0].length).toBeGreaterThan(SHUNTING_FOREGROUND_RECIPES[9].length);
    for (const picks of SHUNTING_FOREGROUND_RECIPES.slice(7)) {
      expect(picks.length).toBe(1);
    }
  });

  it('uses the forklift exactly once — Sección 5, echoing that section\'s own sky-band motif', () => {
    const forkliftSections = SHUNTING_FOREGROUND_RECIPES.filter((picks) => picks.some((p) => p.kind === 'forklift'));
    expect(forkliftSections).toHaveLength(1);
    expect(foregroundPickForSection(4).some((p) => p.kind === 'forklift')).toBe(true); // Sección 5, 0-indexed
  });

  it('clamps an out-of-range section index rather than returning undefined', () => {
    expect(foregroundPickForSection(-1)).toEqual(SHUNTING_FOREGROUND_RECIPES[0]);
    expect(foregroundPickForSection(999)).toEqual(SHUNTING_FOREGROUND_RECIPES[9]);
  });
});

describe('SCENERY_SLOTS gap coverage (edgeLeft/gapLeft/gapRight/edgeRight)', () => {
  it('every shunting recipe populates both edge slots, on every section including the sparsest', () => {
    for (const recipe of SHUNTING_SCENERY_RECIPES) {
      expect(recipe.edgeLeft.length).toBeGreaterThan(0);
      expect(recipe.edgeRight.length).toBeGreaterThan(0);
    }
    expect(CLASSIFICATION_SCENERY_RECIPE.edgeLeft.length).toBeGreaterThan(0);
    expect(CLASSIFICATION_SCENERY_RECIPE.edgeRight.length).toBeGreaterThan(0);
  });

  it('most recipes also populate the two inter-slot gaps (gapLeft/gapRight) by default', () => {
    const populatedGapLeft = SHUNTING_SCENERY_RECIPES.filter((r) => r.gapLeft.length > 0).length;
    const populatedGapRight = SHUNTING_SCENERY_RECIPES.filter((r) => r.gapRight.length > 0).length;
    expect(populatedGapLeft).toBe(SHUNTING_SCENERY_RECIPES.length);
    expect(populatedGapRight).toBe(SHUNTING_SCENERY_RECIPES.length);
  });

  it('Sección 6/7 keep symmetric gap/edge filler (same kind both sides), matching their mirrored backdrop', () => {
    const seccion6 = SHUNTING_SCENERY_RECIPES[5];
    const seccion7 = SHUNTING_SCENERY_RECIPES[6];
    expect(seccion6.gapLeft[0]?.kind).toBe(seccion6.gapRight[0]?.kind);
    expect(seccion6.edgeLeft[0]?.kind).toBe(seccion6.edgeRight[0]?.kind);
    expect(seccion7.gapLeft[0]?.kind).toBe(seccion7.gapRight[0]?.kind);
    expect(seccion7.edgeLeft[0]?.kind).toBe(seccion7.edgeRight[0]?.kind);
  });
});
