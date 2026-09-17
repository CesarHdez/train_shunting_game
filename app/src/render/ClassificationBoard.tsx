/**
 * Patio de Clasificación Skia board — implements ClassificationBoardProps
 * from boardContract.ts. Pure view + hit-testing: draws `state`, tweens the
 * "push" transition from `prevState` when one is supplied (new relative to
 * the reference — see useClassificationAnimation.ts), and emits semantic
 * taps. Never calls the engine or mutates state.
 *
 * Drawn as the same isometric diorama as the shunting yard, in two passes —
 * GROUND (ballast, rails, row washes) inside a `<Group matrix={camera.matrix}>`
 * in plane coordinates, then BILLBOARDS (cars, selectors, every readout)
 * standing upright at their projected anchors. See ShuntingBoard.tsx's header
 * for why anything carrying text has to be in the second pass.
 *
 * The destination-colour mechanic is untouched: `destinationColors` and the
 * colorblind shape badges render exactly as before — only the light they sit
 * in, and the ground they sit on, changed.
 */

import React, { useCallback, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { ScrollView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Canvas, Fill, Group, LinearGradient, Rect, RadialGradient, vec } from '@shopify/react-native-skia';
import { runOnJS, useDerivedValue, type SharedValue } from 'react-native-reanimated';

import type { ClassificationBoardProps } from './boardContract';
import { colors, type TimeOfDay, type TimeOfDayPalette } from '../../design/tokens';
import { computeClassificationLayout, type ClassificationLayout } from './layout/classificationLayout';
import { depthScaleWithMatrix, projectWithMatrix } from './iso/isoCamera';
import { usePalette } from './iso/timeOfDay';
import { useClassificationAnimation } from './motion/useClassificationAnimation';
import type { ClassificationMoveAnim } from './motion/detectMove';
import { buildPushWaypoints, getPosAt } from './motion/waypoints';
import { IsoSceneryZoneA } from './primitives/IsoScenery';
import { IsoSky } from './primitives/IsoSky';
import { IsoTrackBed } from './primitives/IsoTrackBed';
import { PushMarker } from './primitives/PushMarker';
import { ArrivalSelector } from './primitives/ArrivalSelector';
import { ClassificationWagon } from './primitives/ClassificationWagon';
import { YardText } from './primitives/YardText';
import { Confetti } from './primitives/Confetti';
import { parseClassificationCar } from '../data/levelTypes';

// ─────────────────────────── Billboarding ───────────────────────────

/**
 * Stands a sprite up at a point on the plane. `railY` is how far below the
 * sprite's top edge its wheels sit — classification cars carry their running
 * gear inside the art box, so that is not simply the sprite height.
 */
function Billboarded({
  layout,
  u,
  v,
  width,
  railY,
  children,
}: {
  layout: ClassificationLayout;
  u: number;
  v: number;
  width: number;
  railY: number;
  children: React.ReactNode;
}) {
  const { camera } = layout;
  const s = camera.depthScaleAt(v);
  const p = camera.project(u, v);
  return (
    <Group transform={[{ translateX: p.x - (width * s) / 2 }, { translateY: p.y - railY * s }, { scale: s }]}>
      {children}
    </Group>
  );
}

// ─────────────────────────── Ghost layer ───────────────────────────

function GhostPushCar({
  code,
  x0,
  y0,
  x1,
  y1,
  width,
  railY,
  channelX,
  matrix,
  baseScale,
  progress,
  settle,
}: {
  code: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  width: number;
  railY: number;
  channelX: number;
  matrix: number[];
  baseScale: number;
  progress: SharedValue<number>;
  settle: SharedValue<number>;
}) {
  const waypoints = useMemo(() => buildPushWaypoints(x0, y0, x1, y1, channelX), [x0, y0, x1, y1, channelX]);
  // Evaluated in PLANE space and projected per frame, so the car shrinks as
  // it runs back toward the arrival tracks and grows coming down the yard —
  // the same depth scaling the static billboards get, just animated.
  const transform = useDerivedValue(() => {
    const pos = getPosAt(waypoints, Math.min(1, Math.max(0, progress.value)));
    const p = projectWithMatrix(matrix, pos.x, pos.y);
    const s = depthScaleWithMatrix(matrix, baseScale, pos.y) * settle.value;
    return [{ translateX: p.x - (width * s) / 2 }, { translateY: p.y - railY * s }, { scale: s }];
  }, [progress, settle, waypoints, matrix, baseScale, width, railY]);

  return (
    <Group transform={transform}>
      <ClassificationWagon code={code} width={width} />
    </Group>
  );
}

/** Green pulse on the classification row's ballast as the car couples up. */
function CouplingFlash({
  layout,
  v,
  flash,
  palette,
}: {
  layout: ClassificationLayout;
  v: number;
  flash: SharedValue<number>;
  palette: TimeOfDayPalette;
}) {
  const opacity = useDerivedValue(() => flash.value * 0.35, [flash]);
  const r = layout.rowBandRect(v);
  return <Rect x={r.x} y={r.y} width={r.width} height={r.height} color={palette.marker.edge} opacity={opacity} />;
}

function GhostLayer({
  move,
  layout,
  progress,
  settle,
  palette,
}: {
  move: ClassificationMoveAnim;
  layout: ClassificationLayout;
  progress: SharedValue<number>;
  settle: SharedValue<number>;
  palette: TimeOfDayPalette;
}) {
  const matrix = useMemo(() => [...layout.camera.matrix], [layout.camera]);
  const channelX = layout.gutterThroatEnd;
  const arrivalX = layout.arrCarX(0) + layout.arrCarWidth / 2;
  const arrivalY = layout.arrY(move.fromArrival);
  const clasifX = layout.clasCarX(move.dstCol) + layout.clasCarWidth / 2;
  const clasifY = layout.clasY(move.toClasif);
  // Forward push: arrival head → classif tail. Undo (move.reverse): the ghost
  // runs backward, classif → arrival head — same waypoint machinery, just
  // source/dest swapped (see detectMove.ts detectClassificationUndo).
  const x0 = move.reverse ? clasifX : arrivalX;
  const y0 = move.reverse ? clasifY : arrivalY;
  const x1 = move.reverse ? arrivalX : clasifX;
  const y1 = move.reverse ? arrivalY : clasifY;
  const width = move.reverse ? layout.arrCarWidth : layout.clasCarWidth;
  const railY = move.reverse ? layout.arrCarRailY : layout.clasCarRailY;

  return (
    <GhostPushCar
      code={move.label}
      x0={x0}
      y0={y0}
      x1={x1}
      y1={y1}
      width={width}
      railY={railY}
      channelX={channelX}
      matrix={matrix}
      baseScale={layout.camera.scale}
      progress={progress}
      settle={settle}
    />
  );
}

// ─────────────────────────── Ground layer ───────────────────────────

const GROUND_BLEED_X = 0.55;
const GROUND_BLEED_V = 0.7;

/** See ShuntingBoard's GroundPlane — same bleed, same reason. */
function GroundPlane({ layout, palette }: { layout: ClassificationLayout; palette: TimeOfDayPalette }) {
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

// ─────────────────────────── Billboard rows ───────────────────────────

function ArrivalRow({
  layout,
  idx,
  cars,
  isActive,
  hideHead,
  palette,
}: {
  layout: ClassificationLayout;
  idx: number;
  cars: string[];
  isActive: boolean;
  /** Hide the head (column 0) car while an undo's reverse ghost is still in
   *  flight back to it — otherwise it renders here AND in the ghost layer at
   *  once (the same "never pre-reveal the destination" rule the shunting
   *  board's hiddenCols enforces). */
  hideHead: boolean;
  palette: TimeOfDayPalette;
}) {
  const v = layout.arrY(idx);
  const s = layout.camera.depthScaleAt(v);
  const selectorW = layout.selectorWidth;
  const selectorAnchor = layout.camera.project(layout.gutterAnchor, v);

  return (
    <Group>
      <Group
        transform={[
          { translateX: selectorAnchor.x - (selectorW * s) / 2 },
          { translateY: selectorAnchor.y - layout.arrCarRailY * s },
          { scale: s },
        ]}
      >
        <ArrivalSelector
          x={0}
          y={0}
          w={selectorW}
          h={layout.arrCarRailY}
          isActive={isActive}
          isEmpty={cars.length === 0}
        />
      </Group>

      {cars.length === 0 ? (
        <Group
          transform={[
            { translateX: layout.camera.project(layout.trackSX + layout.arrCarWidth, v).x },
            { translateY: layout.camera.project(layout.trackSX, v).y - layout.labelSize * s * 0.4 },
            { scale: s },
          ]}
        >
          <YardText x={0} y={0} text="Vía vacía" size={layout.labelSize} color={palette.badge.ok} />
        </Group>
      ) : (
        cars.map((code, j) => {
          if (hideHead && j === 0) return null;
          return (
            <Billboarded
              key={j}
              layout={layout}
              u={layout.arrCarX(j) + layout.arrCarWidth / 2}
              v={v}
              width={layout.arrCarWidth}
              railY={layout.arrCarRailY}
            >
              <ClassificationWagon code={code} width={layout.arrCarWidth} highlighted={isActive && j === 0} />
            </Billboarded>
          );
        })
      )}
    </Group>
  );
}

function ClassificationRow({
  layout,
  idx,
  cars,
  capacity,
  hiddenCol,
  palette,
}: {
  layout: ClassificationLayout;
  idx: number;
  cars: string[];
  capacity: number;
  /** Column to hide while its push ghost is still in flight (-1 = none). */
  hiddenCol: number;
  palette: TimeOfDayPalette;
}) {
  const v = layout.clasY(idx);
  const s = layout.camera.depthScaleAt(v);
  // Exclude the car still hidden-in-transit so the capacity readout doesn't
  // jump to the final count before the wagon is visibly there.
  const isPushHidden = hiddenCol >= 0 && hiddenCol < cars.length;
  const visibleCount = isPushHidden ? cars.length - 1 : cars.length;
  const full = visibleCount >= capacity;
  let jumps = 0;
  for (let i = 1; i < cars.length; i++) {
    if (parseClassificationCar(cars[i]).color !== parseClassificationCar(cars[i - 1]).color) jumps++;
  }

  const railY = layout.camera.project(layout.trackSX, v).y;
  const labelAnchor = layout.camera.project(layout.gutterAnchor, v);
  const readoutAnchor = layout.camera.project(layout.trackSX + layout.trackWidth + layout.readoutWidth * 0.18, v);
  const lift = layout.ballastWidth * 0.5 * s;

  return (
    <Group>
      {/* Empty-slot outlines, billboarded so they read as standing car-shaped
          holes rather than lozenges smeared across the ballast. */}
      {Array.from({ length: Math.max(0, capacity - visibleCount) }).map((_, k) => {
        const j = cars.length + k;
        return (
          <Billboarded
            key={`slot-${j}`}
            layout={layout}
            u={layout.clasCarX(j) + layout.clasCarWidth / 2}
            v={v}
            width={layout.clasCarWidth}
            railY={layout.clasCarRailY}
          >
            <Rect
              x={2}
              y={layout.clasCarRailY * 0.18}
              width={layout.clasCarWidth - 4}
              height={layout.clasCarRailY * 0.62}
              style="stroke"
              strokeWidth={1.5}
              color="rgba(255,255,255,0.16)"
            />
          </Billboarded>
        );
      })}

      {cars.map((code, j) => {
        if (j === hiddenCol) return null;
        return (
          <Billboarded
            key={j}
            layout={layout}
            u={layout.clasCarX(j) + layout.clasCarWidth / 2}
            v={v}
            width={layout.clasCarWidth}
            railY={layout.clasCarRailY}
          >
            <ClassificationWagon code={code} width={layout.clasCarWidth} />
          </Billboarded>
        );
      })}

      {/* VÍA label, left of the track. */}
      <Group transform={[{ translateX: labelAnchor.x }, { translateY: railY - lift }, { scale: s }]}>
        <YardText
          x={0}
          y={0}
          text={`VÍA ${String.fromCharCode(65 + idx)}`}
          size={layout.labelSize}
          align="center"
          color={full ? palette.badge.full : palette.badge.ok}
        />
      </Group>

      {/* Capacity + purity readouts, right of the track. */}
      <Group transform={[{ translateX: readoutAnchor.x }, { translateY: railY - lift }, { scale: s }]}>
        <YardText
          x={0}
          y={0}
          text={`${visibleCount}/${capacity}${full ? ' · LLENA' : ''}`}
          size={layout.labelSize}
          color={full ? palette.badge.full : palette.badge.ok}
        />
        {jumps > 0 ? (
          <YardText
            x={0}
            y={layout.labelSize * 1.25}
            text={`${jumps} salto${jumps > 1 ? 's' : ''}`}
            size={layout.labelSize * 0.9}
            color={colors.text.warn}
          />
        ) : (
          cars.length > 0 && (
            <YardText
              x={0}
              y={layout.labelSize * 1.25}
              text="pura +30"
              size={layout.labelSize * 0.9}
              color={colors.status.success}
            />
          )
        )}
      </Group>
    </Group>
  );
}

// ─────────────────────────── Board ───────────────────────────

export interface ClassificationBoardExtraProps {
  /** Pins a lighting pass, bypassing the stored preference (previews/tests). */
  timeOfDay?: TimeOfDay | null;
}

export function ClassificationBoard({
  state,
  prevState,
  width,
  height,
  onArrivalTap,
  onClassificationTap,
  onAnimationComplete,
  showCelebration,
  timeOfDay,
}: ClassificationBoardProps & ClassificationBoardExtraProps) {
  const palette = usePalette(timeOfDay);

  // arrSlots is fixed at level start (ref `clf.arrSlots`) — arrivals only ever
  // shrink during play, so capture the initial max length once per level.
  const arrSlotsRef = useRef<{ levelNum: number; slots: number }>({ levelNum: -1, slots: 1 });
  if (arrSlotsRef.current.levelNum !== state.levelNum) {
    arrSlotsRef.current = {
      levelNum: state.levelNum,
      slots: Math.max(1, ...state.arrivals.map((v) => v.length)),
    };
  }

  const layout = useMemo(
    () =>
      computeClassificationLayout({
        arrivalsCount: state.arrivals.length,
        clasifCount: state.clasif.length,
        arrSlots: arrSlotsRef.current.slots,
        clasSlots: Math.max(1, ...state.capacities),
        width,
        height,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.arrivals.length, state.clasif.length, state.levelNum, state.capacities, width, height]
  );

  const { move, progress, settle, flash, boardFade } = useClassificationAnimation(state, prevState, onAnimationComplete);

  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const handleTap = useCallback(
    (x: number, y: number) => {
      const hit = layoutRef.current.hitTest(x, y);
      if (!hit) return;
      if (hit.type === 'arrival') onArrivalTap(hit.idx);
      else onClassificationTap(hit.idx);
    },
    [onArrivalTap, onClassificationTap]
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

  const contentWidth = layout.contentWidth;
  const contentHeight = layout.contentHeight;
  const scrollable = contentHeight > height;
  const groundMatrix = useMemo(() => [...layout.camera.matrix], [layout.camera]);

  const arrivalVs = useMemo(
    () => Array.from({ length: layout.arrivalsCount }, (_, i) => layout.arrY(i)),
    [layout]
  );
  const clasifVs = useMemo(() => Array.from({ length: layout.clasifCount }, (_, i) => layout.clasY(i)), [layout]);

  const via = state.arrivals[state.viaSel];
  const canPush = state.status === 'PLAYING' && !!via && via.length > 0;

  // Both blocks share one throat off the left edge, so the yard reads as one
  // ladder feeding two groups of tracks rather than two unrelated lists.
  const convX = layout.gutterThroatConv;
  const convY = (layout.arrY(0) + layout.clasY(Math.max(0, layout.clasifCount - 1))) / 2;
  const fanEndX = layout.gutterThroatEnd;

  const canvas = (
    <GestureDetector gesture={tapGesture}>
      <Canvas style={{ width: contentWidth, height: contentHeight }}>
        {/* Ends at the horizon, not the canvas bottom — see the same Fill in
            ShuntingBoard.tsx for why. */}
        <Fill>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(0, Math.max(1, layout.camera.horizonY))}
            colors={[...palette.sky.colors]}
            positions={[...palette.sky.positions]}
          />
        </Fill>

        <IsoSky width={contentWidth} horizonY={layout.camera.horizonY} palette={palette} />
        {/* Fixed "Patio de Clasificación" recipe (design/scenery-spec.md §2.2's
            final row) — no Zone B/foreground pick here: R5 keeps the
            destinationColors-hued container stack strictly sky-band/
            background-only, never near enough the row band to be mistaken
            for a wagon. */}
        <IsoSceneryZoneA
          width={contentWidth}
          horizonY={layout.camera.horizonY}
          recipeIndex="classification"
          palette={palette}
        />

        {/* Wrapped so a detected full-board RESTART can play a cheap opacity
            settle instead of a per-car animation — no-op (opacity 1) for
            every other update, including undo. */}
        <Group opacity={boardFade}>
          {/* ── GROUND ── */}
          <Group matrix={groundMatrix}>
            <GroundPlane layout={layout} palette={palette} />

            <IsoTrackBed
              rows={[...arrivalVs, ...clasifVs]}
              convX={convX}
              convY={convY}
              fanEndX={fanEndX}
              stubEndX={layout.edgeRightX}
              trunkX={layout.edgeLeftX}
              ballastWidth={layout.ballastWidth}
              palette={palette}
            />

            {/* Selected arrival track: a lit stretch of its own bed. */}
            {state.arrivals.map((_, i) =>
              i === state.viaSel ? (
                <Rect
                  key={`sel-${i}`}
                  {...layout.rowBandRect(layout.arrY(i))}
                  color={colors.status.warning}
                  opacity={0.16}
                />
              ) : null
            )}

            {move && !move.reverse && (
              <CouplingFlash layout={layout} v={layout.clasY(move.toClasif)} flash={flash} palette={palette} />
            )}
          </Group>

          {/* ── BILLBOARDS: far row first so near rows occlude ── */}
          {state.arrivals.map((cars, i) => (
            <ArrivalRow
              key={`a${i}`}
              layout={layout}
              idx={i}
              cars={cars}
              isActive={i === state.viaSel}
              // Undo's reverse ghost lands back on ONE arrival's head.
              hideHead={!!move?.reverse && move.fromArrival === i}
              palette={palette}
            />
          ))}

          {state.clasif.map((cars, i) => {
            const full = cars.length >= state.capacities[i];
            const marker = layout.camera.project(layout.trackSX, layout.clasY(i));
            const s = layout.camera.depthScaleAt(layout.clasY(i));
            return (
              <Group key={`c${i}`}>
                <ClassificationRow
                  layout={layout}
                  idx={i}
                  cars={cars}
                  capacity={state.capacities[i]}
                  // Only a FORWARD push hides its landing column — an undo's
                  // reverse ghost departs FROM this row, and the engine has
                  // already removed that car from `state.clasif` by now.
                  hiddenCol={move && !move.reverse && move.toClasif === i ? move.dstCol : -1}
                  palette={palette}
                />
                <Group
                  transform={[
                    { translateX: marker.x },
                    { translateY: marker.y - (layout.clasCarRailY * s) / 2 },
                    { scale: s },
                  ]}
                >
                  <PushMarker
                    trackX={0}
                    rowTop={0}
                    rowHeight={layout.clasCarRailY}
                    isTarget={canPush && !full}
                  />
                </Group>
              </Group>
            );
          })}
        </Group>

        {move && <GhostLayer move={move} layout={layout} progress={progress} settle={settle} palette={palette} />}

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
            after onAnimationComplete fires for the finishing move), never on
            `state.status` directly — see boardContract.ts. */}
        {!!showCelebration && <Confetti active={!!showCelebration} cx={contentWidth / 2} cy={contentHeight / 3} />}
      </Canvas>
    </GestureDetector>
  );

  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      <ScrollView style={{ width, height }} scrollEnabled={scrollable} showsVerticalScrollIndicator={false}>
        {canvas}
      </ScrollView>
    </View>
  );
}
