import React, { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  colors,
  getTimeOfDayPalette,
  layout,
  radii,
  spacing,
  timeOfDayOrder,
  typeScaleMenu,
  withAlpha,
  type TimeOfDay,
} from '../../design/tokens';
import Button from '../components/Button';
import SkyBackground from '../components/SkyBackground';
import Toast from '../components/hud/Toast';
import { BackIcon, ClockIcon, DeleteIcon, SoundIcon, SoundOffIcon, TrainIcon, VibrationIcon } from '../components/icons';
import { usePlayer } from '../controller/PlayerContext';
import { SoundManager } from '../audio/sounds';
import { TimeOfDayManager, useTimeOfDay, useTimeOfDaySetting } from '../render/iso/timeOfDay';
import { isHapticsMuted, setHapticsMuted } from '../controller/haptics';
import { getBackendApi } from '../controller/backendApi';
import type { RootScreenProps } from '../navigation/types';
// JSON import (tsconfig has resolveJsonModule via expo/tsconfig.base) — avoids
// pulling in expo-constants just for a version string. Falls back to a
// hardcoded string if the field is ever missing/renamed.
import appJson from '../../app.json';

const TOAST_DURATION_MS = 2000;
const APP_VERSION = `v${appJson?.expo?.version ?? '1.0'}`;

/**
 * Settings screen — player name, sound/haptics toggles, local progress
 * reset, and an about/credits block. Reached from ModeSelectScreen's gear
 * header button. Everything here is offline-safe: player name and the
 * sound/haptics preferences persist to AsyncStorage (via PlayerContext,
 * SoundManager and controller/haptics respectively), and "Reiniciar
 * progreso" only clears this device's local score cache — never the
 * Firestore/global leaderboards (see backend/backendApi.ts resetProgress()).
 *
 * Reskinned per design_handoff_menus §5: glass cards on the active
 * time-of-day sky, Raleway type, and the one real structural change in this
 * handoff — "HORA DEL PATIO" now leads with "Automático" as the primary row
 * (with an "ACTIVO" pill when it's the active preference) and demotes the 4
 * manual bands to smaller override swatches below it.
 */
export default function SettingsScreen({ navigation }: RootScreenProps<'Settings'>) {
  const { playerName, setPlayerName } = usePlayer();
  const [name, setName] = useState(playerName);
  const [soundOn, setSoundOn] = useState(!SoundManager.isMuted());
  const [hapticsOn, setHapticsOn] = useState(!isHapticsMuted());
  const resolvedTimeOfDay = useTimeOfDay();
  const setting = useTimeOfDaySetting();
  const palette = getTimeOfDayPalette(resolvedTimeOfDay);
  const isAuto = setting === 'auto';
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the input in sync if playerName loads/changes after this screen
  // already mounted (e.g. PlayerProvider's async AsyncStorage read resolves
  // late).
  useEffect(() => {
    setName(playerName);
  }, [playerName]);

  useEffect(() => {
    setSoundOn(!SoundManager.isMuted());
    return SoundManager.onMuteChange((muted) => setSoundOn(!muted));
  }, []);

  useEffect(
    () => () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    },
    []
  );

  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), TOAST_DURATION_MS);
  };

  const saveName = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(playerName); // revert an empty/blank edit rather than saving it
      return;
    }
    setPlayerName(trimmed);
    Keyboard.dismiss();
    showToast('Nombre guardado.');
  };

  const toggleSound = (value: boolean) => {
    setSoundOn(value);
    void SoundManager.setMuted(!value);
  };

  const toggleHaptics = (value: boolean) => {
    setHapticsOn(value);
    void setHapticsMuted(!value);
  };

  const confirmResetProgress = () => {
    Alert.alert(
      'Reiniciar progreso',
      'Se borrarán todos los puntajes y estrellas guardados en este dispositivo, en Patio de Maniobras y Patio de Clasificación. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reiniciar',
          style: 'destructive',
          onPress: () => {
            void getBackendApi()
              .resetProgress()
              .then(() => showToast('Progreso reiniciado.'));
          },
        },
      ]
    );
  };

  return (
    <View style={styles.background}>
      <SkyBackground palette={palette} gradientId="settingsSky" />

      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            hitSlop={8}
            onPress={() => {
              navigation.goBack();
            }}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: palette.hud.buttonBg, borderColor: palette.hud.buttonBorder, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <BackIcon size={14} color={palette.hud.accent} />
            <Text style={[styles.chipLabel, { color: palette.hud.accent }]} maxFontSizeMultiplier={1.2}>
              VOLVER
            </Text>
          </Pressable>
          <Text style={[styles.title, { color: palette.hud.text }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            AJUSTES
          </Text>
          <View style={{ width: 90 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* 1. Nombre del jugador */}
          <View style={[styles.card, { backgroundColor: palette.hud.buttonBg, borderColor: palette.hud.buttonBorder }]}>
            <Text style={[styles.cardTitle, { color: palette.hud.text }]} maxFontSizeMultiplier={1.3}>
              NOMBRE DEL JUGADOR
            </Text>
            <View style={styles.nameRow}>
              <TextInput
                value={name}
                onChangeText={setName}
                onSubmitEditing={saveName}
                placeholder="Tu nombre"
                placeholderTextColor={withAlpha(palette.hud.text, 0.35)}
                style={[
                  styles.input,
                  {
                    backgroundColor: withAlpha(palette.hud.text, 0.08),
                    borderColor: palette.hud.buttonBorder,
                    color: palette.hud.text,
                  },
                ]}
                returnKeyType="done"
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={24}
                maxFontSizeMultiplier={1.3}
                accessibilityLabel="Nombre del jugador"
              />
              <Button
                label="GUARDAR"
                onPress={saveName}
                variant="primary"
                width={96}
                height={44}
                fontSize={12}
              />
            </View>
          </View>

          {/* 2. Sonido */}
          <View
            style={[styles.card, styles.rowCard, { backgroundColor: palette.hud.buttonBg, borderColor: palette.hud.buttonBorder }]}
          >
            <View style={styles.rowLead}>
              {soundOn ? (
                <SoundIcon size={18} color={palette.hud.textDim} />
              ) : (
                <SoundOffIcon size={18} color={palette.hud.textDim} />
              )}
              <View style={styles.rowText}>
                <Text style={[styles.cardTitle, { color: palette.hud.text }]} maxFontSizeMultiplier={1.3}>
                  SONIDO
                </Text>
                <Text style={[styles.cardSubtitle, { color: palette.hud.textDim }]} maxFontSizeMultiplier={1.3}>
                  {soundOn ? 'Sonido activado' : 'Sonido desactivado'}
                </Text>
              </View>
            </View>
            <Switch
              value={soundOn}
              onValueChange={toggleSound}
              trackColor={{ false: palette.hud.buttonBorder, true: palette.hud.accent }}
              thumbColor="#ffffff"
              accessibilityLabel={soundOn ? 'Desactivar sonido' : 'Activar sonido'}
            />
          </View>

          {/* 3. Vibración */}
          <View
            style={[styles.card, styles.rowCard, { backgroundColor: palette.hud.buttonBg, borderColor: palette.hud.buttonBorder }]}
          >
            <View style={styles.rowLead}>
              <VibrationIcon size={18} color={palette.hud.textDim} />
              <View style={styles.rowText}>
                <Text style={[styles.cardTitle, { color: palette.hud.text }]} maxFontSizeMultiplier={1.3}>
                  VIBRACIÓN
                </Text>
                <Text style={[styles.cardSubtitle, { color: palette.hud.textDim }]} maxFontSizeMultiplier={1.3}>
                  {hapticsOn ? 'Vibración activada' : 'Vibración desactivada'}
                </Text>
              </View>
            </View>
            <Switch
              value={hapticsOn}
              onValueChange={toggleHaptics}
              trackColor={{ false: palette.hud.buttonBorder, true: palette.hud.accent }}
              thumbColor="#ffffff"
              accessibilityLabel={hapticsOn ? 'Desactivar vibración' : 'Activar vibración'}
            />
          </View>

          {/* 4. Hora del patio — "Automático" (the device clock, default) is
                 now the primary row; the 4 manual passes are a smaller
                 override strip below it, per design_handoff_menus §5. */}
          <View style={[styles.card, { backgroundColor: palette.hud.buttonBg, borderColor: palette.hud.buttonBorder }]}>
            <Text style={[styles.cardTitle, { color: palette.hud.text }]} maxFontSizeMultiplier={1.3}>
              HORA DEL PATIO
            </Text>
            <Text style={[styles.cardSubtitle, { color: palette.hud.textDim }]} maxFontSizeMultiplier={1.3}>
              Sigue la hora de tu dispositivo. Puedes fijar una franja manualmente.
            </Text>

            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: isAuto }}
              accessibilityLabel="Automático — sigue la hora del dispositivo"
              onPress={() => void TimeOfDayManager.set('auto')}
              style={[
                styles.autoRow,
                {
                  borderColor: isAuto ? palette.hud.accent : palette.hud.buttonBorder,
                  backgroundColor: isAuto ? withAlpha(palette.hud.accent, 0.12) : 'transparent',
                },
              ]}
            >
              <ClockIcon size={16} color={palette.hud.accent} />
              <Text style={[styles.autoLabel, { color: palette.hud.text }]} maxFontSizeMultiplier={1.3}>
                Automático
              </Text>
              {isAuto ? (
                <Text style={[styles.autoActive, { color: palette.hud.accent }]} maxFontSizeMultiplier={1.2}>
                  ACTIVO
                </Text>
              ) : null}
            </Pressable>

            <View style={styles.todRow}>
              {timeOfDayOrder.map((key: TimeOfDay) => {
                const p = getTimeOfDayPalette(key);
                const selected = !isAuto && key === setting;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Fijar manualmente en ${p.label}`}
                    onPress={() => void TimeOfDayManager.set(key)}
                    style={[styles.todOption, { borderColor: selected ? palette.hud.accent : 'transparent' }]}
                  >
                    <View style={[styles.todSwatch, { backgroundColor: p.sky.colors[0] }]}>
                      <View style={[styles.todSwatchSky, { backgroundColor: p.sky.colors[p.sky.colors.length - 1] }]} />
                      <View style={[styles.todSwatchGround, { backgroundColor: p.ground.colors[1] }]} />
                      <View style={[styles.todSwatchRail, { backgroundColor: p.track.rail }]} />
                    </View>
                    <Text
                      style={[styles.todLabel, { color: selected ? palette.hud.text : palette.hud.textDim }]}
                      numberOfLines={1}
                      maxFontSizeMultiplier={1.3}
                    >
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 5. Reiniciar progreso — fixed danger fill, not palette-driven. */}
          <View style={[styles.card, { backgroundColor: palette.hud.buttonBg, borderColor: palette.hud.buttonBorder }]}>
            <Text style={[styles.cardTitle, styles.dangerTitle]} maxFontSizeMultiplier={1.3}>
              REINICIAR PROGRESO
            </Text>
            <Text style={[styles.cardSubtitle, { color: palette.hud.textDim }]} maxFontSizeMultiplier={1.3}>
              Borra los puntajes y estrellas guardados localmente en ambos modos de juego. No afecta las tablas
              globales.
            </Text>
            <Button
              label="REINICIAR PROGRESO"
              icon={<DeleteIcon />}
              onPress={confirmResetProgress}
              variant="danger"
              width="100%"
              height={46}
              fontSize={13}
              style={styles.resetButton}
            />
          </View>

          {/* 6. Acerca de */}
          <View style={[styles.card, styles.aboutCard, { backgroundColor: palette.hud.buttonBg, borderColor: palette.hud.buttonBorder }]}>
            <Text style={[styles.cardTitle, { color: palette.hud.text }]} maxFontSizeMultiplier={1.3}>
              ACERCA DE
            </Text>
            <TrainIcon size={26} color={palette.hud.accent} />
            <Text style={[styles.aboutName, { color: palette.hud.accent }]} maxFontSizeMultiplier={1.3}>
              Patio de Trenes
            </Text>
            <Text style={[styles.cardSubtitle, { color: palette.hud.textDim, textAlign: 'center' }]} maxFontSizeMultiplier={1.3}>
              Basado en el juego original de maniobras ferroviarias.
            </Text>
            <Text style={[styles.versionText, { color: palette.hud.textDim }]} maxFontSizeMultiplier={1.3}>
              {APP_VERSION}
            </Text>
          </View>
        </ScrollView>

        <Toast message={toastMessage} bottomOffset={spacing.xl} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#0b0d12',
  },
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 42,
    minWidth: 48,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipLabel: {
    ...typeScaleMenu.caption,
  },
  title: {
    ...typeScaleMenu.h3,
    flexShrink: 1,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
    width: '100%',
    maxWidth: layout.screenMaxWidth,
    alignSelf: 'center',
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  rowText: {
    flexShrink: 1,
    marginRight: spacing.md,
  },
  cardTitle: {
    ...typeScaleMenu.h3,
  },
  dangerTitle: {
    ...typeScaleMenu.h3,
    color: colors.status.error,
  },
  cardSubtitle: {
    ...typeScaleMenu.bodySmall,
    marginTop: spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1.4,
    ...typeScaleMenu.body,
    paddingHorizontal: spacing.md,
  },
  resetButton: {
    marginTop: spacing.md,
  },
  autoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.6,
  },
  autoLabel: {
    ...typeScaleMenu.body,
    flex: 1,
  },
  autoActive: {
    ...typeScaleMenu.micro,
  },
  todRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  todOption: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 2,
    padding: spacing.xs,
    alignItems: 'center',
  },
  todSwatch: {
    width: '100%',
    height: 30,
    borderRadius: radii.xs,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  todSwatchSky: {
    height: 10,
  },
  todSwatchGround: {
    height: 12,
  },
  todSwatchRail: {
    height: 1.5,
    marginBottom: 3,
    marginHorizontal: 3,
  },
  todLabel: {
    ...typeScaleMenu.micro,
    marginTop: spacing.xs,
  },
  aboutCard: {
    alignItems: 'center',
  },
  aboutName: {
    ...typeScaleMenu.h2,
    marginTop: spacing.sm,
  },
  versionText: {
    ...typeScaleMenu.caption,
    marginTop: spacing.md,
  },
});
