// Load all JSON data files at the start. The reader is fetch in the browser; the tests give a
// reader of the files (tests/helpers.js).
import { createWorld } from '../world/regions.js';

export const FILES = {
  skills: 'data/skills.json',
  learning: 'data/config/learning.json',
  experiments: 'data/config/experiments.json',
  learnlog: 'data/config/learnlog.json',
  game: 'data/config/game.json',
  tiles: 'data/tiles.json',
  regions: 'data/world/regions.json',
  roadEvents: 'data/world/road-events.json',
  routes: 'data/world/routes.json',
  geo: 'data/geo/vietnam.json',
  npcs: 'data/npcs.json',
  quests: 'data/quests.json',
  questions: 'data/questions/science.json',
  dialoguePrologue: 'data/dialogue/prologue.json',
  dialogueVillage: 'data/dialogue/village.json',
  dialogueGiong: 'data/dialogue/giong.json',
  trials: 'data/trials.json',
  raids: 'data/raids.json',
  items: 'data/items.json',
  friends: 'data/friends.json',
  callings: 'data/callings.json',
  titles: 'data/titles.json',
  hero: 'data/hero.json',
  figures: 'data/figures.json',
  life: 'data/world/life.json',
  people: 'data/world/people.json',
  day: 'data/world/day.json',
  zones: 'data/world/zones.json',
};

async function fetchJson(path) {
  const response = await fetch(path);
  return response.ok ? response.json() : null;
}

// read(path): the JSON of a file, or null.
export async function loadData(onProgress = () => {}, read = fetchJson) {
  const out = {};
  const names = Object.keys(FILES);
  let done = 0;
  await Promise.all(names.map(async (name) => {
    out[name] = await read(FILES[name]);
    done += 1;
    onProgress(done / names.length);
  }));
  // The maps of the regions that have maps.
  out.maps = new Map();
  const mapIds = out.regions.regions.flatMap((r) => r.maps);
  await Promise.all(mapIds.map(async (id) => {
    const map = await read(`data/maps/${id}.json`);
    if (map) out.maps.set(id, map);
  }));
  out.world = createWorld(out.regions, out.maps, { routes: out.routes, places: out.geo.places });
  out.dialogues = new Map();
  for (const name of ['dialoguePrologue', 'dialogueVillage', 'dialogueGiong']) {
    for (const d of out[name]?.dialogues ?? []) out.dialogues.set(d.id, d);
  }
  return out;
}
