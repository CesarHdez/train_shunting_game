import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, getTimeOfDayPalette, layout, radii, spacing, typeScaleMenu } from '../../design/tokens';
import ModeCard from '../components/ModeCard';
import MuteToggleButton from '../components/MuteToggleButton';
import SkyBackground from '../components/SkyBackground';
import HillSilhouette from '../components/HillSilhouette';
import { GearIcon, TrainIcon } from '../components/icons';
import { fireHaptic } from '../controller/haptics';
import { usePlayer } from '../controller/PlayerContext';
import { useTimeOfDay } from '../render/iso/timeOfDay';
import { getBackendApi, type ProgressInfo } from '../controller/backendApi';
import { shuntingLevelCount, classificationLevelCount } from '../data/levels';
import type { RootScreenProps } from '../navigation/types';

const EMPTY: ProgressInfo = { completedCount: 0, totalCount: 0 };
const MODE_ICON_SIZE = 28;

/**
 * Rail-turnout mark for "Patio de Clasificación" — a short rail merging
 * diagonally into a long one, with a switch-point node at each end. Not part
 * of the icons/ contract (that set has no shunting-switch glyph); drawn
 * locally at a larger, higher-contrast scale than the first pass so it
 * reads as a track switch rather than a smudge of dashes at card size.
 */
function SwitchMark({ color, size = MODE_ICON_SIZE }: { color: string; size?: number }) {
  const height = size;
  const width = size * 1.5;
  return (
    <Svg width={width} height={height} viewBox="0 0 32 20">
      <Path d="M2 6 H16 M2 14 H30" stroke={color} strokeWidth={2.8} strokeLinecap="round" fill="none" />
      <Path d="M16 6 L24 14" stroke={color} strokeWidth={2.8} strokeLinecap="round" fill="none" />
      <Circle cx={16} cy={6} r={2.4} fill={color} />
      <Circle cx={24} cy={14} r={2.4} fill={color} />
    </Svg>
  );
}

/**
 * Mode-select screen — two cards, ref/js/main.js `drawModeSelect`. Reskinned
 * per design_handoff_menus §5: glass header chips (gear/mute), circular
 * progress rings on the cards, hill silhouette over the time-of-day sky.
 * Landscape translation: the portrait mockup stacks the two mode cards
 * vertically; here they sit side by side in a row so the screen uses the
 * extra landscape width instead of scrolling past a tall vertical stack
 * (the fixed `layout.modeCardHeight` card height easily clears a
 * ~360–420dp-tall landscape safe area once stacked next to, not on top of,
 * each other).
 */
export default function ModeSelectScreen({ navigation }: RootScreenProps<'ModeSelect'>) {
  const { playerName } = usePlayer();
  const palette = getTimeOfDayPalette(useTimeOfDay());
  const [shuntingProgress, setShuntingProgress] = useState<ProgressInfo>(EMPTY);
  const [clfProgress, setClfProgress] = useState<ProgressInfo>(EMPTY);

  useEffect(() => {
    const backend = getBackendApi();
    backend.ready().then(() => {
      setShuntingProgress(backend.getProgress('shunting', shuntingLevelCount));
      setClfProgress(backend.getProgress('classification', classificationLevelCount));
    });
  }, []);

  return (
    <View style={styles.background}>
      <SkyBackground palette={palette} gradientId="modeSky" />
      <HillSilhouette
        palette={palette}
        pathD="M0,46 L70,22 L150,42 L230,18 L300,40 L360,24 L360,70 L0,70 Z"
        viewBoxHeight={70}
        height={56}
        opacityScale={0.6}
        style={styles.hill}
      />

      <SafeAreaView style={styles.safe}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ajustes"
            hitSlop={8}
            onPress={() => {
              void fireHaptic('light');
              navigation.navigate('Settings');
            }}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: palette.hud.buttonBg, borderColor: palette.hud.buttonBorder, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <GearIcon size={18} color={palette.hud.accent} />
          </Pressable>

          <View style={styles.headerTitleWrap}>
            <Text style={[styles.title, { color: palette.hud.text }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
              Patio de Trenes
            </Text>
            {playerName ? (
              <Text style={[styles.playerLine, { color: palette.hud.textDim }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
                Jugador: {playerName}
              </Text>
            ) : null}
          </View>

          <MuteToggleButton
            size={40}
            color={palette.hud.buttonBg}
            borderColor={palette.hud.buttonBorder}
            iconColor={palette.hud.accent}
          />
        </View>

        <Text style={[styles.prompt, { color: palette.hud.textDim }]} maxFontSizeMultiplier={1.3}>
          ELIGE UN MODO DE JUEGO
        </Text>

        <View style={styles.cards}>
          <ModeCard
            icon={<TrainIcon size={MODE_ICON_SIZE} color={colors.modeAccent.shunting} />}
            title="Patio de Maniobras"
            subtitleLines={['Mueve la locomotora y ordena los', 'vagones en la secuencia objetivo.']}
            accentColor={colors.modeAccent.shunting}
            progressLabel={`${shuntingProgress.completedCount}/${shuntingLevelCount} niveles`}
            progressFraction={shuntingLevelCount ? shuntingProgress.completedCount / shuntingLevelCount : 0}
            palette={palette}
            onPress={() => navigation.navigate('LevelSelect', { mode: 'shunting' })}
          />
          <ModeCard
            icon={<SwitchMark color={colors.modeAccent.classification} />}
            title="Patio de Clasificación"
            subtitleLines={['Empuja cada vagón desde el lomo hacia', 'la vía de su color de destino.']}
            accentColor={colors.modeAccent.classification}
            progressLabel={`${clfProgress.completedCount}/${classificationLevelCount} turnos`}
            progressFraction={classificationLevelCount ? clfProgress.completedCount / classificationLevelCount : 0}
            palette={palette}
            onPress={() => navigation.navigate('LevelSelect', { mode: 'classification' })}
          />
        </View>
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
    // useWindowDimensions() call — no `right: 0` needed (see LoginScreen's
    // identical comment / SkyBackground's doc for the full rationale).
    position: 'absolute',
    left: 0,
    bottom: '38%',
  },
  safe: {
    flex: 1,
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  headerRow: {
    width: '100%',
    maxWidth: layout.screenMaxWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chip: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    ...typeScaleMenu.h2,
    letterSpacing: 1,
    textAlign: 'center',
  },
  playerLine: {
    ...typeScaleMenu.caption,
    marginTop: 2,
  },
  prompt: {
    ...typeScaleMenu.caption,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  cards: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    maxWidth: layout.screenMaxWidth,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: layout.modeCardGap,
    paddingBottom: spacing.lg,
  },
});
