/**
 * design/tokens.ts — SINGLE SOURCE OF TRUTH for the Train Shunting visual
 * design system (Expo + React Native + Skia, portrait-first, Android target).
 *
 * All plain data — no React Native, Reanimated, Skia, or expo-haptics
 * imports here. This file must be importable from pure Node (Jest) without
 * pulling in native modules. Renderer and UI code import these constants
 * instead of hard-coding hex/px/ms values.
 *
 * Ported and extended from the reference web app's palette
 * (ref/js/core/canvas.js `C`, ref/js/shunting/state.js `CAR_TYPES`,
 * ref/js/classification/state.js `COLORES`). Hex values for anything that
 * existed in the reference are kept byte-identical so the two apps read as
 * the same product. See design/design-system.md for rationale and
 * design/components.md for per-component usage.
 */

// ─────────────────────────────────────────────────────────────────────────
// COLOR
// ─────────────────────────────────────────────────────────────────────────

/** App background: vertical gradient + faint grid overlay. */
export const backgroundColors = {
  gradientTop: '#0d1117',
  gradientBottom: '#1a1f2e',
  /** Faint 48dp grid lines drawn over the background (see layout.gridSize). */
  grid: 'rgba(255,255,255,0.025)',
} as const;

/** Track bed: ballast, sleepers (ties), rails. Identical across both modes. */
export const trackColors = {
  ballast: '#252535',
  sleeperA: '#5d3f2a',
  sleeperB: '#4a3322',
  railHighlight: '#c8d0da',
  railShadow: '#606870',
  /** Peine (fan throat) convergence spine + node dots. */
  peineSpine: '#8090a0',
  peineNode: '#c8d0da',
} as const;

/**
 * The 5 destination colors. color === destination is the core mechanic of
 * Patio de Clasificación and MUST stay semantically identical to the
 * reference (ref/js/classification/state.js `COLORES`). Do not rename or
 * recolor these keys.
 */
export const destinationColors = {
  rojo: { fill: '#E14B4B', dark: '#A83232', label: 'Rojo' },
  azul: { fill: '#3E8EDE', dark: '#2A66A6', label: 'Azul' },
  verde: { fill: '#47B26B', dark: '#2F8A4E', label: 'Verde' },
  ambar: { fill: '#E9C63F', dark: '#B3952B', label: 'Ámbar' },
  violeta: { fill: '#9B6BD6', dark: '#7248A8', label: 'Violeta' },
} as const;

export type DestinationKey = keyof typeof destinationColors;

/**
 * Yard-scenery container-stack hues (design/scenery-spec.md §2.4). Fixed
 * ABSOLUTE pigment shared by every shunting section that includes a
 * container-stack prop — deliberately NOT time-of-day-varied (the
 * whole-canvas `atmosphere` bloom/vignette pass already unifies every prop's
 * mood per hour, see ShuntingBoard.tsx's final Rect) and deliberately NOT the
 * same values as `destinationColors` above, so a background container is
 * never mistaken for a wagon-destination cue (scenery-spec.md R5). The one
 * approved exception is Clasificación's own recipe, which intentionally
 * reuses `destinationColors` instead of these — see
 * src/render/primitives/scenery/recipes.ts.
 */
export const containerHues = {
  red: '#c0392b',
  blue: '#1f5fa8',
  amber: '#d68a1f',
} as const;

/**
 * Accessibility redundancy for destinationColors: rojo/verde is the classic
 * red-green colorblind confusion pair, and this game scores purely on
 * fill-color matching. Every destination additionally gets a distinct
 * geometric marker to paint as a small badge (see components.md → "Colorblind
 * safety badge"). Never rely on hue alone to communicate destination.
 */
export const destinationMarkers: Record<DestinationKey, 'circle' | 'square' | 'triangle' | 'diamond' | 'star'> = {
  rojo: 'circle',
  azul: 'square',
  verde: 'triangle',
  ambar: 'diamond',
  violeta: 'star',
};

/**
 * Wagon body materials for Patio de Maniobras (shunting). Index/name mapping
 * is preserved from ref CAR_TYPES: a car's shape is `label.charCodeAt(0) %
 * wagonMaterials.length`. These are NOT destination colors — they're purely
 * cosmetic body-shell finishes.
 */
export const wagonMaterials = {
  boxcar: { name: 'Boxcar', lo: '#7a2e0a', hi: '#c04020', accent: '#4a1806', roof: '#2e1004' },
  hopper: { name: 'Hopper', lo: '#1e2d42', hi: '#324e70', accent: '#121c2a', rim: '#506080' },
  gondola: { name: 'Gondola', lo: '#1a3018', hi: '#2a5028', accent: '#0e1c0c', rim: '#487045' },
  tanker: { name: 'Tanker', lo: '#262626', hi: '#545454', accent: '#909090', band: '#1a1a1a' },
  container: { name: 'Container', lo: '#0e3060', hi: '#1858b8', accent: '#07183a', stripe: '#e8c000' },
} as const;

/** Ordered array form, for the `charCode % length` shape-selection algorithm. */
export const wagonMaterialOrder = [
  wagonMaterials.boxcar,
  wagonMaterials.hopper,
  wagonMaterials.gondola,
  wagonMaterials.tanker,
  wagonMaterials.container,
] as const;

/**
 * Locomotive body colors: active (pulling) vs idle (parked, tappable).
 * Extended with a couple more shades (chassis/buffer/roof/handrail/wheelHub)
 * for the polished center-cab shunter silhouette in LocoButton.tsx — the
 * original set only had enough tone range for a flat rounded-rect body.
 */
export const locoColors = {
  activeLo: '#c62828',
  activeHi: '#ef5350',
  idleLo: '#37474f',
  idleHi: '#546e7a',
  cabWindow: 'rgba(100,180,255,0.6)',
  cabWindowHi: 'rgba(180,225,255,0.55)',
  headlight: 'rgba(255,220,100,0.9)',
  headlightGlow: 'rgba(255,255,150,0.35)',
  /** Roof cap stripe: active (warm, matches the red livery) vs idle (cool gray). */
  roofActive: '#7a1010',
  roofIdle: '#20262b',
  /** Underframe / buffer beam / coupler — near-black, shared by active & idle. */
  chassis: '#14181c',
  buffer: '#0b0d10',
  /** Thin grab-iron / handrail highlight along the hood side. */
  handrail: 'rgba(255,255,255,0.28)',
  wheelHub: '#7d7d7d',
} as const;

/**
 * Idle-locomotive "ghost slot" — the ONLY treatment for a non-active parked
 * loco on the shunting board (see ShuntingBoard.tsx's ShuntingRow / user
 * feedback: a solid grey loco read as an object in itself, not a possible
 * place). Deliberately alpha-only, no fixed color: the component tints the
 * silhouette with the active time-of-day palette's `track.rail` color, since
 * that token is already tuned per-palette to pop against that palette's
 * ballast — the same property that makes a ghost slot legible on every pass.
 */
export const locoGhost = {
  /** Silhouette fill alpha, default vs. boosted while it's a legal drop target. */
  fillAlpha: 0.1,
  fillAlphaTarget: 0.18,
  /** Dashed outline alpha, default vs. boosted. */
  strokeAlpha: 0.4,
  strokeAlphaTarget: 0.6,
  /** Cab window hint + "tap here" chevron — both far fainter than the active loco's. */
  windowAlpha: 0.22,
  chevronAlpha: 0.24,
} as const;

/** Selection / focus glow used on picked-up shunting cars. */
export const carGlowColor = '#4fc3f7';

/**
 * Mixes an alpha channel into a `#rrggbb`/`#rgb` hex color, returning
 * `rgba(...)`. Non-hex input (already `rgb[a]`/`hsl`/named) is returned
 * unchanged — callers only feed this hex tokens from the palettes above.
 */
export function withAlpha(hex: string, alpha: number): string {
  if (!hex.startsWith('#')) return hex;
  let h = hex.slice(1);
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export const textColors = {
  primary: '#e8eaf6',
  dim: '#7986cb',
  warn: '#ff5252',
  onAccent: '#ffffff',
  /** Cyan used exclusively to highlight "this is me" in leaderboards. */
  me: '#4fc3f7',
} as const;

export const statusColors = {
  success: '#69f0ae',
  error: '#ff5252',
  warning: '#f5a623',
  record: '#ffd700',
} as const;

export const starColors = {
  on: '#ffd700',
  off: '#37474f',
  onStroke: 'rgba(255,215,0,0.5)',
} as const;

export const medalColors = {
  gold: '#ffd700',
  silver: '#b0bec5',
  bronze: '#a1887f',
} as const;

/** Level-card left-edge tier stripe: [0 stars, 1 star, 2 stars, 3 stars]. */
export const starTierStripe = [locoColors.idleLo, '#6d4c41', '#607d8b', medalColors.gold] as const;

/** Opaque/translucent surfaces: bars, overlays, cards. */
export const surfaceColors = {
  headerBg: 'rgba(8,12,24,0.94)',
  targetBg: 'rgba(5,8,18,0.88)',
  menuBg: '#080c16',
  card: '#111827',
  cardHighlight: 'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(255,255,255,0.06)',
  winOverlay: 'rgba(4,6,16,0.93)',
  panel: 'rgba(0,0,0,0.3)',
  rowStripe: 'rgba(255,255,255,0.025)',
} as const;

/** Semantic button fills. Every one of these pairs with textColors.onAccent. */
export const buttonColors = {
  neutral: '#37474f',
  neutralAlt: '#2c3e50',
  menu: '#1a237e',
  confirmLo: '#1b5e20',
  confirmHi: '#2e7d32',
  undo: '#4a148c',
  undoDisabled: 'rgba(74,20,140,0.3)',
  danger: '#c62828',
} as const;

export const capacityColors = {
  ok: '#546e7a',
  full: '#c62828',
} as const;

/** Mode-identity accent colors (used for mode-select cards, headers, HUD tint). */
export const modeAccent = {
  shunting: '#ffd700', // "Patio de Maniobras" — gold, matches original menu title
  classification: '#f5a623', // "Patio de Clasificación" — amber
} as const;

/** Login screen specific gradient + glow (kept distinct from app background). */
export const loginColors = {
  cardGradientStart: '#141a2e',
  cardGradientEnd: '#0d1117',
  cardBorder: 'rgba(255,215,0,0.25)',
  cardGlow: 'rgba(255,215,0,0.08)',
  inputBg: 'rgba(255,255,255,0.06)',
  inputBorder: 'rgba(255,255,255,0.15)',
  inputBorderFocus: 'rgba(255,215,0,0.5)',
  placeholder: 'rgba(255,255,255,0.25)',
} as const;

export const colors = {
  background: backgroundColors,
  track: trackColors,
  destinations: destinationColors,
  destinationMarkers,
  wagons: wagonMaterials,
  wagonOrder: wagonMaterialOrder,
  loco: locoColors,
  locoGhost,
  carGlow: carGlowColor,
  text: textColors,
  status: statusColors,
  star: starColors,
  medal: medalColors,
  starTierStripe,
  surface: surfaceColors,
  button: buttonColors,
  capacity: capacityColors,
  modeAccent,
  login: loginColors,
} as const;

// ─────────────────────────────────────────────────────────────────────────
// SPACING (dp)
// ─────────────────────────────────────────────────────────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  massive: 48,
  giant: 64,
} as const;

// ─────────────────────────────────────────────────────────────────────────
// RADII (dp)
// ─────────────────────────────────────────────────────────────────────────

export const radii = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 16,
  xl: 20,
  pill: 999,
  /** Wagon body corner radius (Skia canvas art, not RN components). */
  wagonBody: 3,
} as const;

// ─────────────────────────────────────────────────────────────────────────
// TYPOGRAPHY
// ─────────────────────────────────────────────────────────────────────────

/**
 * Font family identity: Rajdhani (technical/industrial, condensed geometric
 * sans — matches the reference exactly). Load via
 * @expo-google-fonts/rajdhani (not installed by this deliverable — see
 * design-system.md for the exact setup). These are the *loaded* family
 * names expo-font/@expo-google-fonts registers; RN <Text> can reference
 * them directly once useFonts() resolves. Skia canvas text does NOT read
 * these automatically — see design-system.md "Fonts in Skia" for the
 * matchFont/useFont wiring other agents must add.
 */
export const fontFamily = {
  medium: 'Rajdhani_500Medium',
  semiBold: 'Rajdhani_600SemiBold',
  bold: 'Rajdhani_700Bold',
} as const;

/**
 * Pre-font-load / Skia-unavailable fallback stack, platform-aware. Use
 * whenever `fontFamily.*` hasn't finished loading yet, or as the Skia
 * fallback typeface family before a Rajdhani .ttf is embedded via
 * Skia.Typeface.
 */
export const fontFallback = {
  ios: 'System',
  android: 'sans-serif-condensed',
} as const;

export type TextStyleToken = {
  fontFamily: string;
  fontSize: number;
  fontWeight: '500' | '600' | '700';
  letterSpacing: number;
  lineHeight: number;
};

/** Named text styles. `fontSize`/`lineHeight` in dp, `letterSpacing` in dp. */
export const typeScale: Record<string, TextStyleToken> = {
  display: { fontFamily: fontFamily.bold, fontSize: 32, fontWeight: '700', letterSpacing: 2, lineHeight: 38 },
  h1: { fontFamily: fontFamily.bold, fontSize: 24, fontWeight: '700', letterSpacing: 1.5, lineHeight: 29 },
  h2: { fontFamily: fontFamily.bold, fontSize: 20, fontWeight: '700', letterSpacing: 1, lineHeight: 25 },
  h3: { fontFamily: fontFamily.semiBold, fontSize: 17, fontWeight: '600', letterSpacing: 0.5, lineHeight: 21 },
  body: { fontFamily: fontFamily.semiBold, fontSize: 15, fontWeight: '600', letterSpacing: 0.3, lineHeight: 19 },
  bodySmall: { fontFamily: fontFamily.semiBold, fontSize: 13, fontWeight: '600', letterSpacing: 0.3, lineHeight: 17 },
  caption: { fontFamily: fontFamily.semiBold, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, lineHeight: 14 },
  micro: { fontFamily: fontFamily.semiBold, fontSize: 9, fontWeight: '600', letterSpacing: 0.8, lineHeight: 12 },
  button: { fontFamily: fontFamily.bold, fontSize: 15, fontWeight: '700', letterSpacing: 1.5, lineHeight: 19 },
  /** Big HUD numbers: moves, time, level number, score. Tabular reading. */
  numeric: { fontFamily: fontFamily.bold, fontSize: 20, fontWeight: '700', letterSpacing: 0, lineHeight: 24 },
  numericLarge: { fontFamily: fontFamily.bold, fontSize: 40, fontWeight: '700', letterSpacing: 0, lineHeight: 46 },
};

/**
 * Menu typography identity: Raleway — used ONLY by the 5 non-gameplay
 * screens (Login, ModeSelect, LevelSelect, Settings, Leaderboard). The game
 * board/HUD keeps Rajdhani (`fontFamily` above) untouched.
 *
 * Load via @expo-google-fonts/raleway (see the app's font-loading entry
 * point). RN <Text> can reference these directly once useFonts() resolves;
 * see design_handoff_menus/README.md §1.
 */
export const fontFamilyMenu = {
  medium: 'Raleway_500Medium',
  semiBold: 'Raleway_600SemiBold',
  bold: 'Raleway_700Bold',
  extraBold: 'Raleway_800ExtraBold',
} as const;

/**
 * Menu-screen equivalent of `typeScale` — identical sizes/weights/
 * letterSpacing/lineHeight per named style, only the family swapped to
 * `fontFamilyMenu.*`. Kept as a hand-mirrored table (not derived
 * programmatically) so this file stays trivially diffable against
 * `typeScale` above if that one ever changes.
 */
export const typeScaleMenu: Record<string, TextStyleToken> = {
  display: { fontFamily: fontFamilyMenu.bold, fontSize: 32, fontWeight: '700', letterSpacing: 2, lineHeight: 38 },
  h1: { fontFamily: fontFamilyMenu.bold, fontSize: 24, fontWeight: '700', letterSpacing: 1.5, lineHeight: 29 },
  h2: { fontFamily: fontFamilyMenu.bold, fontSize: 20, fontWeight: '700', letterSpacing: 1, lineHeight: 25 },
  h3: { fontFamily: fontFamilyMenu.semiBold, fontSize: 17, fontWeight: '600', letterSpacing: 0.5, lineHeight: 21 },
  body: { fontFamily: fontFamilyMenu.semiBold, fontSize: 15, fontWeight: '600', letterSpacing: 0.3, lineHeight: 19 },
  bodySmall: { fontFamily: fontFamilyMenu.semiBold, fontSize: 13, fontWeight: '600', letterSpacing: 0.3, lineHeight: 17 },
  caption: { fontFamily: fontFamilyMenu.semiBold, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, lineHeight: 14 },
  micro: { fontFamily: fontFamilyMenu.semiBold, fontSize: 9, fontWeight: '600', letterSpacing: 0.8, lineHeight: 12 },
  button: { fontFamily: fontFamilyMenu.bold, fontSize: 15, fontWeight: '700', letterSpacing: 1.5, lineHeight: 19 },
  numeric: { fontFamily: fontFamilyMenu.bold, fontSize: 20, fontWeight: '700', letterSpacing: 0, lineHeight: 24 },
  numericLarge: { fontFamily: fontFamilyMenu.bold, fontSize: 40, fontWeight: '700', letterSpacing: 0, lineHeight: 46 },
};

export const typography = { fontFamily, fontFallback, typeScale, fontFamilyMenu, typeScaleMenu } as const;

// ─────────────────────────────────────────────────────────────────────────
// SHADOWS / ELEVATION
// React Native shadow props (iOS) + `elevation` (Android). Provide both on
// every preset since Android ignores shadowOffset/Radius/Opacity.
// ─────────────────────────────────────────────────────────────────────────

export type ShadowToken = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

export const shadows: Record<string, ShadowToken> = {
  none: { shadowColor: 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
  card: { shadowColor: '#000000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 4 },
  raised: { shadowColor: '#000000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  hudBar: { shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 6 },
  modal: { shadowColor: '#000000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.7, shadowRadius: 40, elevation: 16 },
  glowSelected: { shadowColor: carGlowColor, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.85, shadowRadius: 16, elevation: 10 },
  glowSuccess: { shadowColor: statusColors.success, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 14, elevation: 10 },
  glowGold: { shadowColor: medalColors.gold, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 30, elevation: 12 },
  glowDanger: { shadowColor: statusColors.error, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 14, elevation: 8 },
};

// ─────────────────────────────────────────────────────────────────────────
// MOTION
// Durations in ms. Easing given as cubic-bezier control points [x1,y1,x2,y2]
// so consuming code can feed them into Reanimated's `Easing.bezier(...)`
// without this file importing react-native-reanimated.
// ─────────────────────────────────────────────────────────────────────────

export const durations = {
  instant: 100,
  fast: 150,
  base: 200,
  moderate: 300,
  slow: 450,
  /**
   * Base duration for a car/loco move animation before distance scaling.
   * Slowed from the reference's 380ms so the ladder excursion (pull out →
   * converge → traverse → re-fan → settle) reads as a deliberate shunting
   * move instead of a snap — see waypoints.ts / useShuntingAnimation.ts.
   */
  carMoveBase: 620,
  /** Additional duration added at maximum track-to-track distance. */
  carMoveDistanceMax: 680,
  cardEnter: 400,
  confetti: 1200,
  /**
   * Shunting switchback move (railPath.ts): total wall-clock duration for
   * the whole pull-out + reversal-pause + push-in choreography, scaled
   * between these two bounds by how far the train has to travel (relative
   * to the yard's own plane width) — see buildRailPlan. Kept snappy (well
   * under 2s) even for the longest hops so input doesn't feel locked out.
   */
  shuntMoveMin: 900,
  shuntMoveMax: 1800,
  /**
   * Brief stop at the reversal (the switch "throws") before the train
   * reverses into the destination branch — see buildRailPlan/railPath.ts.
   */
  shuntReversalPauseMin: 80,
  shuntReversalPauseMax: 150,
} as const;

export const easingCurves = {
  /** Material "standard" — most UI transitions (cards, sheets, buttons). */
  standard: [0.4, 0.0, 0.2, 1] as const,
  /** Entrances: content already visible speeding to rest. */
  decelerate: [0.0, 0.0, 0.2, 1] as const,
  /** Exits: at-rest content accelerating away. */
  accelerate: [0.4, 0.0, 1, 1] as const,
  /** Car/loco travel along the peine — symmetric ease matches the
   * reference's `easeInOut` (t<0.5: 2t², else -1+(4-2t)t). */
  travel: [0.45, 0.05, 0.55, 0.95] as const,
} as const;

/** Spring configs for Reanimated `withSpring`. */
export const springs = {
  /** Buttons/cards: quick settle, minimal wobble. */
  snappy: { damping: 18, stiffness: 260, mass: 0.9 },
  /** Win-card entrance, star pop-in: a bit more bounce. */
  bouncy: { damping: 12, stiffness: 180, mass: 1 },
} as const;

/**
 * Legacy flat per-car stagger fraction (reference `stagger = 0.10` in
 * AnimationManager). Superseded by the physically-derived coupling lag in
 * useShuntingAnimation.ts (each car lags the locomotive by its real
 * (carWidth+carGap) trailing distance along the ladder path, so the cut
 * strings out with constant spacing instead of a flat time offset) — kept
 * as the floor/fallback fraction for degenerate (zero-length) paths.
 */
export const carMoveStagger = 0.1;

/** Pulse cycle rates in Hz for looping "breathing" glows (converted from the
 * reference's `sin(animTime * k)` at its implicit ~1 rad/s time base). */
export const pulseRates = {
  /** Selected-car glow pulse (reference: sin(animTime*5)). */
  selectedCar: 0.8,
  /** Valid-destination clearance-marker pulse (reference: sin(animTime*3)). */
  clearanceMarker: 0.48,
  /** Tutorial highlight pulse (reference: sin(animTime*4)). */
  tutorialHighlight: 0.64,
  /** New-record card border glow (reference: sin(animTime*4)). */
  recordGlow: 0.64,
} as const;

export const motion = { durations, easingCurves, springs, carMoveStagger, pulseRates } as const;

// ─────────────────────────────────────────────────────────────────────────
// HAPTICS
// String identifiers only (no expo-haptics import — keeps this file free of
// native-module side effects so it can be imported under Jest/Node). Map
// these to expo-haptics calls at the call site:
//   light|medium|heavy      → Haptics.impactAsync(Haptics.ImpactFeedbackStyle.*)
//   success|warning|error   → Haptics.notificationAsync(Haptics.NotificationFeedbackType.*)
//   selection                → Haptics.selectionAsync()
// ─────────────────────────────────────────────────────────────────────────

export const haptics = {
  /** Tapping an empty track to place the locomotive. */
  placeLoco: 'light',
  /** Tapping a car to trim the selected block. */
  selectCar: 'selection',
  /** Confirming a move onto a destination track (cars start animating). */
  confirmMove: 'medium',
  /** Move rejected: track full / loco limit exceeded / occupied by other loco. */
  moveRejected: 'error',
  /** Undo. */
  undo: 'light',
  /** Level won. */
  win: 'success',
  /** New personal record on the win card. */
  newRecord: 'success',
  /** Star pop-in on the win/summary card, per star. */
  starReveal: 'light',
  /** Generic button press (menu, restart, navigation). */
  buttonPress: 'light',
  /** Classification: pushing a car onto a track with a color jump (−15). */
  colorJump: 'warning',
} as const;

// ─────────────────────────────────────────────────────────────────────────
// LAYOUT
// Portrait-first constants. See design-system.md § "Portrait yard layout"
// for the full derivation and worked examples against real level data
// (max 7 shunting tracks, max capacity 13; max 8 classification rows).
// ─────────────────────────────────────────────────────────────────────────

export const layout = {
  /** Absolute floor for any interactive element's touch dimension (dp). */
  minTapTarget: 48,

  /** Background grid line pitch, screen dp (reference used 60px @ desktop). */
  gridSize: 48,

  // ── Fixed chrome ──────────────────────────────────────────────────────
  topBarHeight: 56,
  objectiveBarHeight: 40,
  bottomBarHeight: 56,
  toastHeight: 44,
  toastMaxWidth: 320,
  /**
   * Single-row compact HUD height for landscape (see TopBar's `compact`
   * mode) — replaces the portrait two-row topBarHeight+statRow stack so the
   * board gets the freed vertical space back. Still comfortably clears
   * minTapTarget for the icon buttons it hosts.
   */
  topBarHeightCompact: 56,
  /** Slim objective strip height for landscape's compact HUD — a fraction of
   *  the portrait objectiveBarHeight since it no longer needs to be a full
   *  reading-comfortable strip on its own. */
  objectiveBarHeightCompact: 28,

  // ── Yard (track) layout ──────────────────────────────────────────────
  /** Height of one track's interactive row (car + clearance markers). */
  trackRowHeight: 64,
  /** Vertical gap between consecutive track rows. */
  trackRowGap: 8,
  /** trackRowHeight + trackRowGap — vertical distance between row starts.
   *  Bumped from 68 so fanned peine branches have more vertical room between
   *  rows and don't read as cramped. */
  trackRowPitch: 76,
  /**
   * Lower row-pitch floor used in short (landscape-shaped) viewports —
   * computeShuntingLayout/computeClassificationLayout swap in this floor
   * instead of trackRowPitch whenever the canvas passed to them is wider
   * than it is tall, so dense levels can pack a track or two more before
   * falling back to scrolling. Still comfortably above trackRowHeight so
   * rows don't visually collide.
   */
  trackRowPitchMinShort: 60,
  /** Ceiling the row pitch may grow to (in dp) so a handful of tracks can
   *  gracefully fill a tall viewport instead of hugging the top edge. Only
   *  used when the natural content height is shorter than the available
   *  canvas height — see computeShuntingLayout/computeClassificationLayout. */
  trackRowPitchMax: 136,
  /** Wagon/car visual height. Bumped from the reference's 40px for touch comfort. */
  carHeight: 44,
  /** Car width floor — below this, hitSlop alone can't reach 48dp cleanly for
   * dense tracks, so the row becomes independently horizontally scrollable. */
  carWidthMin: 34,
  /** Car width ceiling — matches the reference's CAR_WIDTH. */
  carWidthMax: 60,
  carGap: 4,
  /** Square tap-friendly locomotive button (bumped from the reference's 52×36). */
  locoButtonSize: 48,
  /** Column reserved for the locomotive button + its gap to the track. */
  locoColumnWidth: 56,
  /** Column reserved for the "n/cap" capacity badge (single-loco tracks). */
  capacityColumnWidth: 44,
  /** Bumped from 16 for a touch more breathing room at the screen edge, which
   *  also lengthens the peine fan branches (see FAN_GAP/shuntingLayout.ts). */
  sideMargin: 20,
  /** Horizontal inset from the screen edge to the peine convergence point.
   *  Bumped from 24 so the fan-throat has more room to sweep before the
   *  convergence node. */
  peineConvergenceInset: 30,

  // ── Level-select grid ──────────────────────────────────────────────────
  levelGridGap: 12,
  levelCardMinWidth: 150,
  /**
   * height = width * this, then clamped to [levelCardMinHeight,
   * levelCardMaxHeight]. Dropped from the original 0.92 (a near-square card
   * copied from the portrait design reference) to a wide, short tile: this
   * app is landscape-locked (DECISIONES §11), so the level-select viewport
   * is wide and SHORT — a near-square card sized off that width blew past
   * half the screen's height per row and left only ~1.5 rows visible before
   * scrolling. The ratio+clamp pair keeps the card a horizontal chip (number
   * left, stars right — see LevelCard.tsx) that stays compact from a small
   * phone's landscape width up through a tablet's.
   */
  levelCardAspectRatio: 0.42,
  /** Floor so a card never gets so short its tap target or text clips, even
   *  at the grid's narrowest (2-column) width tier. */
  levelCardMinHeight: 64,
  /** Ceiling so a card doesn't grow back into a tall panel on a wide
   *  viewport where levelCardMaxWidth hasn't clamped the width yet. Chosen so
   *  3 full rows plus a peeking 4th fit an ~844×390 landscape phone below the
   *  header + section-header chrome. */
  levelCardMaxHeight: 84,
  /**
   * Column-count breakpoints for the level-select grid, paired index-by-index
   * with levelGridColCounts: the first breakpoint the container width is
   * BELOW selects the column count (falls through to the last count once
   * width exceeds every breakpoint). The first threshold (400) reproduces
   * the screen's original phone-only `width < 400 ? 2 : 3` split exactly;
   * the remaining thresholds add tablet/landscape tiers (4–6 cols) on top —
   * see LevelSelectScreen.tsx `colsForWidth`.
   */
  levelGridColBreakpoints: [400, 700, 950, 1200] as const,
  levelGridColCounts: [2, 3, 4, 5, 6] as const,
  /** Ceiling on level-card width so cards stay hand-sized even when column
   *  count caps out at 6 on an ultra-wide display. */
  levelCardMaxWidth: 210,

  // ── Leaderboard ─────────────────────────────────────────────────────────
  leaderboardRowHeight: 72,
  leaderboardBadgeSize: { width: 56, height: 52 },

  // ── Win / summary card ──────────────────────────────────────────────────
  /**
   * Bumped from the original portrait-era 400 — the app is landscape-locked
   * (see DECISIONES §11), so the real available width is the device's long
   * axis, not a phone's short axis. At 400 the action row (REPETIR/MENÚ/
   * SIGUIENTE/COMPARTIR) and the embedded leaderboard's three columns had no
   * room to breathe and wrapped raggedly even though there was plenty of
   * unused width either side of the card. WinSummaryCard clamps this against
   * `width - spacing.giant` (32dp margin each side) so the card still never
   * touches the screen edges on a narrow landscape phone, and never sprawls
   * past 640 on a tablet/wide window.
   */
  winCardMaxWidth: 640,
  winCardEmbeddedRowHeight: 44,

  // ── Mode select ────────────────────────────────────────────────────────
  modeCardHeight: 132,
  modeCardGap: 16,

  // ── Wide-screen / tablet content caps ────────────────────────────────────
  /**
   * Ceiling on the width/height handed to computeShuntingLayout /
   * computeClassificationLayout (see src/screens/GameScreen.tsx's
   * `useCanvasLayout` callers) and on the HUD bars' inner content
   * (TopBar/ObjectiveBar/BottomBar "inner" rows), so the two stay visually
   * aligned. Per-element sizes already self-limit inside the layout
   * functions (carWidthMax, trackRowPitchMax) — this cap instead bounds the
   * overall canvas/content column so it doesn't sprawl toward the screen
   * edges on a large tablet or wide landscape window; the caller centers the
   * capped column within any extra width/height. Chosen generously above
   * the widest/tallest realistic level content (~1000×800 at max car/row
   * counts) so it only engages on genuinely oversized viewports.
   */
  playAreaMaxWidth: 1100,
  playAreaMaxHeight: 1000,
  /** Comfortable max content width for single-column menu/form screens
   *  (Settings cards, Leaderboard rows, ModeSelect cards) — centered within
   *  any extra width on tablets/landscape instead of stretching full-bleed. */
  screenMaxWidth: 640,
} as const;

// ─────────────────────────────────────────────────────────────────────────
// ISOMETRIC YARD ("maqueta") — camera + time-of-day lighting passes
//
// The board is drawn as a tilted 3/4 diorama: one ground plane carrying the
// ballast/rails/route, with the rolling stock billboarded upright on top of
// it. Everything below is COSMETIC — no gameplay rule, score, or level datum
// reads any of it. See design/isometric-yard.md for the derivation and
// src/render/iso/isoCamera.ts for the projection these constants feed.
//
// Hex values are lifted verbatim from the approved design reference
// ("Patio de Trenes — Gráficas", sections 3a–3d). Every other token group in
// this file (destinationColors, statusColors, medalColors, …) is untouched
// by the redesign and still governs its own component.
// ─────────────────────────────────────────────────────────────────────────

export type TimeOfDay = 'amanecer' | 'mediodia' | 'atardecer' | 'noche';

/** Ordered for the settings cycler / segmented control. */
export const timeOfDayOrder: readonly TimeOfDay[] = ['amanecer', 'mediodia', 'atardecer', 'noche'] as const;

/**
 * Closest pass to the app's original dark-gold palette identity, so the
 * default keeps design-system.md §1's "polish the execution, don't change
 * the mood" promise. Players opt into the other three in Ajustes.
 */
export const defaultTimeOfDay: TimeOfDay = 'atardecer';

/** Camera geometry — shared by both boards so the two modes read as one yard. */
export const isoCameraTokens = {
  /**
   * Ground-plane tilt away from the viewer, in degrees. The reference used a
   * CSS `rotateX(63deg)`; in Skia this becomes the vertical foreshortening
   * factor cos(63°) ≈ 0.454 inside the projective matrix.
   */
  tiltDeg: 63,
  /**
   * Perspective strength as the dimensionless ratio (planeHeight/2)·sin(tilt)/d
   * — i.e. how much bigger the near edge of the plane is than the far edge.
   * Fixing the RATIO rather than a pixel `perspective:1000px` keeps the
   * camera angle identical at every board size (0.18 reproduces the
   * reference's 1000px-at-400px-deep plane: near ×1.22, far ×0.85).
   */
  perspective: 0.18,
  /** Fraction of the canvas height left above the yard for sky. */
  skyFraction: 0.19,
  /** Breathing room below the nearest rail and beside the widest (near) row. */
  bottomPadding: 6,
  sidePadding: 4,
  /**
   * Car body height as a multiple of one row's foreshortened screen pitch.
   * >1 means near cars overlap the row behind them — that stacking IS the
   * diorama look (the reference sits at ~1.9). Trimmed here because a real
   * level fills every row, unlike the two-row reference frame.
   */
  carHeightPitchRatio: 1.62,
  /** Same, for the locomotive — slightly taller/bulkier than a wagon. */
  locoHeightPitchRatio: 1.9,
  /** Wheel-bogie band height, as a fraction of the car body height. */
  bogieHeightRatio: 0.11,
} as const;

/** One of the 5 cosmetic body shells, redrawn from real rolling stock. */
export type IsoWagonKind = 'cubierto' | 'gondola' | 'cisterna' | 'tolva' | 'balasto';

/**
 * Selection order for `label.charCodeAt(0) % 5` — UNCHANGED from the old
 * wagonMaterialOrder indices, so a given label keeps the body shape it has
 * always had and only its artwork changes.
 */
export const isoWagonOrder: readonly IsoWagonKind[] = [
  'cubierto', // was "boxcar"
  'tolva', // was "hopper"
  'gondola', // was "gondola"
  'cisterna', // was "tanker"
  'balasto', // was "container"
] as const;

export interface IsoWagonMaterial {
  /** Body gradient, top → bottom. */
  hi: string;
  lo: string;
  /** Roof / top-rim cap strip. */
  cap: string;
  /** Recessed detail: sliding door (cubierto), open well (góndola), bin panel (tolva). */
  inset: string;
  /** Cisterna only — the tank dome's own gradient; hi/lo above is its chassis. */
  domeHi?: string;
  domeLo?: string;
}

export interface TimeOfDayPalette {
  key: TimeOfDay;
  /** Player-facing name (Spanish, matching the rest of the UI copy). */
  label: string;
  /** Sky gradient, top → bottom, with matching 0..1 stops. */
  sky: { colors: readonly string[]; positions: readonly number[] };
  /** Ballast plane radial gradient, center → edge. */
  ground: { colors: readonly string[]; positions: readonly number[] };
  /**
   * Extra warm radial washes painted over the ground (normalized to the
   * plane box) — the lamp-tower spill that only the night pass has.
   */
  groundWashes: readonly { cx: number; cy: number; r: number; color: string }[];
  track: {
    ballast: string;
    sleeper: string;
    rail: string;
    node: string;
    /**
     * Ballast gravel stipple (IsoTrackBed.tsx): two extra dashed strokes
     * reusing the same row-run path, `Hi` the lit facet of a stone and `Lo`
     * its shadowed underside. Roughly the existing `ballast` lightened
     * (`Hi`) / darkened (`Lo`) so the stipple stays a texture on the bed
     * rather than a competing new hue.
     */
    ballastStoneHi: string;
    ballastStoneLo: string;
  };
  route: { glow: string; dash: string };
  /** In-canvas "n/capacity" badge. */
  badge: { ok: string; full: string };
  /** Valid-destination clearance wedge. */
  marker: { edge: string; fillHi: string; fillLo: string };
  wagons: Record<IsoWagonKind, IsoWagonMaterial>;
  loco: {
    /** Primary (red) body gradient — dominant colour, per the reference livery. */
    hi: string;
    lo: string;
    /**
     * Secondary livery colour (dark green), painted over the rear end of the
     * long hood behind a diagonal division — see LocoButton.tsx's
     * `buildGreenPatchPath`.
     */
    hoodHi: string;
    hoodLo: string;
    /** Light frame/sill stripe running the full length under the body. */
    sill: string;
    /**
     * Glass. `windowLo` is the dark tinted base fill (near-black); `windowHi`
     * is used sparingly as a thin diagonal reflection streak, NOT a big
     * gradient stop — real dark-tinted cab glass, not a bright pane.
     */
    windowHi: string;
    windowLo: string;
    headlight: string;
    beam: string;
  };
  /**
   * Skyline behind the yard. `sun` is positioned in sky-band fractions (cx of
   * the canvas width, cy/r of the band's height) so it keeps its place in the
   * composition whatever the canvas is; `stars`/`lampLight` are null on the
   * passes that don't have them.
   */
  scenery: {
    hill: string;
    hillOpacity: number;
    structure: string;
    sun: { cx: number; cy: number; r: number; colors: readonly [string, string, string] } | null;
    stars: string | null;
    lampLight: string | null;
  };
  /** Whole-canvas post pass: a warm bloom (day) or an inset vignette (night). */
  atmosphere: { color: string; kind: 'bloom' | 'vignette'; cx: number; cy: number; r: number };
  /** Translucent-glass HUD chrome, retinted for contrast against this sky. */
  hud: {
    text: string;
    textDim: string;
    accent: string;
    buttonBg: string;
    buttonBorder: string;
    undoBg: string;
    undoBorder: string;
    undoText: string;
    panelBg: string;
    /**
     * Semantic stat colours for the HUD's numeric readouts. They exist per
     * pass (rather than being read straight from statusColors) because the
     * midday bar is LIGHT: the app-wide mint/amber are tuned for dark chrome
     * and wash out completely on it.
     */
    statSuccess: string;
    statWarning: string;
  };
}

const AMANECER_WAGONS: Record<IsoWagonKind, IsoWagonMaterial> = {
  cubierto: { hi: '#a8532f', lo: '#5a2414', cap: '#38160a', inset: 'rgba(0,0,0,0.10)' },
  gondola: { hi: '#4f7a82', lo: '#274045', cap: '#6fa0a8', inset: 'rgba(0,0,0,0.45)' },
  /**
   * Near-black tanker (user: "much darker, close to black, keeping the
   * shading nuances"). `lo` (sill/platform underframe) stays a shade above
   * `domeLo` so the structural underframe still separates from the tank's
   * own shadow instead of fusing into one black mass. `domeHi`/`domeLo` are
   * pulled WIDER apart in relative contrast than the old light-grey pair (was
   * ~2.4x luminance ratio, now ~4x) so the body gradient still reads as a
   * lit cylinder rather than flattening to a silhouette — the specular
   * `Oval` and the (now light, see wagonShell.tsx) band-seam lines carry the
   * rest of the "still a tank, not a blob" read.
   */
  cisterna: { hi: '#332e28', lo: '#1a1613', cap: '#241f1b', inset: 'rgba(0,0,0,0.35)', domeHi: '#332e28', domeLo: '#0d0b09' },
  /**
   * Grey cement hopper (redraw: user rejected the hourglass "martini glass"
   * silhouette and asked for a grey cement hopper — see IsoWagon.tsx's
   * `tolvaPath`). Deliberately warm/matte greige rather than `cisterna`'s
   * cool blue-grey + bright metallic dome sheen, so the two grey-family
   * kinds stay distinguishable by hue temperature and finish, not just
   * silhouette.
   */
  tolva: { hi: '#9c9186', lo: '#4d453b', cap: '#5f564a', inset: 'rgba(255,235,200,0.14)' },
  balasto: { hi: '#4a4d52', lo: '#1e2023', cap: '#6a6e74', inset: 'rgba(0,0,0,0.5)' },
};

/** Atardecer reuses the dawn bodies verbatim — see the design handoff's table. */
const ATARDECER_WAGONS = AMANECER_WAGONS;

const MEDIODIA_WAGONS: Record<IsoWagonKind, IsoWagonMaterial> = {
  cubierto: { hi: '#c2693f', lo: '#6c2c18', cap: '#42190c', inset: 'rgba(0,0,0,0.10)' },
  gondola: { hi: '#5f96a0', lo: '#335a62', cap: '#87c0c8', inset: 'rgba(0,0,0,0.45)' },
  /** Near-black tanker, midday pass: highlight lifted slightly (vs. dawn) to
   *  reflect the much brighter ambient light, but still a dark charcoal, not
   *  the old bright silver — see the amanecer entry's comment for the full
   *  rationale. */
  cisterna: { hi: '#3d3c39', lo: '#1c1b19', cap: '#282725', inset: 'rgba(0,0,0,0.3)', domeHi: '#3d3c39', domeLo: '#100f0e' },
  tolva: { hi: '#b0a99c', lo: '#5c5548', cap: '#8f8676', inset: 'rgba(255,255,255,0.22)' },
  balasto: { hi: '#66696e', lo: '#2c2e31', cap: '#8a8e94', inset: 'rgba(0,0,0,0.5)' },
};

const NOCHE_WAGONS: Record<IsoWagonKind, IsoWagonMaterial> = {
  cubierto: { hi: '#5c2a18', lo: '#28110a', cap: '#180a05', inset: 'rgba(0,0,0,0.15)' },
  gondola: { hi: '#2c454a', lo: '#101f22', cap: '#3d5f66', inset: 'rgba(0,0,0,0.55)' },
  /**
   * Near-black tanker, night pass — the one risk case: pure/very-near black
   * would melt into this pass's dark ballast (`track.ballast '#1d2735'`,
   * `ground` down to `#0e131e`). Deliberately LIFTED off pure black more
   * than the other three passes (`domeHi` avg luminance ~65 vs. the darkest
   * ballast tone's ~14) so the tank's lit two-thirds still pops against the
   * yard behind it; `domeLo` (the shadow side of the gradient) sits close to
   * ballast tone but is still identifiable by its cooler blue-grey hue vs.
   * the ballast's warmer near-black, plus the ink outline, specular gleam
   * and band-seam highlights (see wagonShell.tsx) that don't depend on fill
   * darkness at all.
   */
  cisterna: { hi: '#3c414a', lo: '#20242a', cap: '#2a2e34', inset: 'rgba(0,0,0,0.4)', domeHi: '#3c414a', domeLo: '#171a1f' },
  tolva: { hi: '#4a463e', lo: '#221f1a', cap: '#332f28', inset: 'rgba(0,0,0,0.3)' },
  balasto: { hi: '#26282b', lo: '#0e0f10', cap: '#3a3d41', inset: 'rgba(0,0,0,0.55)' },
};

export const timeOfDayPalettes: Record<TimeOfDay, TimeOfDayPalette> = {
  amanecer: {
    key: 'amanecer',
    label: 'Amanecer',
    sky: { colors: ['#3a3960', '#7a6a92', '#d69a86', '#f3c9a0'], positions: [0, 0.3, 0.58, 1] },
    ground: { colors: ['#8d7c72', '#675a4f', '#423a32'], positions: [0, 0.46, 1] },
    groundWashes: [],
    track: {
      ballast: '#4f4038',
      sleeper: 'rgba(0,0,0,0.26)',
      rail: '#e9d7c8',
      node: '#d9c4b2',
      ballastStoneHi: '#ab9880',
      ballastStoneLo: '#2e241c',
    },
    route: { glow: '#ffe6d0', dash: '#ffc9a0' },
    badge: { ok: '#d9c4b2', full: '#ff8a70' },
    marker: { edge: '#7ef0ae', fillHi: 'rgba(126,240,174,0.34)', fillLo: 'rgba(126,240,174,0.05)' },
    wagons: AMANECER_WAGONS,
    loco: {
      hi: '#ef6b56',
      lo: '#a32217',
      hoodHi: '#3a5f3e',
      hoodLo: '#1b3220',
      sill: '#e8ddc9',
      windowHi: '#bfe0ff',
      windowLo: '#0c1620',
      headlight: 'rgba(255,236,160,0.85)',
      beam: 'rgba(255,222,180,0.32)',
    },
    scenery: {
      hill: '#372f4a',
      hillOpacity: 0.72,
      structure: '#241f36',
      sun: { cx: 0.717, cy: 0.66, r: 0.3, colors: ['#ffe3c2', '#f3ad7e', 'rgba(240,150,120,0)'] },
      stars: null,
      lampLight: '#ffd9a6',
    },
    atmosphere: { color: 'rgba(240,170,130,0.20)', kind: 'bloom', cx: 0.66, cy: 0.16, r: 0.7 },
    hud: {
      text: '#fbeee6',
      textDim: '#e0b8a0',
      accent: '#c9a8ff',
      buttonBg: 'rgba(30,25,40,0.55)',
      buttonBorder: 'rgba(230,210,255,0.25)',
      undoBg: 'rgba(90,60,110,0.62)',
      undoBorder: 'rgba(230,210,255,0.35)',
      undoText: '#f2e6ff',
      panelBg: 'rgba(30,25,40,0.50)',
      statSuccess: statusColors.success,
      statWarning: statusColors.warning,
    },
  },

  mediodia: {
    key: 'mediodia',
    label: 'Mediodía',
    sky: { colors: ['#3f7fc4', '#7fb3e0', '#cfe4f0'], positions: [0, 0.42, 1] },
    ground: { colors: ['#b7ac96', '#948a76', '#6c6350'], positions: [0, 0.46, 1] },
    groundWashes: [],
    track: {
      ballast: '#645844',
      sleeper: 'rgba(0,0,0,0.22)',
      rail: '#fdfefe',
      node: '#efe9dc',
      ballastStoneHi: '#c9bb9c',
      ballastStoneLo: '#40382a',
    },
    route: { glow: '#1b2a22', dash: '#ffd94f' },
    badge: { ok: '#0e2436', full: '#a32217' },
    marker: { edge: '#17784a', fillHi: 'rgba(23,120,74,0.34)', fillLo: 'rgba(23,120,74,0.05)' },
    wagons: MEDIODIA_WAGONS,
    loco: {
      hi: '#f37760',
      lo: '#a32217',
      hoodHi: '#46704a',
      hoodLo: '#213c26',
      sill: '#f2f0e6',
      windowHi: '#eaf6ff',
      windowLo: '#0e1a26',
      headlight: 'rgba(255,246,200,0.45)',
      beam: 'rgba(255,244,200,0.14)',
    },
    scenery: {
      hill: '#5f89a8',
      hillOpacity: 0.5,
      structure: '#3f5f74',
      sun: { cx: 0.731, cy: 0.26, r: 0.15, colors: ['#fffdf0', '#fff1b0', 'rgba(255,241,176,0)'] },
      stars: null,
      lampLight: '#d6ecfa',
    },
    atmosphere: { color: 'rgba(255,255,255,0.0)', kind: 'bloom', cx: 0.7, cy: 0.1, r: 0.6 },
    // The reference's midday chrome is dark ink on dark glass, which works in
    // a mock floating over a bright sky but not in the app, where the same
    // glass sits on an opaque bar (≈1.9:1 on the icon buttons). The design
    // decision it encodes — dark ink, because midday is the one pass with a
    // LIGHT background — is kept; the glass is inverted to light so the ink
    // actually has something to be dark against.
    hud: {
      text: '#173049',
      textDim: '#3d6180',
      accent: '#0e2436',
      buttonBg: 'rgba(236,246,253,0.80)',
      buttonBorder: 'rgba(23,48,73,0.22)',
      undoBg: 'rgba(240,201,60,0.92)',
      undoBorder: 'rgba(23,48,73,0.28)',
      undoText: '#3a2c04',
      panelBg: 'rgba(236,246,253,0.74)',
      statSuccess: '#0f7a4a',
      statWarning: '#8a5200',
    },
  },

  atardecer: {
    key: 'atardecer',
    label: 'Atardecer',
    sky: { colors: ['#2a1630', '#5b2f3c', '#b8603a', '#f0a95c'], positions: [0, 0.34, 0.62, 1] },
    ground: { colors: ['#7a6450', '#5a4839', '#3b2f26'], positions: [0, 0.46, 1] },
    groundWashes: [],
    track: {
      ballast: '#4a3b2e',
      sleeper: 'rgba(0,0,0,0.28)',
      rail: '#ffd9a0',
      node: '#e8c9a0',
      ballastStoneHi: '#a4886a',
      ballastStoneLo: '#2c221a',
    },
    route: { glow: '#ffe6a6', dash: '#ffcf6b' },
    badge: { ok: '#e8c9a0', full: '#ff7a5c' },
    marker: { edge: '#7ef0ae', fillHi: 'rgba(126,240,174,0.34)', fillLo: 'rgba(126,240,174,0.05)' },
    wagons: ATARDECER_WAGONS,
    loco: {
      hi: '#ef6b56',
      lo: '#a32217',
      hoodHi: '#3a5f3e',
      hoodLo: '#1b3220',
      sill: '#e8ddc9',
      windowHi: '#ffe9c2',
      windowLo: '#12141f',
      headlight: 'rgba(255,244,196,0.95)',
      beam: 'rgba(255,232,170,0.40)',
    },
    scenery: {
      hill: '#2b1a2c',
      hillOpacity: 0.8,
      structure: '#20131f',
      sun: { cx: 0.692, cy: 0.48, r: 0.25, colors: ['#ffe9a8', '#ffb95e', 'rgba(255,150,70,0)'] },
      stars: null,
      lampLight: '#ffcf87',
    },
    atmosphere: { color: 'rgba(255,196,120,0.22)', kind: 'bloom', cx: 0.62, cy: 0.15, r: 0.7 },
    hud: {
      text: '#fff2dc',
      textDim: '#ffcf8d',
      accent: '#ffcf6b',
      buttonBg: 'rgba(22,12,16,0.55)',
      buttonBorder: 'rgba(255,214,150,0.28)',
      undoBg: 'rgba(120,52,24,0.62)',
      undoBorder: 'rgba(255,214,150,0.40)',
      undoText: '#ffeccb',
      panelBg: 'rgba(22,12,16,0.50)',
      statSuccess: statusColors.success,
      statWarning: statusColors.warning,
    },
  },

  noche: {
    key: 'noche',
    label: 'Noche',
    sky: { colors: ['#050810', '#0c1526', '#16223a'], positions: [0, 0.45, 1] },
    ground: { colors: ['#2b3648', '#1a2233', '#0e131e'], positions: [0, 0.46, 1] },
    groundWashes: [
      { cx: 0.05, cy: 0, r: 0.62, color: 'rgba(255,196,120,0.16)' },
      { cx: 0.95, cy: 0, r: 0.62, color: 'rgba(255,196,120,0.16)' },
    ],
    track: {
      ballast: '#1d2735',
      sleeper: 'rgba(0,0,0,0.35)',
      rail: '#9fc3ea',
      node: '#cfe2f6',
      ballastStoneHi: '#6b7f9a',
      ballastStoneLo: '#10161f',
    },
    route: { glow: '#8ef7ff', dash: '#8ef7ff' },
    badge: { ok: '#7fa8d6', full: '#ff6b6b' },
    marker: { edge: '#7ef0ae', fillHi: 'rgba(126,240,174,0.40)', fillLo: 'rgba(126,240,174,0.06)' },
    wagons: NOCHE_WAGONS,
    loco: {
      hi: '#c85040',
      lo: '#6e150e',
      hoodHi: '#25392a',
      hoodLo: '#101c13',
      sill: '#aab4bd',
      windowHi: '#9fd0ff',
      windowLo: '#050a10',
      headlight: 'rgba(255,248,210,1)',
      beam: 'rgba(255,244,200,0.50)',
    },
    scenery: {
      hill: '#050a12',
      hillOpacity: 0.9,
      structure: '#040810',
      sun: null,
      stars: '#cfe0ff',
      lampLight: '#ffd79a',
    },
    atmosphere: { color: 'rgba(0,2,6,0.75)', kind: 'vignette', cx: 0.5, cy: 0.5, r: 0.78 },
    hud: {
      text: '#eaf3ff',
      textDim: '#7fa8d6',
      accent: '#8ef7ff',
      buttonBg: 'rgba(8,16,28,0.65)',
      buttonBorder: 'rgba(127,200,255,0.25)',
      undoBg: 'rgba(60,32,90,0.70)',
      undoBorder: 'rgba(200,170,255,0.40)',
      undoText: '#e6d6ff',
      panelBg: 'rgba(8,16,28,0.60)',
      statSuccess: statusColors.success,
      statWarning: statusColors.warning,
    },
  },
};

export function getTimeOfDayPalette(key: TimeOfDay | null | undefined): TimeOfDayPalette {
  return timeOfDayPalettes[key ?? defaultTimeOfDay] ?? timeOfDayPalettes[defaultTimeOfDay];
}

/**
 * Shared, pass-independent rolling-stock hardware. Wheel bogies are the same
 * greasy near-black on every car in every light — they read as shadow, not
 * as painted livery, which is what keeps the cars sitting ON the rail instead
 * of floating above it.
 */
export const isoHardware = {
  bogieBar: '#141414',
  wheel: '#2a2a2a',
  wheelEdge: '#000000',
  bodyEdge: 'rgba(0,0,0,0.55)',
  bodyEdgeNight: 'rgba(0,0,0,0.65)',
  rimLight: 'rgba(255,255,255,0.22)',
  labelBadgeBg: 'rgba(0,0,0,0.60)',
  labelBadgeText: '#ffffff',
  /** Selection treatment — the one car-level state that survives the reskin. */
  selectEdge: carGlowColor,
  /**
   * Alpha bumped 0.22 → 0.32 (design/wagon-art-spec.md §4): the halo now
   * hugs each shell's own silhouette instead of its full bounding box, which
   * covers less on-screen area, so it needs more opacity to stay as visible
   * from a glance.
   */
  selectHalo: 'rgba(127,231,255,0.32)',
} as const;

// ─────────────────────────────────────────────────────────────────────────
// AGGREGATE EXPORT
// ─────────────────────────────────────────────────────────────────────────

export const tokens = {
  colors,
  spacing,
  radii,
  typography,
  shadows,
  motion,
  haptics,
  layout,
  isoCamera: isoCameraTokens,
  timeOfDay: timeOfDayPalettes,
  isoHardware,
} as const;

export default tokens;
