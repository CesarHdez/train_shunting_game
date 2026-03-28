// js/state.js — Game constants, logic, and data classes

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

export const C = {
    BG_TOP:        '#0d1117',  BG_BOT:     '#1a1f2e',
    GRID:          'rgba(255,255,255,0.025)',
    BALLAST:       '#252535',  SLEEPER_A:  '#5d3f2a',  SLEEPER_B: '#4a3322',
    RAIL_HI:       '#c8d0da',  RAIL_LO:    '#606870',
    CAR_GLOW:      '#4fc3f7',
    LOCO_RED:      '#c62828',  LOCO_RED2:  '#ef5350',
    LOCO_GREY:     '#37474f',  LOCO_GREY2: '#546e7a',
    TEXT:          '#e8eaf6',  TEXT_DIM:   '#7986cb',  TEXT_WARN: '#ff5252',
    GOLD:          '#ffd700',  SILVER:     '#b0bec5',  BRONZE:    '#a1887f',
    SUCCESS:       '#69f0ae',  RECORD:     '#ffd700',
    STAR_ON:       '#ffd700',  STAR_OFF:   '#37474f',
    HEADER_BG:     'rgba(8,12,24,0.94)',  TARGET_BG: 'rgba(5,8,18,0.88)',
    MENU_BG:       '#080c16',  CARD:       '#111827',
    WIN_OVERLAY:   'rgba(4,6,16,0.93)',
    MOVE_BTN:      '#1b5e20',  MOVE_BTN2:  '#2e7d32',
    CAPACITY_OK:   '#546e7a',  CAPACITY_FULL: '#c62828',
    PEINE_SPINE:   '#8090a0',  PEINE_NODE: '#c8d0da',
    UNDO_BTN:      '#4a148c',
};

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

// ──────────────────────── PARTICLE SYSTEM ──────────────────────

export class ParticleSystem {
    constructor() { this.p = []; }

    spawnConfetti(cx, cy, count = 160) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.random()-0.5)*Math.PI*2, speed = Math.random()*14+3;
            this.p.push({
                x: cx+(Math.random()-0.5)*300, y: cy+(Math.random()-0.5)*100,
                vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed-7,
                w: Math.random()*9+4, h: Math.random()*5+3,
                color: `hsl(${Math.floor(Math.random()*360)},90%,65%)`,
                rot: Math.random()*Math.PI*2, rotV: (Math.random()-0.5)*0.25,
                life: 1, decay: Math.random()*0.008+0.004
            });
        }
    }

    update() {
        for (let i = this.p.length-1; i >= 0; i--) {
            const p = this.p[i];
            p.x += p.vx; p.y += p.vy;
            p.vy += 0.32; p.vx *= 0.99; p.rot += p.rotV; p.life -= p.decay;
            if (p.life <= 0) this.p.splice(i, 1);
        }
    }

    draw(ctx) {
        for (const p of this.p) {
            ctx.save(); ctx.globalAlpha = Math.min(p.life*2, 1);
            ctx.fillStyle = p.color; ctx.translate(p.x, p.y); ctx.rotate(p.rot);
            ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h); ctx.restore();
        }
        ctx.globalAlpha = 1;
    }
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

// ──────────────────────── SCORE MANAGER ────────────────────────
// Item 1: try/catch around JSON.parse, reset on corruption
// Item 2: djb2 hash + salt to detect tampered entries
// Item 3: uid per entry for reliable "isMe" detection

const HASH_SALT = 'tr4in$hunt1ng_2024';

function _hashEntry(e) {
    const str = `${HASH_SALT}|${e.moves}|${e.time}|${e.name}|${e.date}|${e.uid||''}`;
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
    return (h >>> 0).toString(36);
}

export class ScoreManager {
    constructor() { this.data = {}; this.lastUid = null; this.load(); }

    load() {
        // Try loading v2 format
        try {
            const v2 = localStorage.getItem('train_scores_v2');
            if (v2) {
                const parsed = JSON.parse(v2);
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
            localStorage.removeItem('train_scores_v2');
            this.data = {};
        }
        // Migrate from v1 format
        try {
            const v1 = localStorage.getItem('train_shunting_scores');
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
            localStorage.removeItem('train_shunting_scores');
        }
    }

    save() { localStorage.setItem('train_scores_v2', JSON.stringify(this.data)); }

    addScore(levelId, moves, time, name) {
        const lid = String(levelId);
        if (!this.data[lid]) this.data[lid] = [];
        const uid   = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        const entry = { moves, time, name, date: new Date().toLocaleDateString('es'), uid };
        entry._h    = _hashEntry(entry);
        this.data[lid].push(entry);
        this.data[lid].sort((a, b) => a.moves - b.moves || a.time - b.time);
        this.data[lid] = this.data[lid].slice(0, 5);
        this.save();
        this.lastUid = uid;
        return this.data[lid].findIndex(e => e.uid === uid) + 1;
    }

    getBest(levelId)        { return this.data[String(levelId)]?.[0] || null; }
    getLeaderboard(levelId) { return this.data[String(levelId)] || []; }
    isCompleted(levelId)    { return (this.data[String(levelId)]?.length || 0) > 0; }

    getStars(levelId, carCount) {
        const best = this.getBest(levelId); if (!best) return 0;
        const n = Math.max(carCount, 2);
        if (best.moves <= n+1)   return 3;
        if (best.moves <= n*2+1) return 2;
        return 1;
    }

    completedCount() { return Object.keys(this.data).length; }
}

// ──────────────────────── GAME STATE ───────────────────────────

export class GameState {
    constructor() {
        this.state        = 'MENU';
        this.levels       = {};
        this.scores       = new ScoreManager();
        this.levelNum     = 1;
        this.tracks       = [];
        this.target       = [];
        this.description  = '';
        this.capacity     = 8;
        this.playerName   = '';

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

        this.loadLevels();
        this.setupLogin();
    }

    // Item 12: persist player name across sessions
    setupLogin() {
        const overlay = document.getElementById('login-overlay');
        const input   = document.getElementById('player-name');
        const btn     = document.getElementById('start-btn');

        const saved = localStorage.getItem('train_player_name');
        if (saved) input.value = saved;

        const tryStart = () => {
            const name = input.value.trim();
            if (name) {
                this.playerName = name;
                localStorage.setItem('train_player_name', name);
                overlay.style.transition = 'opacity 0.35s';
                overlay.style.opacity    = '0';
                setTimeout(() => overlay.style.display = 'none', 350);
            } else {
                input.classList.remove('shake');
                void input.offsetWidth;
                input.classList.add('shake');
            }
        };
        btn.addEventListener('click', tryStart);
        input.addEventListener('keypress', e => { if (e.key === 'Enter') tryStart(); });
    }

    async loadLevels() {
        for (let i = 1; i <= 100; i++) {
            try {
                const num = String(i).padStart(2, '0');
                const res = await fetch(`levels/level_${num}.json?v=${Date.now()}`);
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
        const rank = this.scores.addScore(this.levelNum, this.moves, this.elapsedTime, this.playerName);
        this.lastRank  = rank;
        this.newRecord = (rank === 1);
    }

    positionLocomotive(trackIdx) {
        if (this.won || anim.isActive) return;
        const isFirst = (this.locoTrack === -1);
        const isSame  = (this.locoTrack === trackIdx);
        if (!isFirst && !isSame) { this.pushHistory(); this.moves++; }
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

        const animCars = list.map(item => {
            const label = this.tracks[srcIdx][item.c];
            const carX  = trackSX + item.c * (CONFIG.CAR_WIDTH + CONFIG.CAR_SPACING);
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
        const isFirst = (this.rightLocoTrack === -1);
        const isSame  = (this.rightLocoTrack === trackIdx);
        if (!isFirst && !isSame) { this.pushHistory(); this.moves++; }
        this.rightLocoTrack = trackIdx;
        this.rightSelectedCars.clear();
        // Deactivate left loco — only one side active at a time
        this.locoTrack = -1; this.selectedCars.clear();
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

        const animCars = list.map(item => {
            const label = this.tracks[srcIdx][item.c];
            const carX  = trackSX + item.c * (CONFIG.CAR_WIDTH + CONFIG.CAR_SPACING);
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

export const particles = new ParticleSystem();
export const anim      = new AnimationManager();
export const game      = new GameState();
