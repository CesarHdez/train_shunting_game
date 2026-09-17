/**
 * src/controller/sections.ts
 *
 * Pure helpers for hybrid section-based level progression ("worlds") on the
 * level-select screen (LevelSelectScreen.tsx). Deliberately free of React /
 * React Native / backend imports so it's trivially unit-testable under plain
 * Jest and has no runtime dependency on how completion data is fetched.
 *
 * SHUNTING: 100 levels are grouped into 10 sections of SHUNTING_SECTION_SIZE
 * (10) each — "Sección 1" = levels 1–10 … "Sección 10" = 91–100. Section 1 is
 * always unlocked; section N (N>1) unlocks once at least UNLOCK_THRESHOLD of
 * the 10 levels in section N−1 are completed.
 *
 * CLASSIFICATION: only 10 "turnos" total. The screen calls buildSections()
 * with sectionSize === the full level count, which always produces exactly
 * one section. Because sectionUnlocked() treats index 0 as always-unlocked,
 * that single section is never locked — no mode-specific branching needed.
 */

export const SHUNTING_SECTION_SIZE = 10;

/** Of the SHUNTING_SECTION_SIZE levels in a section, how many must be
 *  completed (>=1 star / isCompleted) before the next section unlocks. */
export const UNLOCK_THRESHOLD = 8;

export interface SectionDef {
  /** 0-based section index. */
  index: number;
  /** Display title, e.g. "SECCIÓN 3". */
  title: string;
  /** 1-based level ids belonging to this section, ascending. */
  levelIds: number[];
}

export interface SectionProgress {
  completedCount: number;
  totalCount: number;
  /** Sum of stars (0-3 each) across every level in the section. */
  starsEarned: number;
}

/**
 * Splits levels 1..totalLevels into consecutive chunks of `sectionSize`.
 * Always returns at least one section (even if totalLevels is 0) so callers
 * never have to special-case an empty result.
 */
export function buildSections(
  totalLevels: number,
  sectionSize: number,
  titleFor: (sectionNumber1Based: number) => string = (n) => `SECCIÓN ${n}`
): SectionDef[] {
  const safeSize = Math.max(1, sectionSize);
  const count = Math.max(1, Math.ceil(totalLevels / safeSize));
  return Array.from({ length: count }, (_, i) => {
    const start = i * safeSize + 1;
    const end = Math.min(start + safeSize - 1, totalLevels);
    const levelIds: number[] = [];
    for (let id = start; id <= end; id++) levelIds.push(id);
    return { index: i, title: titleFor(i + 1), levelIds };
  });
}

/** Aggregates per-level completed/star state for one section's levelIds. */
export function computeSectionProgress(
  levelIds: number[],
  isCompleted: (levelId: number) => boolean,
  starsFor: (levelId: number) => 0 | 1 | 2 | 3
): SectionProgress {
  let completedCount = 0;
  let starsEarned = 0;
  for (const id of levelIds) {
    if (isCompleted(id)) completedCount++;
    starsEarned += starsFor(id);
  }
  return { completedCount, totalCount: levelIds.length, starsEarned };
}

/**
 * Pure unlock rule. Section 0 is always unlocked. Section N (N>0) unlocks
 * once section N−1's completedCount reaches `threshold`.
 *
 * `progressBySection` must be indexed identically to the `SectionDef[]` it
 * was derived from (progressBySection[i] describes the section at index i).
 * If a caller passes a shorter array (no data yet for the previous section),
 * this fails open (treats it as unlocked) rather than soft-locking the UI on
 * a transient loading state.
 */
export function sectionUnlocked(
  sectionIndex: number,
  progressBySection: readonly Pick<SectionProgress, 'completedCount'>[],
  threshold: number = UNLOCK_THRESHOLD
): boolean {
  if (sectionIndex <= 0) return true;
  const prev = progressBySection[sectionIndex - 1];
  if (!prev) return true;
  return prev.completedCount >= threshold;
}
