/**
 * Every bundled classification level must be perfectly solvable: replaying
 * the solver's solution (tools/classificationLevels.mjs) through the real
 * engine has to land exactly on puntajeMaximo, i.e. 3 stars with every color
 * in a single block. Regenerate both files with
 * `node tools/classificationLevels.mjs --write`.
 */

import { ClassificationEngine, puntajeMaximo, starsForScore } from '../classification';
import { getClassificationLevel, classificationLevelCount } from '../../data/levels';
import solutions from './classificationSolutions.json';

describe('classification levels', () => {
  for (let id = 1; id <= classificationLevelCount; id++) {
    it(`level ${id} reaches the theoretical max with its stored solution`, () => {
      const level = getClassificationLevel(id)!;
      const moves = (solutions as Record<string, number[][]>)[String(id)];
      expect(moves).toHaveLength(level.arrivals.flat().length);

      const engine = new ClassificationEngine(level);
      for (const [arrival, track] of moves) {
        engine.selectArrival(arrival);
        engine.empujar(track);
        expect(engine.getState().message).toBe('');
      }

      const { status, lastResult } = engine.getState();
      expect(status).toBe('SUMMARY');
      const max = puntajeMaximo(level);
      expect(lastResult!.puntos).toBe(max);
      expect(starsForScore(lastResult!.puntos, max)).toBe(3);
    });
  }

  it('capacities hold every car of each level', () => {
    for (let id = 1; id <= classificationLevelCount; id++) {
      const level = getClassificationLevel(id)!;
      const cap = level.capacities.reduce((a, b) => a + b, 0);
      expect(cap).toBeGreaterThanOrEqual(level.arrivals.flat().length);
    }
  });
});
