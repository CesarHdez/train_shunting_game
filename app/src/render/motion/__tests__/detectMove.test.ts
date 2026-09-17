/**
 * Structural diffing tests for the "pushed cars" side channel added to
 * ShuntingMoveAnim: pre-existing destination-track cars whose column shifts
 * as a side effect of the arriving cut landing (see detectMove.ts's
 * `ShuntingPushedCar` doc comment and the user-facing bug it fixes — pushed
 * cars must never be derived from a hardcoded "left prepends / right
 * appends" assumption, only from diffing the two snapshots, same as the
 * existing `cars` detection).
 */

import type { ShuntingState } from '../../../engine/types';
import { detectShuntingLocoEntry, detectShuntingMove, detectShuntingUndo } from '../detectMove';

const PAD = 8;

function row(cars: string[]): string[] {
  const r = [...cars];
  while (r.length < PAD) r.push('');
  return r;
}

function baseState(overrides: Partial<ShuntingState>): ShuntingState {
  return {
    status: 'PLAYING',
    levelNum: 1,
    tracks: [],
    target: [],
    capacity: PAD,
    minMoves: null,
    locoTrack: -1,
    selectedCars: [],
    hasRightLoco: false,
    rightLocoTrack: -1,
    rightSelectedCars: [],
    locoLimit: Infinity,
    moves: 0,
    won: false,
    message: '',
    ...overrides,
  };
}

describe('detectShuntingMove: pushedCars', () => {
  it('left-side prepend shifts pre-existing destination cars back by the arriving cut length', () => {
    const prev = baseState({
      tracks: [row(['A', 'B']), row(['S0', 'S1'])],
      locoTrack: 0,
      selectedCars: [0, 1],
      moves: 5,
    });
    const curr = baseState({
      tracks: [row([]), row(['A', 'B', 'S0', 'S1'])],
      locoTrack: 1,
      selectedCars: [],
      moves: 6,
    });

    const move = detectShuntingMove(prev, curr);
    expect(move).toBeTruthy();
    expect(move!.cars).toEqual([
      { label: 'A', srcCol: 0, dstCol: 0 },
      { label: 'B', srcCol: 1, dstCol: 1 },
    ]);
    expect(move!.pushedCars).toEqual([
      { label: 'S0', srcCol: 0, dstCol: 2 },
      { label: 'S1', srcCol: 1, dstCol: 3 },
    ]);
  });

  it('right-side append never shifts pre-existing destination cars', () => {
    const prev = baseState({
      tracks: [row(['X', 'Y']), row(['S0', 'S1'])],
      hasRightLoco: true,
      rightLocoTrack: 0,
      rightSelectedCars: [0, 1],
      moves: 5,
    });
    const curr = baseState({
      tracks: [row([]), row(['S0', 'S1', 'X', 'Y'])],
      hasRightLoco: true,
      rightLocoTrack: 1,
      rightSelectedCars: [],
      moves: 6,
    });

    const move = detectShuntingMove(prev, curr);
    expect(move).toBeTruthy();
    expect(move!.cars).toEqual([
      { label: 'X', srcCol: 0, dstCol: 2 },
      { label: 'Y', srcCol: 1, dstCol: 3 },
    ]);
    expect(move!.pushedCars).toEqual([]);
  });

  it('an activation-only move (no cars) never produces pushed cars', () => {
    const prev = baseState({ tracks: [row([]), row(['S0'])], locoTrack: 0, moves: 5 });
    const curr = baseState({ tracks: [row([]), row(['S0'])], locoTrack: 1, moves: 6 });
    const move = detectShuntingMove(prev, curr);
    expect(move).toEqual({ side: 'left', srcTrack: 0, dstTrack: 1, cars: [], pushedCars: [] });
  });
});

describe('detectShuntingLocoEntry', () => {
  it('detects the left locomotive going from -1 to a real track, even though `moves` did not change', () => {
    const prev = baseState({ tracks: [row([]), row([])], locoTrack: -1, moves: 0 });
    const curr = baseState({ tracks: [row([]), row([])], locoTrack: 1, moves: 0 });
    expect(detectShuntingMove(prev, curr)).toBeNull(); // the ordinary detector must NOT fire for this
    expect(detectShuntingLocoEntry(prev, curr)).toEqual({
      side: 'left',
      srcTrack: -1,
      dstTrack: 1,
      cars: [],
      pushedCars: [],
    });
  });

  it('detects the right locomotive going from -1 to a real track', () => {
    const prev = baseState({
      tracks: [row([]), row([])],
      hasRightLoco: true,
      rightLocoTrack: -1,
      moves: 3,
    });
    const curr = baseState({
      tracks: [row([]), row([])],
      hasRightLoco: true,
      rightLocoTrack: 0,
      moves: 3,
    });
    expect(detectShuntingLocoEntry(prev, curr)).toEqual({
      side: 'right',
      srcTrack: -1,
      dstTrack: 0,
      cars: [],
      pushedCars: [],
    });
  });

  it('does not fire when the locomotive was already active (re-selecting the same track)', () => {
    const prev = baseState({ tracks: [row([]), row([])], locoTrack: 0, moves: 0 });
    const curr = baseState({ tracks: [row([]), row([])], locoTrack: 0, moves: 0 });
    expect(detectShuntingLocoEntry(prev, curr)).toBeNull();
  });

  it('does not fire on a genuine track-to-track move (that is detectShuntingMove\'s job)', () => {
    const prev = baseState({ tracks: [row([]), row([])], locoTrack: 0, moves: 5 });
    const curr = baseState({ tracks: [row([]), row([])], locoTrack: 1, moves: 6 });
    expect(detectShuntingLocoEntry(prev, curr)).toBeNull();
  });

  it('does not fire when a locomotive deactivates (track -> -1)', () => {
    const prev = baseState({
      tracks: [row([]), row([])],
      locoTrack: 0,
      hasRightLoco: true,
      rightLocoTrack: -1,
      moves: 0,
    });
    // positionLocomotiveRight's real side effect: activating the right loco
    // unconditionally deactivates the left one.
    const curr = baseState({
      tracks: [row([]), row([])],
      locoTrack: -1,
      hasRightLoco: true,
      rightLocoTrack: 0,
      moves: 0,
    });
    const entry = detectShuntingLocoEntry(prev, curr);
    expect(entry).toEqual({ side: 'right', srcTrack: -1, dstTrack: 0, cars: [], pushedCars: [] });
  });

  it('returns null with no previous state', () => {
    const curr = baseState({ tracks: [row([])], locoTrack: 0, moves: 0 });
    expect(detectShuntingLocoEntry(null, curr)).toBeNull();
    expect(detectShuntingLocoEntry(undefined, curr)).toBeNull();
  });
});

describe('detectShuntingUndo: pushedCars', () => {
  it('restoring a left-side prepend shifts the destination track cars back to their original columns', () => {
    // "prev" here is the POST-move state being undone: track 1 already holds
    // the arrived cut (A,B) at its head, with the track's own original
    // resident (S0,S1) pushed back of it; track 0 lost them.
    const prev = baseState({
      tracks: [row([]), row(['A', 'B', 'S0', 'S1'])],
      locoTrack: 1,
      selectedCars: [],
      moves: 6,
    });
    // "curr" is the RESTORED state: A,B back on track 0, S0,S1 back at the
    // head of track 1.
    const curr = baseState({
      tracks: [row(['A', 'B']), row(['S0', 'S1'])],
      locoTrack: 0,
      selectedCars: [],
      moves: 5,
    });

    const undo = detectShuntingUndo(prev, curr);
    expect(undo).toBeTruthy();
    expect(undo!.side).toBe('left');
    expect(undo!.srcTrack).toBe(1);
    expect(undo!.dstTrack).toBe(0);
    expect(undo!.cars).toEqual([
      { label: 'A', srcCol: 0, dstCol: 0 },
      { label: 'B', srcCol: 1, dstCol: 1 },
    ]);
    // The ghost travels 1 -> 0; on track 0 (the restored track) the cars
    // that already stood there (none here) would be the "pushed" set. This
    // case has none, so the interesting assertion is on the NEXT test.
    expect(undo!.pushedCars).toEqual([]);
  });

  it('restoring a left-side prepend onto a track that itself had residents shifts them structurally', () => {
    // Track 0 (the undo's destination, i.e. where the cut originally came
    // from) had 2 cars of its own (R0,R1) still resident after the original
    // move plucked A,B off its head — those two are the ones this undo must
    // shift back out of the way as A,B return to the head of track 0.
    const prev = baseState({
      tracks: [row(['R0', 'R1']), row(['A', 'B', 'X'])],
      locoTrack: 1,
      selectedCars: [],
      moves: 6,
    });
    const curr = baseState({
      tracks: [row(['A', 'B', 'R0', 'R1']), row(['X'])],
      locoTrack: 0,
      selectedCars: [],
      moves: 5,
    });

    const undo = detectShuntingUndo(prev, curr);
    expect(undo).toBeTruthy();
    expect(undo!.cars).toEqual([
      { label: 'A', srcCol: 0, dstCol: 0 },
      { label: 'B', srcCol: 1, dstCol: 1 },
    ]);
    expect(undo!.pushedCars).toEqual([
      { label: 'R0', srcCol: 0, dstCol: 2 },
      { label: 'R1', srcCol: 1, dstCol: 3 },
    ]);
  });

  it('undoing a right-side append never shifts pre-existing destination cars', () => {
    const prev = baseState({
      tracks: [row(['R0']), row(['S0', 'S1', 'X', 'Y'])],
      hasRightLoco: true,
      rightLocoTrack: 1,
      rightSelectedCars: [],
      moves: 6,
    });
    const curr = baseState({
      tracks: [row(['R0', 'X', 'Y']), row(['S0', 'S1'])],
      hasRightLoco: true,
      rightLocoTrack: 0,
      rightSelectedCars: [],
      moves: 5,
    });

    const undo = detectShuntingUndo(prev, curr);
    expect(undo).toBeTruthy();
    expect(undo!.cars).toEqual([
      { label: 'X', srcCol: 2, dstCol: 1 },
      { label: 'Y', srcCol: 3, dstCol: 2 },
    ]);
    expect(undo!.pushedCars).toEqual([]);
  });
});
