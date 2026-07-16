// js/shunting/state.js — Modo Maniobras: constantes, lógica y estado del juego

import { app } from '../core/app.js';
import { particles } from '../core/particles.js';
import { ScoreManager, computeShuntingScore } from '../core/scores.js';
import { fetchGlobalLeaderboard } from '../core/firebase.js';

// ─────────────────────────── CONFIG ────────────────────────────

export const CONFIG = {
    DEFAULT_WIDTH:  1024,
    DEFAULT_HEIGHT: 768,
    TRACK_WIDTH:    600,
    TRACK_SPACING:  80,
    CAR_WIDTH:      60,
    CAR_HEIGHT:     40,
    CAR_SPACING:    5,
    HUD_HEIGHT:     100,
    PEINE_X:        30,
};

// Returns effective car width and gap so all cars fit within TRACK_WIDTH.
// When capacity is small enough, defaults are used unchanged.
export function getCarDims(capacity) {
    const gap  = CONFIG.CAR_SPACING;
    const maxW = CONFIG.CAR_WIDTH;
    if (capacity <= 0) return { w: maxW, gap };
    const fitW = Math.floor((CONFIG.TRACK_WIDTH - (capacity - 1) * gap) / capacity);
    return { w: Math.min(maxW, fitW), gap };
}

export const CAR_TYPES = [
    { name: 'Boxcar',    lo: '#7a2e0a', hi: '#c04020', ac: '#4a1806', roof: '#2e1004'   },
    { name: 'Hopper',    lo: '#1e2d42', hi: '#324e70', ac: '#121c2a', rim:  '#506080'   },
    { name: 'Gondola',   lo: '#1a3018', hi: '#2a5028', ac: '#0e1c0c', rim:  '#487045'   },
    { name: 'Tanker',    lo: '#262626', hi: '#545454', ac: '#909090', band: '#1a1a1a'   },
    { name: 'Container', lo: '#0e3060', hi: '#1858b8', ac: '#07183a', stripe:'#e8c000' },
];

// ─────────────────────── ANIMATION HELPERS ─────────────────────

export function easeInOut(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

export function buildWaypoints(startX, srcY, endX, dstY) {
    const convX   = CONFIG.PEINE_X + 30;
    const fanEndX = (CONFIG.DEFAULT_WIDTH - CONFIG.TRACK_WIDTH) / 2 - 70;
    const dir = dstY > srcY ? 1 : -1;
    return [
        { x: startX,  y: srcY,       t: 0.00 },
        { x: fanEndX, y: srcY,       t: 0.20 },
        { x: convX,   y: srcY+dir*4, t: 0.38 },
        { x: convX,   y: dstY-dir*4, t: 0.62 },
        { x: fanEndX, y: dstY,       t: 0.80 },
        { x: endX,    y: dstY,       t: 1.00 },
    ];
}

// Mirror of buildWaypoints but using the RIGHT peine
export function buildWaypointsRight(startX, srcY, endX, dstY) {
    const convX   = CONFIG.DEFAULT_WIDTH - (CONFIG.PEINE_X + 30); // ~964
    const fanEndX = (CONFIG.DEFAULT_WIDTH + CONFIG.TRACK_WIDTH) / 2 + 70; // ~882
    const dir     = dstY > srcY ? 1 : -1;
    return [
        { x: startX,  y: srcY,       t: 0.00 },
        { x: fanEndX, y: srcY,       t: 0.20 },
        { x: convX,   y: srcY+dir*4, t: 0.38 },
        { x: convX,   y: dstY-dir*4, t: 0.62 },
        { x: fanEndX, y: dstY,       t: 0.80 },
        { x: endX,    y: dstY,       t: 1.00 },
    ];
}

// ──────────────────────── ANIMATION MANAGER ────────────────────

export class AnimationManager {
    constructor() {
        this.isActive      = false;
        this.progress      = 0;
        this.duration      = 0.65;
        this.cars          = [];
        this.locoWaypoints = null;
        this.srcLocoTrack  = -1;
        this.dstTrackIdx   = -1;
        this.numMovingCars = 0;
        this.callback      = null;
        this.isRight       = false;
    }

    start(cars, locoWaypoints, srcLocoTrack, dstTrackIdx, numMoving, distFactor, cb, isRight = false) {
        this.cars          = cars;
        this.locoWaypoints = locoWaypoints;
        this.srcLocoTrack  = srcLocoTrack;
        this.dstTrackIdx   = dstTrackIdx;
        this.numMovingCars = numMoving;
        this.duration      = 0.38 + 0.45 * distFactor;
        this.progress      = 0;
        this.isActive      = true;
        this.callback      = cb;
        this.isRight       = isRight;
    }

    update(dt) {
        if (!this.isActive) return;
        const stagger     = 0.10;
        const totalNeeded = 1 + stagger * this.numMovingCars;
        this.progress += dt / this.duration;
        if (this.progress >= totalNeeded) {
            this.progress = totalNeeded;
            this.isActive = false;
            this.callback?.();
        }
    }

    getPosAt(waypoints, t) {
        for (let i = 0; i < waypoints.length-1; i++) {
            const a = waypoints[i], b = waypoints[i+1];
            if (t <= b.t) {
                const lt = (t - a.t) / (b.t - a.t);
                const e  = easeInOut(lt);
                return { x: a.x+(b.x-a.x)*e, y: a.y+(b.y-a.y)*e };
            }
        }
        const last = waypoints[waypoints.length-1];
        return { x: last.x, y: last.y };
    }

    isHidden(trackIdx, carJ) { return false; }

    // side: 'left' | 'right'
    isLocoHidden(trackIdx, side = 'left') {
        if (!this.isActive) return false;
        if (this.isRight !== (side === 'right')) return false;
        return trackIdx === this.srcLocoTrack || trackIdx === this.dstTrackIdx;
    }

    // Returns current animation positions for the renderer to draw.
    getAnimState() {
        if (!this.isActive) return null;
        const stagger = 0.10;
        const locoPos = this.locoWaypoints
            ? this.getPosAt(this.locoWaypoints, Math.min(1, this.progress))
            : null;
        const cars = this.cars.map((car, i) => {
            const carT = Math.min(1, Math.max(0, this.progress - (i + 1) * stagger));
            return { label: car.label, pos: this.getPosAt(car.waypoints, carT) };
        });
        return { locoPos, cars };
    }
}

// ──────────────────────── SCORES ────────────────────────────────

class ShuntingScores extends ScoreManager {
    getStars(levelId, minMoves, carCount) {
        const best = this.getBest(levelId); if (!best) return 0;
        if (minMoves != null) {
            if (best.moves <= minMoves)                       return 3;
            if (best.moves <= Math.ceil(minMoves * 1.5))      return 2;
            return 1;
        }
        // Fallback cuando minMoves no está disponible
        const n = Math.max(carCount || 2, 2);
        if (best.moves <= n+1)   return 3;
        if (best.moves <= n*2+1) return 2;
        return 1;
    }
}

// ──────────────────────── GAME STATE ───────────────────────────

export class GameState {
    constructor() {
        this.state        = 'MENU';
        this.levels       = {};
        this.scores       = new ShuntingScores({
            storageKey:  'train_scores_v2',
            fbDocPrefix: 'level_',
            legacyKey:   'train_shunting_scores',
        });
        this.levelNum     = 1;
        this.tracks       = [];
        this.target       = [];
        this.description  = '';
        this.capacity     = 8;

        this.locoTrack    = -1;
        this.selectedCars = new Set();

        this.moves        = 0;
        this.startTime    = 0;
        this.elapsedTime  = 0;
        this.won          = false;
        this.newRecord    = false;
        this.lastRank     = 0;
        this.message      = '';
        this.messageTimer = 0;

        this.history      = [];

        // Right locomotive and move limit (loaded from level data)
        this.hasRightLoco      = false;
        this.rightLocoTrack    = -1;
        this.rightSelectedCars = new Set();
        this.locoLimit         = Infinity; // max cars per loco move (Infinity = unlimited)

        this.scrollY      = 0;  this.scrollVel   = 0;  this.maxScroll   = 0;
        this.lbScrollY    = 0;  this.lbScrollVel = 0;  this.lbMaxScroll = 0;
        this.winSpawned   = false;
        this._dirty       = false; // signals renderer to redraw (e.g. levels loaded)

        // Tutorial: -1=off, 0=welcome modal, 1=objective modal,
        //           2=hint:place loco, 3=hint:select car, 4=hint:move
        this.tutModal     = -1;

        this.globalLeaderboard  = {}; // levelId -> [{name, moves, time, date}]
        this.globalLbLoading    = false;
        this.winLbLoading       = false;

        this.loadLevels();
    }

    async loadLevels() {
        for (let i = 1; i <= 100; i++) {
            try {
                const num = String(i).padStart(2, '0');
                const res = await fetch(`levels/shunting/level_${num}.json?v=${Date.now()}`);
                if (res.ok) {
                    const d = await res.json();
                    this.levels[d.id] = d;
                    this._dirty = true; // notify renderer that menu needs a redraw
                }
            } catch(e) { /* not found */ }
        }
    }

    startLevel(num) {
        if (!this.levels[num]) return;
        const data = this.levels[num];
        this.levelNum     = num;
        this.tracks       = JSON.parse(JSON.stringify(data.tracks));
        this.target       = [...data.targetSequence];
        this.description  = data.description || '';
        this.capacity     = data.capacity || 8;
        this.locoTrack         = -1;
        this.selectedCars.clear();
        this.rightLocoTrack    = -1;
        this.rightSelectedCars.clear();
        this.hasRightLoco      = !!(data.rightLoco);
        this.locoLimit         = data.locoLimit || Infinity;
        this.minMoves     = data.minMoves ?? null;
        this.moves        = 0;
        this.startTime    = Date.now();
        this.elapsedTime  = 0;
        this.won          = false;
        this.newRecord    = false;
        this.lastRank     = 0;
        this.message      = '';
        this.messageTimer = 0;
        this.winSpawned   = false;
        this.history      = [];
        particles.p.length = 0;
        this.state = 'PLAYING';

        if (num === 1 && !localStorage.getItem('train_tutorial_done')) {
            this.tutModal = 0;
        }
    }

    advanceTutModal() {
        // 0→1→2 (caps at 2; steps 3/4 are advanced directly in input.js)
        this.tutModal = Math.min(this.tutModal + 1, 2);
    }

    skipTutorial() {
        this.tutModal = -1;
        localStorage.setItem('train_tutorial_done', '1');
    }

    pushHistory() {
        this.history.push({
            tracks:         JSON.parse(JSON.stringify(this.tracks)),
            locoTrack:      this.locoTrack,
            rightLocoTrack: this.rightLocoTrack,
            moves:          this.moves,
        });
        if (this.history.length > 40) this.history.shift();
    }

    undo() {
        if (this.history.length === 0 || this.won || anim.isActive) return;
        const s = this.history.pop();
        this.tracks         = s.tracks;
        this.locoTrack      = s.locoTrack;
        this.rightLocoTrack = s.rightLocoTrack ?? -1;
        this.selectedCars.clear();
        this.rightSelectedCars.clear();
        this.moves     = s.moves;
        this.message   = 'Movimiento deshecho';
        this.messageTimer = 100;
    }

    updateTimer() {
        if (this.state === 'PLAYING' && !this.won)
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

    checkWin() {
        for (const track of this.tracks) {
            const cars = track.filter(c => c !== '');
            if (cars.length === this.target.length && cars.every((v, i) => v === this.target[i])) {
                this.won   = true;
                this.state = 'WON';
                this.handleScore();
                return true;
            }
        }
        return false;
    }

    handleScore() {
        const score = computeShuntingScore(this.moves, this.elapsedTime, this.minMoves, this.target.length);
        const rank  = this.scores.addScore(this.levelNum, {
            moves: this.moves,
            time:  this.elapsedTime,
            score,
            name:  app.playerName,
        });
        this.lastRank  = rank;
        this.newRecord = (rank === 1);
        delete this.globalLeaderboard[this.levelNum];
        // Fetch fresh global leaderboard for win screen display
        this.winLbLoading = true;
        this._dirty = true;
        const lid = this.levelNum;
        fetchGlobalLeaderboard(`level_${lid}`, 10).then(entries => {
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
            const entries = await fetchGlobalLeaderboard(`level_${id}`, 10);
            if (entries.length) this.globalLeaderboard[id] = entries;
        }));
        this.globalLbLoading = false;
        this._dirty = true;
    }

    positionLocomotive(trackIdx) {
        if (this.won || anim.isActive) return;
        // Block if right loco already occupies this track
        if (this.hasRightLoco && this.rightLocoTrack === trackIdx) return;
        const isFirst = (this.locoTrack === -1);
        const isSame  = (this.locoTrack === trackIdx);

        if (!isFirst && !isSame) {
            this.pushHistory(); this.moves++;
            const trackSX   = (CONFIG.DEFAULT_WIDTH - CONFIG.TRACK_WIDTH) / 2;
            const trackSY   = CONFIG.HUD_HEIGHT;
            const srcY      = trackSY + this.locoTrack * CONFIG.TRACK_SPACING;
            const dstY      = trackSY + trackIdx       * CONFIG.TRACK_SPACING;
            const dist      = Math.abs(trackIdx - this.locoTrack) / Math.max(this.tracks.length - 1, 1);
            const locoX     = trackSX - 62;
            const prevTrack = this.locoTrack;
            this.locoTrack  = trackIdx;
            this.selectedCars.clear();
            anim.start([], buildWaypoints(locoX, srcY, locoX, dstY), prevTrack, trackIdx, 0, dist, () => {
                const track = this.tracks[trackIdx];
                for (let i = 0; i < track.length; i++) {
                    if (track[i] !== '') this.selectedCars.add(`${trackIdx},${i}`); else break;
                }
            });
            return;
        }

        // First placement or same track — instant, no cost
        this.locoTrack = trackIdx;
        this.selectedCars.clear();
        const track = this.tracks[trackIdx];
        for (let i = 0; i < track.length; i++) {
            if (track[i] !== '') this.selectedCars.add(`${trackIdx},${i}`);
            else break;
        }
    }

    selectCar(trackIdx, carIdx) {
        if (this.won || anim.isActive) return;
        if (this.locoTrack !== trackIdx) return;
        const track = this.tracks[trackIdx];
        const sel = [];
        for (let i = 0; i < track.length; i++) { if (track[i] !== '') sel.push(i); else break; }
        if (!sel.includes(carIdx)) return;
        this.selectedCars.clear();
        for (const i of sel) { if (i <= carIdx) this.selectedCars.add(`${trackIdx},${i}`); }
    }

    moveSelected(targetTrackIdx) {
        if (this.won || anim.isActive) return;
        if (this.locoTrack === -1 || this.selectedCars.size === 0) return;
        if (targetTrackIdx === this.locoTrack) return;
        // Block moving into a track already occupied by the right loco
        if (this.hasRightLoco && this.rightLocoTrack === targetTrackIdx) {
            this.message = '¡Vía ocupada por la otra locomotora!';
            this.messageTimer = 120;
            return;
        }

        const srcIdx = this.locoTrack;
        const list   = Array.from(this.selectedCars)
            .map(s => { const [t, c] = s.split(',').map(Number); return { t, c }; })
            .sort((a, b) => a.c - b.c);

        if (isFinite(this.locoLimit) && list.length > this.locoLimit) {
            this.message      = `¡Límite! Máx. ${this.locoLimit} vagón${this.locoLimit > 1 ? 'es' : ''} por maniobra.`;
            this.messageTimer = 120;
            return;
        }

        const destCars = this.tracks[targetTrackIdx].filter(c => c !== '');
        if (destCars.length + list.length > this.capacity) {
            this.message      = '¡Vía llena! No caben más vagones.';
            this.messageTimer = 120;
            return;
        }

        this.pushHistory();

        const trackSX = (CONFIG.DEFAULT_WIDTH - CONFIG.TRACK_WIDTH) / 2;
        const trackSY = CONFIG.HUD_HEIGHT;
        const srcY    = trackSY + srcIdx         * CONFIG.TRACK_SPACING;
        const dstY    = trackSY + targetTrackIdx * CONFIG.TRACK_SPACING;
        const dist    = Math.abs(targetTrackIdx - srcIdx) / Math.max(this.tracks.length - 1, 1);
        const { w: carW, gap: carGap } = getCarDims(this.capacity);

        const animCars = list.map(item => {
            const label = this.tracks[srcIdx][item.c];
            const carX  = trackSX + item.c * (carW + carGap);
            return { label, waypoints: buildWaypoints(carX, srcY, carX, dstY) };
        });

        const locoX        = trackSX - 62;
        const locoWaypoints = buildWaypoints(locoX, srcY, locoX, dstY);

        const moving = list.map(item => this.tracks[srcIdx][item.c]);
        list.forEach(item => { this.tracks[srcIdx][item.c] = ''; });
        this.tracks[srcIdx] = this.tracks[srcIdx].filter(c => c !== '');
        while (this.tracks[srcIdx].length < this.capacity) this.tracks[srcIdx].push('');

        this.moves++;
        const prevLocoTrack = srcIdx;
        this.locoTrack      = targetTrackIdx;
        this.selectedCars.clear();

        anim.start(animCars, locoWaypoints, prevLocoTrack, targetTrackIdx, list.length, dist, () => {
            this.tracks[targetTrackIdx] = [...moving, ...destCars];
            while (this.tracks[targetTrackIdx].length < this.capacity) this.tracks[targetTrackIdx].push('');
            this.checkWin();
        });
    }

    // ── Right Locomotive ──────────────────────────────────────────

    positionLocomotiveRight(trackIdx) {
        if (this.won || anim.isActive || !this.hasRightLoco) return;
        // Block if left loco already occupies this track
        if (this.locoTrack === trackIdx) return;
        const isFirst = (this.rightLocoTrack === -1);
        const isSame  = (this.rightLocoTrack === trackIdx);
        // Deactivate left loco — only one side active at a time
        this.locoTrack = -1; this.selectedCars.clear();

        if (!isFirst && !isSame) {
            this.pushHistory(); this.moves++;
            const trackSX      = (CONFIG.DEFAULT_WIDTH - CONFIG.TRACK_WIDTH) / 2;
            const trackSY      = CONFIG.HUD_HEIGHT;
            const srcY         = trackSY + this.rightLocoTrack * CONFIG.TRACK_SPACING;
            const dstY         = trackSY + trackIdx            * CONFIG.TRACK_SPACING;
            const dist         = Math.abs(trackIdx - this.rightLocoTrack) / Math.max(this.tracks.length - 1, 1);
            const rightLocoX   = trackSX + CONFIG.TRACK_WIDTH + 10;
            const prevTrack    = this.rightLocoTrack;
            this.rightLocoTrack = trackIdx;
            this.rightSelectedCars.clear();
            anim.start([], buildWaypointsRight(rightLocoX, srcY, rightLocoX, dstY), prevTrack, trackIdx, 0, dist, () => {
                const track = this.tracks[trackIdx];
                for (let i = 0; i < track.length; i++) {
                    if (track[i] !== '') this.rightSelectedCars.add(`${trackIdx},${i}`);
                }
            }, true);
            return;
        }

        // First placement or same track — instant, no cost
        this.rightLocoTrack = trackIdx;
        this.rightSelectedCars.clear();
        const track = this.tracks[trackIdx];
        for (let i = 0; i < track.length; i++) {
            if (track[i] !== '') this.rightSelectedCars.add(`${trackIdx},${i}`);
        }
    }

    selectCarRight(trackIdx, carIdx) {
        if (this.won || anim.isActive || !this.hasRightLoco) return;
        if (this.rightLocoTrack !== trackIdx) return;
        const track = this.tracks[trackIdx];
        const cars  = [];
        for (let i = 0; i < track.length; i++) { if (track[i] !== '') cars.push(i); }
        if (!cars.includes(carIdx)) return;
        this.rightSelectedCars.clear();
        for (const i of cars) { if (i >= carIdx) this.rightSelectedCars.add(`${trackIdx},${i}`); }
    }

    moveSelectedRight(targetTrackIdx) {
        if (this.won || anim.isActive) return;
        if (this.rightLocoTrack === -1 || this.rightSelectedCars.size === 0) return;
        if (targetTrackIdx === this.rightLocoTrack) return;
        // Block moving into a track already occupied by the left loco
        if (this.locoTrack === targetTrackIdx) {
            this.message = '¡Vía ocupada por la otra locomotora!';
            this.messageTimer = 120;
            return;
        }

        const srcIdx = this.rightLocoTrack;
        const list   = Array.from(this.rightSelectedCars)
            .map(s => { const [t,c] = s.split(',').map(Number); return {t,c}; })
            .sort((a,b) => a.c - b.c);

        if (isFinite(this.locoLimit) && list.length > this.locoLimit) {
            this.message      = `¡Límite! Máx. ${this.locoLimit} vagón${this.locoLimit > 1 ? 'es' : ''} por maniobra.`;
            this.messageTimer = 120;
            return;
        }

        const destCars = this.tracks[targetTrackIdx].filter(c => c !== '');
        if (destCars.length + list.length > this.capacity) {
            this.message      = '¡Vía llena! No caben más vagones.';
            this.messageTimer = 120;
            return;
        }

        this.pushHistory();

        const trackSX     = (CONFIG.DEFAULT_WIDTH - CONFIG.TRACK_WIDTH) / 2;
        const trackSY     = CONFIG.HUD_HEIGHT;
        const srcY        = trackSY + srcIdx         * CONFIG.TRACK_SPACING;
        const dstY        = trackSY + targetTrackIdx * CONFIG.TRACK_SPACING;
        const dist        = Math.abs(targetTrackIdx - srcIdx) / Math.max(this.tracks.length - 1, 1);
        const rightLocoX  = trackSX + CONFIG.TRACK_WIDTH + 10;
        const { w: carW, gap: carGap } = getCarDims(this.capacity);

        const animCars = list.map(item => {
            const label = this.tracks[srcIdx][item.c];
            const carX  = trackSX + item.c * (carW + carGap);
            return { label, waypoints: buildWaypointsRight(carX, srcY, carX, dstY) };
        });
        const locoWaypoints = buildWaypointsRight(rightLocoX, srcY, rightLocoX, dstY);

        const moving = list.map(item => this.tracks[srcIdx][item.c]);
        list.forEach(item => { this.tracks[srcIdx][item.c] = ''; });
        this.tracks[srcIdx] = this.tracks[srcIdx].filter(c => c !== '');
        while (this.tracks[srcIdx].length < this.capacity) this.tracks[srcIdx].push('');

        this.moves++;
        const prevRight      = srcIdx;
        this.rightLocoTrack  = targetTrackIdx;
        this.rightSelectedCars.clear();

        // Right loco deposits at RIGHT end (after existing cars)
        anim.start(animCars, locoWaypoints, prevRight, targetTrackIdx, list.length, dist, () => {
            this.tracks[targetTrackIdx] = [...destCars, ...moving];
            while (this.tracks[targetTrackIdx].length < this.capacity) this.tracks[targetTrackIdx].push('');
            this.checkWin();
        }, true); // isRight = true
    }
}

// ─────────────────────── SINGLETONS ────────────────────────────

export const anim = new AnimationManager();
export const game = new GameState();
