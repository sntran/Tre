// The lost ducks after the play test (#113): each lost duck can be picked at its own place and
// carried to the pen, at each level and for many seeds (a lost duck far from the pen went back at
// once from the hands, and the flock could never be whole).
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
