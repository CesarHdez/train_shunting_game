/**
 * Yard scenery / atmosphere — design/scenery-spec.md. A sibling of `IsoSky`
 * (never a modification of it — see that file's unchanged header), adding
 * the per-section prop kit (§2.1/§2.2) in two safe zones (§1.2):
 *
 *   Zone A — the sky band, `y < horizonY`, pure screen space, exactly like
 *   `IsoSky`'s own tower/gantry. `IsoSceneryZoneA` renders the fence line
 *   (always on) plus each section's LEFT/CENTER/RIGHT recipe slots.
 *
 *   Zone B — the foreground apron below the nearest row, gated by
 *   `foregroundMarginPlane` (§2.3/R3): render the section's ONE picked prop
 *   only if the level's foreground margin clears that prop's floor, never
 *   shrunk to fit. Split into two components because they compose
 *   differently with the ground's `<Group matrix={camera.matrix}>` (see each
 *   component's own doc comment):
 *
 *     `IsoSceneryForegroundGround`     — bush clump only: plane-projected,
 *                                        meant to be a CHILD of the matrix
 *                                        group (like `GroundPlane`).
 *     `IsoSceneryForegroundBillboard`  — cabinet/signage/lamp/forklift:
 *                                        billboarded (camera-projected,
 *                                        upright, depth-scaled) exactly like
 *                                        `ShuntingBoard.tsx`'s wagon
 *                                        `Billboarded` helper — meant to be a
 *                                        SIBLING of the matrix group, not a
 *                                        child of it (nesting would apply the
 *                                        projective matrix a second time to
 *                                        already-projected screen
 *                                        coordinates). Both are safe to
 *                                        always mount: each self-gates on
 *                                        the section's own pick and on R3, so
 *                                        the board never needs to branch.
 *
 * No `GestureDetector`/`hitTest` anywhere in this file (R4). No `BlurMask`
 * (none of this is ever selected/active). No per-frame JS: every shape is
 * `useMemo`'d off `(recipe, palette.key, size)`, and the only animated prop
 * (the lamp post's night glow) reads `useTwinkle`'s shared derived value.
 */

import React, { useMemo } from 'react';
import { Group } from '@shopify/react-native-skia';
import type { DerivedValue } from 'react-native-reanimated';

import type { TimeOfDayPalette } from '../../../design/tokens';
import type { IsoCamera } from '../iso/isoCamera';
import {
  BushClump,
  ContainerStack,
  ControlTower,
  FenceLine,
  Forklift,
  GantryCrane,
  LampPost,
  SignagePost,
  UtilityCabinet,
  Warehouse,
} from './scenery/kit';
import { FENCE_Y0, FENCE_Y1, REF_H, REF_W, SCENERY_SLOTS, type SceneryFixedSlot } from './scenery/refBand';
import { useTwinkle } from './scenery/useTwinkle';
import {
  CLASSIFICATION_FOREGROUND_RECIPE,
  CLASSIFICATION_SCENERY_RECIPE,
  CONTAINER_HUES,
  foregroundPickForSection,
  sceneryRecipeForSection,
  type ForegroundPick,
  type SceneryElement,
  type SceneryRecipe,
} from './scenery/recipes';

/** `recipeIndex` is a 0-based shunting section index, or the literal string
 *  for Clasificación's one fixed recipe (see recipes.ts). */
export type SceneryRecipeIndex = number | 'classification';

function recipeFor(recipeIndex: SceneryRecipeIndex): SceneryRecipe {
  return recipeIndex === 'classification' ? CLASSIFICATION_SCENERY_RECIPE : sceneryRecipeForSection(recipeIndex);
}

function foregroundPickFor(recipeIndex: SceneryRecipeIndex): ForegroundPick | null {
  return recipeIndex === 'classification' ? CLASSIFICATION_FOREGROUND_RECIPE : foregroundPickForSection(recipeIndex);
}

// ─────────────────────────── Zone A: sky band ───────────────────────────

/** Feet line every sky-band prop stands on, in 960×200 reference units —
 *  matches the fence's own bottom edge and the existing tower/gantry feet. */
const SLOT_BASE_Y = FENCE_Y1;

/** Intrinsic reference-band box (w, h) each prop kind draws itself into,
 *  before the slot's own `sx`/`sy` stretch — same spirit as `IsoSky`'s
 *  hard-coded tower/gantry Rect dimensions. */
function intrinsicBox(el: SceneryElement): { w: number; h: number } {
  switch (el.kind) {
    case 'controlTower':
      return { w: 60, h: el.tall ? 150 : 118 };
    case 'warehouse':
      return { w: el.doors === 1 ? 110 : 180, h: el.short ? 46 : 70 };
    case 'containerStack':
      return { w: el.count === 3 ? 190 : 150, h: el.tall ? 95 : 62 };
    case 'gantryCrane':
      return { w: 150, h: 92 };
    case 'lampPost':
      return { w: 26, h: 72 };
    case 'signagePost':
      return { w: 22, h: 58 };
    case 'forklift':
      return { w: 68, h: 46 };
  }
}

function SkyProp({
  el,
  x0,
  slotW,
  sx,
  sy,
  palette,
  glowOpacity,
}: {
  el: SceneryElement;
  x0: number;
  slotW: number;
  sx: number;
  sy: number;
  palette: TimeOfDayPalette;
  glowOpacity: DerivedValue<number>;
}) {
  const { w, h } = intrinsicBox(el);
  const boxW = Math.min(w, slotW);
  const localX = x0 + (slotW - boxW) / 2;
  const transform = useMemo(
    () => [
      { translateX: localX * sx },
      { translateY: (SLOT_BASE_Y - h) * sy },
      { scaleX: sx },
      { scaleY: sy },
    ],
    [localX, sx, sy, h]
  );
  const { structure, lampLight } = palette.scenery;
  const night = palette.key === 'noche';

  let child: React.ReactNode = null;
  switch (el.kind) {
    case 'controlTower':
      child = <ControlTower w={boxW} h={h} color={structure} lampLight={lampLight} night={night} />;
      break;
    case 'warehouse':
      child = (
        <Warehouse w={boxW} h={h} color={structure} doors={el.doors ?? 3} lampLight={lampLight} night={night} />
      );
      break;
    case 'containerStack':
      child = (
        <ContainerStack w={boxW} h={h} count={el.count ?? 2} tall={el.tall} hues={el.hues ?? CONTAINER_HUES} />
      );
      break;
    case 'gantryCrane':
      child = <GantryCrane w={boxW} h={h} color={structure} />;
      break;
    case 'lampPost':
      child = <LampPost w={boxW} h={h} color={structure} night={night} lampLight={lampLight} glowOpacity={glowOpacity} />;
      break;
    case 'signagePost':
      child = <SignagePost w={boxW} h={h} color={structure} arrow={el.arrow} />;
      break;
    case 'forklift':
      child = <Forklift w={boxW} h={h} color={structure} />;
      break;
    default:
      break;
  }

  return <Group transform={transform}>{child}</Group>;
}

function SkySlot({
  slot,
  scene,
  sx,
  sy,
  palette,
  glowOpacity,
}: {
  slot: SceneryFixedSlot;
  scene: SceneryElement[];
  sx: number;
  sy: number;
  palette: TimeOfDayPalette;
  glowOpacity: DerivedValue<number>;
}) {
  if (scene.length === 0) return null;
  const { x0, x1 } = SCENERY_SLOTS[slot];
  const totalW = x1 - x0;
  const subW = totalW / scene.length;
  return (
    <Group>
      {scene.map((el, i) => (
        <SkyProp
          key={i}
          el={el}
          x0={x0 + i * subW}
          slotW={subW}
          sx={sx}
          sy={sy}
          palette={palette}
          glowOpacity={glowOpacity}
        />
      ))}
    </Group>
  );
}

export interface IsoSceneryZoneAProps {
  width: number;
  horizonY: number;
  recipeIndex: SceneryRecipeIndex;
  palette: TimeOfDayPalette;
}

function IsoSceneryZoneAImpl({ width, horizonY, recipeIndex, palette }: IsoSceneryZoneAProps) {
  const band = Math.max(1, horizonY);
  const sx = width / REF_W;
  const sy = band / REF_H;
  const recipe = recipeFor(recipeIndex);
  // Shared with IsoSky's star twinkle (see useTwinkle's doc comment) —
  // drives the lamp post's night glow, the recipe kit's one animated prop.
  const glowOpacity = useTwinkle(palette.key === 'noche');

  return (
    <Group>
      <FenceLine width={width} y0={FENCE_Y0 * sy} y1={FENCE_Y1 * sy} color={palette.scenery.structure} />
      <SkySlot slot="left" scene={recipe.left} sx={sx} sy={sy} palette={palette} glowOpacity={glowOpacity} />
      <SkySlot slot="center" scene={recipe.center} sx={sx} sy={sy} palette={palette} glowOpacity={glowOpacity} />
      <SkySlot slot="right" scene={recipe.right} sx={sx} sy={sy} palette={palette} glowOpacity={glowOpacity} />
    </Group>
  );
}

export const IsoSceneryZoneA = React.memo(IsoSceneryZoneAImpl);

// ─────────────────────────── Zone B: foreground apron ───────────────────────────

/** Fixed gap (plane units) behind the last row a foreground prop anchors at —
 *  see scenery-spec.md §5: a fixed gap reads better than floating wherever
 *  `foregroundMarginPlane` happens to leave room. */
const FOREGROUND_GAP = 14;

/** design/scenery-spec.md §5's local-unit billboard sizes for the four
 *  billboarded foreground kinds (in the same "dp at mid-depth" unit system
 *  `carBodyWidth`/`carBodyHeight` use) — fixed, reasonable footprints; these
 *  props never need to fit a capacity-derived column like a wagon does. */
const BILLBOARD_SIZE: Record<Exclude<ForegroundPick['kind'], 'bushClump'>, { w: number; h: number }> = {
  utilityCabinet: { w: 16, h: 14 },
  signagePost: { w: 12, h: 30 },
  lampPost: { w: 15, h: 34 },
  forklift: { w: 26, h: 20 },
};

export interface IsoSceneryForegroundGroundProps {
  foregroundOriginY: number;
  foregroundMarginPlane: number;
  /** Plane u to centre the prop on — the board's own mid-yard u works well. */
  centerU: number;
  recipeIndex: SceneryRecipeIndex;
  palette: TimeOfDayPalette;
}

/**
 * Bush clump only: drawn as flat plane geometry, meant to be a CHILD of the
 * ground `<Group matrix={camera.matrix}>` — see this file's header. Renders
 * nothing when the section's pick isn't a bush clump, or when
 * `foregroundMarginPlane` is below its floor (R3: skip, never shrink).
 */
function IsoSceneryForegroundGroundImpl({
  foregroundOriginY,
  foregroundMarginPlane,
  centerU,
  recipeIndex,
  palette,
}: IsoSceneryForegroundGroundProps) {
  const pick = foregroundPickFor(recipeIndex);
  if (!pick || pick.kind !== 'bushClump') return null;
  if (foregroundMarginPlane < pick.minMarginPlane) return null;

  const r = Math.max(6, Math.min(18, foregroundMarginPlane * 0.35));
  const v = foregroundOriginY + FOREGROUND_GAP + r * 0.6;
  return <BushClump cx={centerU} cy={v} r={r} color={palette.scenery.structure} />;
}

export const IsoSceneryForegroundGround = React.memo(IsoSceneryForegroundGroundImpl);

export interface IsoSceneryForegroundBillboardProps {
  camera: IsoCamera;
  foregroundOriginY: number;
  foregroundMarginPlane: number;
  centerU: number;
  recipeIndex: SceneryRecipeIndex;
  palette: TimeOfDayPalette;
}

/**
 * The four silhouette foreground props: billboarded (screen-space, camera-
 * projected + depth-scaled, upright) — meant to be a SIBLING of the ground
 * `<Group matrix={camera.matrix}>`, not nested inside it (see this file's
 * header). Renders nothing when the section's pick is the bush clump, or
 * when `foregroundMarginPlane` is below its floor (R3).
 */
function IsoSceneryForegroundBillboardImpl({
  camera,
  foregroundOriginY,
  foregroundMarginPlane,
  centerU,
  recipeIndex,
  palette,
}: IsoSceneryForegroundBillboardProps) {
  const pick = foregroundPickFor(recipeIndex);
  if (!pick || pick.kind === 'bushClump') return null;
  if (foregroundMarginPlane < pick.minMarginPlane) return null;

  const { w, h } = BILLBOARD_SIZE[pick.kind];
  const v = foregroundOriginY + FOREGROUND_GAP;
  const s = camera.depthScaleAt(v);
  const p = camera.project(centerU, v);
  const transform = [{ translateX: p.x - (w * s) / 2 }, { translateY: p.y - h * s }, { scale: s }];
  const { structure, lampLight } = palette.scenery;
  const night = palette.key === 'noche';

  let child: React.ReactNode = null;
  switch (pick.kind) {
    case 'utilityCabinet':
      child = <UtilityCabinet w={w} h={h} color={structure} />;
      break;
    case 'signagePost':
      child = <SignagePost w={w} h={h} color={structure} />;
      break;
    case 'lampPost':
      child = <LampPost w={w} h={h} color={structure} night={night} lampLight={lampLight} />;
      break;
    case 'forklift':
      child = <Forklift w={w} h={h} color={structure} />;
      break;
    default:
      break;
  }

  return <Group transform={transform}>{child}</Group>;
}

export const IsoSceneryForegroundBillboard = React.memo(IsoSceneryForegroundBillboardImpl);
