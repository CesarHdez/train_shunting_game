import React from 'react';
import { Modal, Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors, layout, radii, spacing, typeScaleMenu, withAlpha } from '../../design/tokens';
import { usePalette } from '../render/iso/timeOfDay';
import StarRow from './StarRow';
import Button from './Button';
import EmbeddedLeaderboard from './EmbeddedLeaderboard';
import { CloseIcon, ForwardIcon, MenuIcon, RestartIcon, ShareIcon, StarIcon, TrophyIcon } from './icons';
import { readableIdentityColor, scrimColorFor } from './copy';
import type { ScoreEntry } from '../controller/backendApi';

interface WinSummaryCardProps {
  visible: boolean;
  title: string;
  stars: 1 | 2 | 3;
  isNewRecord: boolean;
  /** Mode-specific stats/breakdown content, rendered between the star row and the leaderboard. */
  children: React.ReactNode;
  headerLabel: string;
  isGlobalBoard: boolean;
  leaderboardEntries: ScoreEntry[];
  leaderboardLoading: boolean;
  highlightRank: number | null;
  hasNextLevel: boolean;
  borderTint: string;
  /** True when the leaderboard fell back to LOCAL because the last
   *  global-leaderboard fetch failed (backend.getConnectivity() === 'offline')
   *  — NOT simply "no global scores yet", which can happen fully online too.
   *  Surfaces a small "sin conexión" note next to the local board. */
  offline?: boolean;
  /** Plain-text result summary passed to Share.share() by the COMPARTIR
   *  button, e.g. "Completé el Nivel 3 ... ". Omit/null to hide the button. */
  shareText?: string | null;
  /**
   * Closes the card WITHOUT navigating or resubmitting anything — the ✕
   * button, tapping the dimmed backdrop outside the card, and the Android
   * hardware back button all call this. Owned by the controllers
   * (`dismissSummary`/`summaryDismissed` — see summaryGate.ts) so the level
   * stays WON/finished and the HUD behind becomes usable again; the card can
   * be reopened via a small HUD affordance while `canReopenSummary` is true.
   */
  onDismiss: () => void;
  onRepeat: () => void;
  onMenu: () => void;
  onNext: () => void;
}

/**
 * Win / summary overlay — shared shell for both modes (components.md §6).
 * NOTE: the reference's confetti burst (ref/js/core/particles.js) is a Skia
 * particle system; it is intentionally NOT reimplemented here since this is
 * a plain RN modal, not a canvas. If a Skia confetti layer is added later it
 * should render behind this card while `visible` is freshly true.
 *
 * Dismissible (see `onDismiss`): the ✕ button in the top-right corner, a tap
 * on the dimmed backdrop outside the card, or the Android hardware back
 * button all close it without losing any information — the score/stars/
 * leaderboard stay computed, only the card's visibility changes.
 */
export default function WinSummaryCard({
  visible,
  title,
  stars,
  isNewRecord,
  children,
  headerLabel,
  isGlobalBoard,
  leaderboardEntries,
  leaderboardLoading,
  highlightRank,
  hasNextLevel,
  borderTint,
  offline = false,
  shareText = null,
  onDismiss,
  onRepeat,
  onMenu,
  onNext,
}: WinSummaryCardProps) {
  const { width } = useWindowDimensions();
  const palette = usePalette();
  const { hud } = palette;
  // spacing.giant (64) as the combined side margin (32dp each side) so the
  // card never touches the screen edges even on a narrow landscape phone —
  // see layout.winCardMaxWidth's doc comment for why 640 replaced 400.
  const cardWidth = Math.min(layout.winCardMaxWidth, width - spacing.giant);
  const recordInk = readableIdentityColor(colors.medal.gold, hud.text);

  const handleShare = () => {
    if (!shareText) return;
    void Share.share({ message: shareText });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={[styles.overlay, { backgroundColor: scrimColorFor(palette) }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Tapping the backdrop — the padding ScrollView leaves above/below/
              beside the card — dismisses. The card itself is a nested
              Pressable with a no-op onPress (below) so touches inside it
              claim the responder first and never bubble up to this one. */}
          <Pressable style={styles.backdropPress} onPress={onDismiss}>
            <Pressable
              onPress={() => {}}
              style={[
                styles.card,
                {
                  width: cardWidth,
                  backgroundColor: hud.buttonBg,
                  borderColor: isNewRecord ? recordInk : borderTint,
                },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar resultados"
                onPress={onDismiss}
                hitSlop={8}
                style={[styles.closeButton, { backgroundColor: withAlpha(hud.text, 0.1) }]}
              >
                <CloseIcon size={20} color={hud.text} />
              </Pressable>

              <Text style={[styles.title, { color: hud.statSuccess }]} maxFontSizeMultiplier={1.3}>
                {title}
              </Text>

              <StarRow stars={stars} radius={18} gap={24} />

              {isNewRecord ? (
                <View
                  style={[
                    styles.recordPill,
                    { backgroundColor: withAlpha(recordInk, 0.14), borderColor: withAlpha(recordInk, 0.55) },
                  ]}
                >
                  <StarIcon size={14} color={recordInk} />
                  <Text style={[styles.recordText, { color: recordInk }]} maxFontSizeMultiplier={1.3}>
                    ¡NUEVO RÉCORD!
                  </Text>
                  <StarIcon size={14} color={recordInk} />
                </View>
              ) : null}

              <View style={styles.body}>{children}</View>

              <EmbeddedLeaderboard
                headerLabel={headerLabel}
                isGlobal={isGlobalBoard}
                entries={leaderboardEntries}
                loading={leaderboardLoading}
                highlightRank={highlightRank}
              />

              {!isGlobalBoard && offline ? (
                <Text
                  style={[styles.offlineNote, { color: hud.statWarning }]}
                  maxFontSizeMultiplier={1.3}
                  accessibilityLabel="Sin conexión. Mostrando el ranking guardado en este dispositivo."
                >
                  Sin conexión — mostrando ranking local
                </Text>
              ) : null}

              {/*
                A single flex-wrap row, all four actions as direct siblings —
                replaces the old nested-View split (REPETIR+MENÚ column next
                to SIGUIENTE, COMPARTIR in its own full-width row below) that
                produced the ragged, uncoordinated wrap this fixes. With the
                wider card (see winCardMaxWidth) all four normally fit on one
                centered line; `flexWrap` + `justifyContent: 'center'` keeps
                any overflow (e.g. the long "¡JUEGO COMPLETADO!" banner on a
                narrow window) as a second fully-centered line instead of an
                orphaned, left-aligned button.
              */}
              <View style={styles.actionRow}>
                <Button
                  label="REPETIR"
                  icon={<RestartIcon />}
                  accessibilityLabel="Repetir nivel"
                  onPress={onRepeat}
                  variant="secondary"
                  width={96}
                  height={48}
                />
                <Button
                  label="MENÚ"
                  icon={<MenuIcon />}
                  accessibilityLabel="Ir al menú"
                  onPress={onMenu}
                  variant="secondary"
                  width={96}
                  height={48}
                />
                {hasNextLevel ? (
                  <Button
                    label="SIGUIENTE"
                    icon={<ForwardIcon />}
                    iconSide="trailing"
                    accessibilityLabel="Siguiente nivel"
                    onPress={onNext}
                    variant="primary"
                    width={120}
                    height={48}
                  />
                ) : (
                  <View
                    style={styles.completedRow}
                    accessibilityRole="text"
                    accessibilityLabel="¡Juego completado!"
                  >
                    <TrophyIcon size={18} color={recordInk} />
                    <Text style={[styles.completedText, { color: recordInk }]} maxFontSizeMultiplier={1.3}>
                      ¡JUEGO COMPLETADO!
                    </Text>
                  </View>
                )}
                {shareText ? (
                  <Button
                    label="COMPARTIR"
                    icon={<ShareIcon />}
                    accessibilityLabel="Compartir resultado"
                    onPress={handleShare}
                    variant="secondary"
                    width={120}
                    height={48}
                  />
                ) : null}
              </View>
            </Pressable>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: spacing.xxxl,
  },
  // Fills the ScrollView's flexGrow'd content area so a tap ANYWHERE outside
  // the card — including the empty space the centered card leaves above/
  // below/beside itself — reaches this Pressable's onPress (dismiss). The
  // card is a second, nested Pressable (below) that swallows its own touches
  // first, so taps inside it never bubble up to this one.
  backdropPress: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: radii.xl,
    borderWidth: 2,
    // Extra top padding (well past the close button's own 8+48dp footprint)
    // so the title never lays out underneath it, however long/wrapped the
    // level name gets — see closeButton below.
    paddingTop: spacing.giant,
    paddingBottom: spacing.xl,
    alignItems: 'center',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: layout.minTapTarget,
    height: layout.minTapTarget,
    borderRadius: layout.minTapTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  title: {
    ...typeScaleMenu.h1,
    textAlign: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  recordPill: {
    marginTop: spacing.md,
    height: 28,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  recordText: {
    ...typeScaleMenu.bodySmall,
    fontWeight: '700',
  },
  body: {
    width: '100%',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  offlineNote: {
    ...typeScaleMenu.micro,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  // `width: '100%'` is load-bearing: it gives flexWrap a container width to
  // measure against. Without it the row would shrink-wrap to its unwrapped
  // content (centered by the card's own `alignItems: 'center'`) and never
  // wrap at all, potentially overflowing the card on a narrow window.
  actionRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  completedText: {
    ...typeScaleMenu.h3,
    fontWeight: '700',
  },
});
