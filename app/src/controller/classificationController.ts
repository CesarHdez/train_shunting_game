/**
 * src/controller/classificationController.ts
 *
 * Owns a ClassificationEngine instance for one level, mirrors its state
 * into React, and ports the routing from ref/js/classification/input.js:
 * tap an arrival row -> selectArrival(i); tap a classification row ->
 * empujar(i) (push the selected arrival's HEAD car — "regla del lomo").
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClassificationEngine, calcularPuntaje, puntajeMaximo, starsForScore } from '../engine/classification';
import type { ClassificationState } from '../engine/types';
import { getClassificationLevel } from '../data/levels';
import type { ClassificationBoardEvents } from '../render/boardContract';
import { getBackendApi, globalDocId, type ScoreEntry } from './backendApi';
import { fireHaptic, type HapticToken } from './haptics';
import { SoundManager } from '../audio/sounds';
import { createFeedbackQueue } from './feedbackQueue';
import { canReopenSummary, isSummaryVisible } from './summaryGate';
import { motion } from '../../design/tokens';
import type { PointsDelta } from '../components/hud/PointsDeltaBadge';
import {
  isClfTutorialDone,
  isClfTutorialStepSatisfied,
  markClfTutorialDone,
  type ClassificationTapEvent,
  type ClfTutorialStep,
} from './tutorial';

/**
 * Worst-case wall-clock time from a push's move-commit to the board's
 * `onAnimationComplete` firing: the fixed travel duration
 * (`motion.durations.carMoveBase` — classification pushes don't distance-
 * scale like shunting's switchback) + the fixed settle-bounce sequence in
 * useClassificationAnimation.ts (90ms overshoot + 180ms decay = 270ms).
 * Padded by `JS_THREAD_SLACK_MS` so this safety net can practically never
 * win the race against a genuine animation-complete — see
 * shuntingController.ts's identical derivation/rationale.
 */
const CLF_SETTLE_MS = 270;
const CLF_ANIMATION_WORST_CASE_MS = motion.durations.carMoveBase + CLF_SETTLE_MS;
const JS_THREAD_SLACK_MS = 300;
/** Shared by the per-push coupling-feedback queue AND the finish-reveal safety net below. */
const ANIMATION_SAFETY_NET_MS = CLF_ANIMATION_WORST_CASE_MS + JS_THREAD_SLACK_MS;

export interface ClassificationScoreResultUI {
  score: number;
  max: number;
  stars: 1 | 2 | 3;
  isNewRecord: boolean;
  rank: number;
}

export interface UseClassificationControllerResult {
  state: ClassificationState;
  prevState: ClassificationState | null;
  elapsedSeconds: number;
  toastMessage: string | null;
  canUndo: boolean;
  /** -1 when the tutorial isn't showing (already completed, or not level 1). */
  tutorialStep: ClfTutorialStep;
  boardEvents: ClassificationBoardEvents;
  restart: () => void;
  undo: () => void;
  tutorialAdvanceModal: () => void;
  tutorialSkip: () => void;
  scoreResult: ClassificationScoreResultUI | null;
  localLeaderboard: ScoreEntry[];
  globalLeaderboard: ScoreEntry[];
  /** Live color-change count in `state.clasif` — why PUNTOS can drop (each salto is −15). */
  saltos: number;
  /** This-push change in live `puntos` (after − before), or null before the first push. */
  lastPointsDelta: PointsDelta | null;
  /**
   * True once the winning push's board animation has landed AND the player
   * hasn't dismissed the summary card yet. Drives both
   * `WinSummaryCard.visible` and `ClassificationBoard.showCelebration`
   * (dismissing stops the confetti too) — never flip these on `state.status`
   * alone, or the card/confetti pop in at move START instead of when the
   * wagon visibly arrives. See summaryGate.ts.
   */
  summaryVisible: boolean;
  /** True once the level is finished but the card is currently hidden —
   *  drives a small "RESULTADOS" reopen affordance in the HUD. */
  canReopenSummary: boolean;
  /** Closes the summary card (✕ button, tap-outside, or Android back) without
   *  losing any result state — the level stays finished and the board keeps
   *  its final state. Never re-fires a sound/haptic or resubmits the score. */
  dismissSummary: () => void;
  /** Brings the summary card back after it was dismissed, for the same finish. */
  reopenSummary: () => void;
  /** Pass to `ClassificationBoard.onAnimationComplete`. */
  onBoardAnimationComplete: () => void;
  /** True once the finish-finalize leaderboard fetch has settled AND the
   *  backend's best-effort connectivity signal reads 'offline' — see
   *  backendApi.getConnectivity(). Drives WinSummaryCard's "sin conexión" note. */
  offline: boolean;
}

export function useClassificationController(
  levelId: number,
  playerName: string
): UseClassificationControllerResult {
  const level = useMemo(() => getClassificationLevel(levelId), [levelId]);

  const engine = useMemo(() => {
    if (!level) throw new Error(`Unknown classification level ${levelId}`);
    return new ClassificationEngine(level);
  }, [level, levelId]);

  const [state, setState] = useState<ClassificationState>(() => engine.getState());
  const [prevState, setPrevState] = useState<ClassificationState | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [tutorialStep, setTutorialStep] = useState<ClfTutorialStep>(-1);
  const [scoreResult, setScoreResult] = useState<ClassificationScoreResultUI | null>(null);
  const [localLeaderboard, setLocalLeaderboard] = useState<ScoreEntry[]>([]);
  const [globalLeaderboard, setGlobalLeaderboard] = useState<ScoreEntry[]>([]);
  const [offline, setOffline] = useState(false);
  // Reveal gate. Stays false while status flips to SUMMARY at move-start;
  // only flips true once the board reports the winning push's animation has
  // actually landed (or the fallback fires). `summaryVisible`/
  // `canReopenSummary` below (see summaryGate.ts) are what actually drive
  // WinSummaryCard/board confetti — never this alone.
  const [celebrate, setCelebrate] = useState(false);
  // True once the player has explicitly closed the summary card (✕, tap
  // outside, or Android back) for the CURRENT finish. Reset alongside
  // `celebrate` on level change/restart so a fresh finish always shows the
  // card again — see the two effects below.
  const [summaryDismissed, setSummaryDismissed] = useState(false);
  // Transient this-push score delta for the floating "+N"/"−N" HUD badge —
  // see PointsDeltaBadge. `nonce` lets the UI re-trigger the fade even when
  // the same delta value repeats on consecutive pushes.
  const [lastPointsDelta, setLastPointsDelta] = useState<PointsDelta | null>(null);
  const deltaNonceRef = useRef(0);

  const startTimeRef = useRef(Date.now());
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishHandledRef = useRef(false);
  // Guards the one-time win sound/haptic + the one-time star sound/haptic —
  // see the two effects below (mirrors shuntingController.ts).
  const winFeedbackFiredRef = useRef(false);
  const starFeedbackFiredRef = useRef(false);

  // FIFO queue for "coupling" feedback (the 'push' sound + medium/warning
  // haptic, and undo's light haptic) — see feedbackQueue.ts's doc comment
  // and shuntingController.ts's identical usage.
  const feedbackQueueRef = useRef<ReturnType<typeof createFeedbackQueue> | null>(null);
  if (!feedbackQueueRef.current) feedbackQueueRef.current = createFeedbackQueue(ANIMATION_SAFETY_NET_MS);
  const feedbackQueue = feedbackQueueRef.current;

  // Cancel any in-flight timers on unmount so a stale sound/haptic can never
  // fire after the screen is gone.
  useEffect(() => () => feedbackQueue.clear(), [feedbackQueue]);

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
    setLastPointsDelta(null);
    startTimeRef.current = Date.now();
    finishHandledRef.current = false;
    winFeedbackFiredRef.current = false;
    starFeedbackFiredRef.current = false;
    feedbackQueue.clear();

    if (levelId === 1) {
      let cancelled = false;
      isClfTutorialDone().then((done) => {
        if (!cancelled) setTutorialStep(done ? -1 : 0);
      });
      return () => {
        cancelled = true;
      };
    } else {
      setTutorialStep(-1);
    }
  }, [engine, levelId]);

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

  const applyAndRefresh = useCallback(
    (kind: 'select' | 'push', mutate: () => void) => {
      const before = engine.getState();
      mutate();
      const after = engine.getState();
      setPrevState(before);
      setState(after);

      if (after.message && after.message !== before.message) {
        showToast(after.message);
        if (after.message !== 'Movimiento deshecho') {
          void fireHaptic('error');
          SoundManager.play('reject');
        }
        return;
      }
      if (kind === 'push' && after.moves > before.moves) {
        const beforeScore = calcularPuntaje(before.clasif);
        const afterScore = calcularPuntaje(after.clasif);
        // Score readout updates immediately (unchanged) — only the SOUND/
        // HAPTIC are coupling feedback, deferred until the wagon visibly
        // arrives (onBoardAnimationComplete flushes the queue below), never
        // played at move-commit ("push START").
        const haptic: HapticToken = afterScore.saltos > beforeScore.saltos ? 'warning' : 'medium';
        feedbackQueue.queue(() => {
          void fireHaptic(haptic);
          SoundManager.play('push');
        });
        deltaNonceRef.current += 1;
        setLastPointsDelta({ value: afterScore.puntos - beforeScore.puntos, nonce: deltaNonceRef.current });
      } else if (kind === 'select') {
        void fireHaptic('selection');
        SoundManager.play('select');
      }
    },
    [engine, showToast, feedbackQueue]
  );

  // Finish finalize: compute score/stars, persist, fetch leaderboards. Score
  // computation/backend submission still start immediately at move-commit —
  // only the WIN SOUND/HAPTIC/celebration reveal are deferred, via the two
  // effects below, until `celebrate` flips true (the winning push's
  // animation has landed).
  useEffect(() => {
    if (state.status !== 'SUMMARY' || finishHandledRef.current || !level || !state.lastResult) return;
    finishHandledRef.current = true;

    const score = state.lastResult.puntos;
    const max = puntajeMaximo(level);
    const stars = starsForScore(score, max);
    const backend = getBackendApi();

    backend
      .addScore('classification', levelId, {
        name: playerName || 'Anon',
        moves: Math.max(state.moves, 1),
        time: elapsedSeconds,
        score,
        stars,
      })
      .then((result) => {
        setScoreResult({ score, max, stars, isNewRecord: result.isNewRecord, rank: result.rank });
        setLocalLeaderboard(backend.getLocalLeaderboard('classification', levelId));
        return backend.fetchGlobalLeaderboard(globalDocId('classification', levelId), 10);
      })
      .then((entries) => {
        setGlobalLeaderboard(entries);
        setOffline(backend.getConnectivity() === 'offline');
      })
      .catch(() => {
        setOffline(backend.getConnectivity() === 'offline');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, levelId, level, playerName]);

  // Win sound/haptic: fires exactly once, only once `celebrate` flips true —
  // i.e. once the winning push's animation has landed (or the safety net
  // below fires) — never at move-commit.
  useEffect(() => {
    if (!celebrate || winFeedbackFiredRef.current) return;
    winFeedbackFiredRef.current = true;
    void fireHaptic('success');
    SoundManager.play('win');
  }, [celebrate]);

  // Star sound/haptic (new record): needs BOTH the reveal gate (`celebrate`)
  // AND the backend's new-record verdict (`scoreResult`), whichever settles
  // last — see shuntingController.ts's identical effect.
  useEffect(() => {
    if (!celebrate || !scoreResult?.isNewRecord || starFeedbackFiredRef.current) return;
    starFeedbackFiredRef.current = true;
    const id = setTimeout(() => {
      void fireHaptic('success');
      SoundManager.play('star');
    }, 150);
    return () => clearTimeout(id);
  }, [celebrate, scoreResult]);

  // Reveal gate: the board calls this once a push's travel+settle animation
  // has fully landed. Flushes the oldest queued coupling feedback (the
  // 'push' sound/haptic for whatever push just visibly arrived) and, for the
  // finishing push specifically, flips `celebrate`.
  const onBoardAnimationComplete = useCallback(() => {
    feedbackQueue.flushOldest();
    if (state.status === 'SUMMARY') setCelebrate(true);
  }, [state.status, feedbackQueue]);

  // Safety net: if a SUMMARY state is reached with no animatable move (or
  // the board hasn't wired `onAnimationComplete` yet), don't strand the
  // player without a summary card — reveal after a tick that comfortably
  // outlasts the longest real travel+settle animation. Shares
  // ANIMATION_SAFETY_NET_MS with the per-push coupling-feedback queue above.
  useEffect(() => {
    if (state.status !== 'SUMMARY') return;
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
    setLastPointsDelta(null);
    startTimeRef.current = Date.now();
    finishHandledRef.current = false;
    winFeedbackFiredRef.current = false;
    starFeedbackFiredRef.current = false;
    // Drop any coupling/undo feedback still pending from before the restart —
    // it must never play against the freshly-reset board.
    feedbackQueue.clear();
  }, [engine, feedbackQueue]);

  // Closes the card without touching finish state, sound, or the leaderboard
  // fetch — those are all owned by the effects above, keyed off `celebrate`/
  // `scoreResult`, and are unaffected by this flag. A late-arriving
  // `scoreResult` after dismissal must NOT reopen the card (summaryVisible
  // only depends on `celebrate`/`summaryDismissed`, never on scoreResult).
  const dismissSummary = useCallback(() => setSummaryDismissed(true), []);
  const reopenSummary = useCallback(() => setSummaryDismissed(false), []);

  const undo = useCallback(() => {
    if (state.moves <= 0 || state.finished) return;
    applyAndRefresh('select', () => engine.undo());
    // Undo is animated too (the board reverses the push back to the
    // arrival), so its feedback follows the same coupling rule as a forward
    // push — deferred to the same queue rather than fired at undo-commit.
    feedbackQueue.queue(() => void fireHaptic('light'));
  }, [applyAndRefresh, engine, feedbackQueue, state.finished, state.moves]);

  const tutorialAdvanceModal = useCallback(() => {
    // 3 blocking modals (steps 0/1/2) — advancing past the last one lands on
    // step 3, the first gated hint. Further advancement is driven by
    // `handleTutorialTap` below, exactly like the shunting tutorial.
    setTutorialStep((s) => Math.min(s + 1, 3) as ClfTutorialStep);
  }, []);

  const tutorialSkip = useCallback(() => {
    setTutorialStep(-1);
    void markClfTutorialDone();
  }, []);

  const handleTutorialTap = useCallback(
    (event: ClassificationTapEvent) => {
      if (tutorialStep <= 2) return; // modal steps block all board input
      if (!isClfTutorialStepSatisfied(tutorialStep, engine.state, event)) return; // silently swallow, matches ref-style gating

      applyAndRefresh('push', () => engine.empujar(event.track));

      if (tutorialStep === 4) {
        setTutorialStep(-1);
        void markClfTutorialDone();
      } else {
        setTutorialStep((tutorialStep + 1) as ClfTutorialStep);
      }
    },
    [applyAndRefresh, engine, tutorialStep]
  );

  const onArrivalTap = useCallback(
    (i: number) => {
      if (tutorialStep >= 0) return handleTutorialTap({ kind: 'arrival', track: i });
      applyAndRefresh('select', () => engine.selectArrival(i));
    },
    [applyAndRefresh, engine, handleTutorialTap, tutorialStep]
  );

  const onClassificationTap = useCallback(
    (i: number) => {
      if (tutorialStep >= 0) return handleTutorialTap({ kind: 'classification', track: i });
      applyAndRefresh('push', () => engine.empujar(i));
    },
    [applyAndRefresh, engine, handleTutorialTap, tutorialStep]
  );

  const boardEvents = useMemo<ClassificationBoardEvents>(
    () => ({ onArrivalTap, onClassificationTap }),
    [onArrivalTap, onClassificationTap]
  );

  // Live salto count — explains *why* PUNTOS can drop (each salto is −15).
  const saltos = useMemo(() => calcularPuntaje(state.clasif).saltos, [state.clasif]);

  return {
    state,
    prevState,
    elapsedSeconds,
    toastMessage,
    canUndo: state.moves > 0 && !state.finished,
    tutorialStep,
    boardEvents,
    restart,
    tutorialAdvanceModal,
    tutorialSkip,
    undo,
    scoreResult,
    localLeaderboard,
    globalLeaderboard,
    saltos,
    lastPointsDelta,
    summaryVisible: isSummaryVisible(celebrate, summaryDismissed),
    canReopenSummary: canReopenSummary(celebrate, summaryDismissed),
    dismissSummary,
    reopenSummary,
    onBoardAnimationComplete,
    offline,
  };
}
