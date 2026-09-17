/**
 * The isometric camera is the one place where a silent math error turns into
 * "taps land on the wrong track" rather than something you can see, so the
 * round-trip and fit properties are pinned here.
 */

import {
  applyMatrix3,
  createIsoCamera,
  depthScaleWithMatrix,
  planeSizeForViewport,
  projectWithMatrix,
} from '../isoCamera';
import { isoCameraTokens } from '../../../../design/tokens';

/** Landscape phone board area, after the compact HUD is subtracted. */
const VIEW = { viewportWidth: 820, viewportHeight: 290 };

function build(view = VIEW) {
  const { planeWidth, planeHeight } = planeSizeForViewport(view);
  return createIsoCamera({ ...view, planeWidth, planeHeight });
}

describe('planeSizeForViewport', () => {
  it('sizes the plane so the camera needs no further rescaling', () => {
    const cam = build();
    expect(cam.scale).toBeCloseTo(1, 4);
  });

  it('keeps the near edge within the viewport width', () => {
    const cam = build();
    const nearLeft = cam.project(0, cam.planeHeight);
    const nearRight = cam.project(cam.planeWidth, cam.planeHeight);
    expect(nearLeft.x).toBeGreaterThanOrEqual(-0.01);
    expect(nearRight.x).toBeLessThanOrEqual(VIEW.viewportWidth + 0.01);
    // …and actually USES it — a camera that fits by shrinking to nothing
    // would also pass the bounds check above.
    expect(nearRight.x - nearLeft.x).toBeGreaterThan(VIEW.viewportWidth * 0.97);
  });

  it('leaves the requested sky band above the far edge', () => {
    const cam = build();
    const expectedSky = VIEW.viewportHeight * isoCameraTokens.skyFraction;
    expect(cam.horizonY).toBeGreaterThan(expectedSky * 0.9);
    expect(cam.horizonY).toBeLessThan(expectedSky * 1.1);
  });

  it('bottom-anchors the near edge', () => {
    const cam = build();
    expect(cam.nearY).toBeCloseTo(VIEW.viewportHeight - isoCameraTokens.bottomPadding, 4);
  });
});

describe('projection', () => {
  it('round-trips plane → screen → plane', () => {
    const cam = build();
    const samples: [number, number][] = [
      [0, 0],
      [cam.planeWidth, 0],
      [cam.planeWidth / 2, cam.planeHeight / 2],
      [0, cam.planeHeight],
      [cam.planeWidth, cam.planeHeight],
      [cam.planeWidth * 0.31, cam.planeHeight * 0.77],
    ];
    for (const [u, v] of samples) {
      const s = cam.project(u, v);
      const back = cam.unproject(s.x, s.y);
      expect(back.u).toBeCloseTo(u, 3);
      expect(back.v).toBeCloseTo(v, 3);
    }
  });

  it('agrees with the matrix form used by the Skia group and the ghost layer', () => {
    const cam = build();
    for (const [u, v] of [
      [10, 20],
      [cam.planeWidth * 0.8, cam.planeHeight * 0.4],
    ] as [number, number][]) {
      const direct = cam.project(u, v);
      const viaMatrix = projectWithMatrix(cam.matrix, u, v);
      expect(viaMatrix.x).toBeCloseTo(direct.x, 6);
      expect(viaMatrix.y).toBeCloseTo(direct.y, 6);
    }
    const p = cam.project(123, 45);
    const back = applyMatrix3(cam.inverse, p.x, p.y);
    expect(back.u).toBeCloseTo(123, 3);
    expect(back.v).toBeCloseTo(45, 3);
  });

  it('recedes: far rows are narrower and higher than near rows', () => {
    const cam = build();
    const far = cam.project(cam.planeWidth, 0).x - cam.project(0, 0).x;
    const near = cam.project(cam.planeWidth, cam.planeHeight).x - cam.project(0, cam.planeHeight).x;
    expect(far).toBeLessThan(near);
    expect(cam.project(0, 0).y).toBeLessThan(cam.project(0, cam.planeHeight).y);
  });

  it('scales billboards by depth, matching the reference near/far spread', () => {
    const cam = build();
    const r = isoCameraTokens.perspective;
    expect(cam.depthScaleAt(cam.planeHeight)).toBeCloseTo(cam.scale / (1 - r), 4);
    expect(cam.depthScaleAt(0)).toBeCloseTo(cam.scale / (1 + r), 4);
    expect(depthScaleWithMatrix(cam.matrix, cam.scale, cam.planeHeight / 2)).toBeCloseTo(
      cam.depthScaleAt(cam.planeHeight / 2),
      6
    );
  });

  it('spaces near rows further apart on screen than far rows', () => {
    const cam = build();
    const pitch = cam.planeHeight / 7;
    const farPitch = cam.rowPitchAt(pitch * 0.5, pitch);
    const nearPitch = cam.rowPitchAt(cam.planeHeight - pitch * 0.5, pitch);
    expect(nearPitch).toBeGreaterThan(farPitch);
    // rowPitchAt must agree with actually projecting two adjacent rows.
    const measured = cam.project(0, pitch * 4).y - cam.project(0, pitch * 3).y;
    expect(cam.rowPitchAt(pitch * 3.5, pitch)).toBeCloseTo(measured, 0);
  });
});

describe('degenerate viewports', () => {
  it('does not blow up on a zero-sized canvas', () => {
    const cam = createIsoCamera({ planeWidth: 0, planeHeight: 0, viewportWidth: 0, viewportHeight: 0 });
    const p = cam.project(0, 0);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });

  it('fits a tall/narrow (split-screen) canvas without overflowing width', () => {
    const view = { viewportWidth: 360, viewportHeight: 700 };
    const { planeWidth, planeHeight } = planeSizeForViewport(view);
    const cam = createIsoCamera({ ...view, planeWidth, planeHeight });
    expect(cam.project(cam.planeWidth, cam.planeHeight).x).toBeLessThanOrEqual(view.viewportWidth + 0.01);
    expect(cam.project(0, cam.planeHeight).x).toBeGreaterThanOrEqual(-0.01);
  });
});
