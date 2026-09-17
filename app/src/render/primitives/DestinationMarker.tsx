/**
 * Colorblind-safety badge: a small fixed geometric shape per destination
 * (circle/square/triangle/diamond/star), independent of hue, painted in the
 * top-left corner of every classification car — design/design-system.md
 * §6.3 "Color-blind safety" and design/components.md §5's colorblind badge.
 */

import React from 'react';
import { Circle, Group, Path, Rect } from '@shopify/react-native-skia';

import { colors, type DestinationKey } from '../../../design/tokens';

export interface DestinationMarkerProps {
  cx: number;
  cy: number;
  r: number;
  destination: DestinationKey;
  color: string;
}

function starPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.42;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    pts.push(`${i === 0 ? 'M' : 'L'}${x},${y}`);
  }
  return pts.join(' ') + ' Z';
}

function DestinationMarkerImpl({ cx, cy, r, destination, color }: DestinationMarkerProps) {
  const shape = colors.destinationMarkers[destination];
  switch (shape) {
    case 'circle':
      return <Circle cx={cx} cy={cy} r={r} color={color} />;
    case 'square':
      return <Rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} color={color} />;
    case 'triangle':
      return (
        <Path
          path={`M ${cx},${cy - r} L ${cx + r},${cy + r} L ${cx - r},${cy + r} Z`}
          color={color}
        />
      );
    case 'diamond':
      return (
        <Path
          path={`M ${cx},${cy - r} L ${cx + r},${cy} L ${cx},${cy + r} L ${cx - r},${cy} Z`}
          color={color}
        />
      );
    case 'star':
      return <Path path={starPath(cx, cy, r)} color={color} />;
    default:
      return null;
  }
}

export const DestinationMarker = React.memo(DestinationMarkerImpl);

/** Wraps the marker with its dark backing chip for legibility on any fill (components.md §5). */
export function DestinationBadge({ x, y, r, destination, color }: { x: number; y: number; r: number; destination: DestinationKey; color: string }) {
  return (
    <Group>
      <Circle cx={x} cy={y} r={r + 2} color="rgba(0,0,0,0.35)" />
      <DestinationMarker cx={x} cy={y} r={r} destination={destination} color={color} />
    </Group>
  );
}
