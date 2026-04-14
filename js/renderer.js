// js/renderer.js — Canvas setup, camera, and all drawing functions

import { CONFIG, C, CAR_TYPES, getCarDims, particles, anim, game } from './state.js';

// ─────────────────────────── CANVAS ────────────────────────────

export const canvas = document.getElementById('gameCanvas');
export const ctx    = canvas.getContext('2d');
export const camera = { x: 0, y: 0, zoom: 1, isDragging: false, lastX: 0, lastY: 0 };

let animTime = 0;
export function tickAnim(dt) {
    // Wrap to prevent float precision loss after long sessions
    animTime = (animTime + dt) % (2 * Math.PI * 600);
}

let _dpr = 1;

export function resize() {
    _dpr = window.devicePixelRatio || 1;
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    canvas.width  = Math.round(cssW * _dpr);
    canvas.height = Math.round(cssH * _dpr);
    canvas.style.width  = cssW + 'px';
    canvas.style.height = cssH + 'px';
    const scaleX = cssW / CONFIG.DEFAULT_WIDTH;
    const scaleY = cssH / CONFIG.DEFAULT_HEIGHT;
    camera.zoom  = Math.min(scaleX, scaleY, 1);
    camera.x = Math.round((cssW - CONFIG.DEFAULT_WIDTH  * camera.zoom) / 2);
    camera.y = Math.round((cssH - CONFIG.DEFAULT_HEIGHT * camera.zoom) / 2);
}

// ─────────────────────── LAYOUT HELPERS ────────────────────────

// Item 6: h parameter now used to compute visibleH for maxScroll
export function getMenuLayout(w, h) {
    const sw = canvas.width / _dpr; // use CSS pixels for responsive breakpoints
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

export function winCardH(w) { return w < 600 ? 380 : 420; }

// ─────────────────────── DRAWING HELPERS ───────────────────────

export function inRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx+rw && py >= ry && py <= ry+rh;
}

function rr(x, y, w, h, r = 0) {
    if (r > 0 && ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
    else { ctx.beginPath(); ctx.rect(x, y, w, h); }
}
function fillRR(x, y, w, h, r, color) { ctx.fillStyle = color; rr(x, y, w, h, r); ctx.fill(); }
function strokeRR(x, y, w, h, r, color, lw = 1.5) {
    ctx.strokeStyle = color; ctx.lineWidth = lw; rr(x, y, w, h, r); ctx.stroke();
}
function txt(text, x, y, size, color, align = 'left', weight = '600') {
    ctx.fillStyle = color;
    ctx.font      = `${weight} ${size}px Rajdhani,Arial,sans-serif`;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
}
function drawStar(cx, cy, r, filled) {
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
function formatTime(secs) {
    const m = Math.floor(secs / 60), s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
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

function drawTrack(x, y, width) {
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

// ─────────────────────────── PEINE ─────────────────────────────

function cbez(t, p0, p1, p2, p3)  { const m=1-t; return m*m*m*p0+3*m*m*t*p1+3*m*t*t*p2+t*t*t*p3; }
function cbezD(t, p0, p1, p2, p3) { const m=1-t; return 3*(m*m*(p1-p0)+2*m*t*(p2-p1)+t*t*(p3-p2)); }

function drawPeineBranch(x1, y1, x2, y2) {
    const dx   = x2 - x1;
    const cpx1 = x1 + dx * 0.5, cpy1 = y1;
    const cpx2 = x2 - dx * 0.5, cpy2 = y2;

    const GAUGE   = 10;
    const BALLAST = 18;
    const N       = 28;

    const pts = [];
    for (let i = 0; i <= N; i++) {
        const t  = i / N;
        const px = cbez(t, x1, cpx1, cpx2, x2);
        const py = cbez(t, y1, cpy1, cpy2, y2);
        const tx = cbezD(t, x1, cpx1, cpx2, x2);
        const ty = cbezD(t, y1, cpy1, cpy2, y2);
        const len = Math.sqrt(tx*tx + ty*ty) || 1;
        pts.push({ x: px, y: py, nx: -ty/len, ny: tx/len });
    }

    ctx.beginPath();
    pts.forEach((p, i) => {
        const ox = p.x + p.nx*BALLAST, oy = p.y + p.ny*BALLAST;
        i === 0 ? ctx.moveTo(ox, oy) : ctx.lineTo(ox, oy);
    });
    for (let i = pts.length-1; i >= 0; i--) {
        ctx.lineTo(pts[i].x - pts[i].nx*BALLAST, pts[i].y - pts[i].ny*BALLAST);
    }
    ctx.closePath(); ctx.fillStyle = C.BALLAST; ctx.fill();

    const approxLen = Math.sqrt(dx*dx + (y2-y1)*(y2-y1));
    const numTies   = Math.max(3, Math.floor(approxLen / 14));
    for (let k = 1; k < numTies; k++) {
        const t  = k / numTies;
        const bx = cbez(t, x1, cpx1, cpx2, x2);
        const by = cbez(t, y1, cpy1, cpy2, y2);
        const tx = cbezD(t, x1, cpx1, cpx2, x2);
        const ty = cbezD(t, y1, cpy1, cpy2, y2);
        ctx.save(); ctx.translate(bx, by); ctx.rotate(Math.atan2(ty, tx));
        ctx.fillStyle = k % 2 === 0 ? C.SLEEPER_A : C.SLEEPER_B;
        ctx.fillRect(-6, -15, 13, 30); ctx.restore();
    }

    for (const sign of [-1, 1]) {
        ctx.strokeStyle = sign > 0 ? C.RAIL_HI : C.RAIL_LO;
        ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.beginPath();
        pts.forEach((p, i) => {
            const rx = p.x + p.nx*GAUGE*sign, ry = p.y + p.ny*GAUGE*sign;
            i === 0 ? ctx.moveTo(rx, ry) : ctx.lineTo(rx, ry);
        });
        ctx.stroke();
    }
    ctx.lineJoin = 'miter';
}

function drawPeineRight(trackCount, trackSX, trackSY) {
    const trackEndX = trackSX + CONFIG.TRACK_WIDTH;
    const convX     = CONFIG.DEFAULT_WIDTH - (CONFIG.PEINE_X + 30); // ~964
    const fanEndX   = trackEndX + 70;                               // ~882
    const convY     = trackSY + ((trackCount-1) / 2) * CONFIG.TRACK_SPACING + CONFIG.CAR_HEIGHT / 2;

    // Trunk: from convergence to right edge (off-screen)
    drawTrack(convX - 10, convY, CONFIG.DEFAULT_WIDTH - convX + 20);

    for (let i = 0; i < trackCount; i++) {
        const ty = trackSY + i * CONFIG.TRACK_SPACING + CONFIG.CAR_HEIGHT / 2;
        drawPeineBranch(convX, convY, fanEndX, ty);
    }
    for (let i = 0; i < trackCount; i++) {
        const ty = trackSY + i * CONFIG.TRACK_SPACING + CONFIG.CAR_HEIGHT / 2;
        drawTrack(trackEndX, ty, fanEndX - trackEndX);
    }
    for (let i = 0; i < trackCount; i++) {
        const ty = trackSY + i * CONFIG.TRACK_SPACING + CONFIG.CAR_HEIGHT / 2;
        ctx.fillStyle = C.PEINE_NODE;
        ctx.beginPath(); ctx.arc(fanEndX, ty, 5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = C.BALLAST;
        ctx.beginPath(); ctx.arc(fanEndX, ty, 2.5, 0, Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = C.PEINE_NODE;
    ctx.beginPath(); ctx.arc(convX, convY, 8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = C.BG_TOP;
    ctx.beginPath(); ctx.arc(convX, convY, 4, 0, Math.PI*2); ctx.fill();
}

function drawClearanceMarkerRight(trackX, trackTopY, isTarget) {
    const mW = 6, mH = Math.round(CONFIG.CAR_HEIGHT * 0.55);
    const mX = trackX - Math.ceil(mW / 2);
    const mY = trackTopY + (CONFIG.CAR_HEIGHT - mH) / 2;
    if (isTarget) {
        const pulse = 0.5 + 0.5 * Math.sin(animTime * 3);
        ctx.shadowBlur = 8 + pulse * 10; ctx.shadowColor = 'rgba(105,240,174,0.9)';
        fillRR(mX, mY, mW, mH, 3, `rgba(105,240,174,${0.75 + 0.25*pulse})`);
        ctx.shadowBlur = 0;
        ctx.fillStyle  = `rgba(105,240,174,${0.6 + 0.4*pulse})`;
        const cy = trackTopY + CONFIG.CAR_HEIGHT / 2;
        ctx.beginPath();
        ctx.moveTo(mX - 2,  cy - 5);
        ctx.lineTo(mX - 10, cy);
        ctx.lineTo(mX - 2,  cy + 5);
        ctx.closePath(); ctx.fill();
    } else {
        fillRR(mX, mY, mW, mH, 3, 'rgba(200,208,218,0.18)');
    }
}

function drawPeine(trackCount, trackSX, trackSY) {
    const convX   = CONFIG.PEINE_X + 30;
    const fanEndX = trackSX - 70;
    const convY   = trackSY + ((trackCount-1) / 2) * CONFIG.TRACK_SPACING + CONFIG.CAR_HEIGHT / 2;

    drawTrack(-10, convY, convX + 10);

    for (let i = 0; i < trackCount; i++) {
        const ty = trackSY + i * CONFIG.TRACK_SPACING + CONFIG.CAR_HEIGHT / 2;
        drawPeineBranch(convX, convY, fanEndX, ty);
    }

    for (let i = 0; i < trackCount; i++) {
        const ty = trackSY + i * CONFIG.TRACK_SPACING + CONFIG.CAR_HEIGHT / 2;
        drawTrack(fanEndX, ty, trackSX - fanEndX);
    }

    for (let i = 0; i < trackCount; i++) {
        const ty = trackSY + i * CONFIG.TRACK_SPACING + CONFIG.CAR_HEIGHT / 2;
        ctx.fillStyle = C.PEINE_NODE;
        ctx.beginPath(); ctx.arc(fanEndX, ty, 5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = C.BALLAST;
        ctx.beginPath(); ctx.arc(fanEndX, ty, 2.5, 0, Math.PI*2); ctx.fill();
    }

    ctx.fillStyle = C.PEINE_NODE;
    ctx.beginPath(); ctx.arc(convX, convY, 8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = C.BG_TOP;
    ctx.beginPath(); ctx.arc(convX, convY, 4, 0, Math.PI*2); ctx.fill();
}

// ────────────────────────── CAR ────────────────────────────────

export function drawCar(x, y, label, isSelected, carW = CONFIG.CAR_WIDTH) {
    const w  = carW, h = CONFIG.CAR_HEIGHT;
    const ct = label.charCodeAt(0) % CAR_TYPES.length;
    const st = CAR_TYPES[ct];

    if (isSelected) {
        const pulse = 0.5 + 0.5 * Math.sin(animTime * 5);
        ctx.shadowBlur = 16 + pulse * 14; ctx.shadowColor = C.CAR_GLOW;
    }

    // Wheel bogies
    const bcy = y + h - 7, wR = 4;
    ctx.fillStyle = '#181818';
    ctx.fillRect(x+4,     bcy-3, 17, 6);
    ctx.fillRect(x+w-21,  bcy-3, 17, 6);
    for (const wx of [x+7, x+15, x+w-21, x+w-13]) {
        ctx.fillStyle = '#252525'; ctx.beginPath(); ctx.arc(wx, bcy, wR,    0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.arc(wx, bcy, wR-1.2, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#777';    ctx.beginPath(); ctx.arc(wx, bcy, 1.2,   0, Math.PI*2); ctx.fill();
    }
    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x+7,    bcy); ctx.lineTo(x+15,    bcy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+w-21, bcy); ctx.lineTo(x+w-13,  bcy); ctx.stroke();

    // Car body (27px tall, sits above bogies)
    const bx = x, by = y+1, bw = w, bh = h-13;
    switch (ct) {
        case 0: _carBoxcar   (bx, by, bw, bh, st); break;
        case 1: _carHopper   (bx, by, bw, bh, st); break;
        case 2: _carGondola  (bx, by, bw, bh, st); break;
        case 3: _carTanker   (bx, by, bw, bh, st); break;
        case 4: _carContainer(bx, by, bw, bh, st); break;
    }

    ctx.shadowBlur = 0;
    ctx.strokeStyle = isSelected ? C.CAR_GLOW : 'rgba(0,0,0,0.55)';
    ctx.lineWidth   = isSelected ? 2 : 1;
    rr(bx, by, bw, bh, 2); ctx.stroke();

    // Label badge
    const lx = bx + bw/2, ly = by + bh/2 + 5;
    fillRR(lx-7, ly-9, 14, 12, 3, 'rgba(0,0,0,0.58)');
    txt(label, lx+1, ly, 12, 'rgba(0,0,0,0.5)', 'center', 'bold');
    txt(label, lx,   ly, 12, '#fff',            'center', 'bold');
}

function _carBoxcar(x, y, w, h, st) {
    const bg = ctx.createLinearGradient(x, y, x, y+h);
    bg.addColorStop(0, st.hi); bg.addColorStop(1, st.lo);
    fillRR(x, y, w, h, 2, bg);
    fillRR(x, y, w, 5, 2, st.roof);
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.fillRect(x+3, y+5, 12, h-7); ctx.fillRect(x+w-15, y+5, 12, h-7);
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x+17, y+5, 26, h-7);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
    ctx.strokeRect(x+17, y+5, 26, h-7);
    ctx.beginPath(); ctx.moveTo(x+30, y+6); ctx.lineTo(x+30, y+h-2); ctx.stroke();
    ctx.fillStyle = st.ac; ctx.fillRect(x, y, 3, h); ctx.fillRect(x+w-3, y, 3, h);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    for (let rx = x+8; rx < x+w-6; rx += 9) { ctx.beginPath(); ctx.arc(rx, y+h-3, 1, 0, Math.PI*2); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,0.13)'; ctx.fillRect(x+3, y+1, w-6, 4);
}

function _carHopper(x, y, w, h, st) {
    const sl = 8;
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x+w, y);
    ctx.lineTo(x+w-sl, y+h); ctx.lineTo(x+sl, y+h);
    ctx.closePath();
    const hg = ctx.createLinearGradient(x, y, x, y+h);
    hg.addColorStop(0, st.hi); hg.addColorStop(1, st.lo);
    ctx.fillStyle = hg; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x+7, y+1, 14, 5); ctx.fillRect(x+26, y+1, 14, 5);
    ctx.strokeStyle = st.ac; ctx.lineWidth = 1;
    ctx.strokeRect(x+7, y+1, 14, 5); ctx.strokeRect(x+26, y+1, 14, 5);
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1.5;
    [[x+16, x+sl+(w-sl*2)*0.27], [x+w/2, x+sl+(w-sl*2)*0.5], [x+w-16, x+sl+(w-sl*2)*0.73]]
        .forEach(([tx2, bx2]) => { ctx.beginPath(); ctx.moveTo(tx2, y+6); ctx.lineTo(bx2, y+h); ctx.stroke(); });
    ctx.fillStyle = st.rim; ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x+sl+2, y+h-5, (w-sl*2)/2-3, 4);
    ctx.fillRect(x+w/2+1, y+h-5, (w-sl*2)/2-3, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.09)'; ctx.fillRect(x+2, y+1, w-4, 3);
}

function _carGondola(x, y, w, h, st) {
    const wall = 5;
    const gg = ctx.createLinearGradient(x, y, x, y+h);
    gg.addColorStop(0, st.hi); gg.addColorStop(1, st.lo);
    fillRR(x, y, w, h, 2, gg);
    ctx.fillStyle = st.ac; ctx.fillRect(x+wall, y+wall, w-wall*2, h-wall*2);
    ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(x+wall, y+wall, w-wall*2, 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
    for (const rx of [x+13, x+27, x+w-13]) {
        ctx.beginPath(); ctx.moveTo(rx, y); ctx.lineTo(rx, y+h); ctx.stroke();
    }
    ctx.fillStyle = st.rim;
    ctx.fillRect(x, y, w, 3); ctx.fillRect(x, y, 3, h); ctx.fillRect(x+w-3, y, 3, h);
}

function _carTanker(x, y, w, h, st) {
    ctx.fillStyle = '#141414'; ctx.fillRect(x, y+h-5, w, 5);
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(x,     y+Math.round(h*0.4), 5, Math.round(h*0.5));
    ctx.fillRect(x+w-5, y+Math.round(h*0.4), 5, Math.round(h*0.5));
    const cx = x+w/2, cy = y+h*0.44, rx = w/2-2, ry = h*0.42;
    const tg = ctx.createRadialGradient(cx-rx*0.3, cy-ry*0.3, ry*0.05, cx, cy, rx);
    tg.addColorStop(0, st.hi); tg.addColorStop(0.6, st.lo); tg.addColorStop(1, '#0e0e0e');
    ctx.fillStyle = tg;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI*2); ctx.stroke();
    // Hoop bands (clip inside the cylinder)
    ctx.save();
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI*2); ctx.clip();
    ctx.strokeStyle = st.band; ctx.lineWidth = 2;
    for (const bx of [cx - rx*0.35, cx + rx*0.35]) {
        ctx.beginPath(); ctx.moveTo(bx, cy - ry); ctx.lineTo(bx, cy + ry); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = st.hi;
    ctx.beginPath(); ctx.ellipse(cx, cy-ry+1, 5, 3, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x+7, cy-ry+2); ctx.lineTo(x+w-7, cy-ry+2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath(); ctx.ellipse(cx-rx*0.28, cy-ry*0.32, rx*0.32, ry*0.28, -0.3, 0, Math.PI*2); ctx.fill();
}

function _carContainer(x, y, w, h, st) {
    const cg = ctx.createLinearGradient(x, y, x, y+h);
    cg.addColorStop(0, st.hi); cg.addColorStop(1, st.lo);
    fillRR(x, y, w, h, 2, cg);
    ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 1;
    for (let rx = x+6; rx < x+w-3; rx += 5) {
        ctx.beginPath(); ctx.moveTo(rx, y+2); ctx.lineTo(rx, y+h-2); ctx.stroke();
    }
    ctx.fillStyle = st.stripe; ctx.fillRect(x+2, y+Math.round(h*0.58), w-4, 3);
    [[x, y], [x+w-5, y], [x, y+h-5], [x+w-5, y+h-5]].forEach(([fx, fy]) => {
        ctx.fillStyle = '#111'; ctx.fillRect(fx, fy, 5, 5);
        ctx.fillStyle = '#333'; ctx.fillRect(fx+1, fy+1, 3, 3);
    });
    ctx.strokeStyle = 'rgba(0,0,0,0.38)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x+w-8, y+3); ctx.lineTo(x+w-8, y+h-3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+w-5, y+3); ctx.lineTo(x+w-5, y+h-3); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x+2, y+1, w-4, 4);
}

// ──────────────────────── LOCO BUTTON ──────────────────────────

export function drawLocoButton(x, y, w, h, isActive, facingRight = true) {
    if (!facingRight) {
        ctx.save();
        ctx.transform(-1, 0, 0, 1, 2 * (x + w / 2), 0);
        _drawLocoAsset(x, y, w, h, isActive);
        ctx.restore();
    } else {
        _drawLocoAsset(x, y, w, h, isActive);
    }
}

function _drawLocoAsset(x, y, w, h, isActive) {
    const lo = isActive ? C.LOCO_RED  : C.LOCO_GREY;
    const hi = isActive ? C.LOCO_RED2 : C.LOCO_GREY2;

    // Bogies
    const bcy = y + h + 1, wR = 4;
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#181818';
    ctx.fillRect(x+2,    bcy-3, 15, 6);
    ctx.fillRect(x+w-17, bcy-3, 15, 6);
    for (const wx of [x+5, x+12, x+w-17, x+w-10]) {
        ctx.fillStyle = '#252525'; ctx.beginPath(); ctx.arc(wx, bcy, wR,     0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.arc(wx, bcy, wR-1.2, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#777';    ctx.beginPath(); ctx.arc(wx, bcy, 1.2,    0, Math.PI*2); ctx.fill();
    }
    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x+5,    bcy); ctx.lineTo(x+12,    bcy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+w-17, bcy); ctx.lineTo(x+w-10,  bcy); ctx.stroke();

    if (isActive) { ctx.shadowBlur = 12; ctx.shadowColor = C.LOCO_RED2; }

    // Body
    const grad = ctx.createLinearGradient(x, y, x, y+h);
    grad.addColorStop(0, hi); grad.addColorStop(1, lo);
    ctx.fillStyle = grad; rr(x, y, w, h, 4); ctx.fill(); ctx.shadowBlur = 0;

    // Roof stripe
    ctx.fillStyle = isActive ? '#7a1010' : '#222'; ctx.fillRect(x, y, w, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(x+2, y+1, w-4, 5);

    // Hood region (left 0–30): darker overlay + ventilation louvers
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x+2, y+5, 28, h-10);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.5;
    for (const ly of [y+8, y+12, y+16, y+20]) {
        ctx.beginPath(); ctx.moveTo(x+4, ly); ctx.lineTo(x+18, ly); ctx.stroke();
    }

    // Cab region (right 30–w): single large engineer window
    fillRR(x+32, y+5, 14, h-12, 2, 'rgba(100,180,255,0.6)');
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
    ctx.strokeRect(x+32, y+5, 14, h-12);

    // Top running light on cab
    ctx.fillStyle = isActive ? 'rgba(255,220,100,0.7)' : 'rgba(120,120,120,0.4)';
    ctx.fillRect(x+34, y+1, 6, 2);

    // Headlight on nose (right/cab end), active only
    if (isActive) {
        ctx.fillStyle = 'rgba(255,220,100,0.9)';
        ctx.beginPath(); ctx.arc(x+w-3, y+h/2, 2.5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,150,0.35)';
        ctx.beginPath(); ctx.arc(x+w-3, y+h/2, 5, 0, Math.PI*2); ctx.fill();
    }

    // Bottom shine + outline
    ctx.fillStyle = isActive ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)';
    ctx.fillRect(x+2, y+h-9, w-4, 3);
    strokeRR(x, y, w, h, 4, isActive ? 'rgba(255,120,120,0.4)' : 'rgba(255,255,255,0.08)');

    // Inactive: arrow pointing right toward track
    if (!isActive) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath();
        ctx.moveTo(x+w/2-5, y+h/2-5); ctx.lineTo(x+w/2+7, y+h/2); ctx.lineTo(x+w/2-5, y+h/2+5);
        ctx.closePath(); ctx.fill();
    }
}

// ─────────────────── CLEARANCE / LIMIT MARKER ──────────────────

function drawClearanceMarker(trackX, trackTopY, isTarget) {
    const mW = 6;
    const mH = Math.round(CONFIG.CAR_HEIGHT * 0.55);
    const mX = trackX - Math.ceil(mW / 2);
    const mY = trackTopY + (CONFIG.CAR_HEIGHT - mH) / 2;

    if (isTarget) {
        const pulse = 0.5 + 0.5 * Math.sin(animTime * 3);
        ctx.shadowBlur  = 8 + pulse * 10;
        ctx.shadowColor = 'rgba(105,240,174,0.9)';
        fillRR(mX, mY, mW, mH, 3, `rgba(105,240,174,${0.75 + 0.25*pulse})`);
        ctx.shadowBlur = 0;
        ctx.fillStyle  = `rgba(105,240,174,${0.6 + 0.4*pulse})`;
        const cy = trackTopY + CONFIG.CAR_HEIGHT / 2;
        ctx.beginPath();
        ctx.moveTo(mX + mW + 2, cy - 5);
        ctx.lineTo(mX + mW + 10, cy);
        ctx.lineTo(mX + mW + 2, cy + 5);
        ctx.closePath(); ctx.fill();
    } else {
        fillRR(mX, mY, mW, mH, 3, 'rgba(200,208,218,0.18)');
    }
}

// ─────────────────────── CANVAS BUTTON ─────────────────────────

function drawButton(x, y, w, h, label, color) {
    fillRR(x+2, y+2, w, h, 7, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = color; rr(x, y, w, h, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x+2, y+2, w-4, h*0.45);
    strokeRR(x, y, w, h, 7, 'rgba(255,255,255,0.15)');
    txt(label, x+w/2, y+h/2+6, Math.floor(h*0.38), '#fff', 'center', '700');
}

// ─────────────────────────── HUD ───────────────────────────────

function drawHUD(w, h) {
    ctx.fillStyle = C.HEADER_BG; ctx.fillRect(0, 0, w, 62);
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, 61, w, 1);

    drawButton(10,  11, 80,  38, '← MENÚ',      '#37474f');
    drawButton(100, 11, 105, 38, '↺ REINICIAR',  '#2c3e50');

    if (game.history.length > 0 && !anim.isActive) {
        drawButton(215, 11, 85, 38, '↩ DESHACER', C.UNDO_BTN);
    } else {
        ctx.fillStyle = 'rgba(74,20,140,0.3)'; rr(215, 11, 85, 38, 7); ctx.fill();
        txt('↩ DESHACER', 215+42, 11+38/2+6, Math.floor(38*0.38), 'rgba(255,255,255,0.25)', 'center', '700');
    }

    txt(`NIVEL ${game.levelNum}`, w/2,   42, 22, C.TEXT,    'center', '700');
    // locoLimit badge
    if (isFinite(game.locoLimit)) {
        fillRR(w/2 - 62, 48, 124, 18, 9, 'rgba(74,20,140,0.7)');
        txt(`🚂 MÁX ${game.locoLimit} VAGÓN${game.locoLimit > 1 ? 'ES' : ''} / MANIOBRA`,
            w/2, 62, 11, '#ce93d8', 'center', '700');
    }
    txt('TIEMPO',      w-90, 24, 11, C.TEXT_DIM, 'right', '600');
    txt(game.getTimeStr(), w-90, 50, 20, C.TEXT, 'right', '700');
    txt('MANIOBRAS',   w-10, 24, 11, C.TEXT_DIM, 'right', '600');
    txt(`${game.moves}`, w-10, 50, 20, C.TEXT,   'right', '700');

    ctx.fillStyle = C.TARGET_BG; ctx.fillRect(0, 62, w, 40);
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(0, 101, w, 1);
    const miniW = Math.min(34, Math.floor((w-120) / (game.target.length*1.4))), miniH = 22;
    const gap = Math.min(12, miniW/3), totalW = game.target.length * (miniW + gap) - gap;
    let tx = w/2 - totalW/2 + 30;
    txt('OBJETIVO:', 12, 88, 13, C.TEXT_DIM, 'left', '600');
    for (let i = 0; i < game.target.length; i++) {
        const lbl = game.target[i];
        const ct  = lbl.charCodeAt(0) % CAR_TYPES.length, st = CAR_TYPES[ct];
        const cg  = ctx.createLinearGradient(tx, 70, tx, 70+miniH);
        cg.addColorStop(0, st.hi); cg.addColorStop(1, st.lo);
        fillRR(tx, 70, miniW, miniH, 3, cg);
        txt(lbl, tx+miniW/2, 70+miniH/2+5, 12, '#fff', 'center', '700');
        if (i < game.target.length-1) txt('›', tx+miniW+gap/2, 84, 13, C.TEXT_DIM, 'center', '400');
        tx += miniW + gap;
    }
    if (game.message) {
        fillRR(w/2-170, h-120, 340, 38, 8, 'rgba(198,40,40,0.92)');
        txt(game.message, w/2, h-97, 15, '#fff', 'center', '700');
    }
}

// ── Animated cars: replaces anim.draw(ctx) ─────────────────────

function drawAnimCars() {
    const state = anim.getAnimState();
    if (!state) return;
    const { w: carW } = getCarDims(game.capacity);
    // Draw animated cars first (behind loco)
    for (const { label, pos } of state.cars) {
        drawCar(pos.x, pos.y, label, false, carW);
    }
    if (state.locoPos) {
        drawLocoButton(state.locoPos.x, state.locoPos.y, 52, CONFIG.CAR_HEIGHT - 4, true, !anim.isRight);
    }
}

// ──────────────────────── TUTORIAL ─────────────────────────────

function drawTutorialHighlight(x, y, bw, bh) {
    const pulse = 0.5 + 0.5 * Math.sin(animTime * 4);
    ctx.shadowBlur  = 10 + pulse * 15;
    ctx.shadowColor = 'rgba(105,240,174,0.9)';
    strokeRR(x-4, y-4, bw+8, bh+8, 6, `rgba(105,240,174,${0.6 + 0.4*pulse})`, 2);
    ctx.shadowBlur = 0;
}

function drawTutorialModal(w, h) {
    // Dim overlay
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, w, h);

    // Highlight objective bar in step 1
    if (game.tutModal === 1) {
        drawTutorialHighlight(0, 62, w, 40);
    }

    const cardW = Math.min(500, w - 40);
    const cardH = 255;
    const cardX = w / 2 - cardW / 2;
    const cardY = h / 2 - cardH / 2;

    fillRR(cardX, cardY, cardW, cardH, 16, '#0f1525');
    strokeRR(cardX, cardY, cardW, cardH, 16, 'rgba(105,240,174,0.45)', 2);

    if (game.tutModal === 0) {
        txt('¡BIENVENIDO!',               w/2, cardY + 50,  26, C.SUCCESS,  'center', '700');
        txt('Patio de Trenes es un puzzle de maniobras ferroviarias.', w/2, cardY + 100, 14, C.TEXT,    'center', '600');
        txt('Tu misión: ordenar los vagones en la secuencia correcta.', w/2, cardY + 124, 14, C.TEXT,   'center', '600');
        drawButton(w/2 - 90, cardY + cardH - 70, 180, 44, 'SIGUIENTE →', '#1b5e20');
    } else {
        txt('EL OBJETIVO',                w/2, cardY + 50,  26, C.SUCCESS,  'center', '700');
        txt('La barra superior muestra el orden requerido de vagones.', w/2, cardY + 100, 14, C.TEXT,    'center', '600');
        txt('Lográ que una vía tenga exactamente esa secuencia.', w/2, cardY + 124, 14, C.TEXT,   'center', '600');
        drawButton(w/2 - 90, cardY + cardH - 70, 180, 44, '¡ENTENDIDO! →', '#1b5e20');
    }

    txt('Saltar tutorial', w/2, cardY + cardH - 14, 12, C.TEXT_DIM, 'center', '400');
}

const HINT_TEXTS = [
    'Colocá la locomotora en la vía que tiene el vagón A',
    '¡Bien! Ahora hacé clic en el vagón A para seleccionarlo',
    '¡Perfecto! Hacé clic en otra vía para mover el vagón',
];

function drawTutorialHint(w, h) {
    const trackSX = (CONFIG.DEFAULT_WIDTH - CONFIG.TRACK_WIDTH) / 2;
    const trackSY = CONFIG.HUD_HEIGHT;
    const hintIdx = game.tutModal - 2; // 0, 1, or 2

    // Highlights
    if (game.tutModal === 2) {
        const tA = game.tracks.findIndex(t => t.some(c => c === 'A'));
        if (tA >= 0) {
            const tyA = trackSY + tA * CONFIG.TRACK_SPACING;
            drawTutorialHighlight(trackSX - 62, tyA + 2, 52, CONFIG.CAR_HEIGHT - 4);
        }
    } else if (game.tutModal === 3) {
        const tA = game.locoTrack;
        if (tA >= 0) {
            const colA = game.tracks[tA].indexOf('A');
            if (colA >= 0) {
                const { w: cW, gap: cG } = getCarDims(game.capacity);
                const tyA = trackSY + tA * CONFIG.TRACK_SPACING;
                drawTutorialHighlight(trackSX + colA * (cW + cG), tyA, cW, CONFIG.CAR_HEIGHT);
            }
        }
    } else if (game.tutModal === 4) {
        for (let i = 0; i < game.tracks.length; i++) {
            if (i === game.locoTrack) continue;
            const ty = trackSY + i * CONFIG.TRACK_SPACING;
            drawTutorialHighlight(trackSX - 62, ty + 2, CONFIG.TRACK_WIDTH + 62, CONFIG.CAR_HEIGHT - 4);
        }
    }

    // Hint banner
    const bannerW = Math.min(w - 160, 520);
    const bannerX = w / 2 - bannerW / 2;
    const bannerY = h - 160;
    fillRR(bannerX, bannerY, bannerW, 50, 10, 'rgba(15,21,37,0.96)');
    strokeRR(bannerX, bannerY, bannerW, 50, 10, 'rgba(105,240,174,0.5)', 1.5);
    txt('💡 ' + HINT_TEXTS[hintIdx], w / 2 - 55, bannerY + 31, 14, C.TEXT, 'center', '600');

    drawButton(w - 130, bannerY + 3, 110, 44, 'SALTAR', '#37474f');
}

function drawTutorial(w, h) {
    if (game.tutModal === 0 || game.tutModal === 1) drawTutorialModal(w, h);
    else drawTutorialHint(w, h);
}

// ──────────────────────── GAME SCREEN ──────────────────────────

export function drawGameScreen(w, h) {
    drawHUD(w, h);

    const trackSX = (CONFIG.DEFAULT_WIDTH - CONFIG.TRACK_WIDTH) / 2;
    const trackSY = CONFIG.HUD_HEIGHT;

    drawPeine(game.tracks.length, trackSX, trackSY);
    if (game.hasRightLoco) drawPeineRight(game.tracks.length, trackSX, trackSY);

    for (let i = 0; i < game.tracks.length; i++) {
        const ty   = trackSY + i * CONFIG.TRACK_SPACING;
        const cars = game.tracks[i].filter(c => c !== '').length;
        const capFull = cars >= game.capacity;

        drawTrack(trackSX, ty + CONFIG.CAR_HEIGHT / 2, CONFIG.TRACK_WIDTH);

        const isValidLeft  = game.state === 'PLAYING' && !anim.isActive &&
                             game.locoTrack !== -1 && game.selectedCars.size > 0 && i !== game.locoTrack;
        const isValidRight = game.state === 'PLAYING' && !anim.isActive && game.hasRightLoco &&
                             game.rightLocoTrack !== -1 && game.rightSelectedCars.size > 0 && i !== game.rightLocoTrack;

        drawClearanceMarker(trackSX, ty, isValidLeft);
        if (game.hasRightLoco) {
            drawClearanceMarkerRight(trackSX + CONFIG.TRACK_WIDTH, ty, isValidRight);
        } else {
            // capacity label on right side when no right peine
            txt(`${cars}/${game.capacity}`, trackSX + CONFIG.TRACK_WIDTH + 14, ty + 26, 14,
                capFull ? C.CAPACITY_FULL : C.CAPACITY_OK, 'left', '600');
        }

        if (!anim.isLocoHidden(i, 'left') && game.locoTrack === i) {
            drawLocoButton(trackSX - 62, ty + 2, 52, CONFIG.CAR_HEIGHT - 4, true, true);
        }
        if (game.hasRightLoco && !anim.isLocoHidden(i, 'right') && game.rightLocoTrack === i) {
            drawLocoButton(trackSX + CONFIG.TRACK_WIDTH + 10, ty + 2, 52, CONFIG.CAR_HEIGHT - 4, true, false);
        }

        const { w: carW, gap: carGap } = getCarDims(game.capacity);
        const track = game.tracks[i];
        for (let j = 0; j < track.length; j++) {
            if (track[j] === '') continue;
            if (anim.isHidden(i, j)) continue;
            const cx = trackSX + j * (carW + carGap);
            drawCar(cx, ty, track[j],
                game.selectedCars.has(`${i},${j}`) || game.rightSelectedCars.has(`${i},${j}`), carW);
        }
    }

    drawAnimCars();

    if (game.state === 'PLAYING') {
        ctx.fillStyle = C.HEADER_BG; ctx.fillRect(0, h-64, w, 64);
        ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(0, h-64, w, 1);
        drawButton(w/2-110, h-52, 105, 40, '↺ REINICIAR', '#2c3e50');
    }

    if (game.state === 'WON') {
        if (!game.winSpawned) { particles.spawnConfetti(w/2, h/3); game.winSpawned = true; }
        particles.update();
        drawWinScreen(w, h);
    }

    if (game.tutModal >= 0 && game.state !== 'WON') drawTutorial(w, h);
}

// ─────────────────────────── WIN SCREEN ────────────────────────

export function drawWinScreen(w, h) {
    ctx.fillStyle = C.WIN_OVERLAY; ctx.fillRect(0, 0, w, h);
    particles.draw(ctx);
    const cardW = Math.min(600, w-40), cardH = winCardH(w);
    const cardX = w/2 - cardW/2,       cardY = h/2 - cardH/2;
    fillRR(cardX, cardY, cardW, cardH, 16, '#0f1525');
    strokeRR(cardX, cardY, cardW, cardH, 16,
        game.newRecord ? 'rgba(255,215,0,0.6)' : 'rgba(105,240,174,0.3)', 2);
    if (game.newRecord) {
        const glow = 0.5 + 0.5 * Math.sin(animTime * 4);
        ctx.shadowBlur = 20 + glow * 20; ctx.shadowColor = C.GOLD;
        strokeRR(cardX, cardY, cardW, cardH, 16, 'rgba(255,215,0,0.3)', 1);
        ctx.shadowBlur = 0;
    }
    txt(`¡NIVEL ${game.levelNum} COMPLETADO!`, w/2, cardY+46,
        Math.min(32, cardW*0.055), C.SUCCESS, 'center', '700');
    const stars = game.scores.getStars(game.levelNum, game.minMoves, game.target.length);
    for (let s = 0; s < 3; s++) drawStar(w/2-40+s*42, cardY+78, 18, s < stars);
    if (game.newRecord) {
        fillRR(w/2-100, cardY+102, 200, 28, 14, 'rgba(255,215,0,0.12)');
        strokeRR(w/2-100, cardY+102, 200, 28, 14, 'rgba(255,215,0,0.5)');
        txt('★  ¡NUEVO RÉCORD!  ★', w/2, cardY+121, 14, C.GOLD, 'center', '700');
    }
    const minHint  = game.minMoves != null ? ` (óptimo: ${game.minMoves})` : '';
    const myEntry  = game.scores.getLeaderboard(game.levelNum)
                         .find(e => e.uid === game.scores.lastUid);
    const scoreStr = myEntry?.score != null ? `   ·   ${myEntry.score} pts` : '';
    txt(`MANIOBRAS: ${game.moves}${minHint}   ·   TIEMPO: ${game.getTimeStr()}${scoreStr}`,
        w/2, cardY+148, Math.min(14, cardW * 0.023), C.TEXT_DIM, 'center', '600');
    const lbY = cardY+168, lbH = cardH - 168 - 70;
    fillRR(cardX+16, lbY, cardW-32, lbH, 8, 'rgba(0,0,0,0.3)');
    txt(`PUNTAJES — NIVEL ${game.levelNum}`, w/2, lbY+20, 13, C.TEXT_DIM, 'center', '700');
    const board = game.scores.getLeaderboard(game.levelNum);
    const medC  = [C.GOLD, C.SILVER, C.BRONZE, C.TEXT_DIM, C.TEXT_DIM];
    board.slice(0, 5).forEach((entry, i) => {
        const ey = lbY + 38 + i*22;
        // Item 3: use uid for reliable "isMe" identification
        const isMe = !!(game.scores.lastUid && entry.uid === game.scores.lastUid);
        if (isMe) { ctx.fillStyle = 'rgba(79,195,247,0.08)'; ctx.fillRect(cardX+16, ey-14, cardW-32, 20); }
        const ec = isMe ? '#4fc3f7' : medC[i], ew = isMe ? '700' : '600';
        txt(`${i+1}.`,        cardX+30,  ey, 14, ec, 'left',  ew);
        txt(entry.name,       cardX+60,  ey, 14, ec, 'left',  ew);
        if (entry.score != null)
            txt(`${entry.score} pts`, w/2, ey, 13, ec, 'center', ew);
        txt(`${entry.moves}m · ${formatTime(entry.time)}`, cardX+cardW-30, ey, 12, ec, 'right', ew);
    });
    if (!board.length) txt('¡Primer intento!', w/2, lbY+lbH/2+6, 16, C.TEXT_DIM, 'center', '600');
    const btnY = cardY + cardH - 58;
    drawButton(w/2-220, btnY, 125, 44, '↺ REPETIR',   '#37474f');
    drawButton(w/2-60,  btnY, 120, 44, '≡ MENÚ',      '#1a237e');
    if (game.levels[game.levelNum+1]) drawButton(w/2+80, btnY, 140, 44, 'SIGUIENTE →', '#1b5e20');
    else txt('🎉 ¡JUEGO COMPLETADO!', w/2+150, btnY+28, 18, C.GOLD, 'center', '700');
}

// ─────────────────────────── MENU ──────────────────────────────

export function drawMenu(w, h) {
    ctx.globalAlpha = 0.15; drawTrack(0, 50, w); drawTrack(0, 160, w); ctx.globalAlpha = 1;
    ctx.fillStyle = C.HEADER_BG; ctx.fillRect(0, 0, w, 200);
    ctx.fillStyle = 'rgba(255,215,0,0.06)'; ctx.fillRect(0, 199, w, 1);
    ctx.shadowBlur = 30; ctx.shadowColor = 'rgba(255,215,0,0.3)';
    txt('PATIO DE TRENES', w/2, 72, Math.min(52, w*0.055), C.GOLD, 'center', '700');
    ctx.shadowBlur = 0;
    txt('PUZZLE DE MANIOBRAS FERROVIARIAS', w/2, 100, 15, C.TEXT_DIM, 'center', '600');
    if (game.playerName) {
        txt(`Jugador: ${game.playerName}`, w/2, 132, 18, C.TEXT, 'center', '600');
        const done  = game.scores.completedCount();
        const total = Object.keys(game.levels).length;
        const barW  = Math.min(300, w*0.55), barX = w/2 - barW/2;
        fillRR(barX, 148, barW, 10, 5, 'rgba(255,255,255,0.08)');
        fillRR(barX, 148, barW * (done / Math.max(total, 1)), 10, 5, C.SUCCESS);
        txt(`${done}/${total} completados`, w/2, 176, 13, C.TEXT_DIM, 'center', '600');
    }
    drawButton(w-200, 12, 188, 42, '🏆 TABLA DE PUNTAJES', '#1a237e');

    const layout = getMenuLayout(w, h);
    const { cols, btnW, btnH, gapX, gapY, startX, startY: base, visibleH } = layout;
    const startY = base + game.scrollY;
    const ids = Object.keys(game.levels).map(Number).sort((a, b) => a - b);
    const totalRows = Math.ceil(ids.length / cols), contentH = totalRows * (btnH + gapY);
    // Item 6: use visibleH from layout for correct maxScroll
    game.maxScroll = Math.max(0, contentH - visibleH + 50);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 200, w, h-200); ctx.clip();
    ids.forEach((lid, idx) => {
        const row = Math.floor(idx / cols), col = idx % cols;
        const x = startX + col * (btnW + gapX), y = startY + row * (btnH + gapY);
        if (y + btnH < 200 || y > h) return;
        drawLevelCard(x, y, btnW, btnH, lid,
            game.scores.getStars(lid, game.levels[lid]?.minMoves ?? null, game.levels[lid]?.targetSequence?.length || 3),
            game.scores.getBest(lid));
    });
    if (!ids.length) txt('Cargando niveles…', w/2, 370, 22, C.TEXT_DIM, 'center', '600');
    ctx.restore();
    if (game.maxScroll > 0) {
        const prog = -game.scrollY / game.maxScroll;
        const barH = Math.max(40, (h-200) * (h-200) / (contentH + h - 200));
        fillRR(w-7, 205 + prog*(h-205-barH), 5, barH, 3, 'rgba(255,255,255,0.15)');
    }
}

function drawLevelCard(x, y, w, h, lid, stars, best) {
    fillRR(x+2, y+3, w, h, 9, 'rgba(0,0,0,0.35)');
    fillRR(x,   y,   w, h, 9, C.CARD);
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(x+2, y+2, w-4, h*0.45);
    const borderC = [C.LOCO_GREY, '#6d4c41', '#607d8b', C.GOLD];
    if (ctx.roundRect) {
        ctx.fillStyle = borderC[stars]; ctx.beginPath(); ctx.roundRect(x, y, 4, h, [9, 0, 0, 9]); ctx.fill();
    } else {
        ctx.fillStyle = borderC[stars]; ctx.fillRect(x, y, 4, h);
    }
    txt('NIVEL', x+w/2, y+20,   Math.min(10, w*0.08), C.TEXT_DIM, 'center', '600');
    txt(`${lid}`, x+w/2, y+44,  Math.min(26, w*0.2),  stars > 0 ? C.TEXT : C.TEXT_DIM, 'center', '700');
    const sr = Math.min(7, w*0.055), sp = sr*2.2, sx = x + w/2 - sp;
    for (let s = 0; s < 3; s++) drawStar(sx + s*sp, y+h-26, sr, s < stars);
    if (best) txt(best.score != null ? `${best.score}pts` : `${best.moves}m`, x+w/2, y+h-8, Math.min(11, w*0.085), C.TEXT_DIM, 'center', '600');
    strokeRR(x, y, w, h, 9, 'rgba(255,255,255,0.06)');
}

// ─────────────────────── LEADERBOARD ───────────────────────────

export function drawLeaderboard(w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, w, 74);
    txt('TABLA DE PUNTAJES', w/2, 50, Math.min(38, w*0.045), C.GOLD, 'center', '700');
    drawButton(20, 16, 130, 42, '← VOLVER', '#37474f');
    if (game.globalLbLoading) {
        txt('Cargando ranking global…', w-20, 54, 12, C.TEXT_DIM, 'right', '600');
    }
    const ids = Object.keys(game.levels).map(Number).sort((a, b) => a - b)
                    .filter(id => game.scores.isCompleted(id));
    if (!ids.length) { txt('Aún no has completado ningún nivel.', w/2, h/2, 22, C.TEXT_DIM, 'center', '600'); return; }
    const rowH = 68, totalH = ids.length * rowH;
    game.lbMaxScroll = Math.max(0, totalH - (h - 80) + 20);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 74, w, h-74); ctx.clip();
    const baseY = 80 + game.lbScrollY;
    ids.forEach((lid, idx) => {
        const y = baseY + idx * rowH; if (y + rowH < 74 || y > h) return;
        const carCount = game.levels[lid]?.targetSequence?.length || 3;
        const stars    = game.scores.getStars(lid, game.levels[lid]?.minMoves ?? null, carCount);
        const globalBoard = game.globalLeaderboard[lid];
        const board       = globalBoard || game.scores.getLeaderboard(lid);
        const isGlobal    = !!globalBoard;
        ctx.fillStyle = idx % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'transparent';
        ctx.fillRect(0, y, w, rowH);
        fillRR(16, y+10, 58, 48, 6, 'rgba(255,255,255,0.05)');
        txt('NIV', 45, y+28, 10, C.TEXT_DIM, 'center', '600');
        txt(`${lid}`, 45, y+50, 20, C.TEXT, 'center', '700');
        for (let s = 0; s < 3; s++) drawStar(90 + s*18, y+34, 7, s < stars);
        txt(isGlobal ? 'GLOBAL' : 'LOCAL', 90, y+54, 8, isGlobal ? C.SUCCESS : C.TEXT_DIM, 'center', '600');
        const medC = [C.GOLD, C.SILVER, C.BRONZE];
        board.slice(0, 3).forEach((e, i) => {
            const ex = 145 + i * Math.min(190, (w-145) / 3);
            fillRR(ex, y+14, Math.min(175, (w-155)/3), 40, 6, 'rgba(255,255,255,0.04)');
            txt(`${i+1}. ${e.name}`, ex+8, y+32, 13, medC[i], 'left', '700');
            const scoreLabel = e.score != null ? `${e.score}pts  ·  ` : '';
            txt(`${scoreLabel}${e.moves}m  ·  ${formatTime(e.time)}`, ex+8, y+50, 12, C.TEXT_DIM, 'left', '600');
        });
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, y+rowH-1); ctx.lineTo(w, y+rowH-1); ctx.stroke();
    });
    ctx.restore();
    if (game.lbMaxScroll > 0) {
        const prog = -game.lbScrollY / game.lbMaxScroll;
        const bH   = Math.max(40, (h-74) * (h-74) / (totalH + h - 74));
        fillRR(w-7, 78 + prog*(h-74-bH), 5, bH, 3, 'rgba(255,255,255,0.15)');
    }
}

// ─────────────────────── RENDER FRAME ──────────────────────────

export function render() {
    const state = game.state;
    const cssW  = canvas.width / _dpr;
    const cssH  = canvas.height / _dpr;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(_dpr, _dpr);                          // map CSS→physical pixels
    ctx.fillStyle = C.BG_TOP; ctx.fillRect(0, 0, cssW, cssH);
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);
    drawBackground(CONFIG.DEFAULT_WIDTH, CONFIG.DEFAULT_HEIGHT);
    if      (state === 'MENU')        drawMenu(CONFIG.DEFAULT_WIDTH, CONFIG.DEFAULT_HEIGHT);
    else if (state === 'LEADERBOARD') drawLeaderboard(CONFIG.DEFAULT_WIDTH, CONFIG.DEFAULT_HEIGHT);
    else                              drawGameScreen(CONFIG.DEFAULT_WIDTH, CONFIG.DEFAULT_HEIGHT);
    ctx.restore();
}
