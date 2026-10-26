// The raids after #121 (#124): a right count always hits at grades K to 3 (the aimed enemy stands
// while the child presses and while the stone flies), the end line comes at the last hit, a take
// has its line, and the posts where the enemies stop change from one enemy to the next.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { createRaid, stepRaid, along } from '../src/core/world/raids.js';

const raids = load('data/raids.json');
const PLACES = { scouts: ['phu-dong', 61, 29], river: ['phu-dong', 14, 62] };

// The third raid of the slingshot (and of the gate): no stops at the posts, no new tool.
async function thirdRaid(id, grade, seed = 3, used = 2) {
  const flags = { 'intro.seen': true, 'giong.spoke': true, 'raid.tool.sling': true, 'raid.tool.gate': true, 'raid.tool.drag': true, 'raid.used.sling': used, 'raid.used.gate': used };
  let session = null;
  await runHeadless({ name: 'raid-124', profile: { name: 'Tí', grade, lang: 'vi', seed, flags, items: { rice: 5 } }, clock: 540, at: PLACES[id], steps: [{ wait: 1 }] }, { onSession: (s) => { session = s; } });
  return session;
}

// A child who counts the post where the enemy stands and presses that many times, 0.5 s a press,
// with no lead. `lead` is the posts in front of the enemy (grade 4: "bắn vào cột phía trước nó").
function play(session, encounter, { lead = 0, seconds = 240, gate = true } = {}) {
  let torch = false;
  const got = { shots: 0, hits: 0, lines: [], end: null, won: null, retreat: null, time: 0, takes: 0 };
  let flying = 0;
  const off = session.listen((ev) => {
    if (ev.type === 'shoot') { got.shots += 1; flying += 1; }
    if (ev.type === 'land') flying = Math.max(0, flying - 1);
    if (ev.type === 'hit') got.hits += 1;
    if (ev.type === 'retreat') got.retreat = got.time;
    if (ev.type === 'take') got.takes += 1;
    // A scout lifts a torch near the gate: the child taps the gate (#135: the enemies come nearer, to the posts).
    if (ev.type === 'light' && gate) torch = true;
    if (ev.type === 'end' && ev.id === 'raid' && got.end === null) got.end = got.time;
    if (ev.type === 'open' && ev.textKey) {
      got.lines.push(ev.textKey);
      if (ev.textKey.startsWith('raid.won') && got.won === null) got.won = got.time;
    }
  });
  const run = (s) => {
    for (let i = 0; i < s / STEP; i++) {
      session.step();
      session.events();
      got.time += STEP;
    }
  };
  const read = () => {
    for (let n = 0; session.screen && n < 40; n++) {
      session.command(session.screen === 'dialogue' || session.screen === 'say' ? { type: 'next' } : { type: 'close' });
      session.events();
      run(0.3);
    }
  };
  session.command({ type: 'tap', target: { person: encounter } });
  session.events();
  session.command({ type: 'hands' });
  session.events();
  for (let t = 0; t < 20 && !getEntity(session.state, 'raid'); t += 0.3) {
    read();
    run(0.3);
  }
  while (got.time < seconds && got.end === null) {
    read();
    if (torch) {
      torch = false;
      session.command({ type: 'tap', target: { raid: { what: 'gate' } } });
      session.events();
    }
    const raid = getEntity(session.state, 'raid')?.raid;
    if (!raid) break;
    const foes = raid.enemies.filter((e) => (e.state === 'walk' || e.state === 'wait') && e.hits < e.max);
    const near = foes.map((e) => ({ e, d: along(raid, e) })).filter((f) => f.d > 3).sort((a, b) => a.d - b.d)[0];
    // The child counts when the enemy is at a post that the child sees (#135: not behind the last post).
    if (flying || raid.reload > 0 || !near || !raid.posts.some((q) => Math.abs(near.d - q.d) <= 0.5)) {
      run(STEP);
      continue;
    }
    const posts = Math.max(1, Math.round(near.d / 5) - lead);
    for (let k = 0; k < posts; k++) {
      session.command({ type: 'hands' });
      session.events();
      run(0.5);
    }
    // Until the stone lands.
    for (let t = 0; t < 6 && (flying || raid.pull > 0) && got.end === null; t += STEP) run(STEP);
  }
  // The enemies walk away after the end.
  run(3);
  off();
  return got;
}

for (const grade of [0, 1, 2]) {
  for (const id of ['scouts', 'river']) {
    test(`grade ${grade}, the third raid of the slingshot (${id}): each count of the post where the enemy stands hits, and the end comes at the last hit`, async () => {
      const session = await thirdRaid(id, grade);
      const got = play(session, `encounter:${id}`);
      assert.ok(got.shots >= 2, `shots ${got.shots}`);
      assert.equal(got.hits, got.shots, `${got.hits} hits in ${got.shots} shots`);
      assert.notEqual(got.end, null, 'the raid ends');
      assert.notEqual(got.won, null, `the end line: ${got.lines.join(', ')}`);
      assert.ok(got.won - got.retreat <= 1, `the end line ${(got.won - got.retreat).toFixed(1)} s after the last retreat`);
    });
  }
}

test('grade 4, the third raid: a count of the post where the enemy stands hits', async () => {
  const session = await thirdRaid('scouts', 4);
  const got = play(session, 'encounter:scouts');
  assert.ok(got.shots >= 2, `shots ${got.shots}`);
  assert.equal(got.hits, got.shots, `${got.hits} hits in ${got.shots} shots`);
  assert.ok(!got.lines.includes('raid.walking'));
});

test('grade 4, a later raid: the coach says first that the enemies walk, and a count of the post in front of the enemy hits', async () => {
  const session = await thirdRaid('scouts', 4, 3, 4);
  const got = play(session, 'encounter:scouts', { lead: 1 });
  assert.equal(got.lines.filter((k) => k === 'raid.walking').length, 1, got.lines.join(', '));
  assert.ok(got.lines.indexOf('raid.walking') < got.lines.findIndex((k) => /^raid\.(hit|miss|over|short)/.test(k)) || !got.lines.some((k) => /^raid\.(hit|miss|over|short)/.test(k)), 'the line before the first throw');
  // The enemy walks: not each throw hits, but many do, and the raid ends.
  assert.ok(got.hits * 5 >= got.shots * 2, `${got.hits} hits in ${got.shots} shots`);
  assert.notEqual(got.end, null);
});

test('after the last retreat, the end comes at once, and the enemies walk back to their start after it, in view', () => {
  const raid = createRaid(raids, 'river', 0, null, [], {});
  for (let t = 0; t < 12; t += 1 / 30) stepRaid(raid, 1 / 30, {});
  assert.equal(raid.enemies.length, 2);
  for (const e of raid.enemies) e.state = 'retreat';
  stepRaid(raid, 1 / 30, {});
  assert.equal(raid.result, 'won', 'the end at the last retreat');
  assert.ok(raid.enemies.every((e) => e.state === 'retreat'), 'they are still on the road');
});

for (const id of ['scouts', 'river']) {
  test(`a take of the ${id} says its line, at each level, also with no loss`, async () => {
    for (const grade of [0, 2, 5]) {
      const session = await thirdRaid(id, grade);
      const lines = [];
      const off = session.listen((ev) => { if (ev.type === 'open' && ev.textKey) lines.push(ev.textKey); });
      session.command({ type: 'tap', target: { person: `encounter:${id}` } });
      session.events();
      session.command({ type: 'hands' });
      session.events();
      // No shot: the enemy comes to the wall and takes.
      const key = raids.raids[id].takeKey ?? 'raid.take';
      for (let i = 0; i < 90 / STEP && !lines.includes(key); i++) {
        session.step();
        session.events();
        if (session.screen) session.command(session.screen === 'dialogue' || session.screen === 'say' ? { type: 'next' } : { type: 'close' });
      }
      off();
      assert.ok(lines.includes(key), `grade ${grade}: ${lines.join(', ')}`);
    }
  });
}

test('two enemies of one raid do not stop at the same posts, and the posts come from the seed', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const stops = (raid) => {
      const seen = {};
      for (let t = 0; t < 120 && Object.keys(seen).length < 2; t += 1 / 30) {
        stepRaid(raid, 1 / 30, {});
        for (const e of raid.enemies) {
          if (e.stops && !seen[e.id]) seen[e.id] = [...e.stops];
          // The child sends each enemy back, and the next one comes.
          if (e.state === 'walk' && along(raid, e) < 18) e.state = 'retreat';
        }
      }
      return seen;
    };
    const a = stops(createRaid(raids, 'scouts', 0, null, [], { stop: 4, seed }));
    assert.equal(Object.keys(a).length, 2, `seed ${seed}: two enemies`);
    const [s1, s2] = Object.values(a);
    assert.notDeepEqual(s1, s2, `seed ${seed}: ${s1} and ${s2}`);
    assert.deepEqual(stops(createRaid(raids, 'scouts', 0, null, [], { stop: 4, seed })), a, 'the same seed, the same posts');
  }
});
