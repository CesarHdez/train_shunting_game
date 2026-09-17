import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, layout, radii, spacing, typeScaleMenu } from '../../design/tokens';
import { usePalette } from '../render/iso/timeOfDay';
import { formatTime, readableIdentityColor } from './copy';
import type { ScoreEntry } from '../controller/backendApi';

interface EmbeddedLeaderboardProps {
  headerLabel: string;
  isGlobal: boolean;
  entries: ScoreEntry[];
  /** 1-based rank of the current player's just-submitted run, if known —
   * highlighted per design-system's "Me" row treatment (components.md §6). */
  highlightRank?: number | null;
  loading?: boolean;
  maxHeight?: number;
}

const MEDAL_COLORS = [colors.medal.gold, colors.medal.silver, colors.medal.bronze];

/** Scrollable top-N board embedded in the win/summary card (components.md §6)
 * and reused (read-only) by the standalone leaderboard screen. */
export default function EmbeddedLeaderboard({
  headerLabel,
  isGlobal,
  entries,
  highlightRank = null,
  loading = false,
  maxHeight = 10 * layout.winCardEmbeddedRowHeight,
}: EmbeddedLeaderboardProps) {
  const { hud } = usePalette();
  return (
    <View style={[styles.panel, { backgroundColor: hud.buttonBg }]}>
      <Text
        style={[styles.header, { color: isGlobal ? hud.statSuccess : hud.textDim }]}
        maxFontSizeMultiplier={1.3}
      >
        {headerLabel}
      </Text>
      {loading ? (
        <Text style={[styles.empty, { color: hud.textDim }]} maxFontSizeMultiplier={1.3}>
          Cargando ranking…
        </Text>
      ) : entries.length === 0 ? (
        <Text style={[styles.empty, { color: hud.textDim }]} maxFontSizeMultiplier={1.3}>
          ¡Primer intento!
        </Text>
      ) : (
        <ScrollView style={{ maxHeight }} nestedScrollEnabled>
          {entries.map((e, i) => {
            const rank = i + 1;
            const isMe = highlightRank != null && rank === highlightRank;
            const rowColor = isMe
              ? colors.text.me
              : rank <= 3
                ? readableIdentityColor(MEDAL_COLORS[rank - 1], hud.text)
                : hud.textDim;
            return (
              <View
                key={`${e.uid}-${i}`}
                style={[
                  styles.row,
                  isMe ? styles.rowMe : null,
                  i % 2 === 1 && !isMe ? { backgroundColor: colors.surface.rowStripe } : null,
                ]}
              >
                <Text
                  style={[styles.rank, { color: rowColor, fontWeight: isMe ? '700' : '600' }]}
                  maxFontSizeMultiplier={1.3}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {rank}. {e.name}
                </Text>
                <Text
                  style={[styles.score, { color: rowColor, fontWeight: isMe ? '700' : '600' }]}
                  maxFontSizeMultiplier={1.3}
                  numberOfLines={1}
                >
                  {e.score} pts
                </Text>
                <Text
                  style={[styles.stats, { color: rowColor, fontWeight: isMe ? '700' : '600' }]}
                  maxFontSizeMultiplier={1.3}
                  numberOfLines={1}
                >
                  {e.moves}m · {formatTime(e.time)}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: spacing.lg,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
  },
  header: {
    ...typeScaleMenu.bodySmall,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  empty: {
    ...typeScaleMenu.bodySmall,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  row: {
    height: layout.winCardEmbeddedRowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  rowMe: {
    backgroundColor: 'rgba(79,195,247,0.08)',
  },
  // Name/rank takes whatever room is left; score and time get fixed pixel
  // floors instead of a proportional flex split. The old 1.4/1/1 flex ratio
  // handed "1194 pts"/"1m · 0:06" too little width at the pre-widening
  // 400dp card and both wrapped onto a second line (see DECISIONES §7 —
  // "contenido centrado y coordinado"). Fixed widths hold their shape
  // regardless of card width; combined with numberOfLines=1 above, a value
  // that somehow still doesn't fit truncates instead of wrapping.
  rank: {
    flex: 1,
    ...typeScaleMenu.bodySmall,
  },
  score: {
    width: 96,
    ...typeScaleMenu.bodySmall,
    textAlign: 'center',
  },
  stats: {
    width: 112,
    ...typeScaleMenu.caption,
    textAlign: 'right',
  },
});
