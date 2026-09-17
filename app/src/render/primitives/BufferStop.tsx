/**
 * "Topera" / buffer stop — caps a track that dead-ends inside the frame
 * (design/DECISIONES.md §5's refinement: a side WITHOUT a locomotive throat
 * terminates at the level's capacity instead of bleeding off the canvas like
 * a throated end does).
 *
 * Rigid/fixed type, cartooned to this yard's silhouette-first language (same
 * read as the switch-node discs in IsoTrackBed.tsx): a block that closes off
 * the rail (welded rail offcuts / a concrete cap), a crossbeam the buffer
 * heads bear on, and two round heads — the same size and rail-gauge height as
 * a wagon's own buffers, so they visually line up with what would hit them —
 * carrying a high-visibility marking on the block's outer face.
 *
 * Drawn ON the plane inside the same `<Group matrix={camera.matrix}>` as the
 * rest of the track bed (see IsoTrackBed's `deadEndX` prop): static scenery,
 * no BlurMask, no per-frame allocation — one instance per dead-ended row,
 * memoized like every other track-bed piece.
 */

import React from 'react';
import { Circle, Group, Rect } from '@shopify/react-native-skia';

import type { TimeOfDayPalette } from '../../../design/tokens';
import { BUFFER_STOP_DEPTH } from '../layout/common';

export interface BufferStopProps {
  /** Plane u of the block's OUTER face — i.e. where the rail run itself ends. */
  x: number;
  /** Plane v of the rail centreline (same v the row's ties/rails sit on). */
  y: number;
  /** Same value the enclosing IsoTrackBed draws its rails/ties at, so the
   *  buffer's rail-gauge alignment and thickness track the row it caps. */
  ballastWidth: number;
  palette: TimeOfDayPalette;
}

// Along-track split of BUFFER_STOP_DEPTH (see layout/common.ts): block
// (flush with the rail terminus) → beam → heads (closest to an arriving car).
const BLOCK_DEPTH = BUFFER_STOP_DEPTH * 0.4;
const BEAM_DEPTH = BUFFER_STOP_DEPTH * 0.22;
const HEAD_SETBACK = BUFFER_STOP_DEPTH * 0.38;

function BufferStopImpl({ x, y, ballastWidth, palette }: BufferStopProps) {
  // Matches IsoTrackBed's own gauge ratio so the heads sit exactly on the rails.
  const gauge = ballastWidth * 0.262;
  const headR = Math.max(1.5, ballastWidth * 0.15);
  const blockHalfSpan = gauge + headR * 1.5;
  const beamHalfSpan = gauge + headR * 1.1;

  const blockX0 = x - BLOCK_DEPTH;
  const beamX0 = blockX0 - BEAM_DEPTH;
  const headsX = beamX0 - HEAD_SETBACK;
  const stripeW = BLOCK_DEPTH * 0.4;

  return (
    <Group>
      {/* Crossbeam: traditionally a wooden sleeper, more modern stops use an
          elastomeric pad — either way it sits behind the heads. */}
      <Rect
        x={beamX0}
        y={y - beamHalfSpan}
        width={BEAM_DEPTH}
        height={beamHalfSpan * 2}
        color={palette.track.rail}
        opacity={0.85}
      />

      {/* Block: the rigid structure the beam is anchored to — reuses the
          switch-node metal tone so it reads as the same track hardware. */}
      <Rect
        x={blockX0}
        y={y - blockHalfSpan}
        width={BLOCK_DEPTH}
        height={blockHalfSpan * 2}
        color={palette.track.node}
      />
      {/* High-visibility hazard marking on the block's outer (rail-end) face. */}
      <Rect
        x={x - stripeW}
        y={y - blockHalfSpan}
        width={stripeW}
        height={blockHalfSpan * 2}
        color={palette.badge.full}
        opacity={0.9}
      />

      {/* Buffer heads: one per rail, same height as a wagon's own buffers. */}
      <Circle cx={headsX} cy={y - gauge} r={headR} color={palette.badge.full} />
      <Circle cx={headsX} cy={y - gauge} r={headR * 0.5} color={palette.track.node} />
      <Circle cx={headsX} cy={y + gauge} r={headR} color={palette.badge.full} />
      <Circle cx={headsX} cy={y + gauge} r={headR * 0.5} color={palette.track.node} />
    </Group>
  );
}

export const BufferStop = React.memo(BufferStopImpl);
