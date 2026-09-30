import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDialogue } from '../src/core/dialogue.js';
import { createSkillGraph } from '../src/core/skills.js';
import { load, skillsData } from './helpers.js';
import { createProfile } from '../src/core/profile.js';

const vi = load('i18n/vi.json');
const graph = createSkillGraph(skillsData);
const dialogues = ['prologue', 'village', 'giong'].flatMap((f) => load(`data/dialogue/${f}.json`).dialogues);
const byId = new Map(dialogues.map((d) => [d.id, d]));
const npcs = load('data/npcs.json').npcs;
const quests = load('data/quests.json').quests;
const mapList = load('data/world/regions.json').regions.flatMap((r) => r.maps).map((id) => load(`data/maps/${id}.json`));
const village = {
  npcs: mapList.flatMap((m) => m.npcs),
  encounters: mapList.flatMap((m) => m.encounters),
  layers: { objects: mapList.flatMap((m) => m.layers.objects) },
};
const trials = load('data/trials.json').trials;
const callings = load('data/callings.json').callings;

test('each dialogue is valid and has unique ids', () => {
  assert.equal(byId.size, dialogues.length);
  for (const d of dialogues) assert.deepEqual(checkDialogue(d), [], d.id);
});

test('each speaker has a name', () => {
  for (const d of dialogues) {
    for (const n of Object.values(d.nodes)) {
      if (!n.speaker || n.speaker === 'narrator' || n.speaker === 'hero') continue;
      assert.ok(`npc.${n.speaker}.name` in vi, `${d.id}: speaker ${n.speaker}`);
    }
  }
});

test('each talk rule names a known dialogue', () => {
  for (const [id, npc] of Object.entries(npcs)) {
    for (const rule of npc.talk) assert.ok(byId.has(rule.dialogue), `${id}: ${rule.dialogue}`);
    assert.ok(village.npcs.some((n) => n.id === id), `${id} is on the map`);
  }
});

test('dialogue effects open only known screens', () => {
  const screens = new Set(['trial', 'practice', 'lesson', 'rice', 'home', 'craft', 'vanmieu', 'nameFriend']);
  for (const d of dialogues) {
    for (const n of Object.values(d.nodes)) {
      const effects = [...(n.effects ?? []), ...(n.choices ?? []).flatMap((c) => c.effects ?? [])];
      for (const e of effects) if (e.open) assert.ok(screens.has(e.open), `${d.id}: ${e.open}`);
    }
  }
});

test('each story is marked as Legend or History when it tells the legend', () => {
  for (const id of ['messenger.call', 'giong.speaks', 'giong.rice', 'giong.grown', 'giong.farewell', 'staff.breaks']) {
    assert.ok(['legend', 'history'].includes(byId.get(id).mark), id);
  }
});

test('quests use known people, encounters, and objects', () => {
  for (const q of quests) {
    for (const s of q.steps) {
      const targets = s.targets ?? (s.target ? [{ npc: s.target }] : []);
      for (const t of targets) {
        if (t.npc) assert.ok(npcs[t.npc], `${q.id}.${s.id}: ${t.npc}`);
        if (t.encounter) assert.ok(village.encounters.some((e) => e.id === t.encounter), t.encounter);
        if (t.object) assert.ok(village.layers.objects.some((o) => o.id === t.object), t.object);
      }
    }
  }
});

test('the Five Trials measure skills at or below the grade of each level', () => {
  assert.equal(trials.length, 5);
  assert.deepEqual(trials.map((t) => t.calling).sort(), callings.map((c) => c.id).sort());
  const grades = load('data/trials.json').grades;
  for (const trial of trials) {
    for (const [g, level] of Object.entries(grades)) {
      const id = trial.levels[level - 1].skill;
      const skill = graph.get(id);
      assert.ok(skill, id);
      assert.ok(skill.grade <= Math.max(2, Number(g)), `${trial.id}: ${id} (grade ${skill.grade}) for grade ${g}`);
    }
  }
});

test('notes do not repeat the Legend or History label that the seal shows', () => {
  const en = load('i18n/en.json');
  const marks = [vi['mark.legend'], vi['mark.history'], en['mark.legend'], en['mark.history']];
  const notes = Object.keys(vi).filter((k) => k.endsWith('.note'));
  for (const key of notes) {
    for (const text of [vi[key], en[key]]) {
      for (const mark of marks) assert.ok(!text.startsWith(`${mark}:`), `${key} starts with "${mark}:"`);
    }
  }
});

test('Nghé is the friend of the hero from the start; Sóng is the friend of the river raid', () => {
  const friends = load('data/friends.json').friends;
  const raids = load('data/raids.json').raids;
  for (const [id, f] of Object.entries(friends)) {
    assert.ok(['shield', 'heart'].includes(f.help.type), `${id}: help type`);
    assert.ok(f.nameKey in vi && f.helpKey in vi, `${id}: text`);
    if (f.ride !== undefined) {
      assert.equal(typeof f.ride.speed, 'number', `${id}: ride speed`);
      assert.ok(Array.isArray(f.ride.over), `${id}: ride over`);
    }
  }
  assert.ok(friends.nghe.ride, 'Nghé has a ride block for later');
  // A new hero has Nghé in the party, and names Nghé in the first dialogue.
  const p = createProfile({ id: 'n', name: 'An' });
  assert.deepEqual(p.party, ['nghe']);
  assert.equal(p.flags['friend.nghe'], true);
  const intro = byId.get('grandma.intro');
  const introChoices = Object.values(intro.nodes).flatMap((n) => n.choices ?? []);
  assert.ok(introChoices.some((c) => (c.effects ?? []).some((e) => e.open === 'nameFriend' && e.id === 'nghe')), 'the player names Nghé');
  // After the river raid: Sóng can join, and the player can say no.
  const after = raids.river.win.after.map((id) => byId.get(id));
  assert.ok(after.every(Boolean), 'the dialogues after the river raid exist');
  const choices = after.flatMap((d) => Object.values(d.nodes).flatMap((n) => n.choices ?? []));
  const gives = (c, id) => (c.effects ?? []).some((e) => e.friend === id);
  assert.ok(!choices.some((c) => gives(c, 'nghe')), 'the river does not give Nghé');
  const songNode = after.flatMap((d) => Object.values(d.nodes)).find((n) => n.choices?.some((c) => gives(c, 'song')));
  assert.ok(songNode.choices.some((c) => !gives(c, 'song')), 'Sóng is optional');
  for (const c of choices.filter((x) => gives(x, 'song'))) {
    assert.ok(c.effects.some((e) => e.open === 'nameFriend' && e.id === 'song'), 'a name for Sóng');
  }
  for (const f of ['nghe', 'song']) assert.ok(friends[f].gloss, `${f} has a glossary id for its name`);
});

test('the quest bar text is short: 44 characters or fewer, so it fits in 2 lines on a phone', () => {
  const en = load('i18n/en.json');
  const goalKeys = [...quests.flatMap((q) => q.steps.map((st) => st.goalKey)), 'quest.free'];
  for (const table of [vi, en]) {
    for (const key of goalKeys) {
      assert.ok(key in table, key);
      // The quest bar shows the glossary names only, and numbers such as 10/10.
      const text = table[key]
        .replace(/\[\[(\w+)\]\]/g, (all, id) => table[`gloss.${id}.name`] ?? id)
        .replace(/\{\w+\}/g, '10');
      assert.ok(text.length <= 44, `${key}: "${text}" has ${text.length} characters`);
    }
  }
});

test('facts of history in raid notes have the History seal', () => {
  const en = load('i18n/en.json');
  const raids = load('data/raids.json').raids;
  for (const [id, r] of Object.entries(raids)) {
    // A note with the Legend seal does not tell a modern fact (a year, UNESCO).
    if (r.mark === 'legend') {
      for (const text of [vi[r.noteKey], en[r.noteKey]]) {
        assert.ok(!/UNESCO|\b(1[0-9]{3}|20[0-9]{2})\b/.test(text), `${id}: "${text}" needs the History seal`);
      }
    }
    if (r.historyKey) assert.ok(r.historyKey in vi && r.historyKey in en, `${id}: history text`);
  }
  assert.ok(/UNESCO/.test(en[raids.boss.historyKey]));
});

test('the enemies of a raid leave the map after the player wins it', () => {
  const raids = load('data/raids.json').raids;
  for (const m of ['phu-dong', 'trau-son']) {
    for (const e of load(`data/maps/${m}.json`).encounters) {
      const r = raids[e.raid];
      assert.ok(r, `${e.id}: a raid`);
      assert.equal(r.map, m, `${e.id}: the raid is on the map of its encounter`);
      if (r.repeat) continue;
      const wins = r.win.set ?? [];
      assert.ok((e.when.notFlags ?? []).some((f) => wins.includes(f)), `${e.id}: leaves after one of ${wins.join(', ')}`);
    }
  }
});

test('the player is the hero: the narrator speaks to the player, not about the player', () => {
  const en = load('i18n/en.json');
  for (const d of dialogues) {
    for (const n of Object.values(d.nodes)) {
      if (n.speaker !== 'narrator') continue;
      // Only the first line tells the name of the player, in the second person.
      if (n.textKey === 'dlg.grandma.intro.n1') {
        assert.ok(vi[n.textKey].includes('Tên em là {name}') && en[n.textKey].includes('Your name is {name}'));
        continue;
      }
      assert.ok(!vi[n.textKey].includes('{name}') && !en[n.textKey].includes('{name}'), `${n.textKey} speaks about the player`);
    }
  }
  for (const key of ['title.new', 'create.look']) {
    assert.ok(!/anh hùng/i.test(vi[key]) && !/hero/i.test(en[key]), `${key} speaks of a hero apart from the player`);
  }
});
