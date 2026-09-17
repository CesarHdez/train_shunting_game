/// <reference types="jest" />
import type { ShuntingLevel } from '../../data/levelTypes';
import { ShuntingEngine } from '../shunting';
import { shuntingHasNewCoupling } from '../shuntingCoupling';

/**
 * Three tracks: A has a standing car, B has a standing car, C starts empty.
 * Big enough capacity that nothing here is capacity-limited.
 */
const LEVEL: ShuntingLevel = {
  id: 100,
  tracks: [
    ['X', '', '', ''], // track 0 ("A")
    ['Y', '', '', ''], // track 1 ("B")
    ['', '', '', ''], // track 2 ("C") — empty
  ],
  targetSequence: ['X', 'Y'],
  description: 'coupling predicate fixture',
  capacity: 4,
};

const LEVEL_RIGHT: ShuntingLevel = {
  id: 101,
  tracks: [
    ['A', 'B', '', ''], // track 0
    ['C', '', '', ''], // track 1 — occupied
    ['', '', '', ''], // track 2 — empty
  ],
  targetSequence: ['C', 'A', 'B'],
  description: 'right loco coupling predicate fixture',
  capacity: 4,
  rightLoco: true,
};

describe('shuntingHasNewCoupling', () => {
  test('cut arriving at an EMPTY track: no coupling', () => {
    const engine = new ShuntingEngine(LEVEL);
    engine.positionLocomotive(0); // free first placement, auto-selects X
    const before = engine.getState();
    engine.moveSelected(2); // track C is empty
    const after = engine.getState();
    expect(after.moves).toBe(before.moves + 1);
    expect(shuntingHasNewCoupling(before, after)).toBe(false);
  });

  test('cut arriving at an OCCUPIED track: new coupling', () => {
    const engine = new ShuntingEngine(LEVEL);
    engine.positionLocomotive(0); // free first placement, auto-selects X
    const before = engine.getState();
    engine.moveSelected(1); // track B already has Y
    const after = engine.getState();
    expect(after.moves).toBe(before.moves + 1);
    expect(shuntingHasNewCoupling(before, after)).toBe(true);
  });

  test('bare locomotive reposition onto an OCCUPIED track: new coupling', () => {
    const engine = new ShuntingEngine(LEVEL);
    engine.positionLocomotive(2); // free first placement, on empty track C
    const before = engine.getState();
    engine.positionLocomotive(0); // paid reposition (different, non-empty track)
    const after = engine.getState();
    expect(after.moves).toBe(before.moves + 1);
    // Nothing physically moved between tracks — this is a pure reposition.
    expect(after.tracks).toEqual(before.tracks);
    expect(shuntingHasNewCoupling(before, after)).toBe(true);
  });

  test('bare locomotive reposition onto an EMPTY track: no coupling', () => {
    const engine = new ShuntingEngine(LEVEL);
    engine.positionLocomotive(0); // free first placement, on occupied track A
    const before = engine.getState();
    engine.positionLocomotive(2); // paid reposition onto empty track C
    const after = engine.getState();
    expect(after.moves).toBe(before.moves + 1);
    expect(shuntingHasNewCoupling(before, after)).toBe(false);
  });

  test('first placement (free) onto an occupied track never reaches the predicate as a "move", but is not a false positive either', () => {
    const engine = new ShuntingEngine(LEVEL);
    const before = engine.getState();
    engine.positionLocomotive(0); // free — first placement, no move cost
    const after = engine.getState();
    expect(after.moves).toBe(before.moves); // free: caller's `after.moves > before.moves` gate already excludes this
    expect(shuntingHasNewCoupling(before, after)).toBe(true); // predicate itself is still structurally correct if ever consulted
  });

  test('re-clicking the same track (free, no-op reposition): no coupling', () => {
    const engine = new ShuntingEngine(LEVEL);
    engine.positionLocomotive(0);
    const before = engine.getState();
    engine.positionLocomotive(0); // same track again — free, no move
    const after = engine.getState();
    expect(after.moves).toBe(before.moves);
    expect(shuntingHasNewCoupling(before, after)).toBe(false);
  });

  test('selection-only change (no locomotive track change): no coupling', () => {
    const engine = new ShuntingEngine(LEVEL);
    engine.positionLocomotive(0);
    const before = engine.getState();
    engine.selectCar(0, 0); // trims the selection, doesn't move anything
    const after = engine.getState();
    expect(after.moves).toBe(before.moves);
    expect(shuntingHasNewCoupling(before, after)).toBe(false);
  });

  test('right locomotive: cut arriving at an OCCUPIED track (tail-append semantics): new coupling', () => {
    const engine = new ShuntingEngine(LEVEL_RIGHT);
    engine.positionLocomotiveRight(0); // free first placement, auto-selects [A, B]
    const before = engine.getState();
    engine.moveSelectedRight(1); // track 1 already has C
    const after = engine.getState();
    expect(after.moves).toBe(before.moves + 1);
    // Confirms append semantics: standing car stays at the head, cut appends after it.
    expect(after.tracks[1].filter((c) => c !== '')).toEqual(['C', 'A', 'B']);
    expect(shuntingHasNewCoupling(before, after)).toBe(true);
  });

  test('right locomotive: cut arriving at an EMPTY track: no coupling', () => {
    const engine = new ShuntingEngine(LEVEL_RIGHT);
    engine.positionLocomotiveRight(0); // free first placement, auto-selects [A, B]
    const before = engine.getState();
    engine.moveSelectedRight(2); // track 2 is empty
    const after = engine.getState();
    expect(after.moves).toBe(before.moves + 1);
    expect(shuntingHasNewCoupling(before, after)).toBe(false);
  });

  test('right locomotive: bare reposition onto an OCCUPIED track: new coupling', () => {
    const engine = new ShuntingEngine(LEVEL_RIGHT);
    engine.positionLocomotiveRight(2); // free first placement, empty track
    const before = engine.getState();
    engine.positionLocomotiveRight(1); // paid reposition onto occupied track 1
    const after = engine.getState();
    expect(after.moves).toBe(before.moves + 1);
    expect(after.tracks).toEqual(before.tracks); // bare reposition, nothing moved
    expect(shuntingHasNewCoupling(before, after)).toBe(true);
  });

  test('undo (uncoupling) is intentionally out of scope for this predicate: the controller never consults it for undo', () => {
    // Documents the design decision (see shuntingCoupling.ts's doc comment):
    // undo() always sets `message = 'Movimiento deshecho'`, which short-
    // circuits shuntingController.ts's computeFeedback BEFORE it would ever
    // call shuntingHasNewCoupling — so undo can never play the coupling
    // sound, matching "uncoupling is not coupling". We assert the message
    // side here since the predicate itself has no notion of "undo".
    // Unreachable target so the coupling move below doesn't also win the
    // level (an engine that's already `won` rejects `undo()` outright,
    // which would make this test pass for the wrong reason).
    const engine = new ShuntingEngine({ ...LEVEL, targetSequence: ['Z'] });
    engine.positionLocomotive(0);
    engine.moveSelected(1); // occupied — real coupling formed
    engine.undo();
    expect(engine.state.message).toBe('Movimiento deshecho');
  });
});
