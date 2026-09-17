/**
 * resolveAutoTimeOfDay is the one bit of "Hora Dorada" (design_handoff_menus)
 * that must never drift: get a franja boundary off by one hour and every
 * menu + the game board silently relight to the wrong palette. Pinned here
 * against every band and its exact edges.
 *
 * Only the pure clock math is exercised — importing `resolveAutoTimeOfDay`
 * from '../timeOfDay' also loads TimeOfDayManager/useTimeOfDay, but neither
 * is invoked here, so react-native's AppState (lazily required — see
 * timeOfDay.ts) is never actually touched under this plain Node/babel-jest
 * environment.
 */

import { resolveAutoTimeOfDay } from '../timeOfDay';

function at(hours: number, minutes: number): Date {
  return new Date(2024, 0, 1, hours, minutes, 0, 0);
}

describe('resolveAutoTimeOfDay', () => {
  it('resolves the middle of each band', () => {
    expect(resolveAutoTimeOfDay(at(6, 30))).toBe('amanecer');
    expect(resolveAutoTimeOfDay(at(12, 0))).toBe('mediodia');
    expect(resolveAutoTimeOfDay(at(18, 30))).toBe('atardecer');
    expect(resolveAutoTimeOfDay(at(23, 0))).toBe('noche');
    expect(resolveAutoTimeOfDay(at(2, 0))).toBe('noche');
  });

  it('amanecer/noche boundary: 04:59 is still noche, 05:00 is amanecer', () => {
    expect(resolveAutoTimeOfDay(at(4, 59))).toBe('noche');
    expect(resolveAutoTimeOfDay(at(5, 0))).toBe('amanecer');
  });

  it('amanecer/mediodia boundary: 07:59 is still amanecer, 08:00 is mediodia', () => {
    expect(resolveAutoTimeOfDay(at(7, 59))).toBe('amanecer');
    expect(resolveAutoTimeOfDay(at(8, 0))).toBe('mediodia');
  });

  it('mediodia/atardecer boundary: 16:59 is still mediodia, 17:00 is atardecer', () => {
    expect(resolveAutoTimeOfDay(at(16, 59))).toBe('mediodia');
    expect(resolveAutoTimeOfDay(at(17, 0))).toBe('atardecer');
  });

  it('atardecer/noche boundary: 19:59 is still atardecer, 20:00 is noche', () => {
    expect(resolveAutoTimeOfDay(at(19, 59))).toBe('atardecer');
    expect(resolveAutoTimeOfDay(at(20, 0))).toBe('noche');
  });

  it('defaults to the current time when called with no argument', () => {
    // Not a boundary check — just confirms the default-arg path executes
    // without throwing and returns one of the four valid passes.
    expect(['amanecer', 'mediodia', 'atardecer', 'noche']).toContain(resolveAutoTimeOfDay());
  });
});
