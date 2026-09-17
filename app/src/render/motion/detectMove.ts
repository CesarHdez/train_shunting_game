/**
 * prevState → state diffing: decides WHAT to animate (see boardContract.ts
 * doc comment — "the board may receive the previous state to tween from").
 *
 * The engine already applied the move synchronously, so by the time a board
 * receives (state, prevState) the data is final; these pure functions infer
 * the semantic move (which cars, from where, to where) purely by comparing
 * the two snapshots, using the same activation rules as
 * src/engine/shunting.ts / classification.ts (so this stays correct as long
 * as the engine's semantics stay correct — no duplicated game rules, only
 * diffing).
 */

import type { ShuntingState, ClassificationState } from '../../engine/types';

export interface ShuntingMoveCar {
  label: string;
  srcCol: number;
  /** Exact destination column, computed from the pre-move destination track (fixes a minor visual snap present in the reference, which always reused the source column for the ghost's landing x). */
  dstCol: number;
}

/**
 * A car that was already standing on the destination track BEFORE the
 * arriving cut landed, and whose column shifted as a structural side effect
 * of the engine's front-compaction (e.g. a left-side PREPEND pushes every
 * pre-existing car back by the arriving cut's length; a right-side APPEND
 * normally leaves them untouched — see computePushedCars). `srcCol` is where
 * it visually sits until the arriving cut couples with it; `dstCol` is where
 * it ends up, in lockstep with the arriving cut's own arrival.
 */
export interface ShuntingPushedCar {
  label: string;
  srcCol: number;
  dstCol: number;
}

export interface ShuntingMoveAnim {
  side: 'left' | 'right';
  srcTrack: number;
  dstTrack: number;
  cars: ShuntingMoveCar[];
  /**
   * Pre-existing destination-track cars displaced by this move. Always []
   * when `cars` is []. Optional (defaults to []) so hand-built test fixtures
   * that predate this field keep compiling — every real detector below
   * always populates it.
   */
  pushedCars?: ShuntingPushedCar[];
}

/**
 * Structural diff of the destination track's own content, before vs after
 * this animated event, to find pre-existing cars whose column changed —
 * exactly the same "diff two snapshots, don't re-derive engine rules"
 * approach detectShuntingMove/detectShuntingUndo already use for `cars`.
 *
 * `before`/`after` are the destination track's row arrays at the two ends of
 * THIS animation (for a forward move: prev/curr; for an undo, the same
 * prev/curr params, just already reinterpreted as "the track's content before
 * / after the returning cars land back on it" by the caller — see
 * detectShuntingUndo's doc comment). Cars belonging to the arriving cut
 * itself (`cars`, identified by their known `dstCol`s) are excluded from
 * `after` before pairing, so what's left lines up 1:1, in order, with the
 * standing cars in `before` (insertion never reorders existing cars).
 */
function computePushedCars(before: string[], after: string[], cars: ShuntingMoveCar[]): ShuntingPushedCar[] {
  if (cars.length === 0) return [];
  const arrivingDstCols = new Set(cars.map((c) => c.dstCol));

  const beforeStanding: { label: string; col: number }[] = [];
  for (let i = 0; i < before.length; i++) {
    if (before[i] !== '') beforeStanding.push({ label: before[i], col: i });
  }
  const afterStanding: { label: string; col: number }[] = [];
  for (let i = 0; i < after.length; i++) {
    if (after[i] !== '' && !arrivingDstCols.has(i)) afterStanding.push({ label: after[i], col: i });
  }

  const n = Math.min(beforeStanding.length, afterStanding.length);
  const pushed: ShuntingPushedCar[] = [];
  for (let i = 0; i < n; i++) {
    const b = beforeStanding[i];
    const a = afterStanding[i];
    if (b.col !== a.col) pushed.push({ label: b.label, srcCol: b.col, dstCol: a.col });
  }
  return pushed;
}

export function tracksEqual(a: string[][], b: string[][]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ra = a[i];
    const rb = b[i];
    if (ra.length !== rb.length) return false;
    for (let j = 0; j < ra.length; j++) {
      if (ra[j] !== rb[j]) return false;
    }
  }
  return true;
}

function occupiedCount(row: string[]): number {
  let n = 0;
  for (let i = 0; i < row.length; i++) if (row[i] !== '') n++;
  return n;
}

/**
 * Detect a single left/right locomotive move (activation-only or car move)
 * between two consecutive shunting snapshots. Returns null when nothing
 * animatable happened (undo, restart, car (re)selection, rejected move).
 */
export function detectShuntingMove(
  prev: ShuntingState | null | undefined,
  curr: ShuntingState
): ShuntingMoveAnim | null {
  if (!prev) return null;
  // Only single forward steps push history + increment moves by exactly 1;
  // undo/restart change `moves` by any other delta and must snap, not tween.
  if (curr.moves !== prev.moves + 1) return null;

  const leftChanged = prev.locoTrack !== curr.locoTrack;
  const rightChanged = prev.hasRightLoco && prev.rightLocoTrack !== curr.rightLocoTrack;
  const tracksChanged = !tracksEqual(prev.tracks, curr.tracks);

  if (leftChanged) {
    const srcTrack = prev.locoTrack;
    const dstTrack = curr.locoTrack;
    if (srcTrack < 0 || dstTrack < 0) return null;
    if (!tracksChanged) return { side: 'left', srcTrack, dstTrack, cars: [], pushedCars: [] };
    const selected = [...prev.selectedCars].sort((a, b) => a - b);
    const destCarsBefore = prev.tracks[dstTrack].filter((c) => c !== '').length;
    const cars: ShuntingMoveCar[] = selected.map((col, i) => ({
      label: prev.tracks[srcTrack][col],
      srcCol: col,
      dstCol: i, // left loco always prepends, matching headBlockIndices' 0..k-1 selection
    }));
    void destCarsBefore;
    const pushedCars = computePushedCars(prev.tracks[dstTrack], curr.tracks[dstTrack], cars);
    return { side: 'left', srcTrack, dstTrack, cars, pushedCars };
  }

  if (rightChanged) {
    const srcTrack = prev.rightLocoTrack;
    const dstTrack = curr.rightLocoTrack;
    if (srcTrack < 0 || dstTrack < 0) return null;
    if (!tracksChanged) return { side: 'right', srcTrack, dstTrack, cars: [], pushedCars: [] };
    const selected = [...prev.rightSelectedCars].sort((a, b) => a - b);
    const destCarsBefore = prev.tracks[dstTrack].filter((c) => c !== '').length;
    const cars: ShuntingMoveCar[] = selected.map((col, i) => ({
      label: prev.tracks[srcTrack][col],
      srcCol: col,
      dstCol: destCarsBefore + i, // right loco always appends after existing cars
    }));
    const pushedCars = computePushedCars(prev.tracks[dstTrack], curr.tracks[dstTrack], cars);
    return { side: 'right', srcTrack, dstTrack, cars, pushedCars };
  }

  return null;
}

/**
 * Detect a single UNDO of a left/right locomotive move between two
 * consecutive shunting snapshots: `prev` is the POST-move state the user was
 * just looking at (about to be undone), `curr` is the RESTORED pre-move
 * state `ShuntingEngine.undo()` just produced. Returns an anim descriptor in
 * the SAME shape as detectShuntingMove — `srcTrack`/`dstTrack` are always
 * "where the ghost starts" / "where it ends" for THIS animation, i.e.
 * already the reverse of the original move's direction (srcTrack = the
 * track the cars currently visually sit on = prev.locoTrack; dstTrack = the
 * restored track they travel back to = curr.locoTrack) — GhostLayer/GhostCar
 * don't need to know this was an undo at all, they just animate src→dst like
 * any other move.
 *
 * Car identity/columns are derived structurally rather than from
 * prev.selectedCars (which no longer describes the undone move — the engine
 * resets selection on undo): moveSelected always PREPENDS the moving block
 * to the destination track and moveSelectedRight always APPENDS it, and the
 * moving block is always a column-contiguous prefix (left) or suffix (right)
 * of its source track (headBlockIndices / nonEmptyIndices+suffix-filter),
 * so occupied-car-count deltas between prev/curr are enough to reconstruct
 * exact source/destination columns without needing the original selection.
 */
export function detectShuntingUndo(
  prev: ShuntingState | null | undefined,
  curr: ShuntingState
): ShuntingMoveAnim | null {
  if (!prev) return null;
  // Only a single undo (one history pop) changes `moves` by exactly -1;
  // multi-step history clearing (restart) must not be treated as an undo.
  if (curr.moves !== prev.moves - 1) return null;

  const leftChanged = prev.locoTrack !== curr.locoTrack;
  const rightChanged = prev.hasRightLoco && prev.rightLocoTrack !== curr.rightLocoTrack;
  const tracksChanged = !tracksEqual(prev.tracks, curr.tracks);

  if (leftChanged) {
    const srcTrack = prev.locoTrack;
    const dstTrack = curr.locoTrack;
    if (srcTrack < 0 || dstTrack < 0) return null;
    if (!tracksChanged) return { side: 'left', srcTrack, dstTrack, cars: [], pushedCars: [] };

    // Left loco always PREPENDS on the way out, so the returning block is a
    // 0-based prefix at BOTH ends: columns 0..k-1 of prev.tracks[srcTrack]
    // (where the cars currently sit, about to fly back) land back at columns
    // 0..k-1 of curr.tracks[dstTrack] (their fully-restored original slot).
    const k = occupiedCount(prev.tracks[srcTrack]) - occupiedCount(curr.tracks[srcTrack]);
    if (k <= 0) return { side: 'left', srcTrack, dstTrack, cars: [], pushedCars: [] };
    const cars: ShuntingMoveCar[] = [];
    for (let i = 0; i < k; i++) {
      cars.push({ label: prev.tracks[srcTrack][i], srcCol: i, dstCol: i });
    }
    // dstTrack here is the RESTORED track (curr.locoTrack): its pre-existing
    // cars sat front-compacted at prev.tracks[dstTrack] (the original move
    // having removed the returning block from it) and land back shifted by
    // the returning block's length in curr.tracks[dstTrack] — same
    // structural shift as a fresh left-side prepend.
    const pushedCars = computePushedCars(prev.tracks[dstTrack], curr.tracks[dstTrack], cars);
    return { side: 'left', srcTrack, dstTrack, cars, pushedCars };
  }

  if (rightChanged) {
    const srcTrack = prev.rightLocoTrack;
    const dstTrack = curr.rightLocoTrack;
    if (srcTrack < 0 || dstTrack < 0) return null;
    if (!tracksChanged) return { side: 'right', srcTrack, dstTrack, cars: [], pushedCars: [] };

    const occSrcPrev = occupiedCount(prev.tracks[srcTrack]);
    const k = occSrcPrev - occupiedCount(curr.tracks[srcTrack]);
    if (k <= 0) return { side: 'right', srcTrack, dstTrack, cars: [], pushedCars: [] };

    // Right loco always APPENDS on the way out, so on prev.tracks[srcTrack]
    // (current visual position) the returning block sits at the TAIL —
    // columns destCarsBefore..destCarsBefore+k-1, where destCarsBefore is
    // whatever was already on that track before the original move. On
    // curr.tracks[dstTrack] (fully restored), those same cars occupy the
    // TAIL of the restored, front-compacted track.
    const destCarsBefore = occSrcPrev - k;
    const occDstCurr = occupiedCount(curr.tracks[dstTrack]);
    const tailStart = occDstCurr - k;

    const cars: ShuntingMoveCar[] = [];
    for (let i = 0; i < k; i++) {
      cars.push({
        label: prev.tracks[srcTrack][destCarsBefore + i],
        srcCol: destCarsBefore + i,
        dstCol: tailStart + i,
      });
    }
    const pushedCars = computePushedCars(prev.tracks[dstTrack], curr.tracks[dstTrack], cars);
    return { side: 'right', srcTrack, dstTrack, cars, pushedCars };
  }

  return null;
}

/**
 * Detect the locomotive's FIRST placement onto a track — `locoTrack`
 * (left) or `rightLocoTrack` (right) going from -1 to >= 0.
 *
 * This is deliberately a SEPARATE detector from `detectShuntingMove`, not an
 * extra branch inside it: `ShuntingEngine.positionLocomotive` /
 * `positionLocomotiveRight` only push history and increment `moves` when
 * `!isFirst` (src/engine/shunting.ts) — first placement leaves `moves`
 * completely untouched, so `curr.moves === prev.moves + 1` (the gate every
 * other detector in this module relies on) never holds for it. Checked
 * independently of `moves` entirely; the -1→track transition is unambiguous
 * on its own.
 *
 * Returned in the SAME `ShuntingMoveAnim` shape as every other detected move
 * so the ghost-travel machinery (buildEntryRailPlan/GhostLayer) needs no
 * special case to RENDER it: `srcTrack: -1` is the sentinel "no source row"
 * (there is nothing to hide on a sending end that never existed — see
 * ShuntingBoard's hideLeftLoco/hideRightLoco, which only ever match a real
 * track index), and `cars`/`pushedCars` are always empty (a bare locomotive
 * has nothing to couple yet).
 */
export function detectShuntingLocoEntry(
  prev: ShuntingState | null | undefined,
  curr: ShuntingState
): ShuntingMoveAnim | null {
  if (!prev) return null;
  if (prev.locoTrack === -1 && curr.locoTrack >= 0) {
    return { side: 'left', srcTrack: -1, dstTrack: curr.locoTrack, cars: [], pushedCars: [] };
  }
  if (prev.hasRightLoco && prev.rightLocoTrack === -1 && curr.hasRightLoco && curr.rightLocoTrack >= 0) {
    return { side: 'right', srcTrack: -1, dstTrack: curr.rightLocoTrack, cars: [], pushedCars: [] };
  }
  return null;
}

export interface ClassificationMoveAnim {
  fromArrival: number;
  toClasif: number;
  label: string;
  /** Exact destination column (classification tracks only ever append). */
  dstCol: number;
  /**
   * True for an UNDO's reverse animation: the ghost travels FROM the
   * classification track (toClasif/dstCol) BACK TO the arrival head
   * (fromArrival). Absent/false for a normal forward push. Consumers that
   * only care about "where does the ghost start/end" should branch on this
   * once, at the call site that builds x0/y0/x1/y1 — everything else
   * (progress/settle/flash timing) is identical either direction.
   */
  reverse?: boolean;
}

/** Detect a single "push head car" move between two consecutive classification snapshots. */
export function detectClassificationMove(
  prev: ClassificationState | null | undefined,
  curr: ClassificationState
): ClassificationMoveAnim | null {
  if (!prev) return null;
  if (curr.moves !== prev.moves + 1) return null;
  const fromArrival = prev.viaSel;
  if (fromArrival < 0 || fromArrival >= prev.arrivals.length) return null;
  const via = prev.arrivals[fromArrival];
  if (!via || via.length === 0) return null;
  const label = via[0];

  for (let i = 0; i < curr.clasif.length; i++) {
    const prevLen = prev.clasif[i]?.length ?? 0;
    if (curr.clasif[i].length === prevLen + 1 && curr.clasif[i][prevLen] === label) {
      return { fromArrival, toClasif: i, label, dstCol: prevLen };
    }
  }
  return null;
}

/**
 * Detect a single UNDO of a classification push: `prev` is the POST-push
 * state (about to be undone), `curr` is the RESTORED pre-push state
 * `ClassificationEngine.undo()` just produced. `empujar()` always pops the
 * arrival's HEAD (index 0) and PUSHES onto the classification track's TAIL,
 * so the reverse is unambiguous: find the classif track that shrank by one
 * car and the arrival track that grew by one (matching label, landing back
 * at its head) — same diffing approach as detectShuntingUndo, just simpler
 * because classification tracks are pure stacks (no left/right sides).
 *
 * Returned with `reverse: true` — callers must swap which end (arrival vs
 * classif) is the animation's start vs end; see ClassificationMoveAnim.
 */
export function detectClassificationUndo(
  prev: ClassificationState | null | undefined,
  curr: ClassificationState
): ClassificationMoveAnim | null {
  if (!prev) return null;
  if (curr.moves !== prev.moves - 1) return null;

  for (let i = 0; i < prev.clasif.length; i++) {
    const prevLen = prev.clasif[i]?.length ?? 0;
    const currLen = curr.clasif[i]?.length ?? 0;
    if (currLen !== prevLen - 1) continue;
    const label = prev.clasif[i][prevLen - 1];

    for (let j = 0; j < curr.arrivals.length; j++) {
      const cArr = curr.arrivals[j] ?? [];
      const pArr = prev.arrivals[j] ?? [];
      if (cArr.length === pArr.length + 1 && cArr[0] === label) {
        return { fromArrival: j, toClasif: i, label, dstCol: prevLen - 1, reverse: true };
      }
    }
  }
  return null;
}
