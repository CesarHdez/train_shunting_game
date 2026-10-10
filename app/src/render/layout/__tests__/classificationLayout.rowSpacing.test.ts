/** Arrival/classification rows must not visually overlap: a car's on-screen height fits in the row-to-row rail spacing. */
import { computeClassificationLayout } from '../classificationLayout';

describe('classification row spacing', () => {
  for (const arrivals of [1, 2, 3, 4]) {
    it(`${arrivals} arrival rows do not overlap (844x305 landscape canvas)`, () => {
      const l = computeClassificationLayout({
        arrivalsCount: arrivals,
        clasifCount: 5,
        arrSlots: 6,
        clasSlots: 6,
        width: 844,
        height: 305,
      });
      for (let i = 0; i + 1 < arrivals; i++) {
        const railNear = l.camera.project(l.trackSX, l.arrY(i + 1)).y;
        const railFar = l.camera.project(l.trackSX, l.arrY(i)).y;
        const carHeightNear = l.arrCarRailY * l.camera.depthScaleAt(l.arrY(i + 1));
        expect(railNear - railFar).toBeGreaterThanOrEqual(carHeightNear - 0.5);
      }
    });
  }
});
