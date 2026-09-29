// The world state: plain data for one map. It holds the entities, the clock, the seed, the map
// id, the commands for the next step, and the events of the last step. No functions, no DOM,
// no WebGL, so that the state can be saved, compared, and tested.
//
// An entity is a plain object with an `id` and optional components, for example
// { id: 'hero', position: { x, y, z, facing }, motion: { vx, vz, speed }, look: 'hero' }.
// Components hold only data: numbers, strings, booleans, arrays, and plain objects.
//
// Units: a position is on the half-block grid. x goes east, z goes south (map y), and y goes up.
// One map cell is 2 half blocks, so map x = position.x / 2.

export const HALF = 2; // half blocks in one map cell

// seed: a 32-bit number. map: the id of the map. clock: { minutes } (see clock.js).
export function createWorldState({ seed = 1, map = null, clock = { minutes: 0 } } = {}) {
  return {
    seed: seed >>> 0,
    rng: seed >>> 0, // the state of the seeded random numbers (src/core/rng.js)
    map,
    clock: { minutes: clock.minutes },
    paused: false, // true while a dialogue or a panel is open
    tick: 0, // the number of steps
    nextId: 1,
    entities: [],
    commands: [], // input for the next step: { type, id, ... }
    events: [], // what happened in the last step: { type, id, ... }
  };
}

// Add an entity. Give an id (a string) or get the next number. Return the entity.
export function addEntity(world, components = {}) {
  const id = components.id ?? world.nextId++;
  if (world.entities.some((e) => e.id === id)) throw new Error(`The entity ${id} is already in the world`);
  const entity = { ...structuredClone(components), id };
  world.entities.push(entity);
  return entity;
}

export function removeEntity(world, id) {
  const i = world.entities.findIndex((e) => e.id === id);
  if (i < 0) return null;
  return world.entities.splice(i, 1)[0];
}

export function getEntity(world, id) {
  return world.entities.find((e) => e.id === id) ?? null;
}

// All entities that have each of the named components, in the order they were added.
// A few hundred entities do not need an index.
export function query(world, ...names) {
  return world.entities.filter((e) => names.every((n) => e[n] !== undefined));
}

// Input for the next step. The step reads the commands and then clears them.
export function command(world, cmd) {
  world.commands.push(structuredClone(cmd));
}
