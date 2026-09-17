/**
 * ScoreManager — AsyncStorage-backed top-5-per-level local leaderboard.
 *
 * Direct port of the generic `ScoreManager` class in ref/js/core/scores.js,
 * adapted for AsyncStorage's async API (`load()`/`save()` become async) and
 * for the entry shape defined by the UI/controller integration contract in
 * `src/controller/backendApi.ts` (`ScoreEntry` — stars are supplied by the
 * caller, already computed via engine/scoring.ts or engine/classification.ts,
 * rather than recomputed here).
 *
 * An in-memory cache (`this.data`, populated once by `init()`) backs the
 * `*Sync` reads so `BackendApi`'s synchronous methods (getBest, getStars,
 * getLocalLeaderboard, isCompleted, getProgress) can be satisfied without
 * touching AsyncStorage on every call — callers just need to have awaited
 * `init()` (via `ready()`) once at startup.
 *
 * Integrity: entries carry a djb2+salt hash (`_h`, see storage.ts#hashEntry)
 * computed over {moves, time, name, date, uid}. On load, any entry whose
 * hash doesn't match is dropped (tamper/corruption detection) — matching
 * ref/js/core/scores.js exactly. The hash is stripped before entries are
 * handed back to callers.
 */

import type { ScoreEntry, ScoreEntryInput } from '../controller/backendApi';
import { hashEntry, randomUid, readJSON, writeJSON, removeKey } from './storage';
import { submitScore } from './firebase';

export interface ScoreManagerOptions {
  /** AsyncStorage key (e.g. 'train_scores_v2'). */
  storageKey: string;
  /** Firestore doc prefix inside the 'scores' collection (e.g. 'level_' or 'clf_level_'). */
  fbDocPrefix: string;
  /** v1 legacy AsyncStorage key to migrate from. Only the shunting mode has one. */
  legacyKey?: string | null;
}

interface LegacyV1Entry {
  moves: number;
  time: number;
  name?: string;
}

/** Internal on-disk shape: a public ScoreEntry plus its integrity hash. */
type StoredEntry = ScoreEntry & { _h: string };

function stripHash(e: StoredEntry): ScoreEntry {
  const { _h, ...rest } = e;
  void _h;
  return rest;
}

export class ScoreManager {
  readonly storageKey: string;
  readonly fbDocPrefix: string;
  private legacyKey: string | null;
  private data: Record<string, StoredEntry[]> = {};
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  lastUid: string | null = null;

  constructor(opts: ScoreManagerOptions) {
    this.storageKey = opts.storageKey;
    this.fbDocPrefix = opts.fbDocPrefix;
    this.legacyKey = opts.legacyKey ?? null;
  }

  /** Loads persisted scores into the in-memory cache. Idempotent and safe to call repeatedly. */
  init(): Promise<void> {
    if (!this.loadPromise) this.loadPromise = this.load();
    return this.loadPromise;
  }

  get isLoaded(): boolean {
    return this.loaded;
  }

  private async save(): Promise<void> {
    await writeJSON(this.storageKey, this.data);
  }

  private async load(): Promise<void> {
    const result = await readJSON<Record<string, StoredEntry[]>>(this.storageKey);
    if (result.status === 'ok') {
      const cleaned: Record<string, StoredEntry[]> = {};
      for (const [lid, entries] of Object.entries(result.value)) {
        if (!Array.isArray(entries)) continue;
        cleaned[lid] = entries.filter((e) => {
          if (!e || typeof e !== 'object') return false;
          // Legacy entries without a hash pass through unchanged.
          if (!e._h) return true;
          return e._h === hashEntry(e);
        });
      }
      this.data = cleaned;
      this.loaded = true;
      return;
    }
    if (result.status === 'corrupted') {
      await removeKey(this.storageKey);
      this.data = {};
    }
    this.loaded = true;

    // Migrate from the v1 format (shunting mode only — classification has no legacyKey).
    // v1 entries predate `score`/`stars`; both default so the migrated shape
    // still satisfies ScoreEntry.
    if (!this.legacyKey) return;
    const legacy = await readJSON<Record<string, LegacyV1Entry>>(this.legacyKey);
    if (legacy.status === 'ok') {
      for (const [lid, s] of Object.entries(legacy.value)) {
        const entry = {
          moves: s.moves,
          time: s.time,
          name: s.name || 'Anon',
          score: 0,
          stars: 1,
          date: new Date().toLocaleDateString('es'),
          uid: randomUid(),
        } as StoredEntry;
        entry._h = hashEntry(entry);
        this.data[lid] = [entry];
      }
      await this.save();
    }
    await removeKey(this.legacyKey);
  }

  /**
   * entry: score/stars already computed by the caller — date/uid/hash are
   * added here. Returns the 1-based rank within the top-5 (equal to the
   * list length, i.e. never 0 — the entry is always kept if there's room,
   * and always at least ranked last otherwise it wouldn't have been pushed
   * before slicing). Fires a best-effort Firestore submit without awaiting it.
   */
  async addScore(levelId: number | string, entry: ScoreEntryInput): Promise<number> {
    await this.init();
    const lid = String(levelId);
    if (!this.data[lid]) this.data[lid] = [];
    const uid = randomUid();
    const full = { ...entry, date: new Date().toLocaleDateString('es'), uid } as StoredEntry;
    full._h = hashEntry(full); // hash excludes score/stars (derived fields)
    this.data[lid].push(full);
    this.data[lid].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)); // highest score first
    this.data[lid] = this.data[lid].slice(0, 5);
    await this.save();
    this.lastUid = uid;
    void submitScore(`${this.fbDocPrefix}${levelId}`, full); // fire-and-forget — do not await
    const idx = this.data[lid].findIndex((e) => e.uid === uid);
    return idx >= 0 ? idx + 1 : this.data[lid].length;
  }

  getBestSync(levelId: number | string): ScoreEntry | null {
    const best = this.data[String(levelId)]?.[0];
    return best ? stripHash(best) : null;
  }

  getTopLocalSync(levelId: number | string): ScoreEntry[] {
    return (this.data[String(levelId)] ?? []).map(stripHash);
  }

  isCompletedSync(levelId: number | string): boolean {
    return (this.data[String(levelId)]?.length ?? 0) > 0;
  }

  completedCountSync(): number {
    return Object.keys(this.data).length;
  }

  /** Wipes every locally-stored entry for this manager — both the on-disk
   * AsyncStorage key and the in-memory cache — so subsequent `*Sync` reads
   * (getBestSync/getTopLocalSync/isCompletedSync/completedCountSync)
   * immediately reflect the cleared state. Device-local only; never touches
   * Firestore. Used by Settings' "Reiniciar progreso". Safe to call whether
   * or not `init()` has resolved yet. */
  async clear(): Promise<void> {
    this.data = {};
    this.loaded = true;
    await removeKey(this.storageKey);
  }
}

// ── Singletons — Firestore doc prefixes match the web app; AsyncStorage keys
// are this app's own namespace (device-local, no compatibility requirement
// with the web app's separate browser localStorage) ──────────────────────

export const shuntingScores = new ScoreManager({
  storageKey: 'train_scores_v2',
  fbDocPrefix: 'level_',
  legacyKey: 'train_shunting_scores',
});

export const classificationScores = new ScoreManager({
  storageKey: 'train_clf_scores_v1',
  fbDocPrefix: 'clf_level_',
});
