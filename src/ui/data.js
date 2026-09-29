// Load all JSON data files at the start.
import { createWorld } from '../world/regions.js';

const FILES = {
  skills: 'data/skills.json',
  learning: 'data/config/learning.json',
  game: 'data/config/game.json',
  tiles: 'data/tiles.json',
  regions: 'data/world/regions.json',
  npcs: 'data/npcs.json',
  quests: 'data/quests.json',
  questions: 'data/questions/science.json',
  dialoguePrologue: 'data/dialogue/prologue.json',
  dialogueVillage: 'data/dialogue/village.json',
  dialogueGiong: 'data/dialogue/giong.json',
  trials: 'data/trials.json',
  enemies: 'data/enemies.json',
  battles: 'data/battles.json',
  elements: 'data/elements.json',
  items: 'data/items.json',
  friends: 'data/friends.json',
  crafts: 'data/crafts.json',
  callings: 'data/callings.json',
  titles: 'data/titles.json',
  hero: 'data/hero.json',
};

export async function loadData(onProgress = () => {}) {
  const out = {};
  const names = Object.keys(FILES);
  let done = 0;
  await Promise.all(names.map(async (name) => {
    const response = await fetch(FILES[name]);
    out[name] = response.ok ? await response.json() : null;
    done += 1;
    onProgress(done / names.length);
  }));
  // The maps of the regions that have maps.
  out.maps = new Map();
  const mapIds = out.regions.regions.flatMap((r) => r.maps);
  await Promise.all(mapIds.map(async (id) => {
    const response = await fetch(`data/maps/${id}.json`);
    if (response.ok) out.maps.set(id, await response.json());
  }));
  out.world = createWorld(out.regions, out.maps);
  out.dialogues = new Map();
  for (const name of ['dialoguePrologue', 'dialogueVillage', 'dialogueGiong']) {
    for (const d of out[name]?.dialogues ?? []) out.dialogues.set(d.id, d);
  }
  return out;
}
