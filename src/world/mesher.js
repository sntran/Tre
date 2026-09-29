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
// }
// Return { positions, colors, owners, indices, segments, segOwners, segOuter, faces }. Each segment
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
  const withInk = opts.ink !== false;
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
    const k1 = `${a[0]},${a[1]},${a[2]}|${b[0]},${b[1]},${b[2]}`;
    const k2 = `${b[0]},${b[1]},${b[2]}|${a[0]},${a[1]},${a[2]}`;
    const i = seen.get(k1) ?? seen.get(k2);
    if (i !== undefined) {
      if (outer) segOuter[i] = 1;
      return;
    }
    seen.set(k1, segOwners.length);
    segments.push(a[0] * s, a[1] * s, a[2] * s, b[0] * s, b[1] * s, b[2] * s);
    segOwners.push(who);
    segOuter.push(outer ? 1 : 0);
  };
  const ownerAt = (x, y, z) => (at(x, y, z) > 0 ? grid.ownerAt(x, y, z) : -1);
  for (let y = 0; y < grid.sy; y++) {
    for (let z = z0; z < z1; z++) {
      for (let x = x0; x < x1; x++) {
        const c = at(x, y, z);
        if (!c) continue;
        const who = grid.ownerAt(x, y, z);
        for (const f of FACES) {
          const [nx, ny, nz] = f.n;
          if (solid(x + nx, y + ny, z + nz)) continue;
          faces += 1;
          let tone = FACE_TONES[f.key];
          if (f.key === 'py' && shade) tone *= shade(x, y, z);
          const [r, g, b] = toneRgb(c, tone);
          for (const v of f.v) {
            positions.push((x + v[0]) * s, (y + v[1]) * s, (z + v[2]) * s);
            colors.push(r, g, b);
            owners.push(who);
          }
          indices.push(n, n + 1, n + 2, n, n + 2, n + 3);
          n += 4;
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
  return { positions, colors, owners, indices, segments, segOwners, segOuter, faces };
}

// The chunks of a grid: the parts of `size` blocks in x and z.
export function chunksOf(grid, size) {
  const out = [];
  for (let z = 0; z < grid.sz; z += size) {
    for (let x = 0; x < grid.sx; x += size) out.push({ x0: x, z0: z, x1: Math.min(grid.sx, x + size), z1: Math.min(grid.sz, z + size) });
  }
  return out;
}
