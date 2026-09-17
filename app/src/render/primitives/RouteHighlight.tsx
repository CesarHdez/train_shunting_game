/**
 * The glowing "tirar → garganta → entrar" route line.
 *
 * New to the isometric yard: on the flat board you only ever saw the shape of
 * a move once it animated, so the single most important rule of the game —
 * a cut does not slide sideways between tracks, it pulls OUT to the throat
 * and comes back in — was invisible while you were deciding. This draws it.
 *
 * Two overlaid strokes in plane space (so the board's camera group applies
 * the perspective, exactly like the track bed): a wide low-opacity glow, and
 * a crisp dashed stroke on top whose dash phase marches along the path.
 *
 * When it shows:
 *  - a cut is selected but no destination committed yet → the PULL-OUT leg
 *    (source row → throat). There is no "pending destination" state in the
 *    engine — tapping a target executes the move — so drawing a line to a
 *    destination the player hasn't chosen would be inventing state. The
 *    green clearance markers already say which rows are legal.
 *  - a move is travelling → the full route, source row → throat → target row,
 *    which is the frame the design reference depicts.
 */

import React, { useEffect, useMemo } from 'react';
import { BlurMask, DashPathEffect, Group, Path } from '@shopify/react-native-skia';
import { Easing, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import type { TimeOfDayPalette } from '../../../design/tokens';

/** One full marching-ants cycle, ms (the reference's `march 3.2s linear infinite`). */
const MARCH_PERIOD_MS = 3200;

export interface RouteHighlightProps {
  /** Plane u/v the route starts at (the outermost selected car). */
  srcU: number;
  srcV: number;
  /** Plane u/v it ends at — omit for the pull-out leg only. */
  dstU?: number | null;
  dstV?: number | null;
  convX: number;
  convY: number;
  fanEndX: number;
  /** Dashed-stroke width in plane units; the glow is drawn at ~2×. */
  width: number;
  palette: TimeOfDayPalette;
}

function RouteHighlightImpl({
  srcU,
  srcV,
  dstU,
  dstV,
  convX,
  convY,
  fanEndX,
  width,
  palette,
}: RouteHighlightProps) {
  const hasDst = dstV != null && dstU != null;

  const path = useMemo(() => {
    const mid = (convX + fanEndX) / 2;
    const pull = `M ${srcU},${srcV} L ${fanEndX},${srcV} C ${mid},${srcV} ${mid},${convY} ${convX},${convY}`;
    if (!hasDst) return pull;
    return `${pull} C ${mid},${convY} ${mid},${dstV} ${fanEndX},${dstV} L ${dstU},${dstV}`;
  }, [srcU, srcV, dstU, dstV, convX, convY, fanEndX, hasDst]);

  const dash = useMemo(() => [width * 4.8, width * 4], [width]);
  const dashPeriod = dash[0] + dash[1];

  // Phase decreases so the dashes travel FORWARD along the path (toward the
  // throat / destination), which is the direction the cut will actually move.
  const phase = useSharedValue(0);
  useEffect(() => {
    phase.value = 0;
    phase.value = withRepeat(
      withTiming(-dashPeriod, { duration: MARCH_PERIOD_MS, easing: Easing.linear }),
      -1,
      false
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashPeriod]);

  return (
    <Group>
      <Path
        path={path}
        style="stroke"
        strokeWidth={width * 2.2}
        strokeCap="round"
        strokeJoin="round"
        color={palette.route.glow}
        opacity={0.18}
      >
        <BlurMask blur={width * 0.6} style="normal" />
      </Path>
      <Path
        path={path}
        style="stroke"
        strokeWidth={width}
        strokeCap="round"
        strokeJoin="round"
        color={palette.route.dash}
      >
        <DashPathEffect intervals={dash} phase={phase} />
      </Path>
    </Group>
  );
}

export const RouteHighlight = React.memo(RouteHighlightImpl);
