// js/core/canvas.js — Canvas, cámara y primitivas de dibujo compartidas entre modos

// ─────────────────────────── CANVAS ────────────────────────────

export const canvas = document.getElementById('gameCanvas');
export const ctx    = canvas.getContext('2d');
export const camera = { x: 0, y: 0, zoom: 1, isDragging: false, lastX: 0, lastY: 0 };

// Dimensiones del mundo lógico (todos los modos dibujan en este espacio)
export const WORLD = { W: 1024, H: 768 };

export let animTime = 0;
export function tickAnim(dt) {
    // Wrap to prevent float precision loss after long sessions
    animTime = (animTime + dt) % (2 * Math.PI * 600);
}

let _dpr = 1;
export function getDpr() { return _dpr; }
export function cssW()   { return canvas.width  / _dpr; }
export function cssH()   { return canvas.height / _dpr; }

export function resize() {
    _dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width  = Math.round(w * _dpr);
    canvas.height = Math.round(h * _dpr);
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    const scaleX = w / WORLD.W;
    const scaleY = h / WORLD.H;
    camera.zoom  = Math.min(scaleX, scaleY, 1);
    camera.x = Math.round((w - WORLD.W * camera.zoom) / 2);
    camera.y = Math.round((h - WORLD.H * camera.zoom) / 2);
}

// ─────────────────────── PALETA COMPARTIDA ─────────────────────

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
    AMBER:         '#f5a623',
};

// ─────────────────────── DRAWING HELPERS ───────────────────────

export function inRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx+rw && py >= ry && py <= ry+rh;
}

export function rr(x, y, w, h, r = 0) {
    if (r > 0 && ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
    else { ctx.beginPath(); ctx.rect(x, y, w, h); }
}
export function fillRR(x, y, w, h, r, color) { ctx.fillStyle = color; rr(x, y, w, h, r); ctx.fill(); }
export function strokeRR(x, y, w, h, r, color, lw = 1.5) {
    ctx.strokeStyle = color; ctx.lineWidth = lw; rr(x, y, w, h, r); ctx.stroke();
}
export function txt(text, x, y, size, color, align = 'left', weight = '600') {
    ctx.fillStyle = color;
    ctx.font      = `${weight} ${size}px Rajdhani,Arial,sans-serif`;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
}
export function drawStar(cx, cy, r, filled) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const a   = (i * Math.PI) / 5 - Math.PI / 2;
        const rad = i % 2 === 0 ? r : r * 0.42;
        const x   = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fillStyle = filled ? C.STAR_ON : C.STAR_OFF; ctx.fill();
    if (filled) { ctx.strokeStyle = 'rgba(255,215,0,0.5)'; ctx.lineWidth = 1; ctx.stroke(); }
}
export function formatTime(secs) {
    const m = Math.floor(secs / 60), s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

export function drawButton(x, y, w, h, label, color) {
    fillRR(x+2, y+2, w, h, 7, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = color; rr(x, y, w, h, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x+2, y+2, w-4, h*0.45);
    strokeRR(x, y, w, h, 7, 'rgba(255,255,255,0.15)');
    txt(label, x+w/2, y+h/2+6, Math.floor(h*0.38), '#fff', 'center', '700');
}

// ─────────────────────── BACKGROUND ────────────────────────────

export function drawBackground(w, h) {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, C.BG_TOP); grad.addColorStop(1, C.BG_BOT);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = C.GRID; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
}

// ───────────────────────── TRACK ───────────────────────────────

export function drawTrack(x, y, width) {
    fillRR(x-6, y-18, width+12, 36, 2, C.BALLAST);
    const slW = 13, slH = 30, slGap = 18;
    for (let sx = x; sx < x+width; sx += slGap) {
        ctx.fillStyle = (Math.floor(sx/slGap) % 2 === 0) ? C.SLEEPER_A : C.SLEEPER_B;
        ctx.fillRect(sx-1, y-slH/2, slW, slH);
    }
    for (const off of [-10, 10]) {
        const rg = ctx.createLinearGradient(x, y+off-4, x, y+off+4);
        rg.addColorStop(0, C.RAIL_HI); rg.addColorStop(1, C.RAIL_LO);
        ctx.fillStyle = rg; ctx.fillRect(x, y+off-3, width, 6);
    }
}

// ─────────────────── MENÚ DE NIVELES (layout) ──────────────────

export function getMenuLayout(w, h) {
    const sw = cssW(); // use CSS pixels for responsive breakpoints
    let cols = 5, btnW = 140;
    const btnH = 90, gapX = 16, gapY = 16;
    if      (sw < 500)  { cols = 2; btnW = Math.floor((w - 48 - gapX) / 2); }
    else if (sw < 750)  { cols = 3; }
    else if (sw < 1050) { cols = 4; }
    const gridW    = cols * btnW + (cols - 1) * gapX;
    const startX   = (w - gridW) / 2;
    const visibleH = h - 215;
    return { cols, btnW, btnH, gapX, gapY, startX, startY: 210, visibleH };
}
