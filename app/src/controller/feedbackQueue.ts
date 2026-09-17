/**
 * src/controller/feedbackQueue.ts
 *
 * A small FIFO queue for deferring "coupling" feedback (sound + haptic)
 * until a board's travel animation actually lands, instead of firing at
 * move commit. Used by shuntingController.ts / classificationController.ts
 * to fix the "sound plays at move START, not move END" bug — see those
 * files' `applyAndRefresh`/`undo` for the call sites.
 *
 * Why a queue instead of a single pending slot: the engine commits moves
 * synchronously, but the board's Reanimated travel animation for a move can
 * be superseded by a second move landing before the first one's animation
 * finishes (a fast tapper, or an undo right after a move). When that
 * happens the FIRST move's `onAnimationComplete` never fires — Reanimated's
 * `withTiming` completion callback runs with `finished: false` for a
 * canceled tween (see useShuntingAnimation.ts/useClassificationAnimation.ts)
 * — so relying on animation-complete alone would silently drop that move's
 * feedback. Each queued item therefore carries its OWN safety-net timer that
 * flushes it on its own schedule if no animation-complete arrives in time,
 * guaranteeing "exactly once, eventually" per queued item no matter how many
 * animations get superseded in between.
 *
 * `flushOldest()` (driven by the board's `onAnimationComplete`) always pops
 * the front of the queue — not necessarily the move that just finished
 * animating, since animation-complete doesn't carry a move id. That's fine:
 * these are ambient feedback cues (a sound + a buzz), not move-specific
 * state, so FIFO ordering matches 1:1 with real completions whenever moves
 * aren't overlapping (true ~100% of the time in practice — a full travel
 * animation takes ~1-2s, far slower than anyone can tap through) and
 * degrades gracefully (still exactly-once, just possibly reordered) when
 * they do.
 */

export interface FeedbackQueue {
  /**
   * Enqueues `play` to fire on the next `flushOldest()` call, or — failing
   * that within `safetyNetMs` — on its own timer instead. Never fires
   * synchronously.
   */
  queue: (play: () => void) => void;
  /** Pops and plays the oldest pending item, if any. Call from the board's `onAnimationComplete`. */
  flushOldest: () => void;
  /** Drops all pending items WITHOUT playing them and cancels their timers. Call on restart/unmount. */
  clear: () => void;
  /** Number of items currently pending. Exposed for tests. */
  size: () => number;
}

interface PendingItem {
  id: number;
  play: () => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

/**
 * @param safetyNetMs How long to wait for `flushOldest()` before a queued
 *   item plays itself anyway. Should comfortably exceed the slowest real
 *   travel+settle animation it's backing (see the callers for the derivation
 *   from design/tokens.ts's motion durations) so it practically never wins
 *   the race against a genuine `onAnimationComplete`.
 */
export function createFeedbackQueue(safetyNetMs: number): FeedbackQueue {
  let items: PendingItem[] = [];
  let nextId = 0;

  function removeById(id: number): PendingItem | null {
    const idx = items.findIndex((it) => it.id === id);
    if (idx === -1) return null;
    const [item] = items.splice(idx, 1);
    return item;
  }

  function queue(play: () => void): void {
    const id = ++nextId;
    const timeoutId = setTimeout(() => {
      const item = removeById(id);
      item?.play();
    }, safetyNetMs);
    items.push({ id, play, timeoutId });
  }

  function flushOldest(): void {
    const item = items.shift();
    if (!item) return;
    clearTimeout(item.timeoutId);
    item.play();
  }

  function clear(): void {
    const pending = items;
    items = [];
    pending.forEach((it) => clearTimeout(it.timeoutId));
  }

  function size(): number {
    return items.length;
  }

  return { queue, flushOldest, clear, size };
}
