/**
 * Patio de Maniobras rolling stock, redrawn from real prototypes for the
 * isometric yard: cubierto (boxcar), góndola, cisterna (tanker), tolva
 * (hopper) and balasto (ballast hopper), each on a pair of wheel bogies.
 *
 * Which shell a car gets is still `label.charCodeAt(0) % 5`, with the same
 * index→shape mapping the flat board used (see isoWagonOrder in
 * design/tokens.ts) — a given label keeps the body it has always had and only
 * its artwork changes.
 *
 * Drawn in LOCAL units with the body's top-left at (0,0): the board
 * billboards it, i.e. translates the sprite to its projected anchor and
 * scales it by the camera's depth factor, so this component never needs to
 * know about the projection. Proportions are all fractions of `w`/`h` (taken
 * from the design reference's 76×52 car) so the same drawing holds up at
 * every depth and row pitch.
 *
 * The bogies are the part that sells the diorama: the wheel circles' centres
 * sit a hair BELOW the body's bottom edge, which is the rail line, so the car
 * reads as resting on the track instead of hovering over it or sinking into
 * the ballast.
 *
 * SHELL GEOMETRY (per design/wagon-art-spec.md, tolva/cisterna later redrawn
 * per follow-up corrections — see wagonShell.tsx): four of the five shells
 * are real closed-path silhouettes (eave-stepped boxcar, jagged-topped
 * gondola, a near-vertical-walled cement hopper with 3 discharge gates,
 * vertical-wall-then-wedge ballast hopper) instead of a bounding
 * `RoundedRect` — only `cisterna` stays a 4-primitive composition (tank pill
 * + sill trapezoid + two end platforms), because merging a pill and a
 * trapezoid into one contour needs an SVG arc command that's an easy place
 * to silently get the sweep flag wrong.
 *
 * The path builders and the `<Shell>`/`<Bogies>` renderers live in
 * `wagonShell.tsx`, shared with `WagonGlyph.tsx` (the small HUD-chip
 * drawing) so neither file duplicates the geometry — this file only adds
 * what's specific to the full yard sprite: the label badge, the selection
 * halo/stroke (both traced against the SAME silhouette functions, single
 * source of truth so the glow can never drift from the shape it hugs — see
 * `LocoButton.tsx`'s active-loco body for the pattern this mirrors), and the
 * ground-contact shadow.
 *
 * Small-size behaviour: a local `detailed = w >= 46` gate drops only the
 * *scattered small* interior details (door handle, ladder rungs, tack board,
 * roof hatches, post highlights) that would alias into noise at yard-minimum
 * car widths. The silhouette, main gradient fill, cap/rim-light bands and ink
 * outline are always drawn — they're one draw call each, same cost class as
 * the `RoundedRect` they replaced, and they're what carries the "which kind
 * is this" read at a glance. `tolva`'s three discharge gates are an
 * exception to the "drop below the gate" rule: they're this kind's
 * identifying feature, so below `detailed` they simplify to plain blocks
 * instead of disappearing.
 */

import React, { useEffect, useMemo } from 'react';
import { BlurMask, Group, Oval, Path, Rect, RoundedRect, Text } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { isoHardware, motion, type TimeOfDayPalette } from '../../../design/tokens';
import { useCarLabelFont } from './labelFont';
import { Bogies, Shell, balastoPath, buildCisternaGeom, cubiertoPath, gondolaPath, tolvaPath, wagonKindFor } from './wagonShell';

export { wagonKindFor, Bogies };

export interface IsoWagonProps {
  /** Body width/height in LOCAL units (pre depth-scale). */
  width: number;
  height: number;
  label: string;
  isSelected: boolean;
  palette: TimeOfDayPalette;
  /** Font size already chosen for the label badge, in local units. */
  labelSize: number;
}

function IsoWagonImpl({ width: w, height: h, label, isSelected, palette, labelSize }: IsoWagonProps) {
  const kind = wagonKindFor(label);
  const mat = palette.wagons[kind];
  const edge = palette.key === 'noche' ? isoHardware.bodyEdgeNight : isoHardware.bodyEdge;

  // Small-size detail gate (design/wagon-art-spec.md §"Cheap vs. expensive"):
  // below this, drop only the scattered-small interior details per shell —
  // the silhouette/fill/cap/rim-light/outline stay on at every size. Plain
  // per-render comparison, not per-frame.
  const detailed = w >= 46;

  // Silhouette path, single source of truth shared by the body fill/outline
  // (via `Shell`) AND the selection halo/stroke below — see file banner.
  // Non-null for every kind except `cisterna`, which uses `cisternaGeom`
  // instead (its shape is 4 primitives, not one contour).
  const silhouette = useMemo(() => {
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
  }, [kind, w, h]);
  const cisternaGeom = useMemo(() => (kind === 'cisterna' ? buildCisternaGeom(w, h) : null), [kind, w, h]);

  const font = useCarLabelFont(Math.max(6, Math.round(labelSize)), '700');
  const labelWidth = useMemo(() => {
    if (!font) return label.length * labelSize * 0.55;
    try {
      return font.measureText(label).width;
    } catch {
      return label.length * labelSize * 0.55;
    }
  }, [font, label, labelSize]);

  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!isSelected) {
      pulse.value = 0;
      return;
    }
    const period = 1000 / motion.pulseRates.selectedCar;
    pulse.value = withRepeat(withTiming(1, { duration: period / 2, easing: Easing.inOut(Easing.sin) }), -1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelected]);
  const glowBlur = useDerivedValue(() => (h * 0.1 + pulse.value * h * 0.1) * 1.4, [pulse, h]);

  // Badge kept in the body's UPPER half, shared by every kind
  // (design/wagon-art-spec.md §5): 0.20h lands on a flat, unobstructed panel
  // on all five silhouettes (wall metal on cubierto/tolva/balasto, the open
  // well on gondola, the tank shell on cisterna) — this is the letter the
  // player reads the target sequence against, so legibility wins over dead
  // centering.
  const badgeW = labelWidth + labelSize * 0.6;
  const badgeH = labelSize * 1.35;
  const badgeX = w / 2 - badgeW / 2;
  const badgeY = h * 0.2;

  return (
    <Group>
      {/* Flat contact shadow on the ballast. Unblurred on purpose: a dense
          level puts dozens of these on screen and the whole Skia surface
          repaints every animated frame — see the same tradeoff noted on the
          flat board's wagon shadow. */}
      <Oval x={w * 0.04} y={h * 0.96} width={w * 0.92} height={h * 0.13} color="rgba(0,0,0,0.32)" />

      {/* Selection glow: traces the shell's own silhouette, not a bounding
          box (design/wagon-art-spec.md §4) — only mounts BlurMask when
          selected, matching the existing "dense level repaints every frame"
          performance convention. */}
      {isSelected && silhouette && (
        <Path path={silhouette} color={isoHardware.selectHalo}>
          <BlurMask blur={glowBlur} style="normal" />
        </Path>
      )}
      {isSelected && cisternaGeom && (
        <Group>
          <RoundedRect
            x={cisternaGeom.tank.x}
            y={cisternaGeom.tank.y}
            width={cisternaGeom.tank.width}
            height={cisternaGeom.tank.height}
            r={cisternaGeom.tank.r}
            color={isoHardware.selectHalo}
          >
            <BlurMask blur={glowBlur} style="normal" />
          </RoundedRect>
          <Path path={cisternaGeom.sill} color={isoHardware.selectHalo}>
            <BlurMask blur={glowBlur} style="normal" />
          </Path>
          <Rect
            x={cisternaGeom.platformL.x}
            y={cisternaGeom.platformL.y}
            width={cisternaGeom.platformL.width}
            height={cisternaGeom.platformL.height}
            color={isoHardware.selectHalo}
          >
            <BlurMask blur={glowBlur} style="normal" />
          </Rect>
          <Rect
            x={cisternaGeom.platformR.x}
            y={cisternaGeom.platformR.y}
            width={cisternaGeom.platformR.width}
            height={cisternaGeom.platformR.height}
            color={isoHardware.selectHalo}
          >
            <BlurMask blur={glowBlur} style="normal" />
          </Rect>
        </Group>
      )}

      <Bogies w={w} h={h} />
      <Shell kind={kind} w={w} h={h} mat={mat} edge={edge} detailed={detailed} silhouette={silhouette} cisterna={cisternaGeom} />

      {/* Selection outline: same silhouette, stroked directly (no outward
          padding — a stroke straddles its path by half its width). */}
      {isSelected && silhouette && (
        <Path path={silhouette} style="stroke" strokeWidth={2} strokeJoin="round" color={isoHardware.selectEdge} />
      )}
      {isSelected && cisternaGeom && (
        <Group>
          <RoundedRect
            x={cisternaGeom.tank.x}
            y={cisternaGeom.tank.y}
            width={cisternaGeom.tank.width}
            height={cisternaGeom.tank.height}
            r={cisternaGeom.tank.r}
            style="stroke"
            strokeWidth={2}
            color={isoHardware.selectEdge}
          />
          <Path path={cisternaGeom.sill} style="stroke" strokeWidth={2} strokeJoin="round" color={isoHardware.selectEdge} />
          <Rect
            x={cisternaGeom.platformL.x}
            y={cisternaGeom.platformL.y}
            width={cisternaGeom.platformL.width}
            height={cisternaGeom.platformL.height}
            style="stroke"
            strokeWidth={2}
            color={isoHardware.selectEdge}
          />
          <Rect
            x={cisternaGeom.platformR.x}
            y={cisternaGeom.platformR.y}
            width={cisternaGeom.platformR.width}
            height={cisternaGeom.platformR.height}
            style="stroke"
            strokeWidth={2}
            color={isoHardware.selectEdge}
          />
        </Group>
      )}

      <RoundedRect x={badgeX} y={badgeY} width={badgeW} height={badgeH} r={badgeH * 0.25} color={isoHardware.labelBadgeBg} />
      {font && (
        <Text
          x={w / 2 - labelWidth / 2}
          y={badgeY + badgeH * 0.78}
          text={label}
          font={font}
          color={isoHardware.labelBadgeText}
        />
      )}
    </Group>
  );
}

export const IsoWagon = React.memo(IsoWagonImpl);
