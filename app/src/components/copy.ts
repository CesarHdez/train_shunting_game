/**
 * Small bits of Spanish copy / lookup tables that aren't game rules (so they
 * don't belong in src/engine) but are shared by more than one screen.
 * Ported from ref/js/classification/state.js `TIPOS`.
 */
import type { CarType } from '../data/levelTypes';
import { isoWagonOrder, withAlpha, type IsoWagonKind, type IsoWagonMaterial, type TimeOfDayPalette } from '../../design/tokens';

/**
 * Cosmetic body-shell material for a shunting car label — index mapping
 * ported from ref CAR_TYPES: `label.charCodeAt(0) % wagonMaterials.length`,
 * unchanged, so a label keeps the body it has always had. Takes the active
 * time-of-day palette so an objective chip is painted in the exact livery
 * that car is wearing on the board right now.
 */
export function wagonMaterialForLabel(label: string, palette: TimeOfDayPalette): IsoWagonMaterial {
  const kind = isoWagonOrder[label.charCodeAt(0) % isoWagonOrder.length];
  return palette.wagons[kind];
}

/**
 * Readable ink for a swatch painted in an arbitrary livery. The objective
 * chips take the exact body colour of the car they stand for, and those span
 * everything from near-black balasto to midday's pale silver cisterna — a
 * fixed white label is illegible on the light end. Relative luminance per
 * WCAG; the 0.55 threshold is where white and near-black ink cross over.
 */
export function inkOn(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  if (hex.length < 6) return '#ffffff';
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const r = channel(parseInt(hex.slice(0, 2), 16));
  const g = channel(parseInt(hex.slice(2, 4), 16));
  const b = channel(parseInt(hex.slice(4, 6), 16));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.3 ? '#101418' : '#ffffff';
}

export const CAR_TYPE_NAMES: Record<CarType, string> = {
  F: 'Furgón',
  T: 'Tanque',
  V: 'Tolva',
  J: 'Jaula',
  C: 'Contenedor',
};

/**
 * Player-facing Spanish name for each shunting body shell (IsoWagonKind —
 * see wagonKindFor in render/primitives/IsoWagon.tsx). Used by the objective
 * bar's accessibility label so a screen-reader user gets "which kind of car"
 * the same way a sighted player now reads it off the chip's drawing.
 */
export const WAGON_KIND_NAMES: Record<IsoWagonKind, string> = {
  cubierto: 'furgón cubierto',
  gondola: 'góndola',
  cisterna: 'cisterna',
  tolva: 'tolva',
  balasto: 'vagón de balasto',
};

/**
 * Blends a hex colour toward white by `amount` (0..1). Used to derive an
 * objective chip's card background from a wagon's true livery colour: some
 * materials (night's near-black balasto/cisterna) are too dark to read
 * against the HUD's own dark panel, so the chip card is always lightened
 * enough to stay a visible "matte" behind the wagon drawing while still
 * carrying that wagon's hue as a colour cue.
 */
export function lightenTint(hexColor: string, amount: number): string {
  const hex = hexColor.replace('#', '');
  if (hex.length < 6) return hexColor;
  const mix = (v: number) => Math.round(v + (255 - v) * amount);
  const toHex = (v: number) => v.toString(16).padStart(2, '0');
  const r = mix(parseInt(hex.slice(0, 2), 16));
  const g = mix(parseInt(hex.slice(2, 4), 16));
  const b = mix(parseInt(hex.slice(4, 6), 16));
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Picks readable ink for text/icons stamped on a `hud.accent`-filled
 * surface — accent hue swings from pale cyan (noche) to dark navy
 * (mediodia) across time-of-day passes, so a fixed white/black label isn't
 * always legible. Relative-luminance threshold, same shape as `inkOn`
 * above but tuned for accent fills specifically (mirrors the private copy
 * each of the 5 menu screens carries — LoginScreen.tsx/SettingsScreen.tsx —
 * kept here too so in-game components share one implementation instead of
 * a fourth/fifth copy).
 */
export function textOnAccent(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length < 6) return '#ffffff';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#241505' : '#ffffff';
}

/**
 * WCAG relative luminance (0..1) of a `#rrggbb` colour — the shared core
 * math behind `inkOn`/`textOnAccent` above, factored out so the two new
 * helpers below can do real contrast-ratio arithmetic instead of a second
 * hand-picked threshold.
 */
function relativeLuminance(hexColor: string): number {
  const hex = hexColor.replace('#', '');
  if (hex.length < 6) return 1;
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const r = channel(parseInt(hex.slice(0, 2), 16));
  const g = channel(parseInt(hex.slice(2, 4), 16));
  const b = channel(parseInt(hex.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two relative luminances (1..21). */
function contrastRatio(l1: number, l2: number): number {
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Darkens `hex` toward black in small steps until it clears `minRatio`
 * (WCAG AA body-text default: 4.5:1) against a surface of luminance
 * `bgLuminance` — used by `readableIdentityColor` below to keep a FIXED
 * identity colour (medal gold/silver/bronze) legible on a light surface
 * without picking a different hue or an eyeballed mix percentage: the loop
 * stops as soon as the real contrast math says it's readable, so gold stays
 * exactly as bright as it can be while still passing.
 */
function darkenForContrast(hex: string, bgLuminance: number, minRatio = 4.5): string {
  const clean = hex.replace('#', '');
  let r = parseInt(clean.slice(0, 2), 16);
  let g = parseInt(clean.slice(2, 4), 16);
  let b = parseInt(clean.slice(4, 6), 16);
  const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  for (let i = 0; i < 24; i++) {
    const hexNow = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    if (contrastRatio(bgLuminance, relativeLuminance(hexNow)) >= minRatio) return hexNow;
    r *= 0.85;
    g *= 0.85;
    b *= 0.85;
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Reference luminance for this app's one confirmed LIGHT surface (the
 * mediodia HUD glass — see `TimeOfDayPalette.hud`'s own doc comment in
 * tokens.ts: "the midday bar is LIGHT"). Used as the contrast denominator
 * below; a fixed reference is appropriate because the branch that reads it
 * only ever fires for that one pass, not a general "guess the background"
 * heuristic.
 */
const LIGHT_SURFACE_LUMINANCE = 0.82;

/**
 * Keeps a FIXED identity colour (medal gold/silver/bronze, the win card's
 * "new record" gold) legible across every time-of-day pass. These colours
 * are deliberately NOT re-themed per pass (they mean "1st place"/"personal
 * best" regardless of the hour) — but they were tuned against the app's old
 * permanently-dark chrome, and read as pale-on-pale on mediodia's light HUD
 * glass. On every pass but mediodia (confirmed light via `hudTextHex`'s own
 * luminance — reusing the same signal the palette already uses to flip its
 * ink dark there, rather than re-deriving a second "is this light" check)
 * the colour is returned completely unchanged; only on the light pass does
 * it get programmatically darkened (via `darkenForContrast`) until it
 * clears WCAG AA, so the medal/record identity survives everywhere without
 * losing its hue on the three passes where it already worked.
 */
export function readableIdentityColor(hex: string, hudTextHex: string): string {
  const surfaceIsLight = relativeLuminance(hudTextHex) < 0.5;
  return surfaceIsLight ? darkenForContrast(hex, LIGHT_SURFACE_LUMINANCE) : hex;
}

/**
 * Full-screen modal dimmer for the win/summary card and the tutorial/hint
 * blocking overlays. Previously a single fixed `rgba(0,0,0,0.7–0.93)` on all
 * four passes — which read as an appropriately dark dimmer on the three
 * dark passes but as a jarring near-opaque black slab over mediodia's bright
 * board. Tinted from the active pass's own sky-top colour (the same value
 * GameScreen already uses for its own background) instead of a flat black,
 * so the scrim itself follows the palette like every other surface in this
 * sweep; opacity drops on the one confirmed-light pass (see
 * `readableIdentityColor`'s doc comment for why `hud.text`'s luminance is
 * the reliable "is this pass light" signal) so the board stays visibly
 * bright behind the card instead of getting flattened.
 */
export function scrimColorFor(palette: TimeOfDayPalette): string {
  const isLightPass = relativeLuminance(palette.hud.text) < 0.5;
  return withAlpha(palette.sky.colors[0], isLightPass ? 0.45 : 0.88);
}

export function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Filled/empty star glyphs for share text (plain-text context — StarRow is
 *  the RN-rendered equivalent for on-screen use). e.g. starsGlyph(2) === '★★☆'. */
export function starsGlyph(stars: 1 | 2 | 3): string {
  return '★'.repeat(stars) + '☆'.repeat(3 - stars);
}
