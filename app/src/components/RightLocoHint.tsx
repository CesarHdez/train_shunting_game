import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { radii, spacing, typeScaleMenu } from '../../design/tokens';
import { usePalette } from '../render/iso/timeOfDay';
import Button from './Button';
import { scrimColorFor } from './copy';
import { RIGHT_LOCO_HINT_COPY } from '../controller/tutorial';

interface RightLocoHintProps {
  visible: boolean;
  onDismiss: () => void;
}

/**
 * One-time discoverability hint for levels with a second (right-side)
 * locomotive — see src/controller/tutorial.ts `RIGHT_LOCO_HINT_COPY` for the
 * persisted "seen" flag and copy, and shuntingController.ts for the
 * show/dismiss logic. Visually mirrors TutorialOverlay's blocking modal card
 * so the two read as the same product, but is its own lightweight component
 * since it isn't part of the step-indexed tutorial state machine — it's a
 * single dismiss-and-forget card, not a multi-step flow.
 */
export default function RightLocoHint({ visible, onDismiss }: RightLocoHintProps) {
  const { width } = useWindowDimensions();
  const palette = usePalette();
  const { hud } = palette;
  if (!visible) return null;

  const cardWidth = Math.min(500, width - 40);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: scrimColorFor(palette) }]} />
      <View style={styles.centerWrap} pointerEvents="box-none">
        <View style={[styles.modalCard, { width: cardWidth, backgroundColor: hud.buttonBg, borderColor: hud.buttonBorder }]}>
          <Text style={[styles.modalTitle, { color: hud.statWarning }]} maxFontSizeMultiplier={1.3}>
            {RIGHT_LOCO_HINT_COPY.title}
          </Text>
          {RIGHT_LOCO_HINT_COPY.lines.map((line) => (
            <Text key={line} style={[styles.modalLine, { color: hud.text }]} maxFontSizeMultiplier={1.3}>
              {line}
            </Text>
          ))}
          <Button
            label={RIGHT_LOCO_HINT_COPY.button}
            onPress={onDismiss}
            variant="primary"
            width={180}
            height={44}
            style={styles.modalButton}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    borderRadius: radii.lg,
    borderWidth: 2,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  modalTitle: {
    ...typeScaleMenu.h1,
    marginBottom: spacing.md,
  },
  modalLine: {
    ...typeScaleMenu.body,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  modalButton: {
    marginTop: spacing.lg,
  },
});
