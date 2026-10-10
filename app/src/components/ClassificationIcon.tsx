import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { secondToneOverlay } from './iconTone';

interface ClassificationIconProps {
  /** Rendered WIDTH; height follows the glyph's 100×56 aspect (same as LocoIcon). */
  width?: number;
  /** Track/wagon tint — pass the active time-of-day palette colour. */
  color: string;
}

const VIEW_W = 100;
const VIEW_H = 56;

const RAIL = 3.5;
/** Switch where the lead splits into the three classification tracks. */
const SWITCH = { x: 38, y: 35 };
const TRACK_Y = [18, 35, 52] as const;

/** Lead track arching over the hump ("lomo") down to the switch. */
const LEAD = `M2,42 Q16,24 30,35 L${SWITCH.x},${SWITCH.y}`;
/** Rail height under the lead's crest, where the cresting wagon sits. */
const CREST = { x: 7, railY: 31 };
/** Embankment under the hump, kept left of the switch so it never covers a branch. */
const HUMP = `M0,52 L0,43 Q16,23 31,35 L${SWITCH.x},${SWITCH.y} L${SWITCH.x},52 Z`;
const FAN = [
  `M${SWITCH.x},${SWITCH.y} C46,${SWITCH.y} 48,${TRACK_Y[0]} 58,${TRACK_Y[0]} L96,${TRACK_Y[0]}`,
  `M${SWITCH.x},${SWITCH.y} L96,${TRACK_Y[1]}`,
  `M${SWITCH.x},${SWITCH.y} C46,${SWITCH.y} 48,${TRACK_Y[2]} 58,${TRACK_Y[2]} L96,${TRACK_Y[2]}`,
].join(' ');

/** Low boxcar side (18×8.5) sitting on a rail at `railY`, with a door cut-out. */
function wagonPath(x: number, railY: number): string {
  const top = railY - 11;
  return `M${x},${top} h18 v8.5 h-18 Z M${x + 7},${top + 1.5} h4 v5 h-4 Z`;
}

function Wheels({ x, railY }: { x: number; railY: number }) {
  return (
    <>
      <Circle cx={x + 4} cy={railY - 2} r={2.2} />
      <Circle cx={x + 14} cy={railY - 2} r={2.2} />
    </>
  );
}

/**
 * "Patio de Clasificación" mark for the mode card: a wagon cresting the hump,
 * the lead track splitting at a switch into three classification tracks,
 * each ending in a buffer stop, with wagons already sorted onto them. Same
 * 100×56 grid and one-colour-plus-overlay treatment as LocoIcon, tinted from
 * the time-of-day palette.
 */
export default function ClassificationIcon({ width = 64, color }: ClassificationIconProps) {
  const height = (width * VIEW_H) / VIEW_W;
  const tone = secondToneOverlay(color);
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
      {/* Hump embankment in the second tone. */}
      <Path d={HUMP} fill={color} />
      <Path d={HUMP} {...tone} />

      {/* Rails: lead over the hump, then the three-way fan. */}
      <Path d={`${LEAD} ${FAN}`} stroke={color} strokeWidth={RAIL} strokeLinecap="round" fill="none" />
      <Circle cx={SWITCH.x} cy={SWITCH.y} r={3.2} fill={color} />

      {/* Buffer stops at the far end of every classification track. */}
      <G fill={color}>
        {TRACK_Y.map((y) => (
          <Rect key={y} x={95.5} y={y - 4.5} width={3.5} height={7} rx={1} />
        ))}
      </G>

      {/* Wagon cresting the hump — the one being sorted. Full colour so it
          stands out against the second-tone embankment. */}
      <G fill={color}>
        <Path d={wagonPath(CREST.x, CREST.railY)} fillRule="evenodd" />
        <Wheels x={CREST.x} railY={CREST.railY} />
      </G>

      {/* Wagons already sorted onto their tracks — alternating tones read as
          different destination colours. */}
      <G fill={color}>
        <Path d={wagonPath(72, TRACK_Y[0])} fillRule="evenodd" />
        <Wheels x={72} railY={TRACK_Y[0]} />
        <Path d={wagonPath(64, TRACK_Y[1])} fillRule="evenodd" />
        <Wheels x={64} railY={TRACK_Y[1]} />
        <Path d={wagonPath(72, TRACK_Y[2])} fillRule="evenodd" />
        <Wheels x={72} railY={TRACK_Y[2]} />
      </G>
      <Path d={wagonPath(64, TRACK_Y[1])} {...tone} fillRule="evenodd" />
    </Svg>
  );
}
