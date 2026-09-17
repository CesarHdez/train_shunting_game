/**
 * Isometric "maqueta" camera: the projective transform that turns the yard's
 * flat plane coordinates into the tilted 3/4 view.
 *
 * The design reference built this with CSS `perspective(1000px)` +
 * `rotateX(63deg)` on a `<div>`. Those numbers do NOT transfer to Skia (CSS
 * resolves perspective against the element's own pixel box, Skia against the
 * canvas matrix), so the projection is re-derived here from the two things
 * that actually define the look — the tilt angle and how much bigger the near
 * edge is than the far edge — and expressed as a plain 3×3 homography.
 *
 * Why a homography and not a 4×4: tilting a plane about a horizontal axis
 * under a pinhole camera is *exactly* a projective map of that plane. A 3×3
 * matrix with a non-affine bottom row captures it losslessly, which buys us
 *   - `<Group matrix={...}>` draws the whole ballast/rail/route layer in its
 *     existing plane coordinates with zero geometry changes, and
 *   - an exact closed-form `unproject`, so tapping still resolves to the same
 *     (track, column) the flat board resolved to.
 *
 * Coordinate spaces
 *   plane  (u, v) — what shuntingLayout/classificationLayout produce. Origin
 *                   top-left of the yard, +v recedes AWAY from the viewer.
 *   screen (x, y) — canvas dp, what Skia and the gesture handler speak.
 *
 * Rolling stock is NOT drawn through this matrix. Cars are billboarded: only
 * their anchor point is projected, then the sprite is drawn upright in screen
 * space at `depthScaleAt(v)`. That is the Skia equivalent of the reference's
 * `rotateX(-63deg)` counter-rotation, and it is why anything with text on it
 * (labels, capacity badges) must go through `project` + `depthScaleAt` rather
 * than being drawn inside the matrix group — a glyph painted onto the tilted
 * plane stretches into an unreadable smear.
 *
 * Pure math: no React, Skia, or Reanimated imports, so it unit-tests under
 * Node and its worklet-safe helpers can run on the UI thread.
 */

import { isoCameraTokens } from '../../../design/tokens';

/** Row-major 3×3: [a,b,c, d,e,f, g,h,i] maps (u,v,1) → (X,Y,W); screen = (X/W, Y/W). */
export type Matrix3 = readonly [number, number, number, number, number, number, number, number, number];

export interface IsoCameraParams {
  /** Size of the yard plane in plane units (= dp at the plane's mid-depth). */
  planeWidth: number;
  planeHeight: number;
  /** Canvas box the projected plane must land inside. */
  viewportWidth: number;
  viewportHeight: number;
  tiltDeg?: number;
  /** Near/far spread — see isoCameraTokens.perspective. Clamped to [0, 0.45). */
  perspective?: number;
  skyFraction?: number;
  bottomPadding?: number;
  sidePadding?: number;
}

export interface IsoCamera {
  planeWidth: number;
  planeHeight: number;
  matrix: Matrix3;
  inverse: Matrix3;
  /** Uniform fit scale: 1 plane unit at mid-depth = this many screen dp. */
  scale: number;
  /** Screen y of the plane's far (top) edge — everything above it is sky. */
  horizonY: number;
  /** Screen y of the plane's near (bottom) edge. */
  nearY: number;
  project(u: number, v: number): { x: number; y: number };
  unproject(x: number, y: number): { u: number; v: number };
  /** Scale for a billboarded sprite standing on row `v`. */
  depthScaleAt(v: number): number;
  /** Screen dp between two rows `planePitch` apart, measured at depth `v`. */
  rowPitchAt(v: number, planePitch: number): number;
}

const DEG = Math.PI / 180;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Plane dimensions that make a viewport-filling camera come out at scale 1.
 *
 * Inverts the fit below: given the box the yard must occupy, how big does the
 * plane have to be so that the NEAR edge exactly spans the available width
 * and the projected band exactly fills the available height? Layout modules
 * call this first, lay the yard out in the plane box it returns, then build
 * the camera — which then has nothing left to rescale.
 */
export function planeSizeForViewport(params: {
  viewportWidth: number;
  viewportHeight: number;
  tiltDeg?: number;
  perspective?: number;
  skyFraction?: number;
  bottomPadding?: number;
  sidePadding?: number;
}): { planeWidth: number; planeHeight: number } {
  const tilt = (params.tiltDeg ?? isoCameraTokens.tiltDeg) * DEG;
  const r = clamp(params.perspective ?? isoCameraTokens.perspective, 0, 0.45);
  const skyFraction = params.skyFraction ?? isoCameraTokens.skyFraction;
  const bottomPad = params.bottomPadding ?? isoCameraTokens.bottomPadding;
  const sidePad = params.sidePadding ?? isoCameraTokens.sidePadding;

  const availWidth = Math.max(1, params.viewportWidth - sidePad * 2);
  const availHeight = Math.max(1, params.viewportHeight * (1 - skyFraction) - bottomPad);

  // Near edge is magnified by 1/(1-r), so the plane itself must be that much
  // narrower than the width it is allowed to sweep.
  const planeWidth = availWidth * (1 - r);
  // Band height = planeHeight · cos(tilt) / (1 - r²)  (derivation in the
  // module doc: the two edge magnifications 1/(1∓r) average out to that).
  const planeHeight = (availHeight * (1 - r * r)) / Math.cos(tilt);

  return { planeWidth, planeHeight };
}

export function createIsoCamera(params: IsoCameraParams): IsoCamera {
  const tilt = (params.tiltDeg ?? isoCameraTokens.tiltDeg) * DEG;
  const r = clamp(params.perspective ?? isoCameraTokens.perspective, 0, 0.45);
  const skyFraction = params.skyFraction ?? isoCameraTokens.skyFraction;
  const bottomPad = params.bottomPadding ?? isoCameraTokens.bottomPadding;
  const sidePad = params.sidePadding ?? isoCameraTokens.sidePadding;

  const planeWidth = Math.max(1, params.planeWidth);
  const planeHeight = Math.max(1, params.planeHeight);
  const cosT = Math.cos(tilt);
  const half = planeHeight / 2;

  // Perspective divisor. Writing the pinhole divide as W(v) = (1+r) − q·v
  // (q = r/half) keeps `d` implicit, so the camera angle is identical at every
  // board size instead of drifting with a fixed pixel focal length.
  const q = r / half;
  const W = (v: number) => 1 + r - q * v;
  const nearP = 1 / (1 - r); // magnification at v = planeHeight
  const farP = 1 / (1 + r); // magnification at v = 0

  // Un-fitted extents, measured from the plane's own centre.
  const rawHalfWidth = (planeWidth / 2) * nearP;
  const rawTop = -half * cosT * farP;
  const rawBottom = half * cosT * nearP;

  const availWidth = Math.max(1, params.viewportWidth - sidePad * 2);
  const availHeight = Math.max(1, params.viewportHeight * (1 - skyFraction) - bottomPad);
  const scale = Math.min(availWidth / (rawHalfWidth * 2), availHeight / (rawBottom - rawTop));

  const cx = params.viewportWidth / 2;
  // Bottom-anchor the band: the near rail sits a hair above the canvas edge,
  // and whatever height the yard doesn't need becomes extra sky.
  const oy = params.viewportHeight - bottomPad - scale * rawBottom;

  const matrix: Matrix3 = [
    scale,
    -cx * q,
    cx * (1 + r) - (scale * planeWidth) / 2,
    0,
    scale * cosT - oy * q,
    oy * (1 + r) - scale * cosT * half,
    0,
    -q,
    1 + r,
  ];

  const inverse = invert3(matrix);

  const project = (u: number, v: number) => {
    const w = W(v);
    return {
      x: cx + (scale * (u - planeWidth / 2)) / w,
      y: oy + (scale * cosT * (v - half)) / w,
    };
  };

  const unproject = (x: number, y: number) => applyMatrix3(inverse, x, y);

  const depthScaleAt = (v: number) => scale / W(v);

  // dY/dv = scale·cos(tilt)/W(v)² — the W·q terms cancel exactly, which is
  // why near rows spread apart faster than a naive cos(tilt) squash suggests.
  const rowPitchAt = (v: number, planePitch: number) => {
    const w = W(v);
    return (planePitch * scale * cosT) / (w * w);
  };

  return {
    planeWidth,
    planeHeight,
    matrix,
    inverse,
    scale,
    horizonY: project(planeWidth / 2, 0).y,
    nearY: project(planeWidth / 2, planeHeight).y,
    project,
    unproject,
    depthScaleAt,
    rowPitchAt,
  };
}

/**
 * Applies a row-major 3×3 homography to a point.
 * Worklet-safe: the ghost-travel animation projects its path position on the
 * UI thread every frame, so this must not close over anything.
 */
export function applyMatrix3(m: Matrix3 | readonly number[], px: number, py: number): { u: number; v: number } {
  'worklet';
  const w = m[6] * px + m[7] * py + m[8];
  const inv = w === 0 ? 0 : 1 / w;
  return { u: (m[0] * px + m[1] * py + m[2]) * inv, v: (m[3] * px + m[4] * py + m[5]) * inv };
}

/** Same as applyMatrix3 but named for the plane→screen direction. Worklet-safe. */
export function projectWithMatrix(m: Matrix3 | readonly number[], u: number, v: number): { x: number; y: number } {
  'worklet';
  const w = m[6] * u + m[7] * v + m[8];
  const inv = w === 0 ? 0 : 1 / w;
  return { x: (m[0] * u + m[1] * v + m[2]) * inv, y: (m[3] * u + m[4] * v + m[5]) * inv };
}

/**
 * Billboard scale at plane row `v`, straight from the matrix.
 * Worklet-safe companion to projectWithMatrix for the animated ghost layer.
 */
export function depthScaleWithMatrix(m: Matrix3 | readonly number[], baseScale: number, v: number): number {
  'worklet';
  const w = m[7] * v + m[8];
  return w === 0 ? baseScale : baseScale / w;
}

/**
 * Plane u at which a run drawn along the plane's FAR edge (v = 0) would
 * project to screen x = `screenX`.
 *
 * Used to size track-bed geometry (rail/ballast stub ends, throat trunks) so
 * they read as continuing off-frame rather than stopping at a visible point:
 * callers want "extend this run in plane space until it projects past the
 * canvas edge, at every row the bed actually draws." v = 0 is deliberately
 * the FAR edge and not any real row's v, because W(v) — the perspective
 * divisor baked into `project` — shrinks monotonically as v grows (see the
 * module doc), so the far edge always needs the LARGEST |u| to reach a given
 * screen x. Sizing against it therefore guarantees every nearer row's own
 * run reaches (and, since it needs less, overshoots even further past) the
 * same screen edge — one call covers every row without iterating them.
 *
 * Pass a `screenX` a little past the true edge (e.g. `-0.08 * viewportWidth`
 * or `1.08 * viewportWidth`) for a comfortable bleed rather than landing
 * exactly on it.
 */
export function planeEdgeU(camera: IsoCamera, screenX: number): number {
  const m = camera.matrix;
  // project(u, 0) = (m0·u + m2) / (m6·u + m8); solve for u at X = screenX.
  const denom = screenX * m[6] - m[0];
  if (denom === 0) return camera.planeWidth / 2;
  return (m[2] - screenX * m[8]) / denom;
}

/**
 * Like `planeEdgeU`, but solves for the plane u that projects to screen
 * `screenX` at a CALLER-CHOSEN row depth `v`, instead of hardcoding the far
 * edge (v = 0).
 *
 * `planeEdgeU`'s v = 0 choice is deliberate for track-bed geometry (see its
 * doc comment): it wants ONE call to cover every row this layout draws.
 * Off-frame entry staging (railPath.ts's `buildEntryRailPlan`) wants the
 * opposite — "where is the visible edge AT THE TRUNK'S OWN DEPTH", so a
 * locomotive staged just past it starts just off-screen rather than many
 * plane-units further out than it needs to (v = 0 is the most COMPRESSED
 * depth — see the module doc's W(v) note — so reusing it here would overstate
 * how far off-frame the loco has to start, which is exactly the "~0.8s of
 * dead time" bug this exists to fix).
 *
 * Because the camera's projective matrix has a nonzero `m[1]`/`m[7]` term
 * (u and v both contribute to the homogeneous divisor/numerator, unlike the
 * v = 0 case where those terms vanish), this can't reuse `planeEdgeU`'s
 * simplified algebra — it re-derives the same "solve `project(u,v).x =
 * screenX` for u" step with `v` left as a variable instead of assumed 0.
 */
export function planeEdgeUAtV(camera: IsoCamera, screenX: number, v: number): number {
  const m = camera.matrix;
  // project(u,v) = (m0·u + m1·v + m2) / (m6·u + m7·v + m8); m6 is always 0
  // (see the module doc's matrix layout), so the denominator's u-term drops
  // out and w = m7·v + m8 is a plane-depth-only constant — solve the
  // remaining linear equation in u.
  const w = m[7] * v + m[8];
  const denom = screenX * m[6] - m[0];
  if (denom === 0) return camera.planeWidth / 2;
  return (m[1] * v + m[2] - screenX * w) / denom;
}

function invert3(m: Matrix3): Matrix3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (det === 0) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const inv = 1 / det;
  return [
    A * inv,
    -(b * i - c * h) * inv,
    (b * f - c * e) * inv,
    B * inv,
    (a * i - c * g) * inv,
    -(a * f - c * d) * inv,
    C * inv,
    -(a * h - b * g) * inv,
    (a * e - b * d) * inv,
  ];
}
