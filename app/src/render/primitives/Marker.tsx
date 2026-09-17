/**
 * Clearance / push marker: a small pulsing chevron beside a track's entry
 * point, shown when that track is a valid drop target. Shared by
 * ShuntingBoard's left/right clearance markers (ref `drawClearanceMarker`/
 * `drawClearanceMarkerRight`) and ClassificationBoard's push marker (ref
 * `drawPushMarker`) — all three are pixel-identical in the reference.
 *
 * Looping pulse is a self-contained Reanimated `withRepeat` loop (design-
 * system.md §5.2), independent of any shared animation clock.
 */

import React, { useEffect } from 'react';
import { BlurMask, Group, Path, RoundedRect } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { colors, motion } from '../../../design/tokens';

export interface MarkerProps {
  /** Track edge X the marker sits just outside of. */
  trackX: number;
  /** Top of the row (matches layout `rowTop`). */
  rowTop: number;
  rowHeight: number;
  isTarget: boolean;
  /** Which way the chevron points — 'right' for a left-edge marker, 'left' for a right-edge marker. */
  direction: 'right' | 'left';
}

const MARKER_W = 6;

function MarkerImpl({ trackX, rowTop, rowHeight, isTarget, direction }: MarkerProps) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!isTarget) {
      pulse.value = 0;
      return;
    }
    const period = 1000 / motion.pulseRates.clearanceMarker;
    pulse.value = withRepeat(withTiming(1, { duration: period / 2, easing: Easing.inOut(Easing.sin) }), -1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTarget]);

  const barOpacity = useDerivedValue(() => 0.75 + 0.25 * pulse.value, [pulse]);
  const chevronOpacity = useDerivedValue(() => 0.6 + 0.4 * pulse.value, [pulse]);
  const blurAmount = useDerivedValue(() => 4 + pulse.value * 5, [pulse]);

  const mH = Math.round(rowHeight * 0.55);
  const mX = trackX - Math.ceil(MARKER_W / 2);
  const mY = rowTop + (rowHeight - mH) / 2;
  const cy = rowTop + rowHeight / 2;

  const chevronPath =
    direction === 'right'
      ? `M ${mX - 2},${cy - 5} L ${mX - 10},${cy} L ${mX - 2},${cy + 5} Z`
      : `M ${mX + MARKER_W + 2},${cy - 5} L ${mX + MARKER_W + 10},${cy} L ${mX + MARKER_W + 2},${cy + 5} Z`;

  if (!isTarget) {
    return <RoundedRect x={mX} y={mY} width={MARKER_W} height={mH} r={3} color="rgba(200,208,218,0.18)" />;
  }

  return (
    <Group>
      <RoundedRect x={mX} y={mY} width={MARKER_W} height={mH} r={3} color={colors.status.success} opacity={barOpacity}>
        <BlurMask blur={blurAmount} style="normal" />
      </RoundedRect>
      <Path path={chevronPath} color={colors.status.success} opacity={chevronOpacity} />
    </Group>
  );
}

export const Marker = React.memo(MarkerImpl);
