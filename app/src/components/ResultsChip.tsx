import React from 'react';
import { StyleSheet } from 'react-native';
import { spacing } from '../../design/tokens';
import Button from './Button';
import { TrophyIcon } from './icons';

interface ResultsChipProps {
  /** Only true while the level is won/finished AND the summary card has been
   *  dismissed — see `canReopenSummary` in shuntingController.ts /
   *  classificationController.ts (summaryGate.ts). */
  visible: boolean;
  onPress: () => void;
}

/**
 * Small floating affordance to bring the win/summary card back after the
 * player has closed it (✕ / tap-outside / Android back — see
 * WinSummaryCard's `onDismiss`). Without this there would be no way back to
 * the score/stars/leaderboard once dismissed. Deliberately NOT placed inside
 * TopBar: the landscape `compact` row is already tight (menu/restart/undo +
 * stat strip + mute toggle), so this floats over the board's top-right
 * corner instead — out of the way of both HUD layouts, and only ever
 * rendered while there's actually something to reopen.
 */
export default function ResultsChip({ visible, onPress }: ResultsChipProps) {
  if (!visible) return null;
  return (
    <Button
      label="RESULTADOS"
      icon={<TrophyIcon />}
      accessibilityLabel="Ver resultados del nivel"
      onPress={onPress}
      variant="primary"
      width={132}
      height={36}
      fontSize={11}
      style={styles.chip}
    />
  );
}

const styles = StyleSheet.create({
  chip: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 20,
    elevation: 6,
    opacity: 0.94,
  },
});
