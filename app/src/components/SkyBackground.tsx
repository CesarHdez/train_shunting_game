import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { TimeOfDayPalette } from '../../design/tokens';

interface SkyBackgroundProps {
  palette: TimeOfDayPalette;
  /** SVG `id`s must be document-unique on web (react-native-web renders a
   *  real DOM `<svg>`), so each screen passes its own. */
  gradientId: string;
}

/**
 * Full-bleed time-of-day sky gradient, shared by all 5 re-skinned menu
 * screens (Login/ModeSelect/LevelSelect/Settings/Leaderboard).
 *
 * BUG THIS FIXES: the previous per-screen copy gave `<Svg>` a `style` of
 * `StyleSheet.absoluteFill` but no `width`/`height` PROPS. `StyleSheet.
 * absoluteFill` only *positions* the element (top/left/right/bottom: 0) —
 * it does not establish the SVG canvas's own intrinsic size, so
 * `react-native-svg` fell back to its small default viewport, and the
 * child `<Rect width="100%" height="100%">` resolved its percentages
 * against THAT small box instead of the screen. Net effect: a gradient
 * rectangle pinned to the top-left corner instead of a full-bleed sky.
 *
 * Fix: pass real, numeric pixel dimensions from `useWindowDimensions()` as
 * `width`/`height` PROPS (not just style) on `<Svg>`, and size the `<Rect>`
 * to those same numbers instead of a percentage string. Numeric dimensions
 * sidestep any ambiguity in how a percentage attribute resolves on an SVG
 * root element (which depends on the parent's CSS containing block on web
 * vs. RN's layout box natively) — this renders identically full-bleed on
 * both. `useWindowDimensions()` also keeps it correct across rotation/
 * resize without a remount, unlike a one-time `onLayout` measurement.
 */
export default function SkyBackground({ palette, gradientId }: SkyBackgroundProps) {
  const { width, height } = useWindowDimensions();
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          {palette.sky.colors.map((c, i) => (
            <Stop key={i} offset={palette.sky.positions[i]} stopColor={c} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={`url(#${gradientId})`} />
    </Svg>
  );
}
