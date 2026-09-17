import React, { useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { getTimeOfDayPalette, radii, spacing, typeScaleMenu, withAlpha } from '../../design/tokens';
import Button from '../components/Button';
import SkyBackground from '../components/SkyBackground';
import HillSilhouette from '../components/HillSilhouette';
import { ClockIcon } from '../components/icons';
import { fireHaptic } from '../controller/haptics';
import { usePlayer } from '../controller/PlayerContext';
import { useTimeOfDay, useTimeOfDaySetting } from '../render/iso/timeOfDay';
import type { RootScreenProps } from '../navigation/types';

/**
 * Login screen — name entry, persisted (ref/js/main.js `setupLogin`).
 * Reskinned per design_handoff_menus §5: full-bleed time-of-day sky with a
 * hill/signal-tower silhouette, a translucent "glass" card, and a clock
 * badge advertising the automatic palette. Landscape translation: the
 * portrait mockup's single centered column becomes a width-capped
 * (`maxWidth: 420`) card centered in the wide viewport — the sky fills the
 * rest, which reads intentionally (a focused island on an open horizon)
 * rather than as empty space; vertical paddings are trimmed from the
 * mockup's portrait numbers so the whole card clears a ~360dp-tall
 * landscape safe area without scrolling.
 */
export default function LoginScreen({ navigation }: RootScreenProps<'Login'>) {
  const { playerName, setPlayerName } = usePlayer();
  const [name, setName] = useState(playerName);
  const [focused, setFocused] = useState(false);
  const shakeX = useSharedValue(0);
  const inputRef = useRef<TextInput>(null);

  const resolvedTimeOfDay = useTimeOfDay();
  const setting = useTimeOfDaySetting();
  const palette = getTimeOfDayPalette(resolvedTimeOfDay);
  const clockLabel = setting === 'auto' ? `AUTOMÁTICO · ${palette.label.toUpperCase()}` : palette.label.toUpperCase();

  const tryStart = () => {
    const trimmed = name.trim();
    if (trimmed) {
      setPlayerName(trimmed);
      Keyboard.dismiss();
      navigation.replace('ModeSelect');
    } else {
      void fireHaptic('error');
      shakeX.value = withSequence(
        withTiming(-8, { duration: 60 }),
        withTiming(8, { duration: 80 }),
        withTiming(-5, { duration: 80 }),
        withTiming(5, { duration: 80 }),
        withTiming(0, { duration: 100 })
      );
    }
  };

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  return (
    <View style={styles.background}>
      <SkyBackground palette={palette} gradientId="loginSky" />

      {/* Hill silhouette + a minimal signal-tower mark, per design_handoff_menus
          §5 ("colinas y torre de señales en silueta, 2 formas"). */}
      <HillSilhouette
        palette={palette}
        pathD="M0,60 L70,32 L150,54 L230,28 L300,52 L360,36 L360,90 L0,90 Z"
        viewBoxHeight={90}
        height={72}
        style={styles.hill}
      />
      <View
        style={[styles.tower, { opacity: palette.scenery.hillOpacity }]}
        pointerEvents="none"
      >
        <View style={[styles.towerPole, { backgroundColor: palette.scenery.structure }]} />
        <View style={[styles.towerHead, { backgroundColor: palette.scenery.structure }]} />
      </View>

      <View style={[styles.clockBadge, { backgroundColor: palette.hud.buttonBg, borderColor: palette.hud.buttonBorder }]}>
        <ClockIcon size={12} color={palette.hud.accent} />
        <Text style={[styles.clockLabel, { color: palette.hud.accent }]} maxFontSizeMultiplier={1.2} numberOfLines={1}>
          {clockLabel}
        </Text>
      </View>

      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flexCenter}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View
            style={[
              styles.card,
              { backgroundColor: palette.hud.buttonBg, borderColor: palette.hud.buttonBorder },
            ]}
          >
            <View style={styles.logoRow}>
              <View style={[styles.logoBox, { backgroundColor: palette.hud.accent }]} />
              <View style={[styles.logoCab, { backgroundColor: palette.hud.accent }]} />
              <View
                style={[
                  styles.logoLight,
                  { backgroundColor: palette.hud.text, shadowColor: palette.hud.accent },
                ]}
              />
            </View>
            <Text style={[styles.title, { color: palette.hud.text }]} maxFontSizeMultiplier={1.3}>
              Patio de Trenes
            </Text>
            <Text style={[styles.subtitle, { color: palette.hud.textDim }]} maxFontSizeMultiplier={1.3}>
              Puzzles ferroviarios
            </Text>

            <Animated.View style={[styles.inputWrap, shakeStyle]}>
              <TextInput
                ref={inputRef}
                value={name}
                onChangeText={setName}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onSubmitEditing={tryStart}
                placeholder="Tu nombre"
                placeholderTextColor={withAlpha(palette.hud.text, 0.35)}
                style={[
                  styles.input,
                  {
                    backgroundColor: withAlpha(palette.hud.text, 0.08),
                    borderColor: focused ? palette.hud.accent : palette.hud.buttonBorder,
                    color: palette.hud.text,
                  },
                ]}
                returnKeyType="go"
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={24}
                maxFontSizeMultiplier={1.3}
                accessibilityLabel="Tu nombre"
              />
            </Animated.View>

            <Button
              label="COMENZAR"
              onPress={tryStart}
              variant="primary"
              width="100%"
              height={52}
              style={styles.submit}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#0b0d12',
  },
  hill: {
    // `width` is explicit numeric pixels from HillSilhouette's own
    // useWindowDimensions() call — no `right: 0` needed (or wanted:
    // combining an explicit numeric width with left+right insets is the
    // same ambiguous-sizing class of bug SkyBackground/HillSilhouette fix).
    position: 'absolute',
    left: 0,
    bottom: 0,
  },
  tower: {
    position: 'absolute',
    right: '16%',
    bottom: 34,
    alignItems: 'center',
  },
  towerPole: {
    width: 2.5,
    height: 38,
  },
  towerHead: {
    position: 'absolute',
    top: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  clockBadge: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    height: 26,
    borderRadius: radii.pill,
    borderWidth: 1,
    zIndex: 2,
  },
  clockLabel: {
    ...typeScaleMenu.micro,
  },
  safe: {
    flex: 1,
  },
  flexCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    paddingVertical: spacing.xl,
    paddingHorizontal: 28,
    borderRadius: radii.xl,
    borderWidth: 1,
    alignItems: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    marginBottom: spacing.sm,
  },
  logoBox: {
    width: 26,
    height: 18,
    borderRadius: 2,
  },
  logoCab: {
    width: 12,
    height: 13,
    borderRadius: 2,
    marginBottom: 5,
  },
  logoLight: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginBottom: 6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    ...typeScaleMenu.h1,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  subtitle: {
    ...typeScaleMenu.bodySmall,
    letterSpacing: 0.6,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  inputWrap: {
    width: '100%',
  },
  input: {
    height: 50,
    borderRadius: radii.md,
    borderWidth: 1.4,
    ...typeScaleMenu.h3,
    textAlign: 'center',
    letterSpacing: 1,
    paddingHorizontal: spacing.md,
  },
  submit: {
    marginTop: spacing.lg,
  },
});
