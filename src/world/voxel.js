// Voxel grids and the colors of the blocks. Pure functions, no DOM, no WebGL.
// A grid holds one color index for each block (0 is empty). Colors come from the Tre palette.
// Axes: x to the east, y up, z to the south (map y). The ground grid has full blocks; the fine
// grid has half-size blocks for buildings, plants, props, and people.
import { C } from '../render/palette.js';

// Palette names in a fixed order. The index of a color in a grid is its position + 1.
export const COLOR_NAMES = Object.keys(C);
const INDEX = Object.fromEntries(COLOR_NAMES.map((n, i) => [n, i + 1]));

// The index of a color name ('greenPale') or a palette name ('green-pale'). 0 for none.
export function colorIndex(name) {
  if (!name) return 0;
  if (typeof name === 'number') return name;
  const camel = name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
  const i = INDEX[camel];
  if (!i) throw new Error(`Unknown color ${name}`);
  return i;
}

export const colorName = (index) => COLOR_NAMES[index - 1] ?? null;

const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const RGB = [[0, 0, 0], ...COLOR_NAMES.map((n) => hexRgb(C[n]))];
const INK = hexRgb(C.ink);

// The tones of a face: a color mixed with ink. top: 1, lit side: 0.82, dark side: 0.64.
// The same values make the shades in art/palette.json (18 % and 36 % ink).
export const TONES = Object.freeze({ top: 1, lit: 0.82, dark: 0.64, bottom: 0.5, shadow: 0.8 });

export function toneRgb(index, tone) {
  const c = RGB[index] ?? RGB[0];
  return [0, 1, 2].map((k) => c[k] * tone + INK[k] * (1 - tone));
}

// One light from the front-left: the faces that look to +z and -x are lit, the faces that
// look to +x and -z are dark. The light does not turn with the camera.
export const FACE_TONES = Object.freeze({ px: TONES.dark, nx: TONES.lit, py: TONES.top, ny: TONES.bottom, pz: TONES.lit, nz: TONES.dark });

export function createGrid(sx, sy, sz, { owners = false } = {}) {
  const data = new Uint8Array(sx * sy * sz);
  const owner = owners ? new Uint16Array(sx * sy * sz) : null;
  const inside = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < sx && y < sy && z < sz;
  const index = (x, y, z) => (y * sz + z) * sx + x;
  const grid = {
    sx, sy, sz, data, owner, inside, index,
    get: (x, y, z) => (inside(x, y, z) ? data[index(x, y, z)] : 0),
    ownerAt: (x, y, z) => (owner && inside(x, y, z) ? owner[index(x, y, z)] : 0),
    set(x, y, z, color, who = 0) {
      if (!inside(x, y, z)) return;
      const i = index(x, y, z);
      data[i] = colorIndex(color);
      if (owner) owner[i] = data[i] ? who : 0;
    },
    box(x0, y0, z0, x1, y1, z1, color, who = 0) {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) {
          for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) grid.set(x, y, z, color, who);
        }
      }
    },
    // The highest filled block in a column, or -1.
    top(x, z) {
      for (let y = sy - 1; y >= 0; y--) if (grid.get(x, y, z)) return y;
      return -1;
    },
  };
  return grid;
}

// A seeded random number generator for the builders (the same seed gives the same world).
export function seeded(seed) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  const next = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return {
    next,
    range: (a, b) => a + next() * (b - a),
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (p) => next() < p,
  };
}

// A number from a text, for seeds from ids.
export function hashSeed(text) {
  let h = 2166136261;
  for (const ch of String(text)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}
