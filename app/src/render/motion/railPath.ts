/**
 * Rail-coordinate math for the shunting "switchback" travel animation:
 * a real reverse move where the WHOLE coupled train (loco + cut) pulls out
 * through the peine throat's convergence node onto the shared trunk, pauses
 * for the imagined switch throw, then reverses into the destination branch —
 * see the module doc comment in useShuntingAnimation.ts for the full
 * choreography writeup.
 *
 * The core idea: every row's track (convergence node → cubic fan branch →
 * straight stub, exactly as drawn by IsoTrackBed.tsx's `buildRunPath`) is
 * reparameterized as a single signed rail coordinate `q`, arc length measured
 * FROM the convergence node:
 *   q > 0   — on this row's branch/straight stub, `q` into the yard.
 *   q = 0   — exactly at the convergence node.
 *   q < 0   — on the shared trunk beyond the node (row-independent: every
 *             row's trunk is the same ray, so a q<0 point is identical
 *             regardless of which row's RailRow you evaluate it through —
 *             this is what makes the trunk crossing seamless between phases).
 *
 * A `RailRow` precomputes an arc-length-uniform lookup table for the curved
 * branch (built once per animated move, not per frame) so `railPointAtQ` is
 * a cheap, allocation-light, worklet-safe array lookup — no bezier evaluation
 * on the UI thread.
 *
 * Every unit in a moving cut (locomotive + cars) is pinned to a FIXED rail
 * offset behind the locomotive (`d`), so shifting the locomotive's own `q` by
 * some amount shifts every unit by the exact same arc-length amount — this is
 * what keeps the whole train rigidly, constantly spaced with no possibility
 * of overlap, instead of each unit tweening its own independently-timed path
 * (the bug this module replaces — see useShuntingAnimation.ts's doc comment).
 *
 * Pure, framework-free math (no React/Skia/Reanimated imports) — the few
 * functions actually evaluated per animation frame are marked 'worklet' so
 * Reanimated can run them directly on the UI thread; everything else here
 * runs once per detected move, on the JS thread, inside useShuntingAnimation.
 */

import { planeEdgeUAtV } from '../iso/isoCamera';
import type { ShuntingLayout } from '../layout/shuntingLayout';
import type { ShuntingMoveAnim } from './detectMove';
import { easeInOut, type Point } from './waypoints';

/**
 * How far PAST the visible canvas edge (in dp) the locomotive's entry stage
 * point sits, on top of half its own projected sprite width — enough that it
 * is fully hidden at t=0 (no half-loco poking into frame) without parking it
 * out at the track bed's full rail-bleed extent (`layout.edgeLeftX`/
 * `edgeRightX`, ~8% of the viewport past the edge, sized for the farthest row
 * — see shuntingLayout.ts). That extent is right for rails, which must read
 * as continuing off-frame, but was memorably wrong for the entry: it made the
 * locomotive invisible for the first ~0.8s of the animation while it
 * eased across the dead space between "off past the bleed" and "actually at
 * the edge" (see this function's caller, buildEntryRailPlan).
 */
const ENTRY_EDGE_MARGIN_DP = 6;

/**
 * Fraction of the shared switchback-move duration bounds
 * (`RailPlanDurationTokens.moveMinMs`/`moveMaxMs`) the locomotive entry uses
 * for its own (single-leg, no-reversal-pause) travel — see
 * `buildEntryRailPlan`'s doc comment. Half reads as brisk while still
 * clearly a deliberate roll-in-and-couple rather than a snap.
 */
const ENTRY_DURATION_SCALE = 0.5;

// ─────────────────────────── Arc-length LUT ───────────────────────────

export interface ArcLUT {
  /** Arc-length-uniform samples: us[k]/vs[k] is the point at s = (k/steps)*total. */
  us: number[];
  vs: number[];
  total: number;
  steps: number;
}

function cbez(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const m = 1 - t;
  return m * m * m * p0 + 3 * m * m * t * p1 + 3 * m * t * t * p2 + t * t * t * p3;
}

/**
 * Arc-length-parameterized LUT for the SAME cubic bezier IsoTrackBed.tsx's
 * `buildRunPath` draws for one row's fan branch: horizontal-tangent control
 * points at the branch's horizontal midpoint on each end, from the
 * convergence node (convX,convY) to the fan-out point (fanEndX,rowY).
 *
 * Built by first densely sampling the curve in the bezier's own `t` (fine
 * enough that chord length ≈ true arc length), then resampling those points
 * to be evenly spaced in cumulative arc length — so `sampleArcLUT` below can
 * index straight in with `s/total*steps` instead of a per-frame search.
 */
export function buildBranchArcLUT(
  convX: number,
  convY: number,
  fanEndX: number,
  rowY: number,
  steps = 32
): ArcLUT {
  const mid = (convX + fanEndX) / 2;
  const cpx1 = mid;
  const cpy1 = convY;
  const cpx2 = mid;
  const cpy2 = rowY;

  const fine = Math.max(steps * 4, 8);
  const fu: number[] = new Array(fine + 1);
  const fv: number[] = new Array(fine + 1);
  const fs: number[] = new Array(fine + 1);
  fs[0] = 0;
  for (let i = 0; i <= fine; i++) {
    const t = i / fine;
    fu[i] = cbez(t, convX, cpx1, cpx2, fanEndX);
    fv[i] = cbez(t, convY, cpy1, cpy2, rowY);
    if (i > 0) fs[i] = fs[i - 1] + Math.hypot(fu[i] - fu[i - 1], fv[i] - fv[i - 1]);
  }
  const total = fs[fine];

  const us: number[] = new Array(steps + 1);
  const vs: number[] = new Array(steps + 1);
  let fi = 0;
  for (let k = 0; k <= steps; k++) {
    const target = total > 0 ? (k / steps) * total : 0;
    while (fi < fine && fs[fi + 1] < target) fi++;
    const i1 = Math.min(fi + 1, fine);
    const span = fs[i1] - fs[fi];
    const frac = span > 0 ? (target - fs[fi]) / span : 0;
    us[k] = fu[fi] + (fu[i1] - fu[fi]) * frac;
    vs[k] = fv[fi] + (fv[i1] - fv[fi]) * frac;
  }

  return { us, vs, total, steps };
}

/** Evaluate an ArcLUT at arc length `s` (clamped to [0, total]). Worklet-safe. */
export function sampleArcLUT(lut: ArcLUT, s: number): Point {
  'worklet';
  const total = lut.total;
  if (total <= 0) return { x: lut.us[0], y: lut.vs[0] };
  const clamped = s < 0 ? 0 : s > total ? total : s;
  const idx = (clamped / total) * lut.steps;
  const i0 = idx >= lut.steps ? lut.steps - 1 : Math.floor(idx);
  const frac = idx - i0;
  return {
    x: lut.us[i0] + (lut.us[i0 + 1] - lut.us[i0]) * frac,
    y: lut.vs[i0] + (lut.vs[i0 + 1] - lut.vs[i0]) * frac,
  };
}

// ─────────────────────────── Rail row ───────────────────────────

export interface RailRow {
  lut: ArcLUT;
  convX: number;
  convY: number;
  fanEndX: number;
  rowY: number;
  /** +1 when the row's "into the yard" direction is increasing u (left peine), -1 when decreasing (right peine, mirrored throat). */
  rowDir: 1 | -1;
}

export function buildRailRow(convX: number, convY: number, fanEndX: number, rowY: number, steps = 32): RailRow {
  return {
    lut: buildBranchArcLUT(convX, convY, fanEndX, rowY, steps),
    convX,
    convY,
    fanEndX,
    rowY,
    rowDir: fanEndX >= convX ? 1 : -1,
  };
}

/**
 * Signed rail arc length of plane point `u` (on this row's straight stub,
 * i.e. `u` on the far side of `fanEndX` from the node) measured from the
 * convergence node. Inverse of `railPointAtQ`'s straight-line branch. Cheap
 * enough to also run as a worklet if ever needed per-frame, but today only
 * called once per move (useShuntingAnimation, JS thread) to convert a car's
 * static layout position into its rail offset.
 */
export function qAtU(row: RailRow, u: number): number {
  'worklet';
  return row.lut.total + row.rowDir * (u - row.fanEndX);
}

/**
 * General signed rail arc length of plane POINT (u,v), measured from the
 * convergence node — a robust superset of `qAtU` for static layout anchors
 * that don't necessarily sit on the row's own straight stub.
 *
 * Most units always do (every car and, usually, the locomotive), so the
 * cheap `qAtU` straight-line formula is exact for them. But
 * shuntingLayout.ts's own doc comments acknowledge that on a squeezed dense
 * layout the loco column can end up standing anywhere from over the curve to
 * past the convergence node itself ("the right loco ends up standing over
 * the first stretch of curve rather than the throat inverting itself") —
 * `qAtU`'s formula, which assumes the point is on the yard side of
 * `fanEndX`, would badly mis-extrapolate for such a point (it can even
 * invert the sign of how far into the yard the point reads as being).
 *
 * `qAtPoint` classifies the point instead of assuming:
 *   - on the yard side of `fanEndX` (the common case) → same as `qAtU`.
 *   - past the node in the trunk direction → negative, on the shared trunk.
 *   - otherwise (rare: the anchor lands within the curve's own span) →
 *     nearest sampled LUT point, which is exact to within the LUT's
 *     resolution. Only ever evaluated once or twice per detected move
 *     (buildRailPlan, JS thread) — never worklet/per-frame — so the linear
 *     scan is not a performance concern.
 */
export function qAtPoint(row: RailRow, u: number, v: number): number {
  const yardOffset = row.rowDir * (u - row.fanEndX);
  if (yardOffset >= 0) return row.lut.total + yardOffset;

  const trunkDir = -row.rowDir;
  const trunkOffset = trunkDir * (u - row.convX);
  if (trunkOffset >= 0) return -trunkOffset;

  let bestK = 0;
  let bestDist = Infinity;
  for (let k = 0; k <= row.lut.steps; k++) {
    const dx = row.lut.us[k] - u;
    const dy = row.lut.vs[k] - v;
    const d = dx * dx + dy * dy;
    if (d < bestDist) {
      bestDist = d;
      bestK = k;
    }
  }
  return (bestK / row.lut.steps) * row.lut.total;
}

/**
 * Plane point at signed rail arc length `q` along `row`: negative q is on
 * the shared trunk (row-independent — any row's RailRow gives the identical
 * point, which is exactly what makes crossing between "measured against the
 * source row" and "measured against the destination row" seamless at the
 * node), q in [0, curveLen] rides the sampled fan-branch curve, q beyond
 * curveLen is the straight stub. Worklet-safe, allocation-light (one object
 * literal return, matching the existing getPosAt/projectWithMatrix style).
 */
export function railPointAtQ(row: RailRow, q: number): Point {
  'worklet';
  if (q <= 0) {
    const trunkDir = -row.rowDir;
    return { x: row.convX + trunkDir * -q, y: row.convY };
  }
  if (q <= row.lut.total) {
    return sampleArcLUT(row.lut, q);
  }
  const extra = q - row.lut.total;
  return { x: row.fanEndX + row.rowDir * extra, y: row.rowY };
}

// ─────────────────────────── Phase timing ───────────────────────────

export type ShuntPhase = 0 | 1 | 2;

/**
 * Which of the three choreography phases normalized time `t` (0..1 over the
 * WHOLE move) falls in, and that phase's own eased local progress:
 *   phase 0 — pull-out (loco+cut travel from their source slots, through the
 *             throat, onto the trunk, until the train fully clears the node).
 *   phase 1 — reversal pause (brief stop at the switch; the loco holds still
 *             while any coupling-slack difference between the source and
 *             destination loco-to-cut gap eases out — see buildRailPlan's
 *             doc comment on `carDSrc`/`carDDst`).
 *   phase 2 — push-in (the train reverses off the trunk into the destination
 *             branch and settles at its slots).
 * Both travel phases share the reference's symmetric quadratic ease-in-out
 * (accelerate away from rest, decelerate into the next rest) — see
 * waypoints.ts's `easeInOut` — which is also exactly "ease-out into the stop,
 * ease-in out of it" from the choreography brief.
 */
export function shuntPhaseAt(t: number, f1: number, f2: number): { phase: ShuntPhase; localT: number } {
  'worklet';
  if (t <= f1) {
    const span = f1 > 0 ? t / f1 : 1;
    return { phase: 0, localT: easeInOut(span < 0 ? 0 : span > 1 ? 1 : span) };
  }
  if (t <= f2) {
    const span = f2 > f1 ? (t - f1) / (f2 - f1) : 1;
    return { phase: 1, localT: easeInOut(span < 0 ? 0 : span > 1 ? 1 : span) };
  }
  const span = f2 < 1 ? (t - f2) / (1 - f2) : 1;
  return { phase: 2, localT: easeInOut(span < 0 ? 0 : span > 1 ? 1 : span) };
}

/**
 * The locomotive's OWN signed rail arc length `q` at normalized time `t`,
 * ignoring any per-unit offset — phase 0's pull-out ramp, phase 1's constant
 * trunk hold, and phase 2's push-in ramp (see shuntPhaseAt). Factored out of
 * `railPositionAtT` so `pushedPositionAtT` (a destination-track car displaced
 * by the arriving cut — never itself travelling through the throat) can
 * derive how far the arriving cut has advanced without duplicating the
 * per-phase formula.
 */
export function locoQAtT(t: number, qLocoSrc: number, qLocoDst: number, D1: number, f1: number, f2: number): number {
  'worklet';
  const { phase, localT } = shuntPhaseAt(t, f1, f2);
  if (phase === 0) return qLocoSrc + (-D1 - qLocoSrc) * localT;
  if (phase === 1) return -D1;
  return -D1 + (qLocoDst - -D1) * localT;
}

/**
 * Plane position of one unit (locomotive or car) of a moving cut at
 * normalized time `t` in [0,1]. `dSrc`/`dDst` are the unit's own fixed rail
 * offset behind the locomotive at the source/destination end (0 for the
 * locomotive itself) — see buildRailPlan. `D1` is the pull-out depth (how far
 * onto the trunk the locomotive must go so the WHOLE train, measured by
 * whichever of the source or destination configuration needs more room,
 * fully clears the convergence node).
 */
export function railPositionAtT(
  t: number,
  srcRow: RailRow,
  dstRow: RailRow,
  qLocoSrc: number,
  qLocoDst: number,
  dSrc: number,
  dDst: number,
  D1: number,
  f1: number,
  f2: number
): Point {
  'worklet';
  const { phase, localT } = shuntPhaseAt(t, f1, f2);
  if (phase === 0) {
    return railPointAtQ(srcRow, locoQAtT(t, qLocoSrc, qLocoDst, D1, f1, f2) + dSrc);
  }
  if (phase === 1) {
    // Loco holds at the trunk depth every unit needed to clear the node;
    // only the unit's OWN offset eases from its source gap to its
    // destination gap (see carDSrc/carDDst doc comment) — clamped to <=0 so
    // this always resolves through the row-independent trunk formula
    // regardless of which row's RailRow is passed in.
    const d = dSrc + (dDst - dSrc) * localT;
    const q = -D1 + d;
    return railPointAtQ(srcRow, q > 0 ? 0 : q);
  }
  return railPointAtQ(dstRow, locoQAtT(t, qLocoSrc, qLocoDst, D1, f1, f2) + dDst);
}

/**
 * Plane position of a PUSHED car — a car that was already standing on the
 * destination track before the arriving cut landed (see
 * detectMove.ts's `ShuntingPushedCar`). It never travels through the throat:
 * it sits still at its pre-move slot (`srcQ`) until the arriving cut's
 * coupling unit closes the gap on it (`qLocoContact`, computed once in
 * buildRailPlan — the loco `q` at which contact occurs), then rides along
 * RIGIDLY IN LOCKSTEP with however far the cut has advanced since, reaching
 * exactly `dstQ` at t=1 by construction (`locoQAtT(1,...) === qLocoDst`
 * always, so `prog` is exactly 1 at the end of the move — no separate
 * "landing" tween is needed, it just falls out of the shared clock).
 *
 * `prog` is a plain linear remap of the LOCOMOTIVE's own push-in advancement,
 * not a time-based tween — this is what keeps the push perfectly synced to
 * the arriving cut's actual (eased) motion instead of drifting out of phase
 * with it, and what makes "stand still before contact" fall out for free:
 * before contact `qLocoNow < qLocoContact`, so `prog` clamps to 0.
 *
 * Gated on phase 2 explicitly (`t <= f2` short-circuits to the stationary
 * source slot) rather than purely on comparing `qLocoNow` to `qLocoContact`:
 * `locoQAtT` is NOT monotonic across the whole move (phase 0 REDUCES q as the
 * train pulls out onto the trunk, phase 2 then INCREASES it during push-in —
 * see its own doc comment), so on a track pair whose loco rests at the same
 * plane position at both ends (qLocoSrc === qLocoDst, common when both loco
 * columns sit at the same fixed layout offset) phase 0's *starting* q can
 * spuriously already exceed `qLocoContact`, well before the cut has moved at
 * all. Restricting to phase 2 sidesteps that ambiguity entirely: a pushed
 * car can only ever be reached by the incoming cut once that cut is actually
 * arriving on the destination row.
 */
export function pushedPositionAtT(
  t: number,
  dstRow: RailRow,
  qLocoSrc: number,
  qLocoDst: number,
  D1: number,
  f1: number,
  f2: number,
  qLocoContact: number,
  srcQ: number,
  dstQ: number
): Point {
  'worklet';
  if (t <= f2) {
    return railPointAtQ(dstRow, srcQ);
  }
  const qLocoNow = locoQAtT(t, qLocoSrc, qLocoDst, D1, f1, f2);
  const denom = qLocoDst - qLocoContact;
  let prog = denom !== 0 ? (qLocoNow - qLocoContact) / denom : 1;
  if (prog < 0) prog = 0;
  else if (prog > 1) prog = 1;
  return railPointAtQ(dstRow, srcQ + (dstQ - srcQ) * prog);
}

// ─────────────────────────── Move-level plan ───────────────────────────

/** A pre-existing destination-track car's rail-arc geometry for `pushedPositionAtT`. */
export interface PushedCarPlan {
  label: string;
  /** Rail arc length (on the DESTINATION row) of its pre-move slot. */
  srcQ: number;
  /** Rail arc length of its post-move slot. */
  dstQ: number;
}

export interface ShuntRailPlan {
  srcRow: RailRow;
  dstRow: RailRow;
  qLocoSrc: number;
  qLocoDst: number;
  /** Trunk depth the locomotive pulls out to so the whole train clears the node. */
  D1: number;
  /** Fraction of the total move duration where phase 0 (pull-out) ends. */
  f1: number;
  /** Fraction of the total move duration where phase 1 (reversal pause) ends. */
  f2: number;
  /** Per-car rail offset behind the locomotive, aligned 1:1 with move.cars, at the source end. */
  carDSrc: number[];
  /** Per-car rail offset behind the locomotive, aligned 1:1 with move.cars, at the destination end. */
  carDDst: number[];
  /** Total wall-clock duration (ms) of the whole 3-phase move. */
  totalMs: number;
  /** Pre-existing destination-track cars displaced by this move (see PushedCarPlan). Empty when none. */
  pushedCars: PushedCarPlan[];
  /**
   * The locomotive's own rail arc length `q` (see locoQAtT) at the instant
   * the arriving cut's coupling unit reaches the pushed block's pre-move
   * front edge — i.e. when the "gap closes" and the shove begins. Meaningless
   * (defaults to `-D1`, phase 2's start) when `pushedCars` is empty.
   */
  qLocoContact: number;
}

export interface RailPlanDurationTokens {
  moveMinMs: number;
  moveMaxMs: number;
  pauseMinMs: number;
  pauseMaxMs: number;
}

/**
 * Builds the full rail plan for a detected shunting move: the source and
 * destination row rail geometry, every unit's fixed rail offset behind the
 * locomotive at both ends, and the phase timing.
 *
 * `carDSrc`/`carDDst` are generally IDENTICAL for a left-side move (the
 * locomotive always sits immediately adjacent to its cut at both ends — see
 * shuntingLayout.ts's `locoRect`/`carX`, a fixed layout offset independent of
 * which track), so the whole train keeps one truly constant arc-length
 * spacing for its entire journey — the strict reading of the choreography
 * brief. A right-side move's locomotive column is fixed PAST the full
 * capacity width regardless of occupancy (see shuntingLayout.ts's
 * `locoRect`), so the gap between the locomotive and the nearest car of its
 * cut can genuinely differ between the source track (however many cars
 * already sat there) and the destination track (however many sit there) —
 * the chosen choreography keeps EVERY car's spacing to its neighbours
 * exactly constant throughout (that never changes, src or dst), and eases
 * only the locomotive-to-cut gap itself, during the reversal pause at the
 * node, reading as coupler slack taking up/paying out while stopped rather
 * than a mid-transit snap. `D1` is chosen as the larger of the two
 * configurations' required clearance so the pause always resolves on the
 * shared trunk (row-independent) for every unit, at every moment of the
 * pause, regardless of which end's gap is currently larger.
 */
export function buildRailPlan(
  layout: ShuntingLayout,
  move: ShuntingMoveAnim,
  tokens: RailPlanDurationTokens,
  lutSteps = 32
): ShuntRailPlan | null {
  const peine = move.side === 'left' ? layout.peineLeft : layout.peineRight;
  if (!peine) return null;

  const srcRow = buildRailRow(peine.convX, peine.convY, peine.fanEndX, layout.rowV(move.srcTrack), lutSteps);
  const dstRow = buildRailRow(peine.convX, peine.convY, peine.fanEndX, layout.rowV(move.dstTrack), lutSteps);

  const srcLocoRect = layout.locoRect(move.srcTrack, move.side);
  const dstLocoRect = layout.locoRect(move.dstTrack, move.side);
  const qLocoSrc = qAtPoint(srcRow, srcLocoRect.x + srcLocoRect.width / 2, srcLocoRect.y);
  const qLocoDst = qAtPoint(dstRow, dstLocoRect.x + dstLocoRect.width / 2, dstLocoRect.y);

  const carDSrc: number[] = [];
  const carDDst: number[] = [];
  let maxD = 0;
  for (const car of move.cars) {
    const srcB = layout.carBillboard(move.srcTrack, car.srcCol);
    const dstB = layout.carBillboard(move.dstTrack, car.dstCol);
    const dSrc = qAtPoint(srcRow, srcB.u, srcB.v) - qLocoSrc;
    const dDst = qAtPoint(dstRow, dstB.u, dstB.v) - qLocoDst;
    carDSrc.push(dSrc);
    carDDst.push(dDst);
    if (dSrc > maxD) maxD = dSrc;
    if (dDst > maxD) maxD = dDst;
  }
  const D1 = Math.max(0, maxD);

  // Clamped to >=0: a squeezed layout can occasionally place a locomotive's
  // resting slot already past the convergence node (qLocoSrc/qLocoDst < 0,
  // see qAtPoint's doc comment) — that shortens this phase's real travel to
  // near-zero rather than producing a negative "distance".
  const L1 = Math.max(0, qLocoSrc + D1);
  const L2 = Math.max(0, D1 + qLocoDst);
  const totalLen = Math.max(1, L1 + L2);
  const refLen = Math.max(1, layout.camera.planeWidth);
  const distFactor = Math.min(1, totalLen / refLen);

  const totalMoveMs = tokens.moveMinMs + (tokens.moveMaxMs - tokens.moveMinMs) * distFactor;
  const pauseMs = Math.min(
    totalMoveMs * 0.3,
    tokens.pauseMinMs + (tokens.pauseMaxMs - tokens.pauseMinMs) * distFactor
  );
  const travelMs = Math.max(1, totalMoveMs - pauseMs);
  const durationMs1 = L1 + L2 > 0 ? travelMs * (L1 / (L1 + L2)) : travelMs / 2;
  const durationMs2 = travelMs - durationMs1;
  const totalMs = durationMs1 + pauseMs + durationMs2;

  // ── Pushed (pre-existing destination-track) cars ──────────────────────
  //
  // They only ever ride the destination row (never the throat), so their
  // geometry is entirely in dstRow's q-space: each keeps its pre-move slot
  // (srcQ) until the arriving cut's coupling unit — the arriving car
  // immediately adjacent to the pushed block, found by comparing dstCol
  // ranges structurally rather than assuming which side prepends/appends —
  // closes the one-column gap on it. See pushedPositionAtT's doc comment for
  // how `qLocoContact` then drives the shove.
  const pushedCarsIn = move.pushedCars ?? [];
  const pushedCars: PushedCarPlan[] = pushedCarsIn.map((pc) => {
    const srcB = layout.carBillboard(move.dstTrack, pc.srcCol);
    const dstB = layout.carBillboard(move.dstTrack, pc.dstCol);
    return {
      label: pc.label,
      srcQ: qAtPoint(dstRow, srcB.u, srcB.v),
      dstQ: qAtPoint(dstRow, dstB.u, dstB.v),
    };
  });

  let qLocoContact = -D1; // Fallback: shove spans the whole push-in phase.
  if (pushedCars.length > 0 && move.cars.length > 0) {
    const b0 = layout.carBillboard(move.dstTrack, 0);
    const b1 = layout.carBillboard(move.dstTrack, 1);
    const colPitchQ = qAtPoint(dstRow, b1.u, b1.v) - qAtPoint(dstRow, b0.u, b0.v);

    const arrivingDstCols = move.cars.map((c) => c.dstCol);
    const pushedDstCols = pushedCarsIn.map((c) => c.dstCol);
    const maxArriving = Math.max(...arrivingDstCols);
    const minArriving = Math.min(...arrivingDstCols);
    const minPushed = Math.min(...pushedDstCols);
    const maxPushed = Math.max(...pushedDstCols);

    let couplingCarIdx = -1;
    let nearestPushedIdx = -1;
    if (minPushed > maxArriving) {
      // The common case: the arriving cut is inserted BEFORE the pushed
      // block (e.g. a left-side prepend) — its last (highest-dstCol) car
      // couples with the pushed block's first (lowest-dstCol, nearest) car.
      couplingCarIdx = move.cars.findIndex((c) => c.dstCol === maxArriving);
      nearestPushedIdx = pushedCarsIn.findIndex((c) => c.dstCol === minPushed);
    } else if (maxPushed < minArriving) {
      // The mirror case: the arriving cut lands AFTER the pushed block.
      couplingCarIdx = move.cars.findIndex((c) => c.dstCol === minArriving);
      nearestPushedIdx = pushedCarsIn.findIndex((c) => c.dstCol === maxPushed);
    }

    if (couplingCarIdx >= 0 && nearestPushedIdx >= 0) {
      const dDstCoupling = carDDst[couplingCarIdx] ?? 0;
      // Contact is when the coupling car's own q (qLoco + dDstCoupling)
      // equals the pushed block's pre-move front edge minus one column pitch
      // (touching bumper-to-bumper on centre-to-centre coordinates, not
      // overlapping it) — see pushedPositionAtT's doc comment.
      qLocoContact = pushedCars[nearestPushedIdx].srcQ - colPitchQ - dDstCoupling;
    }
  }

  return {
    srcRow,
    dstRow,
    qLocoSrc,
    qLocoDst,
    D1,
    f1: durationMs1 / totalMs,
    f2: (durationMs1 + pauseMs) / totalMs,
    carDSrc,
    carDDst,
    totalMs,
    pushedCars,
    qLocoContact,
  };
}

/**
 * Builds the rail plan for the locomotive's FIRST placement (see
 * detectMove.ts's `detectShuntingLocoEntry`): rolling in from OFF-FRAME on
 * its own side, along the shared trunk, through the destination row's fan
 * branch, into its slot — the same rail geometry every other move rides,
 * just a single uninterrupted leg (no pull-out/pause/push-in phases, because
 * there is no source row to pull out of).
 *
 * Reuses `railPositionAtT`/`shuntPhaseAt` completely unmodified by choosing
 * `f1 = f2 = 0`: for every `t > 0` that always resolves to phase 2 (the
 * push-in formula, `railPointAtQ(dstRow, locoQAtT(...))`), and at `t = 0`
 * phase 0's own formula (`qLocoSrc + (-D1-qLocoSrc)*localT` with `localT`
 * forced to 1 by the `f1 <= 0` branch of `shuntPhaseAt`) collapses to the
 * exact same `-D1` starting point — so the two formulas agree exactly at the
 * t=0 seam and the whole move is one continuous eased ramp from the edge
 * to the slot. See useShuntingAnimation.ts for how this plan is wired into
 * the same GhostLoco component every other move already uses.
 *
 * The "off-frame" starting point is just past the VISIBLE canvas edge — not
 * the track bed's own rail-bleed extent (`layout.edgeLeftX`/`edgeRightX`,
 * ~8% of the viewport further out again, sized for the farthest row so rails
 * read as continuing off-frame forever — see shuntingLayout.ts). Staging the
 * entry that far out left the locomotive invisible for the first ~0.8s of
 * the animation while it eased across dead space the player could never see
 * anyway. `planeEdgeUAtV` (iso/isoCamera.ts) instead solves for the plane u
 * that projects to screen x = 0 (or the canvas width) AT THE TRUNK'S OWN
 * depth (`row.convY`, not the far edge v=0 `planeEdgeU` uses for rails), then
 * `ENTRY_EDGE_MARGIN_DP` plus half the sprite's own projected width pushes it
 * out just enough to be fully hidden at t=0 rather than clipped mid-body —
 * read as a signed rail arc length via `qAtPoint`'s trunk classification
 * exactly as before (that u still sits past the convergence node on the
 * trunk side for either peine, so it resolves to a negative trunk `q` with
 * no special-casing needed here).
 */
export function buildEntryRailPlan(
  layout: ShuntingLayout,
  side: 'left' | 'right',
  dstTrack: number,
  tokens: RailPlanDurationTokens,
  lutSteps = 32
): ShuntRailPlan | null {
  const peine = side === 'left' ? layout.peineLeft : layout.peineRight;
  if (!peine) return null;

  const row = buildRailRow(peine.convX, peine.convY, peine.fanEndX, layout.rowV(dstTrack), lutSteps);

  const dstLocoRect = layout.locoRect(dstTrack, side);
  const qLocoDst = qAtPoint(row, dstLocoRect.x + dstLocoRect.width / 2, dstLocoRect.y);

  const halfSpriteScreenW = (layout.locoBodyWidth * layout.camera.depthScaleAt(row.convY)) / 2;
  const bleedPx = halfSpriteScreenW + ENTRY_EDGE_MARGIN_DP;
  const edgeScreenX = side === 'left' ? -bleedPx : layout.contentWidth + bleedPx;
  const edgeU = planeEdgeUAtV(layout.camera, edgeScreenX, row.convY);
  const qLocoSrc = qAtPoint(row, edgeU, row.convY);

  const D1 = Math.max(0, -qLocoSrc);

  const totalLen = Math.max(0, qLocoDst - qLocoSrc);
  const refLen = Math.max(1, layout.camera.planeWidth);
  const distFactor = Math.min(1, totalLen / refLen);
  // Entry is a single uninterrupted leg (no reversal pause to read, nothing
  // else on screen competing for attention), so it plays brisker than the
  // full 3-phase switchback move `tokens` is otherwise calibrated for — half
  // its min/max, still distance-scaled the same way. Staging the start just
  // off the visible edge (above) already cut the WASTED off-screen travel;
  // this cuts the remaining on-screen travel time to match ("brisk, not
  // sluggish", still clearly arriving from outside — see the module doc).
  const entryMoveMinMs = tokens.moveMinMs * ENTRY_DURATION_SCALE;
  const entryMoveMaxMs = tokens.moveMaxMs * ENTRY_DURATION_SCALE;
  const totalMs = Math.max(1, entryMoveMinMs + (entryMoveMaxMs - entryMoveMinMs) * distFactor);

  return {
    srcRow: row,
    dstRow: row,
    qLocoSrc,
    qLocoDst,
    D1,
    f1: 0,
    f2: 0,
    carDSrc: [],
    carDDst: [],
    totalMs,
    pushedCars: [],
    qLocoContact: -D1,
  };
}
