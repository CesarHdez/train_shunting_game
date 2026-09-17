/**
 * Rail-coordinate math for the shunting switchback move (see railPath.ts's
 * module doc comment). These pin the properties the choreography brief
 * explicitly demands:
 *   - a unit starts exactly on its source slot and ends exactly on its
 *     destination slot;
 *   - the tail-most unit reaches the convergence node exactly at the
 *     reversal (left side, where the loco-to-cut gap is identical at both
 *     ends);
 *   - units never collide, and their rail-arc spacing from the locomotive
 *     stays constant within each travel phase;
 *   - the locomotive holds perfectly still during the reversal pause.
 */

import { computeShuntingLayout, type ShuntingLayout } from '../../layout/shuntingLayout';
import type { ShuntingMoveAnim } from '../detectMove';
import {
  buildEntryRailPlan,
  buildRailPlan,
  buildRailRow,
  pushedPositionAtT,
  qAtPoint,
  qAtU,
  railPointAtQ,
  railPositionAtT,
  type ShuntRailPlan,
} from '../railPath';

/** Screen x of a rail-plan point, given the layout it was built from. */
function screenXOf(layout: ShuntingLayout, p: { x: number; y: number }): number {
  return layout.camera.project(p.x, p.y).x;
}

const TOKENS = { moveMinMs: 900, moveMaxMs: 1800, pauseMinMs: 80, pauseMaxMs: 150 };

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** All unit positions (loco first, then cars in move.cars order) at time t. */
function positionsAt(plan: ShuntRailPlan, move: ShuntingMoveAnim, t: number) {
  const loco = railPositionAtT(t, plan.srcRow, plan.dstRow, plan.qLocoSrc, plan.qLocoDst, 0, 0, plan.D1, plan.f1, plan.f2);
  const cars = move.cars.map((_, i) =>
    railPositionAtT(
      t,
      plan.srcRow,
      plan.dstRow,
      plan.qLocoSrc,
      plan.qLocoDst,
      plan.carDSrc[i],
      plan.carDDst[i],
      plan.D1,
      plan.f1,
      plan.f2
    )
  );
  return [loco, ...cars];
}

describe('buildBranchArcLUT / railPointAtQ round-trip', () => {
  it('reproduces the branch bezier at sampled arc lengths', () => {
    const convX = 20;
    const convY = 100;
    const fanEndX = 90;
    const rowY = 40;
    const row = buildRailRow(convX, convY, fanEndX, rowY, 48);
    // The LUT's own samples ARE the arc-length-uniform bezier points by
    // construction; spot-check a few against railPointAtQ's lookup.
    for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
      const s = frac * row.lut.total;
      const p = railPointAtQ(row, s);
      const k = Math.round(frac * row.lut.steps);
      expect(p.x).toBeCloseTo(row.lut.us[k], 3);
      expect(p.y).toBeCloseTo(row.lut.vs[k], 3);
    }
    // Endpoints match the branch's own control points exactly.
    expect(railPointAtQ(row, 0)).toEqual({ x: convX, y: convY });
    const end = railPointAtQ(row, row.lut.total);
    expect(end.x).toBeCloseTo(fanEndX, 3);
    expect(end.y).toBeCloseTo(rowY, 3);
  });

  it('qAtU inverts railPointAtQ exactly in the straight stub region', () => {
    const row = buildRailRow(20, 100, 90, 40, 32);
    for (const u of [90, 120, 200, 350]) {
      const q = qAtU(row, u);
      const p = railPointAtQ(row, q);
      expect(p.x).toBeCloseTo(u, 6);
      expect(p.y).toBeCloseTo(40, 6);
    }
  });

  it('a negative q resolves to the same trunk point regardless of which row it is read through', () => {
    const rowA = buildRailRow(20, 100, 90, 40, 32);
    const rowB = buildRailRow(20, 100, 90, 160, 32);
    for (const q of [-5, -40, -120]) {
      const a = railPointAtQ(rowA, q);
      const b = railPointAtQ(rowB, q);
      expect(a).toEqual(b);
    }
  });
});

describe('shunting switchback rail plan', () => {
  // Portrait phone board area, 4 tracks, no right loco.
  const leftLayout: ShuntingLayout = computeShuntingLayout({
    trackCount: 4,
    capacity: 6,
    hasRightLoco: false,
    width: 380,
    height: 700,
  });

  const leftMove: ShuntingMoveAnim = {
    side: 'left',
    srcTrack: 0,
    dstTrack: 3,
    cars: [
      { label: 'A', srcCol: 0, dstCol: 0 },
      { label: 'B', srcCol: 1, dstCol: 1 },
      { label: 'C', srcCol: 2, dstCol: 2 },
    ],
  };

  const leftPlan = buildRailPlan(leftLayout, leftMove, TOKENS)!;

  it('builds a plan', () => {
    expect(leftPlan).toBeTruthy();
    expect(leftPlan.f1).toBeGreaterThan(0);
    expect(leftPlan.f1).toBeLessThan(leftPlan.f2);
    expect(leftPlan.f2).toBeLessThan(1);
  });

  it('every unit starts exactly on its source slot at t=0', () => {
    const srcLoco = leftLayout.locoRect(leftMove.srcTrack, 'left');
    const p0 = positionsAt(leftPlan, leftMove, 0);
    expect(p0[0].x).toBeCloseTo(srcLoco.x + srcLoco.width / 2, 6);
    expect(p0[0].y).toBeCloseTo(srcLoco.y, 6);
    leftMove.cars.forEach((car, i) => {
      const b = leftLayout.carBillboard(leftMove.srcTrack, car.srcCol);
      expect(p0[i + 1].x).toBeCloseTo(b.u, 6);
      expect(p0[i + 1].y).toBeCloseTo(b.v, 6);
    });
  });

  it('every unit lands exactly on its destination slot at t=1', () => {
    const dstLoco = leftLayout.locoRect(leftMove.dstTrack, 'left');
    const p1 = positionsAt(leftPlan, leftMove, 1);
    expect(p1[0].x).toBeCloseTo(dstLoco.x + dstLoco.width / 2, 6);
    expect(p1[0].y).toBeCloseTo(dstLoco.y, 6);
    leftMove.cars.forEach((car, i) => {
      const b = leftLayout.carBillboard(leftMove.dstTrack, car.dstCol);
      expect(p1[i + 1].x).toBeCloseTo(b.u, 6);
      expect(p1[i + 1].y).toBeCloseTo(b.v, 6);
    });
  });

  it('the tail-most car reaches the convergence node exactly at the reversal (left side: identical loco-cut gap at both ends)', () => {
    const peine = leftLayout.peineLeft;
    // Left moves keep dSrc === dDst per car (same layout-constant loco-to-
    // cut gap on every track), so D1 is exactly the tail's offset and it
    // clears the node with nothing to spare.
    const tailIdx = leftMove.cars.length - 1; // highest srcCol/dstCol = farthest from the loco
    expect(leftPlan.carDSrc[tailIdx]).toBeCloseTo(leftPlan.D1, 6);
    expect(leftPlan.carDSrc[tailIdx]).toBeCloseTo(leftPlan.carDDst[tailIdx], 6);

    const atReversal = positionsAt(leftPlan, leftMove, leftPlan.f1);
    const tailPos = atReversal[tailIdx + 1];
    expect(tailPos.x).toBeCloseTo(peine.convX, 1);
    expect(tailPos.y).toBeCloseTo(peine.convY, 1);
  });

  it('the locomotive holds perfectly still throughout the reversal pause', () => {
    const mid = (leftPlan.f1 + leftPlan.f2) / 2;
    const a = railPositionAtT(leftPlan.f1, leftPlan.srcRow, leftPlan.dstRow, leftPlan.qLocoSrc, leftPlan.qLocoDst, 0, 0, leftPlan.D1, leftPlan.f1, leftPlan.f2);
    const b = railPositionAtT(mid, leftPlan.srcRow, leftPlan.dstRow, leftPlan.qLocoSrc, leftPlan.qLocoDst, 0, 0, leftPlan.D1, leftPlan.f1, leftPlan.f2);
    const c = railPositionAtT(leftPlan.f2, leftPlan.srcRow, leftPlan.dstRow, leftPlan.qLocoSrc, leftPlan.qLocoDst, 0, 0, leftPlan.D1, leftPlan.f1, leftPlan.f2);
    expect(dist(a, b)).toBeLessThan(1e-6);
    expect(dist(b, c)).toBeLessThan(1e-6);
  });

  it('units never collide across the whole move, at a dense sweep of times', () => {
    for (let step = 0; step <= 40; step++) {
      const t = step / 40;
      const positions = positionsAt(leftPlan, leftMove, t);
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          expect(dist(positions[i], positions[j])).toBeGreaterThan(1);
        }
      }
    }
  });

  it('keeps constant rail-arc spacing behind the locomotive within each travel phase (straight-region check)', () => {
    // At t=0 (phase 0 start) and t=1 (phase 2 end) every unit sits in the
    // straight stub, where Euclidean spacing along u equals arc-length
    // spacing exactly — a direct, black-box confirmation of the "constant
    // arc-length distance from the loco" requirement at both ends.
    for (const t of [0, 1]) {
      const positions = positionsAt(leftPlan, leftMove, t);
      const locoU = positions[0].x;
      leftMove.cars.forEach((_, i) => {
        const expectedD = t === 0 ? leftPlan.carDSrc[i] : leftPlan.carDDst[i];
        const actualD = Math.abs(positions[i + 1].x - locoU);
        expect(actualD).toBeCloseTo(expectedD, 4);
      });
    }
  });

  it('animates a loco-only (activation) move with no cars the same way', () => {
    const soloMove: ShuntingMoveAnim = { side: 'left', srcTrack: 0, dstTrack: 2, cars: [] };
    const plan = buildRailPlan(leftLayout, soloMove, TOKENS)!;
    expect(plan.D1).toBe(0);
    const p0 = positionsAt(plan, soloMove, 0);
    const p1 = positionsAt(plan, soloMove, 1);
    const srcLoco = leftLayout.locoRect(0, 'left');
    const dstLoco = leftLayout.locoRect(2, 'left');
    expect(p0[0].x).toBeCloseTo(srcLoco.x + srcLoco.width / 2, 6);
    expect(p1[0].x).toBeCloseTo(dstLoco.x + dstLoco.width / 2, 6);
    // Touches (but doesn't overshoot past) the convergence node at the reversal.
    const atReversal = railPositionAtT(plan.f1, plan.srcRow, plan.dstRow, plan.qLocoSrc, plan.qLocoDst, 0, 0, plan.D1, plan.f1, plan.f2);
    expect(atReversal.x).toBeCloseTo(leftLayout.peineLeft.convX, 1);
  });
});

describe('right-side switchback: a loco-cut gap that differs between source and destination', () => {
  const layout: ShuntingLayout = computeShuntingLayout({
    trackCount: 3,
    capacity: 6,
    hasRightLoco: true,
    width: 380,
    height: 700,
  });

  // 3 cars occupy the head of the source track (cols 0-2, so a 3-slot gap
  // to the right loco's fixed column); the destination already has 2 cars
  // (cols 0-1), so the same cut appends at cols 2-4 (only a 1-slot gap).
  const rightMove: ShuntingMoveAnim = {
    side: 'right',
    srcTrack: 0,
    dstTrack: 1,
    cars: [
      { label: 'X', srcCol: 0, dstCol: 2 },
      { label: 'Y', srcCol: 1, dstCol: 3 },
      { label: 'Z', srcCol: 2, dstCol: 4 },
    ],
  };

  const plan = buildRailPlan(layout, rightMove, TOKENS)!;

  it('builds a plan even though the loco-cut gap differs at each end', () => {
    expect(plan).toBeTruthy();
    // The gap DOES differ (that's the scenario under test) — but car-to-car
    // spacing among the cut itself is identical at both ends regardless.
    const gapSrc = plan.carDSrc[0];
    const gapDst = plan.carDDst[0];
    expect(Math.abs(gapSrc - gapDst)).toBeGreaterThan(1);
    for (let i = 1; i < rightMove.cars.length; i++) {
      const pitchSrc = plan.carDSrc[i] - plan.carDSrc[i - 1];
      const pitchDst = plan.carDDst[i] - plan.carDDst[i - 1];
      expect(pitchSrc).toBeCloseTo(pitchDst, 6);
    }
  });

  it('starts on source slots and ends on destination slots exactly', () => {
    const srcLoco = layout.locoRect(rightMove.srcTrack, 'right');
    const dstLoco = layout.locoRect(rightMove.dstTrack, 'right');
    const p0 = positionsAt(plan, rightMove, 0);
    const p1 = positionsAt(plan, rightMove, 1);
    expect(p0[0].x).toBeCloseTo(srcLoco.x + srcLoco.width / 2, 6);
    expect(p1[0].x).toBeCloseTo(dstLoco.x + dstLoco.width / 2, 6);
    rightMove.cars.forEach((car, i) => {
      const bSrc = layout.carBillboard(rightMove.srcTrack, car.srcCol);
      const bDst = layout.carBillboard(rightMove.dstTrack, car.dstCol);
      expect(p0[i + 1].x).toBeCloseTo(bSrc.u, 6);
      expect(p1[i + 1].x).toBeCloseTo(bDst.u, 6);
    });
  });

  it('the whole train fully clears the node by the reversal, at every point during the gap crossfade', () => {
    for (let step = 0; step <= 10; step++) {
      const t = plan.f1 + (step / 10) * (plan.f2 - plan.f1);
      const positions = positionsAt(plan, rightMove, t);
      for (const p of positions) {
        // Every unit must be ON the trunk (q<=0) throughout the pause —
        // equivalently, never past the node back toward the yard side.
        // For the right peine the trunk runs toward +u beyond convX.
        expect(p.x).toBeGreaterThanOrEqual(layout.peineRight!.convX - 0.51);
      }
    }
  });

  it('never collides across the whole move', () => {
    for (let step = 0; step <= 40; step++) {
      const t = step / 40;
      const positions = positionsAt(plan, rightMove, t);
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          expect(dist(positions[i], positions[j])).toBeGreaterThan(1);
        }
      }
    }
  });
});

describe('pushed (pre-existing destination-track) cars', () => {
  // Same portrait board as the first describe block, but the destination
  // track already has 2 residents (cols 0-1) before a 2-car cut prepends
  // ahead of them, pushing them back to cols 2-3 — the exact scenario from
  // the bug report (cars on the destination track must stay put until the
  // arriving cut actually reaches them, then shove along in lockstep).
  const layout: ShuntingLayout = computeShuntingLayout({
    trackCount: 4,
    capacity: 6,
    hasRightLoco: false,
    width: 380,
    height: 700,
  });

  const move: ShuntingMoveAnim = {
    side: 'left',
    srcTrack: 0,
    dstTrack: 3,
    cars: [
      { label: 'A', srcCol: 0, dstCol: 0 },
      { label: 'B', srcCol: 1, dstCol: 1 },
    ],
    pushedCars: [
      { label: 'S0', srcCol: 0, dstCol: 2 },
      { label: 'S1', srcCol: 1, dstCol: 3 },
    ],
  };

  const plan = buildRailPlan(layout, move, TOKENS)!;

  function pushedPosAt(t: number, i: number) {
    return pushedPositionAtT(
      t,
      plan.dstRow,
      plan.qLocoSrc,
      plan.qLocoDst,
      plan.D1,
      plan.f1,
      plan.f2,
      plan.qLocoContact,
      plan.pushedCars[i].srcQ,
      plan.pushedCars[i].dstQ
    );
  }

  it('builds a plan', () => {
    expect(plan).toBeTruthy();
    expect(plan.pushedCars).toHaveLength(2);
  });

  it("each pushed car's rail geometry matches its own static slots", () => {
    plan.pushedCars.forEach((pc, i) => {
      const srcB = layout.carBillboard(move.dstTrack, move.pushedCars![i].srcCol);
      const dstB = layout.carBillboard(move.dstTrack, move.pushedCars![i].dstCol);
      expect(pc.srcQ).toBeCloseTo(qAtPoint(plan.dstRow, srcB.u, srcB.v), 6);
      expect(pc.dstQ).toBeCloseTo(qAtPoint(plan.dstRow, dstB.u, dstB.v), 6);
    });
  });

  it('contact happens strictly inside the push-in phase (after the reversal, before the end)', () => {
    expect(plan.qLocoContact).toBeGreaterThan(-plan.D1 - 1e-6); // at/after phase 2 begins (-D1)
    expect(plan.qLocoContact).toBeLessThan(plan.qLocoDst);
  });

  it('every pushed car stays exactly on its pre-move slot for the whole pull-out + pause + early push-in, until contact', () => {
    const srcPoints = plan.pushedCars.map((pc) => railPointAtQ(plan.dstRow, pc.srcQ));
    for (const t of [0, plan.f1 / 2, plan.f1, (plan.f1 + plan.f2) / 2, plan.f2]) {
      plan.pushedCars.forEach((_, i) => {
        const p = pushedPosAt(t, i);
        expect(p.x).toBeCloseTo(srcPoints[i].x, 6);
        expect(p.y).toBeCloseTo(srcPoints[i].y, 6);
      });
    }
  });

  it('lands EXACTLY on its destination slot at t=1', () => {
    plan.pushedCars.forEach((pc, i) => {
      const p = pushedPosAt(1, i);
      const dst = railPointAtQ(plan.dstRow, pc.dstQ);
      expect(p.x).toBeCloseTo(dst.x, 6);
      expect(p.y).toBeCloseTo(dst.y, 6);
    });
  });

  it('keeps EXACTLY constant spacing between pushed cars throughout the whole move (uniform shift ⇒ zero relative drift)', () => {
    const restSpacing = Math.abs(plan.pushedCars[1].srcQ - plan.pushedCars[0].srcQ);
    for (let step = 0; step <= 40; step++) {
      const t = step / 40;
      const p0 = pushedPosAt(t, 0);
      const p1 = pushedPosAt(t, 1);
      expect(dist(p0, p1)).toBeCloseTo(restSpacing, 4);
    }
  });

  it('is monotonically non-decreasing progress (never teleports, never reverses) from contact to arrival', () => {
    let lastD = 0;
    for (let step = 0; step <= 40; step++) {
      const t = step / 40;
      const p = pushedPosAt(t, 0);
      const src = railPointAtQ(plan.dstRow, plan.pushedCars[0].srcQ);
      const d = dist(p, src);
      expect(d).toBeGreaterThanOrEqual(lastD - 1e-6);
      lastD = d;
    }
    expect(lastD).toBeGreaterThan(0); // it did actually move by the end
  });

  it('right-side append leaves buildRailPlan.pushedCars empty (no pre-existing car shifts)', () => {
    const rightLayout: ShuntingLayout = computeShuntingLayout({
      trackCount: 3,
      capacity: 6,
      hasRightLoco: true,
      width: 380,
      height: 700,
    });
    const rightAppendMove: ShuntingMoveAnim = {
      side: 'right',
      srcTrack: 0,
      dstTrack: 1,
      cars: [{ label: 'X', srcCol: 0, dstCol: 2 }],
      pushedCars: [], // as detectShuntingMove/detectShuntingUndo always produce for a right-side append
    };
    const rightPlan = buildRailPlan(rightLayout, rightAppendMove, TOKENS)!;
    expect(rightPlan.pushedCars).toEqual([]);
    expect(rightPlan.qLocoContact).toBe(-rightPlan.D1);
  });

  it('an undo-restored move (structurally identical shape, ghost travelling the other way) pushes standing cars the same way', () => {
    // Undo just swaps which end is src/dst (see detectShuntingUndo) — the
    // rail-plan math is agnostic to that, so a pushedCars entry produced by
    // an undo diff drives the exact same geometry.
    const undoMove: ShuntingMoveAnim = {
      side: 'left',
      srcTrack: 3,
      dstTrack: 0,
      cars: [
        { label: 'A', srcCol: 0, dstCol: 0 },
        { label: 'B', srcCol: 1, dstCol: 1 },
      ],
      pushedCars: [{ label: 'R0', srcCol: 0, dstCol: 2 }],
    };
    const undoPlan = buildRailPlan(layout, undoMove, TOKENS)!;
    expect(undoPlan.pushedCars).toHaveLength(1);
    const src = railPointAtQ(undoPlan.dstRow, undoPlan.pushedCars[0].srcQ);
    const dst = railPointAtQ(undoPlan.dstRow, undoPlan.pushedCars[0].dstQ);
    const p0 = pushedPositionAtT(
      0,
      undoPlan.dstRow,
      undoPlan.qLocoSrc,
      undoPlan.qLocoDst,
      undoPlan.D1,
      undoPlan.f1,
      undoPlan.f2,
      undoPlan.qLocoContact,
      undoPlan.pushedCars[0].srcQ,
      undoPlan.pushedCars[0].dstQ
    );
    const p1 = pushedPositionAtT(
      1,
      undoPlan.dstRow,
      undoPlan.qLocoSrc,
      undoPlan.qLocoDst,
      undoPlan.D1,
      undoPlan.f1,
      undoPlan.f2,
      undoPlan.qLocoContact,
      undoPlan.pushedCars[0].srcQ,
      undoPlan.pushedCars[0].dstQ
    );
    expect(p0.x).toBeCloseTo(src.x, 6);
    expect(p0.y).toBeCloseTo(src.y, 6);
    expect(p1.x).toBeCloseTo(dst.x, 6);
    expect(p1.y).toBeCloseTo(dst.y, 6);
  });
});

describe('buildEntryRailPlan (first-placement locomotive entry)', () => {
  /** Bare-loco position of an entry plan at time t (no cars, dSrc=dDst=0). */
  function entryPosAt(plan: ShuntRailPlan, t: number) {
    return railPositionAtT(t, plan.srcRow, plan.dstRow, plan.qLocoSrc, plan.qLocoDst, 0, 0, plan.D1, plan.f1, plan.f2);
  }

  describe('left locomotive', () => {
    const layout: ShuntingLayout = computeShuntingLayout({
      trackCount: 4,
      capacity: 6,
      hasRightLoco: false,
      width: 380,
      height: 700,
    });
    const dstTrack = 2;
    const plan = buildEntryRailPlan(layout, 'left', dstTrack, TOKENS)!;

    it('builds a plan', () => {
      expect(plan).toBeTruthy();
      expect(plan.f1).toBe(0);
      expect(plan.f2).toBe(0);
    });

    it('starts just off the VISIBLE left edge of the canvas (not the far rail-bleed extent), on the left (smaller-u) side of the throat', () => {
      const p0 = entryPosAt(plan, 0);
      expect(p0.y).toBeCloseTo(layout.peineLeft.convY, 6);
      expect(p0.x).toBeLessThan(layout.peineLeft.convX);
      // Well short of the rails' own far-bleed extent (they intentionally
      // overshoot much further so they read as continuing off-frame forever
      // — see shuntingLayout.ts's EDGE_BLEED_FRACTION / DECISIONES.md §5).
      expect(p0.x).toBeGreaterThan(layout.edgeLeftX);
      // Just barely off-screen: a few dp past x=0, not deep in the bleed.
      const screenX0 = screenXOf(layout, p0);
      expect(screenX0).toBeLessThan(0);
      expect(screenX0).toBeGreaterThan(-40);
    });

    it('ends EXACTLY at the destination loco slot', () => {
      const dstLoco = layout.locoRect(dstTrack, 'left');
      const p1 = entryPosAt(plan, 1);
      expect(p1.x).toBeCloseTo(dstLoco.x + dstLoco.width / 2, 6);
      expect(p1.y).toBeCloseTo(dstLoco.y, 6);
    });

    it('travels smoothly (monotonically rightward, no jump) through the throat into the row', () => {
      let lastX = -Infinity;
      for (let step = 0; step <= 40; step++) {
        const t = step / 40;
        const p = entryPosAt(plan, t);
        expect(p.x).toBeGreaterThanOrEqual(lastX - 1e-6);
        lastX = p.x;
      }
    });

    it('picks a duration within half the configured move-duration range (brisk single-leg entry, not the full switchback range)', () => {
      expect(plan.totalMs).toBeGreaterThanOrEqual(TOKENS.moveMinMs / 2);
      expect(plan.totalMs).toBeLessThanOrEqual(TOKENS.moveMaxMs / 2);
    });
  });

  describe('right locomotive', () => {
    const layout: ShuntingLayout = computeShuntingLayout({
      trackCount: 3,
      capacity: 6,
      hasRightLoco: true,
      width: 380,
      height: 700,
    });
    const dstTrack = 1;
    const plan = buildEntryRailPlan(layout, 'right', dstTrack, TOKENS)!;

    it('starts just off the VISIBLE right edge of the canvas (not the far rail-bleed extent), on the right (larger-u) side of the throat', () => {
      const p0 = entryPosAt(plan, 0);
      expect(p0.y).toBeCloseTo(layout.peineRight!.convY, 6);
      expect(p0.x).toBeGreaterThan(layout.peineRight!.convX);
      expect(p0.x).toBeLessThan(layout.edgeRightX);
      const screenX0 = screenXOf(layout, p0);
      expect(screenX0).toBeGreaterThan(layout.contentWidth);
      expect(screenX0).toBeLessThan(layout.contentWidth + 40);
    });

    it('ends EXACTLY at the destination loco slot', () => {
      const dstLoco = layout.locoRect(dstTrack, 'right');
      const p1 = entryPosAt(plan, 1);
      expect(p1.x).toBeCloseTo(dstLoco.x + dstLoco.width / 2, 6);
      expect(p1.y).toBeCloseTo(dstLoco.y, 6);
    });

    it('travels smoothly (monotonically leftward, no jump) through the throat into the row', () => {
      let lastX = Infinity;
      for (let step = 0; step <= 40; step++) {
        const t = step / 40;
        const p = entryPosAt(plan, t);
        expect(p.x).toBeLessThanOrEqual(lastX + 1e-6);
        lastX = p.x;
      }
    });
  });

  it('returns null when the requested side has no peine (right entry on a level with no right locomotive)', () => {
    const layout: ShuntingLayout = computeShuntingLayout({
      trackCount: 3,
      capacity: 6,
      hasRightLoco: false,
      width: 380,
      height: 700,
    });
    expect(buildEntryRailPlan(layout, 'right', 0, TOKENS)).toBeNull();
  });
});
