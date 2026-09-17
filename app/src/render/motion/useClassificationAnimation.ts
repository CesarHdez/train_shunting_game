/**
 * Drives the ghost-layer "push" travel animation for ClassificationBoard.
 *
 * This is new relative to the reference (ref/js/classification has no
 * travel animation at all — cars simply teleport). See boardContract.ts /
 * ROLE brief: adding this is the approved improvement that brings
 * Clasificación to the same motion polish as Maniobras. Architecture
 * mirrors useShuntingAnimation.ts exactly — see its doc comment, including
 * the forward/undo/restart three-way split.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Easing, runOnJS, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import type { ClassificationState } from '../../engine/types';
import { motion } from '../../../design/tokens';
import { detectClassificationMove, detectClassificationUndo, type ClassificationMoveAnim } from './detectMove';

export interface ClassificationAnimation {
  move: ClassificationMoveAnim | null;
  progress: ReturnType<typeof useSharedValue<number>>;
  settle: ReturnType<typeof useSharedValue<number>>;
  flash: ReturnType<typeof useSharedValue<number>>;
  /**
   * Whole-board RESTART crossfade — see useShuntingAnimation.ts's
   * boardFade/boardScale doc comment (same defensive rationale: today's
   * classificationController.ts `restart()` passes `prevState={null}`, so
   * this is currently inert in practice, wired up for when/if that changes).
   */
  boardFade: ReturnType<typeof useSharedValue<number>>;
  boardScale: ReturnType<typeof useSharedValue<number>>;
}

function rowsEqual(a: string[][], b: string[][]): boolean {
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

export function useClassificationAnimation(
  state: ClassificationState,
  prevState: ClassificationState | null | undefined,
  onAnimationComplete?: () => void
): ClassificationAnimation {
  const progress = useSharedValue(0);
  const settle = useSharedValue(1);
  const flash = useSharedValue(0);
  const boardFade = useSharedValue(1);
  const boardScale = useSharedValue(1);
  const [move, setMove] = useState<ClassificationMoveAnim | null>(null);
  const lastKeyRef = useRef<string | null>(null);
  const onCompleteRef = useRef(onAnimationComplete);
  onCompleteRef.current = onAnimationComplete;
  // Stable JS-thread trampoline — see useShuntingAnimation.ts for why this
  // indirection (rather than runOnJS(onAnimationComplete) directly) is used.
  const notifyComplete = useCallback(() => {
    onCompleteRef.current?.();
  }, []);

  useEffect(() => {
    // Forward push (moves = prev+1) takes priority; a single UNDO
    // (moves = prev-1) reuses the same ghost machinery with `reverse: true`
    // so the ghost travels classif→arrival instead of arrival→classif (see
    // ClassificationBoard.tsx GhostLayer). Neither fires for a full RESTART
    // (moves resets to 0 via history clearing) — that falls through to the
    // cheap whole-board crossfade instead of animating every car.
    const detected = detectClassificationMove(prevState, state) ?? detectClassificationUndo(prevState, state);
    if (!detected) {
      if (
        prevState &&
        state.moves === 0 &&
        prevState.moves !== 0 &&
        (!rowsEqual(prevState.arrivals, state.arrivals) || !rowsEqual(prevState.clasif, state.clasif))
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
    const key = `${state.moves}:${detected.reverse ? 'undo' : 'move'}:${detected.fromArrival}->${detected.toClasif}:${detected.label}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    setMove(detected);
    progress.value = 0;
    settle.value = 1;
    flash.value = 0;
    // Same base duration as the shunting cut (motion.durations.carMoveBase),
    // so both modes read at the same deliberate, unhurried pace.
    progress.value = withTiming(1, { duration: motion.durations.carMoveBase, easing: Easing.linear }, (finished) => {
      'worklet';
      if (!finished) return;
      flash.value = withSequence(withTiming(1, { duration: 60 }), withTiming(0, { duration: 240 }));
      settle.value = withSequence(
        withTiming(1.1, { duration: 90, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) }, (settled) => {
          if (settled) {
            runOnJS(setMove)(null);
            runOnJS(notifyComplete)();
          }
        })
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, prevState]);

  return { move, progress, settle, flash, boardFade, boardScale };
}
