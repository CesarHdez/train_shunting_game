import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, layout, spacing } from '../../../design/tokens';
import { usePalette } from '../../render/iso/timeOfDay';
import Button from '../Button';
import { UndoIcon } from '../icons';

interface BottomBarProps {
  onUndo: () => void;
  canUndo: boolean;
  insetBottom: number;
}

/**
 * Thumb-zone-reachable primary UNDO action. Undo is the most-used control
 * in this puzzle (correcting a bad push/pull), so it gets the easy-reach
 * spot at the bottom of the screen instead of the small icon button that
 * used to live in TopBar. Full-width-feel, ≥48dp tap target, dimmed when
 * there's nothing to undo.
 */
export default function BottomBar({ onUndo, canUndo, insetBottom }: BottomBarProps) {
  const { hud } = usePalette();
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: hud.panelBg, borderTopColor: hud.buttonBorder },
        { paddingBottom: Math.max(insetBottom, spacing.sm) },
      ]}
    >
      <View style={styles.row}>
        <Button
          label="DESHACER"
          icon={<UndoIcon />}
          accessibilityLabel="Deshacer última maniobra"
          onPress={onUndo}
          variant="undo"
          disabled={!canUndo}
          width="90%"
          height={48}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface.headerBg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  row: {
    height: layout.bottomBarHeight,
    alignItems: 'center',
    justifyContent: 'center',
    // Capped + centered so the "90%"-wide undo button reads as a comfortable
    // thumb-reach control on phones rather than stretching edge-to-edge on a
    // wide tablet/landscape window — see layout.playAreaMaxWidth.
    width: '100%',
    maxWidth: layout.playAreaMaxWidth,
    alignSelf: 'center',
  },
});
