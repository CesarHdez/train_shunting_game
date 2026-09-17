import React from 'react';
import { StyleProp, useWindowDimensions, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { TimeOfDayPalette } from '../../design/tokens';

interface HillSilhouetteProps {
  palette: TimeOfDayPalette;
  /** SVG path `d`, authored against a 360-wide box (the reference mockup's
   *  viewBox) — stretched to the real screen width below. */
  pathD: string;
  /** Height of the authoring viewBox (360 × this). */
  viewBoxHeight: number;
  /** Rendered height in dp. */
  height: number;
  /** Extra multiplier on `palette.scenery.hillOpacity` (ModeSelect wants a
   *  fainter hill than Login's). Defaults to 1. */
  opacityScale?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Hill/skyline silhouette used behind the Login and ModeSelect cards.
 *
 * Same class of bug as `SkyBackground` (see its doc comment): the previous
 * per-screen copy passed `width="100%"` as a string PROP on `<Svg>` with a
 * `preserveAspectRatio="none"` stretch — which, unlike the sky gradient's
 * bug, technically had a `width` prop at all, but still depends on the
 * parent's resolved CSS box width being definite at the moment react-
 * native-svg's web shim reads that percentage. Using the same numeric-
 * pixels approach as `SkyBackground` removes that ambiguity entirely and
 * keeps both full-bleed backgrounds consistent.
 */
export default function HillSilhouette({
  palette,
  pathD,
  viewBoxHeight,
  height,
  opacityScale = 1,
  style,
}: HillSilhouetteProps) {
  const { width } = useWindowDimensions();
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 360 ${viewBoxHeight}`}
      preserveAspectRatio="none"
      style={style}
      pointerEvents="none"
    >
      <Path d={pathD} fill={palette.scenery.hill} opacity={palette.scenery.hillOpacity * opacityScale} />
    </Svg>
  );
}
