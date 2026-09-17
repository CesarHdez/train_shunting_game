/**
 * Waypoint-path math for the shunting/classification travel animations.
 *
 * Faithful port of ref/js/shunting/state.js `easeInOut`, `buildWaypoints`,
 * `buildWaypointsRight`, and `AnimationManager.getPosAt` — a 6-point path
 * (pull out onto the ladder → curve into the convergence node → traverse
 * vertically → curve back → settle) with per-segment quadratic ease-in-out,
 * generalized from the reference's fixed 1024×768 world into arbitrary
 * screen-dp coordinates supplied by the layout modules.
 *
 * Every function here is a plain, allocation-light worklet-safe function
 * (no closures over React/Skia/Reanimated state) so it can run directly
 * inside a Reanimated `useDerivedValue` on the UI thread.
 */

export interface Waypoint {
  x: number;
  y: number;
  /** Normalized time in [0,1] at which this waypoint is reached. */
  t: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Symmetric quadratic ease-in-out — identical to the reference's `easeInOut`. */
export function easeInOut(t: number): number {
  'worklet';
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/**
 * Build the 6-point waypoint path for a car/loco traveling from
 * (startX, srcY) to (endX, dstY) through a peine convergence node at convX,
 * fanning out at fanEndX. Mirrors `buildWaypoints`/`buildWaypointsRight`
 * (pass the RIGHT peine's convX/fanEndX to animate through it instead).
 */
export function buildWaypoints(
  startX: number,
  srcY: number,
  endX: number,
  dstY: number,
  convX: number,
  fanEndX: number
): Waypoint[] {
  'worklet';
  const dir = dstY > srcY ? 1 : dstY < srcY ? -1 : 1;
  return [
    { x: startX, y: srcY, t: 0.0 },
    { x: fanEndX, y: srcY, t: 0.2 },
    { x: convX, y: srcY + dir * 4, t: 0.38 },
    { x: convX, y: dstY - dir * 4, t: 0.62 },
    { x: fanEndX, y: dstY, t: 0.8 },
    { x: endX, y: dstY, t: 1.0 },
  ];
}

/**
 * Simpler dogleg path for the classification "push" animation (no peine —
 * cars pull out of the arrival head, travel through a vertical channel just
 * left of the track column, and settle into the classification row). This
 * is new: the reference has no push animation at all (see boardContract.ts
 * doc comment) — this path is the approved improvement that gives
 * Clasificación the same travel-animation polish as Maniobras.
 */
export function buildPushWaypoints(
  startX: number,
  srcY: number,
  endX: number,
  dstY: number,
  channelX: number
): Waypoint[] {
  'worklet';
  return [
    { x: startX, y: srcY, t: 0.0 },
    { x: channelX, y: srcY, t: 0.3 },
    { x: channelX, y: dstY, t: 0.7 },
    { x: endX, y: dstY, t: 1.0 },
  ];
}

/** Evaluate a waypoint path at normalized time t in [0,1], per-segment eased. */
export function getPosAt(waypoints: Waypoint[], t: number): Point {
  'worklet';
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    if (t <= b.t) {
      const span = b.t - a.t;
      const lt = span > 0 ? (t - a.t) / span : 1;
      const e = easeInOut(Math.min(1, Math.max(0, lt)));
      return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
    }
  }
  const last = waypoints[waypoints.length - 1];
  return { x: last.x, y: last.y };
}

/**
 * Total polyline arc length of a waypoint path (sum of straight-line
 * segment lengths between consecutive waypoints). Used to convert a desired
 * physical trailing distance (e.g. a car's real (carWidth+carGap) coupling
 * offset behind the locomotive) into a normalized-time lag fraction — see
 * useShuntingAnimation.ts's coupled-train follow math. Plain JS-thread
 * helper (called once per detected move, not per frame), not a worklet.
 */
export function waypointsArcLength(waypoints: Waypoint[]): number {
  let len = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

/** Distance factor in [0,1] used to scale animation duration (ref: `dist`). */
export function distanceFactor(fromIdx: number, toIdx: number, trackCount: number): number {
  return Math.abs(toIdx - fromIdx) / Math.max(trackCount - 1, 1);
}

/**
 * Total travel duration in ms for `numMovingCars` cars, matching the
 * reference's `0.38 + 0.45 * distFactor` (seconds) via
 * `motion.durations.carMoveBase`/`carMoveDistanceMax`.
 */
export function travelDurationMs(distFactor: number, carMoveBase: number, carMoveDistanceMax: number): number {
  return carMoveBase + carMoveDistanceMax * distFactor;
}
