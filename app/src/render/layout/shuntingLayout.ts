/**
 * Yard layout + hit-testing for ShuntingBoard, in the isometric camera's two
 * coordinate spaces.
 *
 * Everything the yard is MADE of — rows, car columns, the peine throat, the
 * loco columns — is still laid out exactly as before, by the same algorithm
 * ported from ref/js/shunting/renderer.js and design/design-system.md §2.2.
 * What changed is where those numbers live: they are now PLANE coordinates
 * (u across the yard, v receding away from the viewer), and a camera
 * (src/render/iso/isoCamera.ts) projects them to screen dp.
 *
 * Two consequences worth knowing before touching this file:
 *
 *  1. The plane is sized FROM the viewport (planeSizeForViewport), not the
 *     other way round, so the projected yard fills the canvas at camera scale
 *     1 — i.e. one plane unit is one dp at the yard's mid-depth, and all the
 *     dp-denominated tokens (carWidthMin, locoColumnWidth, …) keep meaning
 *     what they always meant.
 *
 *  2. Rolling stock is billboarded (drawn upright at a projected anchor), so
 *     a car's ON-SCREEN box is NOT the projection of its plane box — it
 *     stands UP from the rail rather than lying on it. Hit-testing therefore
 *     runs against screen-space sprite boxes, nearest row first (near cars
 *     occlude far ones, so they must also win the tap), and only falls back
 *     to unprojecting into plane space for empty slots and row taps. The
 *     RESULT of a hit is identical to the flat board's: same ShuntingHit
 *     shape, same loco > wagon > row priority, same clamped column index.
 *
 * Pure geometry — no React/Skia/Reanimated imports — so it stays trivially
 * unit-testable and shared between the drawing primitives and the gesture
 * handler in ShuntingBoard.tsx.
 */

import { layout as L, spacing, isoCameraTokens } from '../../../design/tokens';
import { createIsoCamera, planeEdgeU, planeSizeForViewport, type IsoCamera } from '../iso/isoCamera';
import {
  BUFFER_STOP_BADGE_GAP,
  BUFFER_STOP_DEPTH,
  BUFFER_STOP_GAP,
  clamp,
  fitCarDims,
  inRectPad,
  type Rect,
} from './common';

export interface ShuntingLayoutParams {
  trackCount: number;
  capacity: number;
  hasRightLoco: boolean;
  /** Available canvas width in dp (already excludes outer screen padding). */
  width: number;
  /** Available canvas height in dp (already excludes outer padding / HUD chrome). */
  height: number;
}

export type ShuntingHit =
  | { type: 'loco'; side: 'left' | 'right'; trackIdx: number }
  | { type: 'wagon'; trackIdx: number; carIdx: number }
  | { type: 'row'; trackIdx: number };

export interface PeineSide {
  /** Plane u of the convergence node. */
  convX: number;
  /** Plane v of the convergence node (average of first/last row centres). */
  convY: number;
  /** Plane u where the fanned branches terminate and straight stub tracks begin. */
  fanEndX: number;
}

/** A billboarded sprite: where its feet are on the plane, and how big it draws. */
export interface Billboard {
  /** Plane coordinates of the sprite's bottom-centre (it stands on the rail). */
  u: number;
  v: number;
  /** Sprite size in local units; multiply by camera.depthScaleAt(v) for dp. */
  width: number;
  height: number;
}

export interface ShuntingLayout {
  trackCount: number;
  capacity: number;
  hasRightLoco: boolean;

  camera: IsoCamera;

  // ── Plane-space geometry ────────────────────────────────────────────────
  carWidth: number;
  carGap: number;
  /** Plane u of the first car column's left edge. */
  trackSX: number;
  trackWidth: number;
  /** Plane-v distance between consecutive rows. */
  rowPitch: number;
  /** Ballast-band height of one row, in plane units (drawn ON the plane). */
  rowHeight: number;

  /** Sprite sizes in local (plane-at-mid-depth) units. */
  carBodyWidth: number;
  carBodyHeight: number;
  locoBodyWidth: number;
  locoBodyHeight: number;
  /** Ballast stroke width for the track bed, in plane units. */
  ballastWidth: number;
  /**
   * Plane v the foreground apron (scenery Zone B) starts at — the nearest
   * row's own ballast band bottom edge, i.e. `rowV(trackCount - 1) +
   * rowHeight / 2`. See design/scenery-spec.md §1.3 R2/R5 and §5.
   */
  foregroundOriginY: number;
  /**
   * How much plane depth is left between the row block and the plane's own
   * far edge, on EACH side (they're always equal by construction — see
   * `computeShuntingLayout`'s `topOffset`/`slack` derivation). Scenery Zone B
   * gates each foreground prop's render on this (`minMarginPlane`,
   * design/scenery-spec.md §1.3 R3 / §2.3) rather than ever shrinking a
   * prop to fit.
   */
  foregroundMarginPlane: number;
  /** Plane-space width reserved to the right of the cars (loco column or badge). */
  badgeColumnWidth: number;
  /** Font size for in-canvas badges, in local units. */
  badgeSize: number;
  /** Font size for a wagon's label, in local units. */
  labelSize: number;

  /** Canvas size. Equals the viewport unless the track count forces scrolling. */
  contentWidth: number;
  contentHeight: number;

  /** Plane v of track i's rail centreline. */
  rowV: (trackIdx: number) => number;
  /** Plane u of car column j's left edge. */
  carX: (carIdx: number) => number;
  /**
   * Plane-space anchor rect for a car: `x`/`y` are its bottom-LEFT on the
   * rail (y is the centreline, not a top edge), `width`/`height` its sprite
   * size. The travel animation paths are built from these, which is why they
   * are plane coordinates and not dp.
   */
  carRect: (trackIdx: number, carIdx: number) => Rect;
  locoRect: (trackIdx: number, side: 'left' | 'right') => Rect;
  carBillboard: (trackIdx: number, carIdx: number) => Billboard;
  locoBillboard: (trackIdx: number, side: 'left' | 'right') => Billboard;
  /** Plane point the "n/capacity" badge is anchored at. */
  badgeAnchor: (trackIdx: number) => { u: number; v: number };
  /** Plane rect of the clearance wedge that lies flat along a valid target row. */
  markerRect: (trackIdx: number, side: 'left' | 'right') => Rect;

  peineLeft: PeineSide;
  /** Present only when hasRightLoco. */
  peineRight: PeineSide | null;

  /**
   * Plane u the track bed's left/right runs (throat trunks, and the right
   * stub when there is no right throat to hand off to) should extend to so
   * they read as continuing past the canvas edge instead of floating inside
   * the frame — see `planeEdgeU` in iso/isoCamera.ts. Purely a drawing
   * extent: hit-testing never reads these.
   */
  edgeLeftX: number;
  edgeRightX: number;

  /**
   * Plane u the right-hand track bed TERMINATES at — a buffer stop, not a
   * bleed off the frame — when there is no right locomotive throat for the
   * cars to run through. `null` when `hasRightLoco` (that side always keeps
   * running off-frame per the approved rule; see the module doc comment).
   * Derived from `trackSX + trackWidth` (exactly where the car columns end,
   * the same extent the "n/capacity" badge is keyed off), not from
   * `edgeRightX`'s camera-projection bleed math, which answers a different
   * question (how far a CONTINUING run must reach to clear the frame).
   */
  deadEndRightX: number | null;

  /** Hit-test a tap in SCREEN dp. */
  hitTest: (x: number, y: number) => ShuntingHit | null;
}

/** Breathing room between the fan-out node and the locomotive column. */
const LOCO_GAP = 8;

/**
 * How much wider the locomotive column is than a car column, as a multiple
 * of the fitted car width. The user explicitly does not want the loco eating
 * yard space, so this is capped low (~1.3) even though the road-switcher
 * redraw (LocoButton.tsx) is a visually longer silhouette than the old
 * centre-cab switcher — the extra length reads through a taller LOCO_ASPECT
 * (below), not through a much wider column.
 */
const LOCO_WIDTH_FACTOR = 1.3;

/** Floor on how short the fanned bezier branch (convX → fanEndX) may get. */
const MIN_BRANCH_SPAN = 28;

/**
 * Ceiling on the branch span. The design reference's throat sweeps ~18% of
 * the plane width; past that the fan stops reading as a throat and starts
 * eating the yard.
 */
const MAX_BRANCH_SPAN = 130;

/**
 * Floor on the FORESHORTENED (on-screen) distance between two adjacent rows.
 * Below this the diorama stops reading as separate tracks and the cars
 * standing on them merge into one mass. When a level can't respect it, the
 * plane grows taller than the viewport and the board scrolls vertically —
 * the same fallback design-system.md §2.2 step 5 has always specified,
 * just expressed in projected dp instead of flat ones.
 */
const MIN_SCREEN_ROW_PITCH = 27;

/** Ceiling, so a 3-track level spreads gracefully instead of hugging the near edge. */
const MAX_SCREEN_ROW_PITCH = 72;

/**
 * How far past each screen edge the track bed's trunk/stub runs should
 * project, as a fraction of the viewport width — a comfortable bleed rather
 * than landing exactly on the edge (rounding, the round stroke cap, etc).
 * Combined with `planeEdgeU`'s far-edge (v = 0) worst case, this is generous
 * enough that every actual row's run clears the frame with room to spare.
 */
const EDGE_BLEED_FRACTION = 0.08;

export function computeShuntingLayout(params: ShuntingLayoutParams): ShuntingLayout {
  const { trackCount, capacity, hasRightLoco, width, height } = params;

  const cosTilt = Math.cos(isoCameraTokens.tiltDeg * (Math.PI / 180));
  const topPad = spacing.md;

  // ── 1. Size the plane, growing the canvas if the rows won't fit ──────────
  //
  // planeSizeForViewport answers "how big a plane fills this canvas at scale
  // 1?". If that plane can't hold `trackCount` rows at MIN_SCREEN_ROW_PITCH,
  // we ask for a taller canvas and re-derive; ShuntingBoard then wraps the
  // (now oversized) Canvas in its existing vertical ScrollView.
  const minPlanePitch = MIN_SCREEN_ROW_PITCH / cosTilt;
  const maxPlanePitch = MAX_SCREEN_ROW_PITCH / cosTilt;

  const firstPass = planeSizeForViewport({ viewportWidth: width, viewportHeight: height });
  const rowHeight = Math.max(18, Math.min(34, minPlanePitch * 0.5));
  const neededPlaneHeight = topPad * 2 + Math.max(0, trackCount - 1) * minPlanePitch + rowHeight;

  let contentHeight = height;
  let planeWidth = firstPass.planeWidth;
  let planeHeight = firstPass.planeHeight;
  if (neededPlaneHeight > planeHeight && planeHeight > 0) {
    contentHeight = height * (neededPlaneHeight / planeHeight);
    const grown = planeSizeForViewport({ viewportWidth: width, viewportHeight: contentHeight });
    planeWidth = grown.planeWidth;
    planeHeight = grown.planeHeight;
  }

  const camera = createIsoCamera({
    planeWidth,
    planeHeight,
    viewportWidth: width,
    viewportHeight: contentHeight,
  });

  // ── 2. Rows, in plane space ─────────────────────────────────────────────
  const usable = Math.max(0, planeHeight - topPad * 2 - rowHeight);
  const rowPitch =
    trackCount > 1 ? clamp(usable / (trackCount - 1), minPlanePitch, maxPlanePitch) : minPlanePitch;
  const blockHeight = trackCount > 0 ? (trackCount - 1) * rowPitch + rowHeight : rowHeight;
  // Bias the block slightly toward the far edge so the nearest row keeps the
  // apron of ballast in front of it that sells the depth.
  const topOffset = topPad + Math.max(0, planeHeight - topPad * 2 - blockHeight) * 0.5;
  const rowV = (i: number) => topOffset + rowHeight / 2 + i * rowPitch;
  // Both margins (far edge → first row, last row → near edge) are equal by
  // construction — see the module doc comment's §1.2 worked table — so this
  // single formula answers "how much room is left in the foreground apron"
  // exactly like `topOffset` answers it for the far one.
  const foregroundOriginY = trackCount > 0 ? rowV(trackCount - 1) + rowHeight / 2 : rowV(0);
  const foregroundMarginPlane = Math.max(0, planeHeight - (topOffset + blockHeight));

  // ── 3. Columns, in plane space ──────────────────────────────────────────
  //
  // The throat gets whatever horizontal room is left once the car columns
  // have been guaranteed their minimum. That ordering matters: the flat
  // board derived the fan-out point BACKWARDS from the first car column,
  // which on a narrow plane collapsed the branches to a near-vertical sliver
  // and threw away the one piece of geometry that explains the whole game.
  // Cars still win when the level is genuinely dense — the span just floors
  // at MIN_BRANCH_SPAN and the fan reads tight instead of absent.
  const sideMargin = L.sideMargin;
  const convX = Math.max(14, planeWidth * 0.035);
  const minCarsWidth = capacity > 0 ? capacity * L.carWidthMin + (capacity - 1) * L.carGap : 0;
  const throatCount = hasRightLoco ? 2 : 1;

  /**
   * Column widths given a locomotive column width — run twice, because the
   * loco has to out-mass the wagons it pulls (the reference's loco is 21%
   * wider than its cars) but the car width itself falls out of whatever the
   * loco columns leave behind. Pass 1 uses the token default to learn the car
   * width; pass 2 sizes the loco column to that and re-fits. Two passes are
   * enough: fitCarDims clamps into [carWidthMin, carWidthMax], so the second
   * result can only move within that band and never oscillates.
   */
  function solveColumns(locoColW: number) {
    const rightReserved = hasRightLoco ? locoColW + LOCO_GAP : L.capacityColumnWidth;
    const spare =
      planeWidth - minCarsWidth - sideMargin - (locoColW + LOCO_GAP) - rightReserved - convX * throatCount;
    const throatSpan = clamp(spare / throatCount, MIN_BRANCH_SPAN, Math.min(MAX_BRANCH_SPAN, planeWidth * 0.17));
    const trackSX = convX + throatSpan + locoColW + LOCO_GAP;
    const available = Math.max(0, planeWidth - trackSX - rightReserved - sideMargin);
    const { width: carWidth, gap: carGap } = fitCarDims(capacity, available, L.carGap, L.carWidthMin, L.carWidthMax);
    const trackWidth = capacity > 0 ? capacity * carWidth + (capacity - 1) * carGap : 0;
    return { locoColW, rightReserved, throatSpan, trackSX, carWidth, carGap, trackWidth };
  }

  const firstFit = solveColumns(L.locoColumnWidth);
  const { locoColW, rightReserved, throatSpan, trackSX, carWidth, carGap, trackWidth } = solveColumns(
    clamp(firstFit.carWidth * LOCO_WIDTH_FACTOR + LOCO_GAP, L.locoColumnWidth, planeWidth * 0.14)
  );

  const carX = (j: number) => trackSX + j * (carWidth + carGap);

  // ── 4. Sprite sizes ─────────────────────────────────────────────────────
  //
  // Two independent ceilings, whichever bites first:
  //   · the car's own PROPORTIONS — rolling stock is wider than it is tall
  //     (the design reference's car is 76×52), so height follows from the
  //     column width the capacity left us. Without this a sparse level with
  //     wide columns produces tall portrait boxes that read as crates, not
  //     wagons;
  //   · the ROW PITCH — a dense level gets shorter cars rather than a wall of
  //     bodies overlapping the row behind. `· cosTilt` converts the plane-space
  //     pitch into the foreshortened screen pitch the ratio is about.
  // Results are in local units because billboards are drawn pre-depth-scale.
  const CAR_ASPECT = 76 / 52;
  /**
   * Redrawn as a long-hood-+-cab road switcher (LocoButton.tsx) instead of
   * the old stubby centre-cab switcher (92/60 ≈ 1.53).
   *
   * Two prior passes at this constant (2.1, then 1.75) both MEASURED WRONG:
   * they compared `locoBodyHeight` straight to `carBodyHeight`, but that
   * ignores that the drawn cab roof sits some way DOWN from the sprite's own
   * top (LocoButton.tsx's `CAB_ROOF_Y`), not at the very top. The quantity
   * that actually has to beat a wagon's roofline is
   * `locoBodyHeight * (1 - CAB_ROOF_Y)`, not `locoBodyHeight` itself —
   * measured with a throwaway script against `computeShuntingLayout` at the
   * real level-4-landscape config (844×300, 3 tracks × 6 cap), 1.75 produced
   * `locoBodyHeight ≈ 1.086 × carBodyHeight`, i.e. a cab roof height above
   * rail of `1.086 × 0.92 ≈ 0.999 × carBodyHeight` — a dead heat with the
   * wagon roof, matching the screenshot that motivated this fix exactly.
   * 1.5 targets `locoBodyHeight ≈ 1.27 × carBodyHeight` (measured, not just
   * derived — see the worked table in the PR/handoff notes), which puts the
   * cab roof (at `CAB_ROOF_Y`'s ORIGINAL 0.08) about 16.5% above the wagon
   * roofline while the hood roofs (`HOOD_ROOF_Y = 0.36`) stay well below it.
   * A later trim pass raised `CAB_ROOF_Y` to 0.11 (shorter cab box, "reduce
   * the protrusion a little" — see LocoButton.tsx's doc comment on that
   * constant) WITHOUT touching `LOCO_ASPECT` or `locoBodyHeight` itself, so
   * that ratio alone moved from ≈1.165× to ≈1.127× (re-measured the same
   * way) — still clearly the tallest thing in the yard, just a touch less so.
   * Re-run the same measurement before changing `CAB_ROOF_Y`, `LOCO_ASPECT`,
   * or the `* 1.35` ceiling below again.
   *
   * `locoBodyHeight` is a `Math.min(...)` of this aspect-derived candidate
   * and two other ceilings, so LOCO_ASPECT is a FLOOR on flatness: the
   * rendered loco can only end up MORE elongated than 1.5, never less. The
   * `* 1.15` ceiling right below was ALSO raised (to `1.35`) specifically so
   * it stays a generous safety ceiling rather than silently re-capping the
   * height this constant now asks for — verify with the same measurement
   * approach before changing either number again.
   */
  const LOCO_ASPECT = 1.5;
  const screenPitchLocal = rowPitch * cosTilt;
  const carBodyWidth = carWidth;
  const carBodyHeight = Math.min(carWidth / CAR_ASPECT, screenPitchLocal * isoCameraTokens.carHeightPitchRatio);
  const locoBodyWidth = Math.min(locoColW - LOCO_GAP, carBodyWidth * LOCO_WIDTH_FACTOR);
  const locoBodyHeight = Math.min(
    locoBodyWidth / LOCO_ASPECT,
    carBodyHeight * 1.35,
    screenPitchLocal * isoCameraTokens.locoHeightPitchRatio
  );

  // The bed is as wide as the loading gauge it carries — the reference's
  // 42-unit ballast under a 52-unit car — but never so wide that two
  // neighbouring rows' beds merge into one mass.
  const ballastWidth = Math.max(8, Math.min(rowPitch * 0.78, carBodyHeight * 0.81));
  const labelSize = Math.max(7, carBodyHeight * 0.3);
  const badgeSize = Math.max(8, carBodyHeight * 0.3);

  const carRect = (i: number, j: number): Rect => ({
    x: carX(j),
    y: rowV(i),
    width: carWidth,
    height: carBodyHeight,
  });

  const locoRect = (i: number, side: 'left' | 'right'): Rect => ({
    x:
      side === 'left'
        ? trackSX - locoColW + (locoColW - locoBodyWidth) / 2
        : trackSX + trackWidth + LOCO_GAP + (locoColW - locoBodyWidth) / 2,
    y: rowV(i),
    width: locoBodyWidth,
    height: locoBodyHeight,
  });

  const carBillboard = (i: number, j: number): Billboard => ({
    u: carX(j) + carWidth / 2,
    v: rowV(i),
    width: carBodyWidth,
    height: carBodyHeight,
  });

  const locoBillboard = (i: number, side: 'left' | 'right'): Billboard => {
    const r = locoRect(i, side);
    return { u: r.x + r.width / 2, v: r.y, width: locoBodyWidth, height: locoBodyHeight };
  };

  // Only meaningful (i.e. actually drawn) when !hasRightLoco — that is the
  // sole branch that renders the badge at all (ShuntingBoard.tsx's
  // ShuntingRow) — so it is keyed off the dead-end's own footprint rather
  // than a fraction of the reserved column: the badge sits just past the
  // buffer stop, never past it, regardless of how that column is sized.
  const badgeAnchor = (i: number) => ({
    u: trackSX + trackWidth + BUFFER_STOP_GAP + BUFFER_STOP_DEPTH + BUFFER_STOP_BADGE_GAP,
    v: rowV(i),
  });

  /** The lit stretch of track for a legal target — as wide as its own bed. */
  const markerRect = (i: number, _side: 'left' | 'right'): Rect => ({
    x: trackSX - 10,
    y: rowV(i) - ballastWidth / 2,
    width: trackWidth + 20,
    height: ballastWidth,
  });

  // ── 5. Peine throat ─────────────────────────────────────────────────────
  const midRow = trackCount > 0 ? (rowV(0) + rowV(trackCount - 1)) / 2 : rowV(0);

  const peineLeft: PeineSide = {
    convX,
    convY: midRow,
    fanEndX: convX + throatSpan,
  };

  // The right throat wants to start past the right loco column, but on the
  // densest levels (13 cars AND both throats) the plane simply isn't wide
  // enough for all of it. Keeping a valid throat wins: the fan-out node is
  // clamped to at least MIN_BRANCH_SPAN short of the convergence node, and
  // the right loco ends up standing over the first stretch of curve rather
  // than the throat inverting itself.
  const rightConvX = planeWidth - convX;
  const peineRight: PeineSide | null = hasRightLoco
    ? {
        convX: rightConvX,
        convY: midRow,
        fanEndX: Math.min(
          rightConvX - MIN_BRANCH_SPAN,
          Math.max(trackSX + trackWidth + LOCO_GAP, rightConvX - throatSpan)
        ),
      }
    : null;

  // ── 6. Track-bed edge extents ────────────────────────────────────────────
  //
  // See `planeEdgeU`'s doc comment: sizing against the plane's far edge
  // (v = 0) covers every row this layout actually draws (all at v > 0),
  // since perspective compresses the far edge the most.
  const edgeLeftX = planeEdgeU(camera, -width * EDGE_BLEED_FRACTION);
  const edgeRightX = planeEdgeU(camera, width * (1 + EDGE_BLEED_FRACTION));

  // The left throat always exists (there is always a left locomotive), so
  // the only side that can ever dead-end is the right one, and only when
  // there is no right throat for it to hand off to — i.e. exactly when
  // `peineRight` above is null. Sized from the car columns' own extent
  // (`trackSX + trackWidth`, capacity-derived) plus the buffer stop's own
  // fixed footprint — see BUFFER_STOP_* in layout/common.ts — never from
  // `edgeRightX`'s bleed-past-the-frame math.
  const deadEndRightX = hasRightLoco ? null : trackSX + trackWidth + BUFFER_STOP_GAP + BUFFER_STOP_DEPTH;

  // ── 7. Hit-testing, in screen dp ────────────────────────────────────────

  /** Screen box a billboard actually occupies: it stands UP from its anchor. */
  function spriteRect(b: Billboard): Rect {
    const anchor = camera.project(b.u, b.v);
    const s = camera.depthScaleAt(b.v);
    const w = b.width * s;
    const h = b.height * s;
    return { x: anchor.x - w / 2, y: anchor.y - h, width: w, height: h };
  }

  /**
   * Generous but never *overlapping* padding: half the inter-car gap, so a
   * tap between two cars still resolves, but never to the wrong one.
   */
  const carPad = Math.max(2, (carGap * camera.scale) / 2);

  function hitTest(x: number, y: number): ShuntingHit | null {
    // Near rows are drawn last and occlude far ones, so they must also win
    // the tap — walk the tracks from nearest (highest index) backwards.
    for (let i = trackCount - 1; i >= 0; i--) {
      if (inRectPad(x, y, spriteRect(locoBillboard(i, 'left')), 2)) {
        return { type: 'loco', side: 'left', trackIdx: i };
      }
      if (hasRightLoco && inRectPad(x, y, spriteRect(locoBillboard(i, 'right')), 2)) {
        return { type: 'loco', side: 'right', trackIdx: i };
      }
    }
    for (let i = trackCount - 1; i >= 0; i--) {
      for (let j = 0; j < capacity; j++) {
        if (inRectPad(x, y, spriteRect(carBillboard(i, j)), carPad)) {
          return { type: 'wagon', trackIdx: i, carIdx: j };
        }
      }
    }

    // Nothing standing up was hit — fall back to the ground itself, which is
    // what resolves taps on EMPTY car slots (the deposit gesture) and on the
    // bare row band. Identical semantics to the flat board's step 2, just
    // reached by unprojecting the tap onto the plane first.
    const { u, v } = camera.unproject(x, y);
    for (let i = 0; i < trackCount; i++) {
      const cy = rowV(i);
      if (v < cy - rowPitch / 2 || v > cy + rowPitch / 2) continue;
      if (u >= trackSX - 8 && u <= trackSX + trackWidth + 8) {
        const j = clamp(Math.floor((u - trackSX) / (carWidth + carGap)), 0, Math.max(capacity - 1, 0));
        return { type: 'wagon', trackIdx: i, carIdx: j };
      }
      if (u >= trackSX - locoColW && u <= trackSX + trackWidth + rightReserved) {
        return { type: 'row', trackIdx: i };
      }
    }
    return null;
  }

  return {
    trackCount,
    capacity,
    hasRightLoco,
    camera,
    carWidth,
    carGap,
    trackSX,
    trackWidth,
    rowPitch,
    rowHeight,
    carBodyWidth,
    carBodyHeight,
    locoBodyWidth,
    locoBodyHeight,
    ballastWidth,
    foregroundOriginY,
    foregroundMarginPlane,
    badgeColumnWidth: rightReserved,
    badgeSize,
    labelSize,
    contentWidth: width,
    contentHeight,
    rowV,
    carX,
    carRect,
    locoRect,
    carBillboard,
    locoBillboard,
    badgeAnchor,
    markerRect,
    peineLeft,
    peineRight,
    edgeLeftX,
    edgeRightX,
    deadEndRightX,
    hitTest,
  };
}
