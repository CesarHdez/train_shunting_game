/**
 * Diesel shunting-locomotive asset + tap button.
 *
 * Redrawn as an EMD-family road switcher (GP38/GP40 side profile) per user
 * direction — the previous stubby centre-cab switcher is replaced with the
 * classic "long low hood + tall boxy cab + short blunt nose" silhouette:
 *
 *   [long hood, low, rear ~58% of length] [tall BOXY cab, ~25%] [short hood, ~17%, blunt nose]
 *
 * with a continuous deck/frame band + light sill stripe running the full
 * length underneath, and the shared `Bogies` trucks at the very bottom. NO
 * lettering, logos, road numbers or any other signage is drawn anywhere —
 * only the shape and the red/dark-green livery idea were taken from the
 * reference photo, not its railroad's branding.
 *
 * CAB SHAPE, second pass: an earlier version made the cab's entire front a
 * single diagonal from the roof down to the hood line, which — combined
 * with a very flat overall aspect ratio — collapsed the cab into a pointed
 * wedge/fin instead of a box. Fixed two ways (see `buildBodyPath`):
 *  - the cab's front is now MOSTLY a vertical wall; only the UPPER half of
 *    that wall (the windshield itself) is raked, and only by a modest
 *    amount, so the silhouette reads as a box with a raked window, not a
 *    triangle;
 *  - the short hood is now a real, separately-visible segment (~17% of the
 *    total length) ahead of that wall, ending in its own blunt vertical
 *    nose face, instead of the cab sitting flush at the very end of the body.
 * `LOCO_ASPECT` in shuntingLayout.ts was also brought back from an
 * over-flattened 2.1 to 1.75 so the cab has the vertical room to exist and
 * the loco reads taller than a wagon overall, not shorter.
 *
 *  - Coordinates are LOCAL (body top-left at 0,0) and everything is a
 *    fraction of `w`/`h`, because the board billboards this sprite: it
 *    translates it to a projected anchor and scales it by the camera's depth
 *    factor. Mirroring for the right-hand peine is still a `scaleX: -1`
 *    Group transform, not a manual coordinate flip — `facingRight=true` puts
 *    the short-hood/nose end at x=w (matching the old convention), so the
 *    long-hood end is always the one further from the direction of travel,
 *    on both sides of the yard once mirrored. Every shape below is built
 *    from the SAME `w`/`h` fractions the silhouette uses, so the mirror is
 *    correct by construction — there is no separate "right-side" branch to
 *    keep in sync.
 *  - The wheels are proper bogies (a dark truck bar with two wheels inset)
 *    that rest ON the rail line at y = h, matching the wagons — see
 *    IsoWagon.tsx's Bogies (now re-exported from wagonShell.tsx).
 *
 * Livery comes from the active time-of-day palette so the loco sits in the
 * same light as everything else: `palette.loco.hi/lo` is the dominant red
 * body gradient, `palette.loco.hoodHi/hoodLo` is the second (dark green)
 * colour painted over the rear of the long hood behind a diagonal division,
 * and `palette.loco.sill` is the light frame stripe. The idle/parked slots
 * are a translucent "ghost" — ONLY a faint tinted silhouette fill + dashed
 * outline, no body fill/bogies/detail — so they read as "a locomotive could
 * go here" rather than as parked objects; see `GhostLocoImpl` below and
 * design/tokens.ts's `locoGhost`. Both silhouettes are built by the same
 * handful of pure `(w, h)` path functions so the ghost always re-traces
 * whatever shape the active loco has.
 */

import React, { useMemo } from 'react';
import {
  BlurMask,
  Circle,
  DashPathEffect,
  Group,
  Line,
  LinearGradient,
  Oval,
  Path,
  RadialGradient,
  Rect,
  RoundedRect,
  vec,
} from '@shopify/react-native-skia';

import { colors, withAlpha, type TimeOfDayPalette } from '../../../design/tokens';
import { Bogies } from './wagonShell';

export interface LocoButtonProps {
  /** Sprite box in LOCAL units; the body's top-left is (0,0), the rail is y = h. */
  w: number;
  h: number;
  isActive: boolean;
  /** true = nose points right (left-side peine); false = mirrored (right-side peine). */
  facingRight: boolean;
  palette: TimeOfDayPalette;
  /**
   * Idle slots only: a cut is selected and this track is a legal drop
   * target for it, so the ghost may read a touch more present (still a
   * ghost — see design/tokens.ts `locoGhost`). Ignored when `isActive`.
   */
  isValidTarget?: boolean;
}

// ── Silhouette geometry, as fractions of (w, h) ─────────────────────────────
//
// facingRight=true convention: x=0 is the FAR end of the long hood (rear),
// x=w is the blunt nose (front, short-hood end) — mirrored as a whole via
// `scaleX: -1` for the right-hand throat, so these fractions never change.

/** Where the body/hoods/cab silhouette ends and the frame band begins. */
const BODY_BOTTOM = 0.8;
/** Flat roof line shared by BOTH hoods — "about the same height" per the reference. */
const HOOD_ROOF_Y = 0.36;
/**
 * Cab roof — the tallest point on the loco, clearly above the hood line.
 *
 * Trim pass (user: cab "a bit narrow, and maybe a bit tall... reduce it a
 * little, but only a little"): raised from 0.08 to 0.11 — a SHORTER cab box
 * within the same sprite, so the protrusion above the hood line reads a
 * touch less tall without shrinking the whole locomotive (that lever is
 * `LOCO_ASPECT` in shuntingLayout.ts, deliberately untouched here — see its
 * doc comment for the measured cab-roof-vs-wagon-roof ratio, re-measured
 * against this new value rather than just derived).
 */
const CAB_ROOF_Y = 0.11;
/**
 * x where the long hood ends and the cab's rear (vertical) wall begins.
 *
 * Trim pass: nudged from 0.58 to 0.56 to make the cab box itself slightly
 * WIDER (the user's "a bit narrow"), by encroaching a little into the long
 * hood's span rather than the short hood's — `CAB_FRONT_X`/`CAB_WALL_X`
 * (short-hood boundary) are untouched, per the brief.
 */
const LONG_HOOD_END = 0.56;
/** x of the cab's roof-front corner — the roof stays FLAT from LONG_HOOD_END to here. */
const CAB_FRONT_X = 0.8;
/** x of the cab's front wall below the windshield, and where the short hood's roof starts. */
const CAB_WALL_X = 0.83;
/** y where the modest windshield rake ends and the cab's front wall turns vertical. */
const WINDSHIELD_KNEE_Y = CAB_ROOF_Y + 0.5 * (HOOD_ROOF_Y - CAB_ROOF_Y);

/**
 * Body silhouette — 9 points, one closed path:
 *  rear vertical wall → long (low) hood roof → vertical step up to the cab
 *  → cab roof, FLAT for most of the cab's width (the box) → a short, modest
 *  diagonal (just the windshield rake, roughly the top half of the cab's
 *  height) → the cab's front wall turns vertical again down to the hood
 *  line → short hood roof (same height as the long hood) → blunt vertical
 *  nose face. No tapered point anywhere — the reference's short hood ends
 *  in a blunt face, and the cab is a box with only its window raked, not a
 *  wedge.
 */
function buildBodyPath(w: number, h: number): string {
  const bb = h * BODY_BOTTOM;
  return [
    `M 0,${bb}`,
    `L 0,${HOOD_ROOF_Y * h}`,
    `L ${LONG_HOOD_END * w},${HOOD_ROOF_Y * h}`,
    `L ${LONG_HOOD_END * w},${CAB_ROOF_Y * h}`,
    `L ${CAB_FRONT_X * w},${CAB_ROOF_Y * h}`,
    `L ${CAB_WALL_X * w},${WINDSHIELD_KNEE_Y * h}`,
    `L ${CAB_WALL_X * w},${HOOD_ROOF_Y * h}`,
    `L ${w},${HOOD_ROOF_Y * h}`,
    `L ${w},${bb}`,
    'Z',
  ].join(' ');
}

/**
 * Ghost/idle silhouette: the same profile as `buildBodyPath`, but flush to
 * the full sprite height instead of stopping at `BODY_BOTTOM` — there is no
 * separate frame/deck/bogie rect drawn under a ghost, so the outline itself
 * carries down to where the wheels would be.
 */
function buildGhostBodyPath(w: number, h: number): string {
  return [
    `M 0,${h}`,
    `L 0,${HOOD_ROOF_Y * h}`,
    `L ${LONG_HOOD_END * w},${HOOD_ROOF_Y * h}`,
    `L ${LONG_HOOD_END * w},${CAB_ROOF_Y * h}`,
    `L ${CAB_FRONT_X * w},${CAB_ROOF_Y * h}`,
    `L ${CAB_WALL_X * w},${WINDSHIELD_KNEE_Y * h}`,
    `L ${CAB_WALL_X * w},${HOOD_ROOF_Y * h}`,
    `L ${w},${HOOD_ROOF_Y * h}`,
    `L ${w},${h}`,
    'Z',
  ].join(' ');
}

/**
 * Second livery colour, painted over the rear end of the long hood on top of
 * the base red fill, cut by a diagonal (not vertical) division — stays
 * entirely inside the long-hood span (0 → LONG_HOOD_END) so it never reaches
 * the cab or short hood.
 */
function buildHoodPatchPath(w: number, h: number): string {
  const bb = h * BODY_BOTTOM;
  const topX = 0.3 * w;
  const bottomX = 0.19 * w;
  return `M 0,${bb} L 0,${HOOD_ROOF_Y * h} L ${topX},${HOOD_ROOF_Y * h} L ${bottomX},${bb} Z`;
}

/**
 * Windshield: a quad sitting mostly on the cab's flat roof front corner and
 * its vertical front wall, inset so it's fully interior to the body — only
 * its own edges are raked, the body silhouette around it stays boxy. Bigger
 * than the previous pass (both the taller `LOCO_ASPECT` and a wider inset
 * margin) so it reads as a real windshield without the `detailed` gate.
 */
function buildWindshieldPath(w: number, h: number): string {
  // Top corners are anchored a small fixed offset BELOW `CAB_ROOF_Y` (not an
  // independent absolute fraction) so the windshield keeps tracking the cab
  // roof line if that constant ever moves again — see the trim-pass comment
  // on `CAB_ROOF_Y`. Offsets (0.02, 0.008) reproduce the original pre-trim
  // corners exactly (0.08+0.02=0.1, 0.08+0.008=0.088).
  return [
    `M ${0.66 * w},${(CAB_ROOF_Y + 0.02) * h}`,
    `L ${0.79 * w},${(CAB_ROOF_Y + 0.008) * h}`,
    `L ${0.822 * w},${0.35 * h}`,
    `L ${0.7 * w},${0.35 * h}`,
    'Z',
  ].join(' ');
}

/**
 * NOTE on hooks: this component early-returns the ghost render for the idle
 * case, so nothing below this point may be a hook call — `LocoButtonImpl`
 * itself must call the exact same (zero) hooks on every render, since a
 * single row's LocoButton flips between active/idle across renders as the
 * player moves the active locomotive (same Fiber, different `isActive`).
 * The path strings below are cheap string concatenation recomputed per
 * render rather than `useMemo`'d for exactly this reason; `GhostLocoImpl`
 * is a separate component and is free to memoize its own geometry.
 */
function LocoButtonImpl({ w, h, isActive, facingRight, palette, isValidTarget }: LocoButtonProps) {
  if (!isActive) {
    return <GhostLoco w={w} h={h} facingRight={facingRight} palette={palette} isValidTarget={!!isValidTarget} />;
  }

  // Small-size gate, same convention/threshold as the wagons (IsoWagon.tsx):
  // below this, drop only the SCATTERED small details (fans, louvres,
  // stanchions, steps, fuel tank, roof headlight housing) that would alias
  // into noise — the silhouette, livery, windows and main headlight/beam
  // stay on at every size (the windows in particular must NOT need this
  // gate — see buildWindshieldPath's comment).
  const detailed = w >= 46;

  const { hi, lo, hoodHi, hoodLo, sill, windowHi, windowLo } = palette.loco;
  const roofColor = colors.loco.roofActive;
  const bb = h * BODY_BOTTOM;

  const bodyPath = buildBodyPath(w, h);
  const hoodPatchPath = buildHoodPatchPath(w, h);
  const windshieldPath = buildWindshieldPath(w, h);

  // ── Frame band: sill stripe → deck/underframe → (Bogies draw the trucks). ──
  const sillH = Math.max(1.2, 0.05 * h);
  const deckTop = bb + sillH;
  const bogieBarY = h * 0.923; // matches Bogies' own barY (h * (1 - 0.077))
  const deckBottom = Math.max(deckTop + 1, bogieBarY - Math.max(1, 0.008 * h));
  const deckMidY = (deckTop + deckBottom) / 2;

  // ── Windshield corners (used for both the glass fill and the reflection
  //     streak below — single source of truth, matches buildWindshieldPath). ──
  const wsA = { x: 0.66 * w, y: (CAB_ROOF_Y + 0.02) * h };
  const wsB = { x: 0.79 * w, y: (CAB_ROOF_Y + 0.008) * h };
  const wsC = { x: 0.822 * w, y: 0.35 * h };
  const wsD = { x: 0.7 * w, y: 0.35 * h };
  const streakStart = { x: wsA.x + (wsD.x - wsA.x) * 0.25, y: wsA.y + (wsD.y - wsA.y) * 0.25 };
  const streakEnd = { x: wsB.x + (wsC.x - wsB.x) * 0.25, y: wsB.y + (wsC.y - wsB.y) * 0.25 };

  // ── Cab side window: a TRUE square (both dimensions derived from `h`) set
  //     into the cab's rear wall, behind the windshield. Sized defensively —
  //     clamped against the actual gap to `wsA.x` — so it can never overlap
  //     the windshield even if a future `LOCO_ASPECT`/width-factor change
  //     shifts the loco's proportions; this is what "correct by
  //     construction" means for an asymmetric shape that also gets mirrored. ──
  const sideWinX = 0.585 * w;
  const sideWinSize = Math.max(4, Math.min(0.13 * h, (wsA.x - sideWinX) * 0.95));
  // Same fixed-offset-below-CAB_ROOF_Y anchoring as the windshield corners
  // above (0.08+0.03=0.11 reproduces the original pre-trim position exactly).
  const sideWinY = (CAB_ROOF_Y + 0.03) * h;

  const noseCx = w * 0.985;
  const noseCy = ((HOOD_ROOF_Y + BODY_BOTTOM) / 2) * h;

  return (
    <Group transform={facingRight ? undefined : [{ scaleX: -1 }]} origin={facingRight ? undefined : vec(w / 2, h / 2)}>
      {/* Contact shadow — active loco only; see GhostLoco for why idle slots
          skip both the shadow and the BlurMask below. */}
      <Oval x={w * 0.04} y={h * 0.95} width={w * 0.92} height={h * 0.13} color="rgba(0,0,0,0.45)">
        <BlurMask blur={2.5} style="normal" />
      </Oval>

      <Bogies w={w} h={h} />

      {/* Active body glow, matched to the silhouette rather than a bounding rect. */}
      <Path path={bodyPath} color={hi} opacity={0.5}>
        <BlurMask blur={h * 0.09} style="normal" />
      </Path>

      {/* Base (red) livery. */}
      <Path path={bodyPath}>
        <LinearGradient start={vec(0, 0)} end={vec(0, h)} colors={[hi, lo]} />
      </Path>

      {/* Second livery colour over the rear of the long hood, on a diagonal
          division — painted on top of the red fill, entirely inside the
          long-hood span. */}
      <Path path={hoodPatchPath}>
        <LinearGradient start={vec(0, HOOD_ROOF_Y * h)} end={vec(0, bb)} colors={[hoodHi, hoodLo]} />
      </Path>

      {/* Roof caps — uniformly dark across both hoods AND the flat part of
          the cab roof (real liveries usually keep the roof/walkway a flat
          dark colour regardless of the body livery below it). Stops at
          CAB_FRONT_X: the windshield-rake/front-wall strip is glass +
          body colour, not roof. */}
      <Rect x={0} y={HOOD_ROOF_Y * h} width={LONG_HOOD_END * w} height={Math.max(1.5, 0.035 * h)} color={roofColor} />
      <Rect
        x={CAB_WALL_X * w}
        y={HOOD_ROOF_Y * h}
        width={(1 - CAB_WALL_X) * w}
        height={Math.max(1.5, 0.035 * h)}
        color={roofColor}
      />
      <Rect
        x={LONG_HOOD_END * w}
        y={CAB_ROOF_Y * h}
        width={(CAB_FRONT_X - LONG_HOOD_END) * w}
        height={Math.max(1.5, 0.035 * h)}
        color={roofColor}
      />

      {/* Long-hood grille/radiator block near the far (rear) end. */}
      <Rect x={0.04 * w} y={0.44 * h} width={0.14 * w} height={0.28 * h} color="rgba(0,0,0,0.28)" />
      {detailed &&
        [0.5, 0.57, 0.64].map((f, i) => (
          <Line key={i} p1={vec(0.05 * w, f * h)} p2={vec(0.17 * w, f * h)} color="rgba(0,0,0,0.35)" strokeWidth={1} />
        ))}

      {/* Exhaust stack, poking up through the hood roof cap. */}
      <Rect
        x={0.42 * w}
        width={Math.max(1.5, 0.022 * w)}
        y={(HOOD_ROOF_Y - 0.05) * h}
        height={0.08 * h}
        color="rgba(20,20,20,0.85)"
      />

      {/* Cooling fans on the long-hood roof. */}
      {detailed &&
        [0.24, 0.34].map((f, i) => (
          <Group key={i}>
            <Circle cx={f * w} cy={HOOD_ROOF_Y * h} r={Math.max(1.5, 0.045 * h)} color="rgba(30,30,30,0.6)" />
            <Circle
              cx={f * w}
              cy={HOOD_ROOF_Y * h}
              r={Math.max(1.5, 0.045 * h)}
              style="stroke"
              strokeWidth={1}
              color="rgba(255,255,255,0.15)"
            />
          </Group>
        ))}

      {/* Cab windshield — dark tinted glass + a thin light reflection streak,
          always on (no `detailed` gate: this is a primary identifying
          feature at every size, per the brief). */}
      <Path path={windshieldPath} color={windowLo} />
      <Line
        p1={vec(streakStart.x, streakStart.y)}
        p2={vec(streakEnd.x, streakEnd.y)}
        color={windowHi}
        strokeWidth={Math.max(1.5, 0.035 * h)}
        strokeCap="round"
        opacity={0.85}
      />
      <Path path={windshieldPath} style="stroke" strokeWidth={1} color="rgba(0,0,0,0.5)" />

      {/* Cab side window — a true square, same tinted-glass + streak
          treatment, also always on. */}
      <Rect x={sideWinX} y={sideWinY} width={sideWinSize} height={sideWinSize} color={windowLo} />
      <Line
        p1={vec(sideWinX + sideWinSize * 0.15, sideWinY + sideWinSize * 0.15)}
        p2={vec(sideWinX + sideWinSize * 0.55, sideWinY + sideWinSize * 0.85)}
        color={windowHi}
        strokeWidth={Math.max(1, 0.02 * h)}
        strokeCap="round"
        opacity={0.85}
      />
      <Rect x={sideWinX} y={sideWinY} width={sideWinSize} height={sideWinSize} style="stroke" strokeWidth={1} color="rgba(0,0,0,0.5)" />

      {/* Small headlight housing on the cab roof front, per the reference. */}
      {detailed && (
        <Group>
          <RoundedRect x={0.75 * w} y={(CAB_ROOF_Y - 0.045) * h} width={0.045 * w} height={0.05 * h} r={1} color="rgba(20,20,20,0.85)" />
          <Circle cx={0.7725 * w} cy={CAB_ROOF_Y * h - 0.015 * h} r={Math.max(1, 0.02 * h)} color={palette.loco.headlight} />
        </Group>
      )}

      {/* Frame band: light sill stripe, full length, then the dark deck. */}
      <Rect x={0} y={bb} width={w} height={sillH} color={sill} />
      <Rect x={0} y={deckTop} width={w} height={Math.max(0, deckBottom - deckTop)} color={colors.loco.chassis} />

      {/* Handrail at deck height + stanchions. */}
      <Line p1={vec(0.06 * w, deckMidY)} p2={vec(0.94 * w, deckMidY)} color={colors.loco.handrail} strokeWidth={1} />
      {detailed &&
        [0.12, 0.3, 0.48, 0.66, 0.84].map((f, i) => (
          <Line key={i} p1={vec(f * w, deckMidY)} p2={vec(f * w, deckBottom)} color={colors.loco.handrail} strokeWidth={1} />
        ))}

      {/* Angled step wells at both corners. */}
      {detailed && (
        <Group>
          <Line p1={vec(0.02 * w, bb)} p2={vec(0.06 * w, deckBottom)} color="rgba(0,0,0,0.35)" strokeWidth={1} />
          <Line p1={vec(0.98 * w, bb)} p2={vec(0.94 * w, deckBottom)} color="rgba(0,0,0,0.35)" strokeWidth={1} />
        </Group>
      )}

      {/* Underslung fuel tank, between the two truck positions. */}
      {detailed && (
        <RoundedRect
          x={0.38 * w}
          y={deckTop + (deckBottom - deckTop) * 0.15}
          width={0.24 * w}
          height={(deckBottom - deckTop) * 0.7}
          r={(deckBottom - deckTop) * 0.35}
          color="rgba(0,0,0,0.38)"
        />
      )}

      {/* Coupler knuckle stub at the nose. */}
      {detailed && (
        <Rect x={w * 0.965} y={deckTop} width={w * 0.03} height={Math.max(1, deckBottom - deckTop)} color={colors.loco.buffer} />
      )}

      {/* Body edge highlight (cartoon ink line, warm-tinted to match the red livery). */}
      <Path path={bodyPath} style="stroke" strokeWidth={1.2} color="rgba(255,140,140,0.45)" />

      {/* Headlight: glow + bright core, mounted on the nose's blunt face. No
          forward-projecting beam/halo — approved removal, see DECISIONES.md
          §2 ("Faro sí, haz de luz no"). `palette.loco.beam` is left in the
          token set unused rather than deleted (see design/tokens.ts). */}
      <Group>
        <Circle cx={noseCx} cy={noseCy} r={h * 0.115} color={colors.loco.headlightGlow}>
          <BlurMask blur={h * 0.055} style="normal" />
        </Circle>
        <Circle cx={noseCx} cy={noseCy} r={h * 0.05}>
          <RadialGradient c={vec(noseCx, noseCy)} r={h * 0.05} colors={[palette.loco.headlight, '#a06a10']} />
        </Circle>
      </Group>
    </Group>
  );
}

/**
 * Idle/parked loco slot, redesigned as a ghost: "a locomotive could go
 * here", not a parked object. No body fill, livery, bogies, contact shadow,
 * or window glazing — just a faint tinted silhouette fill plus a thin
 * dashed outline, so the ballast and rails underneath stay clearly visible.
 * Tinted from `palette.track.rail` (see design/tokens.ts `locoGhost`)
 * rather than a fixed grey so it stays legible across all four time-of-day
 * passes without reading as "a grey locomotive". Re-traces the SAME
 * silhouette functions as the active loco, so the ghost always matches
 * whatever shape `buildBodyPath` currently draws.
 */
function GhostLocoImpl({
  w,
  h,
  facingRight,
  palette,
  isValidTarget,
}: {
  w: number;
  h: number;
  facingRight: boolean;
  palette: TimeOfDayPalette;
  isValidTarget: boolean;
}) {
  const bodyPath = useMemo(() => buildGhostBodyPath(w, h), [w, h]);
  const windshieldPath = useMemo(() => buildWindshieldPath(w, h), [w, h]);
  const dashIntervals = useMemo(() => [Math.max(4, h * 0.1), Math.max(3, h * 0.07)], [h]);

  const tint = palette.track.rail;
  const fillAlpha = isValidTarget ? colors.locoGhost.fillAlphaTarget : colors.locoGhost.fillAlpha;
  const strokeAlpha = isValidTarget ? colors.locoGhost.strokeAlphaTarget : colors.locoGhost.strokeAlpha;
  const strokeWidth = Math.max(1, h * 0.022);

  return (
    <Group transform={facingRight ? undefined : [{ scaleX: -1 }]} origin={facingRight ? undefined : vec(w / 2, h / 2)}>
      {/* Faint tinted fill — reads as a possible place, not a solid object. */}
      <Path path={bodyPath} color={withAlpha(tint, fillAlpha)} />

      {/* Thin dashed outline tracing the loco's own profile. */}
      <Path path={bodyPath} style="stroke" strokeWidth={strokeWidth} color={withAlpha(tint, strokeAlpha)}>
        <DashPathEffect intervals={dashIntervals} />
      </Path>

      {/* Barely-there windshield hint — just enough to keep it legible as a
          locomotive silhouette rather than an arbitrary blob. */}
      <Path
        path={windshieldPath}
        style="stroke"
        strokeWidth={Math.max(1, h * 0.015)}
        color={withAlpha(tint, colors.locoGhost.windowAlpha)}
      />

      {/* Faint "tap to select" cue, nested inside the tall cab silhouette. */}
      <Path
        path={`M ${0.62 * w},${0.18 * h} L ${0.72 * w},${0.35 * h} L ${0.62 * w},${0.52 * h}`}
        style="stroke"
        strokeWidth={Math.max(1.2, h * 0.026)}
        strokeCap="round"
        strokeJoin="round"
        color={withAlpha(tint, colors.locoGhost.chevronAlpha)}
      />
    </Group>
  );
}

const GhostLoco = React.memo(GhostLocoImpl);

export const LocoButton = React.memo(LocoButtonImpl);
