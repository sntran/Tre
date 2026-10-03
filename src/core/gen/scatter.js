// Scatter by rule: trees, bamboo, banana plants, rocks, haystacks, tall grass, and animals on the
// free land of a region, never in a grid. Each kind has its own spacing and its rules: the ground,
// the height, the distance to water, to roads, and to the paddies, and a patch noise (groves, not
// an even spread). The rules are in data/world/scatter.json. The samples are local: each cell has a
// seeded priority, and a thing stands at a cell where the rules let it stand and no other such
// cell within the spacing has a higher priority. So no two things of a kind are nearer than the
// spacing, and the same seed and the same cell give the same things, whatever part of the land
// was made before (the land can be made in chunks). Pure functions.
import { hashSeed } from '../rng.js';
import { fbm, hash2 } from './noise.js';

// Local samples in a box (w x h cells, at ox, oy on the plane): the cells where ok(x, y) is true
// and whose priority is the highest of all such cells within r. The priority of a cell comes from
// the seed and the cell on the plane, so a part of the land made alone has the same samples (away
// from its edges). x and y are in the box.
export function localSamples(w, h, r, ok, seed, ox = 0, oy = 0) {
  const valid = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ok(x, y)) valid[y * w + x] = 1;
  const pri = (x, y) => hash2(seed, x + ox, y + oy);
  const out = [];
  const R = Math.ceil(r);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!valid[y * w + x]) continue;
      const p = pri(x, y);
      let best = true;
      for (let dy = -R; dy <= R && best; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          if ((!dx && !dy) || dx * dx + dy * dy >= r * r) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || !valid[ny * w + nx]) continue;
          const q = pri(nx, ny);
          // Equal priorities: the first cell in reading order wins.
          if (q > p || (q === p && (ny < y || (ny === y && nx < x)))) {
            best = false;
            break;
          }
        }
      }
      if (best) out.push([x, y]);
    }
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
  // A seeded number from 0 to 1 for a cell and a name (the chance, the seed, and the count of a thing).
  const roll = (name, x, y) => hash2(hashSeed(`${seed}:${name}`) & 0x7fffffff, x, y);
  const objects = [];
  const life = [];
  (rules.props ?? []).forEach((rule, ri) => {
    const name = `scatter:${rule.prop}:${ri}`;
    const patch = rule.patch ? hashSeed(`${seed}:patch:${rule.prop}`) & 0x7fffffff : 0;
    // A footprint of size x size cells, or [w, h] (a boat). The thing at a cell has its footprint
    // from that cell.
    const [sw, sh] = Array.isArray(rule.size) ? rule.size : [rule.size ?? 2, rule.size ?? 2];
    const stands = (bx, by) => {
      const x = x0 + bx;
      const y = y0 + by;
      if (rule.patch && fbm(patch, x, y, { scale: rule.patch.scale, octaves: 2 }) < rule.patch.over) return false;
      if (rule.chance !== undefined && roll(`${name}:chance`, x, y) >= rule.chance) return false;
      const first = land.cell(x, y);
      if (!first) return false;
      const m = maps[first.map];
      for (let dy = -1; dy <= sh; dy++) {
        for (let dx = -1; dx <= sw; dx++) {
          const edge = dx < 0 || dy < 0 || dx === sw || dy === sh;
          // The footprint fits the rule; one cell around it stays free of the things of the kinds
          // before, so that the land between two things is open to walk.
          if (taken.has(key(x + dx, y + dy))) return false;
          if (!edge && (!inside(m, x + dx, y + dy) || !fits(rule, land.cell(x + dx, y + dy)))) return false;
        }
      }
      return true;
    };
    const found = localSamples(w, h, rule.spacing, stands, hashSeed(`${seed}:${name}`) & 0x7fffffff, x0, y0);
    for (const [bx, by] of found) {
      const x = x0 + bx;
      const y = y0 + by;
      objects.push({ map: land.cell(x, y).map, prop: rule.prop, x, y, w: sw, h: sh, seed: 1 + Math.floor(roll(`${name}:seed`, x, y) * 2147483645) });
    }
    for (const o of objects.slice(objects.length - found.length)) for (let dy = 0; dy < o.h; dy++) for (let dx = 0; dx < o.w; dx++) taken.add(key(o.x + dx, o.y + dy));
  });
  (rules.life ?? []).forEach((rule, ri) => {
    const name = `life:${rule.kind}:${ri}`;
    const ok = (bx, by) => {
      const x = x0 + bx;
      const y = y0 + by;
      const c = land.cell(x, y);
      if (!c || !fits(rule, c) || taken.has(key(x, y)) || !inside(maps[c.map], x, y)) return false;
      return rule.chance === undefined || roll(`${name}:chance`, x, y) < rule.chance;
    };
    for (const [bx, by] of localSamples(w, h, rule.spacing, ok, hashSeed(`${seed}:${name}`) & 0x7fffffff, x0, y0)) {
      const x = x0 + bx;
      const y = y0 + by;
      const n = rule.n[0] + Math.floor(roll(`${name}:n`, x, y) * (rule.n[1] - rule.n[0] + 1));
      life.push({ map: land.cell(x, y).map, kind: rule.kind, n, x: x + 0.5, y: y + 0.5, r: rule.r ?? 2 });
    }
  });
  return { objects, life };
}
