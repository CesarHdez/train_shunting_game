#!/usr/bin/env node
// compute_min_moves.js — IDA* solver: calcula el mínimo de maniobras por nivel
// Uso: node compute_min_moves.js
// Escribe el campo "minMoves" en cada levels/shunting/level_NN.json

'use strict';

const fs   = require('fs');
const path = require('path');

const LEVELS_DIR  = path.join(__dirname, 'levels', 'shunting');
const TIME_LIMIT_MS = 15_000; // 15 segundos por nivel antes de desistir

// ─────────────────────────────────────────────────────────────────────────────
// HEURÍSTICA ADMISIBLE
//
// Cuenta "cortes" en la secuencia objetivo: pares consecutivos (Ti, Ti+1)
// que NO aparecen adyacentes y en ese orden en ninguna vía.
// Cada maniobra puede "pegar" a lo sumo locoLimit pares → h = ceil(cortes / limit).
// ─────────────────────────────────────────────────────────────────────────────

function heuristic(tracks, target, limit) {
    if (target.length <= 1) return 0;
    // Construir mapa rápido: para cada par (target[i], target[i+1]),
    // verificar si están adyacentes en el orden correcto en alguna vía.
    const adjSet = new Set();
    for (const track of tracks) {
        const cars = track; // ya sin vacíos
        for (let i = 0; i < cars.length - 1; i++) {
            adjSet.add(cars[i] + '\x00' + cars[i + 1]);
        }
    }
    let breaks = 0;
    for (let i = 0; i < target.length - 1; i++) {
        if (!adjSet.has(target[i] + '\x00' + target[i + 1])) breaks++;
    }
    const L = isFinite(limit) ? Math.max(1, limit) : Math.max(1, target.length);
    return Math.ceil(breaks / L);
}

// ─────────────────────────────────────────────────────────────────────────────
// CIERRE DE COSTE 0: primer posicionamiento de cada loco es gratis.
// Devuelve todos los estados (t, ll, lr) alcanzables gratis desde el estado dado.
// ─────────────────────────────────────────────────────────────────────────────

function zeroCostClosure(t, ll, lr, hasR, T) {
    const states = [];
    const seen   = new Set();

    function add(ll2, lr2) {
        const k = ll2 + ',' + lr2;
        if (seen.has(k)) return;
        seen.add(k);
        states.push([ll2, lr2]);
    }

    // Expandir en BFS de coste 0
    add(ll, lr);
    let head = 0;
    while (head < states.length) {
        const [l, r] = states[head++];
        if (l === -1) {
            for (let x = 0; x < T; x++) add(x, r);
        }
        if (hasR && r === -1) {
            for (let y = 0; y < T; y++) add(-1, y);
        }
    }
    return states; // array de [ll, lr]
}

// ─────────────────────────────────────────────────────────────────────────────
// IDA* SOLVER
// ─────────────────────────────────────────────────────────────────────────────

const FOUND = -1;

function solve(levelData) {
    const { tracks: rawTracks, targetSequence: target, capacity, locoLimit, rightLoco } = levelData;
    const cap   = capacity || 8;
    const limit = (locoLimit != null && isFinite(+locoLimit)) ? +locoLimit : Infinity;
    const hasR  = !!rightLoco;
    const T     = rawTracks.length;

    const initT = rawTracks.map(t => t.filter(c => c !== ''));

    function isWin(t) {
        return t.some(row => row.length === target.length && row.every((c, i) => c === target[i]));
    }

    if (isWin(initT)) return { min: 0 };

    // Para IDA*, necesitamos detectar ciclos. Usamos un Set de strings del camino actual.
    // La representación del estado incluye las vías + posición de locos.
    function stateKey(t, ll, lr) {
        return t.map(r => r.join(',')).join('|') + '\x00' + ll + '\x00' + lr;
    }

    let deadline;

    // Genera todos los sucesores de coste 1 de un estado (t, ll, lr).
    // Aplica automáticamente el cierre de coste 0 a cada sucesor.
    function* successors(t, ll, lr) {
        // Generar sucesores de coste 1 y para cada uno expandir coste-0
        const raw1 = [];

        // LOCO IZQUIERDO
        if (ll !== -1) {
            // Reposicionar
            for (let x = 0; x < T; x++) {
                if (x !== ll) raw1.push([t, x, lr]);
            }
            // Jalar
            const src  = t[ll];
            const maxN = isFinite(limit) ? Math.min(src.length, limit) : src.length;
            for (let n = 1; n <= maxN; n++) {
                const moving = src.slice(0, n);
                const newSrc = src.slice(n);
                for (let dst = 0; dst < T; dst++) {
                    if (dst === ll || t[dst].length + n > cap) continue;
                    const newDst = [...moving, ...t[dst]];
                    const nt = t.map((row, i) => i === ll ? newSrc : i === dst ? newDst : row);
                    raw1.push([nt, dst, lr]);
                }
            }
        }

        // LOCO DERECHO
        if (hasR && lr !== -1) {
            // Reposicionar (resetea ll)
            for (let x = 0; x < T; x++) {
                if (x !== lr) raw1.push([t, -1, x]);
            }
            // Jalar
            const src  = t[lr];
            const maxN = isFinite(limit) ? Math.min(src.length, limit) : src.length;
            for (let n = 1; n <= maxN; n++) {
                const moving = src.slice(src.length - n);
                const newSrc = src.slice(0, src.length - n);
                for (let dst = 0; dst < T; dst++) {
                    if (dst === lr || t[dst].length + n > cap) continue;
                    const newDst = [...t[dst], ...moving];
                    const nt = t.map((row, i) => i === lr ? newSrc : i === dst ? newDst : row);
                    raw1.push([nt, ll, dst]);
                }
            }
        }

        // Aplicar cierre de coste 0 a cada sucesor de coste 1
        for (const [nt, nll, nlr] of raw1) {
            for (const [ll2, lr2] of zeroCostClosure(nt, nll, nlr, hasR, T)) {
                yield [nt, ll2, lr2];
            }
        }
    }

    // Búsqueda IDA*
    function search(t, ll, lr, g, bound, path) {
        if (Date.now() > deadline) return Infinity; // tiempo agotado

        const h = heuristic(t, target, limit);
        const f = g + h;
        if (f > bound) return f;
        if (isWin(t)) return FOUND;

        let minT = Infinity;
        for (const [nt, nll, nlr] of successors(t, ll, lr)) {
            const k = stateKey(nt, nll, nlr);
            if (path.has(k)) continue; // evitar ciclos
            path.add(k);
            const result = search(nt, nll, nlr, g + 1, bound, path);
            path.delete(k);
            if (result === FOUND) return FOUND;
            if (Date.now() > deadline) return Infinity;
            if (result < minT) minT = result;
        }
        return minT;
    }

    deadline = Date.now() + TIME_LIMIT_MS;

    // Estado inicial expandido con cierre de coste 0
    const initLocos = zeroCostClosure(initT, -1, -1, hasR, T);

    // Calcular bound inicial: mínimo h entre todos los estados de coste 0
    let bound = Infinity;
    for (const [ll, lr] of initLocos) {
        const h = heuristic(initT, target, limit);
        if (h < bound) bound = h;
    }

    while (bound !== Infinity) {
        if (Date.now() > deadline) return { min: null };

        let minT = Infinity;
        for (const [ll, lr] of initLocos) {
            const k = stateKey(initT, ll, lr);
            const path = new Set([k]);
            const result = search(initT, ll, lr, 0, bound, path);
            if (result === FOUND) return { min: bound };
            if (Date.now() > deadline) return { min: null };
            if (result < minT) minT = result;
        }
        if (minT === Infinity) return { min: null }; // sin solución
        bound = minT;
    }

    return { min: null };
}

// ─────────────────────── MAIN ────────────────────────────────────────────────

const files = fs.readdirSync(LEVELS_DIR)
    .filter(f => /^level_\d+\.json$/.test(f))
    .sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]);

let solved = 0, skipped = 0;

for (const file of files) {
    const fpath = path.join(LEVELS_DIR, file);
    const data  = JSON.parse(fs.readFileSync(fpath, 'utf8'));
    process.stdout.write(`Nivel ${String(data.id).padStart(3)}: `);

    const t0     = Date.now();
    const result = solve(data);
    const ms     = Date.now() - t0;

    if (result.min !== null) {
        process.stdout.write(`minMoves=${result.min}  (${ms}ms)\n`);
        data.minMoves = result.min;
        solved++;
    } else {
        process.stdout.write(`tiempo agotado  (${ms}ms) — omitido\n`);
        if (!('minMoves' in data)) data.minMoves = null;
        skipped++;
    }

    fs.writeFileSync(fpath, JSON.stringify(data, null, 2) + '\n');
}

console.log(`\nResultado: ${solved} resueltos, ${skipped} omitidos de ${files.length} niveles`);
