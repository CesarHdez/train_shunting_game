/**
 * Patio de Maniobras — pure shunting engine.
 *
 * Faithful port of ref/js/shunting/state.js (GameState), stripped of
 * animation/DOM/localStorage/Firebase. All moves apply synchronously;
 * the UI layer is responsible for animating between the "before" and
 * "after" snapshots however it likes (there is no `anim.isActive` gate
 * here — every call takes effect immediately).
 *
 * Loco-activation semantics match ref/js/shunting/state.js EXACTLY,
 * including its intentional asymmetry: activating the RIGHT loco
 * deactivates the left one (locoTrack = -1, left selection cleared),
 * but activating the LEFT loco does NOT touch the right loco's track
 * or selection. This asymmetry is load-bearing for move-cost fidelity
 * (a left placement after a right activation counts as a free "first"
 * placement again). The two locos may never occupy the same track.
 */

import type { ShuntingLevel } from '../data/levelTypes';
import type { ShuntingHistoryEntry, ShuntingState } from './types';

const MAX_HISTORY = 40;

function cloneTracks(tracks: string[][]): string[][] {
  return tracks.map((row) => [...row]);
}

/** Head-contiguous non-empty run at the start of a track row (indices 0..k-1). */
function headBlockIndices(row: string[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < row.length; i++) {
    if (row[i] !== '') out.push(i);
    else break;
  }
  return out;
}

/** All non-empty car indices in a row (used by the right loco — track is compact+padded). */
function nonEmptyIndices(row: string[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < row.length; i++) {
    if (row[i] !== '') out.push(i);
  }
  return out;
}

export function createShuntingState(level: ShuntingLevel): ShuntingState {
  return {
    status: 'PLAYING',
    levelNum: level.id,
    tracks: cloneTracks(level.tracks),
    target: [...level.targetSequence],
    capacity: level.capacity || 8,
    minMoves: level.minMoves ?? null,
    locoTrack: -1,
    selectedCars: [],
    hasRightLoco: !!level.rightLoco,
    rightLocoTrack: -1,
    rightSelectedCars: [],
    locoLimit: level.locoLimit || Infinity,
    moves: 0,
    won: false,
    message: '',
  };
}

export class ShuntingEngine {
  state: ShuntingState;
  private level: ShuntingLevel;
  private history: ShuntingHistoryEntry[] = [];

  constructor(level: ShuntingLevel) {
    this.level = level;
    this.state = createShuntingState(level);
  }

  /** Deep snapshot of the current state, safe to hand to a renderer/UI. */
  getState(): ShuntingState {
    return {
      ...this.state,
      tracks: cloneTracks(this.state.tracks),
      target: [...this.state.target],
      selectedCars: [...this.state.selectedCars],
      rightSelectedCars: [...this.state.rightSelectedCars],
    };
  }

  restart(): void {
    this.state = createShuntingState(this.level);
    this.history = [];
  }

  private pushHistory(): void {
    this.history.push({
      tracks: cloneTracks(this.state.tracks),
      locoTrack: this.state.locoTrack,
      rightLocoTrack: this.state.rightLocoTrack,
      moves: this.state.moves,
    });
    if (this.history.length > MAX_HISTORY) this.history.shift();
  }

  undo(): void {
    if (this.history.length === 0 || this.state.won) return;
    const s = this.history.pop()!;
    this.state.tracks = s.tracks;
    this.state.locoTrack = s.locoTrack;
    this.state.rightLocoTrack = s.rightLocoTrack ?? -1;
    this.state.selectedCars = [];
    this.state.rightSelectedCars = [];
    this.state.moves = s.moves;
    this.state.message = 'Movimiento deshecho';
  }

  // ── Left locomotive ─────────────────────────────────────────────

  positionLocomotive(trackIdx: number): void {
    if (this.state.won) return;
    // Block if right loco already occupies this track
    if (this.state.hasRightLoco && this.state.rightLocoTrack === trackIdx) return;

    // NOTE: matching the original, the left loco does NOT deactivate the
    // right loco or clear its selection (the asymmetry is intentional).

    const isFirst = this.state.locoTrack === -1;
    const isSame = this.state.locoTrack === trackIdx;

    if (!isFirst && !isSame) {
      this.pushHistory();
      this.state.moves++;
    }

    this.state.locoTrack = trackIdx;
    this.state.selectedCars = headBlockIndices(this.state.tracks[trackIdx]);
  }

  selectCar(trackIdx: number, carIdx: number): void {
    if (this.state.won) return;
    if (this.state.locoTrack !== trackIdx) return;
    const track = this.state.tracks[trackIdx];
    const sel = headBlockIndices(track);
    if (!sel.includes(carIdx)) return;
    this.state.selectedCars = sel.filter((i) => i <= carIdx);
  }

  moveSelected(targetTrackIdx: number): void {
    if (this.state.won) return;
    if (this.state.locoTrack === -1 || this.state.selectedCars.length === 0) return;
    if (targetTrackIdx === this.state.locoTrack) return;
    if (this.state.hasRightLoco && this.state.rightLocoTrack === targetTrackIdx) {
      this.state.message = '¡Vía ocupada por la otra locomotora!';
      return;
    }

    const srcIdx = this.state.locoTrack;
    const list = [...this.state.selectedCars].sort((a, b) => a - b);

    if (isFinite(this.state.locoLimit) && list.length > this.state.locoLimit) {
      const limit = this.state.locoLimit;
      this.state.message = `¡Límite! Máx. ${limit} vagón${limit > 1 ? 'es' : ''} por maniobra.`;
      return;
    }

    const destCars = this.state.tracks[targetTrackIdx].filter((c) => c !== '');
    if (destCars.length + list.length > this.state.capacity) {
      this.state.message = '¡Vía llena! No caben más vagones.';
      return;
    }

    this.pushHistory();

    const moving = list.map((i) => this.state.tracks[srcIdx][i]);
    for (const i of list) this.state.tracks[srcIdx][i] = '';
    this.state.tracks[srcIdx] = this.state.tracks[srcIdx].filter((c) => c !== '');
    while (this.state.tracks[srcIdx].length < this.state.capacity) this.state.tracks[srcIdx].push('');

    this.state.moves++;
    this.state.locoTrack = targetTrackIdx;
    this.state.selectedCars = [];

    this.state.tracks[targetTrackIdx] = [...moving, ...destCars];
    while (this.state.tracks[targetTrackIdx].length < this.state.capacity) {
      this.state.tracks[targetTrackIdx].push('');
    }

    this.checkWin();
  }

  // ── Right locomotive ────────────────────────────────────────────

  positionLocomotiveRight(trackIdx: number): void {
    if (this.state.won || !this.state.hasRightLoco) return;
    // Block if left loco already occupies this track
    if (this.state.locoTrack === trackIdx) return;

    // Deactivate the left loco — only one side active at a time (ref state.js:489).
    this.state.locoTrack = -1;
    this.state.selectedCars = [];

    const isFirst = this.state.rightLocoTrack === -1;
    const isSame = this.state.rightLocoTrack === trackIdx;

    if (!isFirst && !isSame) {
      this.pushHistory();
      this.state.moves++;
    }

    this.state.rightLocoTrack = trackIdx;
    this.state.rightSelectedCars = nonEmptyIndices(this.state.tracks[trackIdx]);
  }

  selectCarRight(trackIdx: number, carIdx: number): void {
    if (this.state.won || !this.state.hasRightLoco) return;
    if (this.state.rightLocoTrack !== trackIdx) return;
    const track = this.state.tracks[trackIdx];
    const cars = nonEmptyIndices(track);
    if (!cars.includes(carIdx)) return;
    this.state.rightSelectedCars = cars.filter((i) => i >= carIdx);
  }

  moveSelectedRight(targetTrackIdx: number): void {
    if (this.state.won) return;
    if (this.state.rightLocoTrack === -1 || this.state.rightSelectedCars.length === 0) return;
    if (targetTrackIdx === this.state.rightLocoTrack) return;
    if (this.state.locoTrack === targetTrackIdx) {
      this.state.message = '¡Vía ocupada por la otra locomotora!';
      return;
    }

    const srcIdx = this.state.rightLocoTrack;
    const list = [...this.state.rightSelectedCars].sort((a, b) => a - b);

    if (isFinite(this.state.locoLimit) && list.length > this.state.locoLimit) {
      const limit = this.state.locoLimit;
      this.state.message = `¡Límite! Máx. ${limit} vagón${limit > 1 ? 'es' : ''} por maniobra.`;
      return;
    }

    const destCars = this.state.tracks[targetTrackIdx].filter((c) => c !== '');
    if (destCars.length + list.length > this.state.capacity) {
      this.state.message = '¡Vía llena! No caben más vagones.';
      return;
    }

    this.pushHistory();

    const moving = list.map((i) => this.state.tracks[srcIdx][i]);
    for (const i of list) this.state.tracks[srcIdx][i] = '';
    this.state.tracks[srcIdx] = this.state.tracks[srcIdx].filter((c) => c !== '');
    while (this.state.tracks[srcIdx].length < this.state.capacity) this.state.tracks[srcIdx].push('');

    this.state.moves++;
    this.state.rightLocoTrack = targetTrackIdx;
    this.state.rightSelectedCars = [];

    // Right loco deposits at the RIGHT (tail) end.
    this.state.tracks[targetTrackIdx] = [...destCars, ...moving];
    while (this.state.tracks[targetTrackIdx].length < this.state.capacity) {
      this.state.tracks[targetTrackIdx].push('');
    }

    this.checkWin();
  }

  // ── Win detection ───────────────────────────────────────────────

  /** A track wins if its non-empty cars equal `target`, in order, with EQUAL length. No lose state. */
  checkWin(): boolean {
    for (const track of this.state.tracks) {
      const cars = track.filter((c) => c !== '');
      if (cars.length === this.state.target.length && cars.every((v, i) => v === this.state.target[i])) {
        this.state.won = true;
        this.state.status = 'WON';
        return true;
      }
    }
    return false;
  }
}
