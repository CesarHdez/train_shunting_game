import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, getTimeOfDayPalette, layout, radii, spacing, typeScaleMenu } from '../../design/tokens';
import StarRow from '../components/StarRow';
import SkyBackground from '../components/SkyBackground';
import OfflineBadge from '../components/hud/OfflineBadge';
import { BackIcon, TrophyIcon } from '../components/icons';
import { formatTime } from '../components/copy';
import { fireHaptic } from '../controller/haptics';
import { useTimeOfDay } from '../render/iso/timeOfDay';
import { getBackendApi, type ScoreEntry } from '../controller/backendApi';
import { allShuntingLevels, allClassificationLevels } from '../data/levels';
import type { RootScreenProps } from '../navigation/types';

interface LevelBoardRow {
  levelId: number;
  stars: 0 | 1 | 2 | 3;
  top3: ScoreEntry[];
}

const MEDAL_COLORS = [colors.medal.gold, colors.medal.silver, colors.medal.bronze];

/** Standalone leaderboard — one row per completed level, top-3 inline.
 *  Reskinned per design_handoff_menus §5: same row layout, new glass chrome
 *  on the active time-of-day sky, Raleway type, `TrophyIcon` in the header
 *  alongside the mode-colored title. `MEDAL_COLORS` is unchanged (already
 *  accessible) per the handoff's explicit instruction. */
export default function LeaderboardScreen({ navigation, route }: RootScreenProps<'Leaderboard'>) {
  const { mode } = route.params;
  const palette = getTimeOfDayPalette(useTimeOfDay());
  const isShunting = mode === 'shunting';
  const kindLabel = isShunting ? 'NIV' : 'TUR';
  const emptyNoun = isShunting ? 'nivel' : 'turno';
  const title = isShunting ? 'Puntajes — Maniobras' : 'Puntajes — Clasificación';
  const titleColor = isShunting ? colors.modeAccent.shunting : colors.modeAccent.classification;

  const [rows, setRows] = useState<LevelBoardRow[]>([]);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const backend = getBackendApi();
    const levelIds = (isShunting ? allShuntingLevels() : allClassificationLevels()).map((l) => l.id);
    backend.ready().then(() => {
      const completed = levelIds
        .filter((id) => backend.isCompleted(mode, id))
        .map((id) => ({
          levelId: id,
          stars: backend.getStars(mode, id),
          top3: backend.getLocalLeaderboard(mode, id).slice(0, 3),
        }));
      setRows(completed);
      setOffline(backend.getConnectivity() === 'offline');
    });
  }, [mode, isShunting]);

  return (
    <View style={styles.background}>
      <SkyBackground palette={palette} gradientId="leaderboardSky" />

      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            hitSlop={8}
            onPress={() => {
              void fireHaptic('light');
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

          <View style={styles.titleWrap}>
            <View style={styles.titleRow}>
              <TrophyIcon size={16} color={titleColor} />
              <Text style={[styles.title, { color: titleColor }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                {title}
              </Text>
            </View>
            <OfflineBadge visible={offline} />
          </View>

          <View style={{ width: 90 }} />
        </View>

        {rows.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyText, { color: palette.hud.textDim }]} maxFontSizeMultiplier={1.3}>
              Aún no has completado ningún {emptyNoun}.
            </Text>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => String(item.levelId)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item, index }) => (
              <View
                style={[
                  styles.row,
                  { borderBottomColor: palette.hud.buttonBorder },
                  index % 2 === 1 ? { backgroundColor: colors.surface.rowStripe } : null,
                ]}
              >
                <View style={[styles.badge, { backgroundColor: palette.hud.buttonBg, borderColor: palette.hud.buttonBorder }]}>
                  <Text style={[styles.badgeKind, { color: palette.hud.textDim }]} maxFontSizeMultiplier={1.3}>
                    {kindLabel}
                  </Text>
                  <Text style={[styles.badgeNumber, { color: palette.hud.text }]} maxFontSizeMultiplier={1.3}>
                    {item.levelId}
                  </Text>
                  <StarRow stars={item.stars} radius={7} />
                  <Text style={[styles.badgeTag, { color: palette.hud.statSuccess }]} maxFontSizeMultiplier={1.3}>
                    LOCAL
                  </Text>
                </View>
                <View style={styles.miniCards}>
                  {item.top3.map((e, i) => (
                    <View key={`${e.uid}-${i}`} style={[styles.miniCard, { backgroundColor: palette.hud.buttonBg }]}>
                      <Text style={[styles.miniName, { color: MEDAL_COLORS[i] }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                        {i + 1}. {e.name}
                      </Text>
                      <Text style={[styles.miniStats, { color: palette.hud.textDim }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                        {e.score}pts · {e.moves}m · {formatTime(e.time)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          />
        )}
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
    // No backgroundColor here on purpose — this row sits directly on the
    // continuous SkyBackground gradient behind it, same as LevelSelect's
    // and Settings' header rows. The pre-reskin version painted a solid
    // `rgba(0,0,0,0.45)` strip across this exact box (a real header bar,
    // reasonable for the old flat dark theme); carrying that forward as
    // `palette.hud.panelBg` reproduced the same opaque band and cut a hard
    // seam across the sky gradient — only the individual chips (back
    // button) should have their own glass background, not the whole row.
    height: 74,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
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
  titleWrap: {
    flexShrink: 1,
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typeScaleMenu.h3,
    textAlign: 'center',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    ...typeScaleMenu.h3,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: spacing.xxxl,
    width: '100%',
    maxWidth: layout.screenMaxWidth,
    alignSelf: 'center',
  },
  row: {
    height: layout.leaderboardRowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  badge: {
    width: layout.leaderboardBadgeSize.width,
    height: layout.leaderboardBadgeSize.height,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeKind: {
    fontFamily: typeScaleMenu.micro.fontFamily,
    fontSize: 9,
    fontWeight: '600',
  },
  badgeNumber: {
    fontFamily: typeScaleMenu.h3.fontFamily,
    fontSize: 18,
    fontWeight: '700',
  },
  badgeTag: {
    fontFamily: typeScaleMenu.micro.fontFamily,
    fontSize: 8,
    fontWeight: '600',
    marginTop: 2,
  },
  miniCards: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  miniCard: {
    flex: 1,
    borderRadius: radii.sm,
    padding: spacing.xs,
  },
  miniName: {
    ...typeScaleMenu.bodySmall,
    fontWeight: '700',
  },
  miniStats: {
    ...typeScaleMenu.caption,
    marginTop: 2,
  },
});
