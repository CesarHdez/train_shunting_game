# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Game

Start a local dev server (required because levels are loaded via `fetch`):

```bash
python server.py
```

This serves at `http://localhost:8000` (auto-increments port if busy) and opens the browser automatically. There is no build step, bundler, or package manager.

## Architecture

Single-page, no-framework HTML5 canvas app with **two game modes** sharing one canvas, camera, and design language. After login the player picks a mode on the mode-select screen (`app.mode === null`).

- **`index.html`** — login overlay + `<canvas id="gameCanvas">`. Loads `js/main.js` as `type="module"`.
- **`style.css`** — all styling including login, animations (`shake`), and responsive layout.

### `js/core/` — shared between modes
- **`app.js`** — global `app` singleton: `mode` (`null` | `'shunting'` | `'classification'`) and `playerName`.
- **`canvas.js`** — canvas/ctx/camera, `resize()`, world size `WORLD` (1024×768), palette `C`, draw primitives (`txt`, `fillRR`, `drawButton`, `drawTrack`, `drawStar`, …), `getMenuLayout()` (responsive level grid), `animTime`/`tickAnim`.
- **`particles.js`** — `ParticleSystem` + `particles` singleton (confetti).
- **`scores.js`** — generic `ScoreManager` (localStorage top-5 per level, djb2 hash integrity, v1 migration) parameterized by `storageKey` + `fbDocPrefix`; also `computeShuntingScore()`.
- **`firebase.js`** — Firestore submit/fetch. All scores live in the `scores` collection; the doc id carries the mode prefix: `level_N` (shunting) vs `clf_level_N` (classification).

### `js/shunting/` — Patio de Maniobras (original mode)
- **`state.js`** — `CONFIG`, `CAR_TYPES`, waypoints, `AnimationManager`, `GameState` (state machine `MENU` → `PLAYING` → `WON`, undo 40-deep, right-loco, locoLimit). Singletons `anim`, `game`. localStorage key: `train_scores_v2`.
- **`renderer.js`** — peine, cars, HUD, menu, win screen, leaderboard; entry point `renderShunting(w, h)`.
- **`input.js`** — `handleShuntingClick(wx, wy, w, h)` incl. tutorial click gating.

### `js/classification/` — Patio de Clasificación
- **`state.js`** — `COLORES`/`TIPOS`, scoring (`calcularPuntaje`, `puntajeMaximo`, `starsForScore`), `ClassificationState` (`MENU` → `PLAYING` → `SUMMARY`, plus `LEADERBOARD`), undo 40-deep. Singleton `clf`. localStorage key: `train_clf_scores_v1`.
- **`renderer.js`** — typed/colored cars (`drawClfCar`, ported from the original SVG shapes in 58×42 space), arrival/classification rows, summary card, menu, leaderboard; layout via `getClfLayout()` (also used by input for hit-testing); entry point `renderClassification(w, h)`.
- **`input.js`** — `handleClassificationClick(wx, wy, w, h)`.

### `js/main.js`
Login, mode-select screen (draw + clicks), pointer/wheel/touch routing to the active mode, `requestAnimationFrame` loop with idle detection (skips drawing on static screens).

### Tools
- **`compute_min_moves.js`** — Node IDA* solver; writes `minMoves` into `levels/shunting/*.json`.

## Level Format

Levels are fetched at startup with `?v=Date.now()` cache-busting; missing files are silently skipped (loader probes ids 01–100).

### Shunting — `levels/shunting/level_NN.json` (01–100)

```json
{
  "id": 1,
  "tracks": [["", "", "", "", "", ""], ["B", "", "", "", "", ""], ["A", "", "", "", "", ""]],
  "targetSequence": ["A", "B"],
  "description": "Nivel 1: Tutorial. Coloca A antes que B.",
  "capacity": 6,
  "minMoves": 2
}
```

- `tracks`: 2D array, one inner array per track. Cars are single uppercase letters; `""` = empty slot.
- `targetSequence`: required final order on any single track (left-to-right).
- `capacity`: max slots per track. Optional: `rightLoco`, `locoLimit`, `minMoves`.

### Classification — `levels/classification/level_NN.json` (01–10)

```json
{
  "id": 1,
  "name": "Turno 1 · Primeros destinos",
  "description": "1 vía de llegada · 2 destinos · capacidad sobrada",
  "arrivals": [["F-rojo", "T-azul", "F-rojo", "J-azul", "V-rojo", "C-azul"]],
  "capacities": [4, 4]
}
```

- Each car is `"TIPO-color"`. Tipos: `F` furgón · `T` tanque · `V` tolva · `J` jaula · `C` contenedor. Colores (= destinos): `rojo`, `azul`, `verde`, `ambar`, `violeta`.
- `arrivals`: arrival tracks; index 0 is the head (the only pushable car).
- `capacities`: one entry per classification track (sum must be ≥ total cars).

## Game Mechanics

### Shunting
- Player places the locomotive (`locoTrack`) on a track, selects cars to pull, then clicks a destination track.
- Moving cars costs 1 move (placing loco on non-empty track is free).
- Stars: 3 if moves ≤ minMoves, 2 if ≤ minMoves×1.5, else 1 (fallback uses carCount).
- Score: up to 1000 by moves ratio + up to 200 time bonus.

### Classification
- Player selects an arrival track, then clicks a classification track to push the **head** car there ("regla del lomo").
- Score: +10 per car, −15 per color change inside a classification track, +30 bonus per non-empty single-color track.
- Stars by ratio to the theoretical max (`puntajeMaximo`): ≥90% → 3, ≥70% → 2, else 1.
- Undo restores full state (up to 40 steps). Turn ends when all arrivals are empty → SUMMARY.
