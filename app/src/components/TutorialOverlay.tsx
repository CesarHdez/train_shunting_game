import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { radii, spacing, typeScaleMenu } from '../../design/tokens';
import { usePalette } from '../render/iso/timeOfDay';
import Button from './Button';
import { ForwardIcon } from './icons';
import { scrimColorFor } from './copy';
import {
  TUTORIAL_MODAL_COPY,
  TUTORIAL_MODALS,
  tutorialHintText,
  type TutorialModalCopy,
} from '../controller/tutorial';

interface TutorialOverlayProps {
  step: number;
  onAdvanceModal: () => void;
  onSkip: () => void;
  /**
   * Ordered blocking modals, index === step while `step < modals.length`.
   * Defaults to the shunting welcome/objective pair so existing callers
   * (shunting) don't need to change.
   */
  modals?: readonly TutorialModalCopy[];
  /** Hint banner text for steps `>= modals.length`, or null to hide. Defaults to the shunting hints. */
  hintText?: (step: number) => string | null;
  skipLabel?: string;
}

/**
 * First-play tutorial UI — ported from ref/js/shunting/renderer.js
 * `drawTutorialModal`/`drawTutorialHint`. The leading `modals` steps are a
 * blocking centered modal (welcome / rules / objective, one per step); the
 * remaining steps are a non-blocking hint banner — the board stays
 * interactive underneath (gating happens in the controller, see
 * src/controller/tutorial.ts) and only the taught tap is accepted.
 *
 * Shared by both game modes (shunting and classification) — pass `modals`/
 * `hintText` to swap the copy; the shunting pair is the default so the
 * original call sites keep working unchanged.
 *
 * NOTE: the reference also pulses a glow around the exact on-canvas target
 * (loco button / car / track) during hint steps. That highlight needs pixel
 * coordinates only the Skia renderer knows — it isn't reproduced here. If
 * `boardContract.ts` grows an optional `tutorialTarget` prop, the renderer
 * can draw that glow itself; this overlay only owns the text banner.
 */
export default function TutorialOverlay({
  step,
  onAdvanceModal,
  onSkip,
  modals = TUTORIAL_MODALS,
  hintText = tutorialHintText,
  skipLabel = TUTORIAL_MODAL_COPY.skipLabel,
}: TutorialOverlayProps) {
  const { width } = useWindowDimensions();
  const palette = usePalette();
  const { hud } = palette;

  if (step === -1) return null;

  if (step < modals.length) {
    const copy = modals[step];
    const cardWidth = Math.min(500, width - 40);
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="auto">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: scrimColorFor(palette) }]} />
        <View style={styles.centerWrap} pointerEvents="box-none">
          <View style={[styles.modalCard, { width: cardWidth, backgroundColor: hud.buttonBg, borderColor: hud.buttonBorder }]}>
            <Text style={[styles.modalTitle, { color: hud.statSuccess }]} maxFontSizeMultiplier={1.3}>
              {copy.title}
            </Text>
            {copy.lines.map((line) => (
              <Text key={line} style={[styles.modalLine, { color: hud.text }]} maxFontSizeMultiplier={1.3}>
                {line}
              </Text>
            ))}
            <Button
              label={copy.button}
              icon={<ForwardIcon />}
              iconSide="trailing"
              onPress={onAdvanceModal}
              variant="primary"
              width={180}
              height={44}
              style={styles.modalButton}
            />
            <Text
              style={[styles.skipLink, { color: hud.textDim }]}
              onPress={onSkip}
              maxFontSizeMultiplier={1.3}
              accessibilityRole="button"
              accessibilityLabel={skipLabel}
            >
              {skipLabel}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const hint = hintText(step);
  if (!hint) return null;

  return (
    <View style={styles.hintWrap} pointerEvents="box-none">
      <View style={[styles.hintBanner, { backgroundColor: hud.buttonBg, borderColor: hud.buttonBorder }]}>
        <Text style={[styles.hintText, { color: hud.text }]} maxFontSizeMultiplier={1.3} numberOfLines={2}>
          {hint}
        </Text>
      </View>
      <Button
        label="SALTAR"
        onPress={onSkip}
        variant="secondary"
        width={90}
        height={40}
        style={styles.skipButton}
      />
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
  skipLink: {
    ...typeScaleMenu.caption,
    marginTop: spacing.md,
    textDecorationLine: 'underline',
  },
  hintWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 120,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  hintBanner: {
    flexShrink: 1,
    borderRadius: radii.md,
    borderWidth: 1.5,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  hintText: {
    ...typeScaleMenu.body,
  },
  skipButton: {},
});
