import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamilyMenu, radii, spacing, type TimeOfDayPalette } from '../../design/tokens';
import StarRow from './StarRow';
import { LockIcon } from './icons';
import { fireHaptic } from '../controller/haptics';

interface LevelCardProps {
  levelId: number;
  /** "NIVEL" | "TURNO". */
  kindLabel: string;
  stars: 0 | 1 | 2 | 3;
  /** e.g. "480pts" or "12m" — empty string when not yet completed. */
  scoreCaption: string;
  width: number;
  height: number;
  /** Active time-of-day palette — drives the glass card fill/border/text. */
  palette: TimeOfDayPalette;
  /** Called on tap when the card is NOT locked (normal navigation). */
  onPress: () => void;
  /** When true: dims the card, swaps the number/star column for a lock
   *  glyph, and routes taps to `onLockedPress` instead of `onPress` —
   *  section-based progression (LevelSelectScreen). Defaults to false so
   *  every existing caller keeps behaving exactly as before. */
  locked?: boolean;
  /** Called on tap when the card IS locked — e.g. show an "unlock" toast.
   *  Ignored when `locked` is false. */
  onLockedPress?: () => void;
}

/**
 * Level-select grid card — compact horizontal tile per design_handoff_menus
 * §5's "2a" board, redrawn for a landscape-locked viewport (see
 * design/tokens.ts `levelCardAspectRatio`'s doc comment): the number sits
 * left, stars/score sit right, a star-tier stripe runs the left edge, and a
 * thin progress sliver runs the bottom edge — no tall vertical stack, so
 * several full rows fit on screen without the grid reading as a wall of
 * empty panels. Reskinned to the active time-of-day glass; the star tier
 * stripe and lock glyph stay semantic (not time-of-day tinted) — only the
 * card's own chrome (fill/border/text) follows the palette.
 */
export default function LevelCard({
  levelId,
  kindLabel,
  stars,
  scoreCaption,
  width,
  height,
  palette,
  onPress,
  locked = false,
  onLockedPress,
}: LevelCardProps) {
  const tierColor = locked ? palette.hud.textDim : colors.starTierStripe[stars];
  const numberSize = Math.min(22, Math.max(16, width * 0.13));
  const kindLabelSize = Math.min(9, Math.max(7.5, width * 0.05));
  const starRadius = Math.min(6, Math.max(4.5, width * 0.038));
  const captionSize = Math.min(10, Math.max(8, width * 0.055));
  const lockIconSize = Math.min(22, Math.max(16, width * 0.14));

  const label = locked
    ? `${kindLabel} ${levelId}, bloqueado`
    : stars > 0
      ? `${kindLabel} ${levelId}, completado, ${stars} de 3 estrellas${scoreCaption ? `, ${scoreCaption}` : ''}`
      : `${kindLabel} ${levelId}, sin completar`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: locked }}
      accessibilityLabel={label}
      onPress={() => {
        if (locked) {
          void fireHaptic('selection');
          onLockedPress?.();
          return;
        }
        void fireHaptic('light');
        onPress();
      }}
      style={({ pressed }) => [
        styles.card,
        {
          width,
          height,
          backgroundColor: palette.hud.buttonBg,
          borderColor: palette.hud.buttonBorder,
        },
        pressed && !locked ? { transform: [{ scale: 0.97 }] } : null,
      ]}
    >
      <View style={[styles.stripe, { backgroundColor: tierColor }]} />

      {locked ? (
        <View style={styles.lockedContent}>
          <Text style={[styles.kindLabel, { fontSize: kindLabelSize, color: palette.hud.textDim }]} maxFontSizeMultiplier={1.3}>
            {kindLabel}
          </Text>
          <LockIcon size={lockIconSize} color={palette.hud.textDim} />
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.left}>
            <Text style={[styles.kindLabel, { fontSize: kindLabelSize, color: palette.hud.textDim }]} maxFontSizeMultiplier={1.3}>
              {kindLabel}
            </Text>
            <Text
              style={[styles.number, { fontSize: numberSize, color: stars > 0 ? palette.hud.text : palette.hud.textDim }]}
              maxFontSizeMultiplier={1.3}
            >
              {levelId}
            </Text>
          </View>
          <View style={styles.right}>
            <StarRow stars={stars} radius={starRadius} />
            {scoreCaption ? (
              <Text style={[styles.caption, { fontSize: captionSize, color: palette.hud.textDim }]} maxFontSizeMultiplier={1.3}>
                {scoreCaption}
              </Text>
            ) : null}
          </View>
        </View>
      )}

      {!locked && (
        <View style={styles.progressWrap}>
          <View style={[styles.progressTrack, { backgroundColor: palette.hud.buttonBorder }]}>
            <View style={[styles.progressFill, { backgroundColor: tierColor, width: `${(stars / 3) * 100}%` }]} />
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  stripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
  },
  lockedContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    opacity: 0.5,
  },
  left: {
    flexShrink: 1,
    justifyContent: 'center',
  },
  right: {
    alignItems: 'flex-end',
    gap: 3,
  },
  kindLabel: {
    fontFamily: fontFamilyMenu.semiBold,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  number: {
    fontFamily: fontFamilyMenu.bold,
    fontWeight: '700',
  },
  caption: {
    fontFamily: fontFamilyMenu.semiBold,
    fontWeight: '600',
  },
  progressWrap: {
    paddingHorizontal: spacing.sm,
    paddingBottom: 6,
  },
  progressTrack: {
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    borderRadius: 1.5,
  },
});
