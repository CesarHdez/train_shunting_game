/**
 * Derives a shunting-style wagon livery (`IsoWagonMaterial`) from a
 * destination colour, so Patio de Clasificación cars can reuse the exact
 * Patio de Maniobras shells (wagonShell.tsx) and differ only by colour.
 * Pure + memoised per (destination, dim) — no per-frame work.
 */

import { colors, type DestinationKey, type IsoWagonMaterial } from '../../../design/tokens';

function parse(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Linear mix of `a` toward `b` by t (0..1), returned as #rrggbb. */
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(ar, br)}${c(ag, bg)}${c(ab, bb)}`;
}

const cache = new Map<string, IsoWagonMaterial>();

/**
 * @param dim 0..1 darkening toward black, used for the night palette so the
 *            fleet sits in the same mood as the shunting wagons while the hue
 *            (the mechanic) stays identifiable.
 */
export function destinationLivery(dest: DestinationKey, dim = 0): IsoWagonMaterial {
  const key = `${dest}:${dim}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const d = colors.destinations[dest];
  const hi = mixHex(mixHex(d.fill, '#ffffff', 0.2), '#000000', dim);
  const lo = mixHex(mixHex(d.dark, '#000000', 0.12), '#000000', dim);
  const cap = mixHex(mixHex(d.dark, '#000000', 0.38), '#000000', dim);
  const mat: IsoWagonMaterial = {
    hi,
    lo,
    cap,
    // Kept light so the hue survives inside doors / wells / bins.
    inset: 'rgba(0,0,0,0.28)',
    domeHi: hi,
    domeLo: lo,
  };
  cache.set(key, mat);
  return mat;
}
