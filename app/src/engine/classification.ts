/**
 * Patio de Clasificación — pure classification engine.
 *
 * Faithful port of ref/js/classification/state.js (ClassificationState +
 * scoring functions), stripped of animation/DOM/localStorage/Firebase.
 *
 * Rule: only the HEAD (index 0) car of the selected arrival track may be
 * pushed ("regla del lomo") into a classification track with free capacity.
 */

import type { ClassificationLevel } from '../data/levelTypes';
import { parseClassificationCar } from '../data/levelTypes';
import type {
  ClassificationHistoryEntry,
  ClassificationScoreResult,
  ClassificationState,
} from './types';

const MAX_HISTORY = 40;

function cloneRows(rows: string[][]): string[][] {
  return rows.map((v) => [...v]);
}

// ─────────────────────── SCORING (pure functions) ───────────────────────

/** Number of color changes between consecutive cars within a single classification track. */
export function saltosDeVia(via: string[]): number {
  let s = 0;
  for (let i = 1; i < via.length; i++) {
    if (parseClassificationCar(via[i]).color !== parseClassificationCar(via[i - 1]).color) s++;
  }
  return s;
}

/**
 * puntos = cars*10 − saltos*15 + pureBonus (clamped to >= 0).
 * pureBonus = +30 per non-empty single-color (0-saltos) classification track.
 */
export function calcularPuntaje(vias: string[][]): ClassificationScoreResult {
  let saltos = 0;
  let purasBonus = 0;
  let carros = 0;
  for (const v of vias) {
    carros += v.length;
    const s = saltosDeVia(v);
    saltos += s;
    if (v.length > 0 && s === 0) purasBonus += 30;
  }
  const puntos = carros * 10 - saltos * 15 + purasBonus;
  return { puntos: Math.max(0, puntos), saltos, purasBonus, carros };
}

/** Theoretical max score for a level (0 avoidable color changes, all tracks pure). */
export function puntajeMaximo(nivel: ClassificationLevel): number {
  const flat = nivel.arrivals.flat();
  const total = flat.length;
  const coloresUsados = new Set(flat.map((c) => parseClassificationCar(c).color)).size;
  const viasPuras = Math.min(nivel.capacities.length, coloresUsados);
  // If there are more colors than tracks, at least (colores − vias) breaks are unavoidable.
  const saltosMin = Math.max(0, coloresUsados - nivel.capacities.length);
  const puras = saltosMin > 0 ? nivel.capacities.length - 1 : viasPuras;
  return total * 10 - saltosMin * 15 + puras * 30;
}

/** Stars by proportion of the theoretical max: >=90% -> 3, >=70% -> 2, else 1. */
export function starsForScore(pts: number, max: number): 1 | 2 | 3 {
  if (!max) return 1;
  const r = pts / max;
  return r >= 0.9 ? 3 : r >= 0.7 ? 2 : 1;
}

// ──────────────────────────── ENGINE ────────────────────────────────────

export function createClassificationState(level: ClassificationLevel): ClassificationState {
  return {
    status: 'PLAYING',
    levelNum: level.id,
    arrivals: level.arrivals.map((v) => [...v]),
    clasif: level.capacities.map(() => []),
    capacities: [...level.capacities],
    viaSel: 0,
    moves: 0,
    finished: false,
    lastResult: null,
    message: '',
  };
}

export class ClassificationEngine {
  state: ClassificationState;
  private level: ClassificationLevel;
  private history: ClassificationHistoryEntry[] = [];

  constructor(level: ClassificationLevel) {
    this.level = level;
    this.state = createClassificationState(level);
  }

  /** Deep snapshot of the current state, safe to hand to a renderer/UI. */
  getState(): ClassificationState {
    return {
      ...this.state,
      arrivals: cloneRows(this.state.arrivals),
      clasif: cloneRows(this.state.clasif),
      capacities: [...this.state.capacities],
      lastResult: this.state.lastResult ? { ...this.state.lastResult } : null,
    };
  }

  restart(): void {
    this.state = createClassificationState(this.level);
    this.history = [];
  }

  /** Total cars still sitting in arrival tracks. */
  get remaining(): number {
    return this.state.arrivals.reduce((a, v) => a + v.length, 0);
  }

  /** Score if the game ended right now (partial progress). */
  parcial(): ClassificationScoreResult {
    return calcularPuntaje(this.state.clasif);
  }

  private pushHistory(): void {
    this.history.push({
      arrivals: cloneRows(this.state.arrivals),
      clasif: cloneRows(this.state.clasif),
      viaSel: this.state.viaSel,
      moves: this.state.moves,
    });
    if (this.history.length > MAX_HISTORY) this.history.shift();
  }

  selectArrival(i: number): void {
    if (this.state.finished) return;
    if (i >= 0 && i < this.state.arrivals.length && this.state.arrivals[i].length > 0) {
      this.state.viaSel = i;
    }
  }

  /** Push the head car of the selected arrival track onto classification track `destino`. */
  empujar(destino: number): void {
    if (this.state.finished || this.state.status !== 'PLAYING') return;
    const via = this.state.arrivals[this.state.viaSel];
    if (!via || via.length === 0) return;
    if (this.state.clasif[destino].length >= this.state.capacities[destino]) {
      this.state.message = '¡Vía llena! Elige otra vía de clasificación.';
      return;
    }

    this.pushHistory();
    const carro = via.shift()!;
    this.state.clasif[destino].push(carro);
    this.state.moves++;

    // If the selected arrival emptied, jump to another one with cars left.
    if (via.length === 0) {
      const otra = this.state.arrivals.findIndex((v) => v.length > 0);
      if (otra >= 0) this.state.viaSel = otra;
    }
    if (this.remaining === 0) this.finish();
  }

  undo(): void {
    if (this.history.length === 0 || this.state.finished) return;
    const prev = this.history.pop()!;
    this.state.arrivals = prev.arrivals;
    this.state.clasif = prev.clasif;
    this.state.viaSel = prev.viaSel;
    this.state.moves = prev.moves;
    this.state.message = 'Movimiento deshecho';
  }

  private finish(): void {
    this.state.finished = true;
    this.state.status = 'SUMMARY';
    this.state.lastResult = calcularPuntaje(this.state.clasif);
  }
}
