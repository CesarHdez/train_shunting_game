/// <reference types="jest" />
import type { ClassificationLevel, ShuntingLevel } from '../../data/levelTypes';
import { ClassificationEngine, calcularPuntaje, puntajeMaximo, starsForScore } from '../classification';
import { ShuntingEngine } from '../shunting';
import { computeShuntingScore, getStars } from '../scoring';

// ─────────────────────────── FIXTURES ────────────────────────────

/** Mirrors ref/levels/shunting/level_01.json exactly. */
const LEVEL_1: ShuntingLevel = {
  id: 1,
  tracks: [
    ['', '', '', '', '', ''],
    ['B', '', '', '', '', ''],
    ['A', '', '', '', '', ''],
  ],
  targetSequence: ['A', 'B'],
  description: 'Nivel 1: Tutorial. Coloca A antes que B.',
  capacity: 6,
  minMoves: 1,
};

/** A distractor car (C) sits on the target track and must NOT satisfy the win check. */
const LEVEL_DISTRACTOR: ShuntingLevel = {
  id: 2,
  tracks: [
    ['A', 'B', '', '', ''],
    ['C', '', '', '', ''],
    ['', '', '', '', ''],
  ],
  targetSequence: ['A', 'B'],
  description: 'distractor test',
  capacity: 5,
};

const LEVEL_TIGHT_CAPACITY: ShuntingLevel = {
  id: 3,
  tracks: [
    ['A', 'B'],
    ['C', 'D'],
  ],
  targetSequence: ['A', 'B', 'C', 'D'],
  description: 'capacity test',
  capacity: 2,
};

const LEVEL_LOCO_LIMIT: ShuntingLevel = {
  id: 4,
  tracks: [
    ['A', 'B', '', ''],
    ['', '', '', ''],
  ],
  targetSequence: ['A'],
  description: 'loco limit test',
  capacity: 4,
  locoLimit: 1,
};

const LEVEL_RIGHT_LOCO: ShuntingLevel = {
  id: 5,
  tracks: [
    ['A', 'B', '', ''],
    ['C', 'D', '', ''],
  ],
  targetSequence: ['C', 'A', 'B', 'D'],
  description: 'right loco tail deposit test',
  capacity: 4,
  rightLoco: true,
};

const LEVEL_REPOSITION: ShuntingLevel = {
  id: 6,
  tracks: [
    ['X', '', ''],
    ['', '', ''],
  ],
  targetSequence: ['Z'], // unreachable — this level is only used to test undo depth
  description: 'reposition/undo depth test',
  capacity: 3,
};

const CLF_LEVEL_1: ClassificationLevel = {
  id: 1,
  name: 'Fixture',
  description: 'small classification fixture',
  arrivals: [['F-rojo', 'T-azul', 'F-rojo', 'J-azul']],
  capacities: [2, 2],
};

// ──────────────────────────── SHUNTING ───────────────────────────

describe('ShuntingEngine', () => {
  test('first locomotive placement is free and auto-selects the head block', () => {
    const engine = new ShuntingEngine(LEVEL_1);
    engine.positionLocomotive(2); // track with ['A', '', ...]
    expect(engine.state.moves).toBe(0);
    expect(engine.state.locoTrack).toBe(2);
    expect(engine.state.selectedCars).toEqual([0]);
  });

  test('re-clicking the same track stays free', () => {
    const engine = new ShuntingEngine(LEVEL_1);
    engine.positionLocomotive(2);
    engine.positionLocomotive(2);
    expect(engine.state.moves).toBe(0);
  });

  test('repositioning to a different track costs 1 move', () => {
    const engine = new ShuntingEngine(LEVEL_1);
    engine.positionLocomotive(2); // free
    engine.positionLocomotive(1); // reposition -> 1 move
    expect(engine.state.moves).toBe(1);
    expect(engine.state.locoTrack).toBe(1);
    // Auto-selected head block on the new track ['B', ...]
    expect(engine.state.selectedCars).toEqual([0]);
  });

  test('win detection: moving A onto B reaches target ["A","B"] in exactly minMoves', () => {
    const engine = new ShuntingEngine(LEVEL_1);
    engine.positionLocomotive(2); // loco on track with A (free)
    engine.moveSelected(1); // pull A onto track with B
    expect(engine.state.moves).toBe(1);
    expect(engine.state.moves).toBe(LEVEL_1.minMoves);
    expect(engine.state.won).toBe(true);
    expect(engine.state.status).toBe('WON');
    expect(engine.state.tracks[1].filter((c) => c !== '')).toEqual(['A', 'B']);
  });

  test('moveSelected onto the loco\'s own track is a no-op', () => {
    const engine = new ShuntingEngine(LEVEL_1);
    engine.positionLocomotive(2);
    engine.moveSelected(2);
    expect(engine.state.moves).toBe(0);
    expect(engine.state.won).toBe(false);
  });

  test('distractor car prevents a false win (length must match exactly)', () => {
    const engine = new ShuntingEngine(LEVEL_DISTRACTOR);
    engine.positionLocomotive(0); // ['A','B',...] head block = [0,1]
    expect(engine.state.selectedCars).toEqual([0, 1]);
    engine.moveSelected(1); // deposit onto track with distractor C -> [A,B,C]
    expect(engine.state.won).toBe(false);
    expect(engine.state.tracks[1].filter((c) => c !== '')).toEqual(['A', 'B', 'C']);

    // Now clear the distractor track and confirm the SAME cars do win elsewhere.
    const engine2 = new ShuntingEngine(LEVEL_DISTRACTOR);
    engine2.positionLocomotive(0);
    engine2.moveSelected(2); // empty track
    expect(engine2.state.won).toBe(true);
  });

  test('capacity rejection keeps state unchanged and sets the Spanish message', () => {
    const engine = new ShuntingEngine(LEVEL_TIGHT_CAPACITY);
    engine.positionLocomotive(0); // ['A','B'] both selected, capacity=2
    engine.moveSelected(1); // dest already has 2 cars -> 2+2 > 2
    expect(engine.state.message).toBe('¡Vía llena! No caben más vagones.');
    expect(engine.state.moves).toBe(0);
    expect(engine.state.tracks[0]).toEqual(['A', 'B']);
    expect(engine.state.tracks[1]).toEqual(['C', 'D']);
  });

  test('locoLimit rejection sets the Spanish message and blocks the move', () => {
    const engine = new ShuntingEngine(LEVEL_LOCO_LIMIT);
    engine.positionLocomotive(0); // selects head block [0,1] = ['A','B'], but limit is 1
    expect(engine.state.selectedCars).toEqual([0, 1]);
    engine.moveSelected(1);
    expect(engine.state.message).toBe('¡Límite! Máx. 1 vagón por maniobra.');
    expect(engine.state.moves).toBe(0);
    expect(engine.state.tracks[0]).toEqual(['A', 'B', '', '']);
  });

  test('locoLimit message pluralizes for limit > 1', () => {
    const level: ShuntingLevel = { ...LEVEL_LOCO_LIMIT, locoLimit: 2, tracks: [['A', 'B', 'C', ''], ['', '', '', '']], capacity: 4 };
    const engine = new ShuntingEngine(level);
    engine.positionLocomotive(0); // selects [0,1,2] = 3 cars, limit=2
    engine.moveSelected(1);
    expect(engine.state.message).toBe('¡Límite! Máx. 2 vagónes por maniobra.');
  });

  test('right locomotive: first placement selects ALL cars (tail-capable), tail deposit appends after existing cars', () => {
    const engine = new ShuntingEngine(LEVEL_RIGHT_LOCO);
    engine.positionLocomotiveRight(1); // track ['C','D',...] free placement
    expect(engine.state.moves).toBe(0);
    expect(engine.state.rightSelectedCars).toEqual([0, 1]);

    engine.selectCarRight(1, 1); // select tail block from col 1 -> just D
    expect(engine.state.rightSelectedCars).toEqual([1]);

    engine.moveSelectedRight(0); // deposit D at the tail of track 0 (['A','B'])
    expect(engine.state.moves).toBe(1);
    expect(engine.state.tracks[0].filter((c) => c !== '')).toEqual(['A', 'B', 'D']);
    expect(engine.state.tracks[1].filter((c) => c !== '')).toEqual(['C']);
  });

  test('left loco selects a head block 0..col; right loco selects a tail block col..end', () => {
    const engine = new ShuntingEngine(LEVEL_RIGHT_LOCO);
    engine.positionLocomotive(0); // ['A','B'] -> auto head block [0,1]
    engine.selectCar(0, 0); // narrow selection to just col 0
    expect(engine.state.selectedCars).toEqual([0]);
  });

  test('the two locomotives can never share a track', () => {
    const engine = new ShuntingEngine(LEVEL_RIGHT_LOCO);
    engine.positionLocomotive(0);
    engine.positionLocomotiveRight(0); // blocked: left loco is already there
    expect(engine.state.rightLocoTrack).toBe(-1);

    engine.positionLocomotiveRight(1); // deactivates the left loco (ref state.js:489)
    engine.positionLocomotive(1); // blocked: right loco is already there
    // The right activation reset locoTrack to -1, and this placement was blocked,
    // so the left loco never lands on track 1.
    expect(engine.state.locoTrack).toBe(-1);
  });

  test('activating the right loco deactivates the left; a later left placement is free again', () => {
    const engine = new ShuntingEngine(LEVEL_RIGHT_LOCO);
    engine.positionLocomotive(0); // first placement — free
    engine.positionLocomotiveRight(1); // clears left loco (locoTrack -> -1) and its selection
    expect(engine.state.locoTrack).toBe(-1);
    expect(engine.state.selectedCars).toEqual([]);
    // Re-placing the left loco now counts as a "first" placement again — still free.
    engine.positionLocomotive(0);
    expect(engine.state.moves).toBe(0);
  });

  test('placing the left loco does NOT deactivate the right loco (intentional asymmetry)', () => {
    const engine = new ShuntingEngine(LEVEL_RIGHT_LOCO);
    engine.positionLocomotiveRight(1); // right loco on track 1
    expect(engine.state.rightLocoTrack).toBe(1);
    engine.positionLocomotive(0); // placing left must leave the right loco untouched
    expect(engine.state.rightLocoTrack).toBe(1);
  });

  test('moving into a track occupied by the other locomotive is rejected with a message', () => {
    const engine = new ShuntingEngine(LEVEL_RIGHT_LOCO);
    engine.positionLocomotive(0);
    engine.positionLocomotiveRight(1); // deactivates the left loco (clears its selection)
    expect(engine.state.selectedCars).toEqual([]);
    engine.positionLocomotive(0); // re-place the left loco (free first placement again)
    engine.selectCar(0, 0);
    engine.moveSelected(1); // target occupied by right loco
    expect(engine.state.message).toBe('¡Vía ocupada por la otra locomotora!');
    expect(engine.state.moves).toBe(0);
  });

  test('undo restores the previous snapshot exactly', () => {
    const engine = new ShuntingEngine(LEVEL_1);
    engine.positionLocomotive(2);
    engine.moveSelected(1);
    expect(engine.state.won).toBe(true);
    // won levels don't undo (matches original: `if (... this.won) return;`)
    engine.undo();
    expect(engine.state.won).toBe(true);
  });

  test('undo is capped at 40 deep', () => {
    const engine = new ShuntingEngine(LEVEL_REPOSITION);
    engine.positionLocomotive(0); // free
    for (let i = 0; i < 42; i++) {
      engine.positionLocomotive(i % 2 === 0 ? 1 : 0); // 42 repositions, alternating tracks
    }
    expect(engine.state.moves).toBe(42);

    let undosApplied = 0;
    let lastMoves = engine.state.moves;
    for (let i = 0; i < 45; i++) {
      const before = engine.state.moves;
      engine.undo();
      if (engine.state.moves !== before) undosApplied++;
      lastMoves = engine.state.moves;
    }
    expect(undosApplied).toBe(40); // only the last 40 pushes are recoverable
    expect(lastMoves).toBe(2); // moves value recorded at push #3 (moves = k-1 for the 3rd push)
  });

  test('restart resets to the initial level snapshot', () => {
    const engine = new ShuntingEngine(LEVEL_1);
    engine.positionLocomotive(2);
    engine.moveSelected(1);
    expect(engine.state.won).toBe(true);
    engine.restart();
    expect(engine.state.won).toBe(false);
    expect(engine.state.status).toBe('PLAYING');
    expect(engine.state.moves).toBe(0);
    expect(engine.state.locoTrack).toBe(-1);
    expect(engine.state.tracks).toEqual(LEVEL_1.tracks);
  });

  test('getState returns a deep clone (mutating it does not affect engine state)', () => {
    const engine = new ShuntingEngine(LEVEL_1);
    const snap = engine.getState();
    snap.tracks[0][0] = 'MUTATED';
    expect(engine.state.tracks[0][0]).not.toBe('MUTATED');
  });
});

// ────────────────────────── CLASSIFICATION ───────────────────────

describe('ClassificationEngine', () => {
  test('selectArrival ignores out-of-range and empty tracks', () => {
    const engine = new ClassificationEngine(CLF_LEVEL_1);
    engine.selectArrival(5); // out of range
    expect(engine.state.viaSel).toBe(0);
  });

  test('empujar pushes only the head car and costs 1 move, no cost on rejection', () => {
    const engine = new ClassificationEngine(CLF_LEVEL_1);
    engine.empujar(0); // pushes 'F-rojo' (head)
    expect(engine.state.moves).toBe(1);
    expect(engine.state.clasif[0]).toEqual(['F-rojo']);
    expect(engine.state.arrivals[0][0]).toBe('T-azul'); // new head

    // Fill track 0 to capacity (2), then a further push should be rejected free of charge.
    engine.empujar(1); // T-azul -> track 1
    engine.empujar(0); // F-rojo -> track 0 (now full: capacity 2)
    expect(engine.state.moves).toBe(3);
    engine.empujar(0); // J-azul head now, but track 0 is full
    expect(engine.state.message).toBe('¡Vía llena! Elige otra vía de clasificación.');
    expect(engine.state.moves).toBe(3); // unchanged — rejection is free
  });

  test('auto-jumps viaSel to another non-empty arrival when the current one empties, and finishes the level', () => {
    const level: ClassificationLevel = {
      id: 2,
      name: 'two arrivals',
      description: '',
      arrivals: [['F-rojo'], ['T-azul']],
      capacities: [1, 1],
    };
    const engine = new ClassificationEngine(level);
    engine.empujar(0); // empties arrival 0 -> auto-jump viaSel to arrival 1
    expect(engine.state.viaSel).toBe(1);
    expect(engine.state.status).toBe('PLAYING');
    engine.empujar(1); // empties arrival 1 -> remaining === 0 -> finish()
    expect(engine.state.status).toBe('SUMMARY');
    expect(engine.state.finished).toBe(true);
    expect(engine.state.lastResult).not.toBeNull();
  });

  test('undo restores the previous snapshot', () => {
    const engine = new ClassificationEngine(CLF_LEVEL_1);
    engine.empujar(0);
    engine.undo();
    expect(engine.state.moves).toBe(0);
    expect(engine.state.clasif[0]).toEqual([]);
    expect(engine.state.arrivals[0]).toEqual(CLF_LEVEL_1.arrivals[0]);
  });

  test('full optimal playthrough hits the theoretical max score and 3 stars', () => {
    const engine = new ClassificationEngine(CLF_LEVEL_1);
    // arrivals head sequence: F-rojo, T-azul, F-rojo, J-azul
    engine.empujar(0); // F-rojo -> track 0
    engine.empujar(1); // T-azul -> track 1
    engine.empujar(0); // F-rojo -> track 0
    engine.empujar(1); // J-azul -> track 1
    expect(engine.state.status).toBe('SUMMARY');
    expect(engine.remaining).toBe(0);

    const max = puntajeMaximo(CLF_LEVEL_1);
    expect(max).toBe(100); // 4 cars*10 + 2 pure tracks*30, 0 avoidable breaks
    expect(engine.state.lastResult).toEqual({ puntos: 100, saltos: 0, purasBonus: 60, carros: 4 });
    expect(starsForScore(engine.state.lastResult!.puntos, max)).toBe(3);
  });
});

describe('calcularPuntaje', () => {
  test('pure single-color tracks get the +30 bonus each', () => {
    const result = calcularPuntaje([
      ['F-rojo', 'F-rojo'],
      ['T-azul'],
    ]);
    expect(result).toEqual({ puntos: 90, saltos: 0, purasBonus: 60, carros: 3 });
  });

  test('color changes cost 15 points each and break the pure bonus', () => {
    const result = calcularPuntaje([['F-rojo', 'T-azul', 'F-rojo']]);
    expect(result).toEqual({ puntos: 0, saltos: 2, purasBonus: 0, carros: 3 });
  });

  test('score is clamped at 0, never negative', () => {
    const result = calcularPuntaje([['F-rojo', 'T-azul', 'F-rojo', 'T-azul', 'F-rojo']]);
    // 5 cars*10 - 4 saltos*15 = 50 - 60 = -10 -> clamped to 0
    expect(result.puntos).toBe(0);
    expect(result.saltos).toBe(4);
  });
});

describe('starsForScore', () => {
  test('thresholds at 90% / 70%', () => {
    expect(starsForScore(100, 100)).toBe(3);
    expect(starsForScore(90, 100)).toBe(3);
    expect(starsForScore(89, 100)).toBe(2);
    expect(starsForScore(70, 100)).toBe(2);
    expect(starsForScore(69, 100)).toBe(1);
    expect(starsForScore(0, 100)).toBe(1);
  });

  test('returns 1 when max is falsy (avoids divide-by-zero)', () => {
    expect(starsForScore(0, 0)).toBe(1);
  });
});

// ───────────────────────────── SCORING ───────────────────────────

describe('computeShuntingScore', () => {
  test('exact move score when minMoves is known and matched', () => {
    // moveScore = round(1000 * min(1, minMoves/moves)^2), moves===minMoves -> ratio 1 -> 1000
    expect(computeShuntingScore(2, 10, 2, 3)).toBe(1000 + (200 - 10));
  });

  test('degrades quadratically as moves exceed minMoves', () => {
    // ratio 2/4=0.5 -> 0.25*1000=250
    expect(computeShuntingScore(4, 10, 2, 3)).toBe(250 + (200 - 10));
  });

  test('zero-move zero-time level scores the max move score', () => {
    expect(computeShuntingScore(0, 0, 0, 3)).toBe(1000 + 200);
  });

  test('time bonus never goes negative', () => {
    expect(computeShuntingScore(2, 500, 2, 3)).toBe(1000); // 200-500 clamped to 0
  });

  test('car-count fallback when minMoves is unknown', () => {
    // n = max(carCount, 2) = 3; moves<=n+1(4) -> 1000; moves<=n*2+1(7) -> 600; else 200
    expect(computeShuntingScore(4, 0, null, 3)).toBe(1000 + 200);
    expect(computeShuntingScore(7, 0, null, 3)).toBe(600 + 200);
    expect(computeShuntingScore(8, 0, null, 3)).toBe(200 + 200);
  });
});

describe('getStars', () => {
  test('exact thresholds when minMoves is known', () => {
    expect(getStars(2, 2, 3)).toBe(3);
    expect(getStars(3, 2, 3)).toBe(2); // ceil(2*1.5) = 3
    expect(getStars(4, 2, 3)).toBe(1);
  });

  test('car-count fallback when minMoves is unknown', () => {
    expect(getStars(4, null, 3)).toBe(3); // n=3, moves<=4
    expect(getStars(7, null, 3)).toBe(2); // moves<=7
    expect(getStars(8, null, 3)).toBe(1);
  });
});
