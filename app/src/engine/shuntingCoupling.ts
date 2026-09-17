/**
 * src/engine/shuntingCoupling.ts
 *
 * Pure predicate deciding whether a shunting move that just landed formed a
 * NEW physical coupling — the only case the "coupling" sound/haptic (queued
 * in shuntingController.ts, played once the board's travel animation lands)
 * should fire for. Per the user's rule: the sound simulates cars/locomotive
 * physically joining at the END of a movement, so it must be silent when a
 * move's destination was empty (nothing to join) even though the move still
 * legitimately cost a turn.
 *
 * This is a structural diff over two `ShuntingState` snapshots — it does NOT
 * re-implement or reinterpret any move-legality/scoring/win rule from
 * `shunting.ts`. It only answers: "did whichever locomotive just changed
 * track land on cars it wasn't already coupled to?" That covers both:
 *   - A cut (`moveSelected`/`moveSelectedRight`) arriving at a destination
 *     that already had standing cars — those cars weren't connected to the
 *     arriving cut before this move, so a new coupling forms.
 *   - A bare `positionLocomotive`/`positionLocomotiveRight` repositioning
 *     (paid, i.e. not the free first placement or a same-track re-click)
 *     landing on a track that already has cars — the locomotive itself is
 *     the one newly coupling.
 *
 * Why "before.tracks[dst] had cars" is sufficient in both cases: a track can
 * only be `dst` for a paid move if it wasn't the moving locomotive's own
 * track beforehand (moving to your own track is a no-op/rejected), so
 * `before.tracks[dst]` is exactly the standing content that was NOT touched
 * by removing cars from the source track — i.e. precisely the cars the
 * arriving loco/cut is (or isn't) newly joining.
 *
 * Deliberately excluded: undo. Undo reverses a coupling (uncoupling), which
 * is not itself a coupling event, so it must never play this sound — see the
 * doc comment on `shuntingController.ts`'s `undo()` for how that's enforced
 * (undo's engine call always sets `message = 'Movimiento deshecho'`, which
 * short-circuits `computeFeedback` before this predicate is ever consulted).
 */

import type { ShuntingState } from './types';

function trackHasCars(track: string[] | undefined): boolean {
  return !!track && track.some((c) => c !== '');
}

/**
 * True if the move that turned `before` into `after` made a locomotive (left
 * or right) land on a track that already had standing cars — i.e. a new
 * coupling formed at the end of the movement. False for a move that landed
 * on an empty track (nothing to join) or that didn't move a locomotive to a
 * new track at all (e.g. a pure selection change).
 */
export function shuntingHasNewCoupling(before: ShuntingState, after: ShuntingState): boolean {
  if (after.locoTrack !== -1 && after.locoTrack !== before.locoTrack) {
    if (trackHasCars(before.tracks[after.locoTrack])) return true;
  }
  if (after.rightLocoTrack !== -1 && after.rightLocoTrack !== before.rightLocoTrack) {
    if (trackHasCars(before.tracks[after.rightLocoTrack])) return true;
  }
  return false;
}
