// The greetings of the people (#49): one time when the child comes near, words that fit the age of
// the person, no greeting from Gióng or an enemy, and no greeting during the work.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { load } from './helpers.js';
import { createWorldState, getEntity } from '../src/core/world/state.js';
import { syncPeople } from '../src/core/world/populate.js';

const npcs = load('data/npcs.json').npcs;
const vi = load('i18n/vi.json');
const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true } };
const greetKey = (k) => /^world\.(greet|market)/.test(k ?? '');

test('each person has words of greeting for the age; Gióng does not greet; only an old person says "Cháu ngoan quá!"', () => {
  for (const [id, n] of Object.entries(npcs)) assert.ok(['elder', 'grown', 'young', 'child', 'none'].includes(n.greet), `${id}: greet ${n.greet}`);
  for (const id of ['giong-boy', 'giong-hero', 'giong-sky']) assert.equal(npcs[id].greet, 'none', id);
  for (const id of ['loco-child', 'rope-child']) assert.equal(npcs[id].greet, 'child', id);
  for (const id of ['elder', 'grandma', 'drummer']) assert.equal(npcs[id].greet, 'elder', id);
  assert.equal(vi['world.greet.3'], 'Cháu ngoan quá!');
  assert.equal(vi['world.greet.child'], 'Chào bạn!');
});

test('a person greets the child one time, with one sound, then not again for some minutes (#49)', async () => {
  const events = [];
  const failures = await runHeadless({ name: 'greet-once', profile, clock: 540, at: ['phu-dong', 10.5, 31], steps: [
    { tap: { entity: 'npc:grandma' } },
    { until: { event: 'greet', timeout: 30 } },
    { read: true },
    { wait: 150 },
  ] }, { onSession: (s) => s.listen((ev) => events.push(ev)) });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  const lines = events.filter((ev) => ev.type === 'open' && ev.screen === 'callout' && ev.id === 'npc:grandma' && greetKey(ev.textKey));
  assert.equal(lines.length, 1, JSON.stringify(lines.map((l) => l.textKey)));
  const greets = events.filter((ev) => ev.type === 'greet' && ev.id === 'npc:grandma');
  assert.ok(greets.length > 1, 'grandma waves more than once while the child stands near');
  assert.equal(greets.filter((ev) => ev.sound).length, 1, 'one greeting sound');
});

test('the enemies of an encounter do not greet', () => {
  const w = createWorldState({ seed: 1, map: 'test', clock: { minutes: 600 } });
  const map = { npcs: [{ id: 'grandma', x: 2, y: 2 }], encounters: [{ id: 'scouts', x: 6, y: 6, figure: 'an-scout' }] };
  syncPeople(w, map, { groundY: () => 0, homes: {} }, () => true, load('data/world/life.json').people);
  assert.ok(getEntity(w, 'npc:grandma').react, 'a person of the village greets');
  assert.equal(getEntity(w, 'encounter:scouts').react, undefined, 'an enemy does not');
});

test('people at work greet with no words and no sound: at the healer the child hears no greeting', async () => {
  const events = [];
  const failures = await runHeadless({ name: 'greet-work', profile, clock: 540, at: ['phu-dong', 33, 44], steps: [
    { press: { entity: 'npc:healer' } },
    { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 20 } },
    { read: true },
    { wait: 60 },
  ] }, { onSession: (s) => s.listen((ev) => events.push(ev)) });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  const after = events.slice(events.findIndex((ev) => ev.type === 'open' && ev.screen === 'dialogue'));
  assert.ok(after.some((ev) => ev.type === 'greet' && ev.id === 'npc:healer'), 'the healer waves');
  assert.equal(after.filter((ev) => ev.type === 'greet' && ev.sound).length, 0, 'no greeting sound during the work');
  assert.equal(after.filter((ev) => ev.type === 'open' && ev.screen === 'callout' && greetKey(ev.textKey)).length, 0);
});

test('a talk of a goal opens by itself one time; after that the button near the forge opens it only after a tap on the smith (#49)', async () => {
  const events = [];
  const flags = { ...profile.flags, 'trial.smith.done': true, 'giong.messenger': true, 'giong.spoke': true };
  const failures = await runHeadless({ name: 'talk-once', profile: { ...profile, flags }, clock: 540, at: ['phu-dong', 53, 45], steps: [
    { press: { entity: 'npc:smith' } },
    { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 20 } },
    { read: true },
    { wait: 1 },
    // The child presses the button near the smith with no tap on him, two times: the hero gets on
    // Nghé and off again, and the talk does not open again.
    { do: { type: 'hands' } },
    { wait: 2 },
    { do: { type: 'hands' } },
    { wait: 2 },
    // A tap on the smith and the button: the talk opens.
    { press: { entity: 'npc:smith' } },
    { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 20 } },
  ] }, { onSession: (s) => s.listen((ev) => events.push(ev)) });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  assert.equal(events.filter((ev) => ev.type === 'open' && ev.screen === 'dialogue').length, 2);
});
