/**
 * Arrival-track selector button (left of each "vía de llegada" row) —
 * styled like a parked/active locomotive button. Faithful port of
 * ref/js/classification/renderer.js `drawArrivalSelector`.
 */

import React from 'react';
import { BlurMask, Group, Path, RoundedRect } from '@shopify/react-native-skia';

import { colors } from '../../../design/tokens';

export interface ArrivalSelectorProps {
  x: number;
  y: number;
  w: number;
  h: number;
  isActive: boolean;
  isEmpty: boolean;
}

function ArrivalSelectorImpl({ x, y, w, h, isActive, isEmpty }: ArrivalSelectorProps) {
  const fill = isActive ? '#7a5514' : isEmpty ? '#1a1f2a' : colors.loco.idleLo;
  const stroke = isActive ? colors.status.warning : 'rgba(255,255,255,0.1)';
  const arrowColor = isActive ? colors.status.warning : isEmpty ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.45)';

  return (
    <Group>
      {isActive && (
        <RoundedRect x={x} y={y} width={w} height={h} r={4} color={colors.status.warning} opacity={0.5}>
          <BlurMask blur={8} style="normal" />
        </RoundedRect>
      )}
      <RoundedRect x={x} y={y} width={w} height={h} r={4} color={fill} />
      <RoundedRect x={x} y={y} width={w} height={h} r={4} style="stroke" strokeWidth={isActive ? 2 : 1.5} color={stroke} />
      <Path
        path={`M ${x + w / 2 - 5},${y + h / 2 - 6} L ${x + w / 2 + 7},${y + h / 2} L ${x + w / 2 - 5},${y + h / 2 + 6} Z`}
        color={arrowColor}
      />
    </Group>
  );
}

export const ArrivalSelector = React.memo(ArrivalSelectorImpl);
