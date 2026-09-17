import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii } from '../../design/tokens';
import { SoundIcon, SoundOffIcon } from './icons';
import { SoundManager } from '../audio/sounds';
import { fireHaptic } from '../controller/haptics';

interface MuteToggleButtonProps {
  size?: number;
  /** @deprecated Unused now that this renders an SVG icon instead of a text
   *  glyph — icon size derives from `size`. Kept so existing call sites
   *  (TopBar) don't need touching as part of this reskin. */
  fontSize?: number;
  style?: ViewStyle;
  /**
   * Fill to use instead of the default neutral. The in-game TopBar passes the
   * active time-of-day's glass so this button doesn't stay a dark slate chip
   * on the light midday bar; the menu screens pass the active palette's
   * `hud.buttonBg` for the same reason.
   */
  color?: string;
  /** Icon stroke/fill tint. Defaults to white to match the pre-reskin glyph. */
  iconColor?: string;
  /** Glass border — menu screens pass `hud.buttonBorder`; TopBar leaves the
   *  default (no visible border) so its chip looks the same as before. */
  borderColor?: string;
}

/**
 * Speaker/mute icon button — reflects `SoundManager.isMuted()` and toggles
 * it on press. Placed on the ModeSelect header (top-right) and the in-game
 * TopBar so the player can silence SFX from either screen; the preference
 * is shared (persisted in AsyncStorage by SoundManager) so toggling it in
 * one place updates the icon everywhere else via `onMuteChange`.
 */
export default function MuteToggleButton({
  size = 40,
  style,
  color = colors.button.neutral,
  iconColor = '#ffffff',
  borderColor = 'transparent',
}: MuteToggleButtonProps) {
  const [muted, setMutedState] = useState(SoundManager.isMuted());

  useEffect(() => {
    setMutedState(SoundManager.isMuted());
    return SoundManager.onMuteChange(setMutedState);
  }, []);

  const Icon = muted ? SoundOffIcon : SoundIcon;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={muted ? 'Activar sonido' : 'Silenciar sonido'}
      hitSlop={8}
      onPress={() => {
        void fireHaptic('light');
        void SoundManager.setMuted(!muted);
      }}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size, backgroundColor: color, borderColor, opacity: pressed ? 0.85 : 1 },
        pressed ? { transform: [{ scale: 0.97 }] } : null,
        style,
      ]}
    >
      <Icon size={Math.round(size * 0.42)} color={iconColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
