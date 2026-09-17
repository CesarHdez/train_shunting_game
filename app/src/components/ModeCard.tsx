import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { fontFamilyMenu, layout, radii, spacing, typeScaleMenu, type TimeOfDayPalette } from '../../design/tokens';
import { fireHaptic } from '../controller/haptics';

interface ModeCardProps {
  /** Small mode-identity mark (mini loco silhouette, switch glyph, …) — a
   *  React node instead of an emoji glyph, per design_handoff_menus §3. */
  icon: React.ReactNode;
  title: string;
  subtitleLines: [string, string];
  accentColor: string;
  progressLabel: string;
  progressFraction: number; // 0..1
  /** Active time-of-day palette — drives the glass card fill/border/text. */
  palette: TimeOfDayPalette;
  onPress: () => void;
}

const RING_SIZE = 38;
const RING_STROKE = 3.5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** Mode-select card — PATIO DE MANIOBRAS / PATIO DE CLASIFICACIÓN, reskinned
 *  to the "Hora Dorada" glass per design_handoff_menus §5 (circular progress
 *  ring replaces the old plain "%"-less text; the card now reads its glass
 *  fill/border/text straight off the active time-of-day palette instead of
 *  a fixed dark theme). */
export default function ModeCard({
  icon,
  title,
  subtitleLines,
  accentColor,
  progressLabel,
  progressFraction,
  palette,
  onPress,
}: ModeCardProps) {
  const fraction = Math.min(1, Math.max(0, progressFraction));
  const pct = Math.round(fraction * 100);
  const dashOffset = RING_CIRCUMFERENCE * (1 - fraction);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitleLines.join(' ')} Progreso: ${progressLabel}.`}
      onPress={() => {
        void fireHaptic('light');
        onPress();
      }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: palette.hud.buttonBg,
          borderColor: pressed ? accentColor : palette.hud.buttonBorder,
        },
        pressed ? { transform: [{ scale: 0.98 }] } : null,
      ]}
    >
      <View style={styles.ringWrap} pointerEvents="none">
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={palette.hud.buttonBorder}
            strokeWidth={RING_STROKE}
            fill="none"
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={accentColor}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </Svg>
        <Text style={[styles.ringLabel, { color: accentColor }]} maxFontSizeMultiplier={1.1}>
          {pct}%
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.iconWrap}>{icon}</View>
        <Text style={[styles.title, { color: palette.hud.text }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {title}
        </Text>
        <Text style={[styles.subtitle, { color: palette.hud.textDim }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>
          {subtitleLines.join(' ')}
        </Text>
      </View>

      <View style={styles.footer}>
        <View style={[styles.progressTrack, { backgroundColor: palette.hud.buttonBorder }]}>
          <View style={[styles.progressFill, { backgroundColor: accentColor, width: `${pct}%` }]} />
        </View>
        <Text style={[styles.progressLabel, { color: palette.hud.textDim }]} maxFontSizeMultiplier={1.3}>
          {progressLabel}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    height: layout.modeCardHeight,
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  ringWrap: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabel: {
    position: 'absolute',
    fontFamily: fontFamilyMenu.bold,
    fontSize: 10,
    fontWeight: '800',
  },
  content: {
    flex: 1,
    paddingRight: RING_SIZE + spacing.sm,
  },
  iconWrap: {
    marginBottom: spacing.sm,
  },
  title: {
    ...typeScaleMenu.h2,
  },
  subtitle: {
    ...typeScaleMenu.bodySmall,
    marginTop: spacing.xs,
  },
  footer: {
    marginTop: spacing.sm,
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 5,
    borderRadius: 3,
  },
  progressLabel: {
    ...typeScaleMenu.micro,
    marginTop: spacing.xs,
  },
});
