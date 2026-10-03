// Scatter by rule: trees, bamboo, banana plants, rocks, haystacks, tall grass, and animals on the
// free land of a region, never in a grid. Each kind has its own spacing (Poisson-disk samples: no
// two samples of a kind are nearer than the spacing) and its rules: the ground, the height, the
// distance to water, to roads, and to the paddies, and a patch noise (groves, not an even spread).
// The rules are in data/world/scatter.json. The same seed gives the same things. Pure functions.
import { createRng, hashSeed } from '../rng.js';
import { fbm } from './noise.js';

// Poisson-disk samples in a box (w x h) with no two nearer than r (Bridson).
export function poissonDisk(rng, w, h, r, tries = 20) {
  const size = r / Math.SQRT2;
  const gw = Math.ceil(w / size);
  const gh = Math.ceil(h / size);
  const grid = new Int32Array(gw * gh).fill(-1);
  const out = [];
  const active = [];
  const put = (p) => {
    grid[Math.floor(p[1] / size) * gw + Math.floor(p[0] / size)] = out.length;
    out.push(p);
    active.push(p);
  };
  const free = (p) => {
    const gx = Math.floor(p[0] / size);
    const gy = Math.floor(p[1] / size);
    for (let y = Math.max(0, gy - 2); y <= Math.min(gh - 1, gy + 2); y++) {
      for (let x = Math.max(0, gx - 2); x <= Math.min(gw - 1, gx + 2); x++) {
        const k = grid[y * gw + x];
        if (k >= 0 && Math.hypot(out[k][0] - p[0], out[k][1] - p[1]) < r) return false;
      }
    }
    return true;
  };
  put([rng.next() * w, rng.next() * h]);
  while (active.length) {
    const i = Math.floor(rng.next() * active.length);
    const c = active[i];
    let found = false;
    for (let k = 0; k < tries; k++) {
      const a = rng.next() * Math.PI * 2;
      const d = r * (1 + rng.next());
      const p = [c[0] + Math.cos(a) * d, c[1] + Math.sin(a) * d];
      if (p[0] < 0 || p[1] < 0 || p[0] >= w || p[1] >= h || !free(p)) continue;
      put(p);
      found = true;
      break;
    }
    if (!found) active.splice(i, 1);
  }
  return out;
}

const inRange = (v, range) => !range || (v >= range[0] && v <= range[1]);

// Does a rule let a thing stand on this cell (land.cell)?
export function fits(rule, c) {
  return Boolean(c) && !c.stamp && !c.taken && !c.edge && (rule.on ?? ['.']).includes(c.letter) && inRange(c.level, rule.level) && inRange(c.water, rule.water) && inRange(c.road, rule.road) && inRange(c.field, rule.field);
}

// land: createLand(). rules: data/world/scatter.json. maps: the maps of the region (for the
// windows). Return { objects: [{ map, prop, x, y, w, h, seed }], life: [{ map, kind, n, x, y, r }] }
// in region cells; one list for the whole region.
export function scatter(land, rules, maps, seed) {
  const { x0, y0, w, h } = land.box;
  const taken = new Set();
  const key = (x, y) => `${x},${y}`;
  const margin = rules.margin ?? 3; // cells from the edge of a map, so that the edges stay open
  const inside = (m, x, y) => x >= m.window.x + margin && y >= m.window.y + margin && x < m.window.x + m.width - margin && y < m.window.y + m.height - margin;
  const objects = [];
  const life = [];
  (rules.props ?? []).forEach((rule, ri) => {
    const rng = createRng(hashSeed(`${seed}:scatter:${rule.prop}:${ri}`));
    const patch = rule.patch ? hashSeed(`${seed}:patch:${rule.prop}`) & 0x7fffffff : 0;
    // A footprint of size x size cells, or [w, h] (a boat).
    const [sw, sh] = Array.isArray(rule.size) ? rule.size : [rule.size ?? 2, rule.size ?? 2];
    for (const [px, py] of poissonDisk(rng, w, h, rule.spacing)) {
      const x = x0 + Math.floor(px - sw / 2);
      const y = y0 + Math.floor(py - sh / 2);
      if (rule.patch && fbm(patch, x, y, { scale: rule.patch.scale, octaves: 2 }) < rule.patch.over) continue;
      if (rule.chance !== undefined && !rng.chance(rule.chance)) continue;
      const first = land.cell(x, y);
      if (!first) continue;
      const m = maps[first.map];
      let ok = true;
      for (let dy = -1; dy <= sh && ok; dy++) {
        for (let dx = -1; dx <= sw; dx++) {
          const edge = dx < 0 || dy < 0 || dx === sw || dy === sh;
          // The footprint fits the rule; one cell around it stays free, so that the land between
          // two things is open to walk.
          if (taken.has(key(x + dx, y + dy)) || (!edge && (!inside(m, x + dx, y + dy) || !fits(rule, land.cell(x + dx, y + dy))))) {
            ok = false;
            break;
          }
        }
      }
      if (!ok) continue;
      for (let dy = 0; dy < sh; dy++) for (let dx = 0; dx < sw; dx++) taken.add(key(x + dx, y + dy));
      objects.push({ map: first.map, prop: rule.prop, x, y, w: sw, h: sh, seed: rng.int(1, 2147483646) });
    }
  });
  (rules.life ?? []).forEach((rule, ri) => {
    const rng = createRng(hashSeed(`${seed}:life:${rule.kind}:${ri}`));
    for (const [px, py] of poissonDisk(rng, w, h, rule.spacing)) {
      const x = x0 + Math.floor(px);
      const y = y0 + Math.floor(py);
      const c = land.cell(x, y);
      if (!c || !fits(rule, c) || taken.has(key(x, y)) || !inside(maps[c.map], x, y)) continue;
      if (rule.chance !== undefined && !rng.chance(rule.chance)) continue;
      life.push({ map: c.map, kind: rule.kind, n: rng.int(rule.n[0], rule.n[1]), x: x + 0.5, y: y + 0.5, r: rule.r ?? 2 });
    }
  });
  return { objects, life };
}
