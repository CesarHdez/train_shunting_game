/**
 * SUPERSEDED by IsoWagon.tsx. This is the FLAT board's wagon (5 bodies on a
 * top-down rectangle). Nothing imports it since the isometric yard landed —
 * kept only as the reference port of ref/js/shunting/renderer.js `drawCar`.
 * Edit IsoWagon.tsx instead; changes here reach no screen.
 *
 * Patio de Maniobras wagon: one of 5 hand-drawn body styles selected by
 * `label.charCodeAt(0) % 5` (boxcar, hopper, gondola, tanker, container),
 * wheel bogies, label badge, and a pulsing cyan glow when selected.
 * Faithful port of ref/js/shunting/renderer.js `drawCar` + `_car*`.
 */

import React, { useEffect, useMemo } from 'react';
import {
  BlurMask,
  Circle,
  Group,
  Line,
  LinearGradient,
  Oval,
  Path,
  RadialGradient,
  Rect,
  RoundedRect,
  Text,
  vec,
} from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { colors, motion } from '../../../design/tokens';
import { useCarLabelFont } from './labelFont';

export interface ShuntingWagonProps {
  x: number;
  y: number;
  label: string;
  width: number;
  height: number;
  isSelected: boolean;
}

/** Common shape covering all 5 entries of `colors.wagonOrder` (each has extra, shape-specific optional fields). */
interface WagonMaterial {
  name: string;
  hi: string;
  lo: string;
  accent: string;
  roof?: string;
  rim?: string;
  band?: string;
  stripe?: string;
}

function materialFor(label: string): { idx: number; mat: WagonMaterial } {
  const idx = (label.charCodeAt(0) || 0) % colors.wagonOrder.length;
  return { idx, mat: colors.wagonOrder[idx] };
}

interface ShapeProps {
  bx: number;
  by: number;
  bw: number;
  bh: number;
  mat: WagonMaterial;
}

// ── Body shape sub-renderers (local box: bx,by,bw,bh) ──────────────────────

function Boxcar({ bx, by, bw, bh, mat }: ShapeProps) {
  const rivets = useMemo(() => {
    const out: number[] = [];
    for (let rx = bx + 8; rx < bx + bw - 6; rx += 9) out.push(rx);
    return out;
  }, [bx, bw]);
  return (
    <Group>
      <RoundedRect x={bx} y={by} width={bw} height={bh} r={2}>
        <LinearGradient start={vec(bx, by)} end={vec(bx, by + bh)} colors={[mat.hi, mat.lo]} />
      </RoundedRect>
      <RoundedRect x={bx} y={by} width={bw} height={5} r={2} color={mat.roof} />
      <Rect x={bx + 3} y={by + 5} width={12} height={bh - 7} color="rgba(0,0,0,0.14)" />
      <Rect x={bx + bw - 15} y={by + 5} width={12} height={bh - 7} color="rgba(0,0,0,0.14)" />
      <Rect x={bx + 17} y={by + 5} width={26} height={bh - 7} color="rgba(255,255,255,0.07)" />
      <Rect x={bx + 17} y={by + 5} width={26} height={bh - 7} style="stroke" strokeWidth={1} color="rgba(0,0,0,0.3)" />
      <Line p1={vec(bx + 30, by + 6)} p2={vec(bx + 30, by + bh - 2)} color="rgba(0,0,0,0.3)" strokeWidth={1} />
      <Rect x={bx} y={by} width={3} height={bh} color={mat.accent} />
      <Rect x={bx + bw - 3} y={by} width={3} height={bh} color={mat.accent} />
      {rivets.map((rx, i) => (
        <Circle key={i} cx={rx} cy={by + bh - 3} r={1} color="rgba(0,0,0,0.28)" />
      ))}
      <Rect x={bx + 3} y={by + 1} width={bw - 6} height={4} color="rgba(255,255,255,0.13)" />
    </Group>
  );
}

function Hopper({ bx, by, bw, bh, mat }: ShapeProps) {
  const sl = 8;
  // Memoized like Boxcar's `rivets`/ContainerCar's `corrugations` — WagonBody
  // is already React.memo'd so these only actually recompute when bx/by/bw/bh
  // change, but keeping the path-string work itself behind useMemo (rather
  // than recomputing inline on every render that DOES pass through) matches
  // the "wagon body Paths stay memoized" perf-pass rule for this file.
  const body = useMemo(
    () => `M ${bx},${by} L ${bx + bw},${by} L ${bx + bw - sl},${by + bh} L ${bx + sl},${by + bh} Z`,
    [bx, by, bw, bh]
  );
  const chuteXs = useMemo<[number, number][]>(
    () => [
      [bx + 16, bx + sl + (bw - sl * 2) * 0.27],
      [bx + bw / 2, bx + sl + (bw - sl * 2) * 0.5],
      [bx + bw - 16, bx + sl + (bw - sl * 2) * 0.73],
    ],
    [bx, bw]
  );
  return (
    <Group>
      <Path path={body}>
        <LinearGradient start={vec(bx, by)} end={vec(bx, by + bh)} colors={[mat.hi, mat.lo]} />
      </Path>
      <Rect x={bx + 7} y={by + 1} width={14} height={5} color="rgba(255,255,255,0.08)" />
      <Rect x={bx + 26} y={by + 1} width={14} height={5} color="rgba(255,255,255,0.08)" />
      <Rect x={bx + 7} y={by + 1} width={14} height={5} color={mat.accent} style="stroke" strokeWidth={1} />
      <Rect x={bx + 26} y={by + 1} width={14} height={5} color={mat.accent} style="stroke" strokeWidth={1} />
      {chuteXs.map(([tx2, bx2], i) => (
        <Line key={i} p1={vec(tx2, by + 6)} p2={vec(bx2, by + bh)} color="rgba(0,0,0,0.28)" strokeWidth={1.5} />
      ))}
      <Rect x={bx} y={by} width={bw} height={3} color={mat.rim} />
      <Rect x={bx + sl + 2} y={by + bh - 5} width={(bw - sl * 2) / 2 - 3} height={4} color="rgba(0,0,0,0.45)" />
      <Rect x={bx + bw / 2 + 1} y={by + bh - 5} width={(bw - sl * 2) / 2 - 3} height={4} color="rgba(0,0,0,0.45)" />
      <Rect x={bx + 2} y={by + 1} width={bw - 4} height={3} color="rgba(255,255,255,0.09)" />
    </Group>
  );
}

function Gondola({ bx, by, bw, bh, mat }: ShapeProps) {
  const wall = 5;
  return (
    <Group>
      <RoundedRect x={bx} y={by} width={bw} height={bh} r={2}>
        <LinearGradient start={vec(bx, by)} end={vec(bx, by + bh)} colors={[mat.hi, mat.lo]} />
      </RoundedRect>
      <Rect x={bx + wall} y={by + wall} width={bw - wall * 2} height={bh - wall * 2} color={mat.accent} />
      <Rect x={bx + wall} y={by + wall} width={bw - wall * 2} height={3} color="rgba(255,255,255,0.03)" />
      {[bx + 13, bx + 27, bx + bw - 13].map((rx, i) => (
        <Line key={i} p1={vec(rx, by)} p2={vec(rx, by + bh)} color="rgba(0,0,0,0.4)" strokeWidth={1} />
      ))}
      <Rect x={bx} y={by} width={bw} height={3} color={mat.rim} />
      <Rect x={bx} y={by} width={3} height={bh} color={mat.rim} />
      <Rect x={bx + bw - 3} y={by} width={3} height={bh} color={mat.rim} />
    </Group>
  );
}

function Tanker({ bx, by, bw, bh, mat }: ShapeProps) {
  const cx = bx + bw / 2;
  const cy = by + bh * 0.44;
  const rx = bw / 2 - 2;
  const ry = bh * 0.42;
  const ellipseClip = useMemo(
    () => `M ${cx - rx},${cy} A ${rx},${ry} 0 1 0 ${cx + rx},${cy} A ${rx},${ry} 0 1 0 ${cx - rx},${cy} Z`,
    [cx, cy, rx, ry]
  );
  return (
    <Group>
      <Rect x={bx} y={by + bh - 5} width={bw} height={5} color="#141414" />
      <Rect x={bx} y={by + Math.round(bh * 0.4)} width={5} height={Math.round(bh * 0.5)} color="#1e1e1e" />
      <Rect x={bx + bw - 5} y={by + Math.round(bh * 0.4)} width={5} height={Math.round(bh * 0.5)} color="#1e1e1e" />
      <Oval x={cx - rx} y={cy - ry} width={rx * 2} height={ry * 2}>
        <RadialGradient c={vec(cx - rx * 0.3, cy - ry * 0.3)} r={rx} colors={[mat.hi, mat.lo, '#0e0e0e']} positions={[0, 0.6, 1]} />
      </Oval>
      <Oval x={cx - rx} y={cy - ry} width={rx * 2} height={ry * 2} style="stroke" strokeWidth={1.5} color="rgba(0,0,0,0.55)" />
      <Group clip={ellipseClip}>
        {[cx - rx * 0.35, cx + rx * 0.35].map((bxv, i) => (
          <Line key={i} p1={vec(bxv, cy - ry)} p2={vec(bxv, cy + ry)} color={mat.band ?? '#1a1a1a'} strokeWidth={2} />
        ))}
      </Group>
      <Line p1={vec(bx + 7, cy - ry + 2)} p2={vec(bx + bw - 7, cy - ry + 2)} color="rgba(255,255,255,0.18)" strokeWidth={1} />
      <Circle cx={cx - rx * 0.28} cy={cy - ry * 0.32} r={rx * 0.3} color="rgba(255,255,255,0.16)" />
    </Group>
  );
}

function ContainerCar({ bx, by, bw, bh, mat }: ShapeProps) {
  const corrugations = useMemo(() => {
    const out: number[] = [];
    for (let rx = bx + 6; rx < bx + bw - 3; rx += 5) out.push(rx);
    return out;
  }, [bx, bw]);
  const corners: [number, number][] = [
    [bx, by],
    [bx + bw - 5, by],
    [bx, by + bh - 5],
    [bx + bw - 5, by + bh - 5],
  ];
  return (
    <Group>
      <RoundedRect x={bx} y={by} width={bw} height={bh} r={2}>
        <LinearGradient start={vec(bx, by)} end={vec(bx, by + bh)} colors={[mat.hi, mat.lo]} />
      </RoundedRect>
      {corrugations.map((rx, i) => (
        <Line key={i} p1={vec(rx, by + 2)} p2={vec(rx, by + bh - 2)} color="rgba(0,0,0,0.16)" strokeWidth={1} />
      ))}
      <Rect x={bx + 2} y={by + Math.round(bh * 0.58)} width={bw - 4} height={3} color={mat.stripe ?? '#e8c000'} />
      {corners.map(([fx, fy], i) => (
        <Group key={i}>
          <Rect x={fx} y={fy} width={5} height={5} color="#111111" />
          <Rect x={fx + 1} y={fy + 1} width={3} height={3} color="#333333" />
        </Group>
      ))}
      <Line p1={vec(bx + bw - 8, by + 3)} p2={vec(bx + bw - 8, by + bh - 3)} color="rgba(0,0,0,0.38)" strokeWidth={1.5} />
      <Line p1={vec(bx + bw - 5, by + 3)} p2={vec(bx + bw - 5, by + bh - 3)} color="rgba(0,0,0,0.38)" strokeWidth={1.5} />
      <Rect x={bx + 2} y={by + 1} width={bw - 4} height={4} color="rgba(255,255,255,0.12)" />
    </Group>
  );
}

function WagonBodyImpl({ shapeIdx, ...rest }: ShapeProps & { shapeIdx: number }) {
  switch (shapeIdx) {
    case 0:
      return <Boxcar {...rest} />;
    case 1:
      return <Hopper {...rest} />;
    case 2:
      return <Gondola {...rest} />;
    case 3:
      return <Tanker {...rest} />;
    default:
      return <ContainerCar {...rest} />;
  }
}
const WagonBody = React.memo(WagonBodyImpl);

function WheelBogies({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const bcy = y + h - 7;
  const wR = 4;
  return (
    <Group>
      <Rect x={x + 4} y={bcy - 3} width={17} height={6} color="#181818" />
      <Rect x={x + w - 21} y={bcy - 3} width={17} height={6} color="#181818" />
      {[x + 7, x + 15, x + w - 21, x + w - 13].map((wx, i) => (
        <Group key={i}>
          <Circle cx={wx} cy={bcy} r={wR} color="#252525" />
          <Circle cx={wx} cy={bcy} r={wR - 1.2} color="#3a3a3a" />
          <Circle cx={wx} cy={bcy} r={1.2} color="#777777" />
        </Group>
      ))}
      <Line p1={vec(x + 7, bcy)} p2={vec(x + 15, bcy)} color="#2a2a2a" strokeWidth={1.5} />
      <Line p1={vec(x + w - 21, bcy)} p2={vec(x + w - 13, bcy)} color="#2a2a2a" strokeWidth={1.5} />
    </Group>
  );
}

function ShuntingWagonImpl({ x, y, label, width: w, height: h, isSelected }: ShuntingWagonProps) {
  const { idx: shapeIdx, mat } = materialFor(label);
  const bx = x;
  const by = y + 1;
  const bw = w;
  const bh = h - 13;

  const font = useCarLabelFont(12, '700');
  const labelWidth = useMemo(() => {
    if (!font) return label.length * 7;
    try {
      return font.measureText(label).width;
    } catch {
      return label.length * 7;
    }
  }, [font, label]);

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
  const glowBlur = useDerivedValue(() => 8 + pulse.value * 7, [pulse]);

  const lx = bx + bw / 2;
  const ly = by + bh / 2 + 5;

  return (
    <Group>
      {/* Soft contact shadow for a touch of ground depth, matching LocoButton.
          Unblurred: a board can have dozens of wagons on screen at once, and
          the whole Canvas repaints every frame during any travel animation
          (Skia recomposits the full surface, not just the animated node) —
          a BlurMask on every single wagon's shadow was the single biggest
          per-frame Skia cost on the board. A flat low-opacity shape reads
          nearly identically at this size; the selection glow just below
          stays blurred since it's gated to (at most a few) selected cars. */}
      <Oval x={x + w * 0.05} y={y + h - 2} width={w * 0.9} height={5} color="rgba(0,0,0,0.3)" />
      {isSelected && (
        <RoundedRect x={bx} y={by} width={bw} height={bh} r={2} color={colors.carGlow} opacity={0.55}>
          <BlurMask blur={glowBlur} style="normal" />
        </RoundedRect>
      )}
      <WheelBogies x={x} y={y} w={w} h={h} />
      <WagonBody shapeIdx={shapeIdx} bx={bx} by={by} bw={bw} bh={bh} mat={mat} />
      <RoundedRect
        x={bx}
        y={by}
        width={bw}
        height={bh}
        r={2}
        style="stroke"
        strokeWidth={isSelected ? 2 : 1}
        color={isSelected ? colors.carGlow : 'rgba(0,0,0,0.55)'}
      />
      <RoundedRect x={lx - 7} y={ly - 9} width={14} height={12} r={3} color="rgba(0,0,0,0.58)" />
      {font && <Text x={lx - labelWidth / 2} y={ly + 4} text={label} font={font} color="#ffffff" />}
    </Group>
  );
}

export const ShuntingWagon = React.memo(ShuntingWagonImpl);
