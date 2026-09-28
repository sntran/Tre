// Load all JSON data files at the start.

const FILES = {
  skills: 'data/skills.json',
  learning: 'data/config/learning.json',
  game: 'data/config/game.json',
  tiles: 'data/tiles.json',
  village: 'data/maps/phu-dong.json',
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
  out.dialogues = new Map();
  for (const name of ['dialoguePrologue', 'dialogueVillage', 'dialogueGiong']) {
    for (const d of out[name]?.dialogues ?? []) out.dialogues.set(d.id, d);
  }
  return out;
}
