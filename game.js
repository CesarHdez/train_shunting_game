// Game Configuration
const CONFIG = {
    DEFAULT_WIDTH: 1024,
    DEFAULT_HEIGHT: 768,
    TRACK_START_X: 150,
    TRACK_START_Y: 150,
    TRACK_SPACING: 80,
    CAR_WIDTH: 60,
    CAR_HEIGHT: 40,
    CAR_SPACING: 5,
    TRACK_WIDTH: 600,
    COLORS: {
        BG: "#F0F8FF",
        TRACK: "#646464",
        RAIL: "#A0A0A0",
        SLEEPER: "#8B4513",
        CAR: "#FF8C00",
        CAR_BORDER: "#643200",
        SELECTED: "#6495ED",
        LOCO_BTN: "#DC143C",
        LOCO_BTN_OFF: "#C8C8C8",
        TEXT: "#323232",
        BTN_TEXT: "#FFFFFF",
        MENU_BG: "#E6E6FA",
        RECORD: "#FFD700",
        CAPACITY_FULL: "#FF0000"
    }
};

class GameState {
    constructor() {
        this.state = "MENU"; // MENU, PLAYING, WON
        this.levels = {};
        this.scores = {};
        this.levelNum = 1;
        this.tracks = [];
        this.target = [];
        this.description = "";
        this.capacity = 8;

        this.playerName = ""; // Player Name

        this.locoTrack = -1;
        this.selectedCars = new Set(); // Stores strings "trackIdx,carIdx"

        this.moves = 0;
        this.startTime = 0;
        this.elapsedTime = 0;
        this.won = false;
        this.newRecord = false;
        this.message = "";
        this.messageTimer = 0;

        this.scrollY = 0;
        this.maxScroll = 0;

        this.loadScores();
        this.loadLevels();

        // Login Logic
        const overlay = document.getElementById('login-overlay');
        const input = document.getElementById('player-name');
        const btn = document.getElementById('start-btn');

        btn.addEventListener('click', () => {
            const name = input.value.trim();
            if (name) {
                this.playerName = name;
                overlay.style.display = 'none';
            } else {
                alert("Por favor ingresa un nombre.");
            }
        });
    }

    async loadLevels() {
        // Since we can't list directories easily without a manifest, 
        // we'll try to load levels 1 to 30 sequentially.
        for (let i = 1; i <= 30; i++) {
            try {
                const num = i.toString().padStart(2, '0');
                // Add timestamp to force cache bypass
                const response = await fetch(`levels/level_${num}.json?v=${Date.now()}`);
                if (response.ok) {
                    const data = await response.json();
                    this.levels[data.id] = data;
                }
            } catch (e) {
                console.warn(`Could not load level ${i}`, e);
            }
        }
        console.log(`Loaded ${Object.keys(this.levels).length} levels.`);
    }

    loadScores() {
        const stored = localStorage.getItem('train_shunting_scores');
        if (stored) {
            this.scores = JSON.parse(stored);
        }
    }

    saveScores() {
        localStorage.setItem('train_shunting_scores', JSON.stringify(this.scores));
    }

    startLevel(num) {
        if (!this.levels[num]) return;

        const data = this.levels[num];
        this.levelNum = num;
        // Deep copy tracks
        this.tracks = JSON.parse(JSON.stringify(data.tracks));
        this.target = [...data.targetSequence];
        this.description = data.description || "";
        this.capacity = data.capacity || 8;
        console.log(`DEBUG: Loaded Level ${num}, Capacity: ${this.capacity}, Tracks: ${this.tracks.length}`);

        this.locoTrack = -1;
        this.selectedCars.clear();
        this.moves = 0;
        this.startTime = Date.now();
        this.elapsedTime = 0;
        this.won = false;
        this.newRecord = false;
        this.message = "";
        this.state = "PLAYING";
    }

    updateTimer() {
        if (this.state === "PLAYING" && !this.won) {
            this.elapsedTime = Math.floor((Date.now() - this.startTime) / 1000);
        }
        if (this.messageTimer > 0) {
            this.messageTimer--;
            if (this.messageTimer === 0) this.message = "";
        }
    }

    getTimeStr() {
        const mins = Math.floor(this.elapsedTime / 60);
        const secs = this.elapsedTime % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    checkWin() {
        for (let track of this.tracks) {
            const cars = track.filter(c => c !== '');
            if (cars.length === this.target.length &&
                cars.every((val, index) => val === this.target[index])) {
                this.won = true;
                this.state = "WON";
                this.handleScore();
                return true;
            }
        }
        return false;
    }

    handleScore() {
        const lid = this.levelNum.toString();
        const currentMoves = this.moves;
        let isBest = false;

        if (!this.scores[lid]) {
            isBest = true;
        } else {
            if (currentMoves < this.scores[lid].moves) {
                isBest = true;
            }
        }

        if (isBest) {
            this.scores[lid] = {
                moves: currentMoves,
                time: this.elapsedTime,
                name: this.playerName
            };
            this.saveScores();
            this.newRecord = true;
        }
    }

    positionLocomotive(trackIdx) {
        if (this.won) return;
        this.locoTrack = trackIdx;
        this.selectedCars.clear();
        this.moves++;

        // Auto-select ALL cars
        const track = this.tracks[trackIdx];
        for (let i = 0; i < track.length; i++) {
            if (track[i] !== '') {
                this.selectedCars.add(`${trackIdx},${i}`);
            } else {
                break;
            }
        }
    }

    selectCar(trackIdx, carIdx) {
        if (this.won) return;
        if (this.locoTrack !== trackIdx) return;

        const track = this.tracks[trackIdx];
        let selectable = [];
        for (let i = 0; i < track.length; i++) {
            if (track[i] !== '') selectable.push(i);
            else break;
        }

        if (!selectable.includes(carIdx)) return;

        this.selectedCars.clear();
        for (let i = 0; i <= carIdx; i++) {
            if (selectable.includes(i)) {
                this.selectedCars.add(`${trackIdx},${i}`);
            }
        }
    }

    moveSelected(targetTrackIdx) {
        if (this.won) return;
        if (this.locoTrack === -1) return;
        if (this.selectedCars.size === 0) return;
        if (targetTrackIdx === this.locoTrack) return;

        const sourceTrackIdx = this.locoTrack;
        // Parse selected cars back to objects
        let selectedList = Array.from(this.selectedCars).map(s => {
            const [t, c] = s.split(',').map(Number);
            return { t, c };
        });
        selectedList.sort((a, b) => a.c - b.c);

        // Check Capacity
        const currentTargetCars = this.tracks[targetTrackIdx].filter(c => c !== '');
        if (currentTargetCars.length + selectedList.length > this.capacity) {
            this.message = "¡Vía llena! No caben más vagones.";
            this.messageTimer = 120;
            return;
        }

        let movingCars = [];
        for (let item of selectedList) {
            movingCars.push(this.tracks[sourceTrackIdx][item.c]);
            this.tracks[sourceTrackIdx][item.c] = '';
        }

        // Compact source track
        this.tracks[sourceTrackIdx] = this.tracks[sourceTrackIdx].filter(c => c !== '');
        while (this.tracks[sourceTrackIdx].length < this.capacity) {
            this.tracks[sourceTrackIdx].push('');
        }

        // Add to target
        const newTarget = [...movingCars, ...currentTargetCars];
        this.tracks[targetTrackIdx] = newTarget;
        while (this.tracks[targetTrackIdx].length < this.capacity) {
            this.tracks[targetTrackIdx].push('');
        }

        this.locoTrack = -1;
        this.selectedCars.clear();
        this.moves++;

        this.checkWin();
    }
}

// Renderer
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const game = new GameState();

function resize() {
    // Maintain aspect ratio or fill? Let's fill and center content logic
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Input Handling
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Calculate layout offsets (centering)
    const w = canvas.width;
    const h = canvas.height;

    if (game.state === "MENU") {
        // Scroll
        // Simple scroll handling via wheel event elsewhere, here just clicks

        // Exit (Top Right)
        if (mx > w - 100 && mx < w - 20 && my > 20 && my < 60) {
            // Can't really exit a web page, maybe reload?
            location.reload();
        }

        const cols = 5;
        const btnW = 140;
        const btnH = 80;
        const gapX = 20;
        const gapY = 20;
        const gridW = cols * btnW + (cols - 1) * gapX;
        const startX = (w - gridW) / 2;
        const startY = 250 + game.scrollY;

        const sortedIds = Object.keys(game.levels).map(Number).sort((a, b) => a - b);

        sortedIds.forEach((lid, idx) => {
            const row = Math.floor(idx / cols);
            const col = idx % cols;
            const x = startX + col * (btnW + gapX);
            const y = startY + row * (btnH + gapY);

            if (mx >= x && mx <= x + btnW && my >= y && my <= y + btnH) {
                game.startLevel(lid);
            }
        });

    } else if (game.state === "PLAYING" || game.state === "WON") {
        // Menu Button
        if (mx >= 20 && mx <= 100 && my >= 20 && my <= 50) {
            game.state = "MENU";
        }

        if (game.state === "PLAYING") {
            // Restart Header
            if (mx >= 110 && mx <= 190 && my >= 20 && my <= 50) {
                game.startLevel(game.levelNum);
            }

            const trackStartX = (w - CONFIG.TRACK_WIDTH) / 2;
            const trackStartY = 150;

            // Tracks & Cars
            for (let i = 0; i < game.tracks.length; i++) {
                const y = trackStartY + i * CONFIG.TRACK_SPACING;

                // Loco Button
                const btnX = trackStartX - 60;
                if (mx >= btnX && mx <= btnX + 50 && my >= y && my <= y + 40) {
                    game.positionLocomotive(i);
                }

                // Move Here Button
                if (game.locoTrack !== -1 && game.selectedCars.size > 0 && i !== game.locoTrack) {
                    const moveX = trackStartX - 180;
                    if (mx >= moveX && mx <= moveX + 110 && my >= y && my <= y + 40) {
                        game.moveSelected(i);
                    }
                }

                // Cars
                const track = game.tracks[i];
                for (let j = 0; j < track.length; j++) {
                    if (track[j] === '') continue;
                    const cx = trackStartX + j * (CONFIG.CAR_WIDTH + CONFIG.CAR_SPACING);
                    if (mx >= cx && mx <= cx + CONFIG.CAR_WIDTH && my >= y && my <= y + CONFIG.CAR_HEIGHT) {
                        game.selectCar(i, j);
                    }
                }
            }

            // Bottom Restart
            const resetX = w / 2 - 100;
            const resetY = h - 80;
            if (mx >= resetX && mx <= resetX + 90 && my >= resetY && my <= resetY + 40) {
                game.startLevel(game.levelNum);
            }
        }

        if (game.state === "WON") {
            // Next
            if (game.levels[game.levelNum + 1]) {
                const nextX = w / 2 + 10;
                const nextY = h - 80;
                if (mx >= nextX && mx <= nextX + 90 && my >= nextY && my <= nextY + 40) {
                    game.startLevel(game.levelNum + 1);
                }
            }

            // Replay
            const replayX = w / 2 - 100;
            const replayY = h - 80;
            if (mx >= replayX && mx <= replayX + 90 && my >= replayY && my <= replayY + 40) {
                game.startLevel(game.levelNum);
            }

            // Menu Overlay
            const menuX = w / 2 - 45;
            const menuY = h - 140;
            if (mx >= menuX && mx <= menuX + 90 && my >= menuY && my <= menuY + 40) {
                game.state = "MENU";
            }
        }
    }
});

window.addEventListener('wheel', (e) => {
    if (game.state === "MENU") {
        game.scrollY -= e.deltaY;
        if (game.scrollY > 0) game.scrollY = 0;
        if (game.scrollY < -game.maxScroll) game.scrollY = -game.maxScroll;
    }
});

// Drawing Helpers
function drawRect(x, y, w, h, color, radius = 0, border = null) {
    ctx.fillStyle = color;
    if (radius > 0) {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, radius);
        ctx.fill();
        if (border) {
            ctx.strokeStyle = border.color;
            ctx.lineWidth = border.width;
            ctx.stroke();
        }
    } else {
        ctx.fillRect(x, y, w, h);
        if (border) {
            ctx.strokeStyle = border.color;
            ctx.lineWidth = border.width;
            ctx.strokeRect(x, y, w, h);
        }
    }
}

function drawText(text, x, y, size, color, align = "left") {
    ctx.fillStyle = color;
    ctx.font = `${size}px Arial`;
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
}

function drawTrack(x, y, width) {
    // Sleepers
    const sleeperW = 10;
    const sleeperH = 30;
    const spacing = 20;
    for (let sx = x; sx < x + width; sx += spacing) {
        drawRect(sx, y - sleeperH / 2, sleeperW, sleeperH, CONFIG.COLORS.SLEEPER);
    }
    // Rails
    const railOffset = 8;
    ctx.strokeStyle = CONFIG.COLORS.RAIL;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y - railOffset);
    ctx.lineTo(x + width, y - railOffset);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y + railOffset);
    ctx.lineTo(x + width, y + railOffset);
    ctx.stroke();
}

// Car Visual Styles
const CAR_STYLES = {
    0: { name: "Boxcar", color: "#8B4513", detail: "#643200" },     // Brown
    1: { name: "Hopper", color: "#808080", detail: "#505050" },     // Gray
    2: { name: "Gondola", color: "#228B22", detail: "#145014" },    // Green
    3: { name: "Tanker", color: "#282828", detail: "#646464" },     // Black
    4: { name: "Container", color: "#505050", detail: "#C0C0C0" }   // Dark/Silver
};

function drawTrainIcon(x, y, color = CONFIG.COLORS.LOCO_BTN) {
    drawRect(x, y, 60, 40, color, 4);
    ctx.fillStyle = "#323232";
    ctx.fillRect(x + 40, y - 15, 20, 15);
    ctx.fillRect(x + 10, y - 10, 10, 10);

    ctx.beginPath(); ctx.arc(x + 15, y + 40, 10, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 45, y + 40, 10, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#505050";
    ctx.beginPath();
    ctx.moveTo(x, y + 40);
    ctx.lineTo(x - 10, y + 40);
    ctx.lineTo(x, y + 20);
    ctx.fill();
}

function drawCar(x, y, label, isSelected) {
    const w = CONFIG.CAR_WIDTH;
    const h = CONFIG.CAR_HEIGHT;

    // Determine Type
    const carType = label.charCodeAt(0) % 5;
    const style = CAR_STYLES[carType] || CAR_STYLES[0];

    let baseColor = style.color;
    let detailColor = style.detail;

    if (isSelected) {
        baseColor = CONFIG.COLORS.SELECTED;
        detailColor = "#000064";
    }

    // --- DRAWING ---

    // 0: Boxcar (Ribs)
    if (carType === 0) {
        drawRect(x, y, w, h, baseColor, 2, { color: detailColor, width: 2 });
        ctx.strokeStyle = detailColor;
        ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) {
            const lx = x + i * (w / 4);
            ctx.beginPath(); ctx.moveTo(lx, y + 2); ctx.lineTo(lx, y + h - 2); ctx.stroke();
        }
    }
    // 1: Hopper (Hatches)
    else if (carType === 1) {
        drawRect(x, y, w, h, baseColor, 2, { color: detailColor, width: 2 });
        ctx.fillStyle = detailColor;
        ctx.fillRect(x + 10, y + 8, 16, 24);
        ctx.fillRect(x + 34, y + 8, 16, 24);
    }
    // 2: Gondola (Open Top)
    else if (carType === 2) {
        drawRect(x, y, w, h, baseColor, 2);
        // Load
        ctx.fillStyle = detailColor;
        ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
        drawRect(x, y, w, h, "rgba(0,0,0,0)", 2, { color: detailColor, width: 2 }); // Border
        // Texture
        ctx.fillStyle = baseColor;
        for (let i = 0; i < 30; i += 8) {
            ctx.beginPath(); ctx.arc(x + 10 + i, y + 12, 3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(x + 20 + i, y + 28, 3, 0, Math.PI * 2); ctx.fill();
        }
    }
    // 3: Tanker (Capsule)
    else if (carType === 3) {
        // Platform
        ctx.strokeStyle = detailColor;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke();
        // Tank
        drawRect(x + 2, y + 4, w - 4, h - 8, baseColor, 12, { color: detailColor, width: 2 });
        // Dome
        ctx.fillStyle = detailColor;
        ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = detailColor;
        ctx.lineWidth = 1;
        ctx.stroke();
    }
    // 4: Container (Platform + Box)
    else if (carType === 4) {
        // Platform
        ctx.fillStyle = baseColor;
        ctx.fillRect(x, y + 10, w, 20);
        // Container
        drawRect(x + 5, y + 2, w - 10, h - 4, detailColor, 2, { color: baseColor, width: 2 });
        // Corrugated
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 1;
        for (let i = x + 10; i < x + w - 10; i += 5) {
            ctx.beginPath(); ctx.moveTo(i, y + 4); ctx.lineTo(i, y + h - 6); ctx.stroke();
        }
    }

    // Wheels
    const whW = 12;
    const whH = 6;
    ctx.fillStyle = "#1E1E1E";
    ctx.fillRect(x + 5, y - 3, whW, whH);
    ctx.fillRect(x + w - 5 - whW, y - 3, whW, whH);
    ctx.fillRect(x + 5, y + h - 3, whW, whH);
    ctx.fillRect(x + w - 5 - whW, y + h - 3, whW, whH);

    // Label with shadow
    ctx.fillStyle = "#000000";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "center";
    ctx.fillText(label, x + w / 2 + 1, y + h / 2 + 7); // Shadow

    ctx.fillStyle = CONFIG.COLORS.BTN_TEXT;
    ctx.fillText(label, x + w / 2, y + h / 2 + 6);
}

function drawButton(x, y, w, h, text, color) {
    drawRect(x, y, w, h, color, 4, { color: "rgba(0,0,0,0.3)", width: 2 });
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(x, y, w, h / 2);
    drawText(text, x + w / 2, y + h / 2 + 6, 16, CONFIG.COLORS.BTN_TEXT, "center");
}

function loop() {
    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.fillStyle = CONFIG.COLORS.BG;
    ctx.fillRect(0, 0, w, h);

    game.updateTimer();

    if (game.state === "MENU") {
        ctx.fillStyle = CONFIG.COLORS.MENU_BG;
        ctx.fillRect(0, 0, w, h);

        // --- Header (Fixed) ---
        drawTrainIcon(w / 2 - 30, 80);
        drawText("PATIO DE TRENES", w / 2, 160, 48, "#464664", "center");
        if (game.playerName) {
            drawText(`Hola, ${game.playerName}`, w / 2, 200, 20, "#323296", "center");
        }
        drawText("Selecciona un Nivel", w / 2, 230, 24, "#646478", "center");

        drawButton(w - 100, 20, 80, 40, "Salir", "#C83232");

        // --- Grid (Scrollable with Clipping) ---
        const cols = 5;
        const btnW = 140;
        const btnH = 80;
        const gapX = 20;
        const gapY = 20;
        const gridW = cols * btnW + (cols - 1) * gapX;
        const startX = (w - gridW) / 2;
        const startY = 250 + game.scrollY;

        const sortedIds = Object.keys(game.levels).map(Number).sort((a, b) => a - b);

        // Calc max scroll
        const totalRows = Math.ceil(sortedIds.length / cols);
        const contentH = totalRows * (btnH + gapY);
        const availableH = h - 250;
        game.maxScroll = Math.max(0, contentH - availableH + 50);

        // Clipping Region
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 250, w, h - 250);
        ctx.clip();

        sortedIds.forEach((lid, idx) => {
            const row = Math.floor(idx / cols);
            const col = idx % cols;
            const x = startX + col * (btnW + gapX);
            const y = startY + row * (btnH + gapY);

            // Optimization: Don't draw if outside viewport
            if (y + btnH < 250 || y > h) return;

            const score = game.scores[lid];
            const color = score ? "#3CB371" : "#4682B4";

            drawButton(x, y, btnW, btnH, `Nivel ${lid}`, color);

            // Fix Text Overlap: Move "Nivel X" up slightly or adjust Score position
            // drawButton draws centered text at y + h/2 + 6. We'll overwrite it or use custom drawing.
            // Let's redraw the button background and custom text to avoid overlap.
            drawRect(x, y, btnW, btnH, color, 4, { color: "rgba(0,0,0,0.3)", width: 2 });
            ctx.fillStyle = "rgba(255,255,255,0.2)";
            ctx.fillRect(x, y, btnW, btnH / 2);

            drawText(`Nivel ${lid}`, x + btnW / 2, y + 30, 16, CONFIG.COLORS.BTN_TEXT, "center");

            if (score) {
                const bestName = score.name || "Anon";
                drawText(`${score.moves} (${bestName})`, x + btnW / 2, y + 60, 12, "#FFFFFF", "center");
            } else {
                drawText("-", x + btnW / 2, y + 60, 14, "#C8C8C8", "center");
            }
        });

        if (sortedIds.length === 0) {
            drawText("Cargando niveles...", w / 2, 300, 20, "#FF0000", "center");
        }

        ctx.restore(); // End Clipping

    } else if (game.state === "PLAYING" || game.state === "WON") {
        drawButton(20, 20, 80, 30, "Menú", "#969696");
        if (game.state === "PLAYING") {
            drawButton(110, 20, 80, 30, "Reiniciar", "#646464");
        }

        drawText(`Nivel: ${game.levelNum}`, 220, 42, 20, CONFIG.COLORS.TEXT);
        drawText(`Maniobras: ${game.moves}`, 350, 42, 20, CONFIG.COLORS.TEXT);
        drawText(`Tiempo: ${game.getTimeStr()}`, 550, 42, 20, CONFIG.COLORS.TEXT);
        drawText(game.description, 50, 80, 20, "#646464");
        drawText(`Objetivo: ${game.target.join(" -> ")}`, 50, 110, 20, "#006400");

        if (game.message) {
            drawText(game.message, 650, 42, 20, "#FF0000");
        }

        const trackStartX = (w - CONFIG.TRACK_WIDTH) / 2;
        const trackStartY = 150;

        for (let i = 0; i < game.tracks.length; i++) {
            const y = trackStartY + i * CONFIG.TRACK_SPACING;

            // Capacity
            const carsCount = game.tracks[i].filter(c => c !== '').length;
            const capColor = carsCount >= game.capacity ? CONFIG.COLORS.CAPACITY_FULL : CONFIG.COLORS.TEXT;
            drawText(`(${carsCount}/${game.capacity})`, trackStartX + 620, y + 25, 20, capColor);

            drawTrack(trackStartX, y + CONFIG.CAR_HEIGHT / 2, 600);

            // Loco Button
            const btnX = trackStartX - 60;
            const isLocoHere = (game.locoTrack === i);

            // Smaller Size: 50x30
            const iconW = 50;
            const iconH = 30;
            // Center vertically relative to track (y is top of row, height is 40)
            // We want center of icon (15) to match center of row (20). So top is y + 5.
            const iconY = y + (CONFIG.CAR_HEIGHT - iconH) / 2;

            if (isLocoHere) {
                drawTrainIcon(btnX, iconY, CONFIG.COLORS.LOCO_BTN, 0.8);
            } else {
                // Gray button with Arrow
                drawRect(btnX, iconY, iconW, iconH, CONFIG.COLORS.LOCO_BTN_OFF, 4);
                // Arrow
                ctx.fillStyle = "#646464";
                ctx.beginPath();
                const cx = btnX + iconW / 2;
                const cy = iconY + iconH / 2;
                ctx.moveTo(cx - 6, cy - 6);
                ctx.lineTo(cx + 6, cy);
                ctx.lineTo(cx - 6, cy + 6);
                ctx.fill();
            }

            // Move Here
            if (game.state === "PLAYING" && game.locoTrack !== -1 && game.selectedCars.size > 0 && i !== game.locoTrack) {
                drawButton(trackStartX - 180, y, 110, 40, "Mover Aquí", "#32CD32");
            }

            // Cars
            const track = game.tracks[i];
            for (let j = 0; j < track.length; j++) {
                if (track[j] === '') continue;
                const cx = trackStartX + j * (CONFIG.CAR_WIDTH + CONFIG.CAR_SPACING);
                const isSelected = game.selectedCars.has(`${i},${j}`);
                drawCar(cx, y, track[j], isSelected);
            }
        }

        if (game.state === "PLAYING") {
            drawButton(w / 2 - 100, h - 80, 90, 40, "Reiniciar", "#646464");
        }

        if (game.state === "WON") {
            ctx.fillStyle = "rgba(0,0,0,0.7)";
            ctx.fillRect(0, 0, w, h);

            drawText(`¡Nivel ${game.levelNum} Completado!`, w / 2, h / 2 - 80, 48, "#32FF32", "center");

            if (game.newRecord) {
                drawText("¡NUEVO RÉCORD!", w / 2, h / 2 - 20, 24, CONFIG.COLORS.RECORD, "center");
            }

            drawText(`Maniobras: ${game.moves}`, w / 2, h / 2 + 20, 20, "#FFFFFF", "center");

            drawButton(w / 2 - 100, h - 80, 90, 40, "Repetir", "#646464");
            drawButton(w / 2 - 45, h - 140, 90, 40, "Menú", "#4682B4");

            if (game.levels[game.levelNum + 1]) {
                drawButton(w / 2 + 10, h - 80, 90, 40, "Siguiente", "#8A2BE2");
            } else {
                drawText("¡Juego Terminado!", w / 2, h - 60, 48, "#FFD700", "center");
            }
        }
    }

    requestAnimationFrame(loop);
}

// Start
loop();
