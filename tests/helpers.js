// Helpers for tests: load the JSON data files.
import { readFileSync, existsSync } from 'node:fs';
import { loadData } from '../src/ui/data.js';
import { createWorld } from '../src/world/regions.js';
import { createHeights, parseHeightTile } from '../src/core/gen/heights.js';

export function load(path) {
  return JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
}

export const skillsData = load('data/skills.json');
export const learningConfig = load('data/config/learning.json');
export const bank = load('data/questions/science.json').questions;

// All the data of the game, as the browser loads it.
let gameData = null;
export function loadGameData() {
  gameData ??= loadData(() => {}, async (path) => {
    const url = new URL(`../${path}`, import.meta.url);
    return existsSync(url) ? JSON.parse(readFileSync(url, 'utf8')) : null;
  }, async (path) => {
    const url = new URL(`../${path}`, import.meta.url);
    return existsSync(url) ? readFileSync(url) : null;
  });
  return gameData;
}

// A map with the land of a seed (src/core/gen/), as the session builds it. The map files in
// data/maps/ hold only the stamps and the story data.
let world = null;
export function worldOf() {
  world ??= (() => {
    const regions = load('data/world/regions.json');
    const defs = new Map(regions.regions.flatMap((r) => r.maps).map((id) => [id, load(`data/maps/${id}.json`)]));
    const geo = load('data/geo/vietnam.json');
    const lands = new Map(regions.regions.filter((r) => r.land).map((r) => [r.land, load(`data/world/${r.land}.json`)]));
    const tiles = [...new Set([...lands.values()].flatMap((l) => l.tiles ?? []))];
    return createWorld(regions, defs, { routes: load('data/world/routes.json'), places: geo.places, rivers: geo.rivers, heights: heightsOf(tiles), lands, scatter: load('data/world/scatter.json'), villagers: load('data/figures.json').villagers });
  })();
  return world;
}

// The fine heights of these tiles (data/geo/heights/), read by fs.
export const heightsOf = (names) => createHeights(names.map((n) => parseHeightTile(readFileSync(new URL(`../data/geo/heights/${n}.bin`, import.meta.url)))));
export const mapOf = (id, seed = 1) => worldOf().map(id, seed);
