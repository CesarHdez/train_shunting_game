import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { colors, layout, radii, spacing, typeScaleMenu } from '../../../design/tokens';

interface ToastProps {
  /** Current message, or null when nothing to show. Auto-dismiss timing is
   * owned by the controller (2000ms) — this component just animates the
   * fade/scale transition per components.md §4.3. */
  message: string | null;
  /** Bottom offset in dp — anchored above the bottom bar. */
  bottomOffset: number;
}

export default function Toast({ message, bottomOffset }: ToastProps) {
  const [displayText, setDisplayText] = useState('');
  const progress = useSharedValue(0);
  const wasVisible = useRef(false);

  useEffect(() => {
    if (message) {
      setDisplayText(message);
      progress.value = withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) });
      wasVisible.current = true;
    } else if (wasVisible.current) {
      progress.value = withTiming(0, { duration: 150, easing: Easing.in(Easing.quad) });
      wasVisible.current = false;
    }
  }, [message, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.9 + progress.value * 0.1 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { bottom: bottomOffset }, style]}
      // Announces the message to screen readers as it appears, without
      // stealing focus from the board — this is a transient status message,
      // not an interactive element.
      accessibilityLiveRegion={message ? 'polite' : 'none'}
      accessibilityRole="alert"
    >
      <Text style={styles.text} numberOfLines={2} maxFontSizeMultiplier={1.3}>
        {displayText}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: layout.toastMaxWidth,
    minHeight: layout.toastHeight,
    borderRadius: radii.md,
    backgroundColor: 'rgba(198,40,40,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  text: {
    ...typeScaleMenu.body,
    color: colors.text.onAccent,
    textAlign: 'center',
  },
});
