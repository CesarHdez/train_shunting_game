/**
 * Foreground-apron gating coverage for the classification layout — the
 * counterpart to shuntingLayout.test.ts's `foregroundMarginPlane` describe
 * block. Classification never gets a Zone B scenery pick (R5 — see
 * primitives/scenery/recipes.ts's `CLASSIFICATION_FOREGROUND_RECIPE`), but
 * the layout still exposes the same two fields (design/scenery-spec.md §5)
 * so a future prop CAN be gated the same way if that decision ever changes,
 * and so the underlying "both margins are equal, and shrink toward
 * `topPad`" geometry is exercised at both a small (1 arrival + 2
 * classification tracks — the smallest shipped turno) and a large (4
 * arrivals + 5 classification tracks — the densest shipped turno, level 10)
 * configuration.
 */

import { computeClassificationLayout, type ClassificationLayout } from '../classificationLayout';
import { spacing } from '../../../../design/tokens';

const PHONE = { width: 820, height: 290 };

function build(params: Partial<Parameters<typeof computeClassificationLayout>[0]> = {}): ClassificationLayout {
  return computeClassificationLayout({
    arrivalsCount: 1,
    clasifCount: 2,
    arrSlots: 6,
    clasSlots: 4,
    ...PHONE,
    ...params,
  });
}

describe('foregroundMarginPlane / foregroundOriginY (classification)', () => {
  it('foregroundOriginY sits exactly at the last classification row´s own band bottom (R2)', () => {
    for (const params of [
      { arrivalsCount: 1, clasifCount: 2 },
      { arrivalsCount: 4, clasifCount: 5, arrSlots: 6, clasSlots: 6 },
    ]) {
      const l = build(params);
      expect(l.foregroundOriginY).toBeCloseTo(l.clasY(l.clasifCount - 1) + l.rowPitch / 2, 6);
    }
  });

  it('is always non-negative', () => {
    for (const params of [
      { arrivalsCount: 1, clasifCount: 2 },
      { arrivalsCount: 4, clasifCount: 5, arrSlots: 6, clasSlots: 6 },
    ]) {
      expect(build(params).foregroundMarginPlane).toBeGreaterThanOrEqual(0);
    }
  });

  it('gives the smallest turno (1 arrival + 2 classification tracks) a comfortable margin on a tall viewport', () => {
    // A short landscape phone box already saturates MAX_SCREEN_ROW_PITCH even
    // with only 3 rows, so use a taller box to show the margin actually
    // growing — the point being made is "more room ⇒ bigger margin", not a
    // specific number.
    const l = build({ arrivalsCount: 1, clasifCount: 2, height: 700 });
    expect(l.foregroundMarginPlane).toBeGreaterThan(spacing.lg);
  });

  it('never falls below the topPad floor, even at its smallest', () => {
    const l = build({ arrivalsCount: 1, clasifCount: 2 });
    expect(l.foregroundMarginPlane).toBeGreaterThanOrEqual(spacing.lg - 0.01);
  });

  it('shrinks toward the topPad (spacing.lg) floor on the densest shipped turno (level 10: 4 arrivals + 5 classification tracks)', () => {
    const l = build({ arrivalsCount: 4, clasifCount: 5, arrSlots: 6, clasSlots: 6 });
    // topPad = spacing.lg = 16 here (classificationLayout.ts uses spacing.lg,
    // not spacing.md — see its own module doc comment).
    expect(l.foregroundMarginPlane).toBeGreaterThanOrEqual(spacing.lg - 0.01);
    expect(l.foregroundMarginPlane).toBeLessThan(spacing.lg * 3);
  });
});
