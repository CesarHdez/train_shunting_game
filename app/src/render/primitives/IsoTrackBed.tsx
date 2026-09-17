/**
 * The yard's track bed — ballast, sleeper texture, gauge rails and switch
 * nodes for the whole "peine en abanico" throat plus every row's straight
 * stub, drawn in PLANE coordinates.
 *
 * The board renders this inside a `<Group matrix={camera.matrix}>`, so the
 * perspective is applied by Skia rather than baked into the geometry: a
 * homography maps straight lines to straight lines, so the same path data
 * that describes a flat yard describes the tilted one, with rails correctly
 * narrowing and sleepers correctly foreshortening as the rows recede.
 *
 * The bed is built from strokes rather than the flat board's per-sleeper
 * rectangles (Track.tsx). That is both truer to the design reference — which
 * draws one thick round-capped stroke for ballast and a dashed stroke over it
 * for the ties — and far cheaper: a 7-track yard is ~30 paths instead of
 * several hundred rects, which matters because the whole Skia surface
 * repaints on every animated frame.
 *
 * All widths derive from `ballastWidth` at the reference's own ratios
 * (rail gauge 11/42, rail 3.6/42, nodes 10/42 and 6/42 of the ballast
 * stroke), so the bed keeps its proportions at any row pitch.
 */

import React, { useMemo } from 'react';
import { Circle, DashPathEffect, Group, Path } from '@shopify/react-native-skia';

import type { TimeOfDayPalette } from '../../../design/tokens';
import { BufferStop } from './BufferStop';

export interface IsoTrackBedProps {
  /** Plane v of each row's rail centreline, far → near. */
  rows: number[];
  /** Convergence node (the throat's single point). */
  convX: number;
  convY: number;
  /** Plane u where the fanned branches end and straight stub track begins. */
  fanEndX: number;
  /** Plane u the straight stubs run out to (past the last car column). */
  stubEndX: number;
  /** Plane u the trunk runs back to, beyond the convergence node. */
  trunkX: number;
  ballastWidth: number;
  palette: TimeOfDayPalette;
  /**
   * When set, the straight stub TERMINATES here instead of continuing to
   * `stubEndX` as a bleed — caller passes the same value for both (see
   * ShuntingBoard.tsx) and this additionally caps every row with a
   * BufferStop rather than letting the run imply it keeps going off-frame.
   * `undefined` (the default) preserves the original bleed-past-the-edge
   * behaviour untouched.
   */
  deadEndX?: number;
}

/**
 * One row's full run: convergence node → cubic fan branch → straight stub.
 * Control points sit at the branch's horizontal midpoint on each end's own
 * row, which is what gives the throat its S-curve (identical construction to
 * peineGeometry.ts's `buildPeineBranch`, and to the design reference's
 * `C 170,210 170,30 280,30`).
 */
function buildRunPath(convX: number, convY: number, fanEndX: number, rowY: number, stubEndX: number): string {
  const mid = (convX + fanEndX) / 2;
  return `M ${convX},${convY} C ${mid},${convY} ${mid},${rowY} ${fanEndX},${rowY} L ${stubEndX},${rowY}`;
}

/** Same run, shifted vertically — how the reference draws the two gauge rails. */
function buildRailPath(
  convX: number,
  convY: number,
  fanEndX: number,
  rowY: number,
  stubEndX: number,
  offset: number
): string {
  return buildRunPath(convX, convY + offset, fanEndX, rowY + offset, stubEndX);
}

function IsoTrackBedImpl({
  rows,
  convX,
  convY,
  fanEndX,
  stubEndX,
  trunkX,
  ballastWidth,
  palette,
  deadEndX,
}: IsoTrackBedProps) {
  const gauge = ballastWidth * 0.262;
  const railWidth = Math.max(0.8, ballastWidth * 0.086);
  const convR = ballastWidth * 0.238;
  const fanR = ballastWidth * 0.143;
  const tieDash = useMemo(() => [ballastWidth * 0.167, ballastWidth * 0.333], [ballastWidth]);

  const runs = useMemo(
    () => rows.map((rowY) => buildRunPath(convX, convY, fanEndX, rowY, stubEndX)),
    [rows, convX, convY, fanEndX, stubEndX]
  );
  const rails = useMemo(
    () =>
      rows.flatMap((rowY) => [
        buildRailPath(convX, convY, fanEndX, rowY, stubEndX, -gauge),
        buildRailPath(convX, convY, fanEndX, rowY, stubEndX, gauge),
      ]),
    [rows, convX, convY, fanEndX, stubEndX, gauge]
  );
  const trunk = `M ${trunkX},${convY} L ${convX},${convY}`;

  return (
    <Group>
      {/* Ballast */}
      <Path
        path={trunk}
        style="stroke"
        strokeWidth={ballastWidth}
        strokeCap="round"
        color={palette.track.ballast}
      />
      {runs.map((d, i) => (
        <Path
          key={`b${i}`}
          path={d}
          style="stroke"
          strokeWidth={ballastWidth}
          strokeCap="round"
          strokeJoin="round"
          color={palette.track.ballast}
        />
      ))}

      {/* Sleeper texture: a dashed stroke of the same width over the ballast. */}
      {runs.map((d, i) => (
        <Path key={`t${i}`} path={d} style="stroke" strokeWidth={ballastWidth} color={palette.track.sleeper}>
          <DashPathEffect intervals={tieDash} />
        </Path>
      ))}

      {/* Gauge rails */}
      <Path
        path={`M ${trunkX},${convY - gauge} L ${convX},${convY - gauge}`}
        style="stroke"
        strokeWidth={railWidth}
        color={palette.track.rail}
        opacity={0.9}
      />
      <Path
        path={`M ${trunkX},${convY + gauge} L ${convX},${convY + gauge}`}
        style="stroke"
        strokeWidth={railWidth}
        color={palette.track.rail}
        opacity={0.9}
      />
      {rails.map((d, i) => (
        <Path
          key={`r${i}`}
          path={d}
          style="stroke"
          strokeWidth={railWidth}
          strokeCap="round"
          strokeJoin="round"
          color={palette.track.rail}
          opacity={0.9}
        />
      ))}

      {/* Switch nodes: one per fan-out, one big one at the throat. */}
      {rows.map((rowY, i) => (
        <Circle key={`n${i}`} cx={fanEndX} cy={rowY} r={fanR} color={palette.track.node} />
      ))}
      <Circle cx={convX} cy={convY} r={convR} color={palette.track.node} />

      {/* Dead end: this side has no locomotive throat, so every row is capped
          with a buffer stop instead of implying it keeps running off-frame. */}
      {typeof deadEndX === 'number' &&
        rows.map((rowY, i) => (
          <BufferStop key={`d${i}`} x={deadEndX} y={rowY} ballastWidth={ballastWidth} palette={palette} />
        ))}
    </Group>
  );
}

export const IsoTrackBed = React.memo(IsoTrackBedImpl);
