/**
 * The real (AsyncStorage + best-effort Firestore) implementation of
 * `BackendApi`, defined as the integration contract in
 * `src/controller/backendApi.ts`. That module ships a fully-working
 * offline-only `LocalBackendApi` stub so screens aren't blocked; this file
 * is the drop-in replacement wired up via `initBackend()`:
 *
 *   import { initBackend } from './src/backend/backendApi';
 *   useEffect(() => { void initBackend(); }, []);
 *
 * `initBackend()` loads the local score cache (always available, even
 * offline) and calls `setBackendApi()` so every screen's `getBackendApi()`
 * picks up this implementation transparently. Firebase anonymous auth is
 * kicked off in parallel and never blocks local reads/writes — every
 * network path is best-effort (see firebase.ts).
 */

import type {
  BackendApi,
  ConnectivityStatus,
  GameMode,
  ScoreEntry,
  ScoreEntryInput,
  AddScoreResult,
  ProgressInfo,
} from '../controller/backendApi';
import { setBackendApi } from '../controller/backendApi';
import { ScoreManager, shuntingScores, classificationScores } from './scoreManager';
import {
  fetchGlobalLeaderboard as fbFetchLeaderboard,
  getConnectivity as fbGetConnectivity,
  waitForInit,
  type RemoteScoreEntry,
} from './firebase';
import { getStars as computeShuntingStars } from '../engine/scoring';
import { starsForScore, puntajeMaximo } from '../engine/classification';
import { getShuntingLevel, getClassificationLevel } from '../data/levels';

function managerFor(mode: GameMode): ScoreManager {
  return mode === 'shunting' ? shuntingScores : classificationScores;
}

/** Parses a Firestore doc id (`level_5`, `clf_level_5`) back into mode + levelId —
 *  the inverse of `globalDocId()` in src/controller/backendApi.ts. Same pattern as
 *  ref/firestore.rules' `(clf_)?level_[0-9]{1,3}`. */
function parseDocId(docId: string): { mode: GameMode; levelId: number } | null {
  const m = /^(clf_)?level_(\d+)$/.exec(docId);
  if (!m) return null;
  return { mode: m[1] ? 'classification' : 'shunting', levelId: Number(m[2]) };
}

/**
 * Global leaderboard entries only carry the Firestore-rules-allowed fields
 * (name, moves, time, score, date, uid) — `stars` isn't stored remotely. It's
 * derived here from the level's known difficulty (minMoves for shunting,
 * theoretical max score for classification), same formula the engine uses
 * for local entries, so a remote row renders identically to a local one.
 */
function starsFor(mode: GameMode, levelId: number, r: RemoteScoreEntry): 1 | 2 | 3 {
  if (mode === 'shunting') {
    const level = getShuntingLevel(levelId);
    const carCount = level?.targetSequence.length || 3;
    return computeShuntingStars(r.moves, level?.minMoves ?? null, carCount);
  }
  const level = getClassificationLevel(levelId);
  const max = level ? puntajeMaximo(level) : 0;
  return starsForScore(r.score ?? 0, max);
}

export class RemoteBackendApi implements BackendApi {
  async ready(): Promise<void> {
    await Promise.all([shuntingScores.init(), classificationScores.init()]);
  }

  getBest(mode: GameMode, levelId: number): ScoreEntry | null {
    return managerFor(mode).getBestSync(levelId);
  }

  getStars(mode: GameMode, levelId: number): 0 | 1 | 2 | 3 {
    return this.getBest(mode, levelId)?.stars ?? 0;
  }

  getLocalLeaderboard(mode: GameMode, levelId: number): ScoreEntry[] {
    return managerFor(mode).getTopLocalSync(levelId);
  }

  isCompleted(mode: GameMode, levelId: number): boolean {
    return managerFor(mode).isCompletedSync(levelId);
  }

  async addScore(mode: GameMode, levelId: number, entry: ScoreEntryInput): Promise<AddScoreResult> {
    const rank = await managerFor(mode).addScore(levelId, entry);
    return { rank, isNewRecord: rank === 1 };
  }

  getProgress(mode: GameMode, totalLevels: number): ProgressInfo {
    return { completedCount: managerFor(mode).completedCountSync(), totalCount: totalLevels };
  }

  /** Clears the local score storage keys (`train_scores_v2` for shunting,
   * `train_clf_scores_v1` for classification) and their in-memory caches.
   * Local-only — deliberately never touches Firestore/global leaderboards
   * (a global "record" a player already submitted shouldn't vanish from
   * other devices just because this device's Settings screen reset local
   * progress). See src/backend/scoreManager.ts's `clear()`. */
  async resetProgress(): Promise<void> {
    await Promise.all([shuntingScores.clear(), classificationScores.clear()]);
  }

  async fetchGlobalLeaderboard(docId: string, n = 10): Promise<ScoreEntry[]> {
    const remote = await fbFetchLeaderboard(docId, n);
    const parsed = parseDocId(docId);
    return remote.map((r) => ({
      ...r,
      stars: parsed ? starsFor(parsed.mode, parsed.levelId, r) : (1 as const),
    }));
  }

  getConnectivity(): ConnectivityStatus {
    return fbGetConnectivity();
  }
}

/**
 * Call once at app startup (e.g. in App.tsx). Loads the local score cache —
 * this always resolves, even fully offline — then wires this implementation
 * into the controller layer via `setBackendApi()`. Firebase anonymous auth
 * is kicked off in the background (not awaited): individual network calls
 * (submitScore/fetchGlobalLeaderboard) await it lazily and fail soft, so
 * there's no reason to block app startup on it.
 */
export async function initBackend(): Promise<void> {
  const impl = new RemoteBackendApi();
  await impl.ready();
  setBackendApi(impl);
  void waitForInit();
}
