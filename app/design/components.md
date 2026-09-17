# Component Visual Specs

Concrete numbers per screen/component. All tokens referenced as `tokens.category.name` map
directly to exports in `design/tokens.ts`. Read `design/design-system.md` first for the
rationale (layout algorithm, motion rules, accessibility) — this file is the "build it exactly
like this" reference.

---

## 1. Login screen

- **Background**: full-bleed `LinearGradient` using `colors.background.gradientTop` →
  `colors.background.gradientBottom`, angle ≈160° (start `{x:0.15,y:0}`, end `{x:0.85,y:1}`).
- **Card**: centered, `width: min(340, screenWidth - 48)`, `paddingVertical: spacing.xxxl` (32),
  `paddingHorizontal: 28`, `borderRadius: radii.lg` (16... use 20 explicitly — see note), border
  `1dp` solid `colors.login.cardBorder`. Background: linear gradient
  `colors.login.cardGradientStart` → `colors.login.cardGradientEnd`, same 160° angle.
  - Shadow: layer two — `shadows.modal` (ambient black) plus a second gold ambient shadow
    (`shadowColor: colors.medal.gold`, `shadowOpacity: 0.15`, `shadowRadius: 40`, offset 0,0) to
    reproduce the reference's dual box-shadow.
  - Border radius: use **20dp** (not the `radii.lg` 16 token) — login is the one screen allowed a
    slightly larger radius than the shared card radius, matching the reference's 16px-on-380px-card
    proportion scaled up for a taller mobile card. Still reference `radii.xl` (20) rather than a
    magic number.
  - Entrance: fade+slide up 30dp, `motion.durations.cardEnter` (400ms), `easingCurves.decelerate`.
- **Logo glyph**: 🚂 emoji or custom loco glyph, 48dp, centered, `marginBottom: spacing.md`.
  Gold glow: `shadows.glowGold` at half radius (15). Idle "pulse" loop: scale 1 → 1.06 → 1, 2000ms,
  `withRepeat` + `withTiming`, ease standard.
- **Title**: "PATIO DE TRENES" (or app name), `typeScale.h1` at 24dp, color `colors.medal.gold`,
  `letterSpacing: 3`, centered, subtle gold text shadow (radius 20, opacity 0.4).
- **Subtitle**: `typeScale.bodySmall`, color `colors.text.dim`, `letterSpacing: 1`, centered,
  `marginBottom: spacing.xxl` (24).
- **Text input**: height **52dp**, `borderRadius: radii.md` (10), background
  `colors.login.inputBg`, border `1.5dp` `colors.login.inputBorder` → focus
  `colors.login.inputBorderFocus` + soft gold glow (shadowRadius 12, opacity 0.15).
  `typeScale.h3` (17dp) centered text, `letterSpacing: 1`, placeholder color
  `colors.login.placeholder`. Invalid-submit shake: translateX sequence
  `[-8, 8, -5, 5, 0]` over 400ms (`withSequence`) + `haptics.error`.
- **Submit button**: full width, height **52dp**, `borderRadius: radii.md`, gradient
  `colors.button.confirmLo` → `colors.button.confirmHi`, label `typeScale.button` (uppercase,
  `letterSpacing: 2`) white. Shadow: green ambient (`shadowColor: colors.button.confirmHi`,
  opacity 0.4, radius 16). Press: `scale 0.98`, `motion.durations.instant`.

---

## 2. Mode-select cards

- **Layout**: full-width column (minus `2 * spacing.xl` = 40dp side margins), 2 cards stacked,
  gap `layout.modeCardGap` (16dp). Each card `height: layout.modeCardHeight` (132dp).
- **Card shell**: `borderRadius: radii.lg` (16), background `colors.surface.card`, top inset
  highlight strip (`colors.surface.cardHighlight`, top 45% of card height, mimics reference's
  `fillRect(x+2,y+2,w-4,h*0.45)`), border `1dp` `colors.surface.cardBorder`.
- **Left accent bar**: 4dp wide, full height, rounded on the left corners only —
  `colors.modeAccent.shunting` (`#ffd700`) for Patio de Maniobras,
  `colors.modeAccent.classification` (`#f5a623`) for Patio de Clasificación.
- **Icon**: 40×40dp, left-aligned inside `paddingLeft: spacing.xl` (20, clearing the accent bar),
  vertically centered in the top 2/3 of the card. Simple glyph: locomotive silhouette (Maniobras)
  / branching track silhouette (Clasificación), tinted with the card's accent color.
- **Title**: `typeScale.h2` (20dp bold), `colors.text.primary`, one line.
- **Subtitle**: `typeScale.bodySmall`, `colors.text.dim`, max 2 lines, `numberOfLines={2}`.
- **Progress footer**: bottom-anchored inside the card, `height: 6dp`, `borderRadius: radii.xs/2`
  (3), track `rgba(255,255,255,0.08)`, fill = accent color, width = `done/total` fraction.
  Caption below/beside it (`typeScale.micro`, `colors.text.dim`): `"{done}/{total} completados"`.
- **Press state**: `scale 0.98`, border brightens to the accent color at 40% opacity,
  `motion.durations.instant`, `haptics.buttonPress`.

---

## 3. Level-select grid card

- **Grid**: 2 columns `<400dp` width, 3 columns `≥400dp` (see design-system §2.4). Side margins
  `spacing.lg` (16), gap `layout.levelGridGap` (12) both axes.
- **Card size**: `width = (screenWidth - 2*16 - (cols-1)*12) / cols` (≥ `layout.levelCardMinWidth`
  150dp is guaranteed at 2 columns on any phone ≥360dp), `height = width * layout.levelCardAspectRatio`
  (0.92) — e.g. 158dp wide → ~145dp tall on a 360dp phone.
- **Card shell**: `borderRadius: radii.md` (10), background `colors.surface.card`, drop shadow
  `shadows.card`, top highlight strip (`cardHighlight`, top 45%), border `1dp` `cardBorder`.
- **Star-tier left stripe**: 4dp wide, full height, left corners rounded only, color from
  `colors.starTierStripe[starsEarned]` (0→grey, 1→bronze `#6d4c41`, 2→silver `#607d8b`,
  3→`colors.medal.gold`).
- **Content stack** (centered column):
  1. `"NIVEL"` / `"TURNO"` label — `typeScale.micro`, `colors.text.dim`, `marginTop: 12`.
  2. Level number — `typeScale.display`-derived but sized to fit: `min(26, cardWidth*0.2)`dp,
     bold, color `colors.text.primary` if ≥1 star else `colors.text.dim`.
  3. Star row — 3 stars, radius `min(7, cardWidth*0.055)`dp, gap = `radius*2.2`, centered,
     `marginTop: 8`.
  4. Best-score caption — `typeScale.micro` (`min(11, cardWidth*0.085)`dp), `colors.text.dim`:
     `"{score}pts"` if the level tracks score (classification, or shunting once scored) else
     `"{moves}m"`.
- **Bottom progress bar**: separate from the star-tier stripe — a thin **3dp** bar spanning
  `cardWidth - 16` margins, inset `8dp` from the bottom edge, track
  `rgba(255,255,255,0.08)`, fill width = `starsEarned/3`, fill color = the same tier color as the
  left stripe. This is the second, distinct "progress" affordance requested alongside the
  star-keyed stripe — stripe communicates *tier at a glance* (color-coded edge), bar communicates
  *progress toward 3 stars* (fill amount), and they always agree.
- **Whole card is the tap target** (no sub-hit-testing needed — card ≥150×138dp, far above 48dp).
  Press: `scale 0.97`, `haptics.buttonPress`.

---

## 4. In-game HUD

### 4.1 Top bar (`layout.topBarHeight` = 56dp floor for row 1 + a compact stat row + safe-area top inset)

Background `colors.surface.headerBg`, bottom hairline `1dp` `rgba(255,255,255,0.06)`,
`shadows.hudBar`. Two rows stacked vertically so nothing can collide on phones from ~360dp to
~430dp wide — width budget at 360dp: 16dp horizontal padding + 152dp left icon group + ~192dp
free for the center label/badge on row 1; row 2's stat strip needs ~206dp of the same 344dp,
right-aligned. See `TopBar.tsx` for the exact numbers.

- **Row 1 — icon buttons + level label**, `minHeight: layout.topBarHeight` (56):
  - **MENÚ / REINICIAR / DESHACER buttons**: left group, icon-only glyphs ("←" / "↺" / "↩") on a
    `layout.minTapTarget` (48×48) square button, `marginLeft: spacing.xs` (4) between them, fills
    `colors.button.neutral` / `colors.button.neutralAlt` / `colors.button.undo`
    (`colors.button.undoDisabled` + `disabled` when no undo history). Each keeps its full Spanish
    name ("MENÚ"/"REINICIAR"/"DESHACER") as `accessibilityLabel` since the visible glyph alone
    isn't readable by screen readers.
  - **Center**: `"NIVEL {n}"` / `"TURNO {n}"`, `typeScale.h2`, `colors.text.primary`, centered in
    the remaining flexible space. If `locoLimit` is finite, a pill badge directly below: `height
    20`, `borderRadius: radii.pill`, fill `rgba(74,20,140,0.7)`, text `typeScale.micro`, color
    `#ce93d8`, `"🚂 MÁX {n} VAGÓN{ES} / MANIOBRA"`.
- **Row 2 — stat strip**, right-aligned, `paddingHorizontal: spacing.sm`, inline
  label+value pairs (not stacked, to stay short vertically), separated by `spacing.lg` (16):
  - TIEMPO: label `typeScale.caption` `colors.text.dim`, value `typeScale.body` bold
    `colors.text.primary`, format `m:ss`.
  - MANIOBRAS / PUNTOS: same treatment; classification mode shows `PUNTOS` in
    `colors.status.warning` (amber) instead of `colors.text.primary`, matching the reference's
    `C.AMBER` score readout.

### 4.2 Objective bar (`layout.objectiveBarHeight` = 40dp, directly below top bar)

Background `colors.surface.targetBg`, bottom hairline `rgba(255,255,255,0.04)`.

- **Shunting**: left label `"OBJETIVO:"` (`typeScale.caption`, `colors.text.dim`), then a
  horizontal row of target-sequence chips: each **28×20dp**, `borderRadius: 3`, gradient fill from
  the car's `wagonMaterials.*.hi`→`.lo`, label centered white bold 12dp, separated by a `›` glyph
  (`colors.text.dim`). Row is horizontally scrollable if it overflows (rare — target sequences run
  2–4 cars).
- **Classification**: left, the level name (`typeScale.body`, `colors.text.primary`); right,
  `"POR CLASIFICAR: {n}"` (`typeScale.bodySmall`, `colors.text.dim`); center, "Próximo: {tipo} ·
  destino {NOMBRE}" with the destination name in `destinationColors[color].fill` bold — port the
  reference's two-tone text measurement approach (dim prefix, colored bold destination name).

### 4.3 Message toast

Anchored above the bottom bar, `maxWidth: layout.toastMaxWidth` (320), `height: layout.toastHeight`
(44), centered horizontally, `borderRadius: radii.md`, fill `rgba(198,40,40,0.92)`
(error) — success variant uses `rgba(46,125,50,0.92)` for non-error confirmations if ever needed.
Text `typeScale.body`, white, centered. Enter: fade+scale-in 150ms; auto-dismiss after **2000ms**
(matches reference's 120-frame timer), fade out 150ms. Pairs with `haptics.moveRejected` on the
error variant.

### 4.4 Bottom action bar (`layout.bottomBarHeight` = 56dp + safe-area bottom inset)

Background `colors.surface.headerBg`, top hairline, `shadows.hudBar` (inverted offset, `height:
-2`). Single centered **REINICIAR** button, `width: 128`, `height: 48`, same styling as the top
bar's REINICIAR — this is the thumb-zone-reachable duplicate the reference already includes
(bottom-anchored primary action), keep it.

---

## 5. Game canvas framing

- Canvas region = the flexible body between objective bar and bottom bar (see design-system §2.1),
  `paddingHorizontal: spacing.md` (12), `paddingVertical: spacing.sm` (8).
- Canvas background: same vertical gradient as the app background
  (`colors.background.gradientTop/Bottom`) plus the `colors.background.grid` line overlay at
  `layout.gridSize` (48dp) pitch, both axes, `1dp` lines.
- **Peine (fan throat)**: convergence point `layout.peineConvergenceInset` (24dp) from the yard's
  left edge (or right edge, mirrored, for `rightLoco` levels), fanning out to
  `layout.locoColumnWidth` (56dp) where the track rows begin. Ballast fill `colors.track.ballast`,
  sleepers alternate `colors.track.sleeperA`/`sleeperB`, rails `colors.track.railHighlight`/
  `railShadow` as a 6dp gradient stroke, convergence/branch nodes `colors.track.peineNode` (5dp
  dot) over `colors.track.peineSpine`.
- **Locomotive button**: `layout.locoButtonSize` (48×48dp square — bumped from the reference's
  52×36), gradient fill `colors.loco.idleLo/idleHi` (parked) or `colors.loco.activeLo/activeHi`
  (active on this track), cab window `colors.loco.cabWindow`, headlight dot
  `colors.loco.headlight` + halo `colors.loco.headlightGlow` when active. Active state adds
  `shadows.glowDanger`-style red glow (reuse the loco's own active color, radius 12).
- **Wagon car**: `height: layout.carHeight` (44dp), width per the §2.2 clamp formula (34–60dp),
  `borderRadius: radii.wagonBody` (3). Body gradient per `wagonMaterials[shape].hi/lo`, wheel
  bogies at the bottom (dark discs, ported 1:1 from `_carBoxcar`/etc. geometry — proportionally
  scaled to `carHeight`). Label badge: dark chip (`rgba(0,0,0,0.58)`) behind white bold label text
  per design-system §6.1's contrast rule.
- **Selected-car glow**: `shadows.glowSelected` (cyan, `colors.carGlow`), pulsing per
  `motion.pulseRates.selectedCar` (0.8Hz), opacity range 0.5–1.0 on the shadow layer.
- **Clearance / push marker**: 6dp wide chevron beside each track's entry point. Valid-destination
  state: `colors.status.success` fill, pulsing per `motion.pulseRates.clearanceMarker` (0.48Hz),
  alpha 0.75–1.0, plus glow radius 8–18dp. Invalid/idle state: flat `rgba(200,208,218,0.18)`, no
  animation.
- **Capacity badge** (single-loco tracks only): `"{n}/{cap}"`, `typeScale.bodySmall`, color
  `colors.capacity.ok` or `.full` when at capacity, positioned in `layout.capacityColumnWidth`
  (44dp) to the right of the track.
- **Colorblind-safety badge** (classification cars only): 10dp geometric marker
  (`colors.destinationMarkers[color]` shape) in the car's top-left corner, drawn in the
  destination's `.dark` tone so it reads against the `.fill` body — see design-system §6.3.

---

## 6. Win / summary card

- **Overlay**: full-bleed `colors.surface.winOverlay`, confetti burst on entry
  (`motion.durations.confetti`, once per result via a `winSpawned`-style guard),
  `haptics.win` fired on entry, `haptics.newRecord` ~150ms later if applicable.
- **Card**: `width: min(layout.winCardMaxWidth (640), screenWidth - spacing.giant (64))`, height auto (content-
  driven, roughly 520–620dp depending on mode/breakdown), `borderRadius: radii.xl` (20),
  background `#0f1525` (a card-specific near-black distinct from `surface.card`, matches
  reference), border `2dp`: `rgba(105,240,174,0.3)` (shunting) / `rgba(245,166,35,0.35)`
  (classification) normally, or a pulsing gold border (`colors.medal.gold` at 0.3–0.6 opacity,
  `motion.pulseRates.recordGlow` 0.64Hz, `shadows.glowGold`) when `newRecord` is true. Entrance:
  spring in (`motion.springs.bouncy`), slight scale 0.9→1 + fade.
- **Title**: `"¡NIVEL {n} COMPLETADO!"` / level name, `typeScale.h1`-derived
  (`min(32, cardWidth*0.055)`dp), `colors.status.success`, centered.
- **Star row**: 3 stars, radius 18dp, gap 42dp between centers, centered, each popping in with
  `motion.springs.bouncy` staggered 100ms and paired with `haptics.starReveal`.
- **New-record pill** (conditional): `width: 200`, `height: 28`, `borderRadius: radii.pill`, fill
  `rgba(255,215,0,0.12)`, border `rgba(255,215,0,0.5)`, text `"★ ¡NUEVO RÉCORD! ★"`
  `typeScale.bodySmall` bold gold.
- **Stats line**: `typeScale.bodySmall`, `colors.text.dim`, centered —
  shunting: `"MANIOBRAS: {moves}{ (óptimo: n)} · TIEMPO: {mm:ss} · {score} pts"`;
  classification: big score number (`typeScale.numericLarge`, 40dp, `colors.status.warning`)
  centered above `"de {max} posibles · TIEMPO: {mm:ss}"`.
- **Breakdown** (classification only): 3 rows, each **21dp** tall, label left
  (`typeScale.body`), value right bold:
  1. `"Carros clasificados"` → `"+{n*10}"`, `colors.text.primary`.
  2. `"Saltos de color ({n})"` → `"−{n*15}"`, `colors.text.warn` if n>0 else `colors.text.dim`.
  3. `"Vías de un solo color"` → `"+{bonus}"`, `colors.status.success`.
- **Embedded leaderboard panel**: inset `16dp` margins, fill `colors.surface.panel`,
  `borderRadius: radii.sm` (8), header (`typeScale.bodySmall` bold, `colors.status.success` if
  global / `colors.text.dim` if local) `"RANKING GLOBAL — NIVEL {n}"` / `"PUNTAJES — NIVEL {n}"`.
  Internally scrollable, up to 10 rows, each `layout.winCardEmbeddedRowHeight` (44dp):
  rank number + name left (`flex: 1`, `numberOfLines={1}`, truncates), score center (fixed `96dp`,
  `numberOfLines={1}`), `"{moves}m · {mm:ss}"` right (fixed `112dp`, `numberOfLines={1}`). Score
  and time use fixed widths rather than a proportional flex split specifically so they never wrap
  onto a second line regardless of card width — see DECISIONES §7. Medal color
  (`colors.medal.gold/silver/bronze`) for ranks 1–3, `colors.text.dim` (bold-if-me exception below)
  for 4–10. **"Me" row**: background tint `rgba(79,195,247,0.08)`, all three text segments in
  `colors.text.me` (`#4fc3f7`) bold — this exact highlight treatment must be identical between the
  win-card's embedded board and the standalone leaderboard screen (§7).
- **Action row**: `REPETIR` (96×48, secondary), `MENÚ` (96×48, secondary), `SIGUIENTE →` (120×48,
  primary) and, when `shareText` is set, `COMPARTIR` (120×48, secondary) — all four as direct
  siblings of one `flexWrap: 'wrap'` row, `justifyContent: 'center'`, `gap: spacing.sm` (8dp) in
  both directions, `width: '100%'` so the wrap measures against the actual card width. The app is
  landscape-locked (DECISIONES §11) so in practice all four sit on a single centered line; the
  wrap only engages as a fallback on an unusually narrow window, where it produces a second fully
  centered line rather than an orphaned, left-aligned button (this replaced an earlier nested-View
  layout that produced exactly that ragged wrap — DECISIONES §7). When there is no next level,
  replace `SIGUIENTE →` with `"¡JUEGO COMPLETADO!"` text (no emoji — DECISIONES §10) in
  `colors.medal.gold`, `typeScale.h3` bold, as one more sibling in the same wrap row.

---

## 7. Leaderboard screen (standalone)

- **Header**: `height: 74dp`, fill `rgba(0,0,0,0.45)`, title `typeScale.h1`-derived
  (`min(38, w*0.045)`), `colors.medal.gold` (shunting) / `colors.status.warning` (classification),
  `← VOLVER` button top-left (`130×42`, `colors.button.neutral`).
- **Rows**: `layout.leaderboardRowHeight` (72dp), zebra striping
  (`colors.surface.rowStripe` on even rows), `1dp` bottom hairline `rgba(255,255,255,0.05)`.
  - **Level badge**: `layout.leaderboardBadgeSize` (56×52dp), `borderRadius: radii.sm` (6), fill
    `rgba(255,255,255,0.05)`. `"NIV"`/`"TUR"` micro label, level number 20dp bold, mini star row
    (radius 7dp) below, `"LOCAL"`/`"GLOBAL"` micro tag (`colors.status.success` if global else
    `colors.text.dim`).
  - **Top-3 mini-cards**: inline row of up to 3, each ≈30% of remaining row width,
    `borderRadius: radii.sm` (6), fill `rgba(255,255,255,0.04)`. Rank+name
    (`typeScale.bodySmall` bold) in medal color; stats line (`typeScale.caption`,
    `colors.text.dim`) `"{score}pts · {moves}m · {mm:ss}"`.
  - **"Me" highlighting**: identical rule to §6 — if the current player appears in a row's board
    (any rank, not just top 3), that entry gets the cyan tint + bold `colors.text.me` treatment,
    consistently whether it lands in the top-3 mini-cards or would-be positions beyond.
- **Empty state**: centered `typeScale.h2`, `colors.text.dim`, `"Aún no has completado ningún
  {nivel/turno}."`.
