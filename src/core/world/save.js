// The world state in the save. The save keeps the seed, the map, the clock, and the entities
// that the player changed (the entities with the component `keep`, for example the hero).
// Generated entities (people, animals, plants) come again from the map and the seed, so the
// save does not keep them. Parts of a kept entity that are only for one moment (a route, an
// intent) are not saved.
import { createWorldState, addEntity } from './state.js';
import { hashSeed } from '../rng.js';
import { CLOCK } from './clock.js';

export const TRANSIENT = Object.freeze(['route', 'intent']);

// The world part of a new profile (map: the map of the start region on the plane).
export function newWorldSave(profileSeed, map = 'giong') {
  return { seed: hashSeed(`${profileSeed}:world`), map, clock: { minutes: CLOCK.start }, entities: [] };
}

// World state -> save data.
export function saveWorld(world) {
  return {
    seed: world.seed,
    map: world.map,
    clock: { minutes: world.clock.minutes },
    entities: world.entities.filter((e) => e.keep).map((e) => {
      const out = structuredClone(e);
      for (const k of TRANSIENT) delete out[k];
      return out;
    }),
  };
}

// Save data -> world state with the kept entities. The caller adds the generated entities.
export function loadWorld(saved) {
  const world = createWorldState({ seed: saved.seed, map: saved.map, clock: saved.clock });
  for (const e of saved.entities ?? []) addEntity(world, e);
  return world;
}

// The place of the hero in a save: { map, x, y } in map cells (x and y are null when the save
// has no position, for example a new game).
export function heroPlace(saved) {
  const hero = saved.entities?.find((e) => e.id === 'hero');
  return { map: saved.map, x: hero ? hero.position.x / 2 : null, y: hero ? hero.position.z / 2 : null };
}

// Put the hero at a place in a save (after a travel). The world of the save is
// the new map. The other kept entities of the old map (a bridge that the child builds) wait in
// saved.away until the hero comes back to that map.
export function setHeroPlace(saved, map, x, y) {
  const hero = saved.entities?.find((e) => e.id === 'hero');
  if (map !== saved.map) {
    // A thing in the hands stays with its map; there it goes back to its pile. A thing that
    // travels (the rest of the loot) goes with the hero.
    const held = hero?.hands?.holds ? saved.entities.find((e) => e.id === hero.hands.holds) : null;
    const carried = held?.item?.travels ? held : null;
    if (hero?.hands?.holds && !carried) {
      hero.hands = { holds: null };
      delete hero.carry;
    }
    saved.away ??= {};
    const others = (saved.entities ?? []).filter((e) => e.id !== 'hero' && e !== carried);
    if (others.length) saved.away[saved.map] = others;
    else delete saved.away[saved.map];
    saved.entities = [...(hero ? [hero] : []), ...(carried ? [carried] : []), ...(saved.away[map] ?? [])];
    delete saved.away[map];
  }
  saved.map = map;
  const kept = (saved.entities ?? []).filter((e) => e.id !== 'hero');
  saved.entities = hero ? [hero, ...kept] : kept;
  if (x === null || y === null) {
    saved.entities = kept;
    return saved;
  }
  const position = { x: x * 2, y: hero?.position.y ?? 0, z: y * 2, facing: hero?.position.facing ?? 0 };
  if (hero) hero.position = position;
  // A thing that travels in the hands comes to the new place with the hero.
  const held = hero?.hands?.holds ? saved.entities.find((e) => e.id === hero.hands.holds) : null;
  if (held?.item?.travels && held.position) held.position = { ...held.position, x: position.x, z: position.z };
  if (!hero) saved.entities.unshift({ id: 'hero', keep: true, control: true, position, motion: { vx: 0, vz: 0, speed: 0 }, hands: { holds: null }, look: 'hero' });
  return saved;
}
