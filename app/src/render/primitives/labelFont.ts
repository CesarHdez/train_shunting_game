/**
 * Skia text needs an explicit SkFont (see design/design-system.md §7 "Fonts
 * in Skia"). `matchFont`/`Skia.FontMgr.System()` rely on the platform's
 * system font manager, which is NOT implemented on React Native Web
 * (`JsiSkFontMgr.matchFamilyStyle` throws "Not implemented on React Native
 * Web") — a Skia component throwing during render takes down the whole
 * `<Canvas>` subtree, so the entire yard disappears.
 *
 * Instead we load a real bundled Rajdhani .ttf via `useFont`, which is
 * backed by `Skia.Typeface.MakeFreeTypeFaceFromData` under the hood and
 * works identically on web AND native. `useFont` returns `null` until the
 * font has finished loading (and forever if it failed), so every caller
 * MUST guard against a null font instead of assuming it's ready.
 */

import { useFont } from '@shopify/react-native-skia';
import { Rajdhani_600SemiBold, Rajdhani_700Bold } from '@expo-google-fonts/rajdhani';

import type { SkFont } from '@shopify/react-native-skia';

const FONT_MODULES = {
  '600': Rajdhani_600SemiBold,
  '700': Rajdhani_700Bold,
} as const;

export function useCarLabelFont(size: number, weight: '600' | '700' = '700'): SkFont | null {
  return useFont(FONT_MODULES[weight], size);
}
