// Seeded noise for the generated land: a hash of a lattice point, smooth value noise, and a sum of
// octaves (fbm). Pure functions. The same seed and the same point give the same value.

// A number from 0 to 1 for a lattice point (whole x and y) and a seed.
export function hash2(seed, x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const fade = (t) => t * t * (3 - 2 * t);

// Smooth value noise from 0 to 1 at a point, with lattice points `scale` units apart.
export function valueNoise(seed, x, y, scale = 1) {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fade(fx - x0);
  const ty = fade(fy - y0);
  const a = hash2(seed, x0, y0);
  const b = hash2(seed, x0 + 1, y0);
  const c = hash2(seed, x0, y0 + 1);
  const d = hash2(seed, x0 + 1, y0 + 1);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

// A sum of octaves of value noise, from -1 to 1. Each octave has half the scale and half the
// weight of the octave before it.
export function fbm(seed, x, y, { scale = 32, octaves = 3 } = {}) {
  let sum = 0;
  let weight = 1;
  let total = 0;
  let s = scale;
  for (let i = 0; i < octaves; i++) {
    sum += (valueNoise(seed + i * 1013, x, y, s) * 2 - 1) * weight;
    total += weight;
    weight /= 2;
    s /= 2;
  }
  return sum / total;
}
