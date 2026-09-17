# The isometric yard

How the board went from a flat top-down grid to a tilted diorama, what the
camera actually is, and where the implementation deliberately departs from the
design reference (*Patio de Trenes — Gráficas*, sections 3a–3d).

This is a **rendering-layer** document. The engine (`src/engine/*`),
controllers, level data, scoring and interaction rules are untouched by
everything described here.

---

## 1. Two coordinate spaces

| space | who speaks it | origin |
| --- | --- | --- |
| **plane** `(u, v)` | `layout/shuntingLayout.ts`, `layout/classificationLayout.ts`, the travel-animation waypoints, everything drawn inside the ground `<Group matrix>` | top-left of the yard; `+v` recedes **away** from the viewer |
| **screen** `(x, y)` | Skia canvas, the gesture handler | canvas dp |

`src/render/iso/isoCamera.ts` is the only thing that converts between them.

The yard is still laid out by the same algorithm as the flat board
(design-system.md §2.2) — rows, car columns, the peine throat. What changed is
that those numbers are now plane coordinates, and a camera projects them.

## 2. The camera is a homography, not a 4×4

Tilting a plane about a horizontal axis under a pinhole camera is *exactly* a
projective map of that plane, so it fits losslessly in a 3×3 matrix with a
non-affine bottom row. That buys two things a full 3D pipeline would not:

- `<Group matrix={camera.matrix}>` draws the entire ballast / rail / route
  layer straight from its existing plane coordinates. No geometry is
  pre-distorted; Skia applies the perspective. Straight lines stay straight,
  so rails narrow and sleepers foreshorten for free.
- `unproject` is closed-form, so a tap still resolves to the same
  `(track, column)` the flat board resolved to.

The reference built the tilt with CSS `perspective(1000px) rotateX(63deg)`.
Those numbers do **not** transfer — CSS resolves perspective against the
element's own pixel box, Skia against the canvas matrix — so the projection is
re-derived from the two things that actually define the look:

- `isoCameraTokens.tiltDeg` (63°) — the vertical foreshortening, `cos 63° ≈ 0.454`.
- `isoCameraTokens.perspective` (0.18) — how much bigger the near edge is than
  the far one, as a **dimensionless ratio** rather than a pixel focal length,
  so the camera angle is identical at every board size. Near ×1.22, far ×0.85,
  matching the reference's 1000px-over-a-400-deep-plane.

### Sizing runs backwards

`planeSizeForViewport()` answers "how big a plane fills this canvas at scale
1?" — the layout asks that **first**, lays the yard out in the plane box it
gets back, and only then builds the camera, which therefore has nothing left
to rescale. That is what keeps `carWidthMin`, `locoColumnWidth` and every
other dp-denominated token meaning what they always meant: one plane unit is
one dp at the yard's mid-depth.

## 3. Billboarding

Rolling stock is **not** drawn through the matrix. Only a car's anchor point
is projected; the sprite is then drawn upright in screen space at
`camera.depthScaleAt(v)`. That is the Skia equivalent of the reference's
`rotateX(-63deg)` counter-rotation.

**Anything carrying text must be billboarded.** A glyph painted onto the
tilted plane stretches into an unreadable smear — this bit the reference
during its own iteration and it bites here too. So: capacity badges, VÍA
labels, the `n/capacity` readouts and every car label go through
`project` + `depthScaleAt`, never inside the matrix group.

Two consequences:

- **Draw order is far row → near row**, so near cars occlude the row behind.
- **Hit-testing runs in screen space, nearest row first**, against the sprite
  boxes — which stand *up* from the rail rather than lying on it, so they are
  not the projection of the plane box. Empty car slots and bare row taps fall
  back to unprojecting onto the plane, which is what keeps the deposit gesture
  working exactly as before.

## 4. Deviations from the reference

Everything below is deliberate. The reference is final on colour, proportion
and composition; these are the places where a two-row mock and a real level
disagree.

| # | Reference | Here | Why |
| --- | --- | --- | --- |
| 1 | Car label badge centred in the body (`top: 17` of 52) | Upper half (`0.16h`, height `0.30h`) | The mock shows two non-adjacent occupied rows. A real level fills every row, and the car in front covers roughly the bottom third of the one behind. The letter is what the player reads the target sequence against, so legibility beats the exact inset. |
| 2 | Clearance wedges "billboarded like the wagons" (handoff prose) | Flat on the plane | The approved frames themselves draw them flat (no `rotateX(-63deg)` on those elements). They carry no text, and reading as a *lit stretch of track* is the point. The handoff's billboarding rule is about text, and text is billboarded. |
| 3 | Route line always shows `tirar → garganta → entrar` | Pull-out leg while a cut is selected; full route only while a move travels | There is no "pending destination" state in the engine — tapping a target executes the move. Drawing a line to a destination the player has not chosen would be inventing state; the green clearance markers already say which rows are legal. |
| 4 | Midday HUD: dark ink on dark glass (`rgba(20,40,55,.5)` + `#173049`) | Dark ink on **light** glass | The mock floats that glass over a bright sky; the app puts it on an opaque bar, where the same values land at ≈1.9:1 on the icon buttons. The design decision it encodes — *dark ink, because midday is the one pass with a light background* — is kept; the glass is inverted so the ink has something to be dark against. |
| 5 | Fixed 76×52 car, 92×60 loco | Derived per level | Two ceilings, whichever bites first: the car's own proportions (76:52), and the row pitch. A dense 7-track level gets shorter cars instead of a wall of overlapping bodies. |
| 6 | Sky gradient over the full frame | Gradient ends at the horizon | The ground covers everything below the horizon; spanning the full canvas compresses the whole ramp into the thin visible strip, so you only ever see its topmost colour. |
| 7 | — | Objective-chip ink picks itself | The chips take the exact body colour of the car they stand for, which now spans near-black balasto to midday's pale silver cisterna. Fixed white was illegible on the light end. |

## 5. Degradation on the densest level

`level_100` is 7 tracks × 13 capacity **with both throats** — more than the
plane is wide. The order of yielding is:

1. Cars keep `carWidthMin` (tap targets are not negotiable).
2. The throats collapse to `MIN_BRANCH_SPAN` rather than inverting.
3. The right locomotive ends up standing over the first stretch of curve.

Row count is absorbed by pitch down to `MIN_SCREEN_ROW_PITCH`; below that the
canvas grows taller than the viewport and the board scrolls vertically — the
same fallback design-system.md §2.2 step 5 always specified, just expressed in
projected dp. No shipped level reaches it on a landscape phone.

`src/render/layout/__tests__/shuntingLayout.test.ts` pins all of this.

## 6. Time of day

Four palettes over identical geometry (`timeOfDayPalettes` in `tokens.ts`),
chosen in Ajustes and persisted the way `SoundManager` persists mute. Purely
cosmetic: no engine, scoring, or level datum reads it. Default is `atardecer`,
the pass closest to the app's original dark-gold identity.

Everything **outside** `timeOfDayPalettes` — `destinationColors`,
`destinationMarkers`, `statusColors`, `medalColors`, `starColors` — is
untouched by the redesign. Destination colour is the classification mechanic
and its hue+shape pairing is an accessibility contract, not decoration.
