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

import React, { useMemo } from 'react';
import { Circle, Group, LinearGradient, Path, RadialGradient, Rect, vec } from '@shopify/react-native-skia';

import type { TimeOfDayPalette } from '../../../design/tokens';
import { HILL, REF_H, REF_W, STARS } from './scenery/refBand';
import { useTwinkle } from './scenery/useTwinkle';

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
  // would be ten Reanimated animations for a detail nobody counts. Shared
  // with IsoScenery's lamp-post glow — see useTwinkle's doc comment.
  const starOpacity = useTwinkle(!!scenery.stars);

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

      {/* The water tower + signal gantry that used to live here were
          retired: they occupied ref-band x=100-150 / x=800-852, which fully
          overlaps SCENERY_SLOTS.left/right (60-260 / 700-900) from
          scenery/refBand.ts — every per-section prop rendered on top of one
          of them, producing a merged double silhouette on all 11 sections
          (caught by QA). The per-section kit's own structures (control
          tower, gantry crane, warehouse...) now cover this identity role
          per recipe; hill + fence remain the only two always-on constants
          (scenery-spec.md §2.1). */}

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
