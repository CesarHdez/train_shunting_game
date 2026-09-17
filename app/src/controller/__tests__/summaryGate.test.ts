/// <reference types="jest" />
import { canReopenSummary, isSummaryVisible } from '../summaryGate';

describe('summaryGate', () => {
  describe('isSummaryVisible', () => {
    it('is false before any win', () => {
      expect(isSummaryVisible(false, false)).toBe(false);
    });

    it('is true once celebrate flips true and the card has not been dismissed', () => {
      expect(isSummaryVisible(true, false)).toBe(true);
    });

    it('is false once the player dismisses the card, even though the level is still won', () => {
      expect(isSummaryVisible(true, true)).toBe(false);
    });

    it('is false if dismissed is (impossibly) true before a win — never pops up on its own', () => {
      expect(isSummaryVisible(false, true)).toBe(false);
    });
  });

  describe('canReopenSummary', () => {
    it('is false before any win', () => {
      expect(canReopenSummary(false, false)).toBe(false);
    });

    it('is false while the card is showing (nothing to reopen)', () => {
      expect(canReopenSummary(true, false)).toBe(false);
    });

    it('is true once the level is won and the card has been dismissed', () => {
      expect(canReopenSummary(true, true)).toBe(true);
    });
  });

  it('isSummaryVisible and canReopenSummary are mutually exclusive whenever celebrate is true', () => {
    for (const dismissed of [true, false]) {
      expect(isSummaryVisible(true, dismissed) && canReopenSummary(true, dismissed)).toBe(false);
      expect(isSummaryVisible(true, dismissed) || canReopenSummary(true, dismissed)).toBe(true);
    }
  });
});
