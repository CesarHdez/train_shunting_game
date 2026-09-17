# Yard scenery / atmosphere — spec

Answers the user's request to give the yard an "environment" (sky-band
structures, foreground dressing, ballast gravel) without ever crowding the
tracks. This is a spec for the Skia specialist to build from and for QA to
check mechanically — not art itself. Read `design/DECISIONES.md` in full
before touching anything this document touches; nothing here may regress §1,
§5, §8 or §11.

Grounded in: `src/render/layout/shuntingLayout.ts`, `src/render/layout/
classificationLayout.ts`, `src/render/ShuntingBoard.tsx`,
`src/render/iso/isoCamera.ts`, `src/render/primitives/IsoTrackBed.tsx`,
`src/render/primitives/IsoSky.tsx`, `src/render/primitives/BufferStop.tsx`,
`src/controller/sections.ts`, `src/data/levels.ts`, `design/tokens.ts`.

---

## 0. Section count — validated, not guessed

`SHUNTING_SECTION_SIZE = 10` (`src/controller/sections.ts`) and
`shuntingLevelCount = 100` (`src/data/levels.ts`) → **exactly 10 shunting
sections** (Sección 1 = levels 1–10 … Sección 10 = 91–100), not five or six.
Clasificación has `classificationLevelCount = 10` levels and calls
`buildSections()` with `sectionSize` equal to the full count, which — per
that module's own doc comment — always collapses to **exactly one section**.

So the real number of "worlds" needing a backdrop identity is **11**: 10
shunting sections + 1 classification world. Section §2 below gives all 11 a
distinct read for a fraction of the cost of 11 bespoke paintings, by varying
a shared prop kit's *composition and slot*, not by drawing each one from
scratch.

One deliberate coincidence worth using: `hasRightLoco` first turns on at
level 51 (memory: `mobile-port-agent-system`), i.e. exactly at the start of
**Sección 6**. That section's recipe is the one place I've made the backdrop
itself go symmetric (structure mirrored left/right) to sell "the yard just
grew a second throat" — see §2.

---

## 1. The hard constraint: where scenery is allowed to live

### 1.1 Why the reference image's layout doesn't transfer directly

The reference is a fixed wide shot with genuinely empty margins left and
right of the yard. This app's yard is not that: it is an isometric plane
(`isoCamera.ts`) that a `<Group matrix={camera.matrix}>` draws edge-to-edge.
Two facts kill the idea of "props beside the tracks":

1. **The ground plane bleeds past both canvas edges on purpose.**
   `ShuntingBoard.tsx`'s `GroundPlane` draws its radial-gradient ground quad
   at `x0 = -planeWidth * 0.55` through `planeWidth * (1 + 0.55*2)` wide —
   ground colour covers the *entire* canvas width at every row's depth, by
   design ("seeing the ground's own side edges would turn the yard into a
   floating trapezoid"). There is no strip of empty canvas beside the yard at
   any row.
2. **Both side margins are live track geometry, not dead space.**
   `edgeLeftX`/`edgeRightX` (`planeEdgeU`, sized off the *far* row so every
   nearer row's run also clears the frame) make the throat trunks bleed off
   both edges on a `hasRightLoco` level, and the locomotive ghost travels
   along exactly that geometry during a move (DECISIONES §1: "salirse del
   cuadro por el lateral es correcto"). A prop anchored to "the left margin"
   or "the right margin" would sit on top of a moving train on half the
   levels in the game (every level from Sección 6 on).

Conclusion: **there is no left/right framing available at any track depth.**
The only real estate that is *never* track geometry, at any `trackCount` or
`hasRightLoco` combination, is above the horizon and behind/below the row
block — i.e. the same two zones `IsoSky` already owns one of.

### 1.2 The two safe zones, quantified

**Zone A — the sky band (`y < camera.horizonY`).** `IsoSky` already draws
here in pure screen space (a `960×200` reference band scaled to
`width × horizonY`, no `camera.matrix`). Nothing in `hitTest` or the ground
plane ever produces a `y` above the horizon — `project(u, v).y` is
monotonically increasing in `v`, and every row has `v > 0`, so this band is
mechanically guaranteed clear of the yard for every level. Full canvas width
is usable. **This is where 90% of the new scenery should live.**

**Zone B — the foreground apron (below the nearest row's ballast box).**
`computeShuntingLayout` reserves a margin here by construction:

- `rowHeight ≈ 29.7` plane units, fixed (`clamp(18, 34, minPlanePitch*0.5)`,
  and `minPlanePitch = 27/cos(63°) ≈ 59.47` is itself a fixed camera
  constant, not level-dependent).
- `topOffset` (far margin, between the horizon `v=0` and the first row) and
  the near margin (between the last row's ballast and the plane's own far
  edge `v=planeHeight`) are **always equal**, both `= topPad + slack/2`,
  where `topPad = spacing.md = 12` and `slack = max(0, planeHeight - 2·topPad
  - blockHeight)`.
- The canvas-growth branch (`neededPlaneHeight > planeHeight` ⇒ grow
  `contentHeight`) exists *specifically* to guarantee `slack ≥ 0` at every
  `trackCount` up to the game's max of 7 — i.e. **both margins are
  guaranteed to be at least `topPad = 12` plane units, on every single
  level that ships**, and can be much larger when the row block doesn't
  need the full canvas.

Worked examples (own arithmetic from the constants above):

| Case | rowPitch used | blockHeight | margin each side | reads as |
|---|---|---|---|---|
| 7 tracks, tall level forces the grow branch | clamps to `minPlanePitch≈59.5` | `6×59.5+29.7≈386.5` | `slack≈0` → **≈12 plane units** (≈12–15dp, more at the near edge because of perspective magnification, less near the horizon because of compression) | a hairline of extra ground colour — **no room for a discrete object** |
| 2 tracks, ordinary portrait phone | clamps to `maxPlanePitch≈158.6` (ceiling) | `1×158.6+29.7≈188.3` | `slack` can easily be 100+ plane units | comfortable — bushes, a lamp post, a cabinet all fit |

This is the number the user was worried about, made mechanical: **the
foreground apron shrinks toward a ~12-plane-unit floor as `trackCount`
grows toward 7, regardless of `hasRightLoco`.** `hasRightLoco` doesn't
change this margin (it only affects the horizontal throat math), so a
two-throat level is not specially worse for the foreground apron — but it
does mean *both* horizontal edges are busy with train travel, reinforcing
that nothing should ever be anchored to a side margin (§1.1).

### 1.3 Mechanical rules (QA can check these without eyeballing)

1. **R1 — vertical exclusion.** Every scenery element's on-screen bounding
   box must satisfy `bboxMaxY <= camera.horizonY` (sky tier) **or**
   `bboxMinY >= screenYOfRowBottom(trackCount - 1)` (foreground tier), where
   `screenYOfRowBottom(i) = camera.project(u, rowV(i) + rowHeight/2).y` for
   any `u` (rows are foreshortened but not tilted in `y` across a row's own
   band). Never partially between the two.
2. **R2 — no plane-projection through the row band.** Anything drawn inside
   `<Group matrix={camera.matrix}>` (Zone B filler that wants to sit "on the
   ground" for a consistent depth cue) must use a `v` strictly greater than
   `rowV(trackCount - 1) + rowHeight / 2`. Never draw scenery geometry at a
   `v` that falls inside any row's own band.
3. **R3 — conditional foreground, not scaled foreground.** Compute
   `foregroundMarginPlane = layout.camera.planeHeight - (topOffset +
   blockHeight)` once per layout (this needs a one-line export from
   `computeShuntingLayout` — it already computes both quantities internally,
   see §5). Each foreground prop declares a `minMarginPlane` (§2.3 gives
   numbers); **render it only if `foregroundMarginPlane >= minMarginPlane`,
   otherwise skip it entirely.** Never shrink a prop to fit — a squeezed
   sprite reads worse than an absent one, and squeezing would require
   per-frame or per-layout size math that isn't worth the payoff.
4. **R4 — never interactive.** No scenery primitive may be wrapped in or
   registered with `GestureDetector`/`hitTest`. `hitTest` already only walks
   `trackIdx`/`carIdx`/loco rects and a bounded `u` range at each row — as
   long as R1/R2 hold, scenery physically cannot overlap a hit box, but this
   is the explicit rule for whoever wires it: don't add a scenery hit case
   "for consistency."
5. **R5 — decorative colour reuse is fine, decorative *meaning* is not.**
   The Clasificación recipe (§2.2) reuses the exact `destinationColors` hex
   values on background containers as a wink at the mechanic. That is a
   flat, non-interactive, sky-band-only reuse of a constant — it does not
   create a new destination-colour surface. It must never be scaled, sized,
   or positioned so it could be mistaken for a wagon (wagons are billboarded
   inside the row band; these containers live only in Zone A/B).

---

## 2. Ten (eleven) themes from one economical kit

### 2.1 The kit (≈11 primitives, each ≤6 Skia shapes)

All new props are flat two/three-tone vector shapes in the same silhouette
language `IsoSky`'s existing water tower and signal gantry already use —
`Rect`/`RRect`/`Circle`/short `Path`s, no strokes finer than the existing
ones, no gradients beyond what a prop already needs (most need none; the
existing whole-canvas `atmosphere` bloom/vignette pass — drawn last, over
literally everything — already unifies every prop's lighting mood for free,
see §4). Reference geometry defined in the same normalized `960×200` band
`IsoSky.tsx` already uses (`REF_W`/`REF_H`), so it composes at any canvas
width exactly like the hill/tower/gantry already do.

| Prop | Shapes | Notes |
|---|---|---|
| **Hill line** | 1 `Path` | Already exists (`IsoSky`'s `HILL`). Kept identical in every section — the one constant that says "same yard" across all 11 worlds. |
| **Fence line** | 1 `Rect` + 1 dashed `Path` | Chain-link suggestion: a thin rail plus a short-dash stroke over it (same `DashPathEffect` trick as the sleeper ties). Runs the *full* width just above the horizon (y≈150–168 of the 200-tall band) in every section — second constant. |
| **Control tower** | 4 `Rect` (legs, cab box, glazing band, mast) | Taller/squarer riff on the existing water tower; glazing band gets `lampLight` dots at night (same conditional `IsoSky` already uses). |
| **Warehouse** | 1 big `Rect` (body) + 3 small darker `Rect` (roller doors) + 1 thin `Rect` (roof line) | Doors optionally get `lampLight` dots at night for 1–2 of the 3, never all — reads as "someone's working late," not a grid. |
| **Container stack** | 2–3 `RRect`, offset/stacked, each with 1 thin highlight `Rect` | Fixed hue set (see §2.4), reused by every section that includes it. |
| **Gantry crane** | 2 leg `Rect` + 1 beam `Rect` + 1 thin cable `Path` | Straddles a slot; silhouette only (`palette.scenery.structure`), never lit at night (it's not a building). |
| **Lamp post (twin-head)** | 1 pole `Rect` + 2 head `Circle` (+1 glow `Circle` at night, reusing `IsoSky`'s existing lamp-glow pattern) | Foreground-tier prop (§2.3). |
| **Utility cabinet** | 1 `Rect` + 1 thin vent-line `Rect` | Foreground-tier, smallest footprint — the first thing to add back once margin allows, since it costs almost nothing to draw or to skip. |
| **Signage post** | 1 pole `Rect` + 1 dark plate `Rect` + 1 arrow `Path` | Background or foreground depending on section; the Clasificación recipe uses the arrow-plate as the "sorting" wink. |
| **Bush/shrub clump** | 2–3 overlapping `Circle` | Foreground-tier, cheapest filler, drawn in the plane-projected foreground band per R2. |
| **Forklift** | 2 `Rect` (body+mast) + 2 small `Circle` (wheels) | Used exactly once (Sección 5), small and background-scale — a treat, not a recurring element. |

Every prop is a `React.memo` component with its path/rect data built in
`useMemo` keyed on `(reference band scale, palette.key)` — identical
convention to `IsoTrackBed`/`IsoSky`. None of them touch Reanimated
`SharedValue`s per frame; the one exception (a shared lamp-glow pulse) reuses
`IsoSky`'s existing single shared `twinkle` clock rather than adding a new
per-prop animation loop.

### 2.2 Per-section recipe

Three fixed horizontal slots in the shared `960`-wide reference band — LEFT
(`x≈60–260`), CENTER (`x≈380–580`), RIGHT (`x≈700–900`) — plus the two
always-on constants (hill, fence). A recipe is just "which prop (if any) in
each slot, which hue set." That's the entire economy: 11 distinct
compositions from ≤4 props apiece, out of an 11-prop kit, with zero new
geometry per section.

| # | Levels | Name | LEFT | CENTER | RIGHT | Note |
|---|---|---|---|---|---|---|
| 1 | 1–10 | Patio de Entrada | Signage post | Warehouse (short, 1 door) | Lamp post | Introductory — sparsest recipe, matches the simplest levels. |
| 2 | 11–20 | Nave de Carga | Warehouse (3 doors, reference-accurate) | — (fence only) | Container stack ×2 (red, blue) | |
| 3 | 21–30 | Patio de Contenedores | Container stack ×3 | — | Gantry crane + container stack ×2 | Matches the brief's own example: crane + stacks both sides, **no warehouse**. |
| 4 | 31–40 | Torre de Control | Control tower | — | Warehouse (short) | Tower becomes this section's signature. |
| 5 | 41–50 | Vía de Mantenimiento | Utility cabinet + signage post | Lamp post ×2 | Forklift near a small container stack | Last single-throat section — deliberately quiet before §6. |
| 6 | 51–60 | Doble Vía | Control tower | — | Warehouse (short), mirrored | First `hasRightLoco` section: background goes symmetric to sell "the yard grew a second throat." |
| 7 | 61–70 | Muelle de Grúas | Gantry crane | Container stack (low, background-scale) | Gantry crane | Symmetric again — two-throat sections keep this habit. |
| 8 | 71–80 | Terminal Intermodal | Warehouse + container stack | Fence + lamp posts ×2 | Container stack (tall, 3-high) | |
| 9 | 81–90 | Gran Industria | Control tower (taller variant) + container stack | — | Gantry crane | Denser skyline; still ≤4 props. |
| 10 | 91–100 | Gran Terminal | Control tower | Warehouse | Gantry crane + container stack | Finale: most of the kit at once, still only 5 shapes' worth of props. |
| — | Clasificación (all 10 turnos, one section) | Patio de Clasificación | Signage post (arrow) | Fence | Container stack in the **5 destination hues** (`destinationColors.rojo/azul/verde/ambar/violeta`) | The one recipe that deliberately reuses gameplay-identity colours, per R5. Zero new tokens: pulls straight from the existing `destinationColors` table. |

### 2.3 Foreground-tier gating (`minMarginPlane`, R3)

Only these props are ever candidates for Zone B (everything else above is
Zone A / sky-band, always safe): bush clump, lamp post, utility cabinet,
forklift, signage post (when a recipe places it in the foreground rather
than the background). Suggested floors, cheapest-to-keep first:

| Prop | `minMarginPlane` | Rationale |
|---|---|---|
| Bush clump | 16 | Smallest bbox, blobby — still legible even thin. |
| Utility cabinet | 22 | Small rectangle, needs a hair more room than a blob. |
| Signage post | 26 | Has a pole extending upward from the anchor — needs headroom too, not just footprint. |
| Lamp post | 32 | Tallest of the foreground set. |
| Forklift | 34 | Widest — only ever used in Sección 5's recipe, itself a low-track-count run of levels, so it rarely needs to actually skip. |

At the 7-track worst case (§1.2's ≈12-unit floor), **every foreground prop
is skipped** — correct: the recipe's LEFT/CENTER/RIGHT sky-band elements
still render, so the section keeps its identity, it just loses the close-in
dressing exactly when the yard is busiest. At 2–3 tracks, all of them fit.

### 2.4 Container hues

Fixed, absolute hues shared by every shunting section that uses the prop —
**not** palette-varied (the whole-canvas atmosphere pass already unifies
their mood per time-of-day, see §4), and **not** the same values as
`destinationColors` (kept visually distinct from wagon-destination cues,
per R5) except in the one Clasificación recipe that intentionally borrows
them:

```
containerHues = { red: '#c0392b', blue: '#1f5fa8', amber: '#d68a1f' }
```

---

## 3. Ballast (gravel texture)

### 3.1 Technique

`IsoTrackBed.tsx` already builds one memoized path string per row
(`buildRunPath`) and draws it three times (ballast fill, sleeper dash,
[rails separately]). Add **two more strokes of the exact same path data** —
zero new path-building math, the `runs[i]` string is simply reused a 4th and
5th time:

1. **Stone highlight** — `strokeWidth = ballastWidth * 0.92`, `color =
   palette.track.ballastStoneHi`, `opacity = 0.30`, `DashPathEffect`
   intervals `[ballastWidth * 0.05, ballastWidth * 0.085]`.
2. **Stone shadow** — `strokeWidth = ballastWidth * 0.55`, `color =
   palette.track.ballastStoneLo`, `opacity = 0.22`, `DashPathEffect`
   intervals `[ballastWidth * 0.07, ballastWidth * 0.11]` (a **different**
   period from layer 1, so the two dash rhythms drift in and out of phase
   along the path instead of lining up into a barcode — cheap fake
   randomness from two periodic functions with incommensurate frequencies,
   no `Math.random()`, no per-stone loop, no per-frame anything).

Draw order (before the existing sleeper-tie dash, so the wooden ties still
read as sitting on top of the stones, not buried under them):

```
ballast fill → stone highlight → stone shadow → sleeper ties (existing) → rails (existing) → nodes/buffer stops (existing)
```

### 3.2 Why this reads as stones at every density, and stays cheap

- `DashPathEffect` dash length here is defined in **plane units scaled by
  `ballastWidth`**, not as a fraction of the path's own length. A short stub
  (dense, 13-capacity level) and a long one (sparse level) both get
  *same-sized* stones, just fewer or more of them — which is exactly how
  real ballast behaves, and it falls out of the existing per-row
  `ballastWidth` derivation for free.
- Cost is **two extra `<Path>` draws per row**, not per stone —
  `DashPathEffect` dashing happens on the GPU/rasterizer as part of stroking
  one path, not as JS-side geometry generation, so "how many stones" never
  shows up as a JS or draw-call cost. At the worst case (7 tracks, both
  throats, `IsoTrackBed` called twice) that's `+2 × 7 × 2 = 28` extra `Path`s
  against a baseline of roughly 78 existing track-bed draws at that same
  worst case (16 ballast/trunk + 14 sleeper-dash + 32 rail + 16 node ≈ 78).
  Going from ~78 to ~106 draws for the entire track bed is not a measurable
  frame-time change on a target Android device; it is two orders of
  magnitude below where "per-stone" alternatives (individual `Circle`s, or
  worse, a JS-generated pseudo-random scatter recomputed on layout change)
  would sit.
- **Never per-frame**: both new strokes reuse the same `runs` array already
  memoized on `[rows, convX, convY, fanEndX, stubEndX]` — recomputed only
  when the layout changes (new level, resize, orientation), never on an
  animation tick, exactly like the four draws that already exist there.
- **Won't muddy wagons/letters**: the whole track bed, stones included, is
  drawn inside the GROUND `<Group matrix={camera.matrix}>`, which is emitted
  *before* the BILLBOARDS group in `ShuntingBoard.tsx`. Wagons and their
  labels are billboarded on top and always occlude the ballast beneath them,
  exactly as today — adding two low-opacity strokes under something that's
  already fully occluded changes nothing about label legibility. Keep both
  opacities at ≤0.30 specifically so the stones stay a texture, not a
  competing pattern, on the stretches of bed that *are* visible between
  cars.

---

## 4. Time of day

Everything above draws through the identical four-pass system every other
element already uses (`design/tokens.ts`'s `TimeOfDayPalette`,
`src/render/iso/timeOfDay.ts`). Two mechanisms already existing carry almost
all of the work:

1. **The whole-canvas `atmosphere` pass** (warm bloom by day, inset vignette
   at night — `ShuntingBoard.tsx`'s final `<Rect>` before `Confetti`) is
   drawn *last*, over sky, ground, track bed and billboards alike. Every new
   prop, drawn earlier in the stack, is automatically tinted/dimmed by it —
   **no new per-prop time-of-day token is needed for general mood.**
2. **`palette.scenery.structure`** (already exists, already drives the
   water tower + signal gantry) is the single fill colour every new
   silhouette prop (tower, warehouse, crane, fence, signage, cabinet,
   forklift) uses. **`palette.scenery.lampLight`** (already exists) drives
   every night-only lit-window/lamp-glow detail, with the exact same
   conditional (`palette.key === 'noche' ? dots : rect`) `IsoSky.tsx`
   already uses for its own lamp glow — copy that pattern, don't invent a
   new one.

Only **one genuinely new token pair** is needed — the ballast stipple
colours from §3, because nothing existing plays that role. Add both fields
to `track: { ballast, sleeper, rail, node }` in every pass:

| Pass | `ballast` (existing) | `ballastStoneHi` (new) | `ballastStoneLo` (new) |
|---|---|---|---|
| amanecer | `#4f4038` | `#7a6858` | `#2e241c` |
| mediodia | `#645844` | `#8f8168` | `#40382a` |
| atardecer | `#4a3b2e` | `#75604a` | `#2c221a` |
| noche | `#1d2735` | `#39485c` | `#10161f` |

(Each `Hi` is roughly the existing `ballast` lightened; each `Lo` is roughly
it darkened — starting points for the Skia artist to eyeball against the
real render, not a claim of colourimetric precision.)

Container hues (§2.4) are deliberately **not** palette-varied — they're
fixed pigment, tinted uniformly like everything else by the atmosphere pass,
exactly the way the reference image's saturated container colours would look
under different real-world lighting without needing five separate paint
jobs.

Night-specific behaviour, concretely:

- Control tower / warehouse: 1–3 small `lampLight`-coloured `Circle`s in the
  glazing band / on 1–2 of the 3 roller doors (never all three — see §2.1).
- Lamp posts: reuse `IsoSky`'s existing lamp-glow `Circle` pattern verbatim.
- Container stacks, gantry crane, fence, cabinet, forklift, signage: **no**
  night-specific treatment — they stay silhouette-only, tinted by the
  vignette like the existing hill already is at `hillOpacity: 0.9`.

---

## 5. Implementation notes for the Skia agent

- **New component, not a modified `IsoSky`.** Add a sibling,
  `IsoScenery.tsx`, taking `{ width, horizonY, foregroundOriginY,
  foregroundMarginPlane, recipeIndex, palette }` and rendering Zone A (sky
  band, screen-space, same technique as `IsoSky`) and Zone B (foreground,
  gated per §2.3) props for the given recipe. Keep `IsoSky` itself untouched
  except for wherever the two constants (hill, fence) get factored so both
  files can share them — don't duplicate the hill polyline.
- **Draw order in `ShuntingBoard.tsx`/`ClassificationBoard.tsx`:**
  `IsoScenery`'s Zone A layer draws where `IsoSky` currently draws (same
  slot, right after the sky gradient `Fill`, before the ground `<Group
  matrix={camera.matrix}>`). Its Zone B layer draws *inside* that same
  ground `<Group>`, positioned after `GroundPlane` but before
  `IsoTrackBed`, so foreground filler sits under the rails/ballast bleed the
  same way today's ground gradient does, and is itself occluded by nothing
  (nothing else draws in the foreground apron).
- **Billboarded vs. plane-projected, per prop:**
  - Zone A (sky band) props: always screen-space, exactly like `IsoSky`'s
    existing shapes. Never put these inside `camera.matrix` — they don't sit
    on the ground, they're backdrop.
  - Zone B (foreground) blobby filler (bush clumps): may be plane-projected
    (drawn with the ground group's matrix, at a `v` satisfying R2) so they
    recede/scale with the same perspective as the rest of the yard — they
    have no fine detail to smear.
  - Zone B props with a legible silhouette (lamp post, cabinet, forklift,
    foreground signage): **billboarded**, using the exact `Billboard`
    interface `shuntingLayout.ts` already exports (`{u, v, width, height}`)
    and the existing `Billboarded` helper component in `ShuntingBoard.tsx`.
    Anchor `v = rowV(trackCount - 1) + rowHeight/2 + FOREGROUND_GAP` (a new
    small constant, plane units) rather than `planeHeight`, so the prop
    doesn't drift arbitrarily far as `foregroundMarginPlane` grows on sparse
    levels — a fixed gap behind the last row reads better than "float
    wherever there happens to be room."
- **Layout exports needed.** `computeShuntingLayout` (and the
  classification equivalent) currently compute `topOffset`/`blockHeight`
  internally and don't expose them. Add
  `foregroundMarginPlane: number` (§1.3's R3 formula) and
  `foregroundOriginY: number` (`rowV(trackCount-1) + rowHeight/2`, the plane
  `v` the foreground band starts at) to `ShuntingLayout`/
  `ClassificationLayout`'s return object — both are one-line derivations
  from numbers the function already has.
- **Recipe wiring.** `GameScreen.tsx` has `levelId`; derive
  `sectionIndex = Math.floor((levelId - 1) / SHUNTING_SECTION_SIZE)` (reuse
  `src/controller/sections.ts`, don't re-implement the arithmetic) and pass
  it down to `ShuntingBoard` as a new optional prop (e.g. `sceneryRecipe:
  number`), defaulting sensibly if omitted so existing screenshot/test
  harnesses that don't pass it don't crash. Clasificación always uses its
  one fixed recipe — no wiring needed beyond a mode flag.
- **Performance rules, restated because they're load-bearing (DECISIONES
  §11):** no per-frame JS (`useMemo`/`React.memo` on every new component,
  keyed on recipe + palette + the handful of layout numbers that affect it,
  never on anything animated); no `BlurMask` anywhere in this feature (none
  of these elements are ever "selected/active"); no new `GestureDetector`
  or `hitTest` branch (R4).
- **Classification specifics.** `classificationLayout.ts` uses the same
  camera and the same `topPad`-based margin construction (with `topPad =
  spacing.lg = 16` instead of `12`, and a single throat rather than two), so
  §1's rules apply unchanged — only the exact worked numbers in §1.2's table
  would come out slightly roomier there. Re-derive them the same way before
  tuning Clasificación's `minMarginPlane` floors if they ever need to differ
  from §2.3's shunting values.

---

## 6. Risks

- **Biggest risk: a 7-track, 13-capacity, `hasRightLoco` level.** This is
  the case §1.2 already walks through — the foreground apron bottoms out at
  its guaranteed ~12-plane-unit floor, and *both* left and right edges are
  live throat geometry carrying loco travel. Everything in §2.3's foreground
  tier disappears (correctly, by R3) and the section is carried entirely by
  its Zone A (sky-band) composition. **If this still reads as crowded once
  built, the drop order is: foreground props first (already automatic via
  R3) → reduce a recipe's prop count from its full listing down to just the
  LEFT slot → drop to the two always-on constants (hill + fence) only.**
  Never drop the ballast stipple (§3) — it's the cheapest element and the
  one the user asked for by name, and it lives entirely within the existing
  ballast footprint, so it can never be "crowded out."
- **Vertical scroll.** Dense levels already make the canvas taller than the
  viewport and scroll (existing fallback, `design-system.md` §2.2 step 5).
  The sky band scrolls away with everything else when the player scrolls
  down to see far rows — this is pre-existing behaviour (`IsoSky` already
  lives in the scrollable canvas, not pinned chrome) and scenery inherits it
  for free; it is not a regression to check for, just worth confirming QA
  doesn't mistake it for one.
- **Two-throat sections doubling `IsoTrackBed` calls.** Already accounted
  for in §3.2's cost estimate (the ×2 multiplier), but worth re-flagging:
  any FUTURE addition to the ballast stipple (a third layer, wider strokes)
  should re-run that arithmetic at the 7-track/two-throat worst case before
  shipping, not eyeball it on a 2-track screenshot.
- **Container-hue confusion.** §2.4 keeps `containerHues` deliberately
  different from `destinationColors` in every shunting section specifically
  so a background box is never mistaken for a wagon-destination cue. The one
  exception (Clasificación's recipe) is safe *only* because those containers
  are sky-band/background-only there too — if a future edit ever moves them
  into the foreground tier or makes them billboarded near the row band,
  re-check this against R5 before shipping.
