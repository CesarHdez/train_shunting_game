/**
 * Shunting mode scoring — exact port of ref/js/core/scores.js
 * (computeShuntingScore + ShuntingScores.getStars), minus the
 * localStorage-backed leaderboard bookkeeping (ScoreManager), which
 * is a UI/persistence concern, not engine logic.
 *
 * Classification scoring (calcularPuntaje / puntajeMaximo / starsForScore)
 * lives in ./classification.ts instead, per the reference module split.
 */

/**
 * Move score is primary (0-1000), time is a secondary bonus (0-200).
 * When minMoves is known the move score is exact; otherwise it falls
 * back to a coarse car-count-based star mapping.
 */
export function computeShuntingScore(
  moves: number,
  time: number,
  minMoves: number | null | undefined,
  carCount: number
): number {
  let moveScore: number;
  if (minMoves != null && minMoves > 0 && moves > 0) {
    moveScore = Math.round(1000 * Math.pow(Math.min(1, minMoves / moves), 2));
  } else if (minMoves === 0 && moves === 0) {
    moveScore = 1000;
  } else {
    const n = Math.max(carCount || 2, 2);
    moveScore = moves <= n + 1 ? 1000 : moves <= n * 2 + 1 ? 600 : 200;
  }
  const timeBonus = Math.max(0, 200 - time); // max 200 pts, decreasing 1 pt/second
  return moveScore + timeBonus;
}

/**
 * Stars for a given move count: 3 if moves <= minMoves, 2 if <= ceil(minMoves*1.5),
 * else 1. Falls back to a car-count-based threshold when minMoves is unknown.
 */
export function getStars(
  moves: number,
  minMoves: number | null | undefined,
  carCount: number
): 1 | 2 | 3 {
  if (minMoves != null) {
    if (moves <= minMoves) return 3;
    if (moves <= Math.ceil(minMoves * 1.5)) return 2;
    return 1;
  }
  const n = Math.max(carCount || 2, 2);
  if (moves <= n + 1) return 3;
  if (moves <= n * 2 + 1) return 2;
  return 1;
}
