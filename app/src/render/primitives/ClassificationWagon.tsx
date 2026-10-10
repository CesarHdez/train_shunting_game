/**
 * Patio de Clasificación wagon. Draws the SAME shells as the shunting yard
 * (wagonShell.tsx: cubierto, cisterna, tolva, góndola, balasto + bogies),
 * recoloured by DESTINATION via `destinationLivery` (lighter top -> darker
 * bottom gradient, roof cap, rim light, outline). Only the colour scheme
 * differs from shunting; the shapes are shared.
 *
 *   F furgón     -> cubierto
 *   T tanque     -> cisterna
 *   V tolva      -> tolva
 *   J jaula      -> góndola (open-top, ribbed well)
 *   C contenedor -> balasto (the former "container" shell)
 *
 * The colourblind-safety badge (hue-independent shape per destination,
 * design-system.md §6.3) stays: a dark chip + white shape on the upper body.
 *
 * Drawing convention: BILLBOARDED by the board — drawn upright at local
 * (0,0) in a CLF_BOX_W × CLF_BOX_H design box scaled to the car width, with
 * the rail line at local y = CLF_BOX_RAIL_Y (the body's bottom edge, same as
 * shunting, where wheels sit just under it).
 */

import React, { useEffect, useMemo } from 'react';
import { BlurMask, Circle, Group, Oval, Path, RoundedRect } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { colors, isoHardware, motion, type IsoWagonKind, type TimeOfDayPalette } from '../../../design/tokens';
import { parseClassificationCar } from '../../data/levelTypes';
import { destinationLivery } from './destinationLivery';
import { DestinationMarker } from './DestinationMarker';
import { Bogies, Shell, balastoPath, buildCisternaGeom, cubiertoPath, gondolaPath, tolvaPath } from './wagonShell';

/** Design-box width the art is drawn against. */
export const CLF_BOX_W = 58;
/** Body height in the box — near the shunting car's 76:52 aspect, a touch squatter to keep rows from crowding. */
export const CLF_BOX_H = 38;
/**
 * Rail line in the box = the body's bottom edge (wheels hang just under it,
 * exactly as in IsoWagon). classificationLayout.ts mirrors this value.
 */
export const CLF_BOX_RAIL_Y = CLF_BOX_H;

const KIND_FOR_TYPE: Record<string, IsoWagonKind> = {
  F: 'cubierto',
  T: 'cisterna',
  V: 'tolva',
  J: 'gondola',
  C: 'balasto',
};

/** Fraction of full livery brightness removed at night (hue stays readable). */
const NIGHT_DIM = 0.3;

export interface ClassificationWagonProps {
  code: string;
  /** Sprite width in LOCAL units; height follows the design box. */
  width: number;
  highlighted?: boolean;
  /** Time-of-day palette: picks the outline weight and night dimming. */
  palette?: TimeOfDayPalette;
}

function silhouetteFor(kind: IsoWagonKind, w: number, h: number): string | null {
  switch (kind) {
    case 'cubierto':
      return cubiertoPath(w, h);
    case 'gondola':
      return gondolaPath(w, h);
    case 'tolva':
      return tolvaPath(w, h);
    case 'balasto':
      return balastoPath(w, h);
    default:
      return null;
  }
}

function ClassificationWagonImpl({ code, width, highlighted = false, palette }: ClassificationWagonProps) {
  const { tipo, color } = parseClassificationCar(code);
  const dest = colors.destinations[color];
  const kind = KIND_FOR_TYPE[tipo];
  const s = width / CLF_BOX_W;
  const w = CLF_BOX_W;
  const h = CLF_BOX_H;

  const night = palette?.key === 'noche';
  const edge = night ? isoHardware.bodyEdgeNight : isoHardware.bodyEdge;
  const mat = useMemo(() => (dest ? destinationLivery(color, night ? NIGHT_DIM : 0) : null), [dest, color, night]);
  const silhouette = useMemo(() => (kind ? silhouetteFor(kind, w, h) : null), [kind, w, h]);
  const cisternaGeom = useMemo(() => (kind === 'cisterna' ? buildCisternaGeom(w, h) : null), [kind, w, h]);

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
  const glowBlur = useDerivedValue(() => (h * 0.1 + pulse.value * h * 0.1) * 1.4, [pulse, h]);

  if (!dest || !kind || !mat) return null;

  // Same small-size detail gate as IsoWagon, against the on-screen width.
  const detailed = width >= 46;

  return (
    <Group transform={[{ scale: s }]}>
      {/* Flat contact shadow (unblurred, as IsoWagon). */}
      <Oval x={w * 0.04} y={h * 0.96} width={w * 0.92} height={h * 0.13} color="rgba(0,0,0,0.32)" />

      {highlighted && silhouette && (
        <Path path={silhouette} color={colors.status.warning} opacity={0.75}>
          <BlurMask blur={glowBlur} style="normal" />
        </Path>
      )}
      {highlighted && cisternaGeom && (
        <RoundedRect
          x={cisternaGeom.tank.x}
          y={cisternaGeom.tank.y}
          width={cisternaGeom.tank.width}
          height={cisternaGeom.tank.height}
          r={cisternaGeom.tank.r}
          color={colors.status.warning}
          opacity={0.75}
        >
          <BlurMask blur={glowBlur} style="normal" />
        </RoundedRect>
      )}

      <Bogies w={w} h={h} />
      <Shell kind={kind} w={w} h={h} mat={mat} edge={edge} detailed={detailed} silhouette={silhouette} cisterna={cisternaGeom} />

      {highlighted && silhouette && (
        <Path path={silhouette} style="stroke" strokeWidth={2} strokeJoin="round" color={colors.status.warning} />
      )}

      {/* Colourblind-safety badge: dark chip + white shape reads on any livery. */}
      <Circle cx={w / 2} cy={h * 0.21} r={5.2} color="rgba(0,0,0,0.5)" />
      <DestinationMarker cx={w / 2} cy={h * 0.21} r={3.6} destination={color} color="#ffffff" />
    </Group>
  );
}

export const ClassificationWagon = React.memo(ClassificationWagonImpl);
