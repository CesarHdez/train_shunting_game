/**
 * Classification "push" entry marker — pixel-identical to the shunting
 * clearance marker in the reference (`drawPushMarker` === `drawClearanceMarker`),
 * so this simply fixes `direction="right"` on the shared <Marker>.
 */

import React from 'react';
import { Marker } from './Marker';

export interface PushMarkerProps {
  trackX: number;
  rowTop: number;
  rowHeight: number;
  isTarget: boolean;
}

export const PushMarker = React.memo(function PushMarker({ trackX, rowTop, rowHeight, isTarget }: PushMarkerProps) {
  return <Marker trackX={trackX} rowTop={rowTop} rowHeight={rowHeight} isTarget={isTarget} direction="right" />;
});
