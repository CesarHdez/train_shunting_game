/**
 * The single shared "breath" animation the sky band uses for anything that
 * should pulse gently at night — the star field (`IsoSky.tsx`) and, per
 * design/scenery-spec.md §2.1/§2.4's night behaviour, the twin-head lamp
 * post's glow. One `withRepeat`/`withTiming` definition, reused verbatim by
 * every caller, rather than a bespoke per-prop animation loop — see
 * DECISIONES §11 "sin trabajo por fotograma en el hilo JS": this still runs
 * entirely in a Reanimated worklet feeding a Skia `opacity` prop, never JS.
 *
 * Each caller gets its OWN SharedValue/effect instance (React hooks can't
 * literally share a value across unrelated component trees without lifting
 * state up through props, which would mean threading a new prop through
 * `IsoSky` for a cosmetic sub-detail). Both callers use identical timing and
 * mount in the same React commit as siblings in the board tree, so in
 * practice they stay in phase — this is "the same shared clock", not a new
 * one, in every sense that matters visually.
 */

import { useEffect } from 'react';
import { Easing, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

/**
 * Returns a derived opacity oscillating between 0.5 and 1 on a 1700ms
 * sin-eased loop while `enabled`, or a constant 1 (no animation, no
 * useEffect side effect) while disabled — callers pass e.g.
 * `palette.key === 'noche'` so the loop never runs on passes that don't need
 * it.
 */
export function useTwinkle(enabled: boolean) {
  const twinkle = useSharedValue(0);
  useEffect(() => {
    if (!enabled) return;
    twinkle.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }), -1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
  return useDerivedValue(() => (enabled ? 0.5 + twinkle.value * 0.5 : 1), [twinkle, enabled]);
}
