import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { typeScaleMenu } from '../../../design/tokens';
import { usePalette } from '../../render/iso/timeOfDay';

/**
 * One push's effect on the live classification score: `value` is
 * `puntos(after) - puntos(before)`, `nonce` bumps on every successful push
 * so the badge re-triggers even if the delta repeats (e.g. two +10 pushes
 * in a row).
 */
export interface PointsDelta {
  value: number;
  nonce: number;
}

interface PointsDeltaBadgeProps {
  /** Latest push delta, or null before the first push this level. */
  delta: PointsDelta | null;
}

/**
 * Floating "+N" / "−N" that pops up near the PUNTOS stat right after a push
 * and fades out (~1s total) — makes each push's score effect
 * self-explanatory, e.g. a push that creates a "salto" visibly shows a red
 * "−5" instead of the total just silently dropping.
 *
 * Purely presentational: the controller computes `delta`, this only
 * animates it. Zero-delta pushes render nothing (there's nothing to
 * explain).
 */
export default function PointsDeltaBadge({ delta }: PointsDeltaBadgeProps) {
  const { hud } = usePalette();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(0);
  const [display, setDisplay] = useState<{ text: string; color: string } | null>(null);

  useEffect(() => {
    if (!delta || delta.value === 0) return;
    setDisplay({
      text: delta.value > 0 ? `+${delta.value}` : `${delta.value}`,
      color: delta.value > 0 ? hud.statSuccess : hud.statWarning,
    });
    translateY.value = 0;
    opacity.value = withSequence(
      withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }),
      withDelay(500, withTiming(0, { duration: 380, easing: Easing.in(Easing.quad) }))
    );
    translateY.value = withTiming(-16, { duration: 1000, easing: Easing.out(Easing.quad) });
    // Only the nonce identifies a new push — `delta` is a fresh object each
    // render otherwise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delta?.nonce, hud.statSuccess, hud.statWarning]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!display) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.container, animatedStyle]}>
      <Text style={[styles.text, { color: display.color }]} maxFontSizeMultiplier={1.3} numberOfLines={1}>
        {display.text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: -18,
    alignSelf: 'center',
    right: 0,
  },
  text: {
    ...typeScaleMenu.body,
    fontWeight: '800',
  },
});
