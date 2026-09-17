/**
 * Patio de Maniobras Skia board — implements ShuntingBoardProps from
 * boardContract.ts. Pure view + hit-testing: draws `state`, tweens the
 * transition from `prevState` when one is supplied, and emits semantic taps.
 * Never calls the engine or mutates state.
 *
 * The yard is drawn as an isometric diorama in two passes:
 *
 *   GROUND  — one `<Group matrix={camera.matrix}>` holding the ballast,
 *             rails, throat, route line and row highlights, all still in the
 *             plane coordinates the layout produces. Skia applies the
 *             perspective; no geometry is pre-distorted.
 *   BILLBOARDS — locomotives, wagons and capacity badges, drawn UPRIGHT in
 *             screen space at their projected anchor and scaled by the
 *             camera's depth factor. Anything carrying text must live here:
 *             a glyph painted onto the tilted plane smears into noise.
 *
 * Billboards are emitted far row → near row so the near ones occlude, which
 * is also why layout.hitTest walks the tracks in reverse — see
 * layout/shuntingLayout.ts.
 */

import React, { useCallback, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { ScrollView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Canvas, Fill, Group, LinearGradient, Rect, RadialGradient, vec } from '@shopify/react-native-skia';
import { runOnJS, useDerivedValue, type SharedValue } from 'react-native-reanimated';

import type { ShuntingBoardProps } from './boardContract';
import type { TimeOfDay, TimeOfDayPalette } from '../../design/tokens';
import { computeShuntingLayout, type Billboard, type ShuntingLayout } from './layout/shuntingLayout';
import { depthScaleWithMatrix, projectWithMatrix } from './iso/isoCamera';
import { usePalette } from './iso/timeOfDay';
import { useShuntingAnimation } from './motion/useShuntingAnimation';
import type { ShuntingMoveAnim } from './motion/detectMove';
import { pushedPositionAtT, railPositionAtT, type ShuntRailPlan } from './motion/railPath';
import { IsoSky } from './primitives/IsoSky';
import { IsoTrackBed } from './primitives/IsoTrackBed';
import { IsoWagon } from './primitives/IsoWagon';
import { LocoButton } from './primitives/LocoButton';
import { RouteHighlight } from './primitives/RouteHighlight';
import { YardText } from './primitives/YardText';
import { Confetti } from './primitives/Confetti';

// ─────────────────────────── Billboarding ───────────────────────────

/**
 * Stands a sprite up at a point on the plane: the sprite is drawn in local
 * units with its top-left at (0,0), and this places its BOTTOM-CENTRE on the
 * rail at (u,v) and scales it by how near that row is to the camera.
 *
 * The transform is [translate, scale] — matrix order means the scale is
 * applied to the local geometry first, so `translate` is already in screen
 * dp and the arithmetic below reads directly as "centre it, sit it on the
 * rail".
 */
function Billboarded({
  layout,
  bill,
  children,
}: {
  layout: ShuntingLayout;
  bill: Billboard;
  children: React.ReactNode;
}) {
  const { camera } = layout;
  const s = camera.depthScaleAt(bill.v);
  const p = camera.project(bill.u, bill.v);
  return (
    <Group
      transform={[{ translateX: p.x - (bill.width * s) / 2 }, { translateY: p.y - bill.height * s }, { scale: s }]}
    >
      {children}
    </Group>
  );
}

// ─────────────────────────── Ghost layer ───────────────────────────
//
// Rigid coupled-train switchback: every unit (locomotive + each car in the
// cut) shares the SAME rail plan (railPath.ts's ShuntRailPlan, built once per
// detected move in useShuntingAnimation) and evaluates its own plane position
// at the shared `progress` clock via `railPositionAtT`, passing only its own
// fixed rail offset behind the locomotive (`dSrc`/`dDst` — 0 for the
// locomotive itself). Because every unit reads the SAME phase breakpoints
// (f1/f2) and the SAME loco endpoints (qLocoSrc/qLocoDst/D1) off the SAME
// plan, the whole train pulls out through the throat, reverses at the node,
// and pushes into its destination row as one visually rigid consist with
// constant rail spacing — see useShuntingAnimation.ts's module doc comment
// for the full choreography writeup.
//
// The path is evaluated in PLANE space and projected per frame, so a ghost
// naturally shrinks as it runs out toward the far rows and grows coming back
// — the same depth scaling the static billboards get, just animated.

function useGhostTransform({
  railPlan,
  dSrc,
  dDst,
  matrix,
  baseScale,
  width,
  height,
  progress,
  settle,
}: {
  railPlan: ShuntRailPlan;
  dSrc: number;
  dDst: number;
  matrix: number[];
  baseScale: number;
  width: number;
  height: number;
  progress: SharedValue<number>;
  settle: SharedValue<number>;
}) {
  return useDerivedValue(() => {
    const t = Math.min(1, Math.max(0, progress.value));
    const pos = railPositionAtT(
      t,
      railPlan.srcRow,
      railPlan.dstRow,
      railPlan.qLocoSrc,
      railPlan.qLocoDst,
      dSrc,
      dDst,
      railPlan.D1,
      railPlan.f1,
      railPlan.f2
    );
    const p = projectWithMatrix(matrix, pos.x, pos.y);
    const s = depthScaleWithMatrix(matrix, baseScale, pos.y) * settle.value;
    return [{ translateX: p.x - (width * s) / 2 }, { translateY: p.y - height * s }, { scale: s }];
  }, [progress, settle, railPlan, dSrc, dDst, matrix, baseScale, width, height]);
}

function GhostCar({
  label,
  railPlan,
  dSrc,
  dDst,
  width,
  height,
  matrix,
  baseScale,
  progress,
  settle,
  palette,
  labelSize,
}: {
  label: string;
  railPlan: ShuntRailPlan;
  /** This car's fixed rail-arc offset behind the locomotive, at the source/destination end (see buildRailPlan). */
  dSrc: number;
  dDst: number;
  width: number;
  height: number;
  matrix: number[];
  baseScale: number;
  progress: SharedValue<number>;
  settle: SharedValue<number>;
  palette: TimeOfDayPalette;
  labelSize: number;
}) {
  const transform = useGhostTransform({ railPlan, dSrc, dDst, matrix, baseScale, width, height, progress, settle });
  return (
    <Group transform={transform}>
      <IsoWagon width={width} height={height} label={label} isSelected={false} palette={palette} labelSize={labelSize} />
    </Group>
  );
}

function GhostLoco({
  railPlan,
  width,
  height,
  facingRight,
  matrix,
  baseScale,
  progress,
  settle,
  palette,
}: {
  railPlan: ShuntRailPlan;
  width: number;
  height: number;
  facingRight: boolean;
  matrix: number[];
  baseScale: number;
  progress: SharedValue<number>;
  settle: SharedValue<number>;
  palette: TimeOfDayPalette;
}) {
  const transform = useGhostTransform({ railPlan, dSrc: 0, dDst: 0, matrix, baseScale, width, height, progress, settle });
  return (
    <Group transform={transform}>
      <LocoButton w={width} h={height} isActive facingRight={facingRight} palette={palette} />
    </Group>
  );
}

/**
 * A pre-existing destination-track car displaced by the arriving cut (see
 * detectMove.ts's `ShuntingPushedCar`): stands still at its pre-move slot
 * until the arriving cut's coupling unit reaches it, then rides along the
 * DESTINATION row only (never the throat — it was already on this track) in
 * lockstep with the cut's own advancement — see pushedPositionAtT's doc
 * comment in railPath.ts for exactly how `progress` maps to its position.
 */
function usePushedGhostTransform({
  railPlan,
  srcQ,
  dstQ,
  matrix,
  baseScale,
  width,
  height,
  progress,
  settle,
}: {
  railPlan: ShuntRailPlan;
  srcQ: number;
  dstQ: number;
  matrix: number[];
  baseScale: number;
  width: number;
  height: number;
  progress: SharedValue<number>;
  settle: SharedValue<number>;
}) {
  return useDerivedValue(() => {
    const t = Math.min(1, Math.max(0, progress.value));
    const pos = pushedPositionAtT(
      t,
      railPlan.dstRow,
      railPlan.qLocoSrc,
      railPlan.qLocoDst,
      railPlan.D1,
      railPlan.f1,
      railPlan.f2,
      railPlan.qLocoContact,
      srcQ,
      dstQ
    );
    const p = projectWithMatrix(matrix, pos.x, pos.y);
    const s = depthScaleWithMatrix(matrix, baseScale, pos.y) * settle.value;
    return [{ translateX: p.x - (width * s) / 2 }, { translateY: p.y - height * s }, { scale: s }];
  }, [progress, settle, railPlan, srcQ, dstQ, matrix, baseScale, width, height]);
}

function PushedGhostCar({
  label,
  railPlan,
  srcQ,
  dstQ,
  width,
  height,
  matrix,
  baseScale,
  progress,
  settle,
  palette,
  labelSize,
}: {
  label: string;
  railPlan: ShuntRailPlan;
  srcQ: number;
  dstQ: number;
  width: number;
  height: number;
  matrix: number[];
  baseScale: number;
  progress: SharedValue<number>;
  settle: SharedValue<number>;
  palette: TimeOfDayPalette;
  labelSize: number;
}) {
  const transform = usePushedGhostTransform({ railPlan, srcQ, dstQ, matrix, baseScale, width, height, progress, settle });
  return (
    <Group transform={transform}>
      <IsoWagon width={width} height={height} label={label} isSelected={false} palette={palette} labelSize={labelSize} />
    </Group>
  );
}

/** Green pulse on the destination row's ballast as the cut couples up. */
function CouplingFlash({
  layout,
  trackIdx,
  flash,
  palette,
}: {
  layout: ShuntingLayout;
  trackIdx: number;
  flash: SharedValue<number>;
  palette: TimeOfDayPalette;
}) {
  const opacity = useDerivedValue(() => flash.value * 0.35, [flash]);
  const r = layout.markerRect(trackIdx, 'left');
  return <Rect x={r.x} y={r.y} width={r.width} height={r.height} color={palette.marker.edge} opacity={opacity} />;
}

function GhostLayer({
  move,
  railPlan,
  layout,
  tracks,
  progress,
  settle,
  palette,
  labelSize,
}: {
  move: ShuntingMoveAnim;
  railPlan: ShuntRailPlan;
  layout: ShuntingLayout;
  tracks: string[][];
  progress: SharedValue<number>;
  settle: SharedValue<number>;
  palette: TimeOfDayPalette;
  labelSize: number;
}) {
  const matrix = useMemo(() => [...layout.camera.matrix], [layout.camera]);
  const baseScale = layout.camera.scale;

  return (
    <Group>
      <GhostLoco
        railPlan={railPlan}
        width={layout.locoBodyWidth}
        height={layout.locoBodyHeight}
        facingRight={move.side === 'left'}
        matrix={matrix}
        baseScale={baseScale}
        progress={progress}
        settle={settle}
        palette={palette}
      />
      {move.cars.map((car, i) => (
        <GhostCar
          key={`${car.srcCol}-${car.label}`}
          label={tracks[move.dstTrack][car.dstCol] || car.label}
          railPlan={railPlan}
          dSrc={railPlan.carDSrc[i] ?? 0}
          dDst={railPlan.carDDst[i] ?? 0}
          width={layout.carBodyWidth}
          height={layout.carBodyHeight}
          matrix={matrix}
          baseScale={baseScale}
          progress={progress}
          settle={settle}
          palette={palette}
          labelSize={labelSize}
        />
      ))}
      {railPlan.pushedCars.map((pc, i) => (
        <PushedGhostCar
          key={`pushed-${i}-${pc.label}`}
          label={pc.label}
          railPlan={railPlan}
          srcQ={pc.srcQ}
          dstQ={pc.dstQ}
          width={layout.carBodyWidth}
          height={layout.carBodyHeight}
          matrix={matrix}
          baseScale={baseScale}
          progress={progress}
          settle={settle}
          palette={palette}
          labelSize={labelSize}
        />
      ))}
    </Group>
  );
}

// ─────────────────────────── Ground layer ───────────────────────────

/**
 * Ballast plane + the lamp-spill washes the night pass adds over it.
 *
 * Drawn wider and deeper than the yard's own plane box so its projected quad
 * bleeds past every canvas edge except the horizon: seeing the ground's own
 * side edges would turn the yard into a floating trapezoid. The far edge is
 * kept exactly at v = 0 so it meets the sky on the horizon line, and the
 * overdraw stays well short of v = (1+r)/q where the perspective divisor
 * would cross zero.
 */
const GROUND_BLEED_X = 0.55;
const GROUND_BLEED_V = 0.7;

function GroundPlane({ layout, palette }: { layout: ShuntingLayout; palette: TimeOfDayPalette }) {
  const { planeWidth, planeHeight } = layout.camera;
  const x0 = -planeWidth * GROUND_BLEED_X;
  const w = planeWidth * (1 + GROUND_BLEED_X * 2);
  const h = planeHeight * (1 + GROUND_BLEED_V);
  return (
    <Group>
      <Rect x={x0} y={0} width={w} height={h}>
        <RadialGradient
          c={vec(planeWidth / 2, 0)}
          r={planeWidth * 0.72}
          colors={[...palette.ground.colors]}
          positions={[...palette.ground.positions]}
        />
      </Rect>
      {palette.groundWashes.map((wash, i) => (
        <Rect key={i} x={x0} y={0} width={w} height={h}>
          <RadialGradient
            c={vec(wash.cx * planeWidth, wash.cy * planeHeight)}
            r={wash.r * planeWidth}
            colors={[wash.color, 'rgba(0,0,0,0)']}
            positions={[0, 1]}
          />
        </Rect>
      ))}
    </Group>
  );
}

/**
 * "Vía válida" clearance wedge: a bright-edged wash laid FLAT along a legal
 * target row. Kept on the plane rather than billboarded (unlike the badges)
 * because it carries no text and reading as a lit stretch of track is the
 * whole point — it's how the approved reference frames draw it too.
 */
function ClearanceWedge({
  layout,
  trackIdx,
  side,
  palette,
}: {
  layout: ShuntingLayout;
  trackIdx: number;
  side: 'left' | 'right';
  palette: TimeOfDayPalette;
}) {
  const r = layout.markerRect(trackIdx, side);
  const edgeW = Math.max(2, layout.rowHeight * 0.14);
  const edgeX = side === 'left' ? r.x : r.x + r.width - edgeW;
  return (
    <Group>
      <Rect x={r.x} y={r.y} width={r.width} height={r.height}>
        <LinearGradient
          start={vec(side === 'left' ? r.x : r.x + r.width, 0)}
          end={vec(side === 'left' ? r.x + r.width : r.x, 0)}
          colors={[palette.marker.fillHi, palette.marker.fillLo]}
        />
      </Rect>
      <Rect x={edgeX} y={r.y} width={edgeW} height={r.height} color={palette.marker.edge} />
    </Group>
  );
}

// ─────────────────────────── Billboard row ───────────────────────────

function ShuntingRow({
  layout,
  trackIdx,
  cars,
  hasRightLoco,
  locoTrack,
  rightLocoTrack,
  selectedCars,
  rightSelectedCars,
  leftCutSelected,
  rightCutSelected,
  hideLeftLoco,
  hideRightLoco,
  hiddenCols,
  pushedCount,
  capacity,
  palette,
  labelSize,
  badgeSize,
}: {
  layout: ShuntingLayout;
  trackIdx: number;
  cars: string[];
  hasRightLoco: boolean;
  locoTrack: number;
  rightLocoTrack: number;
  selectedCars: Set<number>;
  rightSelectedCars: Set<number>;
  /** True while a cut is picked up on that side (any track) — an idle loco
   *  slot on this track is then a legal drop target, so its ghost renders a
   *  touch more visible. See LocoButton's `isValidTarget`. */
  leftCutSelected: boolean;
  rightCutSelected: boolean;
  /** Suppresses the ENTIRE left loco slot while a left-side move's ghost is
   *  in flight to/from this track, so the row never doubles up with GhostLoco. */
  hideLeftLoco: boolean;
  hideRightLoco: boolean;
  /** Car columns to hide while their arrival ghost (or push) is still in flight. */
  hiddenCols: Set<number>;
  /** Cars hidden by `hiddenCols` that are pre-existing (not newly arriving) and so must still count toward capacity — see ShuntingBoard's pushedCountByTrack. */
  pushedCount: number;
  capacity: number;
  palette: TimeOfDayPalette;
  labelSize: number;
  badgeSize: number;
}) {
  // Exclude cars still hidden-in-transit so the counter doesn't jump to the
  // final count before the wagon is visibly there — but pushed cars are
  // already really on this track (merely mid-shift), so add them back in.
  const occupied = cars.filter((c, j) => c !== '' && !hiddenCols.has(j)).length + pushedCount;
  const full = occupied >= capacity;
  const badge = layout.badgeAnchor(trackIdx);
  const badgeScale = layout.camera.depthScaleAt(badge.v);
  const badgePoint = layout.camera.project(badge.u, badge.v);

  return (
    <Group>
      {!hideLeftLoco &&
        (() => {
          const isActiveHere = locoTrack === trackIdx;
          return (
            <Billboarded layout={layout} bill={layout.locoBillboard(trackIdx, 'left')}>
              <LocoButton
                w={layout.locoBodyWidth}
                h={layout.locoBodyHeight}
                isActive={isActiveHere}
                facingRight
                palette={palette}
                isValidTarget={!isActiveHere && leftCutSelected}
              />
            </Billboarded>
          );
        })()}

      {cars.map((label, j) => {
        if (label === '' || hiddenCols.has(j)) return null;
        const isSelected = selectedCars.has(j) || rightSelectedCars.has(j);
        return (
          <Billboarded key={j} layout={layout} bill={layout.carBillboard(trackIdx, j)}>
            <IsoWagon
              width={layout.carBodyWidth}
              height={layout.carBodyHeight}
              label={label}
              isSelected={isSelected}
              palette={palette}
              labelSize={labelSize}
            />
          </Billboarded>
        );
      })}

      {hasRightLoco
        ? !hideRightLoco &&
          (() => {
            const isActiveHere = rightLocoTrack === trackIdx;
            return (
              <Billboarded layout={layout} bill={layout.locoBillboard(trackIdx, 'right')}>
                <LocoButton
                  w={layout.locoBodyWidth}
                  h={layout.locoBodyHeight}
                  isActive={isActiveHere}
                  facingRight={false}
                  palette={palette}
                  isValidTarget={!isActiveHere && rightCutSelected}
                />
              </Billboarded>
            );
          })()
        : (
            // Billboarded, NOT laid on the plane: text drawn onto the tilted
            // ground stretches into an unreadable smear. The baseline is
            // lifted clear of the rail so the digits sit beside the track
            // rather than on it.
            <Group
              transform={[
                { translateX: badgePoint.x },
                { translateY: badgePoint.y - (layout.ballastWidth * 0.5 + badgeSize * 0.1) * badgeScale },
                { scale: badgeScale },
              ]}
            >
              <YardText
                x={0}
                y={0}
                text={`${occupied}/${capacity}`}
                size={badgeSize}
                color={full ? palette.badge.full : palette.badge.ok}
              />
            </Group>
          )}
    </Group>
  );
}

// ─────────────────────────── Board ───────────────────────────

const EMPTY_HIDDEN_COLS: Set<number> = new Set();

export interface ShuntingBoardExtraProps {
  /** Pins a lighting pass, bypassing the stored preference (previews/tests). */
  timeOfDay?: TimeOfDay | null;
}

export function ShuntingBoard({
  state,
  prevState,
  width,
  height,
  onLocoButtonTap,
  onWagonTap,
  onTrackRowTap,
  onAnimationComplete,
  showCelebration,
  timeOfDay,
}: ShuntingBoardProps & ShuntingBoardExtraProps) {
  const palette = usePalette(timeOfDay);

  const layout = useMemo(
    () =>
      computeShuntingLayout({
        trackCount: state.tracks.length,
        capacity: state.capacity,
        hasRightLoco: state.hasRightLoco,
        width,
        height,
      }),
    [state.tracks.length, state.capacity, state.hasRightLoco, width, height]
  );

  const { move, progress, railPlan, settle, flash, boardFade } = useShuntingAnimation(
    state,
    prevState,
    layout,
    onAnimationComplete
  );

  // Cars that JUST arrived at the destination track (per the state diff), and
  // pre-existing destination-track cars displaced by the same move, stay
  // hidden from the static row until the ghost's travel+settle animation
  // fully lands — otherwise they'd render in both places at once (the
  // pushed ones are drawn by GhostLayer's PushedGhostCar, riding their own
  // pre-move slot until the arriving cut couples with them).
  const hiddenColsByTrack = useMemo(() => {
    const map = new Map<number, Set<number>>();
    if (move) {
      const cols = new Set<number>(move.cars.map((c) => c.dstCol));
      for (const pc of move.pushedCars ?? []) cols.add(pc.dstCol);
      map.set(move.dstTrack, cols);
    }
    return map;
  }, [move]);

  // Pushed cars are already physically on the destination track — merely
  // mid-shift — so unlike arriving cars they must still count toward the
  // capacity badge even while hidden from the static row.
  const pushedCountByTrack = useMemo(() => {
    const map = new Map<number, number>();
    if (move && (move.pushedCars?.length ?? 0) > 0) map.set(move.dstTrack, move.pushedCars!.length);
    return map;
  }, [move]);

  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const handleTap = useCallback(
    (x: number, y: number) => {
      const hit = layoutRef.current.hitTest(x, y);
      if (!hit) return;
      if (hit.type === 'loco') onLocoButtonTap(hit.side, hit.trackIdx);
      else if (hit.type === 'wagon') onWagonTap(hit.trackIdx, hit.carIdx);
      else onTrackRowTap(hit.trackIdx);
    },
    [onLocoButtonTap, onWagonTap, onTrackRowTap]
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(250)
        .onEnd((e) => {
          runOnJS(handleTap)(e.x, e.y);
        }),
    [handleTap]
  );

  const selectedByTrack = useMemo(() => {
    const map = new Map<number, Set<number>>();
    if (state.locoTrack >= 0) map.set(state.locoTrack, new Set(state.selectedCars));
    return map;
  }, [state.locoTrack, state.selectedCars]);

  const rightSelectedByTrack = useMemo(() => {
    const map = new Map<number, Set<number>>();
    if (state.hasRightLoco && state.rightLocoTrack >= 0) map.set(state.rightLocoTrack, new Set(state.rightSelectedCars));
    return map;
  }, [state.hasRightLoco, state.rightLocoTrack, state.rightSelectedCars]);

  const trackVs = useMemo(
    () => Array.from({ length: layout.trackCount }, (_, i) => layout.rowV(i)),
    [layout]
  );

  // Whether a cut is currently picked up on each side — an idle loco slot on
  // ANY other track is then a legal drop target, so its ghost renders a
  // touch more visible (see LocoButton's `isValidTarget`).
  const leftCutSelected = state.locoTrack >= 0 && state.selectedCars.length > 0;
  const rightCutSelected = state.hasRightLoco && state.rightLocoTrack >= 0 && state.rightSelectedCars.length > 0;

  const { ballastWidth, labelSize, badgeSize } = layout;

  // ── Route line ────────────────────────────────────────────────────────
  //
  // While a cut is selected: the pull-out leg from the outermost selected car
  // to the throat. While a move travels: the full source → throat → target
  // route. See RouteHighlight for why there is no "pending destination" case.
  const route = useMemo(() => {
    const half = layout.carWidth / 2;
    if (move) {
      // Entry moves (first placement, `srcTrack === -1`) have no source row
      // to draw a pull-out leg from — the ghost loco itself already reads as
      // "arriving from off-frame" (see buildEntryRailPlan); a route line
      // built from `layout.rowV(-1)` would be geometrically meaningless.
      if (move.srcTrack < 0) return null;
      const peine = move.side === 'left' ? layout.peineLeft : layout.peineRight;
      if (!peine) return null;
      const lastCar = move.cars[move.cars.length - 1];
      return {
        peine,
        srcU: layout.carX(lastCar ? lastCar.srcCol : 0) + half,
        srcV: layout.rowV(move.srcTrack),
        dstU: layout.carX(lastCar ? lastCar.dstCol : 0) + half,
        dstV: layout.rowV(move.dstTrack),
      };
    }
    if (state.locoTrack >= 0 && state.selectedCars.length > 0) {
      return {
        peine: layout.peineLeft,
        srcU: layout.carX(Math.max(...state.selectedCars)) + half,
        srcV: layout.rowV(state.locoTrack),
        dstU: null,
        dstV: null,
      };
    }
    if (state.hasRightLoco && state.rightLocoTrack >= 0 && state.rightSelectedCars.length > 0 && layout.peineRight) {
      return {
        peine: layout.peineRight,
        srcU: layout.carX(Math.min(...state.rightSelectedCars)) + half,
        srcV: layout.rowV(state.rightLocoTrack),
        dstU: null,
        dstV: null,
      };
    }
    return null;
  }, [move, layout, state.locoTrack, state.selectedCars, state.hasRightLoco, state.rightLocoTrack, state.rightSelectedCars]);

  const contentWidth = layout.contentWidth;
  const contentHeight = layout.contentHeight;
  const scrollable = contentHeight > height;
  const groundMatrix = useMemo(() => [...layout.camera.matrix], [layout.camera]);

  const canvas = (
    <GestureDetector gesture={tapGesture}>
      <Canvas style={{ width: contentWidth, height: contentHeight }}>
        {/* The sky ramp belongs to the SKY BAND, not the canvas: the ground
            covers everything below the horizon, so spanning the full height
            would compress the whole gradient into the thin visible strip and
            you would only ever see its topmost colour. Ending it at the
            horizon puts the warm end of each pass exactly where it belongs —
            on the skyline. */}
        <Fill>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, Math.max(1, layout.camera.horizonY))}
            colors={[...palette.sky.colors]}
            positions={[...palette.sky.positions]}
          />
        </Fill>

        <IsoSky width={contentWidth} horizonY={layout.camera.horizonY} palette={palette} />

        {/* Wrapped so a detected full-board RESTART can play a cheap opacity
            settle instead of a per-car animation — no-op (opacity 1) for
            every other update, including undo. */}
        <Group opacity={boardFade}>
          {/* ── GROUND: everything that lies ON the tilted plane ── */}
          <Group matrix={groundMatrix}>
            <GroundPlane layout={layout} palette={palette} />

            <IsoTrackBed
              rows={trackVs}
              convX={layout.peineLeft.convX}
              convY={layout.peineLeft.convY}
              fanEndX={layout.peineLeft.fanEndX}
              stubEndX={layout.peineRight ? layout.peineRight.fanEndX : layout.edgeRightX}
              trunkX={layout.edgeLeftX}
              ballastWidth={ballastWidth}
              palette={palette}
            />
            {layout.peineRight && (
              <IsoTrackBed
                rows={trackVs}
                convX={layout.peineRight.convX}
                convY={layout.peineRight.convY}
                fanEndX={layout.peineRight.fanEndX}
                stubEndX={layout.peineLeft.fanEndX}
                trunkX={layout.edgeRightX}
                ballastWidth={ballastWidth}
                palette={palette}
              />
            )}

            {state.tracks.map((_, i) => {
              const canDropLeft = state.locoTrack !== -1 && state.selectedCars.length > 0 && i !== state.locoTrack;
              const canDropRight =
                state.hasRightLoco &&
                state.rightLocoTrack !== -1 &&
                state.rightSelectedCars.length > 0 &&
                i !== state.rightLocoTrack;
              if (!canDropLeft && !canDropRight) return null;
              return (
                <ClearanceWedge
                  key={i}
                  layout={layout}
                  trackIdx={i}
                  side={canDropLeft ? 'left' : 'right'}
                  palette={palette}
                />
              );
            })}

            {move && <CouplingFlash layout={layout} trackIdx={move.dstTrack} flash={flash} palette={palette} />}

            {route && (
              <RouteHighlight
                srcU={route.srcU}
                srcV={route.srcV}
                dstU={route.dstU}
                dstV={route.dstV}
                convX={route.peine.convX}
                convY={route.peine.convY}
                fanEndX={route.peine.fanEndX}
                width={Math.max(3, ballastWidth * 0.12)}
                palette={palette}
              />
            )}
          </Group>

          {/* ── BILLBOARDS: far row first so near rows occlude ── */}
          {state.tracks.map((cars, i) => (
            <ShuntingRow
              key={i}
              layout={layout}
              trackIdx={i}
              cars={cars}
              hasRightLoco={state.hasRightLoco}
              locoTrack={state.locoTrack}
              rightLocoTrack={state.rightLocoTrack}
              selectedCars={selectedByTrack.get(i) ?? new Set()}
              rightSelectedCars={rightSelectedByTrack.get(i) ?? new Set()}
              leftCutSelected={leftCutSelected}
              rightCutSelected={rightCutSelected}
              hideLeftLoco={!!move && move.side === 'left' && (i === move.srcTrack || i === move.dstTrack)}
              hideRightLoco={!!move && move.side === 'right' && (i === move.srcTrack || i === move.dstTrack)}
              hiddenCols={hiddenColsByTrack.get(i) ?? EMPTY_HIDDEN_COLS}
              pushedCount={pushedCountByTrack.get(i) ?? 0}
              capacity={state.capacity}
              palette={palette}
              labelSize={labelSize}
              badgeSize={badgeSize}
            />
          ))}
        </Group>

        {move && railPlan && (
          <GhostLayer
            move={move}
            railPlan={railPlan}
            layout={layout}
            tracks={state.tracks}
            progress={progress}
            settle={settle}
            palette={palette}
            labelSize={labelSize}
          />
        )}

        {/* Atmosphere: a warm bloom by day, an inset vignette at night. */}
        <Rect x={0} y={0} width={contentWidth} height={contentHeight}>
          <RadialGradient
            c={vec(palette.atmosphere.cx * contentWidth, palette.atmosphere.cy * contentHeight)}
            r={palette.atmosphere.r * Math.max(contentWidth, contentHeight)}
            colors={
              palette.atmosphere.kind === 'vignette'
                ? ['rgba(0,0,0,0)', 'rgba(0,0,0,0)', palette.atmosphere.color]
                : [palette.atmosphere.color, 'rgba(0,0,0,0)']
            }
            positions={palette.atmosphere.kind === 'vignette' ? [0, 0.55, 1] : [0, 0.6]}
          />
        </Rect>

        {/* Confetti is gated on `showCelebration` (flipped on by the UI only
            after onAnimationComplete fires for the winning move), never on
            `state.status` directly — see boardContract.ts. */}
        {!!showCelebration && <Confetti active={!!showCelebration} cx={contentWidth / 2} cy={contentHeight / 3} />}
      </Canvas>
    </GestureDetector>
  );

  // The plane is sized to the canvas width by construction, so there is no
  // horizontal overflow any more. Vertical scroll stays as the fallback for
  // track counts that can't respect MIN_SCREEN_ROW_PITCH (design-system.md
  // §2.2 step 5) — see computeShuntingLayout.
  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <ScrollView style={{ width, height }} scrollEnabled={scrollable} showsVerticalScrollIndicator={false}>
        {canvas}
      </ScrollView>
    </View>
  );
}
