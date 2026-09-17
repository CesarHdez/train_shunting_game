import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../design/tokens';
import { STAR_POLYGON_PATH } from './icons';

interface StarRowProps {
  stars: 0 | 1 | 2 | 3;
  /** Star glyph radius in dp — glyph font size scales from this. Default 8. */
  radius?: number;
  gap?: number;
}

/**
 * Simple 3-star row — informational only, not a tap target.
 *
 * Per design_handoff_menus/README.md §3, the star shape is
 * `icons/starOutline.svg`'s 10-point polygon (re-exported as
 * `STAR_POLYGON_PATH` from src/components/icons) rendered via
 * `react-native-svg`, so the app has exactly one star geometry shared with
 * `StarIcon` — a lit star is the polygon filled solid, an unlit one is the
 * same polygon at low opacity, never a second (e.g. glyph-font) shape.
 *
 * `accessible` collapses the 3 individual glyphs into a single node
 * (`accessibilityLabel="N de 3 estrellas"`) so a screen reader announces one
 * clean summary here instead of "star, star, empty star" one at a time.
 */
export default function StarRow({ stars, radius = 8, gap }: StarRowProps) {
  const g = gap ?? radius * 1.2;
  const size = radius * 2.2;
  return (
    <View
      style={[styles.row, { gap: g }]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${stars} de 3 estrellas`}
    >
      {[0, 1, 2].map((i) => {
        const lit = i < stars;
        return (
          <Svg key={i} width={size} height={size} viewBox="0 0 24 24">
            <Path
              d={STAR_POLYGON_PATH}
              fill={lit ? colors.star.on : colors.star.off}
              fillOpacity={lit ? 1 : 0.2}
              stroke="none"
            />
          </Svg>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
