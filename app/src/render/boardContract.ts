/**
 * Integration contract between the Skia renderer (src/render) and the RN UI
 * controller (src/screens / src/components). Owned by the orchestrator.
 *
 * Separation of concerns (faithful to the original ref/ split):
 *  - The renderer draws a read-only view of engine state and performs
 *    hit-testing. It emits LOW-LEVEL SEMANTIC taps: "the left loco button of
 *    track 2 was tapped", "wagon (track 2, col 1) was tapped", etc.
 *  - The UI controller ports ref/js/shunting/input.js + ref/js/classification/input.js
 *    interaction routing ("smart tap": if cars are selected and a different
 *    track is tapped, that's a move; otherwise (re)select) and calls the
 *    corresponding engine methods. The renderer never mutates game state.
 *
 * Animation: the board may receive the previous state to tween from, but the
 * engine already applied the move synchronously — animation is purely visual.
 */

import type { ClassificationState, ShuntingState } from '../engine/types';

export type LocoSide = 'left' | 'right';

/** Semantic tap events emitted by the shunting board. */
export interface ShuntingBoardEvents {
  /** A locomotive button on the left/right throat of `trackIdx` was tapped. */
  onLocoButtonTap: (side: LocoSide, trackIdx: number) => void;
  /** A wagon at (trackIdx, carIdx) was tapped. */
  onWagonTap: (trackIdx: number, carIdx: number) => void;
  /** The body/row of a track was tapped (used by smart-tap deposit routing). */
  onTrackRowTap: (trackIdx: number) => void;
}

export interface ShuntingBoardProps extends ShuntingBoardEvents {
  state: ShuntingState;
  /** Optional previous state to animate the transition from (visual only). */
  prevState?: ShuntingState | null;
  /** Available canvas size in dp. */
  width: number;
  height: number;
  /**
   * Fired once a move's travel animation (and its settle) fully completes.
   * The UI uses this to defer win/summary presentation until AFTER the wagons
   * visibly arrive — never show the outcome before/at move start.
   */
  onAnimationComplete?: () => void;
  /**
   * When true the board plays its victory celebration (confetti). The UI flips
   * this on only after `onAnimationComplete` for the winning move, so the
   * confetti and the win card appear together, once the animation has landed.
   */
  showCelebration?: boolean;
}

/** Semantic tap events emitted by the classification board. */
export interface ClassificationBoardEvents {
  /** An arrival track row was tapped (select it). */
  onArrivalTap: (arrivalIdx: number) => void;
  /** A classification track row was tapped (push the selected arrival's head). */
  onClassificationTap: (classifIdx: number) => void;
}

export interface ClassificationBoardProps extends ClassificationBoardEvents {
  state: ClassificationState;
  prevState?: ClassificationState | null;
  width: number;
  height: number;
  /** Fired once a push animation fully completes — see ShuntingBoardProps. */
  onAnimationComplete?: () => void;
  /** When true the board plays its summary celebration (confetti). */
  showCelebration?: boolean;
}
