/**
 * Drives the ghost-layer travel animation for ShuntingBoard.
 *
 * Architecture (see boardContract.ts + this repo's design-system.md §5.1):
 *  - The engine already committed the move; `state` is final.
 *  - We diff (prevState, state) once per update (detectShuntingMove) to
 *    learn WHAT just happened, and keep that descriptor in React state only
 *    for the duration of the animation (2 re-renders per move: start, end)
 *    so the board knows which rows should hide their static loco/cars.
 *  - The actual per-frame motion (`progress`) lives entirely in a
 *    Reanimated shared value and is fed straight into Skia component props
 *    via useDerivedValue in the ghost primitives — zero JS-thread work per
 *    frame, per design-system.md §5.2's "independent Reanimated loops"
 *    guidance.
 *
 * CHOREOGRAPHY — a real switchback (reverse) shunting move, the whole
 * coupled train riding the rails as one rigid unit (railPath.ts):
 *
 *   1. PULL-OUT (phase 0): the locomotive + its cut travel together along
 *      the SOURCE row, through the peine's fan branch, out past the
 *      convergence node onto the shared trunk (off-screen is fine — see
 *      railPath.ts), until the tail-most unit has cleared the node.
 *   2. REVERSAL PAUSE (phase 1): a brief stop (see
 *      motion.durations.shuntReversalPauseMin/Max) — the switch "throws".
 *   3. PUSH-IN (phase 2): the whole train reverses off the trunk into the
 *      DESTINATION branch and row, landing every unit exactly on its slot.
 *
 * Every unit keeps a FIXED rail-arc offset behind the locomotive throughout
 * each travel phase (railPath.ts's `carDSrc`/`carDDst`), so cars can never
 * overlap or bunch up — this replaces the old per-car independently-timed
 * waypoint tween (waypoints.ts's buildWaypoints/getPosAt, still used by
 * ClassificationBoard — untouched), which let cars of different path lengths
 * drift out of sync and visually overlap at the throat.
 *
 * ENTRY (first placement) — a locomotive's very FIRST `positionLocomotive`/
 * `positionLocomotiveRight` (locoTrack/rightLocoTrack going from -1 to a real
 * track) is not a 3-phase switchback at all: there is no source row, so it
 * rides a single eased leg from OFF-FRAME on its own side, in along the
 * shared trunk and the destination row's fan branch, into its slot — see
 * detectMove.ts's `detectShuntingLocoEntry` and railPath.ts's
 * `buildEntryRailPlan`. It reuses the exact same GhostLoco/railPositionAtT
 * machinery as a real move (with `f1 = f2 = 0` collapsing the 3-phase formula
 * to one continuous ramp), so no rendering code needed a special case for it.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Easing, runOnJS, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import type { ShuntingState } from '../../engine/types';
import { motion } from '../../../design/tokens';
import type { ShuntingLayout } from '../layout/shuntingLayout';
import {
  detectShuntingLocoEntry,
  detectShuntingMove,
  detectShuntingUndo,
  tracksEqual,
  type ShuntingMoveAnim,
} from './detectMove';
import { buildEntryRailPlan, buildRailPlan, type ShuntRailPlan } from './railPath';

export interface ShuntingAnimation {
  /** Non-null only while a travel animation (and its settle bounce) is in flight. */
  move: ShuntingMoveAnim | null;
  /** 0 → 1, linear in time; railPath.ts's shuntPhaseAt applies the per-phase easing. */
  progress: ReturnType<typeof useSharedValue<number>>;
  /** Rail geometry + phase timing for the in-flight move (see railPath.ts). Null iff move is null. */
  railPlan: ShuntRailPlan | null;
  /** 1 normally, briefly pulses >1 on arrival ("settle bounce" juice). */
  settle: ReturnType<typeof useSharedValue<number>>;
  /** 0 normally, briefly pulses to 1 on arrival then decays ("coupling flash" juice). */
  flash: ReturnType<typeof useSharedValue<number>>;
  /**
   * Whole-board "settle" opacity for the cheap RESTART crossfade — 1 at rest,
   * briefly dips then springs back to 1 when a full-board reset is detected
   * (see the module doc comment's RESTART section). Wrap the board's static
   * peine+rows Group in `opacity={boardFade}` to use it; no-op (stays 1) for
   * every other update, including undo. NOTE: today's controllers pass
   * `prevState={null}` across an actual restart (see
   * src/controller/shuntingController.ts `restart()`), so this branch is
   * currently inert in practice (the board just re-renders straight to the
   * reset state) — it's wired up defensively so a future controller change
   * that preserves prevState across restart gets the crossfade for free
   * instead of a hard per-car snap.
   */
  boardFade: ReturnType<typeof useSharedValue<number>>;
  /** Companion scale for the same RESTART settle — see boardFade. */
  boardScale: ReturnType<typeof useSharedValue<number>>;
}

const DURATION_TOKENS = {
  moveMinMs: motion.durations.shuntMoveMin,
  moveMaxMs: motion.durations.shuntMoveMax,
  pauseMinMs: motion.durations.shuntReversalPauseMin,
  pauseMaxMs: motion.durations.shuntReversalPauseMax,
};

export function useShuntingAnimation(
  state: ShuntingState,
  prevState: ShuntingState | null | undefined,
  layout: ShuntingLayout,
  onAnimationComplete?: () => void
): ShuntingAnimation {
  const progress = useSharedValue(0);
  const settle = useSharedValue(1);
  const flash = useSharedValue(0);
  const boardFade = useSharedValue(1);
  const boardScale = useSharedValue(1);
  const [move, setMove] = useState<ShuntingMoveAnim | null>(null);
  const [railPlan, setRailPlan] = useState<ShuntRailPlan | null>(null);
  const lastKeyRef = useRef<string | null>(null);
  // Entry events (see below) have no `moves`-counter change to fold into a
  // content key, so a rare-but-legal repeat — the SAME side rolling onto the
  // SAME track a second time later in the level (e.g. the right locomotive's
  // activation deactivates the left one back to -1, and the player then
  // re-taps the left loco onto the very track it just left) — would produce
  // a content key IDENTICAL to the first entry's and be wrongly deduped
  // against it forever. Dedup entries by the `state` OBJECT REFERENCE instead:
  // `applyAndRefresh` (shuntingController.ts) always calls `setState` with a
  // freshly-built object per real engine mutation, so two genuinely different
  // commits are never the same reference, while a layout-only re-render mid
  // flight (the case the dedup exists to guard against — see the `detected`
  // key below) always keeps `state` pinned to the same reference.
  const lastEntryStateRef = useRef<ShuntingState | null>(null);
  const onCompleteRef = useRef(onAnimationComplete);
  onCompleteRef.current = onAnimationComplete;
  // Stable JS-thread trampoline: runOnJS needs a function whose identity it
  // can hand to the JS thread reliably, so we pass this (not the ref read
  // directly) and resolve the freshest callback once we're back on JS.
  const notifyComplete = useCallback(() => {
    onCompleteRef.current?.();
  }, []);

  useEffect(() => {
    // Forward move (moves = prev+1) takes priority; a single UNDO
    // (moves = prev-1) reuses the exact same ghost-travel machinery below
    // with srcTrack/dstTrack already pre-swapped by detectShuntingUndo.
    // Neither fires for a full RESTART (moves resets to 0 via history
    // clearing, not a single pop) — that falls through to the cheap
    // whole-board crossfade instead of animating every car.
    const detected = detectShuntingMove(prevState, state) ?? detectShuntingUndo(prevState, state);
    // First-placement entry (see detectMove.ts's doc comment) is only ever
    // checked when `detected` is null — a genuine move/undo always takes
    // priority, and the two can never both match the same (prevState, state)
    // pair since entry requires locoTrack going FROM -1, which a move/undo
    // never does (moveSelected*/undo always start from a track >= 0).
    const entry = detected ? null : detectShuntingLocoEntry(prevState, state);
    const finalMove = detected ?? entry;

    if (!finalMove) {
      if (
        prevState &&
        state.moves === 0 &&
        prevState.moves !== 0 &&
        !tracksEqual(prevState.tracks, state.tracks)
      ) {
        const resetKey = `reset:${state.levelNum}:${state.moves}`;
        if (lastKeyRef.current !== resetKey) {
          lastKeyRef.current = resetKey;
          boardFade.value = 0.4;
          boardScale.value = 0.97;
          boardFade.value = withTiming(1, { duration: motion.durations.moderate, easing: Easing.out(Easing.quad) });
          boardScale.value = withSpring(1, motion.springs.snappy);
        }
      }
      return;
    }
    if (entry) {
      if (lastEntryStateRef.current === state) return;
      lastEntryStateRef.current = state;
    } else {
      const key = `${state.moves}:${finalMove.side}:${finalMove.srcTrack}->${finalMove.dstTrack}:${finalMove.cars.length}`;
      if (lastKeyRef.current === key) return;
      lastKeyRef.current = key;
    }

    const plan = entry
      ? buildEntryRailPlan(layout, entry.side, entry.dstTrack, DURATION_TOKENS)
      : buildRailPlan(layout, finalMove, DURATION_TOKENS);
    if (!plan) return; // no peine on this side — shouldn't happen, but never animate into nothing.

    setMove(finalMove);
    setRailPlan(plan);
    progress.value = 0;
    settle.value = 1;
    flash.value = 0;
    progress.value = withTiming(1, { duration: plan.totalMs, easing: Easing.linear }, (finished) => {
      'worklet';
      if (!finished) return;
      flash.value = withSequence(withTiming(1, { duration: 60 }), withTiming(0, { duration: 240 }));
      settle.value = withSequence(
        withTiming(1.1, { duration: 90, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }, (settled) => {
          if (settled) {
            runOnJS(setMove)(null);
            runOnJS(setRailPlan)(null);
            runOnJS(notifyComplete)();
          }
        })
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, prevState, layout]);

  return { move, progress, railPlan, settle, flash, boardFade, boardScale };
}
