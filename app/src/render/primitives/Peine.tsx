/**
 * SUPERSEDED by IsoTrackBed.tsx. This is the FLAT board's throat (per-sleeper
 * rects + offset-normal rails). Nothing imports it since the isometric yard
 * landed. Edit IsoTrackBed.tsx instead; changes here reach no screen.
 *
 * The "peine en abanico" (fan comb) throat: cubic-bezier branches joining
 * parallel track rows to a single convergence node, plus the trunk and stub
 * straight segments on either side. Faithful port of
 * ref/js/shunting/renderer.js `drawPeine`/`drawPeineRight`.
 *
 * Geometry is expressed purely in the caller's coordinate space (see
 * src/render/layout/shuntingLayout.ts `PeineSide`) so the same component
 * draws both the left peine and, mirrored via explicit endpoints (not a
 * transform flip), the right peine on `rightLoco` levels.
 */

import React, { useMemo } from 'react';
import { Circle, Group, Path, Rect } from '@shopify/react-native-skia';

import { colors } from '../../../design/tokens';
import { Track } from './Track';
import { buildPeineBranch } from './peineGeometry';

function PeineBranchImpl({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const geo = useMemo(() => buildPeineBranch(x1, y1, x2, y2), [x1, y1, x2, y2]);
  return (
    <Group>
      <Path path={geo.ballastPath} color={colors.track.ballast} />
      {geo.ties.map((tie, i) => (
        <Group key={i} transform={[{ translateX: tie.x }, { translateY: tie.y }, { rotate: tie.angleRad }]}>
          <Rect x={-6} y={-15} width={13} height={30} color={tie.even ? colors.track.sleeperA : colors.track.sleeperB} />
        </Group>
      ))}
      <Path
        path={geo.railPaths[0]}
        style="stroke"
        strokeWidth={6}
        strokeJoin="round"
        strokeCap="round"
        color={colors.track.railShadow}
      />
      <Path
        path={geo.railPaths[1]}
        style="stroke"
        strokeWidth={6}
        strokeJoin="round"
        strokeCap="round"
        color={colors.track.railHighlight}
      />
    </Group>
  );
}
const PeineBranch = React.memo(PeineBranchImpl);

export interface PeineProps {
  trackYs: number[];
  convX: number;
  convY: number;
  fanEndX: number;
  trunkX: number;
  trunkWidth: number;
  stubX: number;
  stubWidth: number;
}

function PeineImpl({ trackYs, convX, convY, fanEndX, trunkX, trunkWidth, stubX, stubWidth }: PeineProps) {
  return (
    <Group>
      <Track x={trunkX} y={convY} width={trunkWidth} />
      {trackYs.map((ty, i) => (
        <PeineBranch key={i} x1={convX} y1={convY} x2={fanEndX} y2={ty} />
      ))}
      {trackYs.map((ty, i) => (
        <Track key={i} x={stubX} y={ty} width={stubWidth} />
      ))}
      {trackYs.map((ty, i) => (
        <Group key={i}>
          <Circle cx={fanEndX} cy={ty} r={5} color={colors.track.peineNode} />
          <Circle cx={fanEndX} cy={ty} r={2.5} color={colors.track.ballast} />
        </Group>
      ))}
      <Circle cx={convX} cy={convY} r={8} color={colors.track.peineNode} />
      <Circle cx={convX} cy={convY} r={4} color={colors.background.gradientTop} />
    </Group>
  );
}

export const Peine = React.memo(PeineImpl);
