// Trigger zones. A zone is a rectangle of tiles. When the hero enters a zone,
// or taps it, the zone gives its action. Doors, talks, and quest events start here.
// zone: { id, x, y, w, h, on: 'enter' | 'tap', when: {...}, once: true, action: {...} }
import { check } from './conditions.js';

export function createTriggers(zones) {
  const list = zones.map((z) => ({ w: 1, h: 1, on: 'enter', ...z }));

  const contains = (z, x, y) => x >= z.x && y >= z.y && x < z.x + z.w && y < z.y + z.h;

  // All zones at a tile. The order is the order in the data.
  function at(x, y) {
    return list.filter((z) => contains(z, x, y));
  }

  // The first zone that fires for this event at this tile, or null.
  // state: { flags, grade, inventory, ... }. A "once" zone fires one time only;
  // the game keeps the fired ids in state.flags as "zone.<id>".
  function fire(on, x, y, state) {
    for (const z of at(x, y)) {
      if (z.on !== on) continue;
      if (z.once && state.flags?.[`zone.${z.id}`]) continue;
      if (!check(z.when, state)) continue;
      return z;
    }
    return null;
  }

  return { list, at, fire, contains };
}
