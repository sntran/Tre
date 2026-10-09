// The light of the work and of the hero at dusk and at night (#65). Pure, no DOM.
// At night the child must find the hero and see the work of an open task as in the day: the hero
// has a thin light edge, and each open task has a light of its own (src/ui/village.js draws the
// pools of light in the wash of the dusk).

// The night (0: day, 1: deep night; world.sky.night) from which the hero has a light edge.
export const EDGE_FROM = 0.15;

// The edge of a figure at a night: { tone, k } (a light ink outline, k times as thick), or null.
// Only the hero has one: in the dark, the hero never looks like a black shape.
export function edgeOf(id, night = 0) {
  if (id !== 'hero' || !(night > EDGE_FROM)) return null;
  return { tone: 'yellowPale', k: 2.2 };
}

// The pools of light of the open tasks near the hero (#65): at dusk and at night, the place of an
// open task has a light of its own, which shows the things of the task, the person, and the hero
// in their day colors. entities: the entities of the world (half blocks); hero: the place of the
// hero. Return [{ task, x, y, z, r }]: the middle of the work and the radius of its pool (half
// blocks), for each open task with its work within NEAR of the hero.
export const POOL = Object.freeze({ near: 60, pad: 4, min: 7, max: 24 });
export function taskPools(entities, hero, pool = POOL) {
  const out = [];
  if (!hero) return out;
  for (const tz of entities) {
    // An open gap of the bridge has a light too (#71: at night the child could not see the planks
    // for the guess): its gap, its planks, and the planks for the guess.
    if (tz.zone?.rule === 'span' && !tz.zone.set && !tz.zone.shut && tz.position) {
      const z = tz.zone;
      const pts = [tz.position, { x: z.lane, y: z.deckY, z: z.from }, { x: z.lane, y: z.deckY, z: z.from + z.gap }];
      for (const e of entities) {
        if (((e.item && e.item.task === z.id && !e.item.held) || (e.guess && e.guess.zone === z.id)) && e.position && !e.hidden) pts.push(e.position);
      }
      const p = poolOf(z.id, pts, hero, pool);
      if (p) out.push(p);
      continue;
    }
    if (tz.zone?.rule !== 'trial' || tz.zone.done || !tz.position) continue;
    const owner = tz.zone.id;
    const pts = [tz.position];
    for (const e of entities) {
      if (e.zone && e.zone.task === owner && e.position) {
        pts.push(e.position);
        const r = e.zone.rect;
        if (r) pts.push({ x: r.x0, y: e.position.y, z: r.z0 }, { x: r.x1, y: e.position.y, z: r.z1 });
      } else if (e.item && e.item.task === owner && !e.item.held && e.position && !e.hidden) {
        pts.push(e.position);
        // A long thing (the stem of the woodcutter) lies along +x from its place.
        if (e.item.fixed && e.item.size) pts.push({ ...e.position, x: e.position.x + e.item.size });
      }
    }
    const p = poolOf(owner, pts, hero, pool);
    if (p) out.push(p);
  }
  return out;
}

// The pool of light around the points of a task, or null when it is too far from the hero.
function poolOf(task, pts, hero, pool) {
  const xs = pts.map((p) => p.x);
  const zs = pts.map((p) => p.z);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const z0 = Math.min(...zs);
  const z1 = Math.max(...zs);
  const mid = { x: (x0 + x1) / 2, z: (z0 + z1) / 2 };
  if (Math.hypot(mid.x - hero.x, mid.z - hero.z) > pool.near) return null;
  const y = Math.min(...pts.map((p) => p.y ?? 0));
  const r = Math.max(pool.min, Math.min(pool.max, Math.hypot(x1 - x0, z1 - z0) / 2 + pool.pad));
  return { task, x: mid.x, y, z: mid.z, r };
}
