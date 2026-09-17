/**
 * src/controller/shuntingController.ts
 *
 * Owns a ShuntingEngine instance for one level, mirrors its state into React,
 * and ports the "smart tap" interaction routing from ref/js/shunting/input.js
 * (lines ~126-174: loco-button / track-row / wagon routing) plus the level-1
 * tutorial gating from `handleTutorialClick`. Board components (src/render)
 * only ever call the semantic handlers on `boardEvents` — no game rule lives
 * outside the engine.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ShuntingEngine } from '../engine/shunting';
import type { ShuntingState } from '../engine/types';
import { computeShuntingScore, getStars } from '../engine/scoring';
import { shuntingHasNewCoupling } from '../engine/shuntingCoupling';
import { getShuntingLevel } from '../data/levels';
import type { ShuntingBoardEvents } from '../render/boardContract';
import { getBackendApi, globalDocId, type ScoreEntry } from './backendApi';
import { fireHaptic } from './haptics';
import { SoundManager } from '../audio/sounds';
import { createFeedbackQueue } from './feedbackQueue';
import { canReopenSummary, isSummaryVisible } from './summaryGate';
import { motion } from '../../design/tokens';
import {
  isRightLocoHintDone,
  isTutorialDone,
  isTutorialStepSatisfied,
  markRightLocoHintDone,
  markTutorialDone,
  type ShuntingTapEvent,
  type TutorialStep,
} from './tutorial';

export interface ShuntingScoreResult {
  score: number;
  stars: 1 | 2 | 3;
  isNewRecord: boolean;
  rank: number;
}

export interface UseShuntingControllerResult {
  state: ShuntingState;
  prevState: ShuntingState | null;
  elapsedSeconds: number;
  toastMessage: string | null;
  canUndo: boolean;
  /** -1 when the tutorial isn't showing (already completed, or not level 1). */
  tutorialStep: TutorialStep;
  /**
   * True once (per level mount) it's confirmed this level has a right loco,
   * the one-time discovery hint hasn't been dismissed before, and the
   * level-1 tutorial isn't currently occupying the screen.
   */
  showRightLocoHint: boolean;
  /** Dismisses the hint for this session AND persists it as seen. */
  dismissRightLocoHint: () => void;
  boardEvents: ShuntingBoardEvents;
  restart: () => void;
  undo: () => void;
  tutorialAdvanceModal: () => void;
  tutorialSkip: () => void;
  scoreResult: ShuntingScoreResult | null;
  localLeaderboard: ScoreEntry[];
  globalLeaderboard: ScoreEntry[];
  /**
   * True once the winning move's board animation has landed AND the player
   * hasn't dismissed the summary card yet. Drives both
   * `WinSummaryCard.visible` and `ShuntingBoard.showCelebration` (dismissing
   * stops the confetti too) — never flip these on `state.status` alone, or
   * the card/confetti pop in at move START instead of when the wagons
   * visibly arrive. See summaryGate.ts.
   */
  summaryVisible: boolean;
  /** True once the level is won but the card is currently hidden — drives a
   *  small "RESULTADOS" reopen affordance in the HUD. */
  canReopenSummary: boolean;
  /** Closes the summary card (✕ button, tap-outside, or Android back) without
   *  losing any win state — the level stays WON and the board keeps its
   *  final state. Never re-fires a sound/haptic or resubmits the score. */
  dismissSummary: () => void;
  /** Brings the summary card back after it was dismissed, for the same win. */
  reopenSummary: () => void;
  /** Pass to `ShuntingBoard.onAnimationComplete`. */
  onBoardAnimationComplete: () => void;
  /** True once the win-finalize leaderboard fetch has settled AND the
   *  backend's best-effort connectivity signal reads 'offline' — see
   *  backendApi.getConnectivity(). Drives WinSummaryCard's "sin conexión" note. */
  offline: boolean;
}

function sameSelection(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Worst-case wall-clock time from move-commit to the board's
 * `onAnimationComplete` firing: the full switchback travel (up to
 * `shuntMoveMax`) + the reversal pause (up to `shuntReversalPauseMax`) +
 * the fixed settle-bounce sequence fired in useShuntingAnimation.ts (a 90ms
 * overshoot + a 180ms decay = 270ms). Padded by `JS_THREAD_SLACK_MS` of
 * scheduling slack so this safety net can practically never win the race
 * against a genuine animation-complete — if it did, the coupling sound/win
 * card would occasionally pop in before the wagons visibly arrive, which is
 * exactly the bug this timing fix addresses. (The old flat 1400ms was tuned
 * for the pre-switchback ~1.1s animation and left up to an ~800ms window
 * where it could fire before the real thing.)
 */
const SHUNT_SETTLE_MS = 270;
const SHUNT_ANIMATION_WORST_CASE_MS =
  motion.durations.shuntMoveMax + motion.durations.shuntReversalPauseMax + SHUNT_SETTLE_MS;
const JS_THREAD_SLACK_MS = 300;
/** Shared by the per-move coupling-feedback queue AND the win-reveal safety net below. */
const ANIMATION_SAFETY_NET_MS = SHUNT_ANIMATION_WORST_CASE_MS + JS_THREAD_SLACK_MS;

interface Feedback {
  /**
   * True for feedback that responds to the cut visibly arriving (coupling) —
   * must be queued and only played once the board's travel animation lands.
   * False for feedback that responds to the tap itself (select/place/reject)
   * — plays immediately, unchanged from before this fix.
   */
  deferred: boolean;
  play: () => void;
}

function computeFeedback(
  kind: 'placeLoco' | 'selectCar' | 'move' | 'tutorial',
  before: ShuntingState,
  after: ShuntingState
): Feedback | null {
  if (after.message && after.message !== before.message) {
    if (after.message !== 'Movimiento deshecho') {
      return {
        deferred: false,
        play: () => {
          void fireHaptic('error');
          SoundManager.play('reject');
        },
      };
    }
    return null;
  }
  if (after.moves > before.moves) {
    // The move landed and cost a turn, but the coupling sound only makes
    // sense if it actually joined the locomotive/cut to standing cars —
    // arriving at an empty track must stay silent (see shuntingCoupling.ts).
    if (!shuntingHasNewCoupling(before, after)) return null;
    // Coupling: the cut only visibly arrives once the board's travel
    // animation lands, so this must be deferred to onBoardAnimationComplete
    // (or its safety net) — never played at move-commit ("move START").
    return {
      deferred: true,
      play: () => {
        void fireHaptic('medium');
        SoundManager.play('move');
      },
    };
  }
  if (kind === 'placeLoco' && (after.locoTrack !== before.locoTrack || after.rightLocoTrack !== before.rightLocoTrack)) {
    return {
      deferred: false,
      play: () => {
        void fireHaptic('light');
        SoundManager.play('place');
      },
    };
  }
  // Selection-only change (e.g. tapping another car on the active loco's
  // track to trim the cut) — moves/message/loco position are all unchanged.
  // `kind === 'selectCar'` covers callers that pass it explicitly; the
  // selection-array diff covers the smart-tap routing in onWagonTap/
  // onTrackRowTap, which always applies under kind 'move' even when the
  // resulting engine mutation was actually just a selection tweak.
  if (
    kind === 'selectCar' ||
    !sameSelection(before.selectedCars, after.selectedCars) ||
    !sameSelection(before.rightSelectedCars, after.rightSelectedCars)
  ) {
    return {
      deferred: false,
      play: () => {
        void fireHaptic('selection');
        SoundManager.play('select');
      },
    };
  }
  return null;
}

export function useShuntingController(levelId: number, playerName: string): UseShuntingControllerResult {
  const level = useMemo(() => getShuntingLevel(levelId), [levelId]);

  const makeEngine = useCallback(() => {
    if (!level) throw new Error(`Unknown shunting level ${levelId}`);
    return new ShuntingEngine(level);
  }, [level, levelId]);

  const engine = useMemo(() => makeEngine(), [makeEngine]);

  const [state, setState] = useState<ShuntingState>(() => engine.getState());
  const [prevState, setPrevState] = useState<ShuntingState | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>(-1);
  const [showRightLocoHint, setShowRightLocoHint] = useState(false);
  const [scoreResult, setScoreResult] = useState<ShuntingScoreResult | null>(null);
  const [localLeaderboard, setLocalLeaderboard] = useState<ScoreEntry[]>([]);
  const [globalLeaderboard, setGlobalLeaderboard] = useState<ScoreEntry[]>([]);
  const [offline, setOffline] = useState(false);
  // Reveal gate. Stays false while status flips to WON at move-start; only
  // flips true once the board reports the winning move's travel+settle
  // animation has actually landed (or the fallback safety-net below fires).
  // `summaryVisible`/`canReopenSummary` below (see summaryGate.ts) are what
  // actually drive WinSummaryCard/board confetti — never this alone.
  const [celebrate, setCelebrate] = useState(false);
  // True once the player has explicitly closed the summary card (✕, tap
  // outside, or Android back) for the CURRENT win. Reset alongside
  // `celebrate` on level change/restart so a fresh win always shows the card
  // again — see the two effects below.
  const [summaryDismissed, setSummaryDismissed] = useState(false);

  const startTimeRef = useRef(Date.now());
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const winHandledRef = useRef(false);
  // Guards the one-time win sound/haptic + the one-time star sound/haptic so
  // each fires exactly once, whenever `celebrate`/`scoreResult` land (see the
  // two effects below) — reset alongside the other per-level/restart state.
  const winFeedbackFiredRef = useRef(false);
  const starFeedbackFiredRef = useRef(false);
  // Guards the right-loco hint eligibility check to run at most once per
  // level mount (reset alongside the other per-level state below).
  const rightLocoHintCheckedRef = useRef(false);

  // FIFO queue for "coupling" feedback (the 'move' sound + medium haptic,
  // and undo's light haptic) — see feedbackQueue.ts's doc comment for why a
  // queue instead of one pending slot. Lazily created once per hook instance
  // so its identity is stable across renders without needing useMemo's
  // "may be recomputed" caveat.
  const feedbackQueueRef = useRef<ReturnType<typeof createFeedbackQueue> | null>(null);
  if (!feedbackQueueRef.current) feedbackQueueRef.current = createFeedbackQueue(ANIMATION_SAFETY_NET_MS);
  const feedbackQueue = feedbackQueueRef.current;

  // Cancel any in-flight timers on unmount so a stale sound/haptic can never
  // fire after the screen is gone.
  useEffect(() => () => feedbackQueue.clear(), [feedbackQueue]);

  // (Re)initialize whenever the level changes.
  useEffect(() => {
    setState(engine.getState());
    setPrevState(null);
    setElapsedSeconds(0);
    setToastMessage(null);
    setScoreResult(null);
    setLocalLeaderboard([]);
    setGlobalLeaderboard([]);
    setOffline(false);
    setCelebrate(false);
    setSummaryDismissed(false);
    startTimeRef.current = Date.now();
    winHandledRef.current = false;
    winFeedbackFiredRef.current = false;
    starFeedbackFiredRef.current = false;
    feedbackQueue.clear();
    setShowRightLocoHint(false);
    rightLocoHintCheckedRef.current = false;

    if (levelId === 1) {
      let cancelled = false;
      isTutorialDone().then((done) => {
        if (!cancelled) setTutorialStep(done ? -1 : 0);
      });
      return () => {
        cancelled = true;
      };
    } else {
      setTutorialStep(-1);
    }
  }, [engine, levelId]);

  // Right-loco discovery hint: fires (at most once per level mount) once the
  // level-1 tutorial has settled to "not active" (-1) — checked live rather
  // than gated only at mount time, so a hypothetical level combining both
  // never shows the hint on top of a tutorial modal. Levels without a right
  // loco never flip this on.
  useEffect(() => {
    if (!state.hasRightLoco) return;
    if (tutorialStep >= 0) return;
    if (rightLocoHintCheckedRef.current) return;
    rightLocoHintCheckedRef.current = true;
    let cancelled = false;
    isRightLocoHintDone().then((done) => {
      if (!cancelled && !done) setShowRightLocoHint(true);
    });
    return () => {
      cancelled = true;
    };
  }, [state.hasRightLoco, tutorialStep]);

  const dismissRightLocoHint = useCallback(() => {
    setShowRightLocoHint(false);
    void markRightLocoHintDone();
  }, []);

  // Timer — ticks once per second while PLAYING.
  useEffect(() => {
    if (state.status !== 'PLAYING') return;
    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [state.status]);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 2000);
  }, []);

  useEffect(
    () => () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    },
    []
  );

  /** Applies a mutation to the engine, then refreshes the React mirror and fires (or queues) juice. */
  const applyAndRefresh = useCallback(
    (kind: 'placeLoco' | 'selectCar' | 'move' | 'tutorial', mutate: () => void) => {
      const before = engine.getState();
      mutate();
      const after = engine.getState();
      setPrevState(before);
      setState(after);
      if (after.message && after.message !== before.message) showToast(after.message);
      const feedback = computeFeedback(kind, before, after);
      if (!feedback) return;
      if (feedback.deferred) feedbackQueue.queue(feedback.play);
      else feedback.play();
    },
    [engine, showToast, feedbackQueue]
  );

  // Win finalize: compute score/stars, persist, fetch leaderboards. Sound
  // computation/backend submission still start immediately at move-commit —
  // only the WIN SOUND/HAPTIC/celebration reveal are deferred, via the two
  // effects below, until `celebrate` flips true (the winning move's
  // animation has landed).
  useEffect(() => {
    if (state.status !== 'WON' || winHandledRef.current || !level) return;
    winHandledRef.current = true;

    const score = computeShuntingScore(state.moves, elapsedSeconds, state.minMoves, level.targetSequence.length);
    const stars = getStars(state.moves, state.minMoves, level.targetSequence.length);
    const backend = getBackendApi();

    backend
      .addScore('shunting', levelId, { name: playerName || 'Anon', moves: state.moves, time: elapsedSeconds, score, stars })
      .then((result) => {
        setScoreResult({ score, stars, isNewRecord: result.isNewRecord, rank: result.rank });
        setLocalLeaderboard(backend.getLocalLeaderboard('shunting', levelId));
        return backend.fetchGlobalLeaderboard(globalDocId('shunting', levelId), 10);
      })
      .then((entries) => {
        setGlobalLeaderboard(entries);
        setOffline(backend.getConnectivity() === 'offline');
      })
      .catch(() => {
        setOffline(backend.getConnectivity() === 'offline');
      });
    // Intentionally NOT depending on elapsedSeconds beyond this run — we want
    // the elapsed-at-win value frozen, not re-triggered every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, levelId, level, playerName]);

  // Win sound/haptic: fires exactly once, only once `celebrate` flips true —
  // i.e. once the winning move's animation has landed (or the safety net
  // below fires) — never at move-commit.
  useEffect(() => {
    if (!celebrate || winFeedbackFiredRef.current) return;
    winFeedbackFiredRef.current = true;
    void fireHaptic('success');
    SoundManager.play('win');
  }, [celebrate]);

  // Star sound/haptic (new record): needs BOTH the reveal gate (`celebrate`)
  // AND the backend's new-record verdict (`scoreResult`), whichever settles
  // last — so a slow network doesn't play the star before the wagons have
  // even arrived, and a fast network doesn't play it before the backend
  // confirms the record.
  useEffect(() => {
    if (!celebrate || !scoreResult?.isNewRecord || starFeedbackFiredRef.current) return;
    starFeedbackFiredRef.current = true;
    const id = setTimeout(() => {
      void fireHaptic('success');
      SoundManager.play('star');
    }, 150);
    return () => clearTimeout(id);
  }, [celebrate, scoreResult]);

  // Reveal gate: the board calls this once a move's travel+settle animation
  // has fully landed. Flushes the oldest queued coupling feedback (the
  // 'move' sound/haptic for whatever move just visibly arrived) and, for the
  // winning move specifically, flips `celebrate` — which is what
  // WinSummaryCard/board confetti/the win-sound effect above actually key
  // off, instead of `state.status` alone.
  const onBoardAnimationComplete = useCallback(() => {
    feedbackQueue.flushOldest();
    if (state.status === 'WON') setCelebrate(true);
  }, [state.status, feedbackQueue]);

  // Safety net: if a WON state is reached with no animatable move (or the
  // board hasn't wired `onAnimationComplete` yet), don't strand the player
  // without a summary card — reveal after a tick that comfortably outlasts
  // the longest real travel+settle animation. Shares ANIMATION_SAFETY_NET_MS
  // with the per-move coupling-feedback queue above (same derivation).
  useEffect(() => {
    if (state.status !== 'WON') return;
    const id = setTimeout(() => setCelebrate(true), ANIMATION_SAFETY_NET_MS);
    return () => clearTimeout(id);
  }, [state.status]);

  const restart = useCallback(() => {
    engine.restart();
    setState(engine.getState());
    setPrevState(null);
    setElapsedSeconds(0);
    setToastMessage(null);
    setScoreResult(null);
    setOffline(false);
    setCelebrate(false);
    setSummaryDismissed(false);
    startTimeRef.current = Date.now();
    winHandledRef.current = false;
    winFeedbackFiredRef.current = false;
    starFeedbackFiredRef.current = false;
    // Drop any coupling/undo feedback still pending from before the restart —
    // it must never play against the freshly-reset board.
    feedbackQueue.clear();
  }, [engine, feedbackQueue]);

  // Closes the card without touching win state, sound, or the leaderboard
  // fetch — those are all owned by the effects above, keyed off `celebrate`/
  // `scoreResult`, and are unaffected by this flag. A late-arriving
  // `scoreResult` after dismissal must NOT reopen the card (summaryVisible
  // only depends on `celebrate`/`summaryDismissed`, never on scoreResult).
  const dismissSummary = useCallback(() => setSummaryDismissed(true), []);
  const reopenSummary = useCallback(() => setSummaryDismissed(false), []);

  const undo = useCallback(() => {
    if (state.moves <= 0 || state.won) return;
    applyAndRefresh('move', () => engine.undo());
    // Undo is animated too (the board reverses the cut back to its source),
    // so its feedback follows the same coupling rule as a forward move —
    // deferred to the same queue rather than fired at undo-commit.
    feedbackQueue.queue(() => void fireHaptic('light'));
  }, [applyAndRefresh, engine, feedbackQueue, state.moves, state.won]);

  const tutorialAdvanceModal = useCallback(() => {
    setTutorialStep((s) => Math.min(s + 1, 2) as TutorialStep);
  }, []);

  const tutorialSkip = useCallback(() => {
    setTutorialStep(-1);
    void markTutorialDone();
  }, []);

  const handleTutorialTap = useCallback(
    (event: ShuntingTapEvent) => {
      if (tutorialStep <= 1) return; // modal steps block all board input
      if (!isTutorialStepSatisfied(tutorialStep, engine.state, event)) return; // silently swallow, matches ref

      applyAndRefresh('tutorial', () => {
        if (tutorialStep === 2) {
          engine.positionLocomotive(event.track);
          // Ref clears the auto-selected head block after placing so step 3
          // teaches "now click car A" against an unselected car (input.js:26-38).
          engine.state.selectedCars = [];
        } else if (tutorialStep === 3) engine.selectCar(event.track, event.car!);
        else if (tutorialStep === 4) engine.moveSelected(event.track);
      });

      if (tutorialStep === 4) {
        setTutorialStep(-1);
        void markTutorialDone();
      } else {
        setTutorialStep((tutorialStep + 1) as TutorialStep);
      }
    },
    [applyAndRefresh, engine, tutorialStep]
  );

  // ── Board event routing (ref/js/shunting/input.js smart-tap logic) ──────
  const onLocoButtonTap = useCallback(
    (side: 'left' | 'right', track: number) => {
      if (tutorialStep >= 0) return handleTutorialTap({ kind: 'locoButton', side, track });
      applyAndRefresh('placeLoco', () => {
        const s = engine.state;
        if (side === 'left') {
          const hasMoveLeft = s.locoTrack !== -1 && s.selectedCars.length > 0;
          if (hasMoveLeft && track !== s.locoTrack) engine.moveSelected(track);
          else engine.positionLocomotive(track);
        } else {
          const hasMoveRight = s.hasRightLoco && s.rightLocoTrack !== -1 && s.rightSelectedCars.length > 0;
          if (hasMoveRight && track !== s.rightLocoTrack) engine.moveSelectedRight(track);
          else engine.positionLocomotiveRight(track);
        }
      });
    },
    [applyAndRefresh, engine, handleTutorialTap, tutorialStep]
  );

  const onWagonTap = useCallback(
    (track: number, car: number) => {
      if (tutorialStep >= 0) return handleTutorialTap({ kind: 'wagon', track, car });
      applyAndRefresh('move', () => {
        const s = engine.state;
        const hasMoveLeft = s.locoTrack !== -1 && s.selectedCars.length > 0;
        const hasMoveRight = s.hasRightLoco && s.rightLocoTrack !== -1 && s.rightSelectedCars.length > 0;
        // Smart-tap (matches ref/js/shunting/input.js): with a cut selected,
        // tapping ANYWHERE on a DIFFERENT track — including its body/empty
        // slots, not just the tiny loco button — deposits the cut there.
        if (hasMoveLeft && track !== s.locoTrack) {
          engine.moveSelected(track);
          return;
        }
        if (hasMoveRight && track !== s.rightLocoTrack) {
          engine.moveSelectedRight(track);
          return;
        }
        // Selection adjustment on the active loco's own track.
        if (s.locoTrack === track) {
          engine.selectCar(track, car);
          return;
        }
        if (s.rightLocoTrack === track) {
          engine.selectCarRight(track, car);
          return;
        }
        // No loco here and nothing to deposit → tapping the track body/wagons
        // places (or repositions) the left loco here, so the whole track is a
        // tap target on mobile — not just the small loco button.
        engine.positionLocomotive(track);
      });
    },
    [applyAndRefresh, engine, handleTutorialTap, tutorialStep]
  );

  const onTrackRowTap = useCallback(
    (track: number) => {
      if (tutorialStep >= 0) return handleTutorialTap({ kind: 'trackRow', track });
      applyAndRefresh('move', () => {
        const s = engine.state;
        const hasMoveLeft = s.locoTrack !== -1 && s.selectedCars.length > 0;
        const hasMoveRight = s.hasRightLoco && s.rightLocoTrack !== -1 && s.rightSelectedCars.length > 0;
        if (hasMoveLeft && track !== s.locoTrack) {
          engine.moveSelected(track);
          return;
        }
        if (hasMoveRight && track !== s.rightLocoTrack) {
          engine.moveSelectedRight(track);
        }
      });
    },
    [applyAndRefresh, engine, handleTutorialTap, tutorialStep]
  );

  const boardEvents = useMemo<ShuntingBoardEvents>(
    () => ({ onLocoButtonTap, onWagonTap, onTrackRowTap }),
    [onLocoButtonTap, onWagonTap, onTrackRowTap]
  );

  return {
    state,
    prevState,
    elapsedSeconds,
    toastMessage,
    canUndo: state.moves > 0 && !state.won,
    tutorialStep,
    showRightLocoHint,
    dismissRightLocoHint,
    boardEvents,
    restart,
    undo,
    tutorialAdvanceModal,
    tutorialSkip,
    scoreResult,
    localLeaderboard,
    globalLeaderboard,
    summaryVisible: isSummaryVisible(celebrate, summaryDismissed),
    canReopenSummary: canReopenSummary(celebrate, summaryDismissed),
    dismissSummary,
    reopenSummary,
    onBoardAnimationComplete,
    offline,
  };
}
