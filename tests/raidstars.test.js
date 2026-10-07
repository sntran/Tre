// The stars of the raids (#50): each star leads to something that is there. A target that is done
// has no star, and the enemies of a lost raid have no star until they come back at the next dawn.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveTargets } from '../src/core/quests.js';
import { load } from './helpers.js';

const quests = load('data/quests.json').quests;
const raids = load('data/raids.json').raids;
const maps = ['phu-dong', 'trau-son', 'soc-son', 'road-thanglong', 'xom-ruong'].map((id) => load(`data/maps/${id}.json`));
const encounters = maps.flatMap((m) => m.encounters ?? []);
const raidOf = (id) => encounters.find((e) => e.id === id)?.raid ?? null;

test('each encounter target of a quest has unless: a flag that the win of its raid sets', () => {
  let n = 0;
  for (const q of quests) for (const st of q.steps) for (const tg of st.targets ?? []) {
    if (!tg.encounter) continue;
    n++;
    const raid = raids[raidOf(tg.encounter)];
    assert.ok(raid, `${q.id}/${st.id}: no raid for ${tg.encounter}`);
    assert.ok([].concat(raid.win?.set ?? []).includes(tg.unless), `${q.id}/${st.id}: ${tg.encounter} has unless ${tg.unless}`);
  }
  assert.ok(n >= 5);
});

test('a done target has no star; the enemies of a won raid have no star; the enemies of a lost raid have a star again at the next dawn', () => {
  const step = quests.find((q) => q.id === 'horse').steps.find((s) => s.id === 'iron');
  const ids = (flags, minutes = 600) => liveTargets(step, flags, { raidOf, raids, minutes }).map((t) => t.encounter ?? t.object);
  assert.deepEqual(ids({}), ['ore1', 'river', 'scouts']);
  assert.deepEqual(ids({ 'river.calmed': true }), ['ore1', 'ore2', 'scouts']);
  assert.deepEqual(ids({ 'river.calmed': true, 'scouts.won': true, 'horse.ore1': true, 'horse.ore2': true }), []);
  // Without unless in the data, the win flags of the raid hide the star too.
  const bare = { targets: [{ encounter: 'scouts' }] };
  assert.deepEqual(liveTargets(bare, { 'scouts.won': true }, { raidOf, raids }), []);
  // A lost raid: no star before the next dawn, a star after it.
  assert.deepEqual(ids({ 'raid.scouts.back': 1440 + 300 }, 900), ['ore1', 'river']);
  assert.deepEqual(ids({ 'raid.scouts.back': 1440 + 300 }, 1440 + 301), ['ore1', 'river', 'scouts']);
});
