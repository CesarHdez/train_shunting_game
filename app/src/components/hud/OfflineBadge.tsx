import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontFamilyMenu, radii, spacing } from '../../../design/tokens';

interface OfflineBadgeProps {
  visible: boolean;
}

/**
 * Subtle "sin conexión" pill for screen headers (LevelSelect/Leaderboard) —
 * shown when the backend's best-effort Firebase calls have most recently
 * failed (see backend/firebase.ts `getConnectivity()`). Purely informational:
 * the game stays fully playable and local progress keeps saving regardless
 * of whether this is visible. Renders nothing (not even a layout gap) when
 * `visible` is false, and nothing while connectivity is merely 'unknown'
 * (e.g. no network call attempted yet this session) — this only fires on a
 * confirmed failure, never as a guess.
 *
 * Text-only per design_handoff_menus §5 ("quitar el emoji ... usar texto
 * solo") — no dedicated "offline" glyph exists in the icon contract, and a
 * borrowed icon would risk misreading as a different status.
 */
export default function OfflineBadge({ visible }: OfflineBadgeProps) {
  if (!visible) return null;
  return (
    <View
      style={styles.pill}
      accessibilityRole="text"
      accessibilityLabel="Sin conexión. Usando datos guardados en este dispositivo."
    >
      <Text style={styles.text} maxFontSizeMultiplier={1.3} numberOfLines={1}>
        SIN CONEXIÓN
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    marginTop: spacing.xs,
    alignSelf: 'center',
    paddingHorizontal: spacing.sm,
    height: 18,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(245,166,35,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: fontFamilyMenu.semiBold,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: colors.status.warning,
  },
});
