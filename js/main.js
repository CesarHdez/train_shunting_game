// js/main.js — Input handling, game loop, and startup

import { CONFIG, game, anim } from './state.js';
import { canvas, camera, resize, inRect, getMenuLayout, winCardH, tickAnim, render } from './renderer.js';

// ─────────────────── IDLE DETECTION (Item 10) ──────────────────
// Render is skipped when nothing is moving in MENU/LEADERBOARD.
// Input events and async level loads call markDirty() to trigger a frame.

let renderNeeded = true;
function markDirty() { renderNeeded = true; }

// ──────────────────────── INPUT STATE ──────────────────────────

let dragMoved = false, downX = 0, downY = 0;

function onPointerDown(x, y) {
    camera.isDragging = true; camera.lastX = x; camera.lastY = y;
    dragMoved = false; downX = x; downY = y;
}

function onPointerMove(x, y) {
    if (!camera.isDragging) return;
    const dy = y - camera.lastY;
    if (Math.abs(x - downX) > 5 || Math.abs(y - downY) > 5) dragMoved = true;
    const wdy = dy / camera.zoom;
    if      (game.state === 'MENU')        { game.scrollY   += wdy; game.scrollVel   = wdy; }
    else if (game.state === 'LEADERBOARD') { game.lbScrollY += wdy; game.lbScrollVel = wdy; }
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
    if      (game.state === 'MENU')        game.scrollY   -= wdelta;
    else if (game.state === 'LEADERBOARD') game.lbScrollY -= wdelta;
    markDirty();
}, { passive: false });

window.addEventListener('resize', () => { resize(); markDirty(); });

// ───────────────────────── CLICK LOGIC ─────────────────────────

function handleClick(mx, my) {
    const wx = (mx - camera.x) / camera.zoom, wy = (my - camera.y) / camera.zoom;
    const w  = CONFIG.DEFAULT_WIDTH, h = CONFIG.DEFAULT_HEIGHT;
    markDirty();

    if (game.state === 'MENU') {
        if (inRect(wx, wy, w-200, 12, 188, 42)) { game.state = 'LEADERBOARD'; game.lbScrollY = 0; return; }
        const layout  = getMenuLayout(w, h);
        const { cols, btnW, btnH, gapX, gapY, startX, startY: base } = layout;
        const startY  = base + game.scrollY;
        const ids     = Object.keys(game.levels).map(Number).sort((a, b) => a - b);
        ids.forEach((lid, idx) => {
            const row = Math.floor(idx / cols), col = idx % cols;
            const x   = startX + col * (btnW + gapX), y = startY + row * (btnH + gapY);
            if (y + btnH < 200 || y > h) return;
            if (inRect(wx, wy, x, y, btnW, btnH)) game.startLevel(lid);
        });
        return;
    }

    if (game.state === 'LEADERBOARD') {
        if (inRect(wx, wy, 20, 20, 130, 42)) { game.state = 'MENU'; return; }
        return;
    }

    if (game.state === 'PLAYING' || game.state === 'WON') {
        if (inRect(wx, wy, 10, 11, 80, 38)) { game.state = 'MENU'; return; }

        if (game.state === 'PLAYING') {
            if (inRect(wx, wy, 100, 11, 105, 38)) { game.startLevel(game.levelNum); return; }
            if (game.history.length > 0 && !anim.isActive) {
                if (inRect(wx, wy, 215, 11, 85, 38)) { game.undo(); return; }
            }
            if (inRect(wx, wy, w/2-110, h-52, 105, 40)) { game.startLevel(game.levelNum); return; }
        }

        if (game.state === 'WON') {
            const cardH = winCardH(w), cardY = h/2 - cardH/2, btnY = cardY + cardH - 58;
            if (inRect(wx, wy, w/2-220, btnY, 125, 44)) { game.startLevel(game.levelNum); return; }
            if (inRect(wx, wy, w/2-60,  btnY, 120, 44)) { game.state = 'MENU'; return; }
            if (game.levels[game.levelNum+1] && inRect(wx, wy, w/2+80, btnY, 140, 44)) {
                game.startLevel(game.levelNum+1); return;
            }
            return;
        }

        const trackSX = (CONFIG.DEFAULT_WIDTH - CONFIG.TRACK_WIDTH) / 2;
        const trackSY = CONFIG.HUD_HEIGHT;
        const hasMoveLeft  = !anim.isActive && game.locoTrack !== -1 && game.selectedCars.size > 0;
        const hasMoveRight = !anim.isActive && game.hasRightLoco &&
                             game.rightLocoTrack !== -1 && game.rightSelectedCars.size > 0;
        const rightLocoX   = trackSX + CONFIG.TRACK_WIDTH + 10;

        for (let i = 0; i < game.tracks.length; i++) {
            const ty    = trackSY + i * CONFIG.TRACK_SPACING;
            const locoX = trackSX - 62;

            // Left loco button
            if (inRect(wx, wy, locoX, ty+2, 52, CONFIG.CAR_HEIGHT-4)) {
                if (hasMoveLeft && i !== game.locoTrack) game.moveSelected(i);
                else game.positionLocomotive(i);
                return;
            }

            // Right loco button
            if (game.hasRightLoco && inRect(wx, wy, rightLocoX, ty+2, 52, CONFIG.CAR_HEIGHT-4)) {
                if (hasMoveRight && i !== game.rightLocoTrack) game.moveSelectedRight(i);
                else game.positionLocomotiveRight(i);
                return;
            }

            // Click on a different track's area — move selected cars there
            if (hasMoveLeft && i !== game.locoTrack) {
                if (inRect(wx, wy, trackSX-4, ty-4, CONFIG.TRACK_WIDTH+8, CONFIG.CAR_HEIGHT+8)) {
                    game.moveSelected(i); return;
                }
            }
            if (hasMoveRight && i !== game.rightLocoTrack) {
                if (inRect(wx, wy, trackSX-4, ty-4, CONFIG.TRACK_WIDTH+8, CONFIG.CAR_HEIGHT+8)) {
                    game.moveSelectedRight(i); return;
                }
            }

            // Car click — adjust selection for whichever loco is on this track
            const track = game.tracks[i];
            for (let j = 0; j < track.length; j++) {
                if (track[j] === '') continue;
                const cx = trackSX + j * (CONFIG.CAR_WIDTH + CONFIG.CAR_SPACING);
                if (inRect(wx, wy, cx, ty, CONFIG.CAR_WIDTH, CONFIG.CAR_HEIGHT)) {
                    if (game.locoTrack === i)      game.selectCar(i, j);
                    if (game.rightLocoTrack === i) game.selectCarRight(i, j);
                    return;
                }
            }
        }
    }
}

// ─────────────────────────── MAIN LOOP ─────────────────────────

let lastTs = 0;

function loop(ts) {
    const dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;

    tickAnim(dt);
    game.updateTimer();
    anim.update(dt);

    // Item 10: skip draw when idle in MENU/LEADERBOARD
    const state = game.state;
    const needsRender = renderNeeded
        || state === 'PLAYING' || state === 'WON'
        || anim.isActive
        || game._dirty
        || Math.abs(game.scrollVel)   > 0.5
        || Math.abs(game.lbScrollVel) > 0.5;

    if (needsRender) {
        renderNeeded  = false;
        game._dirty   = false;
        render();
    }

    requestAnimationFrame(loop);
}

// ─────────────────────────── STARTUP ───────────────────────────

resize();
requestAnimationFrame(loop);
