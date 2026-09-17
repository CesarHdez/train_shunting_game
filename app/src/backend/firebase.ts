/**
 * Firebase integration — anonymous auth + global leaderboard submit/fetch.
 *
 * Faithful port of ref/js/core/firebase.js for React Native (Expo SDK 57,
 * firebase v12 JS SDK). Reuses the SAME public (rules-protected) web client
 * config verbatim — this is a public Firebase client config, not a secret —
 * so the mobile app talks to the exact same 'train-shunting' Firestore
 * project and shares the same global leaderboards as the web app.
 *
 * Every exported function is best-effort: all failures are swallowed
 * (console.warn) so the game stays fully playable offline.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
  getAuth,
  signInAnonymously,
  type Auth,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  type Firestore,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Minimal shape submitScore needs — deliberately structural (not imported from
 *  the controller layer) so this module has no dependency outside src/backend. */
export interface SubmittableScore {
  name: string;
  moves: number;
  time: number;
  score: number;
  date: string;
}

/** A score entry as returned by the Firestore global leaderboard (scores/{docId}/entries). */
export interface RemoteScoreEntry {
  name: string;
  moves: number;
  time: number;
  score: number;
  date: string;
  uid: string;
}

// Same web app config as ref/js/core/firebase.js — do not invent a new project.
const firebaseConfig = {
  apiKey: 'AIzaSyDknCmtO-pzELOnrL9hOymBPC425Lkjzdo',
  authDomain: 'train-shunting.firebaseapp.com',
  projectId: 'train-shunting',
  storageBucket: 'train-shunting.firebasestorage.app',
  messagingSenderId: '534049575393',
  appId: '1:534049575393:web:d7c0d369788afb8d7642a0',
};

let _db: Firestore | null = null;
let _uid: string | null = null;
let _ready = false;
/** True once _initPromise has settled (success OR failure) — distinct from
 *  `_ready`, which is only true on success. Lets getConnectivity() tell
 *  "still starting up" (unknown) apart from "auth failed" (offline). */
let _initSettled = false;

/**
 * Outcome of the most recent submitScore/fetchGlobalLeaderboard attempt, or
 * null if neither has been attempted yet this session. This is the ONLY
 * network signal getConnectivity() uses — no dedicated connectivity probe is
 * ever made, matching this module's best-effort-only philosophy.
 */
let _lastNetworkOutcome: 'online' | 'offline' | null = null;

const _initPromise: Promise<void> = (async () => {
  try {
    // getApps()/getApp() guard against "app already exists" on Fast Refresh,
    // which re-evaluates this module without a full process restart.
    const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

    let auth: Auth;
    try {
      // RN requires an explicit persistence layer (AsyncStorage) or auth state
      // is lost on every reload. initializeAuth throws if already initialized
      // for this app (e.g. Fast Refresh re-running this module) — fall back
      // to the existing instance in that case.
      auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
    } catch {
      auth = getAuth(app);
    }

    _db = getFirestore(app);
    const cred = await signInAnonymously(auth);
    _uid = cred.user.uid;
    _ready = true;
  } catch (e) {
    console.warn('[Firebase] Init failed:', e instanceof Error ? e.message : e);
  } finally {
    _initSettled = true;
  }
})();

/** Resolves once Firebase init (incl. anonymous sign-in) has settled, success or failure. */
export function waitForInit(): Promise<void> {
  return _initPromise;
}

export function isReady(): boolean {
  return _ready;
}

export type ConnectivityStatus = 'online' | 'offline' | 'unknown';

/**
 * Best-effort connectivity signal for the UI (offline indicator) — inferred
 * purely from state this module already tracks, never a dedicated network
 * probe:
 *  - 'unknown': init hasn't settled yet, OR it settled successfully but
 *    neither submitScore nor fetchGlobalLeaderboard has been attempted yet
 *    this session (nothing to infer from).
 *  - 'offline': anonymous auth failed to init, OR the most recent
 *    submit/fetch attempt threw.
 *  - 'online': the most recent submit/fetch attempt succeeded.
 */
export function getConnectivity(): ConnectivityStatus {
  if (!_initSettled) return 'unknown';
  if (!_ready) return 'offline';
  return _lastNetworkOutcome ?? 'unknown';
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

/**
 * docId: document name inside the 'scores' collection, including the mode
 * prefix (e.g. 'level_3', 'clf_level_3'). Fire-and-forget by design — callers
 * should NOT await this on the score-recording critical path.
 *
 * Field set/bounds mirror firestore.rules exactly: only
 * {name, moves, time, score, date, uid} are sent, clamped to the rule's
 * bounds as a defensive measure so a caller mistake never gets silently
 * rejected server-side.
 */
export async function submitScore(docId: string, entry: SubmittableScore): Promise<void> {
  await _initPromise;
  if (!_ready || !_db || !_uid) return;
  try {
    await addDoc(collection(_db, 'scores', docId, 'entries'), {
      name: String(entry.name || 'Anon').slice(0, 15),
      moves: clamp(entry.moves, 1, 10000),
      time: clamp(entry.time, 0, 86400),
      score: clamp(entry.score ?? 0, 0, 5000),
      date: String(entry.date).slice(0, 20),
      // Firestore rules require uid === request.auth.uid — this is the
      // Firebase Auth uid, NOT the entry's local (random) uid used for
      // client-side "isMe" detection.
      uid: _uid,
    });
    _lastNetworkOutcome = 'online';
  } catch (e) {
    console.warn('[Firebase] submitScore:', e instanceof Error ? e.message : e);
    _lastNetworkOutcome = 'offline';
  }
}

export async function fetchGlobalLeaderboard(docId: string, n = 5): Promise<RemoteScoreEntry[]> {
  await _initPromise;
  if (!_ready || !_db) return [];
  try {
    const col = collection(_db, 'scores', docId, 'entries');
    const q = query(col, orderBy('score', 'desc'), orderBy('moves'), limit(n));
    const snap = await getDocs(q);
    _lastNetworkOutcome = 'online';
    return snap.docs.map((d) => d.data() as RemoteScoreEntry);
  } catch (e) {
    console.warn('[Firebase] fetchGlobalLeaderboard:', e instanceof Error ? e.message : e);
    _lastNetworkOutcome = 'offline';
    return [];
  }
}
