/**
 * Layout guarantees for the isometric yard. The screenshots cover the easy
 * levels; these cover the ones that are hard to reach by hand — the densest
 * level in the pack (7 tracks × 13 capacity, both throats) and the awkward
 * viewports — where the failure mode is silent: a car drawn past the canvas
 * edge, or a tap that resolves to the wrong track.
 */

import { computeShuntingLayout, type ShuntingLayout } from '../shuntingLayout';
import { layout as L } from '../../../../design/tokens';

/** Landscape phone board area, after the compact HUD is subtracted. */
const PHONE = { width: 820, height: 290 };
/** The densest level in assets/levels/shunting (level_100). */
const DENSEST = { trackCount: 7, capacity: 13, hasRightLoco: true };
const SIMPLE = { trackCount: 3, capacity: 6, hasRightLoco: false };

function build(level: Partial<typeof DENSEST> = {}, view = PHONE): ShuntingLayout {
  return computeShuntingLayout({ ...SIMPLE, ...level, ...view });
}

/** Screen box a billboarded sprite actually occupies (it stands up from the rail). */
function spriteBox(l: ShuntingLayout, b: { u: number; v: number; width: number; height: number }) {
  const s = l.camera.depthScaleAt(b.v);
  const p = l.camera.project(b.u, b.v);
  return { left: p.x - (b.width * s) / 2, right: p.x + (b.width * s) / 2, top: p.y - b.height * s, bottom: p.y };
}

describe('every level fits the canvas', () => {
  for (const [name, level] of [
    ['simple 3×6', SIMPLE],
    ['4 tracks', { trackCount: 4, capacity: 6, hasRightLoco: false }],
    ['densest 7×13 + right loco', DENSEST],
    ['7 tracks, narrow capacity', { trackCount: 7, capacity: 4, hasRightLoco: false }],
  ] as const) {
    describe(name, () => {
      const l = build(level);

      it('keeps every car on screen horizontally', () => {
        for (let i = 0; i < l.trackCount; i++) {
          for (let j = 0; j < l.capacity; j++) {
            const box = spriteBox(l, l.carBillboard(i, j));
            expect(box.left).toBeGreaterThanOrEqual(-1);
            expect(box.right).toBeLessThanOrEqual(l.contentWidth + 1);
          }
        }
      });

      it('keeps every locomotive on screen horizontally', () => {
        for (let i = 0; i < l.trackCount; i++) {
          for (const side of ['left', 'right'] as const) {
            if (side === 'right' && !l.hasRightLoco) continue;
            const box = spriteBox(l, l.locoBillboard(i, side));
            expect(box.left).toBeGreaterThanOrEqual(-1);
            expect(box.right).toBeLessThanOrEqual(l.contentWidth + 1);
          }
        }
      });

      it('keeps every row inside the canvas vertically', () => {
        for (let i = 0; i < l.trackCount; i++) {
          const box = spriteBox(l, l.carBillboard(i, 0));
          expect(box.top).toBeGreaterThanOrEqual(0);
          expect(box.bottom).toBeLessThanOrEqual(l.contentHeight + 1);
        }
      });

      it('never lets the throat collapse', () => {
        expect(l.peineLeft.fanEndX - l.peineLeft.convX).toBeGreaterThan(27.9);
        if (l.peineRight) {
          expect(l.peineRight.convX - l.peineRight.fanEndX).toBeGreaterThan(27.9);
        }
      });

      it('keeps cars at a tappable width', () => {
        expect(l.carWidth).toBeGreaterThanOrEqual(L.carWidthMin);
        expect(l.carWidth).toBeLessThanOrEqual(L.carWidthMax);
      });

      it('draws wagons wider than they are tall, like real rolling stock', () => {
        expect(l.carBodyWidth).toBeGreaterThan(l.carBodyHeight);
        expect(l.locoBodyWidth).toBeGreaterThan(l.locoBodyHeight);
        // The loco has to out-mass the cars it pulls.
        expect(l.locoBodyWidth).toBeGreaterThan(l.carBodyWidth);
      });

      it('never lets a bed swallow its neighbour', () => {
        expect(l.ballastWidth).toBeLessThan(l.rowPitch);
      });
    });
  }
});

describe('track bed reaches past the canvas edges', () => {
  // Regression coverage for the "rails float inside the frame" bug: every
  // row's straight run must project past the viewport, not stop at a visible
  // point, at BOTH the near row (least perspective compression, so the
  // easiest to satisfy) and the far row (most compression — planeEdgeU's
  // documented worst case, so the one most likely to fall short if the
  // extension were sized wrong).
  for (const [name, level] of [
    ['sparse, single throat', SIMPLE],
    ['densest, both throats', DENSEST],
  ] as const) {
    describe(name, () => {
      const l = build(level);
      const farV = l.rowV(0);
      const nearV = l.rowV(l.trackCount - 1);

      it('extends the left throat trunk past the left edge, at the near row, far row and convergence node', () => {
        for (const v of [farV, nearV, l.peineLeft.convY]) {
          expect(l.camera.project(l.edgeLeftX, v).x).toBeLessThanOrEqual(0.01);
        }
      });

      if (l.hasRightLoco) {
        it('extends the right throat trunk past the right edge, at the near row, far row and convergence node', () => {
          const convY = l.peineRight ? l.peineRight.convY : l.peineLeft.convY;
          for (const v of [farV, nearV, convY]) {
            expect(l.camera.project(l.edgeRightX, v).x).toBeGreaterThanOrEqual(l.contentWidth - 0.01);
          }
        });
      } else {
        it('terminates the right-hand bed inside the frame instead of bleeding past the edge', () => {
          expect(l.deadEndRightX).not.toBeNull();
          const deadEndRightX = l.deadEndRightX as number;
          // Sized off the capacity-derived car extent, a little past the
          // last car column — not off at the camera-bleed extent.
          expect(deadEndRightX).toBeGreaterThan(l.trackSX + l.trackWidth);
          expect(deadEndRightX).toBeLessThan(l.trackSX + l.trackWidth + l.badgeColumnWidth);
          for (const v of [farV, nearV]) {
            const x = l.camera.project(deadEndRightX, v).x;
            expect(x).toBeGreaterThan(0);
            expect(x).toBeLessThan(l.contentWidth - 0.01);
          }
        });
      }

      it('does not move any hit-test target', () => {
        // The extension is drawing-only: hitTest never reads edgeLeftX/edgeRightX/deadEndRightX.
        for (const i of [0, l.trackCount - 1]) {
          for (const j of [0, l.capacity - 1]) {
            const box = spriteBox(l, l.carBillboard(i, j));
            const hit = l.hitTest((box.left + box.right) / 2, (box.top + box.bottom) / 2);
            expect(hit).toEqual({ type: 'wagon', trackIdx: i, carIdx: j });
          }
        }
      });
    });
  }
});

describe('dead-end rule follows hasRightLoco, not level density', () => {
  it('a level WITH a right loco keeps both ends bleeding past the frame (deadEndRightX is null)', () => {
    const l = build(DENSEST); // hasRightLoco: true
    expect(l.deadEndRightX).toBeNull();
  });

  it('a level WITHOUT a right loco dead-ends the right side regardless of track count or capacity', () => {
    for (const level of [
      { trackCount: 3, capacity: 6, hasRightLoco: false },
      { trackCount: 7, capacity: 4, hasRightLoco: false },
      { trackCount: 7, capacity: 13, hasRightLoco: false },
      { trackCount: 1, capacity: 1, hasRightLoco: false },
    ]) {
      const l = build(level);
      expect(l.deadEndRightX).not.toBeNull();
      expect(l.deadEndRightX as number).toBeGreaterThan(l.trackSX + l.trackWidth);
    }
  });

  it("the badge anchor sits past the buffer stop, never inside or before it", () => {
    const l = build(SIMPLE);
    const deadEndRightX = l.deadEndRightX as number;
    for (let i = 0; i < l.trackCount; i++) {
      expect(l.badgeAnchor(i).u).toBeGreaterThan(deadEndRightX);
    }
  });
});

describe('scroll fallback', () => {
  it('does not scroll for any shipped level on a landscape phone', () => {
    for (const trackCount of [3, 4, 5, 6, 7]) {
      const l = build({ trackCount, capacity: 13, hasRightLoco: true });
      expect(l.contentHeight).toBeCloseTo(PHONE.height, 5);
    }
  });

  it('grows the canvas rather than crushing rows on a very short viewport', () => {
    const l = build({ trackCount: 7 }, { width: 820, height: 120 });
    expect(l.contentHeight).toBeGreaterThan(120);
    // …and the grown canvas restores a usable pitch.
    const pitch = l.camera.rowPitchAt(l.rowV(3), l.rowPitch);
    expect(pitch).toBeGreaterThan(20);
  });
});

describe('hit-testing', () => {
  const l = build(DENSEST);

  it('resolves a tap on a car body to that exact car', () => {
    for (const i of [0, 3, 6]) {
      for (const j of [0, 6, 12]) {
        const box = spriteBox(l, l.carBillboard(i, j));
        const hit = l.hitTest((box.left + box.right) / 2, (box.top + box.bottom) / 2);
        expect(hit).toEqual({ type: 'wagon', trackIdx: i, carIdx: j });
      }
    }
  });

  it('resolves a tap on a locomotive to that loco, not the car beside it', () => {
    for (const i of [0, 3, 6]) {
      for (const side of ['left', 'right'] as const) {
        const box = spriteBox(l, l.locoBillboard(i, side));
        const hit = l.hitTest((box.left + box.right) / 2, (box.top + box.bottom) / 2);
        expect(hit).toEqual({ type: 'loco', side, trackIdx: i });
      }
    }
  });

  it('gives a near car the tap when it overlaps the row behind it', () => {
    // The bottom strip of a near car covers the row in front of the far one;
    // whoever is drawn last must also win the tap.
    const near = spriteBox(l, l.carBillboard(6, 5));
    const hit = l.hitTest((near.left + near.right) / 2, near.bottom - 1);
    expect(hit).toEqual({ type: 'wagon', trackIdx: 6, carIdx: 5 });
  });

  it('resolves a tap on an EMPTY slot via the ground, so deposits still route', () => {
    // No sprite is drawn there; the plane-space fallback has to answer.
    const empty = build({ trackCount: 5, capacity: 8, hasRightLoco: false });
    const anchor = empty.camera.project(empty.carX(4) + empty.carWidth / 2, empty.rowV(2));
    const hit = empty.hitTest(anchor.x, anchor.y);
    expect(hit).toEqual({ type: 'wagon', trackIdx: 2, carIdx: 4 });
  });

  it('returns null outside the yard', () => {
    expect(l.hitTest(-50, -50)).toBeNull();
  });
});
