// After a lost raid and at night (#155): the next step always has a star, the child can sleep until
// the morning, Gióng says what is true at his place and time, a raid never starts in the dark, and
// the ride to Trâu Sơn is short.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { runHeadless, data } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query } from '../src/core/world/state.js';
import { liveTargets, restOf } from '../src/core/quests.js';
import { questMark } from '../src/core/clues.js';

const raids = load('data/raids.json').raids;
const encounterRaid = {};
for (const f of readdirSync(new URL('../data/maps/', import.meta.url))) for (const e of load(`data/maps/${f}`).encounters ?? []) encounterRaid[e.id] = e.raid ?? null;
const raidOf = (id) => encounterRaid[id] ?? null;

async function start(story, { steps = [{ wait: 0.5 }], profile = {}, clock } = {}) {
  let session = null;
  const said = [];
  const events = [];
  const s = { ...story, profile: { ...story.profile, ...profile, flags: { ...story.profile.flags, ...(profile.flags ?? {}) } }, steps };
  if (clock !== undefined) s.clock = clock;
  const failures = await runHeadless(s, { onSession: (x) => {
    session = x;
    x.listen((e) => {
      events.push(e);
      if (e.type === 'open' && e.textKey) said.push(e.textKey);
    });
  } });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  const run = (sec) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  const press = (sec = 1) => { session.command({ type: 'hands', id: session.action()?.id ?? null }); run(sec); };
  return { session, said, events, run, press, hero: () => getEntity(session.state, 'hero') };
}

test('each step of the quests with targets that can wait has a star: a live target, or the rest until the morning', () => {
  let checked = 0;
  for (const q of load('data/quests.json').quests) {
    for (const step of q.steps ?? []) {
      const list = step.targets ?? [];
      if (!list.some((tg) => tg.encounter)) continue;
      // Every raid of the step waits for the dawn, and no flag `if` is set.
      const flags = {};
      for (const tg of list) if (tg.encounter) flags[`raid.${raidOf(tg.encounter)}.back`] = 2000;
      const opts = { raidOf, raids, minutes: 1500 };
      const live = liveTargets(step, flags, opts);
      const rest = restOf(step, flags, opts);
      assert.ok(live.length || rest, `${q.id}/${step.id}: no star`);
      if (!live.length) assert.ok(rest.raid, `${q.id}/${step.id}: the rest names the raid that waits`);
      // At night, a step with raids only rests.
      const night = restOf(step, {}, { ...opts, night: true });
      if (liveTargets(step, {}, opts).every((tg) => tg.encounter)) assert.ok(night, `${q.id}/${step.id}: no rest at night`);
      checked += 1;
    }
  }
  assert.ok(checked >= 3, `${checked} steps`);
});

test('a lost raid of the river while the scouts wait too: the star of rest says when they come back; a sleep at home brings the dawn and the star of the raid', async () => {
  const s = load('tests/stories/stars-iron.json');
  // Two of the six iron (the first ore is done), the scouts lost in the play before, the river lost now.
  const h = await start(s, { profile: { flags: { 'horse.ore1': true, 'raid.scouts.back': 1800, 'raid.river.back': 1800 } }, clock: 1500 });
  const rest = h.session.restNow();
  assert.ok(rest, 'the rest');
  assert.ok(['scouts', 'river'].includes(rest.raid), rest.raid);
  assert.match(h.session.restLine(), /^star\.rest\.(scouts|river)$/);
  const spot = h.session.restSpot();
  assert.ok(spot.home, 'in Phù Đổng the hero rests at home');
  Object.assign(h.hero().position, { x: spot.x * 2 + 1, z: spot.y * 2 });
  h.run(1.5);
  assert.equal(h.session.action()?.act, 'sleep');
  assert.equal(h.session.action()?.icon, 'mat');
  h.press(1);
  const m = h.session.state.clock.minutes;
  assert.ok(m >= 1440 + 6 * 60 && m < 1440 + 6 * 60 + 10, `the dawn of the next day: ${m}`);
  assert.ok(h.events.some((e) => e.type === 'sleep'));
  assert.ok(h.said.includes('rest.morning'), 'Sáng rồi!');
  assert.equal(h.session.restNow(), null, 'no rest in the morning');
  assert.equal(h.session.profile.flags['raid.river.back'], undefined);
  const goal = load('data/quests.json').quests.flatMap((q) => q.steps ?? []).find((st) => st.id === 'iron');
  assert.ok(liveTargets(goal, h.session.profile.flags, { raidOf, raids, minutes: h.session.state.clock.minutes }).some((tg) => tg.encounter === 'river'), 'the star of the raid of the river');
});

test('after the loss of the raid of the soldiers, Gióng at the crossroads says that they left and come back in the morning', async () => {
  const s = load('tests/stories/raid-soldiers-giong.json');
  const h = await start(s, { profile: { flags: { 'raid.soldier1.back': 2400 } }, clock: 1500 });
  const def = data.raids.raids.soldier1;
  Object.assign(h.hero().position, { x: def.wall[0] * 2, z: def.wall[1] * 2 });
  h.run(0.5);
  const g = getEntity(h.session.state, 'npc:giong-hero');
  assert.ok(g, 'Gióng is here');
  h.session.command({ type: 'tap', target: { person: g.id } });
  h.run(3);
  const from = h.said.length;
  h.press(1.5);
  assert.ok(h.said.slice(from).includes('dlg.giong.rest.n1'), h.said.slice(from).join(', '));
  assert.ok(!h.said.includes('dlg.giong.ready.n1'), 'no line of "far away" at the place');
});

test('at 19:00 in the village, Gióng says that the trip waits for the morning; in the day he names the way with the road and the hills', async () => {
  const s = load('tests/stories/way-trau-son.json');
  for (const [clock, key] of [[19 * 60, 'dlg.giong.night.n1'], [9 * 60, 'dlg.giong.ready.n1']]) {
    const h = await start(s, { clock });
    const g = getEntity(h.session.state, 'npc:giong-hero');
    assert.ok(g, 'Gióng is here');
    Object.assign(g.position, { x: h.hero().position.x + 2, z: h.hero().position.z });
    h.session.command({ type: 'tap', target: { person: g.id } });
    h.run(3);
    const from = h.said.length;
    h.press(1.5);
    assert.ok(h.said.slice(from).includes(key), `${clock}: ${h.said.slice(from).join(', ')}`);
  }
  const vi = load('i18n/vi.json');
  assert.match(vi['dlg.giong.ready.n1'], /con đường lớn/);
  assert.match(vi['dlg.giong.ready.n1'], /đồi núi/);
});

test('a raid never starts in the dark: at night a press at the river says to rest first, and the star is on the place of rest', async () => {
  const s = load('tests/stories/raid-river-night.json');
  const h = await start(s);
  h.session.command({ type: 'tap', target: { person: 'encounter:river' } });
  h.run(3);
  h.press(1);
  assert.ok(h.said.includes('raid.night'), h.said.join(', '));
  assert.ok(!getEntity(h.session.state, 'raid'), 'no raid');
  // At night the hero can sleep at the place of rest.
  const spot = h.session.restSpot();
  Object.assign(h.hero().position, { x: spot.x * 2 + 1, z: spot.y * 2 });
  h.run(1.5);
  assert.equal(h.session.action()?.act, 'sleep');
});

test('on the back of Nghé, the ride from Phù Đổng to the crossroads of Trâu Sơn takes at most 40 seconds of riding', async () => {
  const s = load('tests/stories/way-trau-son.json');
  const h = await start(s);
  const nghe = query(h.session.state, 'follow')[0];
  h.hero().riding = nghe.id;
  const enc = h.session.map.encounters.find((e) => e.id === 'soldier1');
  const target = { x: enc.x, y: enc.y + 11 };
  const spotOf = (id) => {
    const e = getEntity(h.session.state, `way:${id}`);
    return e ? { x: e.position.x / 2, y: e.position.z / 2 } : null;
  };
  let riding = 0;
  const far = () => Math.hypot(h.hero().position.x / 2 - target.x, h.hero().position.z / 2 - target.y);
  for (let k = 0; k < 10 && far() > 8; k++) {
    const c = { x: h.hero().position.x / 2, y: h.hero().position.z / 2 };
    const m = questMark(data.clues, data.world.at, h.session.profile.flags, { ...target, h: 3 }, c, spotOf);
    h.session.command({ type: 'tap', target: { ground: { x: m.x, y: m.y, h: 3, thing: false, object: null, goal: true } } });
    for (let i = 0; i < 30 * 120; i++) {
      if (h.session.screen) h.session.command({ type: 'next' });
      h.session.step();
      h.session.events();
      if (h.hero().route) riding += STEP;
      else if (i > 30) break;
    }
  }
  assert.ok(far() <= 8, `the hero is ${far().toFixed(0)} cells from the crossroads`);
  assert.ok(riding <= 40, `${riding.toFixed(1)} seconds of riding`);
});
