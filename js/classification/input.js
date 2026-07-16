// js/classification/input.js — Modo Clasificación: lógica de clicks

import { clf } from './state.js';
import { inRect, getMenuLayout } from '../core/canvas.js';
import { getClfLayout, clfCardH } from './renderer.js';
import { app } from '../core/app.js';

// Procesa el click en coordenadas de mundo (wx, wy).
export function handleClassificationClick(wx, wy, w, h) {
    if (clf.state === 'MENU') {
        if (inRect(wx, wy, 12, 12, 110, 42)) { app.mode = null; return; } // ← MODOS
        if (inRect(wx, wy, w-200, 12, 188, 42)) {
            clf.state = 'LEADERBOARD'; clf.lbScrollY = 0; clf.loadGlobalLeaderboard(); return;
        }
        const layout = getMenuLayout(w, h);
        const { cols, btnW, btnH, gapX, gapY, startX, startY: base } = layout;
        const startY = base + clf.scrollY;
        const ids    = Object.keys(clf.levels).map(Number).sort((a, b) => a - b);
        ids.forEach((lid, idx) => {
            const row = Math.floor(idx / cols), col = idx % cols;
            const x   = startX + col * (btnW + gapX), y = startY + row * (btnH + gapY);
            if (y + btnH < 200 || y > h) return;
            if (inRect(wx, wy, x, y, btnW, btnH)) clf.startLevel(lid);
        });
        return;
    }

    if (clf.state === 'LEADERBOARD') {
        if (inRect(wx, wy, 20, 20, 130, 42)) { clf.state = 'MENU'; return; }
        return;
    }

    if (clf.state === 'SUMMARY') {
        const cardH = clfCardH(), cardY = h/2 - cardH/2, btnY = cardY + cardH - 58;
        if (inRect(wx, wy, w/2-220, btnY, 125, 44)) { clf.startLevel(clf.levelNum); return; }
        if (inRect(wx, wy, w/2-60,  btnY, 120, 44)) { clf.state = 'MENU'; return; }
        if (clf.levels[clf.levelNum+1] && inRect(wx, wy, w/2+80, btnY, 140, 44)) {
            clf.startLevel(clf.levelNum+1); return;
        }
        return;
    }

    if (clf.state === 'PLAYING') {
        // Botones del HUD
        if (inRect(wx, wy, 10, 11, 80, 38))   { clf.state = 'MENU'; return; }
        if (inRect(wx, wy, 100, 11, 105, 38)) { clf.startLevel(clf.levelNum); return; }
        if (clf.history.length > 0 && inRect(wx, wy, 215, 11, 85, 38)) { clf.deshacer(); return; }

        const L = getClfLayout();

        // Vías de llegada: seleccionar (botón selector o toda la fila)
        for (let i = 0; i < clf.arrivals.length; i++) {
            const ty = L.arrY(i);
            if (inRect(wx, wy, L.trackSX - 70, ty - 5, L.trackW + 80, L.carH + 10)) {
                clf.selectArrival(i);
                return;
            }
        }

        // Vías de clasificación: empujar la cabeza
        for (let i = 0; i < clf.clasif.length; i++) {
            const ty = L.clasY(i);
            if (inRect(wx, wy, L.trackSX - 70, ty - 5, L.trackW + 80, L.carH + 10)) {
                clf.empujar(i);
                return;
            }
        }
    }
}
