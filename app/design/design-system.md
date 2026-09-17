# Train Shunting — Mobile Design System

Portrait-first, Android-primary, built on Expo + React Native + `@shopify/react-native-skia`.
This document defines the *rules*; `design/tokens.ts` is the single source of truth for every
concrete value (color, spacing, radius, type, shadow, timing, haptic, layout constant); import
from there, don't re-declare. `design/components.md` applies these rules screen by screen.

Grounded in `ref/style.css`, `ref/js/core/canvas.js`, `ref/js/shunting/renderer.js`,
`ref/js/classification/renderer.js`, and `ref/js/{shunting,classification}/state.js`. Numbers
below were cross-checked against the real level data in
`app/assets/levels/{shunting,classification}/*.json`.

> **The game board is no longer flat.** Both yards are now drawn as a tilted
> isometric diorama — see `design/isometric-yard.md` for the camera, the
> billboarding rule, and where the implementation departs from the design
> reference. The sections below still govern everything else (type, spacing,
> HUD, screens, motion, accessibility), and the §2.2/§2.3 layout *algorithms*
> are still the ones the board uses — their output is just plane coordinates
> now, which a camera projects. Where §2.2 says "dp", read "plane units at the
> yard's mid-depth"; they are the same number by construction.

---

## 1. Principles

1. **Rail-yard command console, not a toy.** Dark cockpit background (`colors.background`),
   high-contrast HUD text, amber/green/gold signal coloring for state. The original's identity —
   technical, slightly industrial, glowing accents on a near-black canvas — is the identity. We
   are polishing the execution (touch ergonomics, motion, spacing), not changing the mood.
2. **Color is load-bearing, never decorative.** In Patio de Clasificación, `color === destination`
   is the mechanic. In Patio de Maniobras, `wagonMaterial` is cosmetic (car identity reads by
   letter label), but `capacityColors` and `statusColors` communicate game state. Never introduce
   a new color for the sake of variety — every hue in `tokens.ts` means something.
3. **Big, unambiguous touch targets over dense information.** The reference is a mouse-first
   canvas app scaled down for phone browsers; several original tap targets (individual wagons at
   zoomed-out capacity) would land under 20dp on a phone. Every *interactive* element in the RN
   port meets `layout.minTapTarget` (48dp) — see §4.
4. **Juice communicates outcome, not just decoration.** Stagger, pulse, glow, confetti, and
   haptics all exist in the reference; keep them, but pair every visual pulse with a matching
   haptic where the interaction is a discrete outcome (win, reject, undo) — see §5.
5. **One HUD language across both modes.** Maniobras and Clasificación share the exact same HUD
   chrome, buttons, card shapes, and leaderboard layout; only `modeAccent` (gold vs. amber) and
   the yard content differ. A player who's learned one mode should never have to re-learn UI.

---

## 2. Portrait layout grid

### 2.1 Screen scaffold

Every gameplay screen (not login/mode-select) uses a fixed-header, scrollable-body,
fixed-footer scaffold:

```
┌───────────────────────────────┐  ← safe-area top inset
│ Top bar        56dp            │  layout.topBarHeight
│ Objective bar  40dp            │  layout.objectiveBarHeight
├───────────────────────────────┤
│                                 │
│  Yard (scrollable if needed)    │  flexible — see §2.2
│                                 │
├───────────────────────────────┤
│ Bottom action bar  56dp        │  layout.bottomBarHeight
└───────────────────────────────┘  ← safe-area bottom inset
```

Top bar + objective bar + bottom bar are `position: absolute`/pinned via a flex column with
`flex: 1` on the yard body — never re-rendered inside a ScrollView. This mirrors the reference's
`drawHUD` being redrawn every frame on top of a scrollable menu, but as real RN view layering so
Skia only has to redraw the yard canvas, not the whole screen, on scroll.

### 2.2 The portrait yard layout algorithm (shunting)

The reference lays every mode out on a fixed 1024×768 "world" and zooms the whole thing to fit
the screen — on a tall phone that means either tiny cars (fit-to-width) or a huge letterboxed
gutter (fit-to-height). We drop the fixed-world/camera-zoom model for gameplay screens and lay
out directly in screen dp, because portrait phones want **vertical scroll**, not shrinkage, when
content overflows.

**Reference deck checked** (`app/assets/levels/shunting/*.json`): tracks range 1–7, capacity
ranges up to 13, `rightLoco` appears from level 80+ (7 tracks, capacity 11–13).

Algorithm, per level, computed once on level load and on rotation/resize:

1. **Row pitch is fixed, not derived.** Every track is one row, `layout.trackRowHeight` (64dp)
   tall with `layout.trackRowGap` (4dp) between rows — `layout.trackRowPitch` = 68dp regardless
   of level. This is the single biggest departure from the reference (`TRACK_SPACING: 80` world
   units, cars regardless of row could shrink). Fixed pitch means loco buttons, capacity badges,
   and clearance markers never resize between levels — only the cars do.
2. **Car width fits the level's capacity to the available width.**
   ```
   available = screenWidth - 2*layout.sideMargin - layout.locoColumnWidth
             - (hasRightLoco ? layout.locoColumnWidth : layout.capacityColumnWidth)
   carWidth  = clamp(
                 floor((available - (capacity-1)*layout.carGap) / capacity),
                 layout.carWidthMin,   // 34dp
                 layout.carWidthMax    // 60dp
               )
   ```
   Worked example, 360dp-wide phone, capacity 8 (a mid-game level): available ≈ 360-32-56-44 =
   228dp → carWidth = floor((228-28)/8) = 25dp → clamped to floor **34dp**. That already exceeds
   available width slightly — see step 3.
3. **Touch-target compliance without growing the car.** Car touch area is padded with `hitSlop`
   up to 48dp on every side that's under the minimum: `hitSlop = max(0, (48 - carWidth) / 2)`
   horizontally, and the row height (64dp) already exceeds 48dp vertically, so cars never need
   vertical hitSlop. This keeps dense tracks legible without inflating the wagon art.
4. **Escape hatch: per-row horizontal scroll.** When `carWidth * capacity + (capacity-1)*carGap`
   still exceeds `available` even at the 34dp floor (only happens on capacity ≳ 11 tracks on
   phones narrower than ~400dp — i.e. the `rightLoco` endgame levels), that single track row
   becomes an independent horizontally-scrollable strip (its own gesture/ScrollView, content
   bounded to that row, snapping to car boundaries). The loco button, capacity badge, and row
   label stay pinned outside the scroll. Render a 12dp edge-fade gradient on whichever side has
   more offscreen content so the affordance is visible without an explicit scrollbar. This is
   deliberately rare — it only triggers on the hardest handful of levels — so it is not the
   default interaction model.
5. **Vertical stacking, not shrinking, absorbs track count.** With `trackRowPitch` = 68dp fixed,
   7 tracks (the observed max) = 476dp of yard content. On a typical Android viewport (safe
   content height after chrome ≈ 520–620dp depending on device/status-bar/gesture-nav height),
   that fits without scrolling on most phones and scrolls on the smallest ones (e.g. compact
   5.4"–5.8" devices, or split-screen). The yard body is wrapped in a vertical scroll container
   whenever `tracks.length * layout.trackRowPitch > yardViewportHeight`; there is no minimum-zoom
   fallback — scrolling is always available and always cheap because row pitch never changes.
6. **The peine (fan throat) art scales to the row layout, not the reverse.** Convergence point
   sits `layout.peineConvergenceInset` (24dp) from the yard's left edge; the fan-out bezier
   geometry from `drawPeineBranch`/`drawPeine` in `ref/js/shunting/renderer.js` ports directly —
   it's parametrized by two endpoints and works in any coordinate space. Recompute control points
   in dp using the row Y-centers from step 1, not the reference's hardcoded 1024×768 world.
   `rightLoco` levels mirror the same geometry off the yard's right edge.

### 2.3 Portrait yard layout algorithm (classification)

Same row-pitch model. Arrival rows stack above classification rows with a labeled 24dp divider
gap between the two groups (reference: "VÍAS DE LLEGADA" / "VÍAS DE CLASIFICACIÓN" section
labels). Checked against real level data (`app/assets/levels/classification/*.json`): arrivals 1–4
rows, classification tracks 2–4 rows, capacity up to 12. Worst case (level 10: 4 + 4 = 8 rows) ×
68dp pitch + 2×24dp divider = 592dp — scrolls on most phones, which is fine per §2.2 step 5.
Car sizing uses the same clamp formula against `arrSlots`/`clasSlots` (the reference's per-mode
max-length values) instead of shunting `capacity`.

### 2.4 Breakpoints

Only two are needed given the fixed-pitch model (unlike the reference's 5-tier
`getMenuLayout` column logic, which existed to fit a *landscape desktop* grid):

| Class | Width range | Applies to |
|---|---|---|
| Compact | < 400dp | Level grid: 2 columns. Win-card action row: buttons stack if `SIGUIENTE →` label pushes total row width past screen. |
| Regular | ≥ 400dp | Level grid: 3 columns. Everything else identical. |

Tablets/large screens are out of scope for this pass (Android phone target per the brief); if
revisited, add a 600dp+ tier that caps yard content width at ~480dp and centers it rather than
stretching cars wide.

---

## 3. Safe-area handling

Use `react-native-safe-area-context`'s `useSafeAreaInsets()` — do not hardcode notch/status-bar
heights.

- **Top bar**: `paddingTop: insets.top`, background (`colors.surface.headerBg`) extends *behind*
  the status bar (draw full-bleed, pad content only) so the dark HUD reads as one continuous
  surface with the system status bar, matching the reference's edge-to-edge canvas.
- **Bottom action bar**: `paddingBottom: max(insets.bottom, spacing.sm)` — always keep at least
  8dp above the button row even on devices with zero gesture-nav inset, so buttons never sit flush
  against the physical screen edge.
- **Login / mode-select / win-card overlays**: full-bleed background, but all interactive content
  (card, buttons) respects `insets` via `SafeAreaView`/`useSafeAreaInsets` padding — never let a
  button center under a punch-hole camera or gesture-nav bar.
- **Landscape**: out of scope (portrait-locked per `app.json` `"orientation": "portrait"`), but if
  a rotation lock is ever relaxed, insets already handle the side notches — no separate code path
  needed.

---

## 4. Tap targets (≥ 48dp)

`layout.minTapTarget = 48` is the floor for every element a user can press, full stop. Concrete
compliance per component (see `components.md` for exact dimensions):

| Element | Visual size | Touch size | How it's met |
|---|---|---|---|
| HUD buttons (MENÚ, REINICIAR, DESHACER) | height 48dp | 48dp | Height set directly to 48dp |
| Locomotive button | 48×48dp | 48×48dp | Bumped from reference's 52×36 |
| Wagon car (dense track) | as low as 34dp wide | 48dp wide | `hitSlop` per §2.2 step 3 |
| Level-grid card | ≥150×138dp | full card | Card itself is the target, no sub-hit-testing |
| Arrival-selector chevron button | 52×40dp visual | 48×48dp | `hitSlop` top/bottom 4dp |
| Star row (decorative, not tappable) | 16dp stars | n/a | Never a tap target — informational only |
| Leaderboard row | 72dp tall | scroll-only, not tappable | No compliance needed (non-interactive) |
| Win-card action buttons | 48dp tall | 48dp | Height set directly to 48dp |

**Rule of thumb for new components:** if it's `onPress`-able, its layout box (including hitSlop)
must be ≥48×48dp. If it's purely informational (stars, badges, leaderboard rows outside the
overlay's own scroll), no minimum applies — but keep 44dp+ for legibility anyway (see
`layout.winCardEmbeddedRowHeight`).

---

## 5. Motion & juice

All values live in `tokens.motion`. Ports the reference's feel (`AnimationManager`,
`particles.spawnConfetti`, the various `sin(animTime*k)` pulses) into RN idioms.

### 5.1 Durations & easing

- **Car/loco travel** (`motion.durations.carMoveBase` = 380ms + up to `carMoveDistanceMax` =
  450ms scaled by normalized track distance, exactly mirroring the reference's
  `0.38 + 0.45 * distFactor`): use `motion.easingCurves.travel`, a symmetric ease-in-out. Multi-car
  moves stagger each car's start by `motion.carMoveStagger` (10%) of the total duration — car *i*
  begins at `i * 0.10 * duration`, identical cadence to the reference so players who know the web
  version feel zero discontinuity.
- **UI transitions** (card open/close, button press, screen nav): `motion.durations.base` (200ms)
  with `motion.easingCurves.standard`. Entrances use `decelerate`, exits use `accelerate`.
- **Card/star pop-ins** (win-card entrance, star reveal): `motion.springs.bouncy` via Reanimated
  `withSpring`, not a duration-based curve — springs read as more "game-like" than tweens for
  celebratory elements.
- **Buttons**: press scale 0.97, `motion.durations.instant` (100ms), `motion.easingCurves.standard`.

### 5.2 Looping pulses

Every "breathing" glow in the reference (selected car, clearance marker, tutorial highlight,
record border) is a `sin(animTime * k)` computed once per frame against a shared clock. In RN,
drive each with a Reanimated `withRepeat(withTiming(...), -1, true)` loop at the Hz values in
`motion.pulseRates` rather than a global per-frame clock — cheaper (no per-frame JS thread work)
and framework-idiomatic. Amplitude/opacity ranges match the reference (e.g. clearance marker
`0.75 + 0.25*pulse` alpha).

### 5.3 Confetti

Port the reference's lightweight particle burst (`ref/js/core/particles.js`, not reviewed line by
line here but referenced by both renderers) as a Skia `Group` of ~40–60 particles with randomized
velocity/rotation, gravity, and fade-out over `motion.durations.confetti` (1200ms). Trigger once
per win/summary screen (guard with a `winSpawned`-equivalent flag exactly like the reference, so
re-renders don't re-trigger it).

### 5.4 Haptics

`tokens.haptics` maps every discrete outcome to a feedback style (see file comments for the exact
`expo-haptics` call each string maps to). Non-negotiable pairings:

- Move confirmed → `medium` impact, fired the instant the move is accepted (not after the
  animation finishes) so feedback feels responsive even during the 380–830ms travel animation.
- Move rejected (full track, loco limit, occupied by other loco) → `error` notification,
  simultaneous with the red toast (reference: `game.message` / `clf.message`).
- Win → `success` notification on state transition to WON/SUMMARY, before confetti starts.
- New record → a second `success` pulse ~150ms after the win haptic (a "double tap" of feedback
  reinforces that this result is extra-special, matching the gold glow treatment on the card).
- Star reveal → one `light` impact per star as it pops in (staggered ~100ms apart), skipped
  entirely if the device has haptics disabled — always check
  `Haptics.impactAsync` doesn't throw on unsupported devices (wrap in try/catch or feature-detect).

---

## 6. Accessibility

### 6.1 Contrast

Checked against WCAG 2.1 AA (4.5:1 body text, 3:1 large text ≥18dp bold or ≥24dp regular) on the
darkest realistic background (`colors.background.gradientTop` `#0d1117`):

| Pair | Ratio | Verdict |
|---|---|---|
| `text.primary` (#e8eaf6) on `#0d1117` | ~15.8:1 | Pass (body & large) |
| `text.dim` (#7986cb) on `#0d1117` | ~5.4:1 | Pass (body & large) |
| `status.success` (#69f0ae) on `#0d1117` | ~13.9:1 | Pass |
| `medal.gold` (#ffd700) on `#0d1117` | ~15.6:1 | Pass |
| `text.warn` (#ff5252) on `#0d1117` | ~4.9:1 | Pass (body), borderline for very small caption sizes — keep warn text ≥13dp |
| `destinations.ambar.fill` (#E9C63F) text/label on card fill itself | n/a — ambar is a fill color, not text; car labels drawn on it use black-ish outline text per §6.3 | — |
| White label text on `destinations.*.fill` (e.g. verde #47B26B) | 2.1–3.6:1 depending on hue | **Fails AA for small text.** Reference mitigates this with a dark semi-opaque label backing (`fillRR(... 'rgba(0,0,0,0.58)')` before the label) — keep that pattern for any text stamped directly on a destination-colored surface. |

Action item baked into `components.md`: any label text drawn on top of a `destinationColors.*.fill`
or `wagonMaterials.*` surface must sit on a `rgba(0,0,0,0.55–0.6)` backing chip, never directly on
the raw fill — this is already the reference's convention (`drawCar`'s label badge), just keep it
mandatory rather than incidental.

### 6.2 Dynamic type

RN `<Text>` components (HUD numbers, buttons, cards, leaderboard, login) should respect the OS
font-scale setting up to a cap:

- `allowFontScaling: true` by default on all UI text.
- Cap with `maxFontSizeMultiplier: 1.3` on tightly-constrained single-line HUD elements (top bar
  labels/values, level-card numbers, leaderboard rows) so a 200% system font-scale setting can't
  break a 56dp-tall bar's layout — verified against the tightest real string, `"MANIOBRAS"` label
  at `typeScale.caption` (11dp) in a ~64dp-wide column.
- No cap on the win-card breakdown, tutorial modal body copy, or login copy — these have vertical
  room to reflow and should scale freely (`maxFontSizeMultiplier` unset, i.e. no cap).
- Skia canvas text (wagon labels, in-yard HUD baked into the canvas) is **not** subject to OS font
  scaling — Skia draws raw glyphs at a fixed size. This is an accepted gap (matches the reference,
  which is a canvas app); all *reachable-by-scaling* information (objective, moves, time, score,
  messages) must also exist in the RN-rendered HUD chrome around the canvas, never *only* inside
  the Skia yard, so screen-reader/large-text users always have an accessible copy.

### 6.3 Color-blind safety

Destination-color matching is literally the classification game's win condition, and two of the
five destinations (`rojo` #E14B4B, `verde` #47B26B) sit close to the canonical red-green confusion
axis for deuteranopia/protanopia (~8% of men). Two mitigations, both already scaffolded in
`tokens.ts`:

1. **`destinationMarkers`** — a fixed geometric shape per destination (circle/square/triangle/
   diamond/star), independent of the wagon's *type* shape (F/T/V/J/C). Paint a small (10–12dp)
   marker badge in the top-left corner of every classification car and next to each classification
   track's "VÍA X" label, so destination is always confirmable by shape, not just hue.
2. **Text redundancy already in the reference** — the HUD's "Próximo: Furgón · destino ROJO" line
   and the "VÍA A/B/C" labels are text, not color, and must stay. Never remove the textual
   destination name in favor of a color-only chip.

### 6.4 Motion sensitivity

Respect `AccessibilityInfo.isReduceMotionEnabled()` (React Native) / `prefers-reduced-motion`
equivalent: when enabled, cut car-travel animation duration by ~60% (instant-feeling snap rather
than a full 380–830ms glide) and skip confetti's velocity/rotation flourish in favor of a simple
fade-in, while keeping all haptic and static-state feedback (stars, gold border, score) intact.
This is additive scope beyond the reference (which has no such switch) but is a one-line guard
worth wiring from day one rather than retrofitting.

---

## 7. Fonts in Skia (implementation note for the renderer agent)

`fontFamily.*` values in `tokens.ts` are **RN/expo-font family names** — they work automatically
in `<Text>` once `useFonts({ Rajdhani_500Medium, Rajdhani_600SemiBold, Rajdhani_700Bold })` from
`@expo-google-fonts/rajdhani` resolves. They do **not** work automatically inside a Skia canvas:
Skia text needs an explicit `Skia.Typeface`, loaded via `useFont`/`matchFont` from a bundled
`.ttf` asset (the same font files `@expo-google-fonts/rajdhani` installs under
`node_modules/@expo-google-fonts/rajdhani/*/Rajdhani_*.ttf`, or re-exported as local assets).
Until that wiring exists, Skia text must fall back to `fontFallback.android` /
`fontFallback.ios` system fonts — never leave Skia text un-styled (default Skia typeface is a
generic serif that clashes badly with the RN chrome around it).

---

## 8. What's intentionally *not* ported from the reference

- **Camera drag/zoom** (`camera.x/y/zoom`, mouse-wheel zoom) — replaced by the fixed-pitch
  vertical-scroll model in §2.2. Portrait phones scroll vertically far more naturally than they
  pan/zoom a puzzle board.
- **`getMenuLayout`'s 5-tier column breakpoint system** — collapsed to the 2-tier table in §2.4;
  the reference's tiers existed for landscape desktop widths (750px, 1050px) this app will never
  render at.
- **Per-frame global `animTime` clock** — replaced by independent Reanimated loops per animated
  element (§5.2); avoids a single shared mutable clock driving JS-thread work every frame.
