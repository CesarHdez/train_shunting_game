import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { secondToneOverlay } from './iconTone';

interface LocoIconProps {
  /** Rendered WIDTH; height follows the glyph's 100×56 aspect. */
  width?: number;
  /** Main body/frame/wheel tint — pass the active time-of-day palette colour. */
  color: string;
  /**
   * Second livery tone, painted over the rear of the long hood on the same
   * diagonal division the in-game loco uses. Omitted, that patch is `color`
   * under `secondToneOverlay` (see iconTone.ts), so a single palette colour
   * still reads as a two-tone livery in every time-of-day pass.
   */
  secondaryColor?: string;
}

const VIEW_W = 100;
const VIEW_H = 56;

// Silhouette fractions mirror render/primitives/LocoButton.tsx (EMD road
// switcher: long low hood → tall boxy cab → short blunt nose) so the menu
// icon and the yard loco read as the same machine. Scaled to a 100-wide
// body, 40 tall, with the frame band and trucks below it.
const BODY_BOTTOM = 40;
const HOOD_ROOF = 18;
const CAB_ROOF = 5;
const LONG_HOOD_END = 56;
const CAB_FRONT = 80;
const CAB_WALL = 84;
const WINDSHIELD_KNEE = (CAB_ROOF + HOOD_ROOF) / 2;

const BODY = `M0,${BODY_BOTTOM} L0,${HOOD_ROOF} L${LONG_HOOD_END},${HOOD_ROOF} L${LONG_HOOD_END},${CAB_ROOF} L${CAB_FRONT},${CAB_ROOF} L${CAB_WALL},${WINDSHIELD_KNEE} L${CAB_WALL},${HOOD_ROOF} L100,${HOOD_ROOF} L100,${BODY_BOTTOM} Z`;

// Cut-outs (evenodd holes), so the card behind shows through as glass/slots
// in either tone — no third colour needed.
const WINDSHIELD = 'M67,9 L78.5,9 L81.5,15.5 L67,15.5 Z';
const SIDE_WINDOW = 'M59,9 h6 v6.5 h-6 Z';
const GRILLE = 'M5,23 h13 v2.6 h-13 Z M5,28.2 h13 v2.6 h-13 Z M5,33.4 h13 v2.6 h-13 Z';
const HEADLIGHT = 'M93.5,27 a2.6,2.6 0 1,0 5.2,0 a2.6,2.6 0 1,0 -5.2,0 Z';

const HOOD_PATCH = `M0,${BODY_BOTTOM} L0,${HOOD_ROOF} L30,${HOOD_ROOF} L19,${BODY_BOTTOM} Z`;

/**
 * Side-profile diesel shunter for the entry screens (login logo, shunting
 * mode card) — a flat, one- or two-tone version of the yard's LocoButton,
 * tinted by the caller from the time-of-day palette.
 */
export default function LocoIcon({ width = 64, color, secondaryColor }: LocoIconProps) {
  const height = (width * VIEW_H) / VIEW_W;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
      <Path d={`${BODY} ${WINDSHIELD} ${SIDE_WINDOW} ${GRILLE} ${HEADLIGHT}`} fill={color} fillRule="evenodd" />
      {secondaryColor ? (
        <Path d={`${HOOD_PATCH} ${GRILLE}`} fill={secondaryColor} fillRule="evenodd" />
      ) : (
        <Path d={`${HOOD_PATCH} ${GRILLE}`} {...secondToneOverlay(color)} fillRule="evenodd" />
      )}
      {/* Exhaust stack poking through the hood roof. */}
      <Rect x={42} y={14} width={3} height={4} fill={color} />
      {/* Frame band, separated from the body by a thin gap. */}
      <Rect x={0} y={BODY_BOTTOM + 2} width={VIEW_W} height={4} rx={1} fill={color} />
      {/* Two trucks, two wheels each. */}
      <G fill={color}>
        <Rect x={8} y={47} width={26} height={3} rx={1.5} />
        <Rect x={66} y={47} width={26} height={3} rx={1.5} />
        <Circle cx={14} cy={51} r={4.6} />
        <Circle cx={28} cy={51} r={4.6} />
        <Circle cx={72} cy={51} r={4.6} />
        <Circle cx={86} cy={51} r={4.6} />
      </G>
    </Svg>
  );
}
