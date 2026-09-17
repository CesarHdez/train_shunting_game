/**
 * SUPERSEDED by IsoTrackBed.tsx's buildRunPath — reachable only from the
 * equally superseded Peine.tsx. Changes here reach no screen.
 *
 * Pure geometry for one "peine" (fan throat) branch: a cubic-bezier curve
 * from (x1,y1) to (x2,y2) with a horizontal-tangent control-point layout,
 * offset into a ballast ribbon + two gauge rails + rotated sleeper ties.
 *
 * Faithful port of ref/js/shunting/renderer.js `drawPeineBranch`. Kept
 * framework-free (no Skia imports) so it can be unit tested and memoized
 * independently of the render tree.
 */

const GAUGE = 10;
const BALLAST = 18;
const N = 28;

function cbez(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const m = 1 - t;
  return m * m * m * p0 + 3 * m * m * t * p1 + 3 * m * t * t * p2 + t * t * t * p3;
}
function cbezD(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const m = 1 - t;
  return 3 * (m * m * (p1 - p0) + 2 * m * t * (p2 - p1) + t * t * (p3 - p2));
}

export interface PeineTie {
  x: number;
  y: number;
  angleRad: number;
  even: boolean;
}

export interface PeineBranchGeometry {
  /** SVG path (filled polygon) for the ballast ribbon. */
  ballastPath: string;
  /** SVG paths for the two gauge rails (stroke, round join). */
  railPaths: [string, string];
  ties: PeineTie[];
}

export function buildPeineBranch(x1: number, y1: number, x2: number, y2: number): PeineBranchGeometry {
  const dx = x2 - x1;
  const cpx1 = x1 + dx * 0.5;
  const cpy1 = y1;
  const cpx2 = x2 - dx * 0.5;
  const cpy2 = y2;

  const pts: { x: number; y: number; nx: number; ny: number }[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const px = cbez(t, x1, cpx1, cpx2, x2);
    const py = cbez(t, y1, cpy1, cpy2, y2);
    const tx = cbezD(t, x1, cpx1, cpx2, x2);
    const ty = cbezD(t, y1, cpy1, cpy2, y2);
    const len = Math.sqrt(tx * tx + ty * ty) || 1;
    pts.push({ x: px, y: py, nx: -ty / len, ny: tx / len });
  }

  let ballastPath = '';
  pts.forEach((p, i) => {
    const ox = p.x + p.nx * BALLAST;
    const oy = p.y + p.ny * BALLAST;
    ballastPath += `${i === 0 ? 'M' : 'L'}${ox},${oy} `;
  });
  for (let i = pts.length - 1; i >= 0; i--) {
    ballastPath += `L${pts[i].x - pts[i].nx * BALLAST},${pts[i].y - pts[i].ny * BALLAST} `;
  }
  ballastPath += 'Z';

  const railPaths: [string, string] = ['', ''];
  ([-1, 1] as const).forEach((sign, idx) => {
    let path = '';
    pts.forEach((p, i) => {
      const rx = p.x + p.nx * GAUGE * sign;
      const ry = p.y + p.ny * GAUGE * sign;
      path += `${i === 0 ? 'M' : 'L'}${rx},${ry} `;
    });
    railPaths[idx] = path.trim();
  });

  const approxLen = Math.sqrt(dx * dx + (y2 - y1) * (y2 - y1));
  const numTies = Math.max(3, Math.floor(approxLen / 14));
  const ties: PeineTie[] = [];
  for (let k = 1; k < numTies; k++) {
    const t = k / numTies;
    const bx = cbez(t, x1, cpx1, cpx2, x2);
    const by = cbez(t, y1, cpy1, cpy2, y2);
    const tx = cbezD(t, x1, cpx1, cpx2, x2);
    const ty = cbezD(t, y1, cpy1, cpy2, y2);
    ties.push({ x: bx, y: by, angleRad: Math.atan2(ty, tx), even: k % 2 === 0 });
  }

  return { ballastPath, railPaths, ties };
}
