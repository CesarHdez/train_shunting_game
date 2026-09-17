/**
 * Pure engine STATE types — serializable snapshots of the two game modes.
 *
 * These are plain data (no class instances, no Set/Map) so they can be
 * JSON-serialized, persisted, or passed across a bridge without loss.
 * They intentionally exclude anything UI/animation/network related
 * (no timers, no canvas coordinates, no localStorage/Firebase state) —
 * that all lives above the engine layer.
 *
 * Ported 1:1 in semantics from:
 *   ref/js/shunting/state.js       (GameState)
 *   ref/js/classification/state.js (ClassificationState)
 */

import type { ShuntingCar, ClassificationCar } from '../data/levelTypes';

// ─────────────────────────── SHUNTING ───────────────────────────

/** Shunting state-machine: MENU (not started) → PLAYING → WON. No lose state. */
export type ShuntingStatus = 'MENU' | 'PLAYING' | 'WON';

export interface ShuntingState {
  status: ShuntingStatus;

  levelNum: number;
  /** 2D array, one row per track, each row padded with "" to length === capacity. */
  tracks: ShuntingCar[][];
  /** Required final order of cars (left-to-right) on any single track to win. */
  target: string[];
  capacity: number;
  /** Optimal move count from the reference IDA* solver; null when unknown. */
  minMoves: number | null;

  /** Index of the track the LEFT locomotive is on; -1 = not placed yet. */
  locoTrack: number;
  /** Car indices (within tracks[locoTrack]) currently selected by the LEFT loco, ascending. */
  selectedCars: number[];

  hasRightLoco: boolean;
  /** Index of the track the RIGHT locomotive is on; -1 = not placed yet. */
  rightLocoTrack: number;
  /** Car indices (within tracks[rightLocoTrack]) currently selected by the RIGHT loco, ascending. */
  rightSelectedCars: number[];

  /** Max cars movable per maneuver. Infinity = unlimited (default). */
  locoLimit: number;

  moves: number;
  won: boolean;

  /** Last user-facing (Spanish) message, e.g. a rejection reason. Empty string = none. */
  message: string;
}

export interface ShuntingHistoryEntry {
  tracks: ShuntingCar[][];
  locoTrack: number;
  rightLocoTrack: number;
  moves: number;
}

// ───────────────────────── CLASSIFICATION ───────────────────────

/** Classification state-machine: MENU (not started) → PLAYING → SUMMARY. */
export type ClassificationStatus = 'MENU' | 'PLAYING' | 'SUMMARY';

/** Result of calcularPuntaje: score breakdown for a set of classification tracks. */
export interface ClassificationScoreResult {
  puntos: number;
  saltos: number;
  purasBonus: number;
  carros: number;
}

export interface ClassificationState {
  status: ClassificationStatus;

  levelNum: number;
  /** Arrival tracks; index 0 of each row is the head (only pushable car). */
  arrivals: ClassificationCar[][];
  /** Classification (destination) tracks, grown by pushing. */
  clasif: ClassificationCar[][];
  /** Max cars per classification track, one entry per track. */
  capacities: number[];

  /** Index of the currently selected arrival track. */
  viaSel: number;

  moves: number;
  finished: boolean;

  /** Score breakdown once finished; null while still playing. */
  lastResult: ClassificationScoreResult | null;

  /** Last user-facing (Spanish) message, e.g. a rejection reason. Empty string = none. */
  message: string;
}

export interface ClassificationHistoryEntry {
  arrivals: ClassificationCar[][];
  clasif: ClassificationCar[][];
  viaSel: number;
  moves: number;
}
