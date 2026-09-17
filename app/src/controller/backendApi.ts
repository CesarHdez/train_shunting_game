/**
 * src/controller/backendApi.ts
 *
 * Coordination interface between the UI controller layer (this directory)
 * and the score/leaderboard backend. `src/backend` is being built in
 * parallel by another agent — this file is the contract both sides code
 * against, per the orchestrator's instructions.
 *
 * Until `src/backend` lands, `LocalBackendApi` below provides a fully
 * working AsyncStorage-backed implementation (a straight port of
 * ref/js/core/scores.js's `ScoreManager`, minus the Firestore calls, which
 * are genuinely owned by the backend agent — see `fetchGlobalLeaderboard`).
 * This keeps every screen functional today instead of stubbed out.
 *
 * Integration seam: once `src/backend` exports something that satisfies
 * `BackendApi` (e.g. a Firestore-backed implementation whose local cache
 * mirrors this shape), call `setBackendApi(realImpl)` once at startup
 * (see App.tsx) and every screen picks it up automatically via
 * `getBackendApi()` — no screen imports the concrete class directly.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type GameMode = 'shunting' | 'classification';

/** Best-effort connectivity signal — see src/backend/firebase.ts
 *  `getConnectivity()` for how the real implementation derives this
 *  (inferred from the last submit/fetch outcome, never a network probe). */
export type ConnectivityStatus = 'online' | 'offline' | 'unknown';

/** One leaderboard row. Mirrors the entry shape ref/js/core/scores.js stores. */
export interface ScoreEntry {
  name: string;
  moves: number;
  time: number;
  score: number;
  stars: 1 | 2 | 3;
  date: string;
  uid: string;
}

/** What a caller provides when a level finishes; the backend fills in date/uid. */
export type ScoreEntryInput = Pick<ScoreEntry, 'name' | 'moves' | 'time' | 'score' | 'stars'>;

export interface AddScoreResult {
  /** 1-based rank within the local top-5 board for this level. */
  rank: number;
  /** rank === 1 (matches ref's `newRecord = rank === 1`). */
  isNewRecord: boolean;
}

export interface ProgressInfo {
  completedCount: number;
  totalCount: number;
}

export interface BackendApi {
  /** Resolves once persisted score data has been loaded into memory. Call
   * once at app startup (or lazily before first read) and await it. */
  ready(): Promise<void>;

  getBest(mode: GameMode, levelId: number): ScoreEntry | null;
  getStars(mode: GameMode, levelId: number): 0 | 1 | 2 | 3;
  getLocalLeaderboard(mode: GameMode, levelId: number): ScoreEntry[];
  isCompleted(mode: GameMode, levelId: number): boolean;

  /** Records a finished level's result, persists it, and returns local rank. */
  addScore(mode: GameMode, levelId: number, entry: ScoreEntryInput): Promise<AddScoreResult>;

  getProgress(mode: GameMode, totalLevels: number): ProgressInfo;

  /** Wipes all locally-stored best scores/stars for BOTH modes on this
   * device (Settings screen's "Reiniciar progreso"). Local-only — never
   * touches Firestore/global leaderboards. Resolves once the in-memory
   * cache reflects the cleared state, so callers can immediately re-read
   * getProgress()/getStars()/etc. afterwards. */
  resetProgress(): Promise<void>;

  /** Global top-N leaderboard for a single level. `docId` matches
   * ref/js/core/firebase.js's convention: `level_{n}` / `clf_level_{n}` —
   * see `globalDocId()` below to build it consistently. */
  fetchGlobalLeaderboard(docId: string, n?: number): Promise<ScoreEntry[]>;

  /** Best-effort, synchronous connectivity signal for the "offline" UI
   * indicator — never blocks, never probes the network. See
   * src/backend/firebase.ts `getConnectivity()` for the real implementation. */
  getConnectivity(): ConnectivityStatus;
}

const STORAGE_KEYS: Record<GameMode, string> = {
  shunting: 'train_scores_v2_mobile',
  classification: 'train_clf_scores_v1_mobile',
};

const DOC_PREFIX: Record<GameMode, string> = {
  shunting: 'level_',
  classification: 'clf_level_',
};

/** Builds the Firestore doc id for a level's global leaderboard — matches
 * ref/js/core/scores.js's `fbDocPrefix` convention exactly. */
export function globalDocId(mode: GameMode, levelId: number): string {
  return `${DOC_PREFIX[mode]}${levelId}`;
}

function makeUid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

type Store = Record<string, ScoreEntry[]>;

class LocalBackendApi implements BackendApi {
  private data: Record<GameMode, Store> = { shunting: {}, classification: {} };
  private loaded: Record<GameMode, boolean> = { shunting: false, classification: false };
  private loadingPromises: Partial<Record<GameMode, Promise<void>>> = {};

  async ready(): Promise<void> {
    await Promise.all([this.load('shunting'), this.load('classification')]);
  }

  private load(mode: GameMode): Promise<void> {
    if (this.loaded[mode]) return Promise.resolve();
    if (!this.loadingPromises[mode]) {
      this.loadingPromises[mode] = (async () => {
        try {
          const raw = await AsyncStorage.getItem(STORAGE_KEYS[mode]);
          if (raw) this.data[mode] = JSON.parse(raw) as Store;
        } catch {
          // Corrupted data — discard and start fresh (mirrors ref's try/catch reset).
          this.data[mode] = {};
        }
        this.loaded[mode] = true;
      })();
    }
    return this.loadingPromises[mode]!;
  }

  private async persist(mode: GameMode): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS[mode], JSON.stringify(this.data[mode]));
    } catch {
      // Best-effort; ignore write failures (e.g. storage full).
    }
  }

  getBest(mode: GameMode, levelId: number): ScoreEntry | null {
    return this.data[mode][String(levelId)]?.[0] ?? null;
  }

  getStars(mode: GameMode, levelId: number): 0 | 1 | 2 | 3 {
    return this.getBest(mode, levelId)?.stars ?? 0;
  }

  getLocalLeaderboard(mode: GameMode, levelId: number): ScoreEntry[] {
    return this.data[mode][String(levelId)] ?? [];
  }

  isCompleted(mode: GameMode, levelId: number): boolean {
    return (this.data[mode][String(levelId)]?.length ?? 0) > 0;
  }

  async addScore(mode: GameMode, levelId: number, entry: ScoreEntryInput): Promise<AddScoreResult> {
    await this.load(mode);
    const lid = String(levelId);
    const list = [...(this.data[mode][lid] ?? [])];
    const full: ScoreEntry = { ...entry, date: new Date().toLocaleDateString('es'), uid: makeUid() };
    list.push(full);
    list.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)); // higher score first, matches ref
    this.data[mode][lid] = list.slice(0, 5);
    await this.persist(mode);
    const idx = this.data[mode][lid].findIndex((e) => e.uid === full.uid);
    const rank = idx >= 0 ? idx + 1 : this.data[mode][lid].length;
    return { rank, isNewRecord: rank === 1 };
  }

  getProgress(mode: GameMode, totalLevels: number): ProgressInfo {
    const completedCount = Object.keys(this.data[mode]).filter(
      (lid) => (this.data[mode][lid]?.length ?? 0) > 0
    ).length;
    return { completedCount, totalCount: totalLevels };
  }

  async resetProgress(): Promise<void> {
    this.data = { shunting: {}, classification: {} };
    this.loaded = { shunting: true, classification: true };
    await Promise.all([this.persist('shunting'), this.persist('classification')]);
  }

  // Global leaderboard needs Firestore, which is the backend agent's
  // territory (src/backend). This local fallback has no network access and
  // returns [] so the UI can render its "no global data yet" state.
  // TODO(backend agent): once src/backend exposes a Firestore-backed
  // BackendApi, wire it up via setBackendApi() in App.tsx. Query shape to
  // port: ref/js/core/firebase.js `fetchGlobalLeaderboard` (orderBy score
  // desc, then moves asc, limit n).
  async fetchGlobalLeaderboard(_docId: string, _n = 10): Promise<ScoreEntry[]> {
    return [];
  }

  // No network layer to infer from here (this stub predates src/backend
  // taking over, or is the fallback if it's ever removed) — always
  // 'unknown' rather than falsely claiming 'offline'.
  getConnectivity(): ConnectivityStatus {
    return 'unknown';
  }
}

let activeBackend: BackendApi = new LocalBackendApi();

/** Swap in a real (e.g. Firestore-backed) implementation once src/backend is ready. */
export function setBackendApi(impl: BackendApi): void {
  activeBackend = impl;
}

export function getBackendApi(): BackendApi {
  return activeBackend;
}
