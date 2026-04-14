// ================================================================
//  PATIO DE TRENES — v3.0
//  + Deshacer (undo)
//  + Peines visuales + animación de movimiento
//  + Posicionar locomotora no cuesta maniobra (excepto vacía)
// ================================================================

// ─────────────────────────── CONFIG ────────────────────────────

const CONFIG = {
    DEFAULT_WIDTH:  1024,
    DEFAULT_HEIGHT: 768,
    TRACK_WIDTH:    600,
    TRACK_SPACING:  80,
    CAR_WIDTH:      60,
    CAR_HEIGHT:     40,
    CAR_SPACING:    5,
    HUD_HEIGHT:     100,
    PEINE_X:        30,   // World X of left peine main line
    // Future: PEINE_RIGHT_X = trackSX + TRACK_WIDTH + 100
};

const C = {
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

const CAR_TYPES = [
    { name: 'Boxcar',    lo: '#7a2e0a', hi: '#c04020', ac: '#4a1806', roof: '#2e1004'   },
    { name: 'Hopper',    lo: '#1e2d42', hi: '#324e70', ac: '#121c2a', rim:  '#506080'   },
    { name: 'Gondola',   lo: '#1a3018', hi: '#2a5028', ac: '#0e1c0c', rim:  '#487045'   },
    { name: 'Tanker',    lo: '#262626', hi: '#545454', ac: '#909090', band: '#b00000'   },
    { name: 'Container', lo: '#0e3060', hi: '#1858b8', ac: '#07183a', stripe:'#e8c000' },
];

// ─────────────────────── ANIMATION HELPERS ─────────────────────

function easeInOut(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

function easeOut(t) { return 1 - (1-t)*(1-t); }

// Cubic bezier helpers for curved peine branches
function cbez(t,p0,p1,p2,p3){ const m=1-t; return m*m*m*p0+3*m*m*t*p1+3*m*t*t*p2+t*t*t*p3; }
function cbezD(t,p0,p1,p2,p3){ const m=1-t; return 3*(m*m*(p1-p0)+2*m*t*(p2-p1)+t*t*(p3-p2)); }

// Build waypoint path through the LEFT peine from (startX,srcY) to (endX,dstY).
// convX = fan convergence (trunk) X. fanEndX = fan right edge X.
// 'side' parameter reserved for future right-peine support.
function buildWaypoints(startX, srcY, endX, dstY, side = 'LEFT') {
    const convX   = CONFIG.PEINE_X + 30;  // 60 — convergence/trunk X
    const fanEndX = (CONFIG.DEFAULT_WIDTH - CONFIG.TRACK_WIDTH) / 2 - 70; // 142
    const dir = dstY > srcY ? 1 : -1;
    return [
        { x: startX,  y: srcY,         t: 0.00 },
        { x: fanEndX, y: srcY,         t: 0.20 },
        { x: convX,   y: srcY+dir*4,   t: 0.38 },
        { x: convX,   y: dstY-dir*4,   t: 0.62 },
        { x: fanEndX, y: dstY,         t: 0.80 },
        { x: endX,    y: dstY,         t: 1.00 },
    ];
}

// ──────────────────────── PARTICLE SYSTEM ──────────────────────

class ParticleSystem {
    constructor() { this.p = []; }
    spawnConfetti(cx, cy, count = 160) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.random()-0.5)*Math.PI*2, speed = Math.random()*14+3;
            this.p.push({ x: cx+(Math.random()-0.5)*300, y: cy+(Math.random()-0.5)*100,
                vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed-7,
                w: Math.random()*9+4, h: Math.random()*5+3,
                color: `hsl(${Math.floor(Math.random()*360)},90%,65%)`,
                rot: Math.random()*Math.PI*2, rotV: (Math.random()-0.5)*0.25,
                life: 1, decay: Math.random()*0.008+0.004 });
        }
    }
    update() {
        for (let i=this.p.length-1; i>=0; i--) {
            const p=this.p[i]; p.x+=p.vx; p.y+=p.vy;
            p.vy+=0.32; p.vx*=0.99; p.rot+=p.rotV; p.life-=p.decay;
            if (p.life<=0) this.p.splice(i,1);
        }
    }
    draw(ctx) {
        for (const p of this.p) {
            ctx.save(); ctx.globalAlpha=Math.min(p.life*2,1);
            ctx.fillStyle=p.color; ctx.translate(p.x,p.y); ctx.rotate(p.rot);
            ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h); ctx.restore();
        }
        ctx.globalAlpha=1;
    }
}
const particles = new ParticleSystem();

// ──────────────────────── ANIMATION MANAGER ────────────────────

class AnimationManager {
    constructor() {
        this.isActive      = false;
        this.progress      = 0;
        this.duration      = 0.65;
        this.cars          = [];        // {label, waypoints[]}
        this.locoWaypoints = null;
        this.srcLocoTrack  = -1;
        this.dstTrackIdx   = -1;
        this.numMovingCars = 0;
        this.callback      = null;
    }

    start(cars, locoWaypoints, srcLocoTrack, dstTrackIdx, numMoving, distFactor, cb) {
        this.cars          = cars;
        this.locoWaypoints = locoWaypoints;
        this.srcLocoTrack  = srcLocoTrack;
        this.dstTrackIdx   = dstTrackIdx;
        this.numMovingCars = numMoving;
        this.duration      = 0.38 + 0.45 * distFactor; // faster for nearby tracks
        this.progress      = 0;
        this.isActive      = true;
        this.callback      = cb;
    }

    update(dt) {
        if (!this.isActive) return;
        const stagger    = 0.10;
        const totalNeeded = 1 + stagger * this.numMovingCars; // loco + N cars staggered
        this.progress += dt / this.duration;
        if (this.progress >= totalNeeded) {
            this.progress = totalNeeded;
            this.isActive = false;
            this.callback?.();
        }
    }

    // Interpolate waypoints at a specific t value (0–1).
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

    getPos(waypoints) { return this.getPosAt(waypoints, Math.min(1, this.progress)); }

    // Destination state is deferred to animation end — nothing to pre-hide.
    isHidden(trackIdx, carJ) { return false; }

    // Should the loco button be hidden at trackIdx?
    isLocoHidden(trackIdx) {
        return this.isActive &&
               (trackIdx === this.srcLocoTrack || trackIdx === this.dstTrackIdx);
    }

    draw(ctx) {
        if (!this.isActive) return;
        const stagger = 0.10;

        // Loco leads — no stagger offset
        if (this.locoWaypoints) {
            const locoT = Math.min(1, this.progress);
            const lp = this.getPosAt(this.locoWaypoints, locoT);
            drawLocoButton(lp.x, lp.y, 52, CONFIG.CAR_HEIGHT-4, true);
        }

        // Cars follow with stagger: car[0] (closest to peine) enters first
        for (let i = 0; i < this.cars.length; i++) {
            const car  = this.cars[i];
            const carT = Math.min(1, Math.max(0, this.progress - (i + 1) * stagger));
            const pos  = this.getPosAt(car.waypoints, carT);
            drawCar(pos.x, pos.y, car.label, false);
        }
    }
}
const anim = new AnimationManager();

// ──────────────────────── SCORE MANAGER ────────────────────────

class ScoreManager {
    constructor() { this.data = {}; this.load(); }
    load() {
        const v2 = localStorage.getItem('train_scores_v2');
        if (v2) { this.data = JSON.parse(v2); return; }
        const v1 = localStorage.getItem('train_shunting_scores');
        if (v1) {
            const old = JSON.parse(v1);
            for (const [lid, s] of Object.entries(old)) {
                this.data[lid] = [{ moves:s.moves, time:s.time, name:s.name||'Anon',
                    date: new Date().toLocaleDateString('es') }];
            }
            this.save();
        }
    }
    save() { localStorage.setItem('train_scores_v2', JSON.stringify(this.data)); }
    addScore(levelId, moves, time, name) {
        const lid = String(levelId);
        if (!this.data[lid]) this.data[lid] = [];
        const entry = { moves, time, name, date: new Date().toLocaleDateString('es') };
        this.data[lid].push(entry);
        this.data[lid].sort((a,b) => a.moves-b.moves || a.time-b.time);
        this.data[lid] = this.data[lid].slice(0,5);
        this.save();
        return this.data[lid].findIndex(e => e.moves===moves && e.time===time && e.name===name)+1;
    }
    getBest(levelId)       { return this.data[String(levelId)]?.[0] || null; }
    getLeaderboard(levelId){ return this.data[String(levelId)] || []; }
    isCompleted(levelId)   { return (this.data[String(levelId)]?.length||0) > 0; }
    getStars(levelId, carCount) {
        const best = this.getBest(levelId); if (!best) return 0;
        const n = Math.max(carCount,2);
        if (best.moves <= n+1)     return 3;
        if (best.moves <= n*2+1)   return 2;
        return 1;
    }
    completedCount() { return Object.keys(this.data).length; }
}

// ──────────────────────── GAME STATE ───────────────────────────

class GameState {
    constructor() {
        this.state       = 'MENU';
        this.levels      = {};
        this.scores      = new ScoreManager();
        this.levelNum    = 1;
        this.tracks      = [];
        this.target      = [];
        this.description = '';
        this.capacity    = 8;
        this.playerName  = '';

        this.locoTrack    = -1;
        this.selectedCars = new Set();

        this.moves       = 0;
        this.startTime   = 0;
        this.elapsedTime = 0;
        this.won         = false;
        this.newRecord   = false;
        this.lastRank    = 0;
        this.message     = '';
        this.messageTimer = 0;

        this.history     = [];  // Undo stack

        this.scrollY     = 0;   this.scrollVel  = 0;  this.maxScroll   = 0;
        this.lbScrollY   = 0;   this.lbScrollVel = 0; this.lbMaxScroll = 0;
        this.winSpawned  = false;

        this.loadLevels();
        this.setupLogin();
    }

    setupLogin() {
        const overlay = document.getElementById('login-overlay');
        const input   = document.getElementById('player-name');
        const btn     = document.getElementById('start-btn');
        const tryStart = () => {
            const name = input.value.trim();
            if (name) {
                this.playerName = name;
                overlay.style.transition = 'opacity 0.35s';
                overlay.style.opacity = '0';
                setTimeout(() => overlay.style.display='none', 350);
            } else {
                input.classList.remove('shake');
                void input.offsetWidth;
                input.classList.add('shake');
            }
        };
        btn.addEventListener('click', tryStart);
        input.addEventListener('keypress', e => { if (e.key==='Enter') tryStart(); });
    }

    async loadLevels() {
        for (let i=1; i<=30; i++) {
            try {
                const num = String(i).padStart(2,'0');
                const res = await fetch(`levels/level_${num}.json?v=${Date.now()}`);
                if (res.ok) { const d = await res.json(); this.levels[d.id] = d; }
            } catch(e) { /* not found */ }
        }
    }

    startLevel(num) {
        if (!this.levels[num]) return;
        const data = this.levels[num];
        this.levelNum    = num;
        this.tracks      = JSON.parse(JSON.stringify(data.tracks));
        this.target      = [...data.targetSequence];
        this.description = data.description || '';
        this.capacity    = data.capacity || 8;
        this.locoTrack   = -1;
        this.selectedCars.clear();
        this.moves       = 0;
        this.startTime   = Date.now();
        this.elapsedTime = 0;
        this.won         = false;
        this.newRecord   = false;
        this.lastRank    = 0;
        this.message     = '';
        this.messageTimer = 0;
        this.winSpawned  = false;
        this.history     = [];
        particles.p.length = 0;
        this.state = 'PLAYING';
    }

    // ── Undo ──────────────────────────────────────────────────
    pushHistory() {
        this.history.push({
            tracks:    JSON.parse(JSON.stringify(this.tracks)),
            locoTrack: this.locoTrack,
            moves:     this.moves,
        });
        if (this.history.length > 40) this.history.shift();
    }

    undo() {
        if (this.history.length === 0 || this.won || anim.isActive) return;
        const s = this.history.pop();
        this.tracks    = s.tracks;
        this.locoTrack = s.locoTrack;
        this.selectedCars.clear();
        this.moves     = s.moves;
        this.message   = 'Movimiento deshecho';
        this.messageTimer = 100;
    }

    // ── Timer ─────────────────────────────────────────────────
    updateTimer() {
        if (this.state==='PLAYING' && !this.won)
            this.elapsedTime = Math.floor((Date.now()-this.startTime)/1000);
        if (this.messageTimer > 0) { this.messageTimer--; if (!this.messageTimer) this.message=''; }
        this.scrollVel  *= 0.88; this.scrollY  += this.scrollVel;
        if (this.scrollY  > 0)              { this.scrollY=0;  this.scrollVel=0; }
        if (this.scrollY  < -this.maxScroll) { this.scrollY=-this.maxScroll;  this.scrollVel=0; }
        this.lbScrollVel *= 0.88; this.lbScrollY += this.lbScrollVel;
        if (this.lbScrollY > 0)               { this.lbScrollY=0;  this.lbScrollVel=0; }
        if (this.lbScrollY < -this.lbMaxScroll){ this.lbScrollY=-this.lbMaxScroll; this.lbScrollVel=0; }
    }

    getTimeStr() {
        const m=Math.floor(this.elapsedTime/60), s=this.elapsedTime%60;
        return `${m}:${String(s).padStart(2,'0')}`;
    }

    checkWin() {
        for (const track of this.tracks) {
            const cars = track.filter(c=>c!=='');
            if (cars.length===this.target.length && cars.every((v,i)=>v===this.target[i])) {
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
        this.newRecord = (rank===1);
    }

    // ── Locomotive ────────────────────────────────────────────
    // Costs a move ONLY when moving an empty loco between different tracks.
    // First placement (locoTrack === -1) and re-clicking same track are FREE.
    positionLocomotive(trackIdx) {
        if (this.won || anim.isActive) return;
        const isFirst  = (this.locoTrack === -1);
        const isSame   = (this.locoTrack === trackIdx);

        if (!isFirst && !isSame) {
            // Moving empty loco to a different track — costs a move
            this.pushHistory();
            this.moves++;
        }

        this.locoTrack = trackIdx;
        this.selectedCars.clear();

        const track = this.tracks[trackIdx];
        for (let i=0; i<track.length; i++) {
            if (track[i]!=='') this.selectedCars.add(`${trackIdx},${i}`);
            else break;
        }
    }

    selectCar(trackIdx, carIdx) {
        if (this.won || anim.isActive) return;
        if (this.locoTrack !== trackIdx) return;
        const track = this.tracks[trackIdx];
        let sel = [];
        for (let i=0; i<track.length; i++) { if (track[i]!=='') sel.push(i); else break; }
        if (!sel.includes(carIdx)) return;
        this.selectedCars.clear();
        for (const i of sel) { if (i<=carIdx) this.selectedCars.add(`${trackIdx},${i}`); }
    }

    // ── Move (triggers animation) ─────────────────────────────
    moveSelected(targetTrackIdx) {
        if (this.won || anim.isActive) return;
        if (this.locoTrack===-1 || this.selectedCars.size===0) return;
        if (targetTrackIdx === this.locoTrack) return;

        const srcIdx = this.locoTrack;
        let list = Array.from(this.selectedCars)
            .map(s=>{ const [t,c]=s.split(',').map(Number); return{t,c}; })
            .sort((a,b)=>a.c-b.c);

        const destCars = this.tracks[targetTrackIdx].filter(c=>c!=='');
        if (destCars.length + list.length > this.capacity) {
            this.message      = '¡Vía llena! No caben más vagones.';
            this.messageTimer = 120;
            return;
        }

        // Save undo snapshot BEFORE modifying
        this.pushHistory();

        // Calculate world positions for animation
        const trackSX = (CONFIG.DEFAULT_WIDTH - CONFIG.TRACK_WIDTH) / 2;
        const trackSY = CONFIG.HUD_HEIGHT;
        const srcY    = trackSY + srcIdx     * CONFIG.TRACK_SPACING;
        const dstY    = trackSY + targetTrackIdx * CONFIG.TRACK_SPACING;
        const dist    = Math.abs(targetTrackIdx - srcIdx) / Math.max(this.tracks.length-1, 1);

        // Build car animations
        const animCars = list.map(item => {
            const label  = this.tracks[srcIdx][item.c];
            const carX   = trackSX + item.c * (CONFIG.CAR_WIDTH + CONFIG.CAR_SPACING);
            return { label, waypoints: buildWaypoints(carX, srcY, carX, dstY) };
        });

        // Loco travels with first car (offset to loco button position)
        const locoX        = trackSX - 62;
        const locoWaypoints = buildWaypoints(locoX, srcY, locoX, dstY);

        // ── Source track: remove moving cars immediately (loco picks them up) ──
        const moving = list.map(item => this.tracks[srcIdx][item.c]);
        list.forEach(item => { this.tracks[srcIdx][item.c] = ''; });

        this.tracks[srcIdx] = this.tracks[srcIdx].filter(c=>c!=='');
        while (this.tracks[srcIdx].length < this.capacity) this.tracks[srcIdx].push('');

        // Destination track stays unchanged during animation — updated in callback
        // so destination cars only shift when the animated cars actually arrive.

        this.moves++;
        const prevLocoTrack = srcIdx;
        this.locoTrack      = targetTrackIdx;
        this.selectedCars.clear();

        // ── Start animation — apply destination state at completion ──
        anim.start(animCars, locoWaypoints, prevLocoTrack, targetTrackIdx, list.length, dist, () => {
            this.tracks[targetTrackIdx] = [...moving, ...destCars];
            while (this.tracks[targetTrackIdx].length < this.capacity) this.tracks[targetTrackIdx].push('');
            this.checkWin();
        });
    }
}

// ─────────────────────────── CANVAS ────────────────────────────

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const game   = new GameState();
const camera = { x:0, y:0, zoom:1, isDragging:false, lastX:0, lastY:0 };
let animTime = 0;

function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const scaleX  = canvas.width  / CONFIG.DEFAULT_WIDTH;
    const scaleY  = canvas.height / CONFIG.DEFAULT_HEIGHT;
    camera.zoom   = Math.min(scaleX, scaleY, 1);
    camera.x = Math.round((canvas.width  - CONFIG.DEFAULT_WIDTH  * camera.zoom) / 2);
    camera.y = Math.round((canvas.height - CONFIG.DEFAULT_HEIGHT * camera.zoom) / 2);
}
window.addEventListener('resize', resize);
resize();

// ──────────────────────── INPUT HANDLING ───────────────────────

function getPinchDist(t1,t2) {
    const dx=t1.clientX-t2.clientX, dy=t1.clientY-t2.clientY;
    return Math.sqrt(dx*dx+dy*dy);
}
let dragMoved=false, downX=0, downY=0;

function onPointerDown(x,y) {
    camera.isDragging=true; camera.lastX=x; camera.lastY=y;
    dragMoved=false; downX=x; downY=y;
}
function onPointerMove(x,y) {
    if (!camera.isDragging) return;
    const dy=y-camera.lastY;
    if (Math.abs(x-downX)>5||Math.abs(y-downY)>5) dragMoved=true;
    const wdy=dy/camera.zoom;
    if (game.state==='MENU')           { game.scrollY  +=wdy; game.scrollVel  =wdy; }
    else if (game.state==='LEADERBOARD'){ game.lbScrollY+=wdy; game.lbScrollVel=wdy; }
    camera.lastX=x; camera.lastY=y;
}
function onPointerUp(sx,sy) {
    if (!dragMoved && sx!==undefined) handleClick(sx,sy);
    camera.isDragging=false;
}

canvas.addEventListener('touchstart',e=>{
    if (e.touches.length===1) { const t=e.touches[0]; onPointerDown(t.clientX,t.clientY); }
    else { camera.isDragging=false; dragMoved=true; }
},{passive:false});
canvas.addEventListener('touchmove',e=>{
    e.preventDefault();
    if (e.touches.length===1) { const t=e.touches[0]; onPointerMove(t.clientX,t.clientY); }
},{passive:false});
canvas.addEventListener('touchend',e=>{
    if (e.changedTouches.length===1&&e.touches.length===0) { const t=e.changedTouches[0]; onPointerUp(t.clientX,t.clientY); }
    else camera.isDragging=false;
});
canvas.addEventListener('mousedown',e=>{ const r=canvas.getBoundingClientRect(); onPointerDown(e.clientX-r.left,e.clientY-r.top); });
canvas.addEventListener('mousemove',e=>{ if(e.buttons===1){const r=canvas.getBoundingClientRect();onPointerMove(e.clientX-r.left,e.clientY-r.top);} });
canvas.addEventListener('mouseup',e=>{ const r=canvas.getBoundingClientRect(); onPointerUp(e.clientX-r.left,e.clientY-r.top); });
canvas.addEventListener('wheel',e=>{
    e.preventDefault();
    const wdelta=e.deltaY/camera.zoom;
    if (game.state==='MENU')             game.scrollY   -=wdelta;
    else if (game.state==='LEADERBOARD') game.lbScrollY -=wdelta;
},{passive:false});

// ───────────────────────── CLICK LOGIC ─────────────────────────

function handleClick(mx,my) {
    const wx=(mx-camera.x)/camera.zoom, wy=(my-camera.y)/camera.zoom;
    const w=CONFIG.DEFAULT_WIDTH, h=CONFIG.DEFAULT_HEIGHT;

    if (game.state==='MENU') {
        if (inRect(wx,wy,w-200,12,188,42)) { game.state='LEADERBOARD'; game.lbScrollY=0; return; }
        const layout=getMenuLayout(w,h);
        const {cols,btnW,btnH,gapX,gapY,startX,startY:base}=layout;
        const startY=base+game.scrollY;
        const ids=Object.keys(game.levels).map(Number).sort((a,b)=>a-b);
        ids.forEach((lid,idx)=>{
            const row=Math.floor(idx/cols), col=idx%cols;
            const x=startX+col*(btnW+gapX), y=startY+row*(btnH+gapY);
            if (y+btnH<200||y>h) return;
            if (inRect(wx,wy,x,y,btnW,btnH)) game.startLevel(lid);
        });
        return;
    }

    if (game.state==='LEADERBOARD') {
        if (inRect(wx,wy,20,20,130,42)) { game.state='MENU'; return; }
        return;
    }

    if (game.state==='PLAYING'||game.state==='WON') {
        if (inRect(wx,wy,10,11,80,38))  { game.state='MENU'; return; }

        if (game.state==='PLAYING') {
            if (inRect(wx,wy,100,11,105,38)) { game.startLevel(game.levelNum); return; }
            // Undo button
            if (game.history.length>0 && !anim.isActive) {
                if (inRect(wx,wy,215,11,85,38)) { game.undo(); return; }
            }
            // Bottom restart
            if (inRect(wx,wy,w/2-110,h-52,105,40)) { game.startLevel(game.levelNum); return; }
        }

        if (game.state==='WON') {
            const cardH=winCardH(w), cardY=h/2-cardH/2, btnY=cardY+cardH-58;
            if (inRect(wx,wy,w/2-220,btnY,125,44)) { game.startLevel(game.levelNum); return; }
            if (inRect(wx,wy,w/2-60, btnY,120,44)) { game.state='MENU'; return; }
            if (game.levels[game.levelNum+1] && inRect(wx,wy,w/2+80,btnY,140,44)) {
                game.startLevel(game.levelNum+1); return;
            }
            return;
        }

        const trackSX=(CONFIG.DEFAULT_WIDTH-CONFIG.TRACK_WIDTH)/2, trackSY=CONFIG.HUD_HEIGHT;
        const hasMoveReady = !anim.isActive && game.locoTrack!==-1 && game.selectedCars.size>0;
        for (let i=0; i<game.tracks.length; i++) {
            const ty=trackSY+i*CONFIG.TRACK_SPACING;
            const locoX=trackSX-62;
            // Loco button: if cars selected and different track → move; else → place loco
            if (inRect(wx,wy,locoX,ty+2,52,CONFIG.CAR_HEIGHT-4)) {
                if (hasMoveReady && i!==game.locoTrack) game.moveSelected(i);
                else game.positionLocomotive(i);
                return;
            }
            // Click anywhere on a different track's area → move selected cars there
            if (hasMoveReady && i!==game.locoTrack) {
                if (inRect(wx,wy,trackSX-4,ty-4,CONFIG.TRACK_WIDTH+8,CONFIG.CAR_HEIGHT+8)) {
                    game.moveSelected(i); return;
                }
            }
            // Car click on loco's track → adjust selection
            const track=game.tracks[i];
            for (let j=0; j<track.length; j++) {
                if (track[j]==='') continue;
                const cx=trackSX+j*(CONFIG.CAR_WIDTH+CONFIG.CAR_SPACING);
                if (inRect(wx,wy,cx,ty,CONFIG.CAR_WIDTH,CONFIG.CAR_HEIGHT)) { game.selectCar(i,j); return; }
            }
        }
    }
}
function inRect(px,py,rx,ry,rw,rh){ return px>=rx&&px<=rx+rw&&py>=ry&&py<=ry+rh; }

// ────────────────────────── MENU LAYOUT ────────────────────────

function getMenuLayout(w) {
    const sw=canvas.width;
    let cols=5, btnW=140;
    const btnH=90, gapX=16, gapY=16;
    if      (sw<500) { cols=2; btnW=Math.floor((w-48-gapX)/2); }
    else if (sw<750) { cols=3; }
    else if (sw<1050){ cols=4; }
    const gridW=cols*btnW+(cols-1)*gapX, startX=(w-gridW)/2;
    return { cols, btnW, btnH, gapX, gapY, startX, startY:210 };
}
function winCardH(w){ return w<600?380:420; }

// ─────────────────────── DRAWING HELPERS ───────────────────────

function rr(x,y,w,h,r=0){ if(r>0&&ctx.roundRect){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}else{ctx.beginPath();ctx.rect(x,y,w,h);} }
function fillRR(x,y,w,h,r,color){ ctx.fillStyle=color; rr(x,y,w,h,r); ctx.fill(); }
function strokeRR(x,y,w,h,r,color,lw=1.5){ ctx.strokeStyle=color; ctx.lineWidth=lw; rr(x,y,w,h,r); ctx.stroke(); }
function txt(text,x,y,size,color,align='left',weight='600'){
    ctx.fillStyle=color; ctx.font=`${weight} ${size}px Rajdhani,Arial,sans-serif`;
    ctx.textAlign=align; ctx.fillText(text,x,y);
}
function drawStar(cx,cy,r,filled){
    ctx.beginPath();
    for(let i=0;i<10;i++){ const a=(i*Math.PI)/5-Math.PI/2, rad=i%2===0?r:r*0.42;
        const x=cx+Math.cos(a)*rad, y=cy+Math.sin(a)*rad; i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); }
    ctx.closePath(); ctx.fillStyle=filled?C.STAR_ON:C.STAR_OFF; ctx.fill();
    if(filled){ ctx.strokeStyle='rgba(255,215,0,0.5)'; ctx.lineWidth=1; ctx.stroke(); }
}
function formatTime(secs){ const m=Math.floor(secs/60),s=secs%60; return `${m}:${String(s).padStart(2,'0')}`; }

// ─────────────────────── BACKGROUND ────────────────────────────

function drawBackground(w,h){
    const grad=ctx.createLinearGradient(0,0,0,h);
    grad.addColorStop(0,C.BG_TOP); grad.addColorStop(1,C.BG_BOT);
    ctx.fillStyle=grad; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle=C.GRID; ctx.lineWidth=1;
    for(let x=0;x<w;x+=60){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
    for(let y=0;y<h;y+=60){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
}

// ───────────────────────── TRACK ───────────────────────────────

function drawTrack(x,y,width){
    fillRR(x-6,y-18,width+12,36,2,C.BALLAST);
    const slW=13,slH=30,slGap=18;
    for(let sx=x;sx<x+width;sx+=slGap){
        ctx.fillStyle=(Math.floor(sx/slGap)%2===0)?C.SLEEPER_A:C.SLEEPER_B;
        ctx.fillRect(sx-1,y-slH/2,slW,slH);
    }
    for(const off of[-10,10]){
        const rg=ctx.createLinearGradient(x,y+off-4,x,y+off+4);
        rg.addColorStop(0,C.RAIL_HI); rg.addColorStop(1,C.RAIL_LO);
        ctx.fillStyle=rg; ctx.fillRect(x,y+off-3,width,6);
    }
}

// ─────────────────────────── PEINE ─────────────────────────────
// Fan/tree structure: single trunk enters from the left and branches
// diagonally to each track — like a real railway switch fan (peine).

function drawPeineBranch(x1, y1, x2, y2) {
    const dx = x2 - x1;
    // S-curve: horizontal tangents at both ends (cp offset = 50% of dx)
    const cpx1 = x1 + dx * 0.5, cpy1 = y1;
    const cpx2 = x2 - dx * 0.5, cpy2 = y2;

    const GAUGE   = 10;   // ±10px — same as drawTrack's ±10 offset
    const BALLAST = 18;   // ±18px — same as drawTrack's y-18 padding
    const N       = 28;   // sample points along the curve

    // Sample curve points + perpendicular normals
    const pts = [];
    for (let i = 0; i <= N; i++) {
        const t  = i / N;
        const px = cbez(t, x1, cpx1, cpx2, x2);
        const py = cbez(t, y1, cpy1, cpy2, y2);
        const tx = cbezD(t, x1, cpx1, cpx2, x2);
        const ty = cbezD(t, y1, cpy1, cpy2, y2);
        const len = Math.sqrt(tx*tx+ty*ty) || 1;
        pts.push({ x: px, y: py, nx: -ty/len, ny: tx/len });
    }

    // Ballast: filled strip between outer edges
    ctx.beginPath();
    pts.forEach((p,i) => {
        const ox = p.x + p.nx*BALLAST, oy = p.y + p.ny*BALLAST;
        i===0 ? ctx.moveTo(ox,oy) : ctx.lineTo(ox,oy);
    });
    for (let i=pts.length-1; i>=0; i--) {
        ctx.lineTo(pts[i].x - pts[i].nx*BALLAST, pts[i].y - pts[i].ny*BALLAST);
    }
    ctx.closePath();
    ctx.fillStyle = C.BALLAST;
    ctx.fill();

    // Sleepers perpendicular to curve
    const approxLen = Math.sqrt(dx*dx+(y2-y1)*(y2-y1));
    const numTies   = Math.max(3, Math.floor(approxLen/14));
    for (let k=1; k<numTies; k++) {
        const t  = k/numTies;
        const bx = cbez(t, x1, cpx1, cpx2, x2);
        const by = cbez(t, y1, cpy1, cpy2, y2);
        const tx = cbezD(t, x1, cpx1, cpx2, x2);
        const ty = cbezD(t, y1, cpy1, cpy2, y2);
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(Math.atan2(ty, tx));
        ctx.fillStyle = k%2===0 ? C.SLEEPER_A : C.SLEEPER_B;
        ctx.fillRect(-6, -15, 13, 30);  // same proportions as drawTrack sleepers
        ctx.restore();
    }

    // Rails — polylines through perpendicular-offset sample points
    for (const sign of [-1, 1]) {
        ctx.strokeStyle = sign > 0 ? C.RAIL_HI : C.RAIL_LO;
        ctx.lineWidth   = 6;       // same height as drawTrack rails
        ctx.lineJoin    = 'round';
        ctx.beginPath();
        pts.forEach((p,i) => {
            const rx = p.x + p.nx*GAUGE*sign;
            const ry = p.y + p.ny*GAUGE*sign;
            i===0 ? ctx.moveTo(rx,ry) : ctx.lineTo(rx,ry);
        });
        ctx.stroke();
    }
    ctx.lineJoin = 'miter';
}

function drawPeine(trackCount, trackSX, trackSY) {
    const convX   = CONFIG.PEINE_X + 30;  // 60 — convergence (trunk) X
    const fanEndX = trackSX - 70;          // 142 — fan right edge, connects to loco zone
    // Vertical center of all tracks
    const convY   = trackSY + ((trackCount-1)/2) * CONFIG.TRACK_SPACING + CONFIG.CAR_HEIGHT/2;

    // Trunk: main line enters from off-screen left to convergence point
    drawTrack(-10, convY, convX + 10);

    // Fan branches: one curved diagonal branch per track
    for (let i=0; i<trackCount; i++) {
        const ty = trackSY + i*CONFIG.TRACK_SPACING + CONFIG.CAR_HEIGHT/2;
        drawPeineBranch(convX, convY, fanEndX, ty);
    }

    // Horizontal connecting sections from fan end to track area start
    // (this is where the loco button sits — drawn on top separately)
    for (let i=0; i<trackCount; i++) {
        const ty = trackSY + i*CONFIG.TRACK_SPACING + CONFIG.CAR_HEIGHT/2;
        drawTrack(fanEndX, ty, trackSX - fanEndX);
    }

    // Junction nodes at fan tips (fanEndX)
    for (let i=0; i<trackCount; i++) {
        const ty = trackSY + i*CONFIG.TRACK_SPACING + CONFIG.CAR_HEIGHT/2;
        ctx.fillStyle = C.PEINE_NODE;
        ctx.beginPath(); ctx.arc(fanEndX, ty, 5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = C.BALLAST;
        ctx.beginPath(); ctx.arc(fanEndX, ty, 2.5, 0, Math.PI*2); ctx.fill();
    }

    // Convergence node
    ctx.fillStyle = C.PEINE_NODE;
    ctx.beginPath(); ctx.arc(convX, convY, 8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = C.BG_TOP;
    ctx.beginPath(); ctx.arc(convX, convY, 4, 0, Math.PI*2); ctx.fill();
}

// ────────────────────────── CAR ────────────────────────────────

function drawCar(x,y,label,isSelected){
    const w=CONFIG.CAR_WIDTH, h=CONFIG.CAR_HEIGHT;
    const ct=label.charCodeAt(0)%CAR_TYPES.length, st=CAR_TYPES[ct];

    if (isSelected){ const pulse=0.5+0.5*Math.sin(animTime*5); ctx.shadowBlur=16+pulse*14; ctx.shadowColor=C.CAR_GLOW; }

    // ── Wheel bogies ───────────────────────────────────────────
    const bcy=y+h-7, wR=4;
    ctx.fillStyle='#181818';
    ctx.fillRect(x+4,    bcy-3,17,6);
    ctx.fillRect(x+w-21, bcy-3,17,6);
    for (const wx of [x+7,x+15,x+w-21,x+w-13]){
        ctx.fillStyle='#252525'; ctx.beginPath(); ctx.arc(wx,bcy,wR,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#3a3a3a'; ctx.beginPath(); ctx.arc(wx,bcy,wR-1.2,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#777';    ctx.beginPath(); ctx.arc(wx,bcy,1.2,0,Math.PI*2); ctx.fill();
    }
    ctx.strokeStyle='#2a2a2a'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(x+7,bcy);    ctx.lineTo(x+15,bcy);    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+w-21,bcy); ctx.lineTo(x+w-13,bcy); ctx.stroke();

    // ── Car body (27 px tall, sits above bogies) ───────────────
    const bx=x, by=y+1, bw=w, bh=h-13;
    switch(ct){
        case 0: _carBoxcar   (bx,by,bw,bh,st); break;
        case 1: _carHopper   (bx,by,bw,bh,st); break;
        case 2: _carGondola  (bx,by,bw,bh,st); break;
        case 3: _carTanker   (bx,by,bw,bh,st); break;
        case 4: _carContainer(bx,by,bw,bh,st); break;
    }

    ctx.shadowBlur=0;
    ctx.strokeStyle=isSelected?C.CAR_GLOW:'rgba(0,0,0,0.55)';
    ctx.lineWidth=isSelected?2:1;
    rr(bx,by,bw,bh,2); ctx.stroke();

    // Label badge
    const lx=bx+bw/2, ly=by+bh/2+5;
    fillRR(lx-7,ly-9,14,12,3,'rgba(0,0,0,0.58)');
    txt(label,lx+1,ly,12,'rgba(0,0,0,0.5)','center','bold');
    txt(label,lx,  ly,12,'#fff',           'center','bold');
}

// ── Per-type car renderers ──────────────────────────────────────

function _carBoxcar(x,y,w,h,st){
    const bg=ctx.createLinearGradient(x,y,x,y+h);
    bg.addColorStop(0,st.hi); bg.addColorStop(1,st.lo);
    fillRR(x,y,w,h,2,bg);
    // Roof cap
    fillRR(x,y,w,5,2,st.roof);
    // Side panels (darker)
    ctx.fillStyle='rgba(0,0,0,0.14)';
    ctx.fillRect(x+3,y+5,12,h-7);
    ctx.fillRect(x+w-15,y+5,12,h-7);
    // Sliding door (center lighter panel)
    ctx.fillStyle='rgba(255,255,255,0.07)'; ctx.fillRect(x+17,y+5,26,h-7);
    ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=1;
    ctx.strokeRect(x+17,y+5,26,h-7);
    ctx.beginPath(); ctx.moveTo(x+30,y+6); ctx.lineTo(x+30,y+h-2); ctx.stroke();
    // Corner posts
    ctx.fillStyle=st.ac; ctx.fillRect(x,y,3,h); ctx.fillRect(x+w-3,y,3,h);
    // Rivet row bottom
    ctx.fillStyle='rgba(0,0,0,0.28)';
    for(let rx=x+8;rx<x+w-6;rx+=9){ ctx.beginPath(); ctx.arc(rx,y+h-3,1,0,Math.PI*2); ctx.fill(); }
    // Highlight
    ctx.fillStyle='rgba(255,255,255,0.13)'; ctx.fillRect(x+3,y+1,w-6,4);
}

function _carHopper(x,y,w,h,st){
    const sl=8;
    // Trapezoid body
    ctx.beginPath();
    ctx.moveTo(x,y); ctx.lineTo(x+w,y);
    ctx.lineTo(x+w-sl,y+h); ctx.lineTo(x+sl,y+h);
    ctx.closePath();
    const hg=ctx.createLinearGradient(x,y,x,y+h);
    hg.addColorStop(0,st.hi); hg.addColorStop(1,st.lo);
    ctx.fillStyle=hg; ctx.fill();
    // Hatch covers on top
    ctx.fillStyle='rgba(255,255,255,0.08)';
    ctx.fillRect(x+7,y+1,14,5); ctx.fillRect(x+26,y+1,14,5);
    ctx.strokeStyle=st.ac; ctx.lineWidth=1;
    ctx.strokeRect(x+7,y+1,14,5); ctx.strokeRect(x+26,y+1,14,5);
    // Slanted ribs
    ctx.strokeStyle='rgba(0,0,0,0.28)'; ctx.lineWidth=1.5;
    [[x+16, x+sl+(w-sl*2)*0.27],[x+w/2,x+sl+(w-sl*2)*0.5],[x+w-16,x+sl+(w-sl*2)*0.73]]
        .forEach(([tx2,bx2])=>{ ctx.beginPath(); ctx.moveTo(tx2,y+6); ctx.lineTo(bx2,y+h); ctx.stroke(); });
    // Top rim
    ctx.fillStyle=st.rim; ctx.fillRect(x,y,w,3);
    // Discharge gates
    ctx.fillStyle='rgba(0,0,0,0.45)';
    ctx.fillRect(x+sl+2,y+h-5,(w-sl*2)/2-3,4);
    ctx.fillRect(x+w/2+1,y+h-5,(w-sl*2)/2-3,4);
    ctx.fillStyle='rgba(255,255,255,0.09)'; ctx.fillRect(x+2,y+1,w-4,3);
}

function _carGondola(x,y,w,h,st){
    const wall=5;
    const gg=ctx.createLinearGradient(x,y,x,y+h);
    gg.addColorStop(0,st.hi); gg.addColorStop(1,st.lo);
    fillRR(x,y,w,h,2,gg);
    // Open interior
    ctx.fillStyle=st.ac; ctx.fillRect(x+wall,y+wall,w-wall*2,h-wall*2);
    ctx.fillStyle='rgba(255,255,255,0.03)'; ctx.fillRect(x+wall,y+wall,w-wall*2,3);
    // Stake pocket ribs
    ctx.strokeStyle='rgba(0,0,0,0.4)'; ctx.lineWidth=1;
    for(const rx of [x+13,x+27,x+w-13]){
        ctx.beginPath(); ctx.moveTo(rx,y); ctx.lineTo(rx,y+h); ctx.stroke();
    }
    // Top rail cap
    ctx.fillStyle=st.rim;
    ctx.fillRect(x,y,w,3); ctx.fillRect(x,y,3,h); ctx.fillRect(x+w-3,y,3,h);
}

function _carTanker(x,y,w,h,st){
    // Underframe
    ctx.fillStyle='#141414'; ctx.fillRect(x,y+h-5,w,5);
    ctx.fillStyle='#1e1e1e';
    ctx.fillRect(x,y+Math.round(h*0.4),5,Math.round(h*0.5));
    ctx.fillRect(x+w-5,y+Math.round(h*0.4),5,Math.round(h*0.5));
    // Cylindrical tank
    const cx=x+w/2, cy=y+h*0.44, rx=w/2-2, ry=h*0.42;
    const tg=ctx.createRadialGradient(cx-rx*0.3,cy-ry*0.3,ry*0.05,cx,cy,rx);
    tg.addColorStop(0,st.hi); tg.addColorStop(0.6,st.lo); tg.addColorStop(1,'#0e0e0e');
    ctx.fillStyle=tg;
    ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); ctx.fill();
    // Color band
    ctx.strokeStyle=st.band; ctx.lineWidth=3;
    ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); ctx.stroke();
    // Safety dome
    ctx.fillStyle=st.hi;
    ctx.beginPath(); ctx.ellipse(cx,cy-ry+1,5,3,0,Math.PI,0); ctx.fill();
    // Walkway
    ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(x+7,cy-ry+2); ctx.lineTo(x+w-7,cy-ry+2); ctx.stroke();
    // Specular
    ctx.fillStyle='rgba(255,255,255,0.16)';
    ctx.beginPath(); ctx.ellipse(cx-rx*0.28,cy-ry*0.32,rx*0.32,ry*0.28,-0.3,0,Math.PI*2); ctx.fill();
}

function _carContainer(x,y,w,h,st){
    const cg=ctx.createLinearGradient(x,y,x,y+h);
    cg.addColorStop(0,st.hi); cg.addColorStop(1,st.lo);
    fillRR(x,y,w,h,2,cg);
    // Corrugation ridges
    ctx.strokeStyle='rgba(0,0,0,0.16)'; ctx.lineWidth=1;
    for(let rx=x+6;rx<x+w-3;rx+=5){
        ctx.beginPath(); ctx.moveTo(rx,y+2); ctx.lineTo(rx,y+h-2); ctx.stroke();
    }
    // Company stripe
    ctx.fillStyle=st.stripe; ctx.fillRect(x+2,y+Math.round(h*0.58),w-4,3);
    // Corner castings
    [[x,y],[x+w-5,y],[x,y+h-5],[x+w-5,y+h-5]].forEach(([fx,fy])=>{
        ctx.fillStyle='#111'; ctx.fillRect(fx,fy,5,5);
        ctx.fillStyle='#333'; ctx.fillRect(fx+1,fy+1,3,3);
    });
    // Door lock bars (right end)
    ctx.strokeStyle='rgba(0,0,0,0.38)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(x+w-8,y+3); ctx.lineTo(x+w-8,y+h-3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+w-5,y+3); ctx.lineTo(x+w-5,y+h-3); ctx.stroke();
    // Highlight
    ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.fillRect(x+2,y+1,w-4,4);
}

// ──────────────────────── LOCO BUTTON ──────────────────────────

function drawLocoButton(x,y,w,h,isActive){
    const lo=isActive?C.LOCO_RED:C.LOCO_GREY, hi=isActive?C.LOCO_RED2:C.LOCO_GREY2;

    if(isActive){ ctx.shadowBlur=12; ctx.shadowColor=C.LOCO_RED2; }

    // ── Bogies (same style as cars) ─────────────────────────────
    const bcy=y+h+1, wR=4;
    ctx.shadowBlur=0;
    ctx.fillStyle='#181818';
    ctx.fillRect(x+2, bcy-3, 15, 6);
    ctx.fillRect(x+w-17, bcy-3, 15, 6);
    for(const wx of [x+5, x+12, x+w-17, x+w-10]){
        ctx.fillStyle='#252525'; ctx.beginPath(); ctx.arc(wx,bcy,wR,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#3a3a3a'; ctx.beginPath(); ctx.arc(wx,bcy,wR-1.2,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#777';    ctx.beginPath(); ctx.arc(wx,bcy,1.2,0,Math.PI*2); ctx.fill();
    }
    ctx.strokeStyle='#2a2a2a'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(x+5,bcy); ctx.lineTo(x+12,bcy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+w-17,bcy); ctx.lineTo(x+w-10,bcy); ctx.stroke();

    if(isActive){ ctx.shadowBlur=12; ctx.shadowColor=C.LOCO_RED2; }

    // ── Locomotive body ─────────────────────────────────────────
    const grad=ctx.createLinearGradient(x,y,x,y+h);
    grad.addColorStop(0,hi); grad.addColorStop(1,lo);
    ctx.fillStyle=grad; rr(x,y,w,h,4); ctx.fill(); ctx.shadowBlur=0;

    // Cab roof (darker)
    ctx.fillStyle=isActive?'#7a1010':'#222'; ctx.fillRect(x,y,w,5);
    // Body highlight
    ctx.fillStyle='rgba(255,255,255,0.14)'; ctx.fillRect(x+2,y+1,w-4,5);

    // Long hood / nose (front)
    ctx.fillStyle=isActive?'rgba(0,0,0,0.25)':'rgba(0,0,0,0.2)';
    ctx.fillRect(x+2,y+6,w-4,h-14);

    // Cab windows
    ctx.fillStyle='rgba(120,200,255,0.55)';
    fillRR(x+4,y+7,10,9,2,'rgba(100,180,255,0.55)');
    fillRR(x+w-14,y+7,10,9,2,'rgba(100,180,255,0.55)');
    // Window frames
    ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.lineWidth=1;
    ctx.strokeRect(x+4,y+7,10,9); ctx.strokeRect(x+w-14,y+7,10,9);

    // Running light / headlight
    if(isActive){
        ctx.fillStyle='rgba(255,220,100,0.9)';
        ctx.beginPath(); ctx.arc(x+w-6,y+h-8,3,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(255,255,150,0.4)';
        ctx.beginPath(); ctx.arc(x+w-6,y+h-8,5,0,Math.PI*2); ctx.fill();
    }

    // Stripe along side
    ctx.fillStyle=isActive?'rgba(255,255,255,0.18)':'rgba(255,255,255,0.08)';
    ctx.fillRect(x+2,y+h-9,w-4,3);

    strokeRR(x,y,w,h,4,isActive?'rgba(255,120,120,0.4)':'rgba(255,255,255,0.08)');

    // "LOCO" text or arrow when inactive
    if(!isActive){
        ctx.fillStyle='rgba(255,255,255,0.45)';
        ctx.beginPath(); ctx.moveTo(x+w/2-5,y+h/2-5); ctx.lineTo(x+w/2+7,y+h/2); ctx.lineTo(x+w/2-5,y+h/2+5); ctx.closePath(); ctx.fill();
    }
}

// ─────────────────── CLEARANCE / LIMIT MARKER ──────────────────
// Small indicator at the track entrance — marks the clearance point.
// Pulses green when this track is a valid move target.
function drawClearanceMarker(trackX, trackTopY, isTarget) {
    const mW  = 6;                             // narrow post width
    const mH  = Math.round(CONFIG.CAR_HEIGHT * 0.55);  // ~22px — noticeably shorter than a car
    const mX  = trackX - Math.ceil(mW / 2);   // centered on track entrance edge
    const mY  = trackTopY + (CONFIG.CAR_HEIGHT - mH) / 2;  // vertically centred on track

    if (isTarget) {
        const pulse = 0.5 + 0.5 * Math.sin(animTime * 3);
        ctx.shadowBlur   = 8 + pulse * 10;
        ctx.shadowColor  = 'rgba(105,240,174,0.9)';
        fillRR(mX, mY, mW, mH, 3, `rgba(105,240,174,${0.75 + 0.25*pulse})`);
        ctx.shadowBlur   = 0;
        // Small right-pointing chevron to the right of the marker
        ctx.fillStyle = `rgba(105,240,174,${0.6 + 0.4*pulse})`;
        const cy = trackTopY + CONFIG.CAR_HEIGHT / 2;
        ctx.beginPath();
        ctx.moveTo(mX + mW + 2, cy - 5);
        ctx.lineTo(mX + mW + 10, cy);
        ctx.lineTo(mX + mW + 2, cy + 5);
        ctx.closePath();
        ctx.fill();
    } else {
        fillRR(mX, mY, mW, mH, 3, 'rgba(200,208,218,0.18)');
    }
}

// ─────────────────────── CANVAS BUTTON ─────────────────────────

function drawButton(x,y,w,h,label,color){
    fillRR(x+2,y+2,w,h,7,'rgba(0,0,0,0.4)');
    ctx.fillStyle=color; rr(x,y,w,h,7); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.fillRect(x+2,y+2,w-4,h*0.45);
    strokeRR(x,y,w,h,7,'rgba(255,255,255,0.15)');
    txt(label,x+w/2,y+h/2+6,Math.floor(h*0.38),'#fff','center','700');
}

// ─────────────────────────── HUD ───────────────────────────────

function drawHUD(w,h){
    ctx.fillStyle=C.HEADER_BG; ctx.fillRect(0,0,w,62);
    ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.fillRect(0,61,w,1);

    drawButton(10,11,80,38,'← MENÚ','#37474f');
    drawButton(100,11,105,38,'↺ REINICIAR','#2c3e50');

    // Undo button — only when history available and not animating
    if (game.history.length>0 && !anim.isActive) {
        drawButton(215,11,85,38,'↩ DESHACER',C.UNDO_BTN);
    } else {
        // Dimmed placeholder
        ctx.fillStyle='rgba(74,20,140,0.3)';
        rr(215,11,85,38,7); ctx.fill();
        txt('↩ DESHACER',215+42,11+38/2+6,Math.floor(38*0.38),'rgba(255,255,255,0.25)','center','700');
    }

    txt(`NIVEL ${game.levelNum}`,w/2,42,22,C.TEXT,'center','700');
    txt('TIEMPO',    w-90,24,11,C.TEXT_DIM,'right','600');
    txt(game.getTimeStr(),w-90,50,20,C.TEXT,'right','700');
    txt('MANIOBRAS', w-10,24,11,C.TEXT_DIM,'right','600');
    txt(`${game.moves}`,w-10,50,20,C.TEXT,'right','700');

    // Target bar
    ctx.fillStyle=C.TARGET_BG; ctx.fillRect(0,62,w,40);
    ctx.fillStyle='rgba(255,255,255,0.04)'; ctx.fillRect(0,101,w,1);
    const miniW=Math.min(34,Math.floor((w-120)/(game.target.length*1.4))), miniH=22;
    const gap=Math.min(12,miniW/3), totalW=game.target.length*(miniW+gap)-gap;
    let tx=w/2-totalW/2+30;
    txt('OBJETIVO:',12,88,13,C.TEXT_DIM,'left','600');
    for(let i=0;i<game.target.length;i++){
        const lbl=game.target[i], ct=lbl.charCodeAt(0)%CAR_TYPES.length, st=CAR_TYPES[ct];
        const cg=ctx.createLinearGradient(tx,70,tx,70+miniH); cg.addColorStop(0,st.hi); cg.addColorStop(1,st.lo);
        fillRR(tx,70,miniW,miniH,3,cg);
        txt(lbl,tx+miniW/2,70+miniH/2+5,12,'#fff','center','700');
        if(i<game.target.length-1) txt('›',tx+miniW+gap/2,84,13,C.TEXT_DIM,'center','400');
        tx+=miniW+gap;
    }
    if (game.message){
        fillRR(w/2-170,h-120,340,38,8,'rgba(198,40,40,0.92)');
        txt(game.message,w/2,h-97,15,'#fff','center','700');
    }
}

// ──────────────────────── GAME SCREEN ──────────────────────────

function drawGameScreen(w,h){
    drawHUD(w,h);

    const trackSX=(CONFIG.DEFAULT_WIDTH-CONFIG.TRACK_WIDTH)/2;
    const trackSY=CONFIG.HUD_HEIGHT;

    // Peine (behind everything else)
    drawPeine(game.tracks.length, trackSX, trackSY);

    for(let i=0; i<game.tracks.length; i++){
        const ty=trackSY+i*CONFIG.TRACK_SPACING;
        const cars=game.tracks[i].filter(c=>c!=='').length;
        const capFull=cars>=game.capacity;
        txt(`${cars}/${game.capacity}`,trackSX+CONFIG.TRACK_WIDTH+14,ty+26,14,capFull?C.CAPACITY_FULL:C.CAPACITY_OK,'left','600');

        drawTrack(trackSX,ty+CONFIG.CAR_HEIGHT/2,CONFIG.TRACK_WIDTH);

        const isValidTarget = game.state==='PLAYING' && !anim.isActive &&
                              game.locoTrack!==-1 && game.selectedCars.size>0 && i!==game.locoTrack;

        // Clearance marker at the track entrance (small limit post)
        drawClearanceMarker(trackSX, ty, isValidTarget);

        // Loco button — only drawn on the track where the loco currently sits
        if (!anim.isLocoHidden(i) && game.locoTrack===i) {
            drawLocoButton(trackSX-62,ty+2,52,CONFIG.CAR_HEIGHT-4,true);
        }

        // Cars — skip those currently being animated (they're drawn by anim.draw below)
        const track=game.tracks[i];
        for(let j=0;j<track.length;j++){
            if(track[j]==='') continue;
            if(anim.isHidden(i,j)) continue;
            const cx=trackSX+j*(CONFIG.CAR_WIDTH+CONFIG.CAR_SPACING);
            drawCar(cx,ty,track[j],game.selectedCars.has(`${i},${j}`));
        }
    }

    // Draw animated cars + loco (in world coords, on top)
    anim.draw(ctx);

    // Bottom bar
    if(game.state==='PLAYING'){
        ctx.fillStyle=C.HEADER_BG; ctx.fillRect(0,h-64,w,64);
        ctx.fillStyle='rgba(255,255,255,0.04)'; ctx.fillRect(0,h-64,w,1);
        drawButton(w/2-110,h-52,105,40,'↺ REINICIAR','#2c3e50');
    }

    if(game.state==='WON'){
        if(!game.winSpawned){ particles.spawnConfetti(w/2,h/3); game.winSpawned=true; }
        particles.update();
        drawWinScreen(w,h);
    }
}

// ─────────────────────────── WIN SCREEN ────────────────────────

function drawWinScreen(w,h){
    ctx.fillStyle=C.WIN_OVERLAY; ctx.fillRect(0,0,w,h);
    particles.draw(ctx);
    const cardW=Math.min(600,w-40), cardH=winCardH(w);
    const cardX=w/2-cardW/2, cardY=h/2-cardH/2;
    fillRR(cardX,cardY,cardW,cardH,16,'#0f1525');
    strokeRR(cardX,cardY,cardW,cardH,16,game.newRecord?'rgba(255,215,0,0.6)':'rgba(105,240,174,0.3)',2);
    if(game.newRecord){
        const glow=0.5+0.5*Math.sin(animTime*4);
        ctx.shadowBlur=20+glow*20; ctx.shadowColor=C.GOLD;
        strokeRR(cardX,cardY,cardW,cardH,16,'rgba(255,215,0,0.3)',1); ctx.shadowBlur=0;
    }
    txt(`¡NIVEL ${game.levelNum} COMPLETADO!`,w/2,cardY+46,Math.min(32,cardW*0.055),C.SUCCESS,'center','700');
    const stars=game.scores.getStars(game.levelNum,game.target.length);
    for(let s=0;s<3;s++) drawStar(w/2-40+s*42,cardY+78,18,s<stars);
    if(game.newRecord){
        fillRR(w/2-100,cardY+102,200,28,14,'rgba(255,215,0,0.12)');
        strokeRR(w/2-100,cardY+102,200,28,14,'rgba(255,215,0,0.5)');
        txt('★  ¡NUEVO RÉCORD!  ★',w/2,cardY+121,14,C.GOLD,'center','700');
    }
    txt(`MANIOBRAS: ${game.moves}   ·   TIEMPO: ${game.getTimeStr()}`,w/2,cardY+148,16,C.TEXT_DIM,'center','600');
    const lbY=cardY+168, lbH=cardH-168-70;
    fillRR(cardX+16,lbY,cardW-32,lbH,8,'rgba(0,0,0,0.3)');
    txt(`PUNTAJES — NIVEL ${game.levelNum}`,w/2,lbY+20,13,C.TEXT_DIM,'center','700');
    const board=game.scores.getLeaderboard(game.levelNum);
    const medC=[C.GOLD,C.SILVER,C.BRONZE,C.TEXT_DIM,C.TEXT_DIM];
    board.slice(0,5).forEach((entry,i)=>{
        const ey=lbY+38+i*22, isMe=entry.moves===game.moves&&entry.name===game.playerName;
        if(isMe){ctx.fillStyle='rgba(79,195,247,0.08)';ctx.fillRect(cardX+16,ey-14,cardW-32,20);}
        txt(`${i+1}.`,cardX+30,ey,14,isMe?'#4fc3f7':medC[i],'left',isMe?'700':'600');
        txt(entry.name,cardX+60,ey,14,isMe?'#4fc3f7':medC[i],'left',isMe?'700':'600');
        txt(`${entry.moves} mov`,w/2+20,ey,14,isMe?'#4fc3f7':medC[i],'left',isMe?'700':'600');
        txt(formatTime(entry.time),cardX+cardW-30,ey,14,isMe?'#4fc3f7':medC[i],'right',isMe?'700':'600');
    });
    if(!board.length) txt('¡Primer intento!',w/2,lbY+lbH/2+6,16,C.TEXT_DIM,'center','600');
    const btnY=cardY+cardH-58;
    drawButton(w/2-220,btnY,125,44,'↺ REPETIR','#37474f');
    drawButton(w/2-60, btnY,120,44,'≡ MENÚ',   '#1a237e');
    if(game.levels[game.levelNum+1]) drawButton(w/2+80,btnY,140,44,'SIGUIENTE →','#1b5e20');
    else txt('🎉 ¡JUEGO COMPLETADO!',w/2+150,btnY+28,18,C.GOLD,'center','700');
}

// ─────────────────────────── MENU ──────────────────────────────

function drawMenu(w,h){
    ctx.globalAlpha=0.15; drawTrack(0,50,w); drawTrack(0,160,w); ctx.globalAlpha=1;
    ctx.fillStyle=C.HEADER_BG; ctx.fillRect(0,0,w,200);
    ctx.fillStyle='rgba(255,215,0,0.06)'; ctx.fillRect(0,199,w,1);
    ctx.shadowBlur=30; ctx.shadowColor='rgba(255,215,0,0.3)';
    txt('PATIO DE TRENES',w/2,72,Math.min(52,w*0.055),C.GOLD,'center','700');
    ctx.shadowBlur=0;
    txt('PUZZLE DE MANIOBRAS FERROVIARIAS',w/2,100,15,C.TEXT_DIM,'center','600');
    if(game.playerName){
        txt(`Jugador: ${game.playerName}`,w/2,132,18,C.TEXT,'center','600');
        const done=game.scores.completedCount(), total=Object.keys(game.levels).length;
        const barW=Math.min(300,w*0.55), barX=w/2-barW/2;
        fillRR(barX,148,barW,10,5,'rgba(255,255,255,0.08)');
        fillRR(barX,148,barW*(done/Math.max(total,1)),10,5,C.SUCCESS);
        txt(`${done}/${total} completados`,w/2,176,13,C.TEXT_DIM,'center','600');
    }
    drawButton(w-200,12,188,42,'🏆 TABLA DE PUNTAJES','#1a237e');
    const layout=getMenuLayout(w,h), {cols,btnW,btnH,gapX,gapY,startX,startY:base}=layout;
    const startY=base+game.scrollY;
    const ids=Object.keys(game.levels).map(Number).sort((a,b)=>a-b);
    const totalRows=Math.ceil(ids.length/cols), contentH=totalRows*(btnH+gapY);
    game.maxScroll=Math.max(0,contentH-(h-215)+50);
    ctx.save(); ctx.beginPath(); ctx.rect(0,200,w,h-200); ctx.clip();
    ids.forEach((lid,idx)=>{
        const row=Math.floor(idx/cols), col=idx%cols;
        const x=startX+col*(btnW+gapX), y=startY+row*(btnH+gapY);
        if(y+btnH<200||y>h) return;
        drawLevelCard(x,y,btnW,btnH,lid,
            game.scores.getStars(lid,game.levels[lid]?.targetSequence?.length||3),
            game.scores.getBest(lid));
    });
    if(!ids.length) txt('Cargando niveles…',w/2,370,22,C.TEXT_DIM,'center','600');
    ctx.restore();
    if(game.maxScroll>0){
        const prog=-game.scrollY/game.maxScroll, barH=Math.max(40,(h-200)*(h-200)/(contentH+h-200));
        fillRR(w-7,205+prog*(h-205-barH),5,barH,3,'rgba(255,255,255,0.15)');
    }
}

function drawLevelCard(x,y,w,h,lid,stars,best){
    fillRR(x+2,y+3,w,h,9,'rgba(0,0,0,0.35)');
    fillRR(x,y,w,h,9,C.CARD);
    ctx.fillStyle='rgba(255,255,255,0.04)'; ctx.fillRect(x+2,y+2,w-4,h*0.45);
    const borderC=[C.LOCO_GREY,'#6d4c41','#607d8b',C.GOLD];
    if(ctx.roundRect){ctx.fillStyle=borderC[stars];ctx.beginPath();ctx.roundRect(x,y,4,h,[9,0,0,9]);ctx.fill();}
    else{ctx.fillStyle=borderC[stars];ctx.fillRect(x,y,4,h);}
    txt('NIVEL',x+w/2,y+20,Math.min(10,w*0.08),C.TEXT_DIM,'center','600');
    txt(`${lid}`,x+w/2,y+44,Math.min(26,w*0.2),stars>0?C.TEXT:C.TEXT_DIM,'center','700');
    const sr=Math.min(7,w*0.055), sp=sr*2.2, sx=x+w/2-sp;
    for(let s=0;s<3;s++) drawStar(sx+s*sp,y+h-26,sr,s<stars);
    if(best) txt(`${best.moves}m`,x+w/2,y+h-8,Math.min(11,w*0.085),C.TEXT_DIM,'center','600');
    strokeRR(x,y,w,h,9,'rgba(255,255,255,0.06)');
}

// ─────────────────────── LEADERBOARD ───────────────────────────

function drawLeaderboard(w,h){
    ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(0,0,w,74);
    txt('TABLA DE PUNTAJES',w/2,50,Math.min(38,w*0.045),C.GOLD,'center','700');
    drawButton(20,16,130,42,'← VOLVER','#37474f');
    const ids=Object.keys(game.levels).map(Number).sort((a,b)=>a-b).filter(id=>game.scores.isCompleted(id));
    if(!ids.length){ txt('Aún no has completado ningún nivel.',w/2,h/2,22,C.TEXT_DIM,'center','600'); return; }
    const rowH=68, totalH=ids.length*rowH;
    game.lbMaxScroll=Math.max(0,totalH-(h-80)+20);
    ctx.save(); ctx.beginPath(); ctx.rect(0,74,w,h-74); ctx.clip();
    const baseY=80+game.lbScrollY;
    ids.forEach((lid,idx)=>{
        const y=baseY+idx*rowH; if(y+rowH<74||y>h) return;
        const carCount=game.levels[lid]?.targetSequence?.length||3;
        const stars=game.scores.getStars(lid,carCount), board=game.scores.getLeaderboard(lid);
        ctx.fillStyle=idx%2===0?'rgba(255,255,255,0.025)':'transparent'; ctx.fillRect(0,y,w,rowH);
        fillRR(16,y+10,58,48,6,'rgba(255,255,255,0.05)');
        txt('NIV',45,y+28,10,C.TEXT_DIM,'center','600'); txt(`${lid}`,45,y+50,20,C.TEXT,'center','700');
        for(let s=0;s<3;s++) drawStar(90+s*18,y+34,7,s<stars);
        const medC=[C.GOLD,C.SILVER,C.BRONZE];
        board.slice(0,3).forEach((e,i)=>{
            const ex=145+i*Math.min(190,(w-145)/3);
            fillRR(ex,y+14,Math.min(175,(w-155)/3),40,6,'rgba(255,255,255,0.04)');
            txt(`${i+1}. ${e.name}`,ex+8,y+32,13,medC[i],'left','700');
            txt(`${e.moves} mov  ·  ${formatTime(e.time)}`,ex+8,y+50,12,C.TEXT_DIM,'left','600');
        });
        ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(0,y+rowH-1); ctx.lineTo(w,y+rowH-1); ctx.stroke();
    });
    ctx.restore();
    if(game.lbMaxScroll>0){
        const prog=-game.lbScrollY/game.lbMaxScroll, bH=Math.max(40,(h-74)*(h-74)/(totalH+h-74));
        fillRR(w-7,78+prog*(h-74-bH),5,bH,3,'rgba(255,255,255,0.15)');
    }
}

// ─────────────────────────── MAIN LOOP ─────────────────────────

let lastTs=0;
function loop(ts){
    const dt=Math.min((ts-lastTs)/1000,0.05); lastTs=ts; animTime+=dt;
    game.updateTimer();
    anim.update(dt);
    const sw=canvas.width, sh=canvas.height;
    const gw=CONFIG.DEFAULT_WIDTH, gh=CONFIG.DEFAULT_HEIGHT;
    // Letterbox fill
    ctx.fillStyle=C.BG_TOP; ctx.fillRect(0,0,sw,sh);
    // Global game transform — scale everything uniformly
    ctx.save();
    ctx.translate(camera.x,camera.y);
    ctx.scale(camera.zoom,camera.zoom);
    drawBackground(gw,gh);
    if      (game.state==='MENU')        drawMenu(gw,gh);
    else if (game.state==='LEADERBOARD') drawLeaderboard(gw,gh);
    else                                 drawGameScreen(gw,gh);
    ctx.restore();
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
