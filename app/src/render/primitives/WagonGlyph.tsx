/**
 * Small standalone wagon drawing for RN HUD chips (e.g. ObjectiveBar's
 * target-sequence chips) — NOT part of the yard board's `<Canvas>`. Renders
 * its own tiny `<Canvas>` at exactly `{width, height}` with a transparent
 * background, so a UI component can drop it into a flex layout like any
 * other small view.
 *
 * Reuses the exact same silhouette builders and `<Shell>`/`<Bogies>`
 * rendering as `IsoWagon.tsx` (both now live in `wagonShell.tsx`) — this
 * file adds nothing but the palette resolution, the small-glyph bogie
 * cutoff, and a subtle light rim so a dark livery (the near-black
 * `cisterna` tanker) still separates from a dark HUD background. It
 * deliberately does NOT draw: the label badge (the HUD chip draws its own,
 * larger, letter on top), a selection halo (chips are never "selected"),
 * or any `BlurMask` (up to ~8 of these can be on screen at once, alongside
 * the animated board, so every draw call here is unconditional/cheap).
 */

import React, { useMemo } from 'react';
import { Canvas, Group, Path, RoundedRect } from '@shopify/react-native-skia';

import { isoHardware, type TimeOfDay } from '../../../design/tokens';
import { usePalette } from '../iso/timeOfDay';
import { Bogies, Shell, balastoPath, buildCisternaGeom, cubiertoPath, gondolaPath, tolvaPath, wagonKindFor } from './wagonShell';

export interface WagonGlyphProps {
  /** Wagon label, e.g. "A" — selects the shell via the existing wagonKindFor(). */
  label: string;
  /** Exact size of the rendered glyph in dp. The component renders its own
   *  <Canvas> of precisely this size and draws nothing outside it. */
  width: number;
  height: number;
  /** Pins a lighting pass; omit/null to follow the stored preference. */
  timeOfDay?: TimeOfDay | null;
}

/**
 * Below this height the bogie bar/wheel geometry hits its own minimum-size
 * floors (`Bogies`' `wheelR = max(1.6, h*0.058)`, `barH = max(2, h*0.11)`)
 * hard enough that it stops reading as "wheels" and becomes an indistinct
 * dark smudge along the bottom edge — worse than not drawing it at all at
 * chip scale. Tested by reasoning against the ~34×24dp glyph size named in
 * the brief: at h=24 the wheel radius is already floor-clamped to 1.6dp (a
 * ~3.2dp dot), so bogies are dropped there; they're kept from h=28 up,
 * where the radius (1.62dp) and bar height (3.08dp) are still small but
 * legible as a running-gear band under the body.
 */
const MIN_HEIGHT_FOR_BOGIES = 28;

function WagonGlyphImpl({ label, width: w, height: h, timeOfDay }: WagonGlyphProps) {
  const palette = usePalette(timeOfDay);
  const kind = wagonKindFor(label);
  const mat = palette.wagons[kind];
  const edge = palette.key === 'noche' ? isoHardware.bodyEdgeNight : isoHardware.bodyEdge;

  // Same small-size gate as IsoWagon.tsx: drops only scattered small details
  // (see wagonShell.tsx) — every kind stays distinguishable by silhouette +
  // main shading alone below this, which is exactly what a glyph this size
  // needs anyway.
  const detailed = w >= 46;

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

  const showBogies = h >= MIN_HEIGHT_FOR_BOGIES;

  return (
    <Canvas style={{ width: w, height: h }}>
      <Group>
        {showBogies && <Bogies w={w} h={h} />}
        <Shell kind={kind} w={w} h={h} mat={mat} edge={edge} detailed={detailed} silhouette={silhouette} cisterna={cisternaGeom} />

        {/* Subtle light rim traced on the same silhouette, always on (no
            BlurMask, one extra stroke draw call): a near-black livery (the
            tanker, see design/tokens.ts) drawn this small against a dark HUD
            background needs SOME light contour to read as a shape at all —
            the fix belongs here, not in the yard livery, since the yard
            board always has ballast/sky behind a car, never a plain dark
            panel. Harmless on lighter liveries too — just a faint highlight
            edge, consistent with the cartoon ink-outline convention. */}
        {silhouette && <Path path={silhouette} style="stroke" strokeWidth={1} color={isoHardware.rimLight} />}
        {cisternaGeom && (
          <Group>
            <RoundedRect
              x={cisternaGeom.tank.x}
              y={cisternaGeom.tank.y}
              width={cisternaGeom.tank.width}
              height={cisternaGeom.tank.height}
              r={cisternaGeom.tank.r}
              style="stroke"
              strokeWidth={1}
              color={isoHardware.rimLight}
            />
            <Path path={cisternaGeom.sill} style="stroke" strokeWidth={1} color={isoHardware.rimLight} />
          </Group>
        )}
      </Group>
    </Canvas>
  );
}

export const WagonGlyph = React.memo(WagonGlyphImpl);
