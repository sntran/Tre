// Small hamlets in the generated land: two or three houses on stilts around a yard, a bamboo hedge
// behind them, a haystack, a coop with hens, a banana plant, and a villager for each house. A
// hamlet of two houses can have a small pond with a big jar of water by it. The
// houses and the people come from parts (src/world/props/houses.js, people.js), so that no two
// hamlets look the same. A hamlet is never a historical place: it has no name. Pure functions.
import { createRng } from '../rng.js';
import { villagerLook } from './people.js';

// The hamlet of one site (plane cells; site: { x, y, w, h, seed }): the ground of its cells
// (claims: { x, y, letter, drop }), its objects, its life, and its villagers. Pure: the same site
// gives the same hamlet.
export function hamletOf(site, parts) {
  const out = { claims: [], objects: [], life: [], villagers: [] };
  const { map: mi, x: hx, y: hy, w: W, h: H } = site;
  const hr = createRng(site.seed);
  // The yard, and the hedge behind the houses (two cells thick).
  for (let y = hy; y < hy + H; y++) {
    for (let x = hx; x < hx + W; x++) {
      const hedge = y < hy + 2 || ((x < hx + 2 || x >= hx + W - 2) && y < hy + 8);
      out.claims.push({ x, y, letter: hedge ? 'h' : 'y', drop: 0 });
    }
  }
  const id = (what, n) => `hamlet:${hx}:${hy}:${what}${n ?? ''}`;
  const add = (prop, x, y, size = 2, n = '') => out.objects.push({ map: mi, id: id(prop, n), prop, x, y, w: size, h: size, seed: hr.int(1, 2147483646) });
  const houses = hr.int(2, 3);
  for (let i = 0; i < houses; i++) {
    const x = hx + 2 + i * 6;
    const prop = hr.chance(0.6) ? 'house' : 'hut';
    add(prop, x, hy + 2, 6, i);
    out.villagers.push({ map: mi, id: `villager:${hx}:${hy}:${i}`, look: villagerLook(hr, parts), home: id(prop, i), plan: hr.pick(['keeper', 'early', 'late']), x: x + 3, y: hy + 10.5 });
  }
  // A pond where a third house would stand (one step down, so that the water lies under the
  // yard), with a big jar by it.
  if (houses === 2 && hr.chance(0.5)) {
    for (let y = hy + 3; y < hy + 7; y++) for (let x = hx + 15; x < hx + 19; x++) out.claims.push({ x, y, letter: '~', drop: 1 });
    add('jar', hx + 13, hy + 4, 1);
  }
  add('haystack', hx + 3, hy + H - 4);
  add('coop', hx + 11, hy + H - 4);
  add(hr.chance(0.5) ? 'banana' : 'areca', hx + W - 5, hy + H - 4);
  out.life.push({ map: mi, kind: 'chicken', n: hr.int(2, 4), x: hx + 12, y: hy + H - 6, r: 1.5 });
  return out;
}
