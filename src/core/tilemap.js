// A tile map with layers, a collision grid, and A* pathfinding.
// data: { width, height, legend, layers: { ground: [rows], height: [rows], objects, collision } }.
// Ground rows have one letter for each tile (see legend). Height rows have one digit of base 36
// for each tile (0 to 9, then a to z): the height of the ground in steps. Objects block their
// footprint.
// The hero can step up or down one step. A higher step is a cliff.
// Collision rectangles block tiles (block: true) or open them (block: false).

export function createTileMap(data, tileTypes) {
  const { width, height } = data;
  const layers = data.layers ?? {};
  const types = [];
  for (let y = 0; y < height; y++) {
    const row = layers.ground?.[y] ?? '';
    for (let x = 0; x < width; x++) {
      const ch = row[x] ?? data.fill ?? '.';
      const type = data.legend[ch];
      if (!type) throw new Error(`Unknown tile "${ch}" at ${x},${y}`);
      types.push(type);
    }
  }
  const heights = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const row = layers.height?.[y] ?? '';
    for (let x = 0; x < width; x++) heights[y * width + x] = parseInt(row[x] ?? '0', 36) || 0;
  }
  const inside = (x, y) => x >= 0 && y >= 0 && x < width && y < height;
  const index = (x, y) => y * width + x;
  const solid = new Uint8Array(width * height);
  for (let i = 0; i < types.length; i++) solid[i] = tileTypes[types[i]]?.walk ? 0 : 1;
  for (const obj of layers.objects ?? []) {
    for (const [dx, dy] of footprint(obj)) {
      if (inside(obj.x + dx, obj.y + dy)) solid[index(obj.x + dx, obj.y + dy)] = 1;
    }
  }
  for (const r of layers.collision ?? []) {
    for (let y = r.y; y < r.y + (r.h ?? 1); y++) {
      for (let x = r.x; x < r.x + (r.w ?? 1); x++) if (inside(x, y)) solid[index(x, y)] = r.block === false ? 0 : 1;
    }
  }
  // The collision of the map, before any change in play.
  const base = solid.slice();
  // Tiles that people or enemies stand on. They change during play.
  const occupied = new Map();

  return {
    width,
    height,
    inside,
    type: (x, y) => (inside(x, y) ? types[index(x, y)] : null),
    // A tile is walkable when the ground is walkable, no object is on it, and nobody stands on it.
    walkable: (x, y) => inside(x, y) && !solid[index(x, y)] && !occupied.has(index(x, y)),
    solidAt: (x, y) => !inside(x, y) || solid[index(x, y)] === 1,
    // For free movement: people do not block here, because they are circles, not tiles.
    isBlocked: (x, y) => !inside(x, y) || solid[index(x, y)] === 1,
    groundAt: (x, y) => (inside(x, y) ? types[index(x, y)] : null),
    heightAt: (x, y) => (inside(x, y) ? heights[index(x, y)] : 0),
    // Can a person walk from one tile to the next? Only up or down one step.
    canStep: (ax, ay, bx, by) => Math.abs(heights[index(ax, ay)] - heights[index(bx, by)]) <= 1,
    // The world can change: for example a finished bridge opens its tiles.
    setSolid: (x, y, on) => { if (inside(x, y)) solid[index(x, y)] = on ? 1 : 0; },
    // Give a tile the collision of the map back.
    resetSolid: (x, y) => { if (inside(x, y)) solid[index(x, y)] = base[index(x, y)]; },
    occupy: (x, y, who) => occupied.set(index(x, y), who),
    free: (x, y) => occupied.delete(index(x, y)),
    whoAt: (x, y) => occupied.get(index(x, y)) ?? null,
    clearOccupied: () => occupied.clear(),
  };
}

// The tile map of a map on the plane (src/world/regions.js): the same use as createTileMap, for a
// land that has no end. The cells come from the tiles of the land (src/core/gen/tiles.js), made
// when they are first asked for; a tile that cannot be made yet (its height tiles are not there)
// is not inside, so nobody walks onto it. Out of the land of the era, the hero walks into the mist
// only a few cells (map.mist.walk), and the deep sea blocks. Objects and collision rectangles block
// as in createTileMap; gone(object): an object that the player took away. An index of a cell is
// y * map.width + x.
export function createPlaneTileMap(map, tileTypes, { size = 64, gone = () => false } = {}) {
  const { width, height, land, legend } = map;
  const walkMist = map.mist?.walk ?? 4;
  const types = new Map(); // letter code -> type
  const typeOf = (code) => {
    if (!types.has(code)) types.set(code, legend[String.fromCharCode(code)] ?? 'grass');
    return types.get(code);
  };
  const index = (x, y) => y * width + x;
  const ok = (x, y) => x >= 0 && y >= 0 && x < width && y < height;
  // The collision of each tile (the last ones stay). The land of a tile comes from the land.
  const cache = new Map();
  const MAX = 160;
  function solidOf(tx, tz, lt) {
    const key = `${tx},${tz}`;
    let solid = cache.get(key);
    if (solid) {
      cache.delete(key);
      cache.set(key, solid);
      return solid;
    }
    const x0 = tx * size;
    const z0 = tz * size;
    solid = new Uint8Array(size * size);
    for (let i = 0; i < size * size; i++) solid[i] = tileTypes[typeOf(lt.letter[i])]?.walk && lt.mist[i] <= walkMist ? 0 : 1;
    const mark = (x, y, on) => {
      if (x >= x0 && y >= z0 && x < x0 + size && y < z0 + size) solid[(y - z0) * size + (x - x0)] = on;
    };
    for (const o of map.objectsNear(x0, z0, x0 + size, z0 + size)) if (!gone(o)) for (const [dx, dy] of footprint(o)) mark(o.x + dx, o.y + dy, 1);
    for (const r of map.layers.collision ?? []) {
      if (r.x >= x0 + size || r.y >= z0 + size || r.x + (r.w ?? 1) <= x0 || r.y + (r.h ?? 1) <= z0) continue;
      for (let y = r.y; y < r.y + (r.h ?? 1); y++) for (let x = r.x; x < r.x + (r.w ?? 1); x++) mark(x, y, r.block === false ? 0 : 1);
    }
    cache.set(key, solid);
    if (cache.size > MAX) cache.delete(cache.keys().next().value);
    return solid;
  }
  // The land tile of a cell, or null (out of the plane, or not made yet). The tiles that were
  // asked for last stay at hand (a cell is asked for many times in a step).
  const near = new Map(); // tx * size + tz -> land tile
  const at = (x, y) => {
    if (!ok(x, y)) return null;
    const tx = Math.floor(x / size);
    const tz = Math.floor(y / size);
    const k = tx * 65536 + tz;
    let t = near.get(k);
    if (t && land.has(tx, tz)) return t;
    t = map.ready(tx, tz) ? land.tile(tx, tz) : null;
    if (t) {
      if (near.size > 16) near.clear();
      near.set(k, t);
    }
    return t;
  };
  const cellOf = (x, y) => (y - Math.floor(y / size) * size) * size + (x - Math.floor(x / size) * size);
  const inside = (x, y) => Boolean(at(x, y));
  // The changes of the collision in play (a ford, the deck of a bridge, a felled tree).
  const set = new Map();
  const isSolid = (x, y) => {
    const lt = at(x, y);
    if (!lt) return true;
    const k = index(x, y);
    return set.has(k) ? set.get(k) === 1 : solidOf(Math.floor(x / size), Math.floor(y / size), lt)[cellOf(x, y)] === 1;
  };
  const occupied = new Map();
  const type = (x, y) => {
    const t = at(x, y);
    return t ? typeOf(t.letter[cellOf(x, y)]) : null;
  };
  const heightAt = (x, y) => {
    const t = at(x, y);
    return t ? t.level[cellOf(x, y)] : 0;
  };
  return {
    width,
    height,
    plane: true,
    inside,
    type,
    walkable: (x, y) => !isSolid(x, y) && !occupied.has(index(x, y)),
    solidAt: isSolid,
    isBlocked: isSolid,
    groundAt: type,
    heightAt,
    // How deep a cell is in the mist (cells out of the land of the era; 0 in it).
    mistAt: (x, y) => {
      const t = at(x, y);
      return t ? t.mist[cellOf(x, y)] : 0;
    },
    canStep: (ax, ay, bx, by) => Math.abs(heightAt(ax, ay) - heightAt(bx, by)) <= 1,
    setSolid: (x, y, on) => { if (ok(x, y)) set.set(index(x, y), on ? 1 : 0); },
    resetSolid: (x, y) => { set.delete(index(x, y)); },
    occupy: (x, y, who) => occupied.set(index(x, y), who),
    free: (x, y) => occupied.delete(index(x, y)),
    whoAt: (x, y) => occupied.get(index(x, y)) ?? null,
    clearOccupied: () => occupied.clear(),
  };
}

// The tiles that an object blocks, relative to its top-left tile.
// obj.solid can be a list of [dx, dy], or false for no block.
export function footprint(obj) {
  if (obj.solid === false) return [];
  if (Array.isArray(obj.solid)) return obj.solid;
  const out = [];
  for (let dy = 0; dy < (obj.h ?? 1); dy++) for (let dx = 0; dx < (obj.w ?? 1); dx++) out.push([dx, dy]);
  return out;
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// A small binary heap for the open list of A*.
function createHeap(score) {
  const items = [];
  const up = (i) => {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (score(items[p]) <= score(items[i])) break;
      [items[p], items[i]] = [items[i], items[p]];
      i = p;
    }
  };
  const down = (i) => {
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < items.length && score(items[l]) < score(items[m])) m = l;
      if (r < items.length && score(items[r]) < score(items[m])) m = r;
      if (m === i) break;
      [items[m], items[i]] = [items[i], items[m]];
      i = m;
    }
  };
  return {
    push(v) { items.push(v); up(items.length - 1); },
    pop() {
      const top = items[0];
      const last = items.pop();
      if (items.length) { items[0] = last; down(0); }
      return top;
    },
    get size() { return items.length; },
  };
}

// A* from start to goal. Return the list of tiles after the start, up to the goal,
// or null when no path exists. The start tile does not need to be walkable. With nearest, a goal
// out of reach (or past maxNodes) gives the path to the tile nearest to the goal that the search
// found, for a far walk in legs (#53).
export function findPath(map, start, goal, { maxNodes = 5000, nearest = false } = {}) {
  if (!nearest && (!map.inside(goal.x, goal.y) || !map.walkable(goal.x, goal.y))) return null;
  if (start.x === goal.x && start.y === goal.y) return [];
  const w = map.width;
  const key = (x, y) => y * w + x;
  const g = new Map([[key(start.x, start.y), 0]]);
  const from = new Map();
  const h = (x, y) => Math.abs(x - goal.x) + Math.abs(y - goal.y);
  // The small extra number prefers nodes near the goal when scores are equal.
  const open = createHeap((n) => n.f + n.h * 1e-3);
  open.push({ x: start.x, y: start.y, f: h(start.x, start.y), h: h(start.x, start.y) });
  const closed = new Set();
  const trace = (k) => {
    const path = [];
    let c = k;
    while (c !== key(start.x, start.y)) {
      path.push({ x: c % w, y: Math.floor(c / w) });
      c = from.get(c);
    }
    return path.reverse();
  };
  let best = null;
  let count = 0;
  while (open.size) {
    const node = open.pop();
    const k = key(node.x, node.y);
    if (closed.has(k)) continue;
    closed.add(k);
    if (node.x === goal.x && node.y === goal.y) return trace(k);
    if (nearest && (!best || node.h < best.h)) best = { k, h: node.h };
    if (++count > maxNodes) break;
    for (const [dx, dy] of DIRS) {
      const nx = node.x + dx;
      const ny = node.y + dy;
      if (!map.walkable(nx, ny)) continue;
      if (map.canStep && map.inside(node.x, node.y) && !map.canStep(node.x, node.y, nx, ny)) continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const ng = g.get(k) + 1;
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        from.set(nk, k);
        const hh = h(nx, ny);
        open.push({ x: nx, y: ny, f: ng + hh, h: hh });
      }
    }
  }
  return nearest && best ? trace(best.k) : null;
}

// A path to stand next to a blocked tile (for example a person).
// Return the shortest path to any walkable tile beside the target, or null.
export function pathNextTo(map, start, target) {
  let best = null;
  for (const [dx, dy] of DIRS) {
    const x = target.x + dx;
    const y = target.y + dy;
    if (x === start.x && y === start.y) return [];
    const path = findPath(map, start, { x, y });
    if (path && (best === null || path.length < best.length)) best = path;
  }
  return best;
}
