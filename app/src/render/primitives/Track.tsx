/**
 * SUPERSEDED by IsoTrackBed.tsx — reachable only from the equally superseded
 * Peine.tsx. Edit IsoTrackBed.tsx instead; changes here reach no screen.
 *
 * Straight track-bed segment: ballast rounded-rect, alternating sleepers,
 * two gauge rails with a highlight→shadow gradient. Faithful port of
 * ref/js/core/canvas.js `drawTrack(x, y, width)` (y = rail centerline).
 */

import React, { useMemo } from 'react';
import { Group, LinearGradient, Rect, RoundedRect, vec } from '@shopify/react-native-skia';

import { colors } from '../../../design/tokens';

export interface TrackProps {
  x: number;
  /** Rail centerline Y. */
  y: number;
  width: number;
}

const SLEEPER_W = 13;
const SLEEPER_H = 30;
const SLEEPER_GAP = 18;

function TrackImpl({ x, y, width }: TrackProps) {
  const sleepers = useMemo(() => {
    const out: { sx: number; even: boolean }[] = [];
    for (let sx = x; sx < x + width; sx += SLEEPER_GAP) {
      out.push({ sx, even: Math.floor(sx / SLEEPER_GAP) % 2 === 0 });
    }
    return out;
  }, [x, width]);

  if (width <= 0) return null;

  return (
    <Group>
      <RoundedRect x={x - 6} y={y - 18} width={width + 12} height={36} r={2} color={colors.track.ballast} />
      {sleepers.map((s, i) => (
        <Rect
          key={i}
          x={s.sx - 1}
          y={y - SLEEPER_H / 2}
          width={SLEEPER_W}
          height={SLEEPER_H}
          color={s.even ? colors.track.sleeperA : colors.track.sleeperB}
        />
      ))}
      {[-10, 10].map((off) => (
        <Rect key={off} x={x} y={y + off - 3} width={width} height={6}>
          <LinearGradient
            start={vec(x, y + off - 4)}
            end={vec(x, y + off + 4)}
            colors={[colors.track.railHighlight, colors.track.railShadow]}
          />
        </Rect>
      ))}
    </Group>
  );
}

export const Track = React.memo(TrackImpl);
