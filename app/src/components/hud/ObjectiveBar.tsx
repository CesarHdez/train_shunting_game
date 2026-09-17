import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamilyMenu, layout, spacing, typeScaleMenu } from '../../../design/tokens';
import type { DestinationKey, TimeOfDayPalette } from '../../../design/tokens';
import { usePalette } from '../../render/iso/timeOfDay';
import { wagonKindFor } from '../../render/primitives/IsoWagon';
import { WagonGlyph } from '../../render/primitives/WagonGlyph';
import { CAR_TYPE_NAMES, WAGON_KIND_NAMES, inkOn, lightenTint, wagonMaterialForLabel } from '../copy';

// ── Objective chip sizing (portrait "normal" / landscape "compact") ───────
// Aspect ratio follows the real wagon reference (76×52, picture IsoWagon.tsx)
// so the mini-drawing reads as the same car shape the board draws, just
// small. Chosen so both variants fit inside the EXISTING
// layout.objectiveBarHeight(Compact) with room to spare — see the file's
// final report for the fit math; no layout token needed to change.
const CHIP = { width: 44, height: 30, radius: 4, border: 1, badge: 24, font: 16 };
const CHIP_COMPACT = { width: 35, height: 24, radius: 3, border: 1, badge: 19, font: 13 };

interface ObjectiveChipProps {
  label: string;
  compact: boolean;
  palette: TimeOfDayPalette;
}

/**
 * One target-sequence chip: the wagon's own mini-drawing (via WagonGlyph)
 * on a lightened tint of its livery colour, with the reference letter in a
 * solid, high-contrast badge on top — the letter is the primary read, the
 * drawing is the "which kind of car" supporting cue.
 *
 * Memoized: GameScreen re-renders this bar on every move AND every 1s timer
 * tick, and each chip owns a real Skia <Canvas> (WagonGlyph) — without this,
 * every tick would recreate every canvas in the target sequence.
 */
const ObjectiveChip = React.memo(function ObjectiveChip({ label, compact, palette }: ObjectiveChipProps) {
  const material = wagonMaterialForLabel(label, palette);
  const size = compact ? CHIP_COMPACT : CHIP;
  const cardBg = lightenTint(material.hi, 0.55);
  const badgeInk = inkOn(material.hi);
  const glyphWidth = size.width - size.border * 2;
  const glyphHeight = size.height - size.border * 2;
  return (
    <View
      style={[
        styles.chip,
        {
          width: size.width,
          height: size.height,
          borderRadius: size.radius,
          borderWidth: size.border,
          backgroundColor: cardBg,
          borderColor: 'rgba(0,0,0,0.35)',
        },
      ]}
    >
      <View style={{ position: 'absolute', top: size.border, left: size.border }}>
        <WagonGlyph label={label} width={glyphWidth} height={glyphHeight} />
      </View>
      <View
        style={[
          styles.chipBadge,
          {
            width: size.badge,
            height: size.badge,
            borderRadius: size.badge / 2,
            backgroundColor: material.hi,
            bottom: -size.border,
            right: -size.border,
          },
        ]}
      >
        <Text
          style={[styles.chipBadgeLabel, { fontSize: size.font, color: badgeInk }]}
          maxFontSizeMultiplier={1.3}
        >
          {label}
        </Text>
      </View>
    </View>
  );
});

interface ObjectiveBarShuntingProps {
  target: string[];
  /**
   * Landscape mode: renders a slimmer strip (objectiveBarHeightCompact
   * instead of objectiveBarHeight) with a shorter "OBJ:" label so the HUD
   * doesn't eat a second full-height strip when the compact TopBar row has
   * already claimed most of the vertical budget — see GameScreen.tsx.
   */
  compact?: boolean;
}

/** Shunting objective bar: "OBJETIVO:" + target-sequence wagon chips. */
export function ObjectiveBarShunting({ target, compact = false }: ObjectiveBarShuntingProps) {
  const palette = usePalette();
  const { hud } = palette;
  const accessibilityLabel = `Objetivo: ${target
    .map((label) => `${label}, ${WAGON_KIND_NAMES[wagonKindFor(label)]}`)
    .join('; ')}.`;
  return (
    <View
      style={[
        styles.container,
        compact && styles.containerCompact,
        { backgroundColor: hud.panelBg, borderBottomColor: hud.buttonBorder },
      ]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.inner}>
        <Text style={[styles.label, compact && styles.labelCompact, { color: hud.textDim }]} maxFontSizeMultiplier={1.3}>
          {compact ? 'OBJ:' : 'OBJETIVO:'}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {target.map((label, i) => (
            <React.Fragment key={`${label}-${i}`}>
              {i > 0 ? (
                <Text style={[styles.sep, { color: hud.textDim }]} maxFontSizeMultiplier={1.3}>
                  ›
                </Text>
              ) : null}
              <ObjectiveChip label={label} compact={compact} palette={palette} />
            </React.Fragment>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

interface ObjectiveBarClassificationProps {
  levelName: string;
  remaining: number;
  /** Head-of-selected-arrival preview, or null if no arrivals remain. */
  next: { tipo: string; color: DestinationKey } | null;
  /** Landscape mode — see ObjectiveBarShuntingProps.compact. */
  compact?: boolean;
}

/** Classification objective bar: level name, "POR CLASIFICAR: n", "Próximo: ... · destino ...". */
export function ObjectiveBarClassification({
  levelName,
  remaining,
  next,
  compact = false,
}: ObjectiveBarClassificationProps) {
  const { hud } = usePalette();
  const nextInfo = next ? parseNext(next) : null;
  const label = `${levelName}. ${
    nextInfo ? `Próximo: ${nextInfo.tipoName}, destino ${nextInfo.name}. ` : ''
  }Por clasificar: ${remaining}.`;
  return (
    <View
      style={[
        styles.container,
        compact && styles.containerCompact,
        { backgroundColor: hud.panelBg, borderBottomColor: hud.buttonBorder },
      ]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <View style={styles.inner}>
        {compact ? null : (
          <Text style={[styles.levelName, { color: hud.text }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {levelName}
          </Text>
        )}
        <View style={styles.centerFlex}>
          {nextInfo ? (
            <Text numberOfLines={1} maxFontSizeMultiplier={1.3}>
              <Text style={[styles.nextPrefix, compact && styles.nextPrefixCompact, { color: hud.textDim }]}>
                Próximo: {nextInfo.tipoName} · destino{' '}
              </Text>
              <Text style={[styles.nextDest, compact && styles.nextDestCompact, { color: nextInfo.color }]}>
                {nextInfo.name}
              </Text>
            </Text>
          ) : null}
        </View>
        <Text
          style={[styles.remaining, compact && styles.remainingCompact, { color: hud.textDim }]}
          maxFontSizeMultiplier={1.3}
        >
          {compact ? `POR CLAS.: ${remaining}` : `POR CLASIFICAR: ${remaining}`}
        </Text>
      </View>
    </View>
  );
}

function parseNext(next: { tipo: string; color: DestinationKey }) {
  const dest = colors.destinations[next.color];
  return {
    tipoName: CAR_TYPE_NAMES[next.tipo as keyof typeof CAR_TYPE_NAMES] ?? next.tipo,
    name: dest.label,
    color: dest.fill,
  };
}

const styles = StyleSheet.create({
  container: {
    height: layout.objectiveBarHeight,
    backgroundColor: colors.surface.targetBg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
  },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: layout.playAreaMaxWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  label: {
    ...typeScaleMenu.caption,
    marginRight: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
  },
  chip: {
    position: 'relative',
    marginHorizontal: 2,
    overflow: 'visible',
  },
  chipBadge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.35)',
  },
  chipBadgeLabel: {
    fontFamily: fontFamilyMenu.extraBold,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  sep: {
    marginHorizontal: 2,
  },
  levelName: {
    ...typeScaleMenu.body,
    maxWidth: '35%',
  },
  centerFlex: {
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
  nextPrefix: {
    ...typeScaleMenu.bodySmall,
  },
  nextDest: {
    ...typeScaleMenu.bodySmall,
    fontWeight: '700',
  },
  remaining: {
    ...typeScaleMenu.bodySmall,
  },
  // ── Landscape ("compact") mode ────────────────────────────────────────
  containerCompact: {
    height: layout.objectiveBarHeightCompact,
  },
  labelCompact: {
    ...typeScaleMenu.micro,
    marginRight: spacing.xs,
  },
  nextPrefixCompact: {
    ...typeScaleMenu.micro,
  },
  nextDestCompact: {
    ...typeScaleMenu.micro,
    fontWeight: '700',
  },
  remainingCompact: {
    ...typeScaleMenu.micro,
  },
});
