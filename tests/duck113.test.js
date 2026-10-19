// The lost ducks after the play test (#113): each lost duck can be picked at its own place and
// carried to the pen, at each level and for many seeds (a lost duck far from the pen went back at
// once from the hands, and the flock could never be whole); the farmer counts by twos from grade 3
// and says the total at once from grade 4; after a short count, a wave points at a lost duck.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query } from '../src/core/world/state.js';

const story = load('tests/stories/event-duck.json');
const start = story.steps.slice(0, story.steps.findIndex((x) => x.read === true) + 1);

async function atDucks(grade, seed) {
  let session = null;
  const failures = await runHeadless({ ...story, profile: { ...story.profile, grade, seed }, steps: start }, { onSession: (s) => { session = s; } });
  assert.deepEqual(failures.map((f) => `${f.step}: ${f.message}`), [], `grade ${grade}, seed ${seed}`);
  const run = (sec, until = () => false) => {
    for (let i = 0; i < sec / STEP && !until(); i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  return { session, run };
}

test('each lost duck can be picked and carried to the pen, at each level and for many seeds', async () => {
  let carried = 0;
  for (const grade of [1, 2, 3, 4, 5]) {
    for (const seed of [7, 11, 23]) {
      const { session, run } = await atDucks(grade, seed);
      const hero = getEntity(session.state, 'hero');
      const pen = query(session.state, 'zone').find((z) => z.zone.rule === 'exact' && /duck/.test(z.zone.task));
      assert.ok(pen, 'the pen');
      for (const lost of query(session.state, 'zone').filter((z) => z.zone.rule === 'heap' && /-lost-\d+$/.test(z.zone.id))) {
        const id = lost.zone.items.find((x) => !getEntity(session.state, x)?.item.held);
        if (!id) continue;
        const duck = getEntity(session.state, id);
        // At the lost place: a tap on the duck and a press take it.
        Object.assign(hero.position, { x: duck.position.x + 1.5, z: duck.position.z });
        delete hero.route;
        run(0.5);
        session.command({ type: 'tap', target: { thing: id } });
        run(3, () => !hero.route);
        session.command({ type: 'hands', id: session.action()?.id });
        run(1.5);
        assert.equal(hero.hands?.holds, id, `grade ${grade}, seed ${seed}: ${id} is in the hands`);
        // The way to the pen, a few half blocks at a time: the duck stays in the hands.
        const from = { x: hero.position.x, z: hero.position.z };
        const to = { x: pen.zone.x, z: pen.zone.z - 3 };
        const n = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 3);
        for (let k = 1; k <= n; k++) {
          Object.assign(hero.position, { x: from.x + ((to.x - from.x) * k) / n, z: from.z + ((to.z - from.z) * k) / n });
          delete hero.route;
          run(0.2);
          assert.equal(hero.hands?.holds, id, `grade ${grade}, seed ${seed}: ${id} stays in the hands on the way (${k} of ${n})`);
        }
        session.command({ type: 'tap', target: { thing: pen.id } });
        run(3, () => !hero.route);
        session.command({ type: 'hands', id: session.action()?.id });
        run(1.5);
        assert.ok(pen.zone.items.includes(id), `grade ${grade}, seed ${seed}: ${id} in the pen`);
        carried += 1;
      }
    }
  }
  assert.ok(carried > 0, 'lost ducks were carried');
});

async function shortCount(grade) {
  const at = story.steps.findIndex((x) => x.expect?.some((e) => e.text?.shown === 'event.duck.short'));
  const said = [];
  const views = [];
  let session = null;
  const failures = await runHeadless({ ...story, profile: { ...story.profile, grade }, steps: story.steps.slice(0, at) }, {
    onSession: (x) => {
      session = x;
      x.listen((e) => {
        if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, params: e.params ?? {} });
        if (e.type === 'workView') views.push(e.key);
      });
    },
  });
  assert.deepEqual(failures, [], said.map((l) => l.key).join(', '));
  return { session, said, views };
}

test('from grade 3 the farmer counts the ducks of the pen by twos, and from grade 4 she says the total and what is lacking', async () => {
  const three = await shortCount(3);
  const nums = three.said.map((l) => l.key).filter((k) => /^num\.\d+$/.test(k)).map((k) => Number(k.slice(4)));
  assert.ok(nums.length >= 2, three.said.map((l) => l.key).join(', '));
  assert.ok(nums.slice(0, -1).every((n) => n % 2 === 0), `by twos: ${nums.join(', ')}`);
  const four = await shortCount(4);
  const keys = four.said.map((l) => l.key);
  assert.ok(keys.includes('mentor.duck.total') && keys.includes('mentor.duck.lack'), keys.join(', '));
  assert.ok(!keys.some((k) => /^num\.\d+$/.test(k)), `no count by ones: ${keys.join(', ')}`);
});

test('after a short count, a wave points at a lost duck of her flock and the view shows it, never the count again', async () => {
  const { session, said, views } = await shortCount(1);
  const run = (sec) => {
    for (let k = 0; k < sec / STEP; k++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  run(4);
  const from = said.length;
  for (let i = 0; i < 2; i++) {
    session.command({ type: 'wave' });
    for (let k = 0; k < 6 / STEP; k++) {
      if (session.screen) session.command({ type: 'close' });
      session.step();
      session.events();
    }
  }
  const after = said.slice(from).map((l) => l.key);
  assert.ok(after.includes('mentor.duck.lost'), after.join(', '));
  assert.ok(!after.includes('mentor.mark'), 'not the count of the pen');
  assert.ok(views.includes('event-duck-lost'), views.join(', '));
});
