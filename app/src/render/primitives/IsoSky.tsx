/**
 * Everything above the yard's far rail: the sky gradient's scenery layer —
 * sun or stars, the hill line, and the two silhouetted yard structures (a
 * water tower and a signal gantry) that give the horizon a sense of place.
 *
 * Geometry is the design reference's, expressed as fractions of a 960×200
 * sky band so it re-composes at any canvas size. `horizonY` is the camera's
 * far edge — the ground plane is drawn over the bottom of this band, so the
 * silhouettes' feet are deliberately allowed to run past it.
 *
 * Decorative only. Nothing here is interactive or hit-tested, and it is drawn
 * before the yard so it can never occlude a car.
 */

import React, { useEffect, useMemo } from 'react';
import { Circle, Group, LinearGradient, Path, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import type { TimeOfDayPalette } from '../../../design/tokens';

const REF_W = 960;
const REF_H = 200;

/** Reference hill silhouette, in 960×200 space. */
const HILL = [
  [0, 168],
  [130, 128],
  [260, 158],
  [390, 132],
  [560, 168],
  [700, 140],
  [860, 164],
  [960, 146],
] as const;

/** Reference star field, in 960×200 space: [x, y, r]. */
const STARS = [
  [80, 28, 1.4],
  [150, 54, 1],
  [260, 22, 1.2],
  [360, 46, 1],
  [470, 16, 1.4],
  [560, 42, 1],
  [680, 24, 1.2],
  [770, 52, 1],
  [860, 18, 1.4],
  [920, 58, 1],
] as const;

export interface IsoSkyProps {
  width: number;
  /** Screen y of the plane's far edge — the bottom of the sky band. */
  horizonY: number;
  palette: TimeOfDayPalette;
}

function IsoSkyImpl({ width, horizonY, palette }: IsoSkyProps) {
  const band = Math.max(1, horizonY);
  const sx = width / REF_W;
  const sy = band / REF_H;
  const { scenery } = palette;

  const hillPath = useMemo(() => {
    const pts = HILL.map(([x, y]) => `${x * sx},${y * sy}`).join(' L ');
    return `M ${pts} L ${width},${band * 1.2} L 0,${band * 1.2} Z`;
  }, [sx, sy, width, band]);

  // A single shared breath for the whole star field: ten independent loops
  // would be ten Reanimated animations for a detail nobody counts.
  const twinkle = useSharedValue(0);
  useEffect(() => {
    if (!scenery.stars) return;
    twinkle.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }), -1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenery.stars]);
  const starOpacity = useDerivedValue(() => 0.5 + twinkle.value * 0.5, [twinkle]);

  return (
    <Group>
      {scenery.sun && (
        <Circle cx={scenery.sun.cx * width} cy={scenery.sun.cy * band} r={scenery.sun.r * band}>
          <RadialGradient
            c={vec(scenery.sun.cx * width, scenery.sun.cy * band)}
            r={scenery.sun.r * band}
            colors={[...scenery.sun.colors]}
            positions={[0, 0.45, 0.78]}
          />
        </Circle>
      )}

      {scenery.stars && (
        <Group opacity={starOpacity}>
          {STARS.map(([x, y, r], i) => (
            <Circle key={i} cx={x * sx} cy={y * sy} r={Math.max(0.6, r * sy)} color={scenery.stars as string} />
          ))}
        </Group>
      )}

      <Path path={hillPath} color={scenery.hill} opacity={scenery.hillOpacity} />

      {/* Water tower (left) */}
      <Group color={scenery.structure}>
        <Rect x={112 * sx} y={76 * sy} width={26 * sx} height={88 * sy} />
        <Rect x={100 * sx} y={60 * sy} width={50 * sx} height={20 * sy} />
        <Rect x={123 * sx} y={34 * sy} width={Math.max(1, 3 * sx)} height={26 * sy} />
        {/* Signal gantry (right) */}
        <Rect x={800 * sx} y={102 * sy} width={52 * sx} height={14 * sy} />
        <Rect x={806 * sx} y={114 * sy} width={Math.max(1, 6 * sx)} height={48 * sy} />
        <Rect x={840 * sx} y={114 * sy} width={Math.max(1, 6 * sx)} height={48 * sy} />
      </Group>

      {scenery.lampLight && (
        <Group color={scenery.lampLight}>
          {palette.key === 'noche' ? (
            <Group>
              {[106, 120, 134].map((x, i) => (
                <Circle key={`l${i}`} cx={x * sx} cy={64 * sy} r={Math.max(1, 4 * sy)} />
              ))}
              {[815, 829, 843].map((x, i) => (
                <Circle key={`r${i}`} cx={x * sx} cy={106 * sy} r={Math.max(1, 4 * sy)} />
              ))}
            </Group>
          ) : (
            <Rect x={106 * sx} y={65 * sy} width={38 * sx} height={10 * sy} opacity={0.75} />
          )}
        </Group>
      )}

      {/* Warm haze pooling on the horizon line. */}
      <Rect x={0} y={band * 0.65} width={width} height={band * 0.35}>
        <LinearGradient
          start={vec(0, band * 0.65)}
          end={vec(0, band)}
          colors={['rgba(0,0,0,0)', palette.atmosphere.kind === 'vignette' ? 'rgba(255,190,110,0.16)' : palette.atmosphere.color]}
        />
      </Rect>
    </Group>
  );
}

export const IsoSky = React.memo(IsoSkyImpl);
