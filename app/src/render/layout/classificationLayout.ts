/**
 * Yard layout + hit-testing for ClassificationBoard, on the same isometric
 * camera as the shunting board so the two modes read as one place.
 *
 * Same split as shuntingLayout.ts: the rows, car columns and selector gutter
 * are PLANE coordinates (u across, v receding), and the camera projects them
 * to screen dp. The plane is sized from the viewport so the camera comes out
 * at scale 1 and the dp-denominated tokens keep meaning what they meant on
 * the flat board.
 *
 * What is NOT the same: this mode has no per-car hit-testing. The whole row —
 * selector button, cars and background — is one tap target, exactly as in
 * ref/js/classification/input.js `handleClassificationClick`. So the tap
 * bands below are per-row, just extended UPWARD to cover the billboarded cars
 * standing on that row, and walked near-first because a near row's cars
 * overlap the row behind it.
 */

import { layout as L, spacing, isoCameraTokens } from '../../../design/tokens';
import { createIsoCamera, planeEdgeU, planeSizeForViewport, type IsoCamera } from '../iso/isoCamera';
import { clamp, fitCarDims, type Rect } from './common';

export interface ClassificationLayoutParams {
  arrivalsCount: number;
  clasifCount: number;
  /** Max INITIAL arrival-track length at level start (fixed for the level — ref `clf.arrSlots`). */
  arrSlots: number;
  /** Max classification-track capacity across all tracks (fixed — ref `clf.clasSlots`). */
  clasSlots: number;
  width: number;
  height: number;
}

export type ClassificationHit =
  | { type: 'arrival'; idx: number }
  | { type: 'classification'; idx: number };

export interface ClassificationLayout {
  camera: IsoCamera;

  arrivalsCount: number;
  clasifCount: number;

  /** Plane u of the first car column's left edge. */
  trackSX: number;
  trackWidth: number;
  arrCarWidth: number;
  arrCarGap: number;
  clasCarWidth: number;
  clasCarGap: number;

  /**
   * Distance from a car sprite's TOP to the rail it stands on, in local
   * units. Classification cars are drawn in a 58×42 design box whose running
   * gear sits below the body, so the rail is at 35/58 of the width — not at
   * the sprite's bottom edge. Billboarding anchors on this, not on the art's
   * full height.
   */
  arrCarRailY: number;
  clasCarRailY: number;

  rowPitch: number;
  /** Ballast stroke width for the track bed, in plane units. */
  ballastWidth: number;
  /** Gutter reserved left of the cars for the arrival selector / VÍA label. */
  gutterWidth: number;
  /** Plane u the gutter's furniture (selector button, VÍA label) is centred on. */
  gutterAnchor: number;
  /** Plane u the throat's fan branches terminate at, left of the gutter. */
  gutterThroatEnd: number;
  /** Plane u of the throat's convergence node (off the plane's left edge). */
  gutterThroatConv: number;
  /** Width of the arrival selector button, in plane units. */
  selectorWidth: number;
  /** Column reserved right of the cars for the capacity + purity readouts. */
  readoutWidth: number;
  labelSize: number;

  contentWidth: number;
  contentHeight: number;

  /** Plane v of arrival row i's rail centreline. */
  arrY: (i: number) => number;
  /** Plane v of classification row i's rail centreline. */
  clasY: (i: number) => number;
  arrCarX: (j: number) => number;
  clasCarX: (j: number) => number;
  /** Plane rect of one row's lit band (the active/flash washes). */
  rowBandRect: (v: number) => Rect;

  /**
   * Plane u the shared throat's trunk (left) and the classification stub
   * (right) should extend to so the bed reads as continuing past the canvas
   * edge rather than floating inside the frame — see shuntingLayout.ts's
   * identical fields and `planeEdgeU` in iso/isoCamera.ts. Drawing-only:
   * hit-testing never reads these.
   */
  edgeLeftX: number;
  edgeRightX: number;

  hitTest: (x: number, y: number) => ClassificationHit | null;
}

/** See MIN/MAX_SCREEN_ROW_PITCH in shuntingLayout.ts — same reasoning. */
const MIN_SCREEN_ROW_PITCH = 27;
const MAX_SCREEN_ROW_PITCH = 64;

/** Design-box ratios of the classification car art — see ClassificationWagon. */
const CLF_BOX_W = 58;
const CLF_BOX_RAIL_Y = 35;

/** See the identical constant in shuntingLayout.ts. */
const EDGE_BLEED_FRACTION = 0.08;

export function computeClassificationLayout(params: ClassificationLayoutParams): ClassificationLayout {
  const { arrivalsCount, clasifCount, arrSlots, clasSlots, width, height } = params;

  const cosTilt = Math.cos(isoCameraTokens.tiltDeg * (Math.PI / 180));
  const topPad = spacing.lg;
  const minPlanePitch = MIN_SCREEN_ROW_PITCH / cosTilt;
  const maxPlanePitch = MAX_SCREEN_ROW_PITCH / cosTilt;

  // The gap between the two blocks is worth about three quarters of a row:
  // "what is waiting" and "where it goes" are different places in the yard.
  const rowCount = Math.max(0, arrivalsCount) + Math.max(0, clasifCount);
  const dividerGap = minPlanePitch * 0.75;

  const first = planeSizeForViewport({ viewportWidth: width, viewportHeight: height });
  const neededPlaneHeight = topPad * 2 + Math.max(0, rowCount) * minPlanePitch + dividerGap;

  let contentHeight = height;
  let planeWidth = first.planeWidth;
  let planeHeight = first.planeHeight;
  if (neededPlaneHeight > planeHeight && planeHeight > 0) {
    contentHeight = height * (neededPlaneHeight / planeHeight);
    const grown = planeSizeForViewport({ viewportWidth: width, viewportHeight: contentHeight });
    planeWidth = grown.planeWidth;
    planeHeight = grown.planeHeight;
  }

  const camera = createIsoCamera({ planeWidth, planeHeight, viewportWidth: width, viewportHeight: contentHeight });

  // ── Rows ────────────────────────────────────────────────────────────────
  const usable = Math.max(0, planeHeight - topPad * 2 - dividerGap);
  const rowPitch = rowCount > 1 ? clamp(usable / rowCount, minPlanePitch, maxPlanePitch) : minPlanePitch;
  const blockHeight = rowCount * rowPitch + dividerGap;
  const topOffset = topPad + Math.max(0, planeHeight - topPad * 2 - blockHeight) * 0.5;

  const arrY = (i: number) => topOffset + rowPitch / 2 + i * rowPitch;
  const clasY = (i: number) => topOffset + rowPitch / 2 + (arrivalsCount + i) * rowPitch + dividerGap;

  // ── Columns ─────────────────────────────────────────────────────────────
  const sideMargin = L.sideMargin;
  // Wide enough to hold the selector button / "VÍA A" label CLEAR of the fan
  // branches sweeping in behind them — the throat ends at gutterThroatEnd and
  // the gutter's own furniture is centred at gutterAnchor, well to its right.
  const gutterWidth = clamp(planeWidth * 0.14, 68, 110);
  const readoutWidth = clamp(planeWidth * 0.1, 48, 80);
  const trackSX = sideMargin + gutterWidth;
  const trackWidth = Math.max(0, planeWidth - trackSX - readoutWidth - sideMargin);

  const { width: arrCarWidth, gap: arrCarGap } = fitCarDims(
    arrSlots,
    trackWidth,
    L.carGap,
    L.carWidthMin,
    L.carWidthMax
  );
  const { width: clasCarWidth, gap: clasCarGap } = fitCarDims(
    clasSlots,
    trackWidth,
    L.carGap,
    L.carWidthMin,
    L.carWidthMax
  );

  const arrCarX = (j: number) => trackSX + j * (arrCarWidth + arrCarGap);
  const clasCarX = (j: number) => trackSX + j * (clasCarWidth + clasCarGap);

  const gutterAnchor = trackSX - gutterWidth * 0.35;
  const gutterThroatEnd = trackSX - gutterWidth * 0.68;
  const gutterThroatConv = -gutterWidth * 0.5;
  const selectorWidth = gutterWidth * 0.45;

  const arrCarRailY = (arrCarWidth * CLF_BOX_RAIL_Y) / CLF_BOX_W;
  const clasCarRailY = (clasCarWidth * CLF_BOX_RAIL_Y) / CLF_BOX_W;

  const ballastWidth = Math.max(8, Math.min(rowPitch * 0.78, Math.max(arrCarRailY, clasCarRailY) * 0.9));
  const labelSize = clamp(clasCarWidth * 0.26, 8, 15);

  const rowBandRect = (v: number): Rect => ({
    x: trackSX - 10,
    y: v - ballastWidth / 2,
    width: trackWidth + 20,
    height: ballastWidth,
  });

  // ── Track-bed edge extents — see the identical block in shuntingLayout.ts ─
  const edgeLeftX = planeEdgeU(camera, -width * EDGE_BLEED_FRACTION);
  const edgeRightX = planeEdgeU(camera, width * (1 + EDGE_BLEED_FRACTION));

  // ── Hit-testing, in screen dp ───────────────────────────────────────────
  //
  // One band per row: as wide as the row's full tap target (selector gutter
  // through readout column) and tall enough to include the cars standing on
  // it. Near rows are checked first so their overlapping bodies win the tap.
  function bandFor(v: number, carRailY: number) {
    const s = camera.depthScaleAt(v);
    const railY = camera.project(trackSX, v).y;
    return {
      left: camera.project(trackSX - gutterWidth, v).x,
      right: camera.project(trackSX + trackWidth + readoutWidth, v).x,
      top: railY - carRailY * s,
      bottom: railY + (ballastWidth / 2) * cosTilt * s,
    };
  }

  function hitTest(x: number, y: number): ClassificationHit | null {
    const rows: { hit: ClassificationHit; v: number; railY: number }[] = [];
    for (let i = 0; i < arrivalsCount; i++) {
      rows.push({ hit: { type: 'arrival', idx: i }, v: arrY(i), railY: arrCarRailY });
    }
    for (let i = 0; i < clasifCount; i++) {
      rows.push({ hit: { type: 'classification', idx: i }, v: clasY(i), railY: clasCarRailY });
    }
    for (let i = rows.length - 1; i >= 0; i--) {
      const b = bandFor(rows[i].v, rows[i].railY);
      if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) return rows[i].hit;
    }
    // Nothing standing up was hit — fall back to the bare ground, so a tap on
    // an empty stretch of a row still selects it (the reference's whole-row
    // target), reached by unprojecting onto the plane first.
    const { u, v } = camera.unproject(x, y);
    if (u < trackSX - gutterWidth || u > trackSX + trackWidth + readoutWidth) return null;
    for (const row of rows) {
      if (Math.abs(v - row.v) <= rowPitch / 2) return row.hit;
    }
    return null;
  }

  return {
    camera,
    arrivalsCount,
    clasifCount,
    trackSX,
    trackWidth,
    arrCarWidth,
    arrCarGap,
    clasCarWidth,
    clasCarGap,
    arrCarRailY,
    clasCarRailY,
    rowPitch,
    ballastWidth,
    gutterWidth,
    gutterAnchor,
    gutterThroatEnd,
    gutterThroatConv,
    selectorWidth,
    readoutWidth,
    labelSize,
    contentWidth: width,
    contentHeight,
    arrY,
    clasY,
    arrCarX,
    clasCarX,
    rowBandRect,
    edgeLeftX,
    edgeRightX,
    hitTest,
  };
}
