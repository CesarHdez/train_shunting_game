// js/core/firebase.js — Firebase integration: global leaderboard + score submission
// Cada modo de juego usa su propio prefijo de documento dentro de la colección
// 'scores' (p.ej. 'level_3' para maniobras, 'clf_level_3' para clasificación).
//
// SETUP REQUIRED (one-time):
//  1. Create a Firebase project at https://console.firebase.google.com
//  2. Enable Firestore Database (production mode)
//  3. Enable Authentication → Sign-in method → Anonymous
//  4. Enable Hosting
//  5. Paste your project's firebaseConfig object below
//  6. Run: npm install -g firebase-tools && firebase login && firebase init && firebase deploy

import { initializeApp }              from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs }
                                      from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ── REPLACE WITH YOUR FIREBASE PROJECT CONFIG ──────────────────────────────
// Find it at: Firebase Console → Project Settings → Your apps → Web app → SDK setup
const firebaseConfig = {
  apiKey: "AIzaSyDknCmtO-pzELOnrL9hOymBPC425Lkjzdo",
  authDomain: "train-shunting.firebaseapp.com",
  projectId: "train-shunting",
  storageBucket: "train-shunting.firebasestorage.app",
  messagingSenderId: "534049575393",
  appId: "1:534049575393:web:d7c0d369788afb8d7642a0"
};

// ──────────────────────────────────────────────────────────────────────────

let _db = null, _uid = null, _ready = false;

const _initPromise = (async () => {
    if (firebaseConfig.apiKey === 'FILL_IN') {
        console.info('[Firebase] Config not set — global leaderboard disabled.');
        return;
    }
    try {
        const app  = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        _db        = getFirestore(app);
        const cred = await signInAnonymously(auth);
        _uid       = cred.user.uid;
        _ready     = true;
    } catch (e) {
        console.warn('[Firebase] Init failed:', e.message);
    }
})();

export function isReady() { return _ready; }

// docId: nombre del documento dentro de 'scores' (incluye el prefijo del modo)
export async function submitScore(docId, entry) {
    await _initPromise;
    if (!_ready) return;
    try {
        await addDoc(collection(_db, 'scores', docId, 'entries'), {
            name:  entry.name,
            moves: entry.moves,
            time:  entry.time,
            score: entry.score ?? 0,
            date:  entry.date,
            uid:   _uid,
        });
    } catch (e) { console.warn('[Firebase] submitScore:', e.message); }
}

export async function fetchGlobalLeaderboard(docId, n = 5) {
    await _initPromise;
    if (!_ready) return [];
    try {
        const col  = collection(_db, 'scores', docId, 'entries');
        const q    = query(col, orderBy('score', 'desc'), orderBy('moves'), limit(n));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.data());
    } catch (e) {
        console.warn('[Firebase] fetchGlobalLeaderboard:', e.message);
        return [];
    }
}
