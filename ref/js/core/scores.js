// js/core/scores.js — Gestión de puntajes local (localStorage) por modo de juego
// Item 1: try/catch around JSON.parse, reset on corruption
// Item 2: djb2 hash + salt to detect tampered entries
// Item 3: uid per entry for reliable "isMe" detection

import { submitScore } from './firebase.js';

const HASH_SALT = 'tr4in$hunt1ng_2024';

function _hashEntry(e) {
    const str = `${HASH_SALT}|${e.moves}|${e.time}|${e.name}|${e.date}|${e.uid||''}`;
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
    return (h >>> 0).toString(36);
}

// Puntaje del modo maniobras: maniobras es primario (0-1000), tiempo es secundario (0-200).
// Si se conoce minMoves, el puntaje de maniobras es exacto; si no, usa el sistema de estrellas.
export function computeShuntingScore(moves, time, minMoves, carCount) {
    let moveScore;
    if (minMoves != null && minMoves > 0 && moves > 0) {
        moveScore = Math.round(1000 * Math.pow(Math.min(1, minMoves / moves), 2));
    } else if (minMoves === 0 && moves === 0) {
        moveScore = 1000;
    } else {
        // Fallback: mapear estrellas a puntaje
        const n = Math.max(carCount || 2, 2);
        moveScore = moves <= n + 1 ? 1000 : moves <= n * 2 + 1 ? 600 : 200;
    }
    const timeBonus = Math.max(0, 200 - time); // máx 200 pts, decrece 1 pt/segundo
    return moveScore + timeBonus;
}

// ScoreManager genérico: cada modo crea el suyo con su clave de almacenamiento
// y su prefijo de documento en Firestore (para no mezclar rankings).
export class ScoreManager {
    // storageKey:  clave en localStorage (p.ej. 'train_scores_v2')
    // fbDocPrefix: prefijo del doc en scores/<doc>/entries (p.ej. 'level_' o 'clf_level_')
    // legacyKey:   clave v1 a migrar (solo el modo maniobras la tiene)
    constructor({ storageKey, fbDocPrefix, legacyKey = null }) {
        this.storageKey  = storageKey;
        this.fbDocPrefix = fbDocPrefix;
        this.legacyKey   = legacyKey;
        this.data        = {};
        this.lastUid     = null;
        this.load();
    }

    load() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                this.data = {};
                for (const [lid, entries] of Object.entries(parsed)) {
                    if (!Array.isArray(entries)) continue;
                    this.data[lid] = entries.filter(e => {
                        if (!e || typeof e !== 'object') return false;
                        // Legacy entries without _h pass through unchanged
                        if (!e._h) return true;
                        return e._h === _hashEntry(e);
                    });
                }
                return;
            }
        } catch(e) {
            // Corrupted data — discard and start fresh
            localStorage.removeItem(this.storageKey);
            this.data = {};
        }
        // Migrate from v1 format (solo modo maniobras)
        if (!this.legacyKey) return;
        try {
            const v1 = localStorage.getItem(this.legacyKey);
            if (v1) {
                const old = JSON.parse(v1);
                for (const [lid, s] of Object.entries(old)) {
                    const entry = { moves: s.moves, time: s.time, name: s.name || 'Anon',
                        date: new Date().toLocaleDateString('es') };
                    entry._h = _hashEntry(entry);
                    this.data[lid] = [entry];
                }
                this.save();
            }
        } catch(e) {
            localStorage.removeItem(this.legacyKey);
        }
    }

    save() { localStorage.setItem(this.storageKey, JSON.stringify(this.data)); }

    // entry: { moves, time, score, name, ...extras } — score ya calculado por el modo.
    addScore(levelId, entry) {
        const lid = String(levelId);
        if (!this.data[lid]) this.data[lid] = [];
        const uid  = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        const full = { ...entry, date: new Date().toLocaleDateString('es'), uid };
        full._h    = _hashEntry(full); // hash no incluye score (campo derivado)
        this.data[lid].push(full);
        this.data[lid].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)); // mayor puntaje primero
        this.data[lid] = this.data[lid].slice(0, 5);
        this.save();
        this.lastUid = uid;
        submitScore(`${this.fbDocPrefix}${levelId}`, full); // fire-and-forget — no await
        return this.data[lid].findIndex(e => e.uid === uid) + 1;
    }

    getBest(levelId)        { return this.data[String(levelId)]?.[0] || null; }
    getLeaderboard(levelId) { return this.data[String(levelId)] || []; }
    isCompleted(levelId)    { return (this.data[String(levelId)]?.length || 0) > 0; }
    completedCount()        { return Object.keys(this.data).length; }
}
