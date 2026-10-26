// The minimap (#8): a small round map in the corner that shows the near places, turned as the view
// is turned, so that up on the minimap is away from the camera, as up on the screen. Pure: cells in,
// minimap pixels out; the village (src/ui/village.js) draws it.

export const MINI = Object.freeze({ radius: 22, size: 76 }); // cells around the hero; pixels across

// A point near the hero (dx, dz in cells, x east and z south) on the minimap (pixels from its middle,
// x to the right and y down), for the angle az of the view (src/world/view.js: the right of the
// screen is (cos az, -sin az) on the ground, and the camera is at (sin az, cos az)).
export function toMini(dx, dz, az, scale = MINI.size / (2 * MINI.radius)) {
  return {
    x: (dx * Math.cos(az) - dz * Math.sin(az)) * scale,
    y: (dx * Math.sin(az) + dz * Math.cos(az)) * scale,
  };
}

// The colors (palette names) of the kinds of ground, flat as on a print. A solid cell that is not
// water is a house or a wall.
const KINDS = {
  water: 'indigoPale', sea: 'indigoPale', surf: 'indigoPale', shallow: 'indigoPale', ditch: 'indigoPale',
  path: 'yellowPale', yard: 'yellowPale', bridge: 'wood', dike: 'yellowPale', sand: 'yellowPale',
  field: 'green', bamboo: 'greenDeep', hedge: 'greenDeep', 'hedge-low': 'greenDeep',
  grass: 'greenPale', flowers: 'greenPale', rock: 'ash',
};
export function miniKind(type, solid = false) {
  const water = ['water', 'sea', 'surf', 'shallow', 'ditch'].includes(type);
  if (solid && !water && type !== 'bamboo' && type !== 'hedge' && type !== 'hedge-low') return 'ink';
  return KINDS[type] ?? 'paperDeep';
}

// Is a point (dx, dz in cells) on the round minimap?
export const onMini = (dx, dz, radius = MINI.radius) => dx * dx + dz * dz <= radius * radius;

// The map of the village (#139: "it doesn't show me where the people in the village are"): a tap on
// the minimap opens it. North is up, as on the map of the country. It shows the ground around the
// hero, the faces of the people, the stars, and the hero; a tap on a face walks there, as a marker
// does. The items in the square of the map: [{ kind: 'person' | 'star' | 'hero', id, who, u, v }]
// with u, v from 0 to 1 (left to right, top to bottom). persons: [{ kind, ref, entity, x, y }] in
// cells; stars: [{ x, y, id, who }].
export const VILLAGE = Object.freeze({ radius: 34 }); // cells from the hero to the edge of the map
export function villageMapItems(hero, persons, stars, radius = VILLAGE.radius) {
  const at = (x, y) => ({ u: (x - hero.x + radius) / (2 * radius), v: (y - hero.y + radius) / (2 * radius) });
  const inside = (q) => q.u >= 0 && q.u <= 1 && q.v >= 0 && q.v <= 1;
  const out = [];
  for (const p of persons) {
    if (p.kind !== 'npc') continue;
    const q = at(p.x, p.y);
    if (inside(q)) out.push({ kind: 'person', id: p.entity, who: p.ref, ...q });
  }
  for (const m of stars) {
    const q = at(m.x, m.y);
    if (inside(q)) out.push({ kind: 'star', id: m.id ?? null, who: m.who ?? null, mark: m, ...q });
  }
  out.push({ kind: 'hero', id: 'hero', who: null, ...at(hero.x, hero.y) });
  return out;
}
