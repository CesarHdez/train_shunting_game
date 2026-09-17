import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, radii, spacing, typeScaleMenu, withAlpha } from '../../../design/tokens';
import { usePalette } from '../../render/iso/timeOfDay';
import Button from '../Button';
import MuteToggleButton from '../MuteToggleButton';
import { MenuIcon, RestartIcon, UndoIcon } from '../icons';
import PointsDeltaBadge, { type PointsDelta } from './PointsDeltaBadge';

interface TopBarProps {
  /** "NIVEL 3" (shunting) or "TURNO 3" (classification). */
  levelLabel: string;
  /** e.g. "MÁX 2 VAGONES / MANIOBRA" — shunting only, null when locoLimit is unlimited. */
  locoLimitBadge?: string | null;
  timeStr: string;
  /** "MANIOBRAS" or "PUNTOS". */
  rightLabel: string;
  rightValue: string;
  rightValueColor?: string;
  /**
   * Optional fourth stat rendered after `rightValue` — classification's
   * live "Saltos: N" chip. Omitted (undefined label) elsewhere.
   */
  extraStatLabel?: string;
  extraStatValue?: string;
  extraStatColor?: string;
  /**
   * Transient "+N"/"−N" this-push delta, floated above `rightValue` and
   * faded out by `PointsDeltaBadge`. Classification only.
   */
  pointsDelta?: PointsDelta | null;
  onMenu: () => void;
  onRestart: () => void;
  /**
   * Undo action + its enabled state. Always wired up: in portrait it's
   * unused here (undo lives in the thumb-zone BottomBar), but in `compact`
   * (landscape) mode BottomBar is dropped entirely and undo moves into this
   * bar's single row instead — see components/hud/BottomBar.tsx and
   * GameScreen's landscape handling.
   */
  onUndo: () => void;
  canUndo: boolean;
  insetTop: number;
  /**
   * Landscape single-row mode: collapses the portrait two-row bar (action
   * buttons + centered level row, then a separate stat row) into ONE slim
   * row that also absorbs undo and the mute toggle, so the freed row goes
   * back to the board. Driven by the screen's `width > height` check — see
   * GameScreen.tsx.
   */
  compact?: boolean;
}

/** Square footprint for the icon-only action buttons — matches layout.minTapTarget. */
const ICON_BTN = layout.minTapTarget;

/** Slightly smaller icon-button footprint for the landscape single-row HUD —
 *  still within the 44-48dp tap-target comfort band, just tighter than the
 *  portrait ICON_BTN so three of them + undo fit alongside the stat strip. */
const ICON_BTN_COMPACT = 44;

/**
 * Fixed top HUD bar with two layouts:
 *  - Portrait (`compact` false/undefined): two rows so nothing can collide
 *    on a narrow phone (verified down to 360dp) — row 1 is icon-only
 *    action buttons (menu/restart) + centered level label/locoLimit badge,
 *    row 2 is the right-aligned TIEMPO/MANIOBRAS|PUNTOS stat strip. Undo
 *    lives in the thumb-zone BottomBar instead.
 *  - Landscape (`compact` true): ONE slim row using the abundant horizontal
 *    width — left: menu/restart/undo icon buttons; center: level label +
 *    locoLimit badge; right: stat strip + mute toggle. BottomBar is dropped
 *    entirely in this mode (see GameScreen.tsx), so undo moves here.
 *
 * The action buttons show a single icon (`MenuIcon`/`RestartIcon`/`UndoIcon`)
 * to stay narrow; their full Spanish names ("MENÚ"/"REINICIAR"/"Deshacer
 * última maniobra") are preserved as `accessibilityLabel` for screen readers.
 */
export default function TopBar({
  levelLabel,
  locoLimitBadge,
  timeStr,
  rightLabel,
  rightValue,
  rightValueColor,
  extraStatLabel,
  extraStatValue,
  extraStatColor,
  pointsDelta = null,
  onMenu,
  onRestart,
  onUndo,
  canUndo,
  insetTop,
  compact = false,
}: TopBarProps) {
  // The bar floats over whichever sky the yard is lit by, so its glass has to
  // be retinted per time-of-day — most sharply at midday, where a light sky
  // demands dark ink where every other pass wants cream. Only colors move;
  // the two layouts below are untouched.
  const { hud } = usePalette();
  // Landscape phones can carve a display cutout / rounded-corner safe area
  // out of the LEFT/RIGHT edges too, not just top/bottom — GameScreen only
  // forwards `insetTop`, so without this the compact row's trailing chip
  // (the mute toggle) could end up flush against the physical edge with no
  // margin at all instead of the same inset every other HUD chip gets. Read
  // directly here (rather than threading two more props through GameScreen)
  // since every other inset this component needs is already self-contained.
  const edgeInsets = useSafeAreaInsets();
  const tint = {
    container: { backgroundColor: hud.panelBg, borderBottomColor: hud.buttonBorder },
    text: { color: hud.text },
    dim: { color: hud.textDim },
  };
  // Callers only override these when the VALUE itself is semantic (points,
  // colour jumps); otherwise a stat reads in whatever ink this pass uses.
  const valueColor = rightValueColor ?? hud.text;
  const extraColor = extraStatColor ?? hud.text;

  if (compact) {
    return (
      <View style={[styles.container, tint.container, { paddingTop: insetTop, paddingLeft: edgeInsets.left, paddingRight: edgeInsets.right }]}>
        <View style={styles.inner}>
          <View style={styles.compactRow}>
            <View style={styles.leftGroup}>
              <Button
                iconOnly
                icon={<MenuIcon />}
                accessibilityLabel="MENÚ"
                onPress={onMenu}
                variant="secondary"
                width={ICON_BTN_COMPACT}
                height={ICON_BTN_COMPACT}
              />
              <Button
                iconOnly
                icon={<RestartIcon />}
                accessibilityLabel="REINICIAR"
                onPress={onRestart}
                variant="secondary"
                width={ICON_BTN_COMPACT}
                height={ICON_BTN_COMPACT}
                style={styles.gapLeft}
              />
              <Button
                iconOnly
                icon={<UndoIcon />}
                accessibilityLabel="Deshacer última maniobra"
                onPress={onUndo}
                variant="undo"
                disabled={!canUndo}
                width={ICON_BTN_COMPACT}
                height={ICON_BTN_COMPACT}
                style={styles.gapLeft}
              />
            </View>

            <View style={styles.centerCompact} pointerEvents="none">
              <Text style={[styles.levelLabelCompact, tint.text]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
                {levelLabel}
              </Text>
              {locoLimitBadge ? (
                <View style={[styles.badgeCompact, { backgroundColor: withAlpha(hud.accent, 0.22) }]}>
                  <Text style={[styles.badgeText, { color: hud.accent }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
                    {locoLimitBadge}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.rightGroupCompact}>
              <View style={styles.statsGroup} pointerEvents="none">
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, tint.dim]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
                    TIEMPO
                  </Text>
                  <Text style={[styles.statValue, tint.text]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
                    {timeStr}
                  </Text>
                </View>
                <View style={[styles.statItem, styles.statItemGap, styles.statItemAnchor]}>
                  <Text style={[styles.statLabel, tint.dim]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
                    {rightLabel}
                  </Text>
                  <Text
                    style={[styles.statValue, { color: valueColor }]}
                    maxFontSizeMultiplier={1.3}
                    numberOfLines={1}
                  >
                    {rightValue}
                  </Text>
                  <PointsDeltaBadge delta={pointsDelta} />
                </View>
                {extraStatLabel != null ? (
                  <View style={[styles.statItem, styles.statItemGap]}>
                    <Text style={[styles.statLabel, tint.dim]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
                      {extraStatLabel}
                    </Text>
                    <Text
                      style={[styles.statValue, { color: extraColor }]}
                      maxFontSizeMultiplier={1.3}
                      numberOfLines={1}
                    >
                      {extraStatValue}
                    </Text>
                  </View>
                ) : null}
              </View>
              <MuteToggleButton size={32} fontSize={14} color={hud.buttonBg} style={styles.gapLeft} />
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, tint.container, { paddingTop: insetTop, paddingLeft: edgeInsets.left, paddingRight: edgeInsets.right }]}>
      {/* `inner` caps + centers the two content rows on very wide screens
          (tablet/landscape) so the action buttons/level label don't end up
          pinned to a far-off left edge with the stat strip stranded on the
          right — see layout.playAreaMaxWidth. A no-op on phones, where
          container is always narrower than the cap. */}
      <View style={styles.inner}>
        <View style={styles.row}>
          <View style={styles.leftGroup}>
            <Button
              iconOnly
              icon={<MenuIcon />}
              accessibilityLabel="MENÚ"
              onPress={onMenu}
              variant="secondary"
              width={ICON_BTN}
              height={ICON_BTN}
            />
            <Button
              iconOnly
              icon={<RestartIcon />}
              accessibilityLabel="REINICIAR"
              onPress={onRestart}
              variant="secondary"
              width={ICON_BTN}
              height={ICON_BTN}
              style={styles.gapLeft}
            />
          </View>

          <View style={styles.center} pointerEvents="none">
            <Text style={[styles.levelLabel, tint.text]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
              {levelLabel}
            </Text>
            {locoLimitBadge ? (
              <View style={[styles.badge, { backgroundColor: withAlpha(hud.accent, 0.22) }]}>
                <Text style={[styles.badgeText, { color: hud.accent }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
                  {locoLimitBadge}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.statRow}>
          <MuteToggleButton size={28} fontSize={13} color={hud.buttonBg} />
          <View style={styles.statsGroup} pointerEvents="none">
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, tint.dim]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
                TIEMPO
              </Text>
              <Text style={[styles.statValue, tint.text]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
                {timeStr}
              </Text>
            </View>
            <View style={[styles.statItem, styles.statItemGap, styles.statItemAnchor]}>
              <Text style={[styles.statLabel, tint.dim]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
                {rightLabel}
              </Text>
              <Text
                style={[styles.statValue, { color: valueColor }]}
                maxFontSizeMultiplier={1.3}
                numberOfLines={1}
              >
                {rightValue}
              </Text>
              <PointsDeltaBadge delta={pointsDelta} />
            </View>
            {extraStatLabel != null ? (
              <View style={[styles.statItem, styles.statItemGap]}>
                <Text style={[styles.statLabel, tint.dim]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
                  {extraStatLabel}
                </Text>
                <Text
                  style={[styles.statValue, { color: extraColor }]}
                  maxFontSizeMultiplier={1.3}
                  numberOfLines={1}
                >
                  {extraStatValue}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: layout.playAreaMaxWidth,
  },
  row: {
    minHeight: layout.topBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gapLeft: { marginLeft: spacing.xs },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelLabel: {
    ...typeScaleMenu.h2,
  },
  badge: {
    marginTop: 2,
    height: 20,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    ...typeScaleMenu.micro,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
  },
  statsGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statItemGap: {
    marginLeft: spacing.lg,
  },
  statItemAnchor: {
    position: 'relative',
  },
  statLabel: {
    ...typeScaleMenu.caption,
    marginRight: spacing.xs,
  },
  statValue: {
    ...typeScaleMenu.body,
    fontWeight: '700',
  },
  // ── Landscape single-row ("compact") mode ─────────────────────────────
  compactRow: {
    minHeight: layout.topBarHeightCompact,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  centerCompact: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  levelLabelCompact: {
    ...typeScaleMenu.h3,
  },
  badgeCompact: {
    marginTop: 1,
    height: 16,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  rightGroupCompact: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
