// js/main.js — Arranque, login, selección de modo, ruteo de input y game loop

import { app } from './core/app.js';
import { canvas, ctx, camera, resize, tickAnim, WORLD, C,
         inRect, fillRR, strokeRR, txt, drawButton, drawBackground, drawTrack,
         getDpr, cssW, cssH } from './core/canvas.js';
import { game, anim } from './shunting/state.js';
import { renderShunting } from './shunting/renderer.js';
import { handleShuntingClick } from './shunting/input.js';
import { clf } from './classification/state.js';
import { renderClassification } from './classification/renderer.js';
import { handleClassificationClick } from './classification/input.js';

// ─────────────────── IDLE DETECTION (Item 10) ──────────────────
// Render is skipped when nothing is moving in MENU/LEADERBOARD.
// Input events and async level loads call markDirty() to trigger a frame.

let renderNeeded = true;
function markDirty() { renderNeeded = true; }

// ────────────────────────── LOGIN ──────────────────────────────
// Item 12: persist player name across sessions

function setupLogin() {
    const overlay = document.getElementById('login-overlay');
    const input   = document.getElementById('player-name');
    const btn     = document.getElementById('start-btn');

    const saved = localStorage.getItem('train_player_name');
    if (saved) input.value = saved;

    const tryStart = () => {
        const name = input.value.trim();
        if (name) {
            app.playerName = name;
            localStorage.setItem('train_player_name', name);
            overlay.style.transition = 'opacity 0.35s';
            overlay.style.opacity    = '0';
            setTimeout(() => overlay.style.display = 'none', 350);
            markDirty();
        } else {
            input.classList.remove('shake');
            void input.offsetWidth;
            input.classList.add('shake');
        }
    };
    btn.addEventListener('click', tryStart);
    input.addEventListener('keypress', e => { if (e.key === 'Enter') tryStart(); });
}

// ─────────────────── PANTALLA DE SELECCIÓN DE MODO ─────────────

const MODES = [
    {
        id:    'shunting',
        icon:  '🚂',
        title: 'PATIO DE MANIOBRAS',
        color: C.GOLD,
        glow:  'rgba(255,215,0,0.35)',
        desc:  ['Mueve la locomotora y ordena los', 'vagones en la secuencia objetivo.'],
        progress: () => `${game.scores.completedCount()}/${Object.keys(game.levels).length} niveles`,
    },
    {
        id:    'classification',
        icon:  '🚦',
        title: 'PATIO DE CLASIFICACIÓN',
        color: C.AMBER,
        glow:  'rgba(245,166,35,0.35)',
        desc:  ['Empuja cada vagón desde el lomo hacia', 'la vía de su color de destino.'],
        progress: () => `${clf.scores.completedCount()}/${Object.keys(clf.levels).length} turnos`,
    },
];

function modeCardRects(w, h) {
    const cardW = 380, cardH = 320, gap = 44;
    const totalW = cardW * 2 + gap;
    const x0 = w/2 - totalW/2, y0 = 288;
    return MODES.map((m, i) => ({ mode: m, x: x0 + i * (cardW + gap), y: y0, w: cardW, h: cardH }));
}

function drawModeSelect(w, h) {
    ctx.globalAlpha = 0.15; drawTrack(0, 60, w); drawTrack(0, 170, w); ctx.globalAlpha = 1;
    ctx.fillStyle = C.HEADER_BG; ctx.fillRect(0, 0, w, 224);
    ctx.fillStyle = 'rgba(255,215,0,0.06)'; ctx.fillRect(0, 223, w, 1);
    ctx.shadowBlur = 30; ctx.shadowColor = 'rgba(255,215,0,0.3)';
    txt('PATIO DE TRENES', w/2, 92, 52, C.GOLD, 'center', '700');
    ctx.shadowBlur = 0;
    txt('PUZZLES FERROVIARIOS', w/2, 124, 15, C.TEXT_DIM, 'center', '600');
    if (app.playerName) {
        txt(`Jugador: ${app.playerName}`, w/2, 162, 18, C.TEXT, 'center', '600');
    }
    txt('ELIGE UN MODO DE JUEGO', w/2, 256, 18, C.TEXT, 'center', '700');

    for (const r of modeCardRects(w, h)) {
        const m = r.mode;
        fillRR(r.x+3, r.y+4, r.w, r.h, 14, 'rgba(0,0,0,0.4)');
        fillRR(r.x, r.y, r.w, r.h, 14, C.CARD);
        ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(r.x+2, r.y+2, r.w-4, r.h*0.4);
        strokeRR(r.x, r.y, r.w, r.h, 14, m.glow, 2);

        ctx.font = '64px Rajdhani,Arial,sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(m.icon, r.x + r.w/2, r.y + 96);
        txt(m.title, r.x + r.w/2, r.y + 148, 24, m.color, 'center', '700');
        m.desc.forEach((line, i) => {
            txt(line, r.x + r.w/2, r.y + 180 + i*22, 14, C.TEXT_DIM, 'center', '600');
        });
        txt(m.progress(), r.x + r.w/2, r.y + 240, 14, C.TEXT, 'center', '600');
        drawButton(r.x + r.w/2 - 70, r.y + r.h - 62, 140, 44, 'JUGAR', m.id === 'shunting' ? '#1b5e20' : '#7a5514');
    }
}

function handleModeSelectClick(wx, wy, w, h) {
    for (const r of modeCardRects(w, h)) {
        if (inRect(wx, wy, r.x, r.y, r.w, r.h)) {
            app.mode = r.mode.id;
            if (r.mode.id === 'shunting')       game.state = 'MENU';
            if (r.mode.id === 'classification') clf.state  = 'MENU';
            return;
        }
    }
}

// ──────────────────────── INPUT STATE ──────────────────────────

let dragMoved = false, downX = 0, downY = 0;

// Devuelve el objeto de estado cuyo scroll debe moverse con el arrastre actual
function scrollTarget() {
    if (app.mode === 'shunting') {
        if (game.state === 'MENU')        return { obj: game, key: 'scrollY',   vel: 'scrollVel' };
        if (game.state === 'LEADERBOARD') return { obj: game, key: 'lbScrollY', vel: 'lbScrollVel' };
    }
    if (app.mode === 'classification') {
        if (clf.state === 'MENU')        return { obj: clf, key: 'scrollY',   vel: 'scrollVel' };
        if (clf.state === 'LEADERBOARD') return { obj: clf, key: 'lbScrollY', vel: 'lbScrollVel' };
    }
    return null;
}

function onPointerDown(x, y) {
    camera.isDragging = true; camera.lastX = x; camera.lastY = y;
    dragMoved = false; downX = x; downY = y;
}

function onPointerMove(x, y) {
    if (!camera.isDragging) return;
    const dy = y - camera.lastY;
    if (Math.abs(x - downX) > 5 || Math.abs(y - downY) > 5) dragMoved = true;
    const wdy = dy / camera.zoom;
    const t = scrollTarget();
    if (t) { t.obj[t.key] += wdy; t.obj[t.vel] = wdy; }
    camera.lastX = x; camera.lastY = y;
    markDirty();
}

function onPointerUp(sx, sy) {
    if (!dragMoved && sx !== undefined) handleClick(sx, sy);
    camera.isDragging = false;
}

// ─────────────────────── EVENT LISTENERS ───────────────────────

canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 1) { const t = e.touches[0]; onPointerDown(t.clientX, t.clientY); }
    else { camera.isDragging = false; dragMoved = true; }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 1) { const t = e.touches[0]; onPointerMove(t.clientX, t.clientY); }
}, { passive: false });

canvas.addEventListener('touchend', e => {
    if (e.changedTouches.length === 1 && e.touches.length === 0) {
        const t = e.changedTouches[0]; onPointerUp(t.clientX, t.clientY);
    } else {
        camera.isDragging = false;
    }
});

canvas.addEventListener('mousedown', e => {
    const r = canvas.getBoundingClientRect(); onPointerDown(e.clientX - r.left, e.clientY - r.top);
});
canvas.addEventListener('mousemove', e => {
    if (e.buttons === 1) { const r = canvas.getBoundingClientRect(); onPointerMove(e.clientX - r.left, e.clientY - r.top); }
});
canvas.addEventListener('mouseup', e => {
    const r = canvas.getBoundingClientRect(); onPointerUp(e.clientX - r.left, e.clientY - r.top);
});
canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const wdelta = e.deltaY / camera.zoom;
    const t = scrollTarget();
    if (t) t.obj[t.key] -= wdelta;
    markDirty();
}, { passive: false });

window.addEventListener('resize', () => { resize(); markDirty(); });

// ───────────────────────── CLICK LOGIC ─────────────────────────

function handleClick(mx, my) {
    const wx = (mx - camera.x) / camera.zoom, wy = (my - camera.y) / camera.zoom;
    const w  = WORLD.W, h = WORLD.H;
    markDirty();

    if (!app.playerName) return; // login todavía visible
    if (app.mode === null)             { handleModeSelectClick(wx, wy, w, h); return; }
    if (app.mode === 'shunting')       { handleShuntingClick(wx, wy, w, h); return; }
    if (app.mode === 'classification') { handleClassificationClick(wx, wy, w, h); return; }
}

// ─────────────────────── RENDER FRAME ──────────────────────────

function render() {
    const dpr = getDpr();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);                          // map CSS→physical pixels
    ctx.fillStyle = C.BG_TOP; ctx.fillRect(0, 0, cssW(), cssH());
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);
    drawBackground(WORLD.W, WORLD.H);
    if      (app.mode === 'shunting')       renderShunting(WORLD.W, WORLD.H);
    else if (app.mode === 'classification') renderClassification(WORLD.W, WORLD.H);
    else                                    drawModeSelect(WORLD.W, WORLD.H);
    ctx.restore();
}

// ─────────────────────────── MAIN LOOP ─────────────────────────

let lastTs = 0;

function loop(ts) {
    const dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;

    tickAnim(dt);
    game.updateTimer();
    clf.updateTimer();
    anim.update(dt);

    // Item 10: skip draw when idle in pantallas estáticas
    const activeShunting = app.mode === 'shunting' &&
        (game.state === 'PLAYING' || game.state === 'WON' || anim.isActive);
    const activeClf = app.mode === 'classification' &&
        (clf.state === 'PLAYING' || clf.state === 'SUMMARY');
    const needsRender = renderNeeded
        || activeShunting || activeClf
        || game._dirty || clf._dirty
        || Math.abs(game.scrollVel)   > 0.5 || Math.abs(game.lbScrollVel) > 0.5
        || Math.abs(clf.scrollVel)    > 0.5 || Math.abs(clf.lbScrollVel)  > 0.5;

    if (needsRender) {
        renderNeeded = false;
        game._dirty  = false;
        clf._dirty   = false;
        render();
    }

    requestAnimationFrame(loop);
}

// ─────────────────────────── STARTUP ───────────────────────────

setupLogin();
resize();
requestAnimationFrame(loop);
