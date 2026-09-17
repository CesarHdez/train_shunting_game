import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, getTimeOfDayPalette, layout, spacing, typeScaleMenu } from '../../design/tokens';
import LevelCard from '../components/LevelCard';
import SkyBackground from '../components/SkyBackground';
import Toast from '../components/hud/Toast';
import OfflineBadge from '../components/hud/OfflineBadge';
import { BackIcon, CheckIcon, LockIcon, StarIcon, TrophyIcon } from '../components/icons';
import { fireHaptic } from '../controller/haptics';
import { useTimeOfDay } from '../render/iso/timeOfDay';
import { getBackendApi, type ScoreEntry } from '../controller/backendApi';
import {
  buildSections,
  computeSectionProgress,
  sectionUnlocked,
  SHUNTING_SECTION_SIZE,
  UNLOCK_THRESHOLD,
  type SectionDef,
  type SectionProgress,
} from '../controller/sections';
import { allShuntingLevels, allClassificationLevels } from '../data/levels';
import type { RootScreenProps } from '../navigation/types';

interface LevelRow {
  id: number;
  stars: 0 | 1 | 2 | 3;
  best: ScoreEntry | null;
  completed: boolean;
}

/** How long the "section locked" hint toast stays visible — mirrors the
 *  2000ms convention used by shuntingController's showToast. */
const TOAST_DURATION_MS = 2000;

const LOCKED_HINT = `Completa ${UNLOCK_THRESHOLD} niveles de la sección anterior para desbloquear.`;

/**
 * Column count for the level grid, scaled to the available width.
 * `layout.levelGridColBreakpoints`/`levelGridColCounts` are parallel arrays:
 * the first breakpoint the width is BELOW selects the paired column count,
 * falling through to the last (widest-tier) count once width clears every
 * threshold. The first breakpoint (400) reproduces this screen's original
 * phone-only `width < 400 ? 2 : 3` split exactly; wider tiers (4–6 cols) are
 * new, for tablet/landscape.
 */
function colsForWidth(width: number): number {
  const { levelGridColBreakpoints: breakpoints, levelGridColCounts: counts } = layout;
  for (let i = 0; i < breakpoints.length; i++) {
    if (width < breakpoints[i]) return counts[i];
  }
  return counts[counts.length - 1];
}

type GridItem =
  | { kind: 'header'; key: string; section: SectionDef; progress: SectionProgress; locked: boolean }
  | { kind: 'row'; key: string; cards: LevelRow[]; locked: boolean };

/** Level-select grid — grouped into section "worlds", ref/js/main.js menu.
 *  Reskinned per design_handoff_menus §5: glass header chips (back/trophy),
 *  icon-based section counters (check + filled star, no emoji). The grid
 *  itself was already width-driven (`colsForWidth`/`layout.levelGridCol*`),
 *  so the existing column breakpoints already give the landscape viewport
 *  more columns instead of needing a bespoke landscape layout here. */
export default function LevelSelectScreen({ navigation, route }: RootScreenProps<'LevelSelect'>) {
  const { mode } = route.params;
  const { width } = useWindowDimensions();
  const palette = getTimeOfDayPalette(useTimeOfDay());
  const [rowsById, setRowsById] = useState<Map<number, LevelRow>>(new Map());
  const [offline, setOffline] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isShunting = mode === 'shunting';
  const kindLabel = isShunting ? 'NIVEL' : 'TURNO';
  const headerTitle = isShunting ? 'Maniobras' : 'Clasificación';
  const headerColor = isShunting ? colors.modeAccent.shunting : colors.modeAccent.classification;

  const levelIds = useMemo(() => {
    const levels = isShunting ? allShuntingLevels() : allClassificationLevels();
    return levels.map((l) => l.id);
  }, [isShunting]);

  const refresh = useCallback(async () => {
    const backend = getBackendApi();
    await backend.ready();
    const next = new Map<number, LevelRow>();
    for (const id of levelIds) {
      next.set(id, {
        id,
        stars: backend.getStars(mode, id),
        best: backend.getBest(mode, id),
        completed: backend.isCompleted(mode, id),
      });
    }
    setRowsById(next);
    setOffline(backend.getConnectivity() === 'offline');
  }, [levelIds, mode]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Re-sync stars/scores/completion whenever this screen regains focus (e.g.
  // after finishing a level) — this is also what makes a freshly-unlocked
  // section (crossing UNLOCK_THRESHOLD in the previous one) show up.
  useEffect(() => {
    const unsub = navigation.addListener('focus', refresh);
    return unsub;
  }, [navigation, refresh]);

  const showLockedToast = useCallback(() => {
    setToastMessage(LOCKED_HINT);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), TOAST_DURATION_MS);
  }, []);

  useEffect(
    () => () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    },
    []
  );

  const cols = colsForWidth(width);
  const rawCardWidth = (width - 2 * spacing.lg - (cols - 1) * layout.levelGridGap) / cols;
  // Cap so cards stay hand-sized on an ultra-wide display even at the max
  // (6) column count — `row`'s justifyContent:'center' below then absorbs
  // the leftover width. Never engages at the widths colsForWidth is tuned
  // for, so this is a no-op in practice except on extreme viewports.
  const cardWidth = Math.min(rawCardWidth, layout.levelCardMaxWidth);
  // Clamped, not just proportional — see levelCardAspectRatio's doc comment:
  // a compact horizontal tile needs a height ceiling independent of width so
  // wide columns (few cols on a wide screen) don't grow back into tall cards.
  const cardHeight = Math.min(
    Math.max(cardWidth * layout.levelCardAspectRatio, layout.levelCardMinHeight),
    layout.levelCardMaxHeight
  );

  // Shunting: 10 sections of 10. Classification: sectionSize === total level
  // count collapses buildSections() to exactly one section, which
  // sectionUnlocked() always treats as unlocked (index 0) — no branching.
  const sections = useMemo(
    () =>
      buildSections(
        levelIds.length,
        isShunting ? SHUNTING_SECTION_SIZE : Math.max(levelIds.length, 1),
        (n) => (isShunting ? `SECCIÓN ${n}` : 'TURNOS')
      ),
    [levelIds.length, isShunting]
  );

  const gridItems = useMemo<GridItem[]>(() => {
    const emptyRow: LevelRow = { id: -1, stars: 0, best: null, completed: false };
    const rowFor = (id: number): LevelRow => rowsById.get(id) ?? { ...emptyRow, id };

    const progressBySection = sections.map((section) =>
      computeSectionProgress(
        section.levelIds,
        (id) => rowFor(id).completed,
        (id) => rowFor(id).stars
      )
    );

    const items: GridItem[] = [];
    sections.forEach((section, i) => {
      const progress = progressBySection[i];
      const locked = !sectionUnlocked(i, progressBySection);

      items.push({ kind: 'header', key: `header-${section.index}`, section, progress, locked });

      for (let offset = 0; offset < section.levelIds.length; offset += cols) {
        const chunk = section.levelIds.slice(offset, offset + cols).map(rowFor);
        items.push({ kind: 'row', key: `row-${section.index}-${offset}`, cards: chunk, locked });
      }
    });
    return items;
  }, [sections, rowsById, cols]);

  return (
    <View style={styles.background}>
      <SkyBackground palette={palette} gradientId="levelSky" />

      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver a selección de modo"
            hitSlop={8}
            onPress={() => {
              void fireHaptic('light');
              navigation.navigate('ModeSelect');
            }}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: palette.hud.buttonBg, borderColor: palette.hud.buttonBorder, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <BackIcon size={14} color={palette.hud.accent} />
            <Text style={[styles.chipLabel, { color: palette.hud.accent }]} maxFontSizeMultiplier={1.2}>
              MODOS
            </Text>
          </Pressable>

          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: headerColor }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {headerTitle}
            </Text>
            <OfflineBadge visible={offline} />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ver tabla de puntajes"
            hitSlop={8}
            onPress={() => {
              void fireHaptic('light');
              navigation.navigate('Leaderboard', { mode });
            }}
            style={({ pressed }) => [
              styles.iconChip,
              { backgroundColor: palette.hud.buttonBg, borderColor: palette.hud.buttonBorder, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <TrophyIcon size={16} color={palette.hud.accent} />
          </Pressable>
        </View>

        <FlatList
          data={gridItems}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.gridContent}
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return (
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    {item.locked ? <LockIcon size={13} color={palette.hud.textDim} /> : null}
                    <Text style={[styles.sectionTitle, { color: palette.hud.text }]} maxFontSizeMultiplier={1.3}>
                      {item.section.title}
                    </Text>
                  </View>
                  <View style={styles.sectionMeta}>
                    <View style={styles.sectionMetaItem}>
                      <CheckIcon size={11} color={palette.hud.statSuccess} />
                      <Text style={[styles.sectionMetaText, { color: palette.hud.textDim }]} maxFontSizeMultiplier={1.3}>
                        {item.progress.completedCount}/{item.progress.totalCount}
                      </Text>
                    </View>
                    <View style={styles.sectionMetaItem}>
                      <StarIcon size={11} color={colors.medal.gold} filled />
                      <Text style={[styles.sectionMetaText, { color: palette.hud.textDim }]} maxFontSizeMultiplier={1.3}>
                        {item.progress.starsEarned}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            }
            return (
              <View style={[styles.row, { gap: layout.levelGridGap }]}>
                {item.cards.map((card) => (
                  <LevelCard
                    key={card.id}
                    levelId={card.id}
                    kindLabel={kindLabel}
                    stars={card.stars}
                    scoreCaption={card.best ? `${card.best.score}pts` : ''}
                    width={cardWidth}
                    height={cardHeight}
                    palette={palette}
                    locked={item.locked}
                    onPress={() => navigation.navigate('Game', { mode, levelId: card.id })}
                    onLockedPress={showLockedToast}
                  />
                ))}
              </View>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: layout.levelGridGap }} />}
        />

        <Toast message={toastMessage} bottomOffset={spacing.lg} />
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
  iconChip: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flexShrink: 1,
    alignItems: 'center',
    marginHorizontal: spacing.sm,
  },
  headerTitle: {
    ...typeScaleMenu.h3,
    textAlign: 'center',
  },
  gridContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  row: {
    flexDirection: 'row',
    // Only visible when cardWidth was clamped by levelCardMaxWidth (see
    // above) — centers the row's leftover width instead of leaving cards
    // flush-left. No effect when cards fill the row exactly (every normal
    // phone/tablet width).
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionTitle: {
    ...typeScaleMenu.h3,
  },
  sectionMeta: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sectionMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sectionMetaText: {
    ...typeScaleMenu.caption,
  },
});
