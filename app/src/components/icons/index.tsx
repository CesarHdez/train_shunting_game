/**
 * Icon set for Login / ModeSelect / LevelSelect / Settings / Leaderboard —
 * replaces the previous ported-handoff + hand-drawn mix with Google
 * **Material Symbols** (Outlined, 24dp, default weight/grade/fill), which is
 * Apache License 2.0 — freely embeddable, no attribution required. Source
 * repo for every glyph below: https://github.com/google/material-design-icons
 * (raw path data fetched from
 * `symbols/web/<name>/materialsymbolsoutlined/<name>_24px.svg` on that repo,
 * except `StarIcon`/`STAR_POLYGON_PATH`, sourced from the classic Material
 * Icons "star" glyph — see that export's own doc comment for why).
 *
 * Fill/stroke convention: Material Symbols ship as a single filled `<Path>`
 * per glyph (holes, e.g. the gear's center or the lock's body cutout, are
 * cut with a second sub-path in the same `d` and closed via
 * `fillRule="evenodd"`) — there is no stroke to speak of. That's a deliberate
 * departure from the previous stroke-based set: filled glyphs hold their
 * shape and stay legible from the smallest use here (12dp clock badge,
 * ~11dp level-card star/check) up to the largest (~28–34dp mode-card icons),
 * whereas thin strokes thin out and disappear at 12dp. Every icon in this
 * file therefore renders one `<Path fill={color} fillRule="evenodd" />` (or,
 * for `StarIcon`, plain `fill` — its glyph has no holes) and ignores
 * `strokeWidth`: it stays in `IconProps` purely so no call site needs to
 * change, but it is a documented no-op for every glyph here. `color` still
 * tints the glyph (via `fill`), which is what the per-time-of-day palette
 * actually relies on.
 *
 * Each glyph keeps Material Symbols' own 960-unit design grid
 * (`viewBox="0 -960 960 960"`) rather than being renormalized to `0 0 24 24`
 * — `width`/`height` are still set to `size`×`size` so it occupies the same
 * square footprint as before, and every glyph in the family shares that
 * grid so optical weight matches glyph-to-glyph (a 24dp gear and a 24dp
 * trophy read as the same "size" of ink). The one exception is `StarIcon` /
 * `STAR_POLYGON_PATH`, pinned to `0 0 24 24` because `StarRow.tsx` (not
 * owned by this file) hardcodes that viewBox around the exported path
 * string.
 */
import React from 'react';
import Svg, { Path } from 'react-native-svg';

export interface IconProps {
  /** Renders at size×size. */
  size?: number;
  /** Tints the glyph's fill. */
  color?: string;
  /**
   * No-op for every icon in this file: Material Symbols are filled shapes,
   * not strokes, so there is no stroke to widen. Kept only so existing call
   * sites that pass it don't need to change.
   */
  strokeWidth?: number;
}

const DEFAULT_SIZE = 24;
const DEFAULT_COLOR = '#ffffff';
/** Material Symbols' own design grid — see file-level doc comment. */
const MSYM_VIEWBOX = '0 -960 960 960';

/**
 * Classic Material Icons "star" (filled), NOT Material Symbols — kept on the
 * older `0 0 24 24` grid on purpose because `StarRow.tsx` (owned by another
 * agent, not editable here) renders this exact string via its own
 * `<Svg viewBox="0 0 24 24"><Path d={STAR_POLYGON_PATH} .../></Svg>` and
 * varies only `fillOpacity` between a lit/unlit star — so the path has to be
 * a single filled (non-hollow) polygon in that coordinate space for both
 * that file and `StarIcon` below to agree.
 * Verified byte-identical from two Google-hosted sources: the Google Fonts
 * static asset https://fonts.gstatic.com/s/i/materialicons/star/v12/24px.svg
 * and https://raw.githubusercontent.com/google/material-design-icons/master/src/toggle/star/materialicons/24px.svg
 * (Apache 2.0).
 */
export const STAR_POLYGON_PATH =
  'M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z';

/**
 * Material Symbols "settings" (the 8-tooth cog), used for the Ajustes
 * button. Source:
 * https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/settings/materialsymbolsoutlined/settings_24px.svg
 */
export const GearIcon: React.FC<IconProps> = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }) => (
  <Svg width={size} height={size} viewBox={MSYM_VIEWBOX}>
    <Path
      fill={color}
      fillRule="evenodd"
      d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z"
    />
  </Svg>
);

/**
 * Material Symbols "volume_up" (speaker + two sound-wave arcs). Used for the
 * un-muted state of the sound toggle (ModeSelect, game HUD, Settings
 * SONIDO row). Source:
 * https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/volume_up/materialsymbolsoutlined/volume_up_24px.svg
 */
export const SoundIcon: React.FC<IconProps> = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }) => (
  <Svg width={size} height={size} viewBox={MSYM_VIEWBOX}>
    <Path
      fill={color}
      fillRule="evenodd"
      d="M560-131v-82q90-26 145-100t55-168q0-94-55-168T560-749v-82q124 28 202 125.5T840-481q0 127-78 224.5T560-131ZM120-360v-240h160l200-200v640L280-360H120Zm440 40v-322q47 22 73.5 66t26.5 96q0 51-26.5 94.5T560-320ZM400-606l-86 86H200v80h114l86 86v-252ZM300-480Z"
    />
  </Svg>
);

/**
 * Material Symbols "volume_off" (speaker + diagonal slash, no sound-wave
 * arcs) — a genuinely distinct silhouette from `SoundIcon` above, not just a
 * recolor, so the muted state reads at a glance. Used for the muted state of
 * the same toggle. Source:
 * https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/volume_off/materialsymbolsoutlined/volume_off_24px.svg
 */
export const SoundOffIcon: React.FC<IconProps> = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }) => (
  <Svg width={size} height={size} viewBox={MSYM_VIEWBOX}>
    <Path
      fill={color}
      fillRule="evenodd"
      d="M792-56 671-177q-25 16-53 27.5T560-131v-82q14-5 27.5-10t25.5-12L480-368v208L280-360H120v-240h128L56-792l56-56 736 736-56 56Zm-8-232-58-58q17-31 25.5-65t8.5-70q0-94-55-168T560-749v-82q124 28 202 125.5T840-481q0 53-14.5 102T784-288ZM650-422l-90-90v-130q47 22 73.5 66t26.5 96q0 15-2.5 29.5T650-422ZM480-592 376-696l104-104v208Zm-80 238v-94l-72-72H200v80h114l86 86Zm-36-130Z"
    />
  </Svg>
);

/**
 * Material Symbols "trophy" — used for the Puntajes button and the
 * Leaderboard header. This replaces a hand-authored placeholder that stood
 * in for a real trophy icon (the original handoff's `trophy.svg` was
 * actually a duplicate of the star outline). Source:
 * https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/trophy/materialsymbolsoutlined/trophy_24px.svg
 */
export const TrophyIcon: React.FC<IconProps> = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }) => (
  <Svg width={size} height={size} viewBox={MSYM_VIEWBOX}>
    <Path
      fill={color}
      fillRule="evenodd"
      d="M280-120v-80h160v-124q-49-11-87.5-41.5T296-442q-75-9-125.5-65.5T120-640v-40q0-33 23.5-56.5T200-760h80v-80h400v80h80q33 0 56.5 23.5T840-680v40q0 76-50.5 132.5T664-442q-18 46-56.5 76.5T520-324v124h160v80H280Z"
    />
  </Svg>
);

/**
 * Material Symbols "lock" — used for locked level cards and locked
 * sections. Source:
 * https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/lock/materialsymbolsoutlined/lock_24px.svg
 */
export const LockIcon: React.FC<IconProps> = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }) => (
  <Svg width={size} height={size} viewBox={MSYM_VIEWBOX}>
    <Path
      fill={color}
      fillRule="evenodd"
      d="M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm0-80h480v-400H240v400Zm240-120q33 0 56.5-23.5T560-360q0-33-23.5-56.5T480-440q-33 0-56.5 23.5T400-360q0 33 23.5 56.5T480-280ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80Z"
    />
  </Svg>
);

/**
 * Material Symbols "arrow_back" — replaces the "←" glyph on the
 * "MODOS"/"VOLVER" chips. Source:
 * https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/arrow_back/materialsymbolsoutlined/arrow_back_24px.svg
 */
export const BackIcon: React.FC<IconProps> = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }) => (
  <Svg width={size} height={size} viewBox={MSYM_VIEWBOX}>
    <Path fill={color} d="m313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z" />
  </Svg>
);

/**
 * Material Symbols "schedule" (clock face + hands) — used for the
 * "AUTOMÁTICO · {franja}" badge on Login and the HORA DEL PATIO row in
 * Settings. Source:
 * https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/schedule/materialsymbolsoutlined/schedule_24px.svg
 */
export const ClockIcon: React.FC<IconProps> = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }) => (
  <Svg width={size} height={size} viewBox={MSYM_VIEWBOX}>
    <Path
      fill={color}
      fillRule="evenodd"
      d="m612-292 56-56-148-148v-184h-80v216l172 172ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q133 0 226.5-93.5T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160Z"
    />
  </Svg>
);

/**
 * Material Symbols "check" — replaces the "✓" glyph on the completed-levels
 * counter. Source (re-fetched clean of any whitespace artifacts):
 * https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/check/materialsymbolsoutlined/check_24px.svg
 */
export const CheckIcon: React.FC<IconProps> = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }) => (
  <Svg width={size} height={size} viewBox={MSYM_VIEWBOX}>
    <Path fill={color} d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z" />
  </Svg>
);

/**
 * Material Symbols "vibration" — used for the VIBRACIÓN row in Settings.
 * Source:
 * https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/vibration/materialsymbolsoutlined/vibration_24px.svg
 */
export const VibrationIcon: React.FC<IconProps> = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }) => (
  <Svg width={size} height={size} viewBox={MSYM_VIEWBOX}>
    <Path
      fill={color}
      fillRule="evenodd"
      d="M0-360v-240h80v240H0Zm120 80v-400h80v400h-80Zm760-80v-240h80v240h-80Zm-120 80v-400h80v400h-80ZM320-120q-33 0-56.5-23.5T240-200v-560q0-33 23.5-56.5T320-840h320q33 0 56.5 23.5T720-760v560q0 33-23.5 56.5T640-120H320Zm0-80h320v-560H320v560Z"
    />
  </Svg>
);

/**
 * Material Symbols "train" (a locomotive/subway-car front — twin windows,
 * twin wheels, angled coupling skirt) — used for the Maniobras mode card and
 * "Acerca de" in Settings. This is a square glyph on Material Symbols' own
 * 960-unit grid, unlike the previous hand-drawn 52×34 asset it replaces:
 * `size` is simply the side of the square now, no derived aspect ratio.
 * Source:
 * https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/train/materialsymbolsoutlined/train_24px.svg
 */
export const TrainIcon: React.FC<IconProps> = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }) => (
  <Svg width={size} height={size} viewBox={MSYM_VIEWBOX}>
    <Path
      fill={color}
      fillRule="evenodd"
      d="M160-340v-380q0-53 27.5-84.5t72.5-48q45-16.5 102.5-22T480-880q66 0 124.5 5.5t102 22q43.5 16.5 68.5 48t25 84.5v380q0 59-40.5 99.5T660-200l60 60v20h-80l-80-80H400l-80 80h-80v-20l60-60q-59 0-99.5-40.5T160-340Zm320-460q-106 0-155 12.5T258-760h448q-15-17-64.5-28.5T480-800ZM240-560h200v-120H240v120Zm420 80H240h480-60Zm-140-80h200v-120H520v120ZM340-320q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17Zm280 0q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17Zm-320 40h360q26 0 43-17t17-43v-140H240v140q0 26 17 43t43 17Zm180-480h226-448 222Z"
    />
  </Svg>
);

/**
 * Material Symbols "close" (the ✕ glyph) — replaces the "✕" text character
 * used to close the win/summary card. Source:
 * https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/close/materialsymbolsoutlined/close_24px.svg
 */
export const CloseIcon: React.FC<IconProps> = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }) => (
  <Svg width={size} height={size} viewBox={MSYM_VIEWBOX}>
    <Path fill={color} d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
  </Svg>
);

/**
 * Material Symbols "restart_alt" (a broken circle with an arrowhead in the
 * gap) — used for "reiniciar nivel" in the game top bar, replacing the "↺"
 * text character. Picked over `refresh` (a full ~300° circular sweep,
 * conventionally "reload data") because `restart_alt` is the glyph Material
 * Symbols itself designates for "start over" actions like replaying a level,
 * and its two-arc-plus-gap silhouette stays clearly distinct from
 * `UndoIcon`'s single hooked arrow at a glance — important since both sit
 * side by side in the same top bar. Source:
 * https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/restart_alt/materialsymbolsoutlined/restart_alt_24px.svg
 */
export const RestartIcon: React.FC<IconProps> = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }) => (
  <Svg width={size} height={size} viewBox={MSYM_VIEWBOX}>
    <Path
      fill={color}
      fillRule="evenodd"
      d="M440-122q-121-15-200.5-105.5T160-440q0-66 26-126.5T260-672l57 57q-38 34-57.5 79T240-440q0 88 56 155.5T440-202v80Zm80 0v-80q87-16 143.5-83T720-440q0-100-70-170t-170-70h-3l44 44-56 56-140-140 140-140 56 56-44 44h3q134 0 227 93t93 227q0 121-79.5 211.5T520-122Z"
    />
  </Svg>
);

/**
 * Material Symbols "undo" (a single hooked arrow) — replaces the "↩" text
 * character used for "deshacer maniobra" in both the top bar and the bottom
 * bar. Source:
 * https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/undo/materialsymbolsoutlined/undo_24px.svg
 */
export const UndoIcon: React.FC<IconProps> = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }) => (
  <Svg width={size} height={size} viewBox={MSYM_VIEWBOX}>
    <Path
      fill={color}
      d="M280-200v-80h284q63 0 109.5-40T720-420q0-60-46.5-100T564-560H312l104 104-56 56-200-200 200-200 56 56-104 104h252q97 0 166.5 63T800-420q0 94-69.5 157T564-200H280Z"
    />
  </Svg>
);

/**
 * Material Symbols "menu" (three stacked bars) — replaces the "≡" text
 * character used for "MENÚ" on the win card. Source:
 * https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/menu/materialsymbolsoutlined/menu_24px.svg
 */
export const MenuIcon: React.FC<IconProps> = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }) => (
  <Svg width={size} height={size} viewBox={MSYM_VIEWBOX}>
    <Path fill={color} d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z" />
  </Svg>
);

/**
 * Material Symbols "arrow_forward" — the mirror of the already-shipped
 * `BackIcon` (`arrow_back`), sharing the same stroke weight and arrowhead
 * geometry by construction (same family, same grid). Replaces the "→" text
 * character on "SIGUIENTE →" (win card, tutorial) and "¡A JUGAR! →"
 * (tutorial). Source:
 * https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/arrow_forward/materialsymbolsoutlined/arrow_forward_24px.svg
 */
export const ForwardIcon: React.FC<IconProps> = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }) => (
  <Svg width={size} height={size} viewBox={MSYM_VIEWBOX}>
    <Path fill={color} d="M647-440H160v-80h487L423-744l57-56 320 320-320 320-57-56 224-224Z" />
  </Svg>
);

/**
 * Material Symbols "share" (three connected nodes) — replaces the "↗" text
 * character on "COMPARTIR", which the user specifically flagged as not
 * reading as "share". This three-node graph is the glyph most mobile users
 * already associate with a native share sheet, unlike a bare up-right arrow
 * (which reads as "open externally" or "navigate"). Source:
 * https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/share/materialsymbolsoutlined/share_24px.svg
 */
export const ShareIcon: React.FC<IconProps> = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }) => (
  <Svg width={size} height={size} viewBox={MSYM_VIEWBOX}>
    <Path
      fill={color}
      fillRule="evenodd"
      d="M720-80q-50 0-85-35t-35-85q0-7 1-14.5t3-13.5L322-392q-17 15-38 23.5t-44 8.5q-50 0-85-35t-35-85q0-50 35-85t85-35q23 0 44 8.5t38 23.5l282-164q-2-6-3-13.5t-1-14.5q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35q-23 0-44-8.5T638-672L356-508q2 6 3 13.5t1 14.5q0 7-1 14.5t-3 13.5l282 164q17-15 38-23.5t44-8.5q50 0 85 35t35 85q0 50-35 85t-85 35Zm0-640q17 0 28.5-11.5T760-760q0-17-11.5-28.5T720-800q-17 0-28.5 11.5T680-760q0 17 11.5 28.5T720-720ZM240-440q17 0 28.5-11.5T280-480q0-17-11.5-28.5T240-520q-17 0-28.5 11.5T200-480q0 17 11.5 28.5T240-440Zm480 280q17 0 28.5-11.5T760-200q0-17-11.5-28.5T720-240q-17 0-28.5 11.5T680-200q0 17 11.5 28.5T720-160Zm0-600ZM240-480Zm480 280Z"
    />
  </Svg>
);

/**
 * Material Symbols "play_arrow" (a solid triangle) — for primary "COMENZAR"/
 * "JUGAR"-style CTAs, if the consuming components want a play glyph instead
 * of (or alongside) `ForwardIcon`. Source:
 * https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/play_arrow/materialsymbolsoutlined/play_arrow_24px.svg
 */
export const PlayIcon: React.FC<IconProps> = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }) => (
  <Svg width={size} height={size} viewBox={MSYM_VIEWBOX}>
    <Path fill={color} fillRule="evenodd" d="M320-200v-560l440 280-440 280Zm80-280Zm0 134 210-134-210-134v268Z" />
  </Svg>
);

/**
 * Material Symbols "info" (an "i" in a circle) — used for the "Acerca de"
 * row in Settings. Source:
 * https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/info/materialsymbolsoutlined/info_24px.svg
 */
export const InfoIcon: React.FC<IconProps> = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }) => (
  <Svg width={size} height={size} viewBox={MSYM_VIEWBOX}>
    <Path
      fill={color}
      fillRule="evenodd"
      d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"
    />
  </Svg>
);

/**
 * Material Symbols "delete" (a trash can) — used for "REINICIAR PROGRESO" in
 * Settings, a destructive, irreversible action (erases all saved progress).
 * Chosen over reusing `RestartIcon` (`restart_alt`): that glyph is already
 * spoken for by "reiniciar nivel" (a low-stakes, reversible, single-level
 * action), and reusing it here would make a single-level replay and a
 * full-save wipe look like the same severity of action. `delete`'s trash-can
 * silhouette is the mobile-convention glyph for a permanent, destructive
 * action and reads unambiguously more severe than `restart_alt`. Source:
 * https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/delete/materialsymbolsoutlined/delete_24px.svg
 */
export const DeleteIcon: React.FC<IconProps> = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }) => (
  <Svg width={size} height={size} viewBox={MSYM_VIEWBOX}>
    <Path
      fill={color}
      fillRule="evenodd"
      d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"
    />
  </Svg>
);

export interface StarIconProps extends IconProps {
  /** true = solid fill (earned); false = same shape at low opacity (not earned). Default true. */
  filled?: boolean;
}

/**
 * Star ratings on level cards and the win card. Shares `STAR_POLYGON_PATH`
 * with `StarRow.tsx` (see that constant's own doc comment) — `filled` picks
 * between a solid glyph (earned) and the same polygon at 20% opacity (not
 * earned), so a lit and unlit star are the same shape at different
 * intensities rather than two different treatments.
 */
export const StarIcon: React.FC<StarIconProps> = ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, filled = true }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d={STAR_POLYGON_PATH} fill={color} fillOpacity={filled ? 1 : 0.2} />
  </Svg>
);
