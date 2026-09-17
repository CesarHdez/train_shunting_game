/**
 * Canonical level-input types shared by the engine and the level loader.
 * Owned by the orchestrator as the integration contract between
 * game-logic-engineer (src/engine) and level-data-migrator (src/data).
 *
 * These mirror the reference web app's level JSON schemas exactly
 * (see ref/levels/** and ref/CLAUDE.md). Do NOT change the field
 * semantics — only the storage/loading mechanism differs on mobile.
 */

/** A shunting wagon is a single uppercase letter; "" means an empty track slot. */
export type ShuntingCar = string;

/**
 * Shunting level ("Patio de Maniobras").
 * `tracks` is a 2D array: one inner array per track, each padded with ""
 * to length === `capacity`. `targetSequence` may be a subset of the wagons
 * present (extras are distractors that must NOT end on the winning track).
 */
export interface ShuntingLevel {
  id: number;
  tracks: ShuntingCar[][];
  targetSequence: string[];
  description: string;
  capacity: number;
  /** Optimal move count from the IDA* solver; null when the solver timed out. */
  minMoves?: number | null;
  /** When true, a second locomotive works from the right (tail) end. */
  rightLoco?: boolean;
  /** Max wagons movable per maneuver. Absent = Infinity. */
  locoLimit?: number;
}

/** A classification car is "TIPO-color" (e.g. "F-rojo"); only color is scored. */
export type ClassificationCar = string;

/**
 * Classification level ("Patio de Clasificación").
 * `arrivals` is one array per arrival track; index 0 is the head (only pushable
 * car). `capacities` has one entry per classification track (its sum must be
 * >= total car count so every car can be placed).
 */
export interface ClassificationLevel {
  id: number;
  name: string;
  description: string;
  arrivals: ClassificationCar[][];
  capacities: number[];
}

/** Destination colors (color === destination in classification scoring). */
export type DestinationColor = 'rojo' | 'azul' | 'verde' | 'ambar' | 'violeta';

/** Classification car types (cosmetic only — do not affect scoring). */
export type CarType = 'F' | 'T' | 'V' | 'J' | 'C';

/** Parse a "TIPO-color" string into its parts. */
export function parseClassificationCar(car: ClassificationCar): {
  tipo: CarType;
  color: DestinationColor;
} {
  const [tipo, color] = car.split('-');
  return { tipo: tipo as CarType, color: color as DestinationColor };
}
