// Meshes from voxel grids: the faces that can be seen, with flat tones, and the ink lines.
// Pure functions, no WebGL: the result is plain arrays that the renderer puts in buffers.
import { toneRgb, FACE_TONES } from './voxel.js';

// The six faces: the normal, the four corners (counter-clockwise from outside), and the tone.
const FACES = [
  { key: 'px', n: [1, 0, 0], v: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { key: 'nx', n: [-1, 0, 0], v: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { key: 'py', n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { key: 'ny', n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { key: 'pz', n: [0, 0, 1], v: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { key: 'nz', n: [0, 0, -1], v: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];

// Make the mesh of a part of a grid.
// opts: {
//   scale: the size of one block in world units,
//   x0, x1, z0, z1: the part of the grid (block indices, x1 and z1 not included),
//   other(x, y, z): true when a block of another grid fills this place (so the face is hidden),
//   shade(x, y, z): a factor for the color of the top face (for shadows), 1 for none,
//   ink: false to make no ink lines,
//   origin: [x, y, z] in blocks, added to each position (a grid of a part of the world),
//   top(x, y, z): the surface of a top face (six numbers, see surface in src/world/terrain.js), or
//     null; the other faces have zeros,
//   inset(x, z): how much lower the top of a column is drawn (a road on dry land lies a little under
//     the grass beside it; the mesh only), 0 for none. The faces and the lines at the top of the
//     column come down, and the column next to it shows a strip of its side down to it,
//   split(x, z): the top of a column in n x n parts (the edge of a road in quarter blocks), or
//     null: { n, parts: [n * n parts, in rows of x along z] }, each part { c (a color index), drop
//     (as inset), sf (its surface) }. The lines and the steps go where two parts differ.
// }
// Return { positions, colors, owners, indices, segments, segOwners, segOuter, faces, surface } (six
// numbers for each vertex when opts.top is given). Each segment
// is six numbers: the two ends of an ink line. segOwners has the owner of each line, and segOuter
// is 1 for a line on the outline of its owner (the edge meets empty space or another owner) and 0
// for a line inside it (where two colors of the same owner meet, or a fold). A faded object keeps
// only a faint outline.
export function meshGrid(grid, opts = {}) {
  const s = opts.scale ?? 1;
  const x0 = opts.x0 ?? 0;
  const z0 = opts.z0 ?? 0;
  const x1 = opts.x1 ?? grid.sx;
  const z1 = opts.z1 ?? grid.sz;
  const other = opts.other ?? (() => false);
  const shade = opts.shade ?? null;
  const top = opts.top ?? null;
  const inset = opts.inset ?? null;
  const split = opts.split ?? null;
  const shaped = Boolean(inset || split);
  const surface = top ? [] : null;
  const NONE = [0, 0, 0, 0, 0, 0];
  const withInk = opts.ink !== false;
  const [ox, oy, oz] = opts.origin ?? [0, 0, 0];
  const at = grid.get;
  const solid = (x, y, z) => at(x, y, z) > 0 || other(x, y, z);
  const positions = [];
  const colors = [];
  const owners = [];
  const indices = [];
  const segments = [];
  const segOwners = [];
  const segOuter = [];
  const seen = new Map();
  let n = 0;
  let faces = 0;
  const addSeg = (a, b, who, outer) => {
    if (!withInk) return;
    const k1 = `${a[0]},${a[1]},${a[2]}|${b[0]},${b[1]},${b[2]}`;
    const k2 = `${b[0]},${b[1]},${b[2]}|${a[0]},${a[1]},${a[2]}`;
    const i = seen.get(k1) ?? seen.get(k2);
    if (i !== undefined) {
      if (outer) segOuter[i] = 1;
      return;
    }
    seen.set(k1, segOwners.length);
    segments.push((a[0] + ox) * s, (a[1] + oy) * s, (a[2] + oz) * s, (b[0] + ox) * s, (b[1] + oy) * s, (b[2] + oz) * s);
    segOwners.push(who);
    segOuter.push(outer ? 1 : 0);
  };
  const ownerAt = (x, y, z) => (at(x, y, z) > 0 ? grid.ownerAt(x, y, z) : -1);
  // A quad: four corners (counter-clockwise from outside), a color, an owner, and a surface.
  const quad = (corners, rgb, who, sf) => {
    for (const v of corners) {
      positions.push((v[0] + ox) * s, (v[1] + oy) * s, (v[2] + oz) * s);
      colors.push(rgb[0], rgb[1], rgb[2]);
      owners.push(who);
      if (surface) surface.push(...(sf ?? NONE));
    }
    indices.push(n, n + 1, n + 2, n, n + 2, n + 3);
    n += 4;
    faces += 1;
  };
  // A part of a side face: at e on its axis, from a0 to a1 along the edge, from ylo to yhi.
  const sideQuad = (f, e, a0, a1, ylo, yhi, rgb, who) => quad(f.v.map((v) => (f.n[0] ? [e, v[1] ? yhi : ylo, a0 + v[2] * (a1 - a0)] : [a0 + v[0] * (a1 - a0), v[1] ? yhi : ylo, e])), rgb, who, null);
  // A line along a side of a top face (at e on its axis, from a0 to a1, at the height y).
  const edgeLine = (f, e, a0, a1, y, who, outer) => addSeg(f.n[0] ? [e, y, a0] : [a0, y, e], f.n[0] ? [e, y, a1] : [a1, y, e], who, outer);

  // The parts of the top of a column (see opts.split). A column with no split is one part, with
  // the surface of the column (sf undefined).
  const partsOf = (x, y, z) => split?.(x, z) ?? { n: 1, parts: [{ c: at(x, y, z), drop: inset ? inset(x, z) : 0 }] };
  // The part at the step t of R along a side (the parts along the side, in its direction).
  const R = 4;
  const sidePart = (P, f, t) => {
    const k = Math.floor((t * P.n) / R);
    const far = P.n - 1;
    if (f.key === 'px') return P.parts[k * P.n + far];
    if (f.key === 'nx') return P.parts[k * P.n];
    if (f.key === 'pz') return P.parts[far * P.n + k];
    return P.parts[k];
  };
  const OPP = { px: 'nx', nx: 'px', pz: 'nz', nz: 'pz' };
  // Is the top of the column at x, z at the height y (a block of this grid with nothing over it)?
  const topAtY = (x, y, z) => at(x, y, z) > 0 && !solid(x, y + 1, z);
  const SIDES = FACES.filter((f) => !f.n[1]);
  const FACE = Object.fromEntries(FACES.map((f) => [f.key, f]));
  // The runs of equal values along a side in R steps: [from, to (steps), value].
  const runs = (values, eq) => {
    const out = [];
    for (let t = 0; t < values.length; t++) {
      if (out.length && eq(out[out.length - 1][2], values[t])) out[out.length - 1][1] = t + 1;
      else out.push([t, t + 1, values[t]]);
    }
    return out;
  };

  // The top block of a column, when the tops have an inset or a split: its top face (whole or in
  // parts), the steps between parts, and its four sides (whole or in parts).
  function topBlock(x, y, z, c, who) {
    const P = partsOf(x, y, z);
    const n = P.n;
    const own = top ? top(x, y, z) ?? NONE : null;
    const sfOf = (h) => h.sf ?? own;
    const toneTop = FACE_TONES.py * (shade ? shade(x, y, z) : 1);
    const like = (a, b) => a.c === b.c && a.drop === b.drop && sfOf(a) === sfOf(b);
    // The top face: one quad for each run of equal parts in a row.
    for (let j = 0; j < n; j++) {
      for (const [i0, i1, h] of runs(P.parts.slice(j * n, j * n + n), like)) {
        const hy = y + 1 - h.drop;
        const xa = x + i0 / n;
        const xb = x + i1 / n;
        const za = z + j / n;
        const zb = z + (j + 1) / n;
        quad([[xa, hy, zb], [xb, hy, zb], [xb, hy, za], [xa, hy, za]], toneRgb(h.c, toneTop), who, sfOf(h));
      }
    }
    // Between two parts of another color or drop: a line on each, and a step of the side of the
    // higher one down to the lower one.
    if (n > 1) {
      const step = (a, b, key, e, a0, a1) => {
        if (a.c === b.c && a.drop === b.drop) return;
        const f = FACE[a.drop <= b.drop ? key : OPP[key]];
        edgeLine(f, e, a0, a1, y + 1 - a.drop, who, false);
        edgeLine(f, e, a0, a1, y + 1 - b.drop, who, false);
        if (a.drop !== b.drop) {
          const hi = a.drop < b.drop ? a : b;
          const lo = a.drop < b.drop ? b : a;
          sideQuad(f, e, a0, a1, y + 1 - lo.drop, y + 1 - hi.drop, toneRgb(hi.c, FACE_TONES[f.key]), who);
        }
      };
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const a = P.parts[j * n + i];
          if (i + 1 < n) step(a, P.parts[j * n + i + 1], 'px', x + (i + 1) / n, z + j / n, z + (j + 1) / n);
          if (j + 1 < n) step(a, P.parts[(j + 1) * n + i], 'pz', z + (j + 1) / n, x + i / n, x + (i + 1) / n);
        }
      }
    }
    for (const f of SIDES) {
      const nx = x + f.n[0];
      const nz = z + f.n[2];
      const e = f.n[0] ? x + (f.n[0] > 0 ? 1 : 0) : z + (f.n[2] > 0 ? 1 : 0);
      const a0 = f.n[0] ? z : x;
      const outer = ownerAt(nx, y, nz) !== who;
      const next = topAtY(nx, y, nz) ? partsOf(nx, y, nz) : null;
      const steps = n > 1 || next?.n > 1 ? R : 1;
      const mine = Array.from({ length: steps }, (_, t) => sidePart(P, f, (t * R) / steps));
      const theirs = next ? Array.from({ length: steps }, (_, t) => sidePart(next, FACE[OPP[f.key]], (t * R) / steps)) : null;
      // The lines along this side of the top: none where the next top is at the same height, with
      // the same color and drop.
      const lineY = mine.map((h, t) => (theirs && theirs[t].c === h.c && theirs[t].drop === h.drop ? null : y + 1 - h.drop));
      for (const [t0, t1, ly] of runs(lineY, (p, q) => p === q)) if (ly !== null) edgeLine(f, e, a0 + t0 / steps, a0 + t1 / steps, ly, who, outer);
      if (solid(nx, y, nz)) {
        // A strip of the side down to a lower-drawn top next to this one.
        if (theirs) {
          const strip = mine.map((h, t) => (theirs[t].drop > h.drop ? [y + 1 - theirs[t].drop, y + 1 - h.drop, h.c] : null));
          for (const [t0, t1, st] of runs(strip, (p, q) => (p && q ? p[0] === q[0] && p[1] === q[1] && p[2] === q[2] : p === q))) {
            if (st) sideQuad(f, e, a0 + t0 / steps, a0 + t1 / steps, st[0], st[1], toneRgb(st[2], FACE_TONES[f.key]), who);
          }
        }
        continue;
      }
      // An open side: in runs of one height.
      const rgb = toneRgb(c, FACE_TONES[f.key]);
      const heights = runs(mine.map((h) => h.drop), (p, q) => p === q);
      for (const [t0, t1, d] of heights) sideQuad(f, e, a0 + t0 / steps, a0 + t1 / steps, y, y + 1 - d, rgb, who);
      for (let k = 1; k < heights.length; k++) {
        const a = a0 + heights[k][0] / steps;
        addSeg(f.n[0] ? [e, y + 1 - heights[k - 1][2], a] : [a, y + 1 - heights[k - 1][2], e], f.n[0] ? [e, y + 1 - heights[k][2], a] : [a, y + 1 - heights[k][2], e], who, true);
      }
      // The bottom edge and the two ends of the side, as the lines of a whole face.
      const below = [x, y - 1, z];
      if (!(at(...below) === c && !solid(below[0] + f.n[0], below[1], below[2] + f.n[2]))) edgeLine(f, e, a0, a0 + 1, y, who, ownerAt(...below) !== who);
      for (const [end, a, d] of [[-1, a0, mine[0].drop], [1, a0 + 1, mine[steps - 1].drop]]) {
        const w = f.n[0] ? [x, y, z + end] : [x + end, y, z];
        if (at(...w) === c && !solid(w[0] + f.n[0], y, w[2] + f.n[2])) continue;
        addSeg(f.n[0] ? [e, y, a] : [a, y, e], f.n[0] ? [e, y + 1 - d, a] : [a, y + 1 - d, e], who, ownerAt(...w) !== who);
      }
    }
  }

  for (let y = 0; y < grid.sy; y++) {
    for (let z = z0; z < z1; z++) {
      for (let x = x0; x < x1; x++) {
        const c = at(x, y, z);
        if (!c) continue;
        const who = grid.ownerAt(x, y, z);
        const isTop = shaped && !solid(x, y + 1, z);
        if (isTop) topBlock(x, y, z, c, who);
        for (const f of FACES) {
          if (isTop && f.key !== 'ny') continue;
          const [nx, ny, nz] = f.n;
          if (solid(x + nx, y + ny, z + nz)) {
            // A wall next to a lower-drawn top: a strip of its side down to it.
            if (shaped && !ny && topAtY(x + nx, y, z + nz)) {
              const next = partsOf(x + nx, y, z + nz);
              const e = nx ? x + (nx > 0 ? 1 : 0) : z + (nz > 0 ? 1 : 0);
              const a0 = nx ? z : x;
              const steps = next.n > 1 ? R : 1;
              const drops = Array.from({ length: steps }, (_, t) => sidePart(next, FACE[OPP[f.key]], (t * R) / steps).drop);
              for (const [t0, t1, d] of runs(drops, (p, q) => p === q)) if (d > 0) sideQuad(f, e, a0 + t0 / steps, a0 + t1 / steps, y + 1 - d, y + 1, toneRgb(c, FACE_TONES[f.key]), who);
            }
            continue;
          }
          let tone = FACE_TONES[f.key];
          if (f.key === 'py' && shade) tone *= shade(x, y, z);
          const sf = top ? (f.key === 'py' ? top(x, y, z) ?? NONE : NONE) : null;
          quad(f.v.map((v) => [x + v[0], y + v[1], z + v[2]]), toneRgb(c, tone), who, sf);
          if (!withInk) continue;
          // Ink only where the face meets another color, an open edge, or a fold.
          const axis = nx ? 0 : ny ? 1 : 2;
          const out = nx + ny + nz > 0 ? 1 : 0;
          const tangents = [0, 1, 2].filter((a) => a !== axis);
          for (const t of tangents) {
            const u = tangents.find((a) => a !== t);
            for (const side of [0, 1]) {
              const w = [x, y, z];
              w[t] += side ? 1 : -1;
              if (at(w[0], w[1], w[2]) === c && !solid(w[0] + nx, w[1] + ny, w[2] + nz)) continue;
              const a = [x, y, z];
              a[axis] += out;
              a[t] += side;
              const b = [...a];
              b[u] += 1;
              addSeg(a, b, who, ownerAt(w[0], w[1], w[2]) !== who);
            }
          }
        }
      }
    }
  }
  return { positions, colors, owners, indices, segments, segOwners, segOuter, faces, surface };
}

// The chunks of a grid: the parts of `size` blocks in x and z.
export function chunksOf(grid, size) {
  const out = [];
  for (let z = 0; z < grid.sz; z += size) {
    for (let x = 0; x < grid.sx; x += size) out.push({ x0: x, z0: z, x1: Math.min(grid.sx, x + size), z1: Math.min(grid.sz, z + size) });
  }
  return out;
}
