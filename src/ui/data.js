// Load all JSON data files at the start. The reader is fetch in the browser; the tests give a
// reader of the files (tests/helpers.js).
import { createWorld } from '../world/regions.js';
import { createHeights, parseHeightTile } from '../core/gen/heights.js';

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
  blocks: 'data/world/blocks.json',
  scatter: 'data/world/scatter.json',
  events: 'data/world/events.json',
  practice: 'data/world/practice.json',
  mentors: 'data/world/mentors.json',
  planting: 'data/world/planting.json',
  hamlet: 'data/world/hamlet.json',
  folkgames: 'data/world/folkgames.json',
  naming: 'data/world/naming.json',
  origins: 'data/world/origins.json',
  speech: 'data/world/speech.json',
};

async function fetchJson(path) {
  const response = await fetch(path);
  return response.ok ? response.json() : null;
}

async function fetchBytes(path) {
  const response = await fetch(path);
  return response.ok ? response.arrayBuffer() : null;
}

// read(path): the JSON of a file, or null. readBytes(path): the bytes of a file (an ArrayBuffer or
// a Buffer), or null.
// options: { seeds (the lands of this many seeds stay; the tests keep more) }.
export async function loadData(onProgress = () => {}, read = fetchJson, readBytes = fetchBytes, options = {}) {
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
  // The land of each region that has one (data/world/land-<region>.json).
  const lands = new Map();
  await Promise.all(out.regions.regions.filter((r) => r.land).map(async (r) => {
    const land = await read(`data/world/${r.land}.json`);
    if (land) lands.set(r.land, land);
  }));
  // The fine height tiles that the lands need at the start (data/geo/heights/; startTiles: the
  // stamps and the roads). The others come when the hero comes near them (moreHeights).
  const tileNames = [...new Set([...lands.values()].flatMap((l) => l.startTiles ?? l.tiles ?? []))];
  // The bytes of each height tile stay too, for the worker that makes the land (src/ui/stream.js).
  const heightBytes = new Map();
  const heights = createHeights();
  const addHeights = async (names) => {
    const want = names.filter((n) => !heights.has(n) && !heightBytes.has(n));
    const got = await Promise.all(want.map((n) => readBytes(`data/geo/heights/${n}.bin`)));
    want.forEach((n, i) => {
      if (!got[i] || heights.has(n)) return;
      heightBytes.set(n, got[i]);
      heights.add(parseHeightTile(got[i]));
    });
    return want.filter((n, i) => got[i]);
  };
  await addHeights(tileNames);
  out.heights = heights;
  out.heightBytes = heightBytes;
  // Load more height tiles (names); the land of a tile can be made when its height tiles are there.
  // Return the names that came.
  out.moreHeights = addHeights;
  out.world = createWorld(out.regions, out.maps, { routes: out.routes, places: out.geo.places, rivers: out.geo.rivers, land: out.geo.land, heights, lands, scatter: out.scatter, villagers: out.figures.villagers, origins: out.origins, seeds: options.seeds ?? 2 });
  // The raids and the quests name places on the plane: their cells in the frame of a place (data/
  // raids.json, data/quests.json) become cells of the plane, and their map the map of the region.
  for (const def of Object.values(out.raids?.raids ?? {})) placeRaid(out.world, def);
  for (const q of out.quests?.quests ?? []) {
    for (const st of q.steps ?? []) {
      if (!st.place?.map) continue;
      const [x, y] = out.world.at(st.place.map, st.place.x, st.place.y);
      st.place = { ...st.place, map: out.world.regionOf(st.place.map), x, y };
    }
  }
  out.dialogues = new Map();
  for (const name of ['dialoguePrologue', 'dialogueVillage', 'dialogueGiong']) {
    for (const d of out[name]?.dialogues ?? []) out.dialogues.set(d.id, d);
  }
  return out;
}

// The places of a raid on the plane (its cells are in the frame of its map, a place).
function placeRaid(world, def) {
  const place = def.map;
  const at = (p) => (Array.isArray(p) ? world.at(place, p[0], p[1]) : p);
  for (const k of ['wall', 'gate', 'pile']) if (def[k]) def[k] = at(def[k]);
  if (def.spots) def.spots = def.spots.map(at);
  for (const w of def.waves ?? []) w.from = at(w.from);
  for (const src of def.sources ?? []) src.at = at(src.at);
  for (const ph of def.phases ?? []) {
    if (ph.bamboo) ph.bamboo = at(ph.bamboo);
    for (const w of ph.waves ?? []) w.from = at(w.from);
  }
  def.place = place;
  def.map = world.regionOf(place);
}
