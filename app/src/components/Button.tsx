import React, { cloneElement, isValidElement } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fontFamilyMenu, layout, radii, spacing, textColors, typeScaleMenu } from '../../design/tokens';
import { fireHaptic } from '../controller/haptics';
import { textOnAccent } from './copy';
import { usePalette } from '../render/iso/timeOfDay';

/**
 * The four button "looks" used across the whole app (game panel, menus, the
 * score window) — replaces the previous per-call-site `color`/`textColor`
 * combinations with a small named set so every screen reads as one product:
 *  - `primary`   — filled with the active time-of-day `hud.accent`, ink
 *    picked automatically via `textOnAccent` for contrast on every pass.
 *    The one "do the main thing" action per screen (COMENZAR, GUARDAR,
 *    SIGUIENTE, the tutorial's NEXT button, …).
 *  - `secondary` — `hud.buttonBg` fill + `hud.buttonBorder` outline +
 *    `hud.text` ink. Everything that isn't the primary action or a
 *    destructive one (MENÚ, REINICIAR, REPETIR, COMPARTIR, SALTAR, …).
 *  - `danger`    — fixed `colors.button.danger` fill (NOT palette-driven —
 *    "this deletes your progress" should look the same at every hour) +
 *    `textColors.onAccent` ink.
 *  - `undo`      — the one recurring bespoke case: undo's own
 *    `hud.undoBg`/`hud.undoBorder`/`hud.undoText` tokens when enabled,
 *    falling back to the plain `secondary` fill/ink when `disabled` (nothing
 *    to undo) — used by both TopBar's compact-row icon button and
 *    BottomBar's full-width thumb-zone button so the two never drift apart.
 *
 * `iconOnly` is an orthogonal LAYOUT flag, not a fifth color: any variant
 * above can render as a square, label-less, centered-glyph button (the
 * top bar's MENÚ/REINICIAR/DESHACER icon buttons are `secondary`/`undo` +
 * `iconOnly`, not a separate "icon" look) — this avoids a combinatorial
 * "primary-icon vs secondary-icon vs …" variant explosion while still
 * giving every icon-only button the same square/centered/48dp-floor
 * treatment. `accessibilityLabel` is required in practice for `iconOnly`
 * since there is no visible text left for a screen reader to read.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'undo';
export type IconSide = 'leading' | 'trailing';

interface ButtonProps {
  /** Omit only when `iconOnly` — every other button must keep a visible label. */
  label?: string;
  onPress: () => void;
  /** Default `'secondary'`. */
  variant?: ButtonVariant;
  /** Square, label-less, centered-icon layout — `width`/`height` become the
   *  side of the square (still defaulting to the 48dp `height` floor). */
  iconOnly?: boolean;
  /**
   * The glyph, e.g. `<RestartIcon />` — size/color are computed and injected
   * by this component (see the file-level sizing-rule doc below), so callers
   * do NOT need to pass either prop on the icon element themselves; a
   * `color` the caller DOES set is respected (rare — only for a glyph that
   * must NOT match the button's own ink), everything else is owned here.
   */
  icon?: React.ReactNode;
  /**
   * Which side of the label the icon renders on — default `'leading'`
   * (REPETIR, COMPARTIR, REINICIAR, …: the icon reads as "this is the
   * action"). Use `'trailing'` only for forward/continue navigation
   * (SIGUIENTE, the tutorial's NEXT buttons) where the arrow means "go on
   * from here", mirroring how arrow_forward reads in any Material app.
   * Ignored when `iconOnly`.
   */
  iconSide?: IconSide;
  width?: number | `${number}%`;
  /** Also becomes the iconOnly square's side. Default 48 (the tap-target floor). */
  height?: number;
  disabled?: boolean;
  style?: ViewStyle;
  fontSize?: number;
  /** Overrides the screen-reader label — REQUIRED in practice for `iconOnly`
   *  buttons, since the visible glyph carries no text for a screen reader. */
  accessibilityLabel?: string;
  /**
   * Bespoke override escape hatches. Every call site in this app now uses
   * `variant` instead — these exist only so a future one-off (a color the
   * four variants above genuinely can't express) doesn't need to invent a
   * fifth variant for a single button. Prefer `variant`.
   */
  color?: string;
  textColor?: string;
  borderColor?: string;
}

/**
 * ── Icon sizing/spacing rule (applies everywhere, no per-button tweaks) ──
 * - Labeled button + icon: icon side = label fontSize × this ratio. Material
 *   Symbols' glyphs sit inside their own internal padding and read visibly
 *   smaller than text at equal px, so a straight 1:1 looks undersized next
 *   to the label it's paired with.
 */
const ICON_TO_LABEL_RATIO = 1.2;
/**
 * - Icon-only button: icon side = the button's own square side × this ratio
 *   — identical to MuteToggleButton's existing convention, so every
 *   icon-only chip in the app (mute toggle included) shares one "how big is
 *   the glyph inside its box" rule.
 */
const ICON_ONLY_RATIO = 0.42;
/** - Gap between icon and label: the existing `inner` flex gap (spacing.xs),
 *    unchanged — called out here so it's documented as a deliberate rule,
 *    not an accident of the layout. */
const ICON_LABEL_GAP = spacing.xs;

/** Shared HUD/menu/card action button — 48dp tall floor, press scale + light
 *  haptic, one of the four `ButtonVariant` looks above. */
export default function Button({
  label,
  onPress,
  variant = 'secondary',
  iconOnly = false,
  icon,
  iconSide = 'leading',
  width,
  height = 48,
  disabled = false,
  style,
  fontSize,
  accessibilityLabel,
  color,
  textColor,
  borderColor,
}: ButtonProps) {
  const { hud } = usePalette();

  let fill: string;
  let ink: string;
  let border: string | null;
  switch (variant) {
    case 'primary': {
      fill = color ?? hud.accent;
      ink = textColor ?? textOnAccent(fill);
      border = borderColor ?? null;
      break;
    }
    case 'danger': {
      fill = color ?? colors.button.danger;
      ink = textColor ?? textColors.onAccent;
      border = borderColor ?? null;
      break;
    }
    case 'undo': {
      fill = color ?? (disabled ? hud.buttonBg : hud.undoBg);
      ink = textColor ?? (disabled ? hud.textDim : hud.undoText);
      border = borderColor ?? (disabled ? hud.buttonBorder : hud.undoBorder);
      break;
    }
    case 'secondary':
    default: {
      fill = color ?? hud.buttonBg;
      ink = textColor ?? hud.text;
      border = borderColor ?? hud.buttonBorder;
      break;
    }
  }

  const resolvedFontSize = fontSize ?? typeScaleMenu.button.fontSize;
  const iconSize = iconOnly ? Math.round(height * ICON_ONLY_RATIO) : Math.round(resolvedFontSize * ICON_TO_LABEL_RATIO);
  const renderedIcon = isValidElement(icon)
    ? cloneElement(icon as React.ReactElement<{ size?: number; color?: string }>, {
        size: iconSize,
        color: (icon as React.ReactElement<{ color?: string }>).props.color ?? ink,
      })
    : icon;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      onPress={() => {
        void fireHaptic('light');
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        iconOnly ? styles.iconOnly : null,
        {
          backgroundColor: fill,
          height,
          width: iconOnly ? (width ?? height) : width,
          borderWidth: border ? 1 : 0,
          borderColor: border ?? 'transparent',
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        pressed && !disabled ? { transform: [{ scale: 0.97 }] } : null,
        style,
      ]}
      hitSlop={8}
    >
      {iconOnly ? (
        renderedIcon
      ) : (
        <View style={styles.inner}>
          {iconSide === 'leading' ? renderedIcon : null}
          {label ? (
            <Text
              style={[styles.label, { color: ink, fontSize: resolvedFontSize }]}
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
            >
              {label}
            </Text>
          ) : null}
          {iconSide === 'trailing' ? renderedIcon : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    minWidth: 48,
  },
  iconOnly: {
    paddingHorizontal: 0,
    minWidth: layout.minTapTarget,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: ICON_LABEL_GAP,
  },
  label: {
    fontFamily: fontFamilyMenu.bold,
    fontWeight: '700',
    letterSpacing: typeScaleMenu.button.letterSpacing,
    textTransform: 'uppercase',
  },
});
