import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDialogue } from '../src/core/dialogue.js';
import { createSkillGraph } from '../src/core/skills.js';
import { load, skillsData } from './helpers.js';

const vi = load('i18n/vi.json');
const graph = createSkillGraph(skillsData);
const dialogues = ['prologue', 'village', 'giong'].flatMap((f) => load(`data/dialogue/${f}.json`).dialogues);
const byId = new Map(dialogues.map((d) => [d.id, d]));
const npcs = load('data/npcs.json').npcs;
const quests = load('data/quests.json').quests;
const village = load('data/maps/phu-dong.json');
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
  const screens = new Set(['trial', 'practice', 'lesson', 'rice', 'home', 'craft', 'battle', 'vanmieu']);
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
        if (t.object) assert.ok(village.objects.some((o) => o.id === t.object), t.object);
      }
    }
  }
});

test('the Five Trials have skills for each grade at or below that grade', () => {
  assert.equal(trials.length, 5);
  assert.deepEqual(trials.map((t) => t.calling).sort(), callings.map((c) => c.id).sort());
  for (const trial of trials) {
    for (const g of ['1', '2', '3', '4', '5']) {
      const list = trial.skills[g];
      assert.ok(list?.length, `${trial.id} grade ${g}`);
      for (const id of list) {
        const skill = graph.get(id);
        assert.ok(skill, id);
        assert.ok(skill.grade <= Math.max(2, Number(g)), `${trial.id}: ${id} (grade ${skill.grade}) for grade ${g}`);
      }
    }
    // Math trials use skills of exactly the grade of the player.
    if (trial.calling === 'scholar') {
      for (const g of ['1', '2', '3', '4', '5']) {
        for (const id of trial.skills[g]) assert.equal(graph.get(id).grade, Number(g), id);
      }
    }
  }
});
