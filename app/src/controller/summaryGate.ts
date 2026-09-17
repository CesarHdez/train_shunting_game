/**
 * src/controller/summaryGate.ts
 *
 * Tiny pure predicates gating WinSummaryCard's visibility (and, by
 * extension, the board's confetti) independently of `celebrate`. Split out
 * from shuntingController.ts / classificationController.ts so the exact same
 * rule governs both modes and so it's covered by a plain Jest test (see
 * __tests__/summaryGate.test.ts) without needing a React-hook test renderer,
 * which this project's Jest setup doesn't include (testEnvironment: 'node',
 * no @testing-library/react-native / react-test-renderer).
 *
 * Fixes: the win/summary card used to have no way to be closed — it only
 * exited via its own REPETIR/MENÚ/SIGUIENTE buttons, permanently blocking
 * the HUD (menu/restart/undo) behind it. Both controllers now keep a
 * `summaryDismissed` bit alongside `celebrate` (reset together on level
 * change/restart, so a genuinely new win always shows the card fresh) and
 * derive everything the UI needs from these two predicates.
 */

/**
 * `WinSummaryCard.visible` AND the board's `showCelebration` (confetti) both
 * key off this — never off `celebrate` alone, or dismissing the card
 * wouldn't also stop the confetti sitting behind it.
 */
export function isSummaryVisible(celebrate: boolean, dismissed: boolean): boolean {
  return celebrate && !dismissed;
}

/**
 * True while the level is won but the card is currently hidden — drives the
 * small "RESULTADOS" reopen affordance so the player can always get back to
 * the score/leaderboard after closing the card.
 */
export function canReopenSummary(celebrate: boolean, dismissed: boolean): boolean {
  return celebrate && dismissed;
}
