/**
 * Small in-canvas HUD text (capacity badges, "VÍA X" labels, empty-track
 * hints). See design/design-system.md §7 — Skia text needs an explicit
 * SkFont, so this wraps `useCarLabelFont` + manual alignment via
 * `font.measureText`. Per §6.2, this text is DECORATIVE/redundant with
 * RN-rendered chrome for accessibility — the UI controller must not rely on
 * it as the only source of that information for screen-reader/large-text
 * users.
 */

import React, { useMemo } from 'react';
import { Text } from '@shopify/react-native-skia';

import { useCarLabelFont } from './labelFont';

export interface YardTextProps {
  x: number;
  y: number;
  text: string;
  size?: number;
  color: string;
  align?: 'left' | 'center' | 'right';
  weight?: '600' | '700';
}

function YardTextImpl({ x, y, text, size = 13, color, align = 'left', weight = '600' }: YardTextProps) {
  const font = useCarLabelFont(size, weight);
  const tw = useMemo(() => {
    if (!font) return text.length * size * 0.6;
    try {
      return font.measureText(text).width;
    } catch {
      return text.length * size * 0.6;
    }
  }, [font, text, size]);
  if (!font) return null;
  const drawX = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw : x;
  return <Text x={drawX} y={y} text={text} font={font} color={color} />;
}

export const YardText = React.memo(YardTextImpl);
