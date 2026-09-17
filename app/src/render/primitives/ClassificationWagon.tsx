/**
 * Patio de Clasificación wagon: one of 5 typed car shapes (F furgón,
 * T tanque, V tolva, J jaula, C contenedor), colored by destination, drawn
 * in a 58×42 design box scaled to the available car width — port of
 * ref/js/classification/renderer.js `drawClfCar`, plus the colorblind-safety
 * marker badge (design-system.md §6.3) the reference does not have.
 *
 * `destinationColors` and `DestinationMarker` are deliberately untouched by
 * the isometric redesign: destination IS the mechanic here, and its hue +
 * shape pairing is an accessibility contract, not decoration. What the
 * redesign does change is the running gear — the old pair of floating wheels
 * became proper bogies matching the shunting yard's (see IsoWagon.tsx) — and
 * the drawing convention: the sprite is now BILLBOARDED by the board, i.e.
 * drawn upright in local units at (0,0) and placed by the caller, with the
 * rail line at local y = RAIL_Y rather than at the art's bottom edge.
 */

import React, { useEffect } from 'react';
import { BlurMask, Circle, Group, Path, RoundedRect } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { colors, isoHardware, motion } from '../../../design/tokens';
import { parseClassificationCar } from '../../data/levelTypes';
import { DestinationMarker } from './DestinationMarker';

/** Design-box width the art below is drawn against. */
export const CLF_BOX_W = 58;
/**
 * Where the rail sits in that box. The body ends at y=28 and the running
 * gear hangs below it, so the wheels' contact point — not the art's bottom
 * edge — is what the board anchors to the track.
 */
export const CLF_BOX_RAIL_Y = 35;

export interface ClassificationWagonProps {
  code: string;
  /** Sprite width in LOCAL units; height follows the design box. */
  width: number;
  highlighted?: boolean;
}

function FBody({ fill, dark }: { fill: string; dark: string }) {
  return (
    <Group>
      <RoundedRect x={4} y={6} width={50} height={22} r={2} color={fill} />
      <RoundedRect x={4} y={6} width={50} height={22} r={2} style="stroke" strokeWidth={1.5} color={dark} />
      <RoundedRect x={23} y={9} width={12} height={16} r={1} color={dark} opacity={0.55} />
      <Path path="M 29,9 L 29,25" style="stroke" strokeWidth={1.5} color={fill} />
    </Group>
  );
}

function TBody({ fill, dark }: { fill: string; dark: string }) {
  return (
    <Group>
      <RoundedRect x={4} y={24} width={50} height={4} r={1} color="#5A6472" />
      <RoundedRect x={6} y={8} width={46} height={17} r={8.5} color={fill} />
      <RoundedRect x={6} y={8} width={46} height={17} r={8.5} style="stroke" strokeWidth={1.5} color={dark} />
      <RoundedRect x={25} y={4} width={8} height={6} r={2} color={dark} />
    </Group>
  );
}

function VBody({ fill, dark }: { fill: string; dark: string }) {
  const body = 'M 4,8 L 54,8 L 54,20 L 44,28 L 14,28 L 4,20 Z';
  return (
    <Group>
      <Path path={body} color={fill} />
      <Path path={body} style="stroke" strokeWidth={1.5} color={dark} />
      {[19, 39].map((lx, i) => (
        <Path key={i} path={`M ${lx},8 L ${lx},24`} style="stroke" strokeWidth={1.5} color={dark} opacity={0.6} />
      ))}
    </Group>
  );
}

function JBody({ fill, dark }: { fill: string; dark: string }) {
  return (
    <Group>
      <RoundedRect x={4} y={6} width={50} height={22} r={2} color={dark} />
      {[9, 16, 23, 30, 37, 44].map((lx, i) => (
        <RoundedRect key={i} x={lx} y={8} width={4} height={18} r={1} color={fill} />
      ))}
      <RoundedRect x={4} y={6} width={50} height={4} r={2} color={fill} />
    </Group>
  );
}

function CBody({ fill, dark }: { fill: string; dark: string }) {
  return (
    <Group>
      <RoundedRect x={4} y={24} width={50} height={4} r={1} color="#5A6472" />
      <RoundedRect x={8} y={8} width={42} height={16} r={1} color={fill} />
      <RoundedRect x={8} y={8} width={42} height={16} r={1} style="stroke" strokeWidth={1.5} color={dark} />
      {[15, 22, 29, 36, 43].map((lx, i) => (
        <Path key={i} path={`M ${lx},9 L ${lx},23`} style="stroke" strokeWidth={1} color={dark} opacity={0.5} />
      ))}
    </Group>
  );
}

/**
 * Two bogies in the design box's own coordinates: a dark truck bar tucked
 * under each end of the body (which ends at y=28) with two wheels inset, so
 * the wheels' centres land on the rail at CLF_BOX_RAIL_Y. Same construction
 * as the shunting yard's Bogies, just proportioned to this box.
 */
function Bogies() {
  const barY = 27.5;
  const wheelCy = CLF_BOX_RAIL_Y - 3;
  return (
    <Group>
      <RoundedRect x={5} y={barY} width={17} height={4.5} r={1.6} color={isoHardware.bogieBar} />
      <RoundedRect x={36} y={barY} width={17} height={4.5} r={1.6} color={isoHardware.bogieBar} />
      {[9.5, 18, 40, 48.5].map((wx, i) => (
        <Group key={i}>
          <Circle cx={wx} cy={wheelCy} r={3} color={isoHardware.wheel} />
          <Circle cx={wx} cy={wheelCy} r={3} style="stroke" strokeWidth={1} color={isoHardware.wheelEdge} />
        </Group>
      ))}
    </Group>
  );
}

function ClassificationWagonImpl({ code, width: w, highlighted = false }: ClassificationWagonProps) {
  const { tipo, color } = parseClassificationCar(code);
  const dest = colors.destinations[color];
  const s = w / CLF_BOX_W;

  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!highlighted) {
      pulse.value = 0;
      return;
    }
    const period = 1000 / motion.pulseRates.selectedCar;
    pulse.value = withRepeat(withTiming(1, { duration: period / 2, easing: Easing.inOut(Easing.sin) }), -1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlighted]);
  const glowBlur = useDerivedValue(() => 5 + pulse.value * 5, [pulse]);

  if (!dest) return null;

  const body = (() => {
    switch (tipo) {
      case 'F':
        return <FBody fill={dest.fill} dark={dest.dark} />;
      case 'T':
        return <TBody fill={dest.fill} dark={dest.dark} />;
      case 'V':
        return <VBody fill={dest.fill} dark={dest.dark} />;
      case 'J':
        return <JBody fill={dest.fill} dark={dest.dark} />;
      case 'C':
        return <CBody fill={dest.fill} dark={dest.dark} />;
      default:
        return null;
    }
  })();

  return (
    <Group transform={[{ scale: s }]}>
      {/* Flat contact shadow on the ballast. Unblurred for the same reason as
          IsoWagon's — this runs once per car across BOTH the arrival and
          classification tracks, and the whole Skia surface repaints every
          frame during any push animation, so an always-on blur here was pure
          per-frame GPU cost for a barely-visible sliver of shadow. */}
      <RoundedRect x={6} y={CLF_BOX_RAIL_Y - 1} width={46} height={4} r={2} color="rgba(0,0,0,0.3)" />
      {highlighted && (
        <RoundedRect x={4} y={6} width={50} height={22} r={2} color={colors.status.warning} opacity={0.4}>
          <BlurMask blur={glowBlur} style="normal" />
        </RoundedRect>
      )}
      <Bogies />
      {body}
      <DestinationMarker cx={10} cy={4} r={4} destination={color} color={dest.dark} />
    </Group>
  );
}

export const ClassificationWagon = React.memo(ClassificationWagonImpl);
