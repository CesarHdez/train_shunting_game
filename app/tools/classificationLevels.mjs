// Generador + solver exacto de los niveles del Patio de Clasificacion.
//
// Reglas (identicas a src/engine/classification.ts): el jugador elige
// cualquier via de llegada con carros y empuja su carro de cabeza (indice 0)
// al final de cualquier via de clasificacion con capacidad libre.
// Puntaje = carros*10 - saltos*15 + 30 por via no vacia de un solo color.
//
// Un nivel se acepta solo si su optimo real (busqueda exhaustiva) es igual a
// puntajeMaximo(): o sea, existe una forma de dejar cada color en un unico
// bloque. La dificultad se mide con:
//   - pPerfect: probabilidad de lograr el perfecto eligiendo movimientos al azar
//   - greedy: estrellas que obtiene un jugador "ingenuo" (pega al color igual,
//     si no a una via vacia, si no a la de mas espacio)
//
// Uso: node tools/classificationLevels.mjs [--write]
//   --write  escribe assets/levels/classification/level_XX.json y las
//            soluciones para el test de regresion.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const COLORS = ['rojo', 'azul', 'verde', 'ambar', 'violeta'];
const TIPOS = ['F', 'T', 'V', 'J', 'C'];

// ───────────────────────────── RNG ─────────────────────────────
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffle = (arr, rnd) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ─────────────────────────── Puntaje ───────────────────────────
export function puntajeMaximo(arrivals, caps) {
  const flat = arrivals.flat();
  const colores = new Set(flat).size;
  const saltosMin = Math.max(0, colores - caps.length);
  const puras = saltosMin > 0 ? caps.length - 1 : Math.min(caps.length, colores);
  return flat.length * 10 - saltosMin * 15 + puras * 30;
}
const stars = (pts, max) => (pts / max >= 0.9 ? 3 : pts / max >= 0.7 ? 2 : 1);

// ─────────────────────────── Solver ────────────────────────────
// Solo interesa el perfecto, asi que se poda en cuanto deja de ser posible:
// un color que reaparece en un bloque nuevo, o una segunda via con mas de un
// color (puntajeMaximo asume una sola via mezclada). Estado: carros sacados de
// cada llegada + por via (largo, ultimo color, si ya mezcla colores).
export function analyze(arrivals, caps) {
  const A = arrivals.length;
  const T = caps.length;
  const total = arrivals.reduce((s, a) => s + a.length, 0);
  const C = Math.max(...arrivals.flat()) + 1;
  const max = puntajeMaximo(arrivals, caps);
  const pos = new Array(A).fill(0);
  const len = new Array(T).fill(0);
  const last = new Array(T).fill(-1);
  const multi = new Array(T).fill(0);
  const seen = new Array(C).fill(0);
  let multis = 0;
  const memo = new Map();

  const finalScore = () => {
    let s = total * 10;
    for (let t = 0; t < T; t++) {
      // Con la poda cada color es un bloque: saltos = colores de la via - 1.
      if (len[t] > 0 && !multi[t]) s += 30;
    }
    const nonEmpty = len.filter((l) => l > 0).length;
    return s - 15 * (C - nonEmpty);
  };

  // Intenta el movimiento; devuelve false si rompe la posibilidad de perfecto.
  const apply = (a, t) => {
    const c = arrivals[a][pos[a]];
    const undo = { a, t, last: last[t], multi: multi[t], multis };
    if (last[t] !== c) {
      if (seen[c]) return null;
      if (last[t] !== -1 && !multi[t]) {
        if (multis >= 1) return null;
        multi[t] = 1;
        multis++;
      }
    }
    seen[c]++;
    pos[a]++;
    len[t]++;
    last[t] = c;
    return undo;
  };
  const revert = (u) => {
    pos[u.a]--;
    len[u.t]--;
    seen[arrivals[u.a][pos[u.a]]]--;
    last[u.t] = u.last;
    multi[u.t] = u.multi;
    multis = u.multis;
  };

  // Probabilidad de terminar en perfecto jugando movimientos legales al azar.
  const rec = (left) => {
    if (left === 0) return finalScore() === max ? 1 : 0;
    const key = pos.join(',') + '|' + len.join(',') + '|' + last.join(',') + '|' + multi.join('');
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    let sum = 0;
    let n = 0;
    for (let a = 0; a < A; a++) {
      if (pos[a] >= arrivals[a].length) continue;
      for (let t = 0; t < T; t++) {
        if (len[t] >= caps[t]) continue;
        n++;
        const u = apply(a, t);
        if (!u) continue;
        sum += rec(left - 1);
        revert(u);
      }
    }
    const out = n === 0 ? 0 : sum / n;
    memo.set(key, out);
    return out;
  };

  const pPerfect = rec(total);

  const solution = [];
  if (pPerfect > 0) {
    for (let left = total; left > 0; left--) {
      let done = false;
      for (let a = 0; a < A && !done; a++) {
        if (pos[a] >= arrivals[a].length) continue;
        for (let t = 0; t < T && !done; t++) {
          if (len[t] >= caps[t]) continue;
          const u = apply(a, t);
          if (!u) continue;
          if (rec(left - 1) > 0) {
            solution.push([a, t]);
            done = true;
          } else revert(u);
        }
      }
    }
  }

  return { max, best: pPerfect > 0 ? max : -1, pPerfect, solution, states: memo.size };
}

// Jugador ingenuo: mismo color > via vacia > via con mas espacio.
export function greedy(arrivals, caps) {
  const arr = arrivals.map((a) => [...a]);
  const vias = caps.map(() => []);
  const total = arr.flat().length;
  for (let k = 0; k < total; k++) {
    let pick = null;
    let rank = Infinity;
    arr.forEach((a, ai) => {
      if (!a.length) return;
      const c = a[0];
      vias.forEach((v, t) => {
        if (v.length >= caps[t]) return;
        const r = v.length && v[v.length - 1] === c ? 0 : v.length === 0 ? 1 : 2 + v.length / caps[t];
        if (r < rank) {
          rank = r;
          pick = [ai, t];
        }
      });
    });
    if (!pick) return 0;
    vias[pick[1]].push(arr[pick[0]].shift());
  }
  let s = total * 10;
  for (const v of vias) {
    let sal = 0;
    for (let i = 1; i < v.length; i++) if (v[i] !== v[i - 1]) sal++;
    s -= sal * 15;
    if (v.length && sal === 0) s += 30;
  }
  return s;
}

// ─────────────────────────── Diseno ────────────────────────────
// counts: carros por color. groups: que colores van juntos en cada via del
// reparto perfecto (define las capacidades). slack: espacio extra por via.
const SPECS = [
  {
    name: 'Primeros destinos',
    hint: 'Cada color a su vía',
    arrivals: 1, counts: [3, 3], groups: [[0], [1]], slack: 1,
    target: 0.05,
  },
  {
    name: 'Tres destinos',
    hint: 'Capacidad exacta: mira cuántos carros trae cada color',
    arrivals: 1, counts: [3, 2, 4], groups: [[0], [1], [2]], slack: 0,
    target: 0.01,
  },
  {
    name: 'Dos llegadas',
    hint: 'Elige de qué vía de llegada sacas cada carro',
    arrivals: 2, counts: [4, 3, 2], groups: [[0], [1], [2]], slack: 0,
    target: 0.006,
  },
  {
    name: 'Tres colores, dos vías',
    hint: 'Una vía debe llevar dos colores: decide cuál entra primero',
    arrivals: 1, counts: [3, 3, 3], groups: [[0], [1, 2]], slack: 0, equalCaps: true,
    target: 0.004, needsPlan: true,
  },
  {
    name: 'Orden de entrada',
    hint: 'Un color va solo; los otros dos comparten vía sin mezclarse',
    arrivals: 2, counts: [4, 3, 3], groups: [[0], [1, 2]], slack: 0,
    target: 0.002, needsPlan: true,
  },
  {
    name: 'Cuatro destinos',
    hint: 'Cuatro colores en tres vías: una lleva dos',
    arrivals: 2, counts: [3, 3, 3, 2], groups: [[0], [1], [2, 3]], slack: 0,
    target: 0.001, needsPlan: true,
  },
  {
    name: 'Tres en una vía',
    hint: 'Cuatro colores en dos vías: tres comparten vía, en el orden justo',
    arrivals: 2, counts: [3, 2, 3, 3], groups: [[0, 1, 2], [3]], slack: 0,
    target: 0.0005, needsPlan: true,
  },
  {
    name: 'Cinco destinos',
    hint: 'Cinco colores, tres vías y tres llegadas',
    arrivals: 3, counts: [3, 3, 2, 3, 3], groups: [[0, 1, 2], [3], [4]], slack: 0,
    target: 0.0002, needsPlan: true,
  },
  {
    name: 'Consolidación',
    hint: 'Cinco colores en solo dos vías',
    arrivals: 3, counts: [2, 2, 3, 2, 4], groups: [[0, 1, 2, 3], [4]], slack: 0,
    target: 0.0001, needsPlan: true,
  },
  {
    name: 'Hora pico',
    hint: 'Cuatro llegadas, cinco colores, capacidad exacta',
    arrivals: 4, counts: [3, 3, 3, 4, 4], groups: [[0, 1, 2], [3], [4]], slack: 0, attempts: 80,
    target: 5e-05, needsPlan: true,
  },
];

// Construye el nivel a partir de una solucion perfecta: cada via recibe sus
// colores en bloques (orden al azar), se intercalan las vias al azar y la
// secuencia resultante se reparte entre las llegadas conservando el orden.
// Jugar las llegadas en ese orden reproduce el perfecto, asi que siempre hay
// solucion; el filtro de dificultad decide si sirve.
function buildCandidate(spec, rnd) {
  const palette = shuffle(COLORS, rnd).slice(0, spec.counts.length);
  const queues = spec.groups.map((g) => shuffle(g, rnd).flatMap((ci) => new Array(spec.counts[ci]).fill(ci)));
  const merged = [];
  const qs = queues.map((q) => [...q]);
  while (qs.some((q) => q.length)) {
    const live = qs.filter((q) => q.length);
    // Sesgo a seguir con la misma via un rato: crea tramos que parecen
    // "faciles" y esconden el orden real.
    const q = live[Math.floor(rnd() * live.length)];
    merged.push(q.shift());
  }
  const total = merged.length;
  const room = Math.ceil(total / spec.arrivals);
  const arrivals = Array.from({ length: spec.arrivals }, () => []);
  for (const c of merged) {
    // Peso = espacio libre, asi las llegadas quedan de largo parejo.
    const free = arrivals.map((a) => room - a.length);
    let pick = rnd() * free.reduce((x, y) => x + y, 0);
    let i = 0;
    while (pick >= free[i]) pick -= free[i++];
    arrivals[i].push(c);
  }
  let caps = spec.groups.map((g) => g.reduce((s, ci) => s + spec.counts[ci], 0) + spec.slack);
  if (spec.equalCaps) {
    const m = Math.max(...caps);
    caps = caps.map(() => m);
  }
  // Las capacidades se barajan junto con el reparto para no delatar la via.
  const order = shuffle(caps.map((_, i) => i), rnd);
  return { arrivals, caps: order.map((i) => caps[i]), palette };
}

const pad = (n) => String(n).padStart(2, '0');

function main() {
  const write = process.argv.includes('--write');
  const rnd = mulberry32(20261009);
  const levels = [];
  const solutions = {};

  SPECS.forEach((spec, idx) => {
    const id = idx + 1;
    let chosen = null;
    let tried = 0;
    let accepted = 0;
    const attempts = spec.attempts ?? 200;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const cand = buildCandidate(spec, rnd);
      tried++;
      const r = analyze(cand.arrivals, cand.caps);
      if (r.best !== r.max) continue; // sin solucion perfecta, u optimo raro
      const g = greedy(cand.arrivals, cand.caps);
      if (spec.needsPlan && stars(g, r.max) === 3) continue; // el ingenuo no debe bastar
      accepted++;
      const dist = Math.abs(Math.log(r.pPerfect) - Math.log(spec.target));
      if (!chosen || dist < chosen.dist) chosen = { ...cand, r, g, dist };
    }
    if (!chosen) throw new Error(`Nivel ${id}: ningun candidato valido`);

    const { arrivals, caps, palette, r, g } = chosen;
    const named = arrivals.map((a) => a.map((c) => `${TIPOS[Math.floor(rnd() * TIPOS.length)]}-${palette[c]}`));
    const colores = spec.counts.length;
    const saltos = Math.max(0, colores - caps.length);
    const desc =
      `${arrivals.length} vía${arrivals.length > 1 ? 's' : ''} de llegada · ${colores} colores · ${caps.length} vías` +
      (saltos ? ` → ${saltos} salto${saltos > 1 ? 's' : ''} inevitable${saltos > 1 ? 's' : ''}` : '') +
      ` · ${spec.hint}`;
    levels.push({
      id,
      name: `Turno ${id} · ${spec.name}`,
      description: desc,
      arrivals: named,
      capacities: caps,
    });
    solutions[id] = r.solution;

    const sh = (c) => palette[c].slice(0, 2);
    console.log(
      `L${pad(id)} ${spec.name.padEnd(24)} arr=${arrivals.map((a) => a.map(sh).join('')).join(' / ')} caps=[${caps}]` +
        `\n     max=${r.max} pPerfect=${(r.pPerfect * 100).toPrecision(2)}%` +
        ` greedy=${g} (${stars(g, r.max)}*) estados=${r.states} validos=${accepted}/${tried}`,
    );
  });

  if (write) {
    for (const l of levels) {
      writeFileSync(
        join(ROOT, 'assets/levels/classification', `level_${pad(l.id)}.json`),
        JSON.stringify(l, null, 2) + '\n',
      );
    }
    writeFileSync(
      join(ROOT, 'src/engine/__tests__/classificationSolutions.json'),
      JSON.stringify(solutions, null, 2) + '\n',
    );
    console.log('\nNiveles y soluciones escritos.');
  }
}

main();
