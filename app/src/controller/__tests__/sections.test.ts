/// <reference types="jest" />
import { buildSections, computeSectionProgress, sectionUnlocked, SHUNTING_SECTION_SIZE, UNLOCK_THRESHOLD } from '../sections';

describe('buildSections', () => {
  it('splits 100 shunting levels into 10 sections of 10', () => {
    const sections = buildSections(100, SHUNTING_SECTION_SIZE);
    expect(sections).toHaveLength(10);
    expect(sections[0].levelIds).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
    expect(sections[9].levelIds).toEqual(Array.from({ length: 10 }, (_, i) => 91 + i));
  });

  it('collapses 10 classification levels into a single section', () => {
    const sections = buildSections(10, 10, () => 'TURNOS');
    expect(sections).toHaveLength(1);
    expect(sections[0].levelIds).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
  });

  it('handles a partial final chunk', () => {
    const sections = buildSections(25, 10);
    expect(sections).toHaveLength(3);
    expect(sections[2].levelIds).toEqual([21, 22, 23, 24, 25]);
  });
});

describe('computeSectionProgress', () => {
  it('counts completed levels and sums stars', () => {
    const completed = new Set([1, 2, 3]);
    const stars: Record<number, 0 | 1 | 2 | 3> = { 1: 3, 2: 2, 3: 1 };
    const progress = computeSectionProgress(
      [1, 2, 3, 4],
      (id) => completed.has(id),
      (id) => stars[id] ?? 0
    );
    expect(progress).toEqual({ completedCount: 3, totalCount: 4, starsEarned: 6 });
  });
});

describe('sectionUnlocked', () => {
  it('section 0 is always unlocked, regardless of progress data', () => {
    expect(sectionUnlocked(0, [])).toBe(true);
    expect(sectionUnlocked(0, [{ completedCount: 0 }])).toBe(true);
  });

  it('section N stays locked below the threshold', () => {
    const progress = [{ completedCount: UNLOCK_THRESHOLD - 1 }];
    expect(sectionUnlocked(1, progress)).toBe(false);
  });

  it('section N unlocks at exactly the threshold', () => {
    const progress = [{ completedCount: UNLOCK_THRESHOLD }];
    expect(sectionUnlocked(1, progress)).toBe(true);
  });

  it('section N unlocks above the threshold', () => {
    const progress = [{ completedCount: 10 }];
    expect(sectionUnlocked(1, progress)).toBe(true);
  });

  it('fails open when previous section progress is missing', () => {
    expect(sectionUnlocked(2, [{ completedCount: 10 }])).toBe(true);
  });

  it('respects a custom threshold override', () => {
    const progress = [{ completedCount: 5 }];
    expect(sectionUnlocked(1, progress, 5)).toBe(true);
    expect(sectionUnlocked(1, progress, 6)).toBe(false);
  });
});
