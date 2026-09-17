/**
 * AsyncStorage-backed JSON read/write helpers + the djb2/salt integrity hash.
 *
 * Direct port of the localStorage plumbing in ref/js/core/scores.js, adapted
 * to AsyncStorage's async API. `readJSON` distinguishes "nothing stored" from
 * "stored but unparsable" so callers can replicate the original module's
 * corrupted-data reset + v1 migration fallback exactly (see scoreManager.ts).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

/** Must match ref/js/core/scores.js HASH_SALT exactly — changing it invalidates every
 *  score ever saved on-device (and locally-stored entries silently fail their hash
 *  check and get dropped on next load, per the reference's own tamper-detection design). */
export const HASH_SALT = 'tr4in$hunt1ng_2024';

export interface HashableEntry {
  moves: number;
  time: number;
  name: string;
  date: string;
  uid?: string;
}

/** djb2 hash of the entry, salted — bit-for-bit port of ref/js/core/scores.js _hashEntry. */
export function hashEntry(e: HashableEntry): string {
  const str = `${HASH_SALT}|${e.moves}|${e.time}|${e.name}|${e.date}|${e.uid || ''}`;
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

/** Random per-entry id used for reliable "isMe" leaderboard detection (not the auth uid). */
export function randomUid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export type ReadResult<T> =
  | { status: 'ok'; value: T }
  | { status: 'empty' }
  | { status: 'corrupted' };

/** Reads + JSON-parses a key, distinguishing "absent" from "present but corrupt". */
export async function readJSON<T>(key: string): Promise<ReadResult<T>> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(key);
  } catch (e) {
    console.warn(`[storage] getItem(${key}) failed:`, e instanceof Error ? e.message : e);
    return { status: 'empty' };
  }
  if (raw == null) return { status: 'empty' };
  try {
    return { status: 'ok', value: JSON.parse(raw) as T };
  } catch {
    return { status: 'corrupted' };
  }
}

export async function writeJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`[storage] setItem(${key}) failed:`, e instanceof Error ? e.message : e);
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // best-effort cleanup — nothing to recover from here
  }
}
