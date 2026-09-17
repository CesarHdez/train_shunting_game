/**
 * Shared body-shell geometry + drawing for the 5 Patio de Maniobras wagon
 * kinds (cubierto, góndola, cisterna, tolva, balasto) and their wheel
 * bogies.
 *
 * Split out of IsoWagon.tsx so the exact same path builders and `<Shell>`/
 * `<Bogies>` rendering can be reused by BOTH:
 *  - `IsoWagon.tsx` — the full yard sprite (adds bogies, the label badge,
 *    the selection halo/stroke, a contact shadow), and
 *  - `WagonGlyph.tsx` — a small standalone HUD glyph (body + optional
 *    bogies only, no badge/halo/blur).
 *
 * Everything here is drawn in LOCAL units with the body's top-left at
 * (0,0) and the rail line at y = h — no projection awareness, no
 * per-frame work. See IsoWagon.tsx's file banner for the full design
 * rationale (design/wagon-art-spec.md + the tolva/cisterna follow-up
 * corrections).
 */

import React from 'react';
import { Circle, Group, Line, LinearGradient, Oval, Path, Rect, RoundedRect, vec } from '@shopify/react-native-skia';

import { isoCameraTokens, isoHardware, isoWagonOrder, type IsoWagonKind, type IsoWagonMaterial } from '../../../design/tokens';

export function wagonKindFor(label: string): IsoWagonKind {
  return isoWagonOrder[(label.charCodeAt(0) || 0) % isoWagonOrder.length];
}

// ── Silhouette builders (design/wagon-art-spec.md §1–3) ────────────────────
// Pure functions of (w, h), local units, top-left origin. Each is called
// once per render (memoized by the caller) and the resulting string is
// reused for the body fill, the ink outline, AND (in IsoWagon.tsx) the
// selection halo/stroke.

/** Boxcar: eave-stepped roof overhang + top-corner chamfers. */
export function cubiertoPath(w: number, h: number): string {
  return [
    `M ${0.04 * w},0`,
    `L ${0.96 * w},0`,
    `L ${w},${0.05 * h}`,
    `L ${w},${0.12 * h}`,
    `L ${0.985 * w},${0.16 * h}`,
    `L ${0.985 * w},${h}`,
    `L ${0.015 * w},${h}`,
    `L ${0.015 * w},${0.16 * h}`,
    `L 0,${0.12 * h}`,
    `L 0,${0.05 * h}`,
    'Z',
  ].join(' ');
}

/** Top slice of `cubiertoPath`, cut straight across at the eave — the roof cap. */
function cubiertoRoofPath(w: number, h: number): string {
  return [
    `M ${0.04 * w},0`,
    `L ${0.96 * w},0`,
    `L ${w},${0.05 * h}`,
    `L ${w},${0.12 * h}`,
    `L ${0.985 * w},${0.16 * h}`,
    `L ${0.015 * w},${0.16 * h}`,
    `L 0,${0.12 * h}`,
    `L 0,${0.05 * h}`,
    'Z',
  ].join(' ');
}

/** Gondola: jagged corner-post notches above the main top edge, tapered base. */
export function gondolaPath(w: number, h: number): string {
  return [
    `M ${0.02 * w},${0.14 * h}`,
    `L ${0.02 * w},${0.06 * h}`,
    `L ${0.11 * w},${0.06 * h}`,
    `L ${0.11 * w},${0.14 * h}`,
    `L ${0.89 * w},${0.14 * h}`,
    `L ${0.89 * w},${0.06 * h}`,
    `L ${0.98 * w},${0.06 * h}`,
    `L ${0.98 * w},${0.14 * h}`,
    `L ${0.94 * w},${h}`,
    `L ${0.06 * w},${h}`,
    'Z',
  ].join(' ');
}

/**
 * Covered cement hopper: near-vertical side walls (an earlier hourglass
 * pinch read as a martini glass and let the rail show through — rejected),
 * with only a mild inward taper in the bottom ~12% of the height, topped by
 * a low peaked roof + eave that distinguishes it from the boxcar's flat
 * roof. The body stops at 0.82h — short of the rail line — so the three
 * discharge gates (see `tolvaGatePath`/`tolvaGateBlockPath`) have local room
 * to hang below it, above the bogies, without the sprite exceeding y = h.
 */
export function tolvaPath(w: number, h: number): string {
  return [
    `M ${0.06 * w},${0.14 * h}`,
    `L ${0.06 * w},${0.7 * h}`,
    `L ${0.09 * w},${0.82 * h}`,
    `L ${0.91 * w},${0.82 * h}`,
    `L ${0.94 * w},${0.7 * h}`,
    `L ${0.94 * w},${0.14 * h}`,
    `L ${0.84 * w},${0.06 * h}`,
    `L ${0.66 * w},${0.02 * h}`,
    `L ${0.34 * w},${0.02 * h}`,
    `L ${0.16 * w},${0.06 * h}`,
    'Z',
  ].join(' ');
}

/** Low peaked-roof + eave cap for the cement hopper, cut across at the eave line. */
function tolvaRoofPath(w: number, h: number): string {
  return [
    `M ${0.06 * w},${0.14 * h}`,
    `L ${0.16 * w},${0.06 * h}`,
    `L ${0.34 * w},${0.02 * h}`,
    `L ${0.66 * w},${0.02 * h}`,
    `L ${0.84 * w},${0.06 * h}`,
    `L ${0.94 * w},${0.14 * h}`,
    'Z',
  ].join(' ');
}

/**
 * One discharge gate: a tapered chute hanging off the body's bottom edge
 * (0.82h) that necks down and flares slightly back out into a small gate
 * box — the defining "cement hopper" feature. Sits entirely between 0.82h
 * and 0.90h, comfortably above the bogie bar (`Bogies`' `barY` = h*0.923)
 * and the rail line at y = h.
 */
function tolvaGatePath(w: number, h: number, cx: number): string {
  const top = 0.82 * h;
  const neckY = 0.87 * h;
  const bottom = 0.9 * h;
  const topHalf = 0.045 * w;
  const neckHalf = 0.018 * w;
  const boxHalf = 0.03 * w;
  return [
    `M ${cx - topHalf},${top}`,
    `L ${cx + topHalf},${top}`,
    `L ${cx + neckHalf},${neckY}`,
    `L ${cx + boxHalf},${neckY}`,
    `L ${cx + boxHalf},${bottom}`,
    `L ${cx - boxHalf},${bottom}`,
    `L ${cx - neckHalf},${neckY}`,
    'Z',
  ].join(' ');
}

/**
 * Simplified gate for small render sizes: a plain block instead of the
 * tapered chute+box — cheaper and less alias-prone at small widths, but the
 * three gates are this kind's identifying feature and must degrade to
 * *something*, never disappear.
 */
function tolvaGateBlockPath(w: number, h: number, cx: number): string {
  const half = 0.03 * w;
  return `M ${cx - half},${0.82 * h} L ${cx + half},${0.82 * h} L ${cx + half},${0.9 * h} L ${cx - half},${0.9 * h} Z`;
}

/** Evenly spaced between the two bogies' inner edges (0.29w–0.71w gap). */
const TOLVA_GATE_CENTERS = [0.36, 0.5, 0.64] as const;

/** Ballast hopper: near-vertical "bathtub" walls, wedge taper only in the lower half. */
export function balastoPath(w: number, h: number): string {
  return [
    `M ${0.03 * w},${0.3 * h}`,
    `L ${0.03 * w},${0.06 * h}`,
    `L ${0.97 * w},${0.06 * h}`,
    `L ${0.97 * w},${0.3 * h}`,
    `L ${0.85 * w},${h}`,
    `L ${0.15 * w},${h}`,
    'Z',
  ].join(' ');
}

export interface CisternaGeom {
  tank: { x: number; y: number; width: number; height: number; r: number };
  sill: string;
  platformL: { x: number; y: number; width: number; height: number };
  platformR: { x: number; y: number; width: number; height: number };
}

/**
 * Tanker geometry as 4 separate primitives rather than one path (see
 * `Cisterna` below): the tank keeps the stadium-pill `RoundedRect`, and the
 * old full-height/width chassis rect is a narrow sill + two end platforms,
 * so the tank visibly overhangs its underframe.
 */
export function buildCisternaGeom(w: number, h: number): CisternaGeom {
  const domeX = w * 0.053;
  const domeY = h * 0.154;
  const domeW = w - domeX * 2;
  const domeH = h * 0.538;
  return {
    tank: { x: domeX, y: domeY, width: domeW, height: domeH, r: domeH / 2 },
    sill: `M ${0.16 * w},${0.62 * h} L ${0.84 * w},${0.62 * h} L ${0.78 * w},${h} L ${0.22 * w},${h} Z`,
    platformL: { x: 0, y: 0.66 * h, width: 0.11 * w, height: 0.22 * h },
    platformR: { x: 0.89 * w, y: 0.66 * h, width: 0.11 * w, height: 0.22 * h },
  };
}

export interface ShellProps {
  w: number;
  h: number;
  mat: IsoWagonMaterial;
  edge: string;
  /** `w >= 46` — gates the scattered-small interior details only, per kind. */
  detailed: boolean;
  /** Non-null for every kind except `cisterna` (see `CisternaGeom` instead). */
  silhouette: string | null;
  /** Non-null only for `cisterna`. */
  cisterna: CisternaGeom | null;
}

// ── Body shells ────────────────────────────────────────────────────────────

function Cubierto({ w, h, mat, edge, detailed, silhouette }: ShellProps) {
  const path = silhouette!;
  const roofPath = cubiertoRoofPath(w, h);
  return (
    <Group>
      <Path path={path}>
        <LinearGradient start={vec(0, 0)} end={vec(0, h)} colors={[mat.hi, mat.lo]} />
      </Path>
      {/* Roof cap — the eave overhang. */}
      <Path path={roofPath} color={mat.cap} />
      <Rect x={0.015 * w} y={0.18 * h} width={0.97 * w} height={0.09 * h} color={isoHardware.rimLight} />
      {/* Sliding door panel + handle. */}
      <Rect x={0.36 * w} y={0.24 * h} width={0.28 * w} height={0.6 * h} color={mat.inset} />
      <Rect
        x={0.36 * w}
        y={0.24 * h}
        width={0.28 * w}
        height={0.6 * h}
        style="stroke"
        strokeWidth={1}
        color="rgba(0,0,0,0.4)"
      />
      {detailed && (
        <Rect x={0.61 * w} y={0.5 * h} width={Math.max(1.5, w * 0.026)} height={0.1 * h} color="rgba(0,0,0,0.5)" />
      )}
      {/* Corner posts. */}
      <Line p1={vec(0.05 * w, 0.18 * h)} p2={vec(0.05 * w, 0.96 * h)} color="rgba(0,0,0,0.25)" strokeWidth={1} />
      <Line p1={vec(0.95 * w, 0.18 * h)} p2={vec(0.95 * w, 0.96 * h)} color="rgba(0,0,0,0.25)" strokeWidth={1} />
      {/* End ladder. */}
      {detailed &&
        [0.3, 0.5, 0.7].map((f, i) => (
          <Line key={i} p1={vec(0.9 * w, f * h)} p2={vec(0.96 * w, f * h)} color="rgba(0,0,0,0.35)" strokeWidth={1.2} />
        ))}
      {/* Tack/data board. */}
      {detailed && (
        <Group>
          <Rect x={0.06 * w} y={0.66 * h} width={0.12 * w} height={0.14 * h} color={mat.inset} opacity={0.5} />
          <Rect
            x={0.06 * w}
            y={0.66 * h}
            width={0.12 * w}
            height={0.14 * h}
            style="stroke"
            strokeWidth={0.75}
            color="rgba(0,0,0,0.3)"
          />
        </Group>
      )}
      <Path path={path} style="stroke" strokeWidth={1} color={edge} />
    </Group>
  );
}

function Gondola({ w, h, mat, edge, detailed, silhouette }: ShellProps) {
  const path = silhouette!;
  const wellX = 0.13 * w;
  const wellY = 0.3 * h;
  const wellW = 0.74 * w;
  const wellH = 0.55 * h;
  return (
    <Group>
      <Path path={path}>
        <LinearGradient start={vec(0, 0)} end={vec(0, h)} colors={[mat.hi, mat.lo]} />
      </Path>
      {/* Top rim cap + rim light. */}
      <Rect x={0.02 * w} y={0.14 * h} width={0.96 * w} height={Math.max(1.5, 0.04 * h)} color={mat.cap} />
      <Rect x={0.11 * w} y={0.18 * h} width={0.78 * w} height={0.1 * h} color={isoHardware.rimLight} />
      {/* Dark recessed open-top well + ribs. */}
      <Rect x={wellX} y={wellY} width={wellW} height={wellH} color={mat.inset} />
      {[0.3, 0.5, 0.7].map((f, i) => (
        <Line key={i} p1={vec(w * f, wellY)} p2={vec(w * f, wellY + wellH)} color="rgba(0,0,0,0.3)" strokeWidth={1} />
      ))}
      {/* Corner-post highlights. */}
      {detailed && (
        <Group>
          <Line p1={vec(0.065 * w, 0.07 * h)} p2={vec(0.065 * w, 0.13 * h)} color="rgba(255,255,255,0.15)" strokeWidth={1} />
          <Line p1={vec(0.935 * w, 0.07 * h)} p2={vec(0.935 * w, 0.13 * h)} color="rgba(255,255,255,0.15)" strokeWidth={1} />
        </Group>
      )}
      <Path path={path} style="stroke" strokeWidth={1} color={edge} />
    </Group>
  );
}

function Cisterna({ w, h, mat, edge, cisterna }: ShellProps) {
  const { tank, sill, platformL, platformR } = cisterna!;
  return (
    <Group>
      {/* Sill (replaces the old full-box chassis) + its top highlight. */}
      <Path path={sill} color={mat.lo} />
      <Path path={sill} style="stroke" strokeWidth={1} color={edge} />
      <Line p1={vec(0.16 * w, 0.62 * h)} p2={vec(0.84 * w, 0.62 * h)} color={isoHardware.rimLight} strokeWidth={1} />
      {/* End platforms. Rails use the light rim token rather than the dark
          `bogieBar` hardware color: now that the near-black tanker livery
          (see design/tokens.ts) can put `mat.lo` almost as dark as
          `bogieBar` itself, a dark-on-dark rail line would vanish — a light
          line reads as a rail highlight on every livery, dark or not. */}
      <Rect x={platformL.x} y={platformL.y} width={platformL.width} height={platformL.height} color={mat.lo} />
      <Rect
        x={platformL.x}
        y={platformL.y}
        width={platformL.width}
        height={platformL.height}
        style="stroke"
        strokeWidth={1}
        color={edge}
      />
      <Line
        p1={vec(platformL.x, platformL.y)}
        p2={vec(platformL.x + platformL.width, platformL.y)}
        color={isoHardware.rimLight}
        strokeWidth={1}
      />
      <Rect x={platformR.x} y={platformR.y} width={platformR.width} height={platformR.height} color={mat.lo} />
      <Rect
        x={platformR.x}
        y={platformR.y}
        width={platformR.width}
        height={platformR.height}
        style="stroke"
        strokeWidth={1}
        color={edge}
      />
      <Line
        p1={vec(platformR.x, platformR.y)}
        p2={vec(platformR.x + platformR.width, platformR.y)}
        color={isoHardware.rimLight}
        strokeWidth={1}
      />
      {/* Tank dome. Gradient endpoints (domeHi/domeLo) carry the "near black
          but still a cylinder" modeling — see design/tokens.ts's cisterna
          entries. */}
      <RoundedRect x={tank.x} y={tank.y} width={tank.width} height={tank.height} r={tank.r}>
        <LinearGradient
          start={vec(0, tank.y)}
          end={vec(0, tank.y + tank.height)}
          colors={[mat.domeHi ?? mat.hi, mat.domeLo ?? mat.lo]}
        />
      </RoundedRect>
      {/* Body bands: a light seam highlight rather than a translucent black
          overlay — a black-on-near-black band would be invisible now that
          the tank livery itself is near-black (see design/tokens.ts). Reads
          as a weld seam catching the same light the specular gleam below
          catches. */}
      {[0.34, 0.66].map((f, i) => (
        <Line
          key={i}
          p1={vec(tank.x + tank.width * f, tank.y + tank.height * 0.08)}
          p2={vec(tank.x + tank.width * f, tank.y + tank.height * 0.92)}
          color="rgba(255,255,255,0.14)"
          strokeWidth={Math.max(1, w * 0.02)}
        />
      ))}
      <Oval
        x={tank.x + tank.width * 0.1}
        y={tank.y + tank.height * 0.1}
        width={tank.width * 0.5}
        height={tank.height * 0.22}
        color="rgba(255,255,255,0.3)"
      />
      <RoundedRect x={tank.x} y={tank.y} width={tank.width} height={tank.height} r={tank.r} style="stroke" strokeWidth={1} color={edge} />
    </Group>
  );
}

function Tolva({ w, h, mat, edge, detailed, silhouette }: ShellProps) {
  const path = silhouette!;
  const roofPath = tolvaRoofPath(w, h);
  const gatePaths = TOLVA_GATE_CENTERS.map((cx) => (detailed ? tolvaGatePath(w, h, cx * w) : tolvaGateBlockPath(w, h, cx * w)));
  return (
    <Group>
      <Path path={path}>
        <LinearGradient start={vec(0, 0)} end={vec(0, h)} colors={[mat.hi, mat.lo]} />
      </Path>
      {/* Low peaked roof cap + rim light. */}
      <Path path={roofPath} color={mat.cap} />
      <Rect x={0.08 * w} y={0.16 * h} width={0.84 * w} height={0.1 * h} color={isoHardware.rimLight} />
      {/* Roof hatches, centered on the ridge (0.34w–0.66w). */}
      {detailed &&
        [0.38, 0.52].map((f, i) => (
          <Group key={i}>
            <Rect x={f * w} y={0.03 * h} width={0.1 * w} height={0.02 * h} color={mat.inset} opacity={0.5} />
            <Rect
              x={f * w}
              y={0.03 * h}
              width={0.1 * w}
              height={0.02 * h}
              style="stroke"
              strokeWidth={0.75}
              color="rgba(0,0,0,0.3)"
            />
          </Group>
        ))}
      {/* Three discharge gates hanging below the body between the two
          bogies — the cement hopper's defining feature. Tapered chute+box
          at normal sizes, a plain block at small sizes (see `detailed`) so
          the feature degrades instead of disappearing. */}
      {gatePaths.map((gatePath, i) => (
        <Path key={i} path={gatePath} color={isoHardware.bogieBar} />
      ))}
      <Path path={path} style="stroke" strokeWidth={1} color={edge} />
    </Group>
  );
}

function Balasto({ w, h, mat, edge, silhouette }: ShellProps) {
  const path = silhouette!;
  return (
    <Group>
      <Path path={path}>
        <LinearGradient start={vec(0, 0)} end={vec(0, h)} colors={[mat.hi, mat.lo]} />
      </Path>
      {/* Top rim + rim light. */}
      <Rect x={0.03 * w} y={0.06 * h} width={0.94 * w} height={Math.max(1.5, 0.06 * h)} color={mat.cap} />
      <Rect x={0.03 * w} y={0.11 * h} width={0.94 * w} height={0.09 * h} color={isoHardware.rimLight} />
      {/* Sloped ribs. */}
      <Line p1={vec(0.2 * w, 0.3 * h)} p2={vec(0.28 * w, h)} color="rgba(0,0,0,0.28)" strokeWidth={1} />
      <Line p1={vec(0.8 * w, 0.3 * h)} p2={vec(0.72 * w, h)} color="rgba(0,0,0,0.28)" strokeWidth={1} />
      {/* Centre discharge chute. */}
      <Rect
        x={w / 2 - Math.max(1, w * 0.013)}
        y={h * 0.577}
        width={Math.max(2, w * 0.026)}
        height={h * 0.269}
        color="rgba(0,0,0,0.5)"
      />
      <Path path={path} style="stroke" strokeWidth={1} color={edge} />
    </Group>
  );
}

function ShellImpl({ kind, ...rest }: ShellProps & { kind: IsoWagonKind }) {
  switch (kind) {
    case 'cubierto':
      return <Cubierto {...rest} />;
    case 'gondola':
      return <Gondola {...rest} />;
    case 'cisterna':
      return <Cisterna {...rest} />;
    case 'tolva':
      return <Tolva {...rest} />;
    default:
      return <Balasto {...rest} />;
  }
}
export const Shell = React.memo(ShellImpl);

/**
 * One bogie per end: a short dark truck bar flush with the body's bottom edge
 * and two wheels inset into it. The wheels' vertical centre lands just below
 * that edge — i.e. on the rail — which is the difference between a car that
 * sits on the track and one that floats above it.
 */
function BogiesImpl({ w, h }: { w: number; h: number }) {
  const barY = h * (1 - 0.077);
  const barH = Math.max(2, h * isoCameraTokens.bogieHeightRatio);
  const barW = w * 0.224;
  const inset = w * 0.066;
  const wheelR = Math.max(1.6, h * 0.058);
  const wheelCy = h * 1.019 - wheelR;
  const wheelXs = [w * 0.1316, w * 0.2368, w * (1 - 0.2368), w * (1 - 0.1316)];
  return (
    <Group>
      <RoundedRect x={inset} y={barY} width={barW} height={barH} r={barH * 0.4} color={isoHardware.bogieBar} />
      <RoundedRect
        x={w - inset - barW}
        y={barY}
        width={barW}
        height={barH}
        r={barH * 0.4}
        color={isoHardware.bogieBar}
      />
      {wheelXs.map((cx, i) => (
        <Group key={i}>
          <Circle cx={cx} cy={wheelCy} r={wheelR} color={isoHardware.wheel} />
          <Circle cx={cx} cy={wheelCy} r={wheelR} style="stroke" strokeWidth={1} color={isoHardware.wheelEdge} />
        </Group>
      ))}
    </Group>
  );
}
export const Bogies = React.memo(BogiesImpl);
