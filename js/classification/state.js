// js/classification/state.js — Modo Clasificación: reglas, puntaje y estado
//
// Regla del lomo: solo se puede empujar el PRIMER carro (cabeza) de la vía de
// llegada seleccionada hacia una vía de clasificación con espacio libre.
// Puntaje: +10 por carro clasificado, −15 por cada salto de color dentro de
// una vía, +30 de bono por cada vía usada con un solo color.

import { app } from '../core/app.js';
import { particles } from '../core/particles.js';
import { ScoreManager } from '../core/scores.js';
import { fetchGlobalLeaderboard } from '../core/firebase.js';

// ─────────────────────── CARROS Y COLORES ──────────────────────

export const COLORES = {
    rojo:    { fill: '#E14B4B', dark: '#A83232', nombre: 'Rojo' },
    azul:    { fill: '#3E8EDE', dark: '#2A66A6', nombre: 'Azul' },
    verde:   { fill: '#47B26B', dark: '#2F8A4E', nombre: 'Verde' },
    ambar:   { fill: '#E9C63F', dark: '#B3952B', nombre: 'Ámbar' },
    violeta: { fill: '#9B6BD6', dark: '#7248A8', nombre: 'Violeta' },
};

export const TIPOS = { F: 'Furgón', T: 'Tanque', V: 'Tolva', J: 'Jaula', C: 'Contenedor' };

export function parseCar(s) {
    const [t, c] = s.split('-');
    return { tipo: t, color: c };
}

// ─────────────────────── CÁLCULO DE PUNTAJE ────────────────────

export function saltosDeVia(via) {
    let s = 0;
    for (let i = 1; i < via.length; i++) {
        if (parseCar(via[i]).color !== parseCar(via[i - 1]).color) s++;
    }
    return s;
}

export function calcularPuntaje(vias) {
    let saltos = 0, purasBonus = 0, carros = 0;
    vias.forEach(v => {
        carros += v.length;
        const s = saltosDeVia(v);
        saltos += s;
        if (v.length > 0 && s === 0) purasBonus += 30;
    });
    const puntos = carros * 10 - saltos * 15 + purasBonus;
    return { puntos: Math.max(0, puntos), saltos, purasBonus, carros };
}

// Máximo teórico del nivel (0 saltos evitables, todas las vías puras)
export function puntajeMaximo(nivel) {
    const total         = nivel.arrivals.flat().length;
    const coloresUsados = new Set(nivel.arrivals.flat().map(c => parseCar(c).color)).size;
    const viasPuras     = Math.min(nivel.capacities.length, coloresUsados);
    // si hay más colores que vías, habrá al menos (colores − vías) saltos
    const saltosMin = Math.max(0, coloresUsados - nivel.capacities.length);
    const puras     = saltosMin > 0 ? nivel.capacities.length - 1 : viasPuras;
    return total * 10 - saltosMin * 15 + puras * 30;
}

// Estrellas por proporción del máximo: ≥90% → 3, ≥70% → 2, resto → 1
export function starsForScore(pts, max) {
    if (!max) return 1;
    const r = pts / max;
    return r >= 0.9 ? 3 : r >= 0.7 ? 2 : 1;
}

// ──────────────────────── GAME STATE ───────────────────────────

export class ClassificationState {
    constructor() {
        this.state    = 'MENU'; // MENU | PLAYING | SUMMARY | LEADERBOARD
        this.levels   = {};
        this.scores   = new ScoreManager({
            storageKey:  'train_clf_scores_v1',
            fbDocPrefix: 'clf_level_',
        });
        this.levelNum = 1;

        this.arrivals   = [];  // vías de llegada (cabeza = índice 0)
        this.clasif     = [];  // vías de clasificación
        this.capacities = [];
        this.arrSlots   = 1;   // máx. carros iniciales en una llegada (para layout)
        this.clasSlots  = 1;   // máx. capacidad de clasificación (para layout)
        this.viaSel     = 0;
        this.history    = [];

        this.moves        = 0;
        this.startTime    = 0;
        this.elapsedTime  = 0;
        this.finished     = false;
        this.newRecord    = false;
        this.lastRank     = 0;
        this.lastResult   = null; // resultado de calcularPuntaje al terminar
        this.message      = '';
        this.messageTimer = 0;
        this.winSpawned   = false;
        this._dirty       = false;

        this.scrollY   = 0;  this.scrollVel   = 0;  this.maxScroll   = 0;
        this.lbScrollY = 0;  this.lbScrollVel = 0;  this.lbMaxScroll = 0;

        this.globalLeaderboard = {}; // levelId -> entries
        this.globalLbLoading   = false;
        this.winLbLoading      = false;

        this.loadLevels();
    }

    async loadLevels() {
        for (let i = 1; i <= 100; i++) {
            try {
                const num = String(i).padStart(2, '0');
                const res = await fetch(`levels/classification/level_${num}.json?v=${Date.now()}`);
                if (res.ok) {
                    const d = await res.json();
                    this.levels[d.id] = d;
                    this._dirty = true;
                }
            } catch(e) { /* not found */ }
        }
    }

    maxScore(levelId) {
        const lvl = this.levels[levelId];
        return lvl ? puntajeMaximo(lvl) : 0;
    }

    getStars(levelId) {
        const best = this.scores.getBest(levelId);
        if (!best) return 0;
        return starsForScore(best.score ?? 0, this.maxScore(levelId));
    }

    startLevel(num) {
        if (!this.levels[num]) return;
        const data = this.levels[num];
        this.levelNum   = num;
        this.arrivals   = data.arrivals.map(v => [...v]);
        this.clasif     = data.capacities.map(() => []);
        this.capacities = [...data.capacities];
        this.arrSlots   = Math.max(...data.arrivals.map(v => v.length), 1);
        this.clasSlots  = Math.max(...data.capacities, 1);
        this.viaSel     = 0;
        this.history    = [];
        this.moves        = 0;
        this.startTime    = Date.now();
        this.elapsedTime  = 0;
        this.finished     = false;
        this.newRecord    = false;
        this.lastRank     = 0;
        this.lastResult   = null;
        this.message      = '';
        this.messageTimer = 0;
        this.winSpawned   = false;
        particles.p.length = 0;
        this.state = 'PLAYING';
    }

    get remaining() { return this.arrivals.reduce((a, v) => a + v.length, 0); }

    parcial() { return calcularPuntaje(this.clasif); }

    selectArrival(i) {
        if (this.finished) return;
        if (i >= 0 && i < this.arrivals.length && this.arrivals[i].length > 0) this.viaSel = i;
    }

    pushHistory() {
        this.history.push({
            arrivals: this.arrivals.map(v => [...v]),
            clasif:   this.clasif.map(v => [...v]),
            viaSel:   this.viaSel,
            moves:    this.moves,
        });
        if (this.history.length > 40) this.history.shift();
    }

    // Empuja la cabeza de la vía seleccionada hacia la vía de clasificación `destino`.
    empujar(destino) {
        if (this.finished || this.state !== 'PLAYING') return;
        const via = this.arrivals[this.viaSel];
        if (!via || via.length === 0) return;
        if (this.clasif[destino].length >= this.capacities[destino]) {
            this.message      = '¡Vía llena! Elige otra vía de clasificación.';
            this.messageTimer = 120;
            return;
        }
        this.pushHistory();
        const carro = via.shift();
        this.clasif[destino].push(carro);
        this.moves++;

        // si la vía seleccionada quedó vacía, saltar a otra con carros
        if (via.length === 0) {
            const otra = this.arrivals.findIndex(v => v.length > 0);
            if (otra >= 0) this.viaSel = otra;
        }
        if (this.remaining === 0) this.finish();
    }

    deshacer() {
        if (this.history.length === 0 || this.finished) return;
        const prev = this.history.pop();
        this.arrivals = prev.arrivals;
        this.clasif   = prev.clasif;
        this.viaSel   = prev.viaSel;
        this.moves    = prev.moves;
        this.message      = 'Movimiento deshecho';
        this.messageTimer = 100;
    }

    finish() {
        this.finished   = true;
        this.state      = 'SUMMARY';
        this.lastResult = calcularPuntaje(this.clasif);
        this.handleScore();
    }

    handleScore() {
        const res  = this.lastResult;
        const rank = this.scores.addScore(this.levelNum, {
            moves:  Math.max(this.moves, 1),
            time:   this.elapsedTime,
            score:  res.puntos,
            saltos: res.saltos,
            name:   app.playerName,
        });
        this.lastRank  = rank;
        this.newRecord = (rank === 1);
        delete this.globalLeaderboard[this.levelNum];
        this.winLbLoading = true;
        this._dirty = true;
        const lid = this.levelNum;
        fetchGlobalLeaderboard(`clf_level_${lid}`, 10).then(entries => {
            if (entries.length) this.globalLeaderboard[lid] = entries;
            this.winLbLoading = false;
            this._dirty = true;
        }).catch(() => { this.winLbLoading = false; this._dirty = true; });
    }

    async loadGlobalLeaderboard() {
        if (this.globalLbLoading) return;
        this.globalLbLoading = true;
        this._dirty = true;
        const ids = Object.keys(this.levels).map(Number)
                         .filter(id => this.scores.isCompleted(id));
        await Promise.allSettled(ids.map(async id => {
            const entries = await fetchGlobalLeaderboard(`clf_level_${id}`, 10);
            if (entries.length) this.globalLeaderboard[id] = entries;
        }));
        this.globalLbLoading = false;
        this._dirty = true;
    }

    updateTimer() {
        if (this.state === 'PLAYING' && !this.finished)
            this.elapsedTime = Math.floor((Date.now() - this.startTime) / 1000);
        if (this.messageTimer > 0) { this.messageTimer--; if (!this.messageTimer) this.message = ''; }
        this.scrollVel   *= 0.88; this.scrollY   += this.scrollVel;
        if (this.scrollY  > 0)               { this.scrollY = 0;  this.scrollVel = 0; }
        if (this.scrollY  < -this.maxScroll)  { this.scrollY = -this.maxScroll;  this.scrollVel = 0; }
        this.lbScrollVel *= 0.88; this.lbScrollY += this.lbScrollVel;
        if (this.lbScrollY > 0)                { this.lbScrollY = 0;  this.lbScrollVel = 0; }
        if (this.lbScrollY < -this.lbMaxScroll){ this.lbScrollY = -this.lbMaxScroll; this.lbScrollVel = 0; }
    }

    getTimeStr() {
        const m = Math.floor(this.elapsedTime / 60), s = this.elapsedTime % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    }
}

// ─────────────────────── SINGLETON ─────────────────────────────

export const clf = new ClassificationState();
