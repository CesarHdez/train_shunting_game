// js/main.js — Input handling, game loop, and startup

import { CONFIG, game, anim, getCarDims } from './state.js';
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

function handleTutorialClick(wx, wy, w, h) {
    const trackSX = (CONFIG.DEFAULT_WIDTH - CONFIG.TRACK_WIDTH) / 2;
    const trackSY = CONFIG.HUD_HEIGHT;

    // Modal steps (0, 1): block all clicks except NEXT and SKIP
    if (game.tutModal <= 1) {
        const cardW = Math.min(500, w - 40), cardH = 255;
        const cardX = w / 2 - cardW / 2, cardY = h / 2 - cardH / 2;
        const btnX = w / 2 - 90, btnY = cardY + cardH - 70;
        if (inRect(wx, wy, btnX, btnY, 180, 44))           { game.advanceTutModal(); return true; }
        if (inRect(wx, wy, w/2 - 70, btnY + 58, 140, 22)) { game.skipTutorial();    return true; }
        return true; // block everything else
    }

    // Skip button (steps 2–4)
    if (inRect(wx, wy, w - 130, h - 157, 110, 44)) { game.skipTutorial(); return true; }

    // Step 2: only allow loco button for the track containing car A
    if (game.tutModal === 2) {
        const tA = game.tracks.findIndex(t => t.some(c => c === 'A'));
        if (tA >= 0) {
            const ty = trackSY + tA * CONFIG.TRACK_SPACING;
            if (inRect(wx, wy, trackSX - 62, ty + 2, 52, CONFIG.CAR_HEIGHT - 4)) {
                game.positionLocomotive(tA);
                game.selectedCars.clear(); // reset auto-selection so step 3 teaches manual selection
                game.tutModal = 3;
                return true;
            }
        }
        return true; // silently block
    }

    // Step 3: only allow clicking car A
    if (game.tutModal === 3) {
        const tA = game.locoTrack;
        if (tA >= 0) {
            const colA = game.tracks[tA].indexOf('A');
            if (colA >= 0) {
                const { w: cW, gap: cG } = getCarDims(game.capacity);
                const ty = trackSY + tA * CONFIG.TRACK_SPACING;
                if (inRect(wx, wy, trackSX + colA * (cW + cG), ty, cW, CONFIG.CAR_HEIGHT)) {
                    game.selectCar(tA, colA);
                    game.tutModal = 4;
                    return true;
                }
            }
        }
        return true; // silently block
    }

    // Step 4: only allow moving to a valid destination track
    if (game.tutModal === 4) {
        for (let i = 0; i < game.tracks.length; i++) {
            if (i === game.locoTrack) continue;
            const ty = trackSY + i * CONFIG.TRACK_SPACING;
            if (inRect(wx, wy, trackSX - 62, ty + 2, 52, CONFIG.CAR_HEIGHT - 4) ||
                inRect(wx, wy, trackSX - 4, ty - 4, CONFIG.TRACK_WIDTH + 8, CONFIG.CAR_HEIGHT + 8)) {
                game.moveSelected(i);
                game.tutModal = -1;
                localStorage.setItem('train_tutorial_done', '1');
                return true;
            }
        }
        return true; // silently block
    }

    return false;
}

function handleClick(mx, my) {
    const wx = (mx - camera.x) / camera.zoom, wy = (my - camera.y) / camera.zoom;
    const w  = CONFIG.DEFAULT_WIDTH, h = CONFIG.DEFAULT_HEIGHT;
    markDirty();

    if (game.tutModal >= 0 && game.state === 'PLAYING') {
        if (handleTutorialClick(wx, wy, w, h)) return;
    }

    if (game.state === 'MENU') {
        if (inRect(wx, wy, w-200, 12, 188, 42)) { game.state = 'LEADERBOARD'; game.lbScrollY = 0; game.loadGlobalLeaderboard(); return; }
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
            const { w: carW, gap: carGap } = getCarDims(game.capacity);
            const track = game.tracks[i];
            for (let j = 0; j < track.length; j++) {
                if (track[j] === '') continue;
                const cx = trackSX + j * (carW + carGap);
                if (inRect(wx, wy, cx, ty, carW, CONFIG.CAR_HEIGHT)) {
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
