wagon-art-spec.md
=================

Redraw spec for the five isometric-yard wagon shells in `src/render/primitives/IsoWagon.tsx`
(`cubierto`, `gondola`, `cisterna`, `tolva`, `balasto`), and for their selection treatment.
Written for a Skia implementer to code from directly — no drawing decisions are left open.

This document does **not** touch `ClassificationWagon.tsx` — see "Scope note" at the end for why.

---

## 0. User complaint, restated precisely

> "The drawings of the cars aren't that good... cartoon-ify the cars better, so they don't
> look so square... give the car drawings some detail... more realistic without ceasing to
> be a cartoon. And when they're selected — right now a blue square-shaped outline light
> appears — it should be the CONTOUR OF THE CAR, not necessarily a blue square."

Ground truth in the current code: 4 of the 5 shells (`cubierto`, `gondola`, `cisterna`,
`tolva`) are a single `RoundedRect x={0} y={0} width={w} height={h} r={h*0.04..0.058}` —
i.e. a barely-rounded rectangle — with 1–2 flat inset rectangles on top. Only `balasto`
already breaks out of the box (a 4-point tapered `Path`). And the selection treatment in
`IsoWagonImpl` draws exactly that same full bounding box twice: a blurred
`RoundedRect x={0} y={0} width={w} height={h}` halo, then a `RoundedRect x={-1} y={-1}
width={w+2} height={h+2}` stroke. That bounding-box rectangle **is** the "blue square" —
independent of which of the five shells sits inside it.

Both problems have the same fix: **stop treating the car as a bounding box** — for the
body silhouette *and* for the selection highlight — and start treating it as a real
outline. Section 1 gives that outline per kind; section 4 makes the selection trace it.

---

## 1–3. Per-kind spec

Coordinates are fractions of `w`/`h`, local units, top-left origin, matching the file's
existing convention (`M 0.02w,0.86h` etc.). All paths stay inside the `0..w / 0..h` box
(no point exceeds it) and every silhouette keeps at least a majority-width span touching
`y = h` for rail contact, per the brief's hard constraint. Colors reference the *existing*
`IsoWagonMaterial` fields (`hi`, `lo`, `cap`, `inset`, `domeHi`, `domeLo`) and existing
`isoHardware` tokens (`bogieBar`, `wheel`, `wheelEdge`, `bodyEdge`/`bodyEdgeNight`,
`rimLight`, `labelBadgeBg`/`Text`) — **no new tokens are strictly required** (see §3 note
per kind for the one or two places I'd add something anyway).

**Shared lighting recipe, standardized across all five (fixes an existing inconsistency,
where only `cubierto`/`gondola` had the rim-light band):**
1. Top→bottom `LinearGradient(mat.hi → mat.lo)` fill on the main silhouette (unchanged).
2. A `mat.cap` solid band across the *roof/top* region only (unchanged idea, new shape
   per kind since the top is no longer a flat rect edge on 3 of 5 kinds).
3. A **rimLight band** (`isoHardware.rimLight`, i.e. `rgba(255,255,255,0.22)`) sitting
   just below the cap, ~8–10% of `h` tall — this is the "sun/sky bounce" cue that already
   exists on `cubierto`/`gondola` and is now added to `cisterna`/`tolva`/`balasto` too, so
   light direction reads identically on every kind (matches `LocoButton.tsx`'s single
   top-lit convention).
4. A 1px ink outline (`isoHardware.bodyEdge` / `bodyEdgeNight` at night) traced on the
   *actual silhouette path*, not a bounding rect — this is the cartoon "line weight," kept
   from the current code but now correctly hugging the new shape.

**Shared badge anchor:** move the shared `badgeY` constant in `IsoWagonImpl` from `h*0.16`
to **`h*0.20`**. I checked this against every new silhouette below and it lands on a flat,
unobstructed panel in all five (see each kind's "Badge" line) — this is the *only* change
needed outside the per-shell functions, and it's a one-line constant edit.

**Cheap vs. expensive, up front (governs every "drop at small size" call below):** a
closed `Path` — however many straight-line vertices — is one fill + one stroke draw call,
same cost class as the `RoundedRect` it replaces. That's always-on and free. What's
expensive at yard scale (dozens of cars, whole surface repaints every animated frame) is
(a) `BlurMask` on anything not selected, and (b) many *small separate* draw calls per car
(rivet dots, multi-rung ladders) multiplied across every car on screen. Rule used
throughout: **silhouette + 1–3 big interior shapes + the rim-light/cap bands = always on;
anything drawn as a scatter of ≥3 tiny shapes = gated behind a size check.**

Add one local threshold to `IsoWagonImpl` or `Shell`: `const detailed = w >= 46;` (`w` is
the prop already in scope, a plain per-render comparison, not per-frame — cars only
re-render when their own props change). Below 46 local units — meaningfully smaller than
`layout.carWidthMax` (60) and close to the yard's practical minimum after the camera's
depth scale shrinks far rows — skip the "drop at small size" items called out per kind.

---

### 3a. Cubierto (boxcar)

**Research basis:** real boxcars are a tall closed box with the roof *overhanging* the
side sheets slightly (an eave step), corner posts/ladders at the ends, and a sliding door
with visible rail hardware above it — the eave is the single detail that most breaks up a
"box" silhouette without adding cost (Union Pacific / general boxcar references; corner
posts and roof overhang are the two features every stylized boxcar asset in the freight-car
stock-art surveyed keeps even at icon size — see Sources).

**1. Silhouette** (10 pts — roof is a *wider* band than the body, an eave step, plus
top-corner chamfers so the roofline isn't a hard rectangle corner):

```
M 0.04w,0
L 0.96w,0
L 1.00w,0.05h
L 1.00w,0.12h
L 0.985w,0.16h
L 0.985w,1.00h
L 0.015w,1.00h
L 0.015w,0.16h
L 0,0.12h
L 0,0.05h
Z
```

**2. Detail pass**

| Element | Coords | Color | Opacity | Stroke |
|---|---|---|---|---|
| Body fill | full silhouette above | `LinearGradient(mat.hi→mat.lo)` vertical | 1 | — |
| Roof cap | `M0.04w,0 L0.96w,0 L1.00w,0.05h L1.00w,0.12h L0.985w,0.16h L0.015w,0.16h L0,0.12h L0,0.05h Z` (top slice of the same silhouette) | `mat.cap` | 1 | — |
| Rim light | Rect `x=0.015w y=0.18h w=0.97w h=0.09h` | `isoHardware.rimLight` | 1 (token is pre-alpha'd) | — |
| Sliding door panel | Rect `x=0.36w y=0.24h w=0.28w h=0.60h` | `mat.inset` | 1 | 1px `rgba(0,0,0,0.4)` |
| Door handle | Rect `x=0.61w y=0.50h w=max(1.5,0.026w) h=0.10h` | `rgba(0,0,0,0.5)` | 1 | — *(drop below 46)* |
| Corner posts | Line `x=0.05w` and `x=0.95w`, `y: 0.18h→0.96h` | `rgba(0,0,0,0.25)` | 1 | width 1 |
| Ladder (right end) | 3× Line `x:0.90w–0.96w`, `y=0.30h/0.50h/0.70h` | `rgba(0,0,0,0.35)` | 1 | width 1.2 *(drop below 46)* |
| Tack/data board | Rect `x=0.06w y=0.66h w=0.12w h=0.14h` | `mat.inset` | 0.5 | 0.75px `rgba(0,0,0,0.3)` *(drop below 46)* |
| Ink outline | full silhouette path, stroke | `isoHardware.bodyEdge`/`bodyEdgeNight` | 1 | 1px |

**3. Palette hooks:** no new tokens. Uses `mat.hi/lo/cap/inset` exactly as today, just
applied to the new roof-slice/door-panel shapes instead of a plain rect.

**4. Badge:** `y=0.20h` — sits between the eave (ends 0.16h) and the door top (0.24h), on
plain wall metal, for every kind that shares this y (see §4 for why it's now shared).

---

### 3b. Gondola

**Research basis:** open-top gondolas read by their raised corner/end posts (stake
pockets) breaking the top edge, plus visible ribbing on the open well's inside — the low,
jagged-topped profile is what separates a gondola's silhouette from a boxcar's *closed*
box, at any size (per the silhouette-first principle from the ArtStation/Medium research
below: interior ribs are what convince up close, but the jagged top-corner posts are what
reads first, in silhouette, from a distance).

**1. Silhouette** (10 pts — corner posts stick up as small notches above the main top
edge; the bottom edge tapers in slightly at the very corners, echoing `balasto`'s existing
taper convention so the family reads as one design language):

```
M 0.02w,0.14h
L 0.02w,0.06h
L 0.11w,0.06h
L 0.11w,0.14h
L 0.89w,0.14h
L 0.89w,0.06h
L 0.98w,0.06h
L 0.98w,0.14h
L 0.94w,1.00h
L 0.06w,1.00h
Z
```

**2. Detail pass**

| Element | Coords | Color | Opacity | Stroke |
|---|---|---|---|---|
| Body fill | full silhouette | `LinearGradient(mat.hi→mat.lo)` | 1 | — |
| Top rim cap | Rect `x=0.02w y=0.14h w=0.96w h=max(1.5,0.04h)` | `mat.cap` | 1 | — |
| Rim light | Rect `x=0.11w y=0.18h w=0.78w h=0.10h` | `isoHardware.rimLight` | 1 | — |
| Open well (recess) | Rect `x=0.13w y=0.30h w=0.74w h=0.55h` | `mat.inset` | 1 | — |
| Ribs | 3× Line `x=0.30w/0.50w/0.70w`, `y:0.30h→0.85h` | `rgba(0,0,0,0.3)` | 1 | width 1 |
| Post highlight | Line `x=0.065w` and `x=0.935w`, `y:0.07h→0.13h` | `rgba(255,255,255,0.15)` | 1 | width 1 *(drop below 46)* |
| Ink outline | full silhouette, stroke | `isoHardware.bodyEdge`/Night | 1 | 1px |

**3. Palette hooks:** no new tokens.

**4. Badge:** `y=0.20h`, centered over the well (`0.30w–0.70w` band, clear of the posts
which only occupy `x<0.11w` / `x>0.89w`).

---

### 3c. Cisterna (tanker)

**Research basis:** the existing `RoundedRect` "dome" (`r = domeH/2`, i.e. a stadium/pill
shape) is *already* a reasonable stylized tank cylinder — keep it verbatim, don't redraw
it. What reads as "the square" here is the **chassis** underneath: a full-height,
full-width `RoundedRect(0,0,w,h)`. Real tank cars sit the cylinder on a narrower saddle/sill
with small end platforms + handrails at both ends, and the tank's rounded ends visibly
overhang the frame (GATX tank-car-anatomy references, AAR field guide — see Sources). That
overhang + the exposed sill/platform structure is what needs to replace the boxy chassis.

**1. Silhouette:** this kind keeps its outer shape as **4 separate primitives** rather
than one path (see §4 for why — it avoids fragile multi-contour path math and reuses
`RoundedRect`'s existing stroke/blur support):
- **Tank** (unchanged): `RoundedRect x=0.053w y=0.154h width=0.894w height=0.538h
  r=height/2`.
- **Sill** (new, replaces the chassis rect): `Path "M 0.16w,0.62h L 0.84w,0.62h L
  0.78w,1.00h L 0.22w,1.00h Z"`.
- **End platform L**: `Rect x=0 y=0.66h width=0.11w height=0.22h`.
- **End platform R**: `Rect x=0.89w y=0.66h width=0.11w height=0.22h`.

**2. Detail pass**

| Element | Coords | Color | Opacity | Stroke |
|---|---|---|---|---|
| Sill fill | shape above | `mat.lo` | 1 | 1px `edge` |
| Sill top highlight | Line `x:0.16w→0.84w`, `y=0.62h` | `isoHardware.rimLight` | 1 | width 1 |
| Platform L/R fill | shapes above | `mat.lo` | 1 | 1px `edge` |
| Platform rails | Line across each platform's top edge | `isoHardware.bogieBar` | 1 | width 1 |
| Tank gradient | unchanged | `LinearGradient(mat.domeHi→mat.domeLo)` | 1 | — |
| Body bands (2) | unchanged | `rgba(0,0,0,0.28)` | 1 | `max(1,w*0.02)` |
| Specular highlight | unchanged `Oval` | `rgba(255,255,255,0.3)` | 1 | — |
| Tank outline | unchanged | `edge` | 1 | 1px |

Everything under "unchanged" is exactly the current `Cisterna` tank-drawing code —
**do not touch it**; only the chassis primitives change.

**3. Palette hooks:** no new tokens — `mat.lo` (already the chassis-dark color) covers the
sill and platforms.

**4. Badge:** `y=0.20h` lands inside the tank (`domeY=0.154h` to `0.692h`) — reads as a
real placard on the tank shell, which is where tank cars actually carry their reporting
marks/diamond.

---

### 3d. Tolva (covered hopper)

**Research basis:** a covered hopper's single most recognizable trait is the **hourglass**
profile — vertical-walled box up top (with an arched/peaked roof carrying trough hatches),
pinching inward to a narrow discharge neck, then the lower hopper-bay slope sheets flaring
back out toward the truck bolsters before the frame ends (Union Pacific "what is a covered
hopper" + patent-literature slope-sheet/hatch descriptions — see Sources). None of the
other four kinds pinch inward, so this alone makes `tolva` unmistakable in silhouette,
which is the property the research on silhouette-first readability calls out as what has
to survive stylization.

**1. Silhouette** (12 pts):

```
M 0.06w,0.32h
L 0.06w,0.06h
L 0.20w,0.02h
L 0.80w,0.02h
L 0.94w,0.06h
L 0.94w,0.32h
L 0.62w,0.62h
L 0.62w,0.74h
L 0.90w,1.00h
L 0.10w,1.00h
L 0.38w,0.74h
L 0.38w,0.62h
Z
```

The neck (`0.38w`–`0.62w`, a 0.24w gap) is sized so it stays ≥ ~8 local units even at
`layout.carWidthMin` (34) — comfortably above single-pixel risk after depth scale (see
§Risks for the one case this can still get thin).

**2. Detail pass**

| Element | Coords | Color | Opacity | Stroke |
|---|---|---|---|---|
| Body fill | full silhouette | `LinearGradient(mat.hi→mat.lo)` | 1 | — |
| Roof cap | `M0.06w,0.06h L0.20w,0.02h L0.80w,0.02h L0.94w,0.06h L0.94w,0.14h L0.06w,0.14h Z` | `mat.cap` | 1 | — |
| Rim light | Rect `x=0.08w y=0.16h w=0.84w h=0.10h` | `isoHardware.rimLight` | 1 | — |
| Roof hatches (2) | Rect `x=0.30w/0.54w y=0.025h w=0.16w h=0.025h` | `mat.inset` | 0.5 | 0.75px `rgba(0,0,0,0.3)` *(drop below 46)* |
| Discharge chute | Rect `x=w/2-max(1,0.013w) y=0.62h w=max(2,0.026w) h=0.30h` | `rgba(0,0,0,0.5)` | 1 | — |
| Ink outline | full silhouette, stroke | `edge` | 1 | 1px |

**Deliberate interaction with `Bogies`, noted so nobody "fixes" it defensively:** the
flare's bottom edge only spans `x:0.10w–0.90w`, while `Bogies`' trucks are inset at
`0.066w`. That leaves a sliver (`0.066w–0.10w` each side) where the body doesn't cover the
truck at the very bottom row — this reads as the underframe/bolster peeking out from under
the hopper's skirt, which is exactly how a real hopper looks from this angle. Keep it.

**3. Palette hooks:** no new tokens.

**4. Badge:** `y=0.20h` — inside the vertical-wall zone (`0.06h`–`0.32h`), clear of the
roof hatches (`0.02h`–`0.05h`) and the pinch (starts at `0.32h`... actually the wall itself
runs to where the slope begins, `0.32h→0.62h` is the sloping segment, so `0.20h` sits
squarely on the flat wall, well clear of both).

---

### 3e. Balasto (ballast hopper)

**Research basis:** kept closest to today's shape (it was already the one non-rectangular
kind) but restructured as a vertical-walled "bathtub" top with a wedge taper only in the
*lower* half, rather than a straight top-to-bottom diagonal — this is closer to how
unit-train ballast/aggregate hoppers actually taper (near-vertical sides for most of the
height, slope sheets only near the bottom discharge) and it visually separates `balasto`
from `tolva`'s hourglass (pinch-then-flare) so the two "hopper-family" kinds don't read as
near-duplicates of each other at a glance.

**1. Silhouette** (6 pts):

```
M 0.03w,0.30h
L 0.03w,0.06h
L 0.97w,0.06h
L 0.97w,0.30h
L 0.85w,1.00h
L 0.15w,1.00h
Z
```

**2. Detail pass**

| Element | Coords | Color | Opacity | Stroke |
|---|---|---|---|---|
| Body fill | full silhouette | `LinearGradient(mat.hi→mat.lo)` | 1 | — |
| Top rim | Rect `x=0.03w y=0.06h w=0.94w h=max(1.5,0.06h)` | `mat.cap` | 1 | — |
| Rim light | Rect `x=0.03w y=0.11h w=0.94w h=0.09h` | `isoHardware.rimLight` | 1 | — |
| Sloped ribs (2) | Line `(0.20w,0.30h)→(0.28w,1.00h)` and `(0.80w,0.30h)→(0.72w,1.00h)` | `rgba(0,0,0,0.28)` | 1 | width 1 |
| Discharge chute | unchanged from current code | `rgba(0,0,0,0.5)` | 1 | — |
| Ink outline | full silhouette, stroke | `edge` | 1 | 1px |

**3. Palette hooks:** no new tokens.

**4. Badge:** `y=0.20h`, inside the vertical-wall zone (`0.06h`–`0.30h`).

---

## 4. Selection treatment — trace the silhouette, not the box

**Precedent already in the codebase:** `LocoButton.tsx`'s active loco already does exactly
what's being asked for here — it builds `bodyPath` once, then reuses it for *both* the
glow and the outline:

```tsx
<Path path={bodyPath} color={palette.loco.hi} opacity={0.5}>
  <BlurMask blur={h * 0.09} style="normal" />
</Path>
<Path path={bodyPath}>...</Path>  {/* fill */}
...
<Path path={bodyPath} style="stroke" strokeWidth={1.2} color="rgba(255,140,140,0.45)" />
```

`IsoWagonImpl` should adopt the identical pattern instead of its current
`RoundedRect x={0} y={0} width={w} height={h}` halo + `RoundedRect x={-1} y={-1}
width={w+2} height={h+2}` stroke. Concretely:

1. **Lift each shell's silhouette into a named function** (`cubiertoPath(w,h)`,
   `gondolaPath(w,h)`, `tolvaPath(w,h)`, `balastoPath(w,h)` — one string each, per §1–3;
   `balasto` already does this as its local `body` `useMemo`, just needs exporting/lifting
   next to the other four). `Shell`'s fill `<Path path={...}>` and the selection glow/stroke
   both call the *same* function — single source of truth, geometry can't drift.

2. **Replace the pre-`Bogies` halo:**
   ```tsx
   {isSelected && (
     <Path path={silhouette} color={isoHardware.selectHalo}>
       <BlurMask blur={glowBlur} style="normal" />
     </Path>
   )}
   ```
   Because a path-hugging glow covers less area than the old full-box halo, bump the halo's
   alpha so it stays as visible from a glance: change `isoHardware.selectHalo` from
   `'rgba(127,231,255,0.22)'` to **`'rgba(127,231,255,0.32)'`** (value tweak, same token —
   not a new one). Keep `glowBlur` exactly as derived today (`(h*0.1 + pulse.value*h*0.1) *
   1.4`, driven by the existing `motion.pulseRates.selectedCar` shared value) — the pulse
   logic doesn't change, only what shape it's applied to.

3. **Replace the post-`Shell` stroke:**
   ```tsx
   {isSelected && (
     <Path path={silhouette} style="stroke" strokeWidth={2} strokeJoin="round"
           color={isoHardware.selectEdge} />
   )}
   ```
   Drawn directly on the silhouette coordinates (no `-1/+2` outward padding — a stroke
   straddles its path by half its width automatically, same as `LocoButton`'s rim stroke).

4. **Cisterna is the one exception**, because its "silhouette" is 4 separate primitives
   (§3c) rather than one path. Group all four under the same treatment instead of one
   `<Path>`:
   ```tsx
   {isSelected && (
     <Group>
       <RoundedRect ...tank... color={isoHardware.selectHalo}><BlurMask blur={glowBlur} /></RoundedRect>
       <Path ...sill... color={isoHardware.selectHalo}><BlurMask blur={glowBlur} /></Path>
       <Rect ...platformL... color={isoHardware.selectHalo}><BlurMask blur={glowBlur} /></Rect>
       <Rect ...platformR... color={isoHardware.selectHalo}><BlurMask blur={glowBlur} /></Rect>
     </Group>
   )}
   ```
   and the same 4-shape grouping for the stroke pass. This costs 4 blurred draws instead of
   1 for a *selected* car only — bounded (typically 0–2 cars selected at once) and an
   acceptable tradeoff versus the fragility of hand-building an SVG arc path to merge a
   pill + trapezoid + two rects into one contour. (If a future pass wants a single unified
   glow, the alternative is one multi-subpath path string built with an SVG `A` arc command
   for the tank's rounded ends — flagged as an option, not the recommendation, precisely
   because arc-flag mistakes are an easy way to silently break the shape.)

**Constraint respected:** only the `isSelected` branch ever mounts a `BlurMask` — every
other change in this document is blur-free, matching the existing "dense level repaints
every frame" note in the file's own comments.

---

## 5. Label badge — summary

All five kinds share `badgeY = h * 0.20` (moved from `0.16`) as verified per-kind above.
No kind needs an independent badge position; the redesigned silhouettes were deliberately
built to keep a flat, unobstructed panel at that height (wall metal on `cubierto`/`tolva`/
`balasto`, the open well on `gondola`, the tank shell on `cisterna`). This is the one shared
(non-per-shell) code change in `IsoWagonImpl` this spec calls for.

---

## 6. Constraints checklist for the implementer

- **Local units, top-left origin** — unchanged. Every coordinate above is `w`/`h` fractions
  exactly like today's code.
- **No projection awareness** — unchanged. Nothing here reads camera/depth state.
- **`Bogies` reused as-is** — unchanged, same `w`/`h` signature, same call site (before
  `Shell` in the render tree). One deliberate interaction to *keep*, not fix: `tolva`'s
  flared skirt exposes a sliver of the truck at the very bottom corners (§3d) — this is a
  feature, matching how a real hopper's underframe peeks from under its skirt.
- **`IsoWagonProps` API unchanged** — nothing in this spec needs a new prop; `width`,
  `height`, `label`, `isSelected`, `palette`, `labelSize` are sufficient. The only shared
  (non-shell-local) code touch is the `badgeY` constant (§5) and the two selection-render
  blocks (§4).
- **No per-frame JS work** — the `detailed = w >= 46` check and the silhouette functions
  are plain per-render (not per-animation-frame) computations, same cost class as the
  `useMemo`'d `body` path `balasto` already has.
- **Cheap vs. expensive** — closed `Path`s (however many straight vertices) ≈ free, same
  cost as the `RoundedRect`s they replace. `BlurMask` stays gated to `isSelected` only, per
  the existing convention. Anything that scatters ≥3 small separate shapes per car (ladder
  rungs, roof hatches, tack board, door handle) is gated behind `detailed = w >= 46` — see
  the "drop below 46" annotations in each detail table.
- **No new tokens required.** Every fill/stroke above reuses an existing
  `IsoWagonMaterial` field or `isoHardware` constant. The two token *value* tweaks proposed
  (not new keys) are: `isoHardware.selectHalo` alpha `0.22 → 0.32` (§4). Everything else in
  `design/tokens.ts` is untouched.

---

## Before/after rationale

| User complaint | Root cause found in code | Fix in this spec |
|---|---|---|
| "cars aren't that good... too square" | 4 of 5 shells are a single near-unrounded `RoundedRect(0,0,w,h)` | Each shell replaced with a shape-specific polygon/path (§3a–e) whose silhouette alone (no fill/color) reads as its real-world type |
| "some ARE square... but not SO rectangular" | Acknowledged directly: `cubierto` (boxcar) and `balasto`(hopper-adjacent) really are boxy prototypes in real life | Their new silhouettes stay fundamentally box-shaped (eave step, vertical-wall-then-wedge) rather than being forced into curves they wouldn't have — only `cisterna`/`tolva` get the more dramatic profile change their prototypes actually have |
| "give the drawings some detail... more realistic" | Interior detail today is 1–2 flat rects (a door slab, an inset panel) | Each kind gets 3–6 named, coordinate-exact interior features (sliding-door hardware, corner posts + ladder, tank sill + end platforms + rails, roof hatches + discharge neck, sloped ribs) drawn from real freight-car anatomy (§ research basis per kind) |
| "without ceasing to be a cartoon" | — | Kept exaggerated proportions (thick posts, oversized dome/tank, chunky taper), few shapes, single flat light source, thin ink outline — the stylization principles in the Sources below, not photorealism |
| "blue square-shaped outline... should be the CONTOUR OF THE CAR" | Selection halo + stroke are both drawn against `RoundedRect(0,0,w,h)` regardless of shell | §4: halo and stroke both switch to the shell's own silhouette path (mirroring the pattern `LocoButton.tsx`'s active body already uses) |

---

## Risks flagged for small render sizes

1. **Tolva's neck** (`0.38w`–`0.62w`, a 0.24w span) stays ≥ ~8 local units at
   `carWidthMin` (34), but far-row cars are additionally shrunk by the iso camera's depth
   scale (`isoCameraTokens`), which this spec's local-unit geometry has no visibility into.
   At the farthest/smallest rows the pinch could compress to only 1–2 physical px and
   alias. Mitigation if it looks bad in practice: let the implementer add a *render-time*
   (not per-frame) check on the final screen-space width and fall back to `balasto`'s
   simpler single-taper silhouette for `tolva` below some very small threshold — not
   pre-solved here because it depends on the board's actual depth-scale curve, which this
   file doesn't own.
2. **Gondola's corner-post notches** (`0.09w` wide each) are the thinnest new feature in
   this set — comfortably visible near the front row, borderline at `carWidthMin`. If they
   alias, dropping them entirely at `w < 46` (folding into the same `detailed` gate already
   used for other small details) is a safe, low-effort fallback; the taper + ribs still
   carry the "open low car" read on their own.
3. **Cisterna's 4-shape selection group** is 4 blurred draws instead of 1 for a selected
   car. Bounded by how many cars can be selected at once (small in this game's rules), but
   flagging it as the one kind whose selection cost isn't O(1) relative to the others.
4. **Roof hatches on `tolva`** (`0.025h` tall) are the smallest absolute detail specified
   anywhere in this document — they're already gated behind `detailed = w >= 46`; if they
   still don't read cleanly at 46, raising that shape's own threshold independently (e.g.
   `w >= 52` just for the hatches) is a safer call than deleting them, since roof hatches
   are one of the few unambiguous "this is a hopper, not a boxcar" cues at a glance.
5. **Standardizing the rim-light band onto `cisterna`/`tolva`/`balasto`** (currently only
   on `cubierto`/`gondola`) is a visible brightness change to three kinds across all four
   time-of-day passes. It should look like consistent lighting, not a mismatched patch —
   worth a quick visual pass across all four `timeOfDayPalettes` once implemented, since
   `isoHardware.rimLight` is a single fixed alpha-white that was tuned against only two
   shell types.

---

## Sources

Research grounding the anatomy and stylization calls above:
- [What Is a Covered Hopper Rail Car? — Union Pacific](https://www.up.com/customers/track-record/tr071321-what-is-a-covered-hopper-rail-car.htm) — slope-sheet taper toward the discharge, roof hatch placement.
- [Hopper Cars — Modeling the Southern Pacific in HO Scale](http://modelingthesp.com/Rolling_Stock/Hopper_Cars.html) — side-sheet/slope-sheet proportions used for the `tolva` hourglass.
- [Tank Car Anatomy GATX Chart — Railway Educational Bureau](https://www.railwayeducationalbureau.com/product/tank-car-anatomy-gatx-chart/) and [Field Guide to Tank Cars — AAR](https://www.aar.org/wp-content/uploads/2022/08/AAR-2022-Field-Tank-Car-Guide-FINAL-08.01.2022.pdf) — saddle/sill, end platforms, handrails, tank overhang beyond the frame, used for `cisterna`'s new chassis.
- [Instantly Recognizable: The Importance of Silhouette in Game Props — ArtStation](https://www.artstation.com/blogs/francescos010/G9DqY/instantly-recognizable-the-importance-of-silhouette-in-game-props) and [Character Design: Shape Language and Readability — Medium/80Level](https://medium.com/@EightyLevel/character-design-shape-language-and-readability-6ee4bb6f98a6) — silhouette-first readability test ("fill solid black, remove interior detail, still recognizable"), used to prioritize which features are load-bearing per kind (§ "research basis" per kind) versus which are droppable at small size.
- Freight-car stock-art surveys ([iStock: freight train silhouette](https://www.istockphoto.com/illustrations/freight-train-silhouette), [Dreamstime: cartoon freight train cars](https://www.dreamstime.com/illustration/cartoon-freight-train-cars.html)) — cross-checked that stylized/cartoon rail-car assets in the wild consistently keep boxcar roof overhang, gondola corner posts, and tanker dome/saddle as their few "meaningful details" even at small icon sizes, confirming those as the right features to keep in the "always on" tier per kind above.
- In-repo precedent: `src/render/primitives/LocoButton.tsx`'s active-loco body (`buildBodyPath` + `<Path>` glow/fill/stroke reuse) is the direct pattern this spec asks `IsoWagon.tsx` to adopt for car selection (§4) — not external research, but the strongest and most directly applicable reference available, since it's the same renderer, same lighting convention, same file family.

---

## Scope note — `ShuntingWagon.tsx` and `ClassificationWagon.tsx`

- **`ShuntingWagon.tsx`** is dead code. It is not imported anywhere in `src/` (confirmed by
  grep — the only match is the file's own definition), and its own file header says so
  explicitly: *"SUPERSEDED by IsoWagon.tsx... Nothing imports it since the isometric yard
  landed... Edit IsoWagon.tsx instead; changes here reach no screen."* This spec correctly
  ignores it; nobody should port these silhouettes back into it.
- **`ClassificationWagon.tsx`** is very much alive — it's imported and rendered three times
  in `src/render/ClassificationBoard.tsx` (arrival-track head car, arrival-track queue,
  classification-track cars). It belongs to the *other* game mode (Patio de Clasificación),
  where the mechanic is color-matching to a destination rather than label sequencing: its
  five body types (`F`/`T`/`V`/`J`/`C`) are already less "plain rounded rect" than
  `IsoWagon`'s pre-spec shells were (e.g. `VBody` is already a 6-point hopper hexagon,
  `JBody` already has cage bars, `CBody` already has container ribs), and its selection
  treatment (a low-opacity warning-colored glow rect over the body, not a stroked bounding
  box) is a different, already-less-"square" mechanism than the one the user is complaining
  about here. Given the user's feedback was specifically about "the cars" they see in normal
  play and about a "blue square" selection outline — which matches `IsoWagon`'s cyan
  `carGlowColor`/`selectEdge` treatment exactly, not `ClassificationWagon`'s amber
  `statusColors.warning` glow — I read this task as scoped to the shunting-yard cars only.
  **Recommendation:** treat `ClassificationWagon.tsx` as a good follow-up candidate for the
  same "selection traces the real silhouette" principle (its `FBody`/`TBody`/`CBody` are
  still bounding-rect-ish), but out of scope for this pass unless asked — it's a separate
  component, separate mode, separate visual language (flat destination-color fill + a
  colorblind marker badge, not a wagonMaterial finish), and changing it wasn't part of the
  feedback that triggered this spec.
