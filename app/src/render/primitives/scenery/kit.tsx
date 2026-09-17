/**
 * The ~11-shape yard-scenery prop kit (design/scenery-spec.md §2.1).
 *
 * Every prop is drawn in LOCAL units — top-left at (0,0), footprint width
 * `w`, "feet" resting on `y = h` — the same convention `IsoWagon`/
 * `LocoButton` already use (DECISIONES §11). That lets one component serve
 * BOTH zones the recipe system places props in:
 *
 *   Zone A (sky band): the caller wraps it in a `transform` that translates
 *   to the slot's screen position and applies NON-UNIFORM `scaleX`/`scaleY`
 *   (the reference band's own `sx`/`sy`, exactly like `IsoSky`'s tower/gantry
 *   Rects) — see `IsoScenery.tsx`'s `SkySlotProp`.
 *
 *   Zone B (foreground apron): the caller billboards it — UNIFORM
 *   `camera.depthScaleAt(v)` scale, centred horizontally, feet on the rail —
 *   exactly like `ShuntingBoard.tsx`'s `Billboarded` helper for wagons/locos.
 *   See `IsoScenery.tsx`'s `ForegroundBillboard`.
 *
 * Flat two/three-tone vector shapes only, ≤6 Skia primitives each, no
 * gradients (the whole-canvas `atmosphere` pass already unifies lighting —
 * see scenery-spec.md §4), no `BlurMask` (none of this is ever
 * selected/active — DECISIONES §11). Every component is `React.memo`; none
 * touch a Reanimated `SharedValue` per frame except the lamp post's night
 * glow, which reads an already-shared derived opacity passed in as a prop
 * (see `useTwinkle`) rather than owning its own animation loop.
 */

import React, { useMemo } from 'react';
import { Circle, Group, Path, Rect, RoundedRect } from '@shopify/react-native-skia';
import type { DerivedValue } from 'react-native-reanimated';

import { withAlpha } from '../../../../design/tokens';

// ─────────────────────────── Always-on constants ───────────────────────────

/**
 * Fence line: a thin rail plus a short-dash "chain-link" stroke over it,
 * drawn full-width just above the horizon in every section (scenery-spec.md
 * §2.1's second constant). Screen-space (Zone A only — a fence never stands
 * in the foreground apron).
 */
export interface FenceLineProps {
  width: number;
  y0: number;
  y1: number;
  color: string;
}

function FenceLineImpl({ width, y0, y1, color }: FenceLineProps) {
  const postCount = Math.max(2, Math.round(width / 34));
  const posts = useMemo(
    () => Array.from({ length: postCount }, (_, i) => (i / (postCount - 1)) * width),
    [postCount, width]
  );
  const railH = Math.max(1, (y1 - y0) * 0.14);
  return (
    <Group color={color} opacity={0.8}>
      <Rect x={0} y={y0} width={width} height={railH} />
      <Rect x={0} y={y1 - railH} width={width} height={railH} />
      {posts.map((x, i) => (
        <Rect key={i} x={x - railH / 2} y={y0} width={railH} height={y1 - y0} />
      ))}
    </Group>
  );
}
export const FenceLine = React.memo(FenceLineImpl);

// ─────────────────────────── Kit primitives ───────────────────────────

export interface KitProps {
  w: number;
  h: number;
  color: string;
}

/** Taller/squarer riff on the existing water tower — control cab on legs. */
function ControlTowerImpl({ w, h, color, lampLight, night }: KitProps & { lampLight: string | null; night: boolean }) {
  const legW = w * 0.3;
  const cabH = h * 0.34;
  const legH = h - cabH;
  const glazeH = cabH * 0.32;
  return (
    <Group>
      <Group color={color}>
        <Rect x={(w - legW) / 2} y={cabH} width={legW} height={legH} />
        <Rect x={0} y={0} width={w} height={cabH} />
        <Rect x={w * 0.46} y={-h * 0.16} width={Math.max(1, w * 0.07)} height={h * 0.16} />
      </Group>
      {lampLight && (
        <Group color={lampLight}>
          {night ? (
            <Group>
              <Circle cx={w * 0.24} cy={cabH * 0.5} r={Math.max(1, glazeH * 0.4)} />
              <Circle cx={w * 0.5} cy={cabH * 0.5} r={Math.max(1, glazeH * 0.4)} />
              <Circle cx={w * 0.76} cy={cabH * 0.5} r={Math.max(1, glazeH * 0.4)} />
            </Group>
          ) : (
            <Rect x={w * 0.12} y={cabH * 0.32} width={w * 0.76} height={glazeH} opacity={0.55} />
          )}
        </Group>
      )}
    </Group>
  );
}
export const ControlTower = React.memo(ControlTowerImpl);

/** A long shed with 1–3 roller doors and a thin roof line. */
export interface WarehouseProps extends KitProps {
  doors: 1 | 2 | 3;
  lampLight: string | null;
  night: boolean;
}
function WarehouseImpl({ w, h, color, doors, lampLight, night }: WarehouseProps) {
  const bodyY = h * 0.22;
  const doorW = w / (doors * 2.2);
  const doorH = h * 0.56;
  const gap = (w - doors * doorW) / (doors + 1);
  // Never light every door at night — "someone's working late", not a grid:
  // 2 of 3 when there are three, otherwise just the first.
  const litDoors = night ? (doors === 3 ? [0, 2] : [0]) : [];
  return (
    <Group>
      <Group color={color}>
        <Rect x={-w * 0.02} y={bodyY - h * 0.05} width={w * 1.04} height={h * 0.06} />
        <Rect x={0} y={bodyY} width={w} height={h - bodyY} />
      </Group>
      {Array.from({ length: doors }).map((_, i) => {
        const x = gap + i * (doorW + gap);
        return (
          <Rect
            key={i}
            x={x}
            y={h - doorH}
            width={doorW}
            height={doorH}
            color="rgba(0,0,0,0.32)"
          />
        );
      })}
      {lampLight &&
        litDoors.map((i) => {
          const x = gap + i * (doorW + gap) + doorW / 2;
          return <Circle key={i} cx={x} cy={h - doorH * 0.4} r={Math.max(1, doorW * 0.14)} color={lampLight} />;
        })}
    </Group>
  );
}
export const Warehouse = React.memo(WarehouseImpl);

/** 2–3 stacked/offset shipping containers in fixed absolute hues. */
export interface ContainerStackProps {
  w: number;
  h: number;
  count: 2 | 3;
  tall?: boolean;
  hues: readonly string[];
}
function ContainerStackImpl({ w, h, count, tall, hues }: ContainerStackProps) {
  const gap = w * 0.06;
  const boxW = (w - gap * (count - 1)) / count;
  const rowH = tall ? h * 0.42 : h * 0.62;
  const boxes = Array.from({ length: count }, (_, i) => ({
    x: i * (boxW + gap),
    y: h - rowH,
    w: boxW,
    h: rowH,
    color: hues[i % hues.length],
  }));
  const topBox = tall
    ? { x: boxW * 0.35, y: h - rowH - rowH * 0.85, w: boxW * 0.9, h: rowH * 0.85, color: hues[(count + 1) % hues.length] }
    : null;
  return (
    <Group>
      {boxes.map((b, i) => (
        <Group key={i}>
          <RoundedRect x={b.x} y={b.y} width={b.w} height={b.h} r={1.5} color={b.color} />
          <Rect x={b.x + b.w * 0.08} y={b.y + b.h * 0.1} width={b.w * 0.84} height={Math.max(1, b.h * 0.08)} color="rgba(255,255,255,0.22)" />
        </Group>
      ))}
      {topBox && (
        <Group>
          <RoundedRect x={topBox.x} y={topBox.y} width={topBox.w} height={topBox.h} r={1.5} color={topBox.color} />
          <Rect
            x={topBox.x + topBox.w * 0.08}
            y={topBox.y + topBox.h * 0.1}
            width={topBox.w * 0.84}
            height={Math.max(1, topBox.h * 0.1)}
            color="rgba(255,255,255,0.22)"
          />
        </Group>
      )}
    </Group>
  );
}
export const ContainerStack = React.memo(ContainerStackImpl);

/** Two legs, a spanning beam, and a hanging cable — silhouette only, never lit. */
function GantryCraneImpl({ w, h, color }: KitProps) {
  const legW = Math.max(2, w * 0.08);
  const beamH = Math.max(2, h * 0.12);
  const cablePath = useMemo(() => `M ${w * 0.5},${beamH} L ${w * 0.5},${h * 0.55}`, [w, h, beamH]);
  return (
    <Group color={color}>
      <Rect x={-w * 0.04} y={0} width={w * 1.08} height={beamH} />
      <Rect x={0} y={beamH} width={legW} height={h - beamH} />
      <Rect x={w - legW} y={beamH} width={legW} height={h - beamH} />
      <Path path={cablePath} style="stroke" strokeWidth={Math.max(1, w * 0.015)} color={color} />
    </Group>
  );
}
export const GantryCrane = React.memo(GantryCraneImpl);

/**
 * Twin-head lamp post. Pole + heads are always the silhouette `color`; the
 * night-only glow reuses the active palette's `lampLight` token (never a
 * hardcoded hex — see the "use design tokens for every colour" rule) tinted
 * to a soft wash via `withAlpha`, pulsing on `glowOpacity` (the sky band's
 * shared twinkle — see `useTwinkle`).
 */
export interface LampPostProps extends KitProps {
  night: boolean;
  /** Night-only glow tint — omitted (or null) on passes with no lampLight token. */
  lampLight?: string | null;
  glowOpacity?: DerivedValue<number> | number;
}
function LampPostImpl({ w, h, color, night, lampLight, glowOpacity }: LampPostProps) {
  const poleW = Math.max(1, w * 0.1);
  const headR = w * 0.22;
  const glowColor = useMemo(() => (lampLight ? withAlpha(lampLight, 0.35) : 'rgba(255,217,166,0.35)'), [lampLight]);
  return (
    <Group>
      <Rect x={(w - poleW) / 2} y={h * 0.08} width={poleW} height={h * 0.92} color={color} />
      <Rect x={w * 0.12} y={h * 0.04} width={w * 0.76} height={Math.max(1, h * 0.05)} color={color} />
      <Circle cx={w * 0.24} cy={h * 0.08} r={headR * 0.55} color={color} />
      <Circle cx={w * 0.76} cy={h * 0.08} r={headR * 0.55} color={color} />
      {night && (
        <Group opacity={glowOpacity ?? 1}>
          <Circle cx={w * 0.24} cy={h * 0.08} r={headR} color={glowColor} />
          <Circle cx={w * 0.76} cy={h * 0.08} r={headR} color={glowColor} />
        </Group>
      )}
    </Group>
  );
}
export const LampPost = React.memo(LampPostImpl);

/** Smallest foreground footprint — a plain cabinet with a vent line. */
function UtilityCabinetImpl({ w, h, color }: KitProps) {
  return (
    <Group color={color}>
      <Rect x={0} y={h * 0.18} width={w} height={h * 0.82} />
      <Rect x={w * 0.15} y={h * 0.3} width={w * 0.7} height={Math.max(1, h * 0.05)} opacity={0.5} />
    </Group>
  );
}
export const UtilityCabinet = React.memo(UtilityCabinetImpl);

/** Pole + dark plate, optionally carrying an arrow (Clasificación's "sorting" wink). */
export interface SignagePostProps extends KitProps {
  arrow?: boolean;
}
function SignagePostImpl({ w, h, color, arrow }: SignagePostProps) {
  const poleW = Math.max(1, w * 0.12);
  const plateH = h * 0.32;
  const arrowPath = useMemo(
    () => `M ${w * 0.22},${plateH * 0.5} L ${w * 0.68},${plateH * 0.22} L ${w * 0.68},${plateH * 0.78} Z`,
    [w, plateH]
  );
  return (
    <Group>
      <Rect x={(w - poleW) / 2} y={plateH} width={poleW} height={h - plateH} color={color} />
      <Rect x={0} y={0} width={w} height={plateH} color={color} />
      {arrow && <Path path={arrowPath} color="rgba(255,255,255,0.7)" />}
    </Group>
  );
}
export const SignagePost = React.memo(SignagePostImpl);

/** 2–3 overlapping circles — cheapest foreground filler, plane-projected. */
export interface BushClumpProps {
  cx: number;
  cy: number;
  r: number;
  color: string;
}
function BushClumpImpl({ cx, cy, r, color }: BushClumpProps) {
  return (
    <Group color={color} opacity={0.85}>
      <Circle cx={cx - r * 0.55} cy={cy} r={r * 0.7} />
      <Circle cx={cx + r * 0.55} cy={cy} r={r * 0.68} />
      <Circle cx={cx} cy={cy - r * 0.3} r={r * 0.85} />
    </Group>
  );
}
export const BushClump = React.memo(BushClumpImpl);

/** Body + mast + two wheels — used exactly once (Sección 5), a treat. */
function ForkliftImpl({ w, h, color }: KitProps) {
  const wheelR = h * 0.14;
  return (
    <Group color={color}>
      <Rect x={0} y={h * 0.42} width={w * 0.72} height={h * 0.4} />
      <Rect x={w * 0.68} y={h * 0.1} width={w * 0.1} height={h * 0.72} />
      <Circle cx={w * 0.18} cy={h - wheelR * 0.6} r={wheelR} />
      <Circle cx={w * 0.56} cy={h - wheelR * 0.6} r={wheelR} />
    </Group>
  );
}
export const Forklift = React.memo(ForkliftImpl);
