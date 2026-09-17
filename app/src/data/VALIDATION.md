# Level Data Validation Report

Generated 2026-08-15 by the level-data-migrator agent while bundling `ref/levels/**`
into `app/assets/levels/**` for offline (no dev-server) loading on mobile.

Scope: every file was validated as copied byte-for-byte from `ref/levels/**` — no
level content (tracks, targetSequence, arrivals, capacities, minMoves, etc.) was
modified during migration. This report only checks the data; it does not fix it.

## Method

A one-off Node script read all 110 bundled JSON files
(`app/assets/levels/shunting/level_01.json … level_100.json`,
`app/assets/levels/classification/level_01.json … level_10.json`) and checked:

- JSON parses and required fields are present with correct types
  (shunting: `id`, `tracks`, `targetSequence`, `description`, `capacity`,
  optional `minMoves`/`rightLoco`/`locoLimit`; classification: `id`, `name`,
  `description`, `arrivals`, `capacities`).
- Every shunting `tracks[i].length === capacity`.
- Every shunting cell is `""` or a single uppercase letter `A`–`Z`.
- Every `targetSequence` car appears somewhere in `tracks`, and `targetSequence`
  itself has no internal duplicates.
- No car letter is duplicated across a shunting level's `tracks` (each letter
  should represent exactly one physical wagon).
- `targetSequence.length <= capacity` (the win condition requires the full
  target sequence to fit on a single track — see below).
- Every classification car matches `TIPO-color` with a known tipo
  (`F`/`T`/`V`/`J`/`C`) and known color (`rojo`/`azul`/`verde`/`ambar`/`violeta`).
- `sum(capacities) >= total arrival car count` for classification levels.
- Ids are unique and contiguous: shunting 1..100, classification 1..10.

## Result summary

| Check | Shunting (100 files) | Classification (10 files) |
|---|---|---|
| Files found | 100 | 10 |
| JSON parses, schema OK | 100/100 | 10/10 |
| Ids unique & contiguous | yes (1..100) | yes (1..10) |
| Inner track length === capacity | 100/100 pass | n/a |
| targetSequence cars all present in tracks | 100/100 pass | n/a |
| No duplicate car letters within a level | 100/100 pass | n/a |
| capacities sum >= total car count | n/a | 10/10 pass (see per-level slack below) |
| Car/tipo/color format valid | n/a | 10/10 pass |

Classification capacity slack (`sum(capacities) - totalCars`) is 0 on 8 of the 10
levels and small positive (2) on levels 1 and 3 — i.e. most classification levels
have exactly enough capacity and no room for player mistakes; this is a design
characteristic, not a data error.

## Anomalies flagged

**1. Levels 77, 78, 79, 80 (shunting) were structurally unsolvable — `targetSequence.length` (12) exceeded `capacity` (11). — ✅ FIXED 2026-08-15 (orchestrator).**

> **Resolution:** `capacity` was raised from `11` to `13` on all four levels and
> each track row was re-padded to length 13 (car order preserved, no cars added
> or removed). The winning track can now hold the full 12-car target with one
> slot of headroom (matching level 100's `capacity: 13`). Re-validated: rows ==
> capacity, all target cars present, no dup cars, `capacity (13) >= target (12)`,
> 14 total cars across 7 tracks with two locomotives → structurally solvable.
> `minMoves` left `null` (faithful car-count star fallback; the original solver
> timed out on these hard, double-loco levels). Only the bundled app copies were
> changed; `ref/levels/**` is left as the historical original.
>
> Original diagnosis (for the record):

All four levels have a 12-car `targetSequence` (`A`..`L`) but `capacity: 11`. The
win condition in both the reference engine (`ref/js/shunting/state.js`,
`checkWin()`, line 319-330: `cars.length === this.target.length`) and the
reference IDA* solver (`ref/compute_min_moves.js`, `isWin()`) requires some
single track to hold exactly `target.length` cars in order. Since no track can
ever exceed `capacity` cars (enforced at the move-application step, e.g.
`ref/js/shunting/state.js` line 439/554: `if (destCars.length + list.length >
this.capacity) return;`), it is mathematically impossible for any track to ever
reach 12 cars when `capacity` is 11. These levels cannot be won as authored.

This is consistent with their `minMoves: null` — the solver's 15s-per-level
timeout writes `null` both when it runs out of time *and* when no winning state
exists, so these four nulls are very likely "genuinely unsolvable" rather than
merely slow. (Level content was left untouched per instructions; this needs a
source-data fix — e.g. raise `capacity` to ≥ 12 or trim `targetSequence` to
≤ `capacity` — which is out of scope for this migration.)

Affected files: `app/assets/levels/shunting/level_77.json`,
`level_78.json`, `level_79.json`, `level_80.json`.

**2. `minMoves` is `null` for 83 of 100 shunting levels (ids 18-100).**

Levels 1-17 have a computed integer `minMoves`; levels 18-100 all carry
`minMoves: null`, meaning the original 15-second-per-level IDA* solver run
(`ref/compute_min_moves.js`) timed out (or, per anomaly #1 above, found no
solution) before finishing. This matches the type contract
(`minMoves?: number | null` — "null when the solver timed out" in
`src/data/levelTypes.ts`) so it is not a schema violation, but it means star
rating for those 83 levels currently falls back to whatever the client uses
when `minMoves` is absent (the reference web client's
`computeShuntingScore()` uses a `carCount`-based fallback — worth confirming
the mobile engine does the same). Not fixed here since re-running the solver
would only be legitimate if level content changed, which it did not.

## Not anomalies (checked and confirmed fine)

- No duplicate ids, no gaps in id sequences (shunting 1..100, classification
  1..10 both fully contiguous).
- No malformed car tokens (`""` or single uppercase letter for shunting;
  `TIPO-color` with valid tipo/color for classification).
- No track in any level exceeds its declared `capacity` in the raw file (all
  tracks are pre-padded to exactly `capacity` length).
- No `targetSequence` references a car letter that doesn't exist anywhere in
  that level's `tracks`.
- `rightLoco: true` appears on 50/100 shunting levels; `locoLimit` is set on
  36/100. Both are optional per the contract and consumed as such.

## Files touched by this validation

None — this was a read-only audit of the already-copied JSON in
`app/assets/levels/shunting/` and `app/assets/levels/classification/`. Level
content is byte-identical to `ref/levels/**`.
