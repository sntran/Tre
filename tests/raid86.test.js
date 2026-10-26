// The first raid of the play test of #86: words after a miss, a raid that the child chooses, and a
// child who stays at the gate.
import { test } from 'node:test';
import { createI18n } from '../src/core/i18n.js';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { getEntity, query } from '../src/core/world/state.js';
import { load } from './helpers.js';

const profile = { name: 'An', grade: 1, lang: 'vi', seed: 3, flags: { 'intro.seen': true, 'giong.spoke': true }, items: { rice: 5 } };
const start = [
  { press: { entity: 'encounter:scouts' } },
  { until: { event: 'open', with: { screen: 'say' }, timeout: 30 } },
  { read: true },
  { wait: 15 },
];
const presses = (n) => [...Array.from({ length: n }, () => [{ do: { type: 'hands' } }, { wait: 0.25 }]).flat(), { wait: 4 }];

test('after a stone that falls short or flies past, the elder at the wall says where it fell; after two misses he points at the enemy and then at the posts', async () => {
  let s = null;
  const lines = [];
  const seqs = [];
  let gesture = null;
  let elderAt = null;
  const failures = await runHeadless({ name: 'raid-miss', profile, clock: 540, at: ['phu-dong', 61, 29], steps: [...start, ...presses(1), ...presses(6)] }, {
    onSession: (x) => {
      s = x;
      x.listen((e) => {
        if (e.type === 'open' && e.textKey) lines.push(e.textKey);
        // The help after two misses (the line of the side at the start glows the first post only, #135).
        if (e.type === 'glowSeq' && String(e.ids[0]).startsWith('raider:')) {
          seqs.push(e.ids);
          elderAt = { ...getEntity(x.state, 'npc:elder').position };
          gesture = structuredClone(getEntity(x.state, 'npc:elder').gesture);
        }
      });
    },
  });
  assert.deepEqual(failures, []);
  assert.ok(lines.includes('raid.miss.short'), `the line of a short stone: ${lines.join(', ')}`);
  assert.ok(lines.includes('raid.miss.long'), `the line of a long stone: ${lines.join(', ')}`);
  assert.ok(lines.indexOf('raid.miss.short') < lines.indexOf('raid.miss.long'));
  assert.ok(!lines.some((k) => k.startsWith('world.greet')), 'no greeting in a raid');
  const raid = getEntity(s.state, 'raid').raid;
  assert.ok(elderAt && Math.hypot(elderAt.x - raid.wall.x, elderAt.z - raid.wall.z) <= 16, `the elder stands next to the wall: ${elderAt && Math.round(Math.hypot(elderAt.x - raid.wall.x, elderAt.z - raid.wall.z))}`);
  assert.equal(seqs.length, 1, 'one point after two misses');
  assert.ok(seqs[0][0].startsWith('raider:'), 'the enemy glows first');
  assert.ok(seqs[0].slice(1).every((id) => id.startsWith('post:')), 'and then the posts');
  assert.ok(gesture?.then, 'the elder points two times');
  // The words of the raid of the scouts (#99).
  const w = { who: { key: 'raid.who.soldier' }, ball: { key: 'raid.ball.stone' }, wall: { key: 'raid.wall.gate' } };
  const i18n = createI18n(load('i18n/vi.json'), 'vi');
  assert.equal(i18n.t('raid.miss.short', w), 'Hòn đá rơi trước lính rồi.');
  assert.equal(i18n.t('raid.miss.long', w), 'Hòn đá bay qua lính rồi.');
});

test('after the raid the elder goes back to his day', async () => {
  let s = null;
  let spot = null;
  const failures = await runHeadless(load('tests/stories/raid-first-sling.json'), {
    onSession: (x) => {
      s = x;
      spot = structuredClone(getEntity(x.state, 'npc:elder')?.schedule?.spot ?? null);
    },
  });
  assert.deepEqual(failures, []);
  const elder = getEntity(s.state, 'npc:elder');
  assert.equal(elder.raidCoach, undefined);
  assert.deepEqual(elder.schedule.spot, spot);
  assert.ok(!elder.schedule.hold);
});

test('a child who walks far from the wall with the stick: the enemies wait, and the elder calls one time', async () => {
  let s = null;
  const lines = [];
  const events = [];
  let before = null;
  let after = null;
  const failures = await runHeadless({
    name: 'raid-away', profile, clock: 540, at: ['phu-dong', 61, 29],
    steps: [
      ...start,
      { do: { type: 'move', dx: -1, dz: 0, strength: 1 } },
      { until: { event: 'away', timeout: 20 } },
      { wait: 0.5 },
      { do: { type: 'move', dx: -1, dz: 0, strength: 1 } },
      { wait: 4 },
      { do: { type: 'move', dx: 0, dz: 0, strength: 0 } },
      { wait: 1 },
      { do: { type: 'move', dx: 1, dz: 0, strength: 1 } },
      { until: { event: 'back', timeout: 30 } },
      { do: { type: 'move', dx: 0, dz: 0, strength: 0 } },
      { wait: 1 },
    ],
  }, {
    onSession: (x) => {
      s = x;
      x.listen((e) => {
        if (e.type === 'open' && e.textKey) lines.push(e.textKey);
        if (e.type === 'away' || e.type === 'back') events.push(e.type);
        if (e.type === 'away') before = getEntity(x.state, 'raid').raid.enemies.map((q) => ({ id: q.id, x: q.x, z: q.z }));
        if (e.type === 'back') after = getEntity(x.state, 'raid').raid.enemies.map((q) => ({ id: q.id, x: q.x, z: q.z }));
      });
    },
  });
  assert.deepEqual(failures, []);
  assert.deepEqual(events, ['away', 'back']);
  assert.deepEqual(after, before, 'the enemies waited');
  assert.equal(lines.filter((k) => k === 'raid.away').length, 1);
  assert.equal(createI18n(load('i18n/vi.json'), 'vi').t('raid.away', { wall: { key: 'raid.wall.gate' } }), 'Cháu ơi, quay lại cổng làng!');
  assert.ok(getEntity(s.state, 'raid'), 'the raid goes on');
});

test('in a raid, a tap on a star and a tap on a far person do not walk away from the wall', async () => {
  let s = null;
  let wall = null;
  const failures = await runHeadless({
    name: 'raid-star', profile, clock: 540, at: ['phu-dong', 61, 29],
    steps: [
      ...start,
      { do: { type: 'tap', target: { ground: { x: 20.5, y: 25.5, h: 1, goal: true } } } },
      { wait: 3 },
      { do: { type: 'tap', target: { person: 'npc:grandma' } } },
      { wait: 3 },
    ],
  }, { onSession: (x) => { s = x; x.listen((e) => { if (e.type === 'raid' && e.on) wall = { ...getEntity(x.state, 'raid').raid.wall }; }); } });
  assert.deepEqual(failures, []);
  const h = getEntity(s.state, 'hero').position;
  assert.ok(Math.hypot(h.x - wall.x, h.z - wall.z) <= 4, `the hero stays at the wall (${Math.round(h.x - wall.x)}, ${Math.round(h.z - wall.z)})`);
});

test('the court of a folk game and the place of an encounter are not next to each other', () => {
  for (const name of ['phu-dong']) {
    const map = load(`data/maps/${name}.json`);
    const places = map.layers?.places ?? {};
    const court = places.hopscotch;
    assert.ok(court, 'the map has a court');
    for (const e of map.encounters ?? []) {
      const d = Math.hypot(e.x - court.x, e.y - court.y);
      const to = places['hopscotch-to'];
      const d2 = to ? Math.hypot(e.x - to.x, e.y - to.y) : d;
      assert.ok(Math.min(d, d2) >= 12, `${e.id} is ${Math.min(d, d2).toFixed(1)} cells from the court`);
    }
  }
});

test('the children of the court do not ask while the hero walks to a star or an enemy is in reach', async () => {
  const lines = [];
  const map = load('data/maps/phu-dong.json');
  const court = map.layers.places.hopscotch;
  const failures = await runHeadless({
    name: 'court-star', profile: { ...profile, flags: { 'intro.seen': true } }, clock: 540, at: ['phu-dong', court.x - 12, court.y + 2],
    steps: [
      // A tap on a star past the court: the walk goes by the court, and no child asks.
      { do: { type: 'tap', target: { ground: { x: court.x + 20, y: court.y + 2.5, h: 1, goal: true } } } },
      { wait: 8 },
    ],
  }, { onSession: (x) => { x.listen((e) => { if (e.type === 'open' && e.textKey) lines.push(e.textKey); }); } });
  assert.deepEqual(failures, []);
  assert.ok(!lines.includes('loco.invite'), `no invite on the walk to a star: ${lines.join(', ')}`);
});
