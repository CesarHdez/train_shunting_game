// js/classification/renderer.js — Modo Clasificación: funciones de dibujo

import { clf, COLORES, TIPOS, parseCar, saltosDeVia, starsForScore } from './state.js';
import { ctx, C, WORLD, animTime, rr, fillRR, strokeRR, txt, drawStar, formatTime,
         drawButton, drawTrack, getMenuLayout } from '../core/canvas.js';
import { particles } from '../core/particles.js';
import { app } from '../core/app.js';

const CAR_H = 40;

// ─────────────────────── LAYOUT ────────────────────────────────
// Calcula posiciones de filas y tamaños de carros; lo usan renderer e input.

export function getClfLayout() {
    const trackW  = 600;
    const trackSX = (WORLD.W - trackW) / 2;
    const A  = clf.arrivals.length;
    const Cn = clf.clasif.length;
    const total       = Math.max(A + Cn, 1);
    const topY        = 128;
    const labelGap    = 30;               // hueco para el rótulo de clasificación
    const bottomLimit = WORLD.H - 50;
    const spacing = Math.min(76, Math.floor((bottomLimit - topY - labelGap) / total));
    const arrY  = i => topY + i * spacing;
    const clasY = i => topY + A * spacing + labelGap + i * spacing;
    const dims = n => {
        const gap = 4;
        const w   = Math.min(56, Math.floor((trackW - (n - 1) * gap) / n));
        return { w, gap };
    };
    return {
        trackSX, trackW, spacing, A, Cn, arrY, clasY,
        arrCar:  dims(clf.arrSlots),
        clasCar: dims(clf.clasSlots),
        carH: CAR_H,
    };
}

export function clfCardH() { return 620; }

// ─────────────────────── CARROS ────────────────────────────────
// Dibuja un carro tipado (F/T/V/J/C) en el espacio 58×42 del diseño
// original, escalado al ancho disponible.

export function drawClfCar(x, y, code, w, highlighted = false) {
    const { tipo, color } = parseCar(code);
    const col = COLORES[color];
    if (!col) return;
    const s = w / 58;
    ctx.save();
    ctx.translate(x, y + (CAR_H - 42 * s) / 2);
    ctx.scale(s, s);
    if (highlighted) {
        const pulse = 0.5 + 0.5 * Math.sin(animTime * 5);
        ctx.shadowBlur = 10 + pulse * 10; ctx.shadowColor = C.AMBER;
    }

    ctx.lineWidth = 1.5;
    switch (tipo) {
        case 'F': { // furgón: caja con puerta corrediza
            fillRR(4, 6, 50, 22, 2, col.fill);
            strokeRR(4, 6, 50, 22, 2, col.dark, 1.5);
            ctx.globalAlpha = 0.55; fillRR(23, 9, 12, 16, 1, col.dark); ctx.globalAlpha = 1;
            ctx.strokeStyle = col.fill; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(29, 9); ctx.lineTo(29, 25); ctx.stroke();
            break;
        }
        case 'T': { // tanque: cilindro sobre bastidor
            fillRR(4, 24, 50, 4, 1, '#5A6472');
            fillRR(6, 8, 46, 17, 8.5, col.fill);
            strokeRR(6, 8, 46, 17, 8.5, col.dark, 1.5);
            fillRR(25, 4, 8, 6, 2, col.dark);
            break;
        }
        case 'V': { // tolva: trapecio
            ctx.beginPath();
            ctx.moveTo(4, 8); ctx.lineTo(54, 8); ctx.lineTo(54, 20);
            ctx.lineTo(44, 28); ctx.lineTo(14, 28); ctx.lineTo(4, 20);
            ctx.closePath();
            ctx.fillStyle = col.fill; ctx.fill();
            ctx.strokeStyle = col.dark; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.globalAlpha = 0.6; ctx.strokeStyle = col.dark;
            for (const lx of [19, 39]) {
                ctx.beginPath(); ctx.moveTo(lx, 8); ctx.lineTo(lx, 24); ctx.stroke();
            }
            ctx.globalAlpha = 1;
            break;
        }
        case 'J': { // jaula: listones verticales
            fillRR(4, 6, 50, 22, 2, col.dark);
            for (const lx of [9, 16, 23, 30, 37, 44]) fillRR(lx, 8, 4, 18, 1, col.fill);
            fillRR(4, 6, 50, 4, 2, col.fill);
            break;
        }
        case 'C': { // contenedor sobre plataforma
            fillRR(4, 24, 50, 4, 1, '#5A6472');
            fillRR(8, 8, 42, 16, 1, col.fill);
            strokeRR(8, 8, 42, 16, 1, col.dark, 1.5);
            ctx.globalAlpha = 0.5; ctx.strokeStyle = col.dark; ctx.lineWidth = 1;
            for (const lx of [15, 22, 29, 36, 43]) {
                ctx.beginPath(); ctx.moveTo(lx, 9); ctx.lineTo(lx, 23); ctx.stroke();
            }
            ctx.globalAlpha = 1;
            break;
        }
    }

    // Ruedas
    ctx.shadowBlur = 0;
    for (const wx of [14, 44]) {
        ctx.fillStyle = '#252B35'; ctx.beginPath(); ctx.arc(wx, 33, 5, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#6B7585'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#6B7585'; ctx.beginPath(); ctx.arc(wx, 33, 1.6, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
}

// ─────────────────────── MARCADORES ────────────────────────────

// Botón selector de vía de llegada (izquierda), estilo botón de locomotora
function drawArrivalSelector(x, y, isActive, isEmpty) {
    const w = 52, h = CAR_H - 4;
    if (isActive) { ctx.shadowBlur = 12; ctx.shadowColor = C.AMBER; }
    fillRR(x, y, w, h, 4, isActive ? '#7a5514' : (isEmpty ? '#1a1f2a' : C.LOCO_GREY));
    ctx.shadowBlur = 0;
    strokeRR(x, y, w, h, 4, isActive ? C.AMBER : 'rgba(255,255,255,0.1)', isActive ? 2 : 1.5);
    ctx.fillStyle = isActive ? C.AMBER : (isEmpty ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.45)');
    ctx.beginPath();
    ctx.moveTo(x+w/2-5, y+h/2-6); ctx.lineTo(x+w/2+7, y+h/2); ctx.lineTo(x+w/2-5, y+h/2+6);
    ctx.closePath(); ctx.fill();
}

// Marcador de entrada en una vía de clasificación (pulsa cuando se puede empujar)
function drawPushMarker(trackX, trackTopY, isTarget) {
    const mW = 6, mH = Math.round(CAR_H * 0.55);
    const mX = trackX - Math.ceil(mW / 2);
    const mY = trackTopY + (CAR_H - mH) / 2;
    if (isTarget) {
        const pulse = 0.5 + 0.5 * Math.sin(animTime * 3);
        ctx.shadowBlur = 8 + pulse * 10; ctx.shadowColor = 'rgba(105,240,174,0.9)';
        fillRR(mX, mY, mW, mH, 3, `rgba(105,240,174,${0.75 + 0.25*pulse})`);
        ctx.shadowBlur = 0;
        ctx.fillStyle  = `rgba(105,240,174,${0.6 + 0.4*pulse})`;
        const cy = trackTopY + CAR_H / 2;
        ctx.beginPath();
        ctx.moveTo(mX + mW + 2,  cy - 5);
        ctx.lineTo(mX + mW + 10, cy);
        ctx.lineTo(mX + mW + 2,  cy + 5);
        ctx.closePath(); ctx.fill();
    } else {
        fillRR(mX, mY, mW, mH, 3, 'rgba(200,208,218,0.18)');
    }
}

// ─────────────────────────── HUD ───────────────────────────────

function drawHUD(w, h) {
    ctx.fillStyle = C.HEADER_BG; ctx.fillRect(0, 0, w, 62);
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, 61, w, 1);

    drawButton(10,  11, 80,  38, '← MENÚ',      '#37474f');
    drawButton(100, 11, 105, 38, '↺ REINICIAR',  '#2c3e50');

    if (clf.history.length > 0) {
        drawButton(215, 11, 85, 38, '↩ DESHACER', C.UNDO_BTN);
    } else {
        ctx.fillStyle = 'rgba(74,20,140,0.3)'; rr(215, 11, 85, 38, 7); ctx.fill();
        txt('↩ DESHACER', 215+42, 11+38/2+6, Math.floor(38*0.38), 'rgba(255,255,255,0.25)', 'center', '700');
    }

    txt(`TURNO ${clf.levelNum}`, w/2, 42, 22, C.TEXT, 'center', '700');
    txt('TIEMPO',          w-110, 24, 11, C.TEXT_DIM, 'right', '600');
    txt(clf.getTimeStr(),  w-110, 50, 20, C.TEXT,     'right', '700');
    const parcial = clf.parcial();
    txt('PUNTOS',              w-10, 24, 11, C.TEXT_DIM, 'right', '600');
    txt(`${parcial.puntos}`,   w-10, 50, 20, C.AMBER,    'right', '700');

    // Barra de información
    ctx.fillStyle = C.TARGET_BG; ctx.fillRect(0, 62, w, 40);
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(0, 101, w, 1);
    const lvl = clf.levels[clf.levelNum];
    txt(lvl?.name || '', 12, 88, 15, C.TEXT, 'left', '600');
    txt(`POR CLASIFICAR: ${clf.remaining}`, w-12, 88, 14, C.TEXT_DIM, 'right', '600');

    // Próximo carro a empujar
    const via    = clf.arrivals[clf.viaSel];
    const cabeza = via && via[0];
    if (cabeza) {
        const p    = parseCar(cabeza);
        const col  = COLORES[p.color];
        const pre  = `Próximo: ${TIPOS[p.tipo]} · destino `;
        const name = col.nombre.toUpperCase();
        ctx.font = '600 14px Rajdhani,Arial,sans-serif';
        const preW = ctx.measureText(pre).width;
        ctx.font = '700 14px Rajdhani,Arial,sans-serif';
        const nameW  = ctx.measureText(name).width;
        const startX = w/2 - (preW + nameW)/2;
        txt(pre,  startX,        88, 14, C.TEXT_DIM, 'left', '600');
        txt(name, startX + preW, 88, 14, col.fill,   'left', '700');
    }
}

// ──────────────────────── GAME SCREEN ──────────────────────────

export function drawClfGameScreen(w, h) {
    drawHUD(w, h);
    const L = getClfLayout();

    // ── Vías de llegada ──
    txt('VÍAS DE LLEGADA — elige la vía a trabajar', L.trackSX, L.arrY(0) - 10, 12, C.TEXT_DIM, 'left', '700');
    for (let i = 0; i < clf.arrivals.length; i++) {
        const ty  = L.arrY(i);
        const via = clf.arrivals[i];
        const isActive = i === clf.viaSel;

        drawTrack(L.trackSX, ty + CAR_H / 2, L.trackW);
        drawArrivalSelector(L.trackSX - 62, ty + 2, isActive, via.length === 0);

        if (isActive) {
            strokeRR(L.trackSX - 68, ty - 5, L.trackW + 76, CAR_H + 10, 6, 'rgba(245,166,35,0.45)', 1.5);
        }

        if (via.length === 0) {
            txt('Vía vacía', L.trackSX + 10, ty + 26, 13, 'rgba(255,255,255,0.25)', 'left', '600');
        } else {
            for (let j = 0; j < via.length; j++) {
                const cx = L.trackSX + j * (L.arrCar.w + L.arrCar.gap);
                drawClfCar(cx, ty, via[j], L.arrCar.w, isActive && j === 0);
            }
        }
    }

    // ── Vías de clasificación ──
    const clasLabelY = L.clasY(0) - 10;
    txt('VÍAS DE CLASIFICACIÓN — toca una para enviar el carro', L.trackSX, clasLabelY, 12, C.TEXT_DIM, 'left', '700');

    const via     = clf.arrivals[clf.viaSel];
    const cabeza  = clf.state === 'PLAYING' && via && via.length > 0;

    for (let i = 0; i < clf.clasif.length; i++) {
        const ty    = L.clasY(i);
        const cars  = clf.clasif[i];
        const cap   = clf.capacities[i];
        const llena = cars.length >= cap;
        const s     = saltosDeVia(cars);

        drawTrack(L.trackSX, ty + CAR_H / 2, L.trackW);
        drawPushMarker(L.trackSX, ty, !!cabeza && !llena);

        // Nombre de la vía a la izquierda
        txt(`VÍA ${String.fromCharCode(65 + i)}`, L.trackSX - 36, ty + 26, 13,
            llena ? C.CAPACITY_FULL : C.TEXT_DIM, 'center', '700');

        // Ranuras vacías (capacidad restante)
        ctx.setLineDash([5, 4]);
        for (let j = cars.length; j < cap; j++) {
            const cx = L.trackSX + j * (L.clasCar.w + L.clasCar.gap);
            strokeRR(cx + 2, ty + 4, L.clasCar.w - 4, CAR_H - 12, 4, 'rgba(255,255,255,0.13)', 1.5);
        }
        ctx.setLineDash([]);

        for (let j = 0; j < cars.length; j++) {
            const cx = L.trackSX + j * (L.clasCar.w + L.clasCar.gap);
            drawClfCar(cx, ty, cars[j], L.clasCar.w, false);
        }

        // Ocupación y saltos a la derecha
        txt(`${cars.length}/${cap}${llena ? ' · LLENA' : ''}`,
            L.trackSX + L.trackW + 14, ty + 18, 13,
            llena ? C.CAPACITY_FULL : C.CAPACITY_OK, 'left', '600');
        if (s > 0) {
            txt(`${s} salto${s > 1 ? 's' : ''}`, L.trackSX + L.trackW + 14, ty + 34, 12, C.TEXT_WARN, 'left', '600');
        } else if (cars.length > 0) {
            txt('pura +30', L.trackSX + L.trackW + 14, ty + 34, 12, C.SUCCESS, 'left', '600');
        }
    }

    // Pie: recordatorio de reglas
    txt('Solo puedes empujar el PRIMER carro de la vía seleccionada · salto de color −15 · vía de un solo color +30',
        w/2, h - 14, 12, 'rgba(255,255,255,0.35)', 'center', '600');

    if (clf.message) {
        fillRR(w/2-170, h-120, 340, 38, 8, 'rgba(198,40,40,0.92)');
        txt(clf.message, w/2, h-97, 15, '#fff', 'center', '700');
    }

    if (clf.state === 'SUMMARY') {
        if (!clf.winSpawned) { particles.spawnConfetti(w/2, h/3); clf.winSpawned = true; }
        particles.update();
        drawClfSummary(w, h);
    }
}

// ─────────────────────── SUMMARY SCREEN ────────────────────────

export function drawClfSummary(w, h) {
    ctx.fillStyle = C.WIN_OVERLAY; ctx.fillRect(0, 0, w, h);
    particles.draw(ctx);
    const cardW = Math.min(600, w-40), cardH = clfCardH();
    const cardX = w/2 - cardW/2,       cardY = h/2 - cardH/2;
    fillRR(cardX, cardY, cardW, cardH, 16, '#0f1525');
    strokeRR(cardX, cardY, cardW, cardH, 16,
        clf.newRecord ? 'rgba(255,215,0,0.6)' : 'rgba(245,166,35,0.35)', 2);
    if (clf.newRecord) {
        const glow = 0.5 + 0.5 * Math.sin(animTime * 4);
        ctx.shadowBlur = 20 + glow * 20; ctx.shadowColor = C.GOLD;
        strokeRR(cardX, cardY, cardW, cardH, 16, 'rgba(255,215,0,0.3)', 1);
        ctx.shadowBlur = 0;
    }

    const res = clf.lastResult || { puntos: 0, saltos: 0, purasBonus: 0, carros: 0 };
    const max = clf.maxScore(clf.levelNum);
    const stars = starsForScore(res.puntos, max);
    const lvl = clf.levels[clf.levelNum];

    txt('REPORTE DEL DESPACHADOR', w/2, cardY+34, 13, C.TEXT_DIM, 'center', '700');
    txt(lvl?.name || `TURNO ${clf.levelNum}`, w/2, cardY+64, Math.min(28, cardW*0.05), C.SUCCESS, 'center', '700');
    for (let s = 0; s < 3; s++) drawStar(w/2-40+s*42, cardY+94, 18, s < stars);

    if (clf.newRecord) {
        fillRR(w/2-100, cardY+116, 200, 26, 13, 'rgba(255,215,0,0.12)');
        strokeRR(w/2-100, cardY+116, 200, 26, 13, 'rgba(255,215,0,0.5)');
        txt('★  ¡NUEVO RÉCORD!  ★', w/2, cardY+134, 14, C.GOLD, 'center', '700');
    }

    txt(`${res.puntos}`, w/2, cardY+192, 46, C.AMBER, 'center', '700');
    txt(`de ${max} posibles   ·   TIEMPO: ${clf.getTimeStr()}`, w/2, cardY+214, 13, C.TEXT_DIM, 'center', '600');

    // Desglose
    const bx = w/2 - 130, bw = 260;
    let by = cardY + 236;
    txt('Carros clasificados', bx, by, 14, C.TEXT, 'left', '600');
    txt(`+${res.carros * 10}`,  bx + bw, by, 14, C.TEXT, 'right', '700');
    by += 21;
    txt(`Saltos de color (${res.saltos})`, bx, by, 14, res.saltos ? C.TEXT_WARN : C.TEXT_DIM, 'left', '600');
    txt(`−${res.saltos * 15}`,             bx + bw, by, 14, res.saltos ? C.TEXT_WARN : C.TEXT_DIM, 'right', '700');
    by += 21;
    txt('Vías de un solo color', bx, by, 14, C.SUCCESS, 'left', '600');
    txt(`+${res.purasBonus}`,    bx + bw, by, 14, C.SUCCESS, 'right', '700');

    // Ranking
    const lbY = cardY + 306, lbH = cardH - 306 - 70;
    fillRR(cardX+16, lbY, cardW-32, lbH, 8, 'rgba(0,0,0,0.3)');
    const globalBoard = clf.globalLeaderboard[clf.levelNum];
    const isGlobal    = !!globalBoard;
    const board       = globalBoard || clf.scores.getLeaderboard(clf.levelNum);
    const boardLabel  = isGlobal ? `RANKING GLOBAL — TURNO ${clf.levelNum}` : `PUNTAJES — TURNO ${clf.levelNum}`;
    txt(boardLabel, w/2, lbY+20, 13, isGlobal ? C.SUCCESS : C.TEXT_DIM, 'center', '700');
    if (clf.winLbLoading) {
        txt('Cargando ranking global…', w/2, lbY+lbH/2+6, 13, C.TEXT_DIM, 'center', '600');
    } else {
        const medC = [C.GOLD, C.SILVER, C.BRONZE];
        board.slice(0, 10).forEach((entry, i) => {
            const ey = lbY + 38 + i*19;
            if (ey > lbY + lbH - 6) return;
            const isMe = !!(clf.scores.lastUid && entry.uid === clf.scores.lastUid);
            if (isMe) { ctx.fillStyle = 'rgba(79,195,247,0.08)'; ctx.fillRect(cardX+16, ey-13, cardW-32, 19); }
            const ec = isMe ? '#4fc3f7' : (medC[i] || C.TEXT_DIM), ew = isMe ? '700' : '600';
            txt(`${i+1}.`,      cardX+30, ey, 14, ec, 'left',  ew);
            txt(entry.name,     cardX+60, ey, 14, ec, 'left',  ew);
            txt(`${entry.score ?? 0} pts`, w/2+40, ey, 13, ec, 'center', ew);
            txt(formatTime(entry.time),    cardX+cardW-30, ey, 12, ec, 'right', ew);
        });
        if (!board.length) txt('¡Primer intento!', w/2, lbY+lbH/2+6, 16, C.TEXT_DIM, 'center', '600');
    }

    const btnY = cardY + cardH - 58;
    drawButton(w/2-220, btnY, 125, 44, '↺ REPETIR', '#37474f');
    drawButton(w/2-60,  btnY, 120, 44, '≡ MENÚ',    '#1a237e');
    if (clf.levels[clf.levelNum+1]) drawButton(w/2+80, btnY, 140, 44, 'SIGUIENTE →', '#1b5e20');
    else txt('🎉 ¡PATIO COMPLETADO!', w/2+150, btnY+28, 18, C.GOLD, 'center', '700');
}

// ─────────────────────────── MENU ──────────────────────────────

export function drawClfMenu(w, h) {
    ctx.globalAlpha = 0.15; drawTrack(0, 50, w); drawTrack(0, 160, w); ctx.globalAlpha = 1;
    ctx.fillStyle = C.HEADER_BG; ctx.fillRect(0, 0, w, 200);
    ctx.fillStyle = 'rgba(245,166,35,0.08)'; ctx.fillRect(0, 199, w, 1);
    ctx.shadowBlur = 30; ctx.shadowColor = 'rgba(245,166,35,0.3)';
    txt('PATIO DE CLASIFICACIÓN', w/2, 72, Math.min(48, w*0.05), C.AMBER, 'center', '700');
    ctx.shadowBlur = 0;
    txt('CLASIFICA LOS VAGONES POR COLOR DE DESTINO', w/2, 100, 15, C.TEXT_DIM, 'center', '600');
    drawButton(12, 12, 110, 42, '← MODOS', '#37474f');
    if (app.playerName) {
        txt(`Jugador: ${app.playerName}`, w/2, 132, 18, C.TEXT, 'center', '600');
        const done  = clf.scores.completedCount();
        const total = Object.keys(clf.levels).length;
        const barW  = Math.min(300, w*0.55), barX = w/2 - barW/2;
        fillRR(barX, 148, barW, 10, 5, 'rgba(255,255,255,0.08)');
        fillRR(barX, 148, barW * (done / Math.max(total, 1)), 10, 5, C.AMBER);
        txt(`${done}/${total} completados`, w/2, 176, 13, C.TEXT_DIM, 'center', '600');
    }
    drawButton(w-200, 12, 188, 42, '🏆 TABLA DE PUNTAJES', '#1a237e');

    const layout = getMenuLayout(w, h);
    const { cols, btnW, btnH, gapX, gapY, startX, startY: base, visibleH } = layout;
    const startY = base + clf.scrollY;
    const ids = Object.keys(clf.levels).map(Number).sort((a, b) => a - b);
    const totalRows = Math.ceil(ids.length / cols), contentH = totalRows * (btnH + gapY);
    clf.maxScroll = Math.max(0, contentH - visibleH + 50);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 200, w, h-200); ctx.clip();
    ids.forEach((lid, idx) => {
        const row = Math.floor(idx / cols), col = idx % cols;
        const x = startX + col * (btnW + gapX), y = startY + row * (btnH + gapY);
        if (y + btnH < 200 || y > h) return;
        drawClfLevelCard(x, y, btnW, btnH, lid, clf.getStars(lid), clf.scores.getBest(lid));
    });
    if (!ids.length) txt('Cargando niveles…', w/2, 370, 22, C.TEXT_DIM, 'center', '600');
    ctx.restore();
    if (clf.maxScroll > 0) {
        const prog = -clf.scrollY / clf.maxScroll;
        const barH = Math.max(40, (h-200) * (h-200) / (contentH + h - 200));
        fillRR(w-7, 205 + prog*(h-205-barH), 5, barH, 3, 'rgba(255,255,255,0.15)');
    }
}

function drawClfLevelCard(x, y, w, h, lid, stars, best) {
    fillRR(x+2, y+3, w, h, 9, 'rgba(0,0,0,0.35)');
    fillRR(x,   y,   w, h, 9, C.CARD);
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(x+2, y+2, w-4, h*0.45);
    const borderC = [C.LOCO_GREY, '#6d4c41', '#607d8b', C.GOLD];
    if (ctx.roundRect) {
        ctx.fillStyle = borderC[stars]; ctx.beginPath(); ctx.roundRect(x, y, 4, h, [9, 0, 0, 9]); ctx.fill();
    } else {
        ctx.fillStyle = borderC[stars]; ctx.fillRect(x, y, 4, h);
    }
    txt('TURNO', x+w/2, y+20,   Math.min(10, w*0.08), C.TEXT_DIM, 'center', '600');
    txt(`${lid}`, x+w/2, y+44,  Math.min(26, w*0.2),  stars > 0 ? C.TEXT : C.TEXT_DIM, 'center', '700');
    const sr = Math.min(7, w*0.055), sp = sr*2.2, sx = x + w/2 - sp;
    for (let s = 0; s < 3; s++) drawStar(sx + s*sp, y+h-26, sr, s < stars);
    if (best) txt(`${best.score ?? 0}pts`, x+w/2, y+h-8, Math.min(11, w*0.085), C.TEXT_DIM, 'center', '600');
    strokeRR(x, y, w, h, 9, 'rgba(255,255,255,0.06)');
}

// ─────────────────────── LEADERBOARD ───────────────────────────

export function drawClfLeaderboard(w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, w, 74);
    txt('PUNTAJES — CLASIFICACIÓN', w/2, 50, Math.min(34, w*0.04), C.AMBER, 'center', '700');
    drawButton(20, 16, 130, 42, '← VOLVER', '#37474f');
    if (clf.globalLbLoading) {
        txt('Cargando ranking global…', w-20, 54, 12, C.TEXT_DIM, 'right', '600');
    }
    const ids = Object.keys(clf.levels).map(Number).sort((a, b) => a - b)
                    .filter(id => clf.scores.isCompleted(id));
    if (!ids.length) { txt('Aún no has completado ningún turno.', w/2, h/2, 22, C.TEXT_DIM, 'center', '600'); return; }
    const rowH = 68, totalH = ids.length * rowH;
    clf.lbMaxScroll = Math.max(0, totalH - (h - 80) + 20);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 74, w, h-74); ctx.clip();
    const baseY = 80 + clf.lbScrollY;
    ids.forEach((lid, idx) => {
        const y = baseY + idx * rowH; if (y + rowH < 74 || y > h) return;
        const stars       = clf.getStars(lid);
        const globalBoard = clf.globalLeaderboard[lid];
        const board       = globalBoard || clf.scores.getLeaderboard(lid);
        const isGlobal    = !!globalBoard;
        ctx.fillStyle = idx % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'transparent';
        ctx.fillRect(0, y, w, rowH);
        fillRR(16, y+10, 58, 48, 6, 'rgba(255,255,255,0.05)');
        txt('TUR', 45, y+28, 10, C.TEXT_DIM, 'center', '600');
        txt(`${lid}`, 45, y+50, 20, C.TEXT, 'center', '700');
        for (let s = 0; s < 3; s++) drawStar(90 + s*18, y+34, 7, s < stars);
        txt(isGlobal ? 'GLOBAL' : 'LOCAL', 90, y+54, 8, isGlobal ? C.SUCCESS : C.TEXT_DIM, 'center', '600');
        const medC = [C.GOLD, C.SILVER, C.BRONZE];
        board.slice(0, 3).forEach((e, i) => {
            const ex = 145 + i * Math.min(190, (w-145) / 3);
            fillRR(ex, y+14, Math.min(175, (w-155)/3), 40, 6, 'rgba(255,255,255,0.04)');
            txt(`${i+1}. ${e.name}`, ex+8, y+32, 13, medC[i], 'left', '700');
            txt(`${e.score ?? 0}pts  ·  ${formatTime(e.time)}`, ex+8, y+50, 12, C.TEXT_DIM, 'left', '600');
        });
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, y+rowH-1); ctx.lineTo(w, y+rowH-1); ctx.stroke();
    });
    ctx.restore();
    if (clf.lbMaxScroll > 0) {
        const prog = -clf.lbScrollY / clf.lbMaxScroll;
        const bH   = Math.max(40, (h-74) * (h-74) / (totalH + h - 74));
        fillRR(w-7, 78 + prog*(h-74-bH), 5, bH, 3, 'rgba(255,255,255,0.15)');
    }
}

// ─────────────────────── RENDER FRAME ──────────────────────────

export function renderClassification(w, h) {
    const state = clf.state;
    if      (state === 'MENU')        drawClfMenu(w, h);
    else if (state === 'LEADERBOARD') drawClfLeaderboard(w, h);
    else                              drawClfGameScreen(w, h);
}
