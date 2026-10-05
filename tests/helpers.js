// Helpers for tests: load the JSON data files.
import { readFileSync, existsSync } from 'node:fs';
import { loadData } from '../src/ui/data.js';
import { createWorld } from '../src/world/regions.js';
import { createHeights, parseHeightTile } from '../src/core/gen/heights.js';
import { createPlaneTileMap } from '../src/core/tilemap.js';
import { createTerrain, CHUNK } from '../src/world/terrain.js';

export function load(path) {
  return JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
}

export const skillsData = load('data/skills.json');
export const learningConfig = load('data/config/learning.json');
export const bank = load('data/questions/science.json').questions;

// All the data of the game, as the browser loads it, with all the height tiles of the lands (the
// game loads them when the hero comes near). The lands of more seeds stay (the land of a seed is
// pure), so that the tests make each land once.
let gameData = null;
export function loadGameData() {
  gameData ??= loadData(() => {}, async (path) => {
    const url = new URL(`../${path}`, import.meta.url);
    return existsSync(url) ? JSON.parse(readFileSync(url, 'utf8')) : null;
  }, async (path) => {
    const url = new URL(`../${path}`, import.meta.url);
    return existsSync(url) ? readFileSync(url) : null;
  }, { seeds: 24 }).then(async (data) => {
    const lands = data.regions.regions.filter((r) => r.land).map((r) => load(`data/world/${r.land}.json`));
    await data.moreHeights(lands.flatMap((l) => l.tiles ?? []));
    return data;
  });
  return gameData;
}

// The world of the regions on the plane (src/world/regions.js), with all the height tiles.
let world = null;
export function worldOf() {
  world ??= newWorld();
  return world;
}
// A new world, with no land tile made yet (the store of the land tiles, #36).
export function newWorld() {
  const regions = load('data/world/regions.json');
  const defs = new Map(regions.regions.flatMap((r) => r.maps).map((id) => [id, load(`data/maps/${id}.json`)]));
  const geo = load('data/geo/vietnam.json');
  const lands = new Map(regions.regions.filter((r) => r.land).map((r) => [r.land, load(`data/world/${r.land}.json`)]));
  const tiles = [...new Set([...lands.values()].flatMap((l) => l.tiles ?? []))];
  return createWorld(regions, defs, { routes: load('data/world/routes.json'), places: geo.places, rivers: geo.rivers, land: geo.land, heights: heightsOf(tiles), lands, scatter: load('data/world/scatter.json'), villagers: load('data/figures.json').villagers, seeds: 24 });
}

// The fine heights of these tiles (data/geo/heights/), read by fs.
export const heightsOf = (names) => createHeights(names.map((n) => parseHeightTile(readFileSync(new URL(`../data/geo/heights/${n}.bin`, import.meta.url)))));
// The map of a region (or of a place: the map of its region) with the land of a seed.
export const mapOf = (id, seed = 1) => worldOf().map(id, seed);

// The map of the region of Era 1 on the plane with the land of a seed, its tile map, and its terrain
// with the pages of the chunks over each of these places (r chunks around the middle of the frame of
// the place). at(place, x, y): a cell of the frame of a place on the plane.
export function planeOf(seed = 1, { blocks = null, places = ['phu-dong'], r = 3 } = {}) {
  const tiles = load('data/tiles.json').types;
  const map = mapOf('giong', seed);
  const tileMap = createPlaneTileMap(map, tiles);
  const terrain = createTerrain(map, tiles, tileMap, blocks);
  const at = (place, x, y) => worldOf().at(place, x, y);
  for (const id of places) {
    const def = load(`data/maps/${id}.json`);
    const [mx, my] = at(id, def.width / 2, def.height / 2);
    const cx = Math.floor(mx / CHUNK);
    const cz = Math.floor(my / CHUNK);
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) terrain.chunk(cx + dx, cz + dz);
  }
  return { map, tileMap, terrain, at };
}
