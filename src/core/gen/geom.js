// Geometry for the generated land: distance fields, a heap for A*, and lines (points on a line,
// more points, a seeded bend). Pure functions.
import { fbm } from './noise.js';

// The distance (cells) from each cell to the nearest source cell, and the index of that source.
// Two passes over the grid with the nearest source of the neighbors (close to the true distance).
export function distanceField(w, h, isSource) {
  const near = new Int32Array(w * h).fill(-1);
  const dist = new Float32Array(w * h).fill(Infinity);
  for (let i = 0; i < w * h; i++) if (isSource(i)) {
    near[i] = i;
    dist[i] = 0;
  }
  const check = (i, j) => {
    const s = near[j];
    if (s < 0) return;
    const dx = (i % w) - (s % w);
    const dy = Math.floor(i / w) - Math.floor(s / w);
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < dist[i]) {
      dist[i] = d;
      near[i] = s;
    }
  };
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x > 0) check(i, i - 1);
      if (y > 0) {
        check(i, i - w);
        if (x > 0) check(i, i - w - 1);
        if (x < w - 1) check(i, i - w + 1);
      }
    }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (x < w - 1) check(i, i + 1);
      if (y < h - 1) {
        check(i, i + w);
        if (x < w - 1) check(i, i + w + 1);
        if (x > 0) check(i, i + w - 1);
      }
    }
  }
  return { dist, near };
}

// A small binary heap of cells by a score, for A*.
export function createHeap() {
  const items = [];
  const keys = [];
  const swap = (a, b) => {
    [items[a], items[b]] = [items[b], items[a]];
    [keys[a], keys[b]] = [keys[b], keys[a]];
  };
  return {
    get size() { return items.length; },
    push(item, key) {
      items.push(item);
      keys.push(key);
      for (let i = items.length - 1; i > 0;) {
        const p = (i - 1) >> 1;
        if (keys[p] <= keys[i]) break;
        swap(p, i);
        i = p;
      }
    },
    pop() {
      const top = items[0];
      const lastItem = items.pop();
      const lastKey = keys.pop();
      if (items.length) {
        items[0] = lastItem;
        keys[0] = lastKey;
        for (let i = 0; ;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < items.length && keys[l] < keys[m]) m = l;
          if (r < items.length && keys[r] < keys[m]) m = r;
          if (m === i) break;
          swap(m, i);
          i = m;
        }
      }
      return top;
    },
  };
}

// The distance from a point to a segment, and the place along it (0 to 1).
export function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

// Put a point on a line of coordinates (where it is nearest), so that the line goes through it.
export function withPoint(line, p) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const d = segDist(p[0], p[1], ...line[i], ...line[i + 1]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return [...line.slice(0, best + 1), p, ...line.slice(best + 1)];
}

// More points on a line, so that no part is longer than `step`.
export function dense(line, step) {
  const out = [line[0]];
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1];
    const [bx, by] = line[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return out;
}

// A line that winds: each point moves to the side by the noise at its place along the line,
// times the weight of the point (0: the point stays).
export function wind(line, seed, amp, scale, weight) {
  let s = 0;
  return line.map((p, i) => {
    if (i > 0) s += Math.hypot(p[0] - line[i - 1][0], p[1] - line[i - 1][1]);
    const a = line[Math.max(0, i - 1)];
    const b = line[Math.min(line.length - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const off = fbm(seed, s, 0, { scale, octaves: 2 }) * amp * weight(p, i);
    return [p[0] - ((b[1] - a[1]) / len) * off, p[1] + ((b[0] - a[0]) / len) * off];
  });
}

