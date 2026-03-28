# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Game

Start a local dev server (required because levels are loaded via `fetch`):

```bash
python server.py
```

This serves at `http://localhost:8000` (auto-increments port if busy) and opens the browser automatically. There is no build step, bundler, or package manager.

## Architecture

This is a single-page, no-framework HTML5 canvas game split into ES modules (no bundler needed):

- **`index.html`** — login overlay + `<canvas id="gameCanvas">`. Loads `js/main.js` as `type="module"`.
- **`style.css`** — all styling including login, animations (`shake`), and responsive layout.
- **`js/state.js`** — game constants, logic, and data classes:
  - `CONFIG` / `C` / `CAR_TYPES` — global constants and color palette.
  - `buildWaypoints()` / `buildWaypointsRight()` — animation paths through left/right peine.
  - `ParticleSystem`, `AnimationManager` — confetti and staggered car movement.
  - `ScoreManager` — localStorage (`train_scores_v2`), top-5 per level, djb2 hash integrity.
  - `GameState` — state machine (`MENU` → `PLAYING` → `WON`), level loading, undo stack (40-deep), right-loco logic, locoLimit enforcement.
  - Exports singletons: `particles`, `anim`, `game`.
- **`js/renderer.js`** — canvas, camera, all draw functions, idle-aware `render()`.
- **`js/main.js`** — input handlers, click routing (left + right loco), `requestAnimationFrame` loop with idle detection.

## Level Format

Levels are JSON files in `levels/level_NN.json` (01–30):

```json
{
  "id": 1,
  "tracks": [["", "", "", "", "", ""], ["B", "", "", "", "", ""], ["A", "", "", "", "", ""]],
  "targetSequence": ["A", "B"],
  "description": "Nivel 1: Tutorial. Coloca A antes que B.",
  "capacity": 6
}
```

- `tracks`: 2D array, each inner array is one track. Cars are single uppercase letters; `""` = empty slot.
- `targetSequence`: required final order on any single track (left-to-right).
- `capacity`: max slots per track.
- Levels are fetched at startup with `?v=Date.now()` cache-busting. Missing levels are silently skipped.

## Game Mechanics

- Player places the locomotive (`locoTrack`) on a track, selects cars to pull, then clicks a destination track.
- Moving cars costs 1 move (placing loco on non-empty track is free).
- Stars: 3 if moves ≤ carCount+1, 2 if ≤ carCount×2+1, else 1.
- Undo restores full track state and move count (up to 40 steps).
