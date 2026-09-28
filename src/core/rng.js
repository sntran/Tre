// Seeded random numbers (mulberry32). The same seed gives the same numbers,
// so tests can repeat a problem and two players get fair problems.

// Make a 32-bit seed from a string or a number.
export function hashSeed(value) {
  const text = String(value);
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

export function createRng(seed = 1) {
  let state = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);

  // A number from 0 (included) to 1 (not included).
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // An integer from min to max. The two ends are included.
  function int(min, max) {
    if (max < min) throw new RangeError(`int(${min}, ${max}): max is less than min`);
    return min + Math.floor(next() * (max - min + 1));
  }

  function pick(list) {
    if (list.length === 0) throw new RangeError('pick() from an empty list');
    return list[Math.floor(next() * list.length)];
  }

  // Pick an item. Each item has a weight from weightOf(item).
  function weighted(list, weightOf) {
    const weights = list.map(weightOf);
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) return pick(list);
    let r = next() * total;
    for (let i = 0; i < list.length; i++) {
      r -= weights[i];
      if (r < 0) return list[i];
    }
    return list[list.length - 1];
  }

  // Return a shuffled copy. The input list does not change.
  function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function chance(p) {
    return next() < p;
  }

  // Make a separate generator for a named task, for example "player2".
  function fork(label) {
    return createRng(hashSeed(`${state}:${label}`));
  }

  return {
    next, int, pick, weighted, shuffle, chance, fork,
    get state() { return state; },
    set state(value) { state = value >>> 0; },
  };
}
