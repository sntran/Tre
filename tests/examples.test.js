// The small example of each station of Xóm Ruộng (#37): src/core/examples.js. At the start of the
// first round of a visit, the person of the station does the work one time on a smaller instance
// next to the station; then the round of the child starts, and the example goes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { ACTS, exampleNumbers, exampleSteps, roundNumbers } from '../src/core/examples.js';
import { factKey } from '../src/core/planting.js';
import { load } from './helpers.js';
import { runHeadless } from './story-run.js';

const hamlet = load('data/world/hamlet.json');

test('the numbers of an example are never the numbers of the round of the child', () => {
  for (const act of ACTS) {
    const { tries } = hamlet.examples[act];
    for (let a = 2; a <= 10; a++) for (let b = 2; b <= 10; b++) {
      const round = act === 'planting'
        ? roundNumbers(act, [{ plot: { key: factKey(a, b), need: a * b } }])
        : act === 'drum' ? roundNumbers(act, { facts: [factKey(1, a)], groups: [a] }) : roundNumbers(act, { facts: [factKey(a, b)], need: a * b });
      const [x, y] = exampleNumbers(act, round, tries);
      if (act === 'drum') assert.ok(!round.groups.includes(x), `drum: the group ${x} is not the group of the child`);
      else {
        assert.ok(!round.facts.includes(factKey(x, y)), `${act}: ${x} x ${y} is not the fact ${a} x ${b}`);
        assert.ok(!round.totals.includes(x * y), `${act}: the total ${x * y} is not the total of the child`);
      }
    }
  }
  // The first try when the round does not have it: two rows of two seedlings, two ducks of two
  // scoops, two traps of two fish, and a group of two (the jumps on every second beat).
  assert.deepEqual(exampleNumbers('planting', roundNumbers('planting', [{ plot: { key: '3x4', need: 12 } }]), hamlet.examples.planting.tries), [2, 2]);
  assert.deepEqual(exampleNumbers('drum', roundNumbers('drum', { facts: ['1x5'], groups: [5] }), hamlet.examples.drum.tries), [2, 3]);
  assert.deepEqual(exampleNumbers('drum', roundNumbers('drum', { facts: ['1x2'], groups: [2] }), hamlet.examples.drum.tries), [3, 3]);
});

test('the script of an example: each act with its button picture, the count as words, and the end last', () => {
  for (const act of ACTS) {
    const { steps, end } = exampleSteps(act, [2, 3], { x: 100, z: 100 }, 'npc:x', { seedbed: { x: 90, z: 90 } });
    const spawns = steps.filter((s) => s.spawn).length;
    assert.ok(spawns >= 2, `${act}: the things of the example`);
    for (const s of steps) {
      for (const k of ['look', 'hop', 'gesture']) if (s[k]) assert.ok(s[k].k < spawns, `${act}: ${k} of a thing of the example`);
      if (s.shows) assert.ok(existsSync(new URL(`../art/ui/${s.shows.icon}.svg`, import.meta.url)), `${act}: the picture ${s.shows.icon}`);
    }
    assert.ok(steps.some((s) => s.shows), `${act}: a button picture`);
    assert.ok(steps.some((s) => /^num\.\d+$/.test(s.say?.key ?? '')), `${act}: the count as words`);
    assert.ok(steps.at(-1).end && steps.at(-1).at === end, `${act}: the end is the last step`);
    for (let i = 1; i < steps.length; i++) assert.ok(steps[i].at >= steps[i - 1].at, `${act}: the steps in order of time`);
  }
});

// The things of the child at a station after the start of the round, and whether the round is
// as new (no part of the example in it).
const CHILD = {
  planting: (s) => ({ zones: s.state.entities.filter((e) => e.zone?.task === 'trial-plant' && e.zone.rect), fresh: s.state.entities.filter((e) => e.zone?.task === 'trial-plant' && e.zone.rule !== 'heap').every((e) => !(e.zone.items ?? []).length) }),
  ducks: (s) => ({ zones: [], fresh: s.state.entities.find((e) => e.id === 'zone:trial-ducks').zone.round.poured === 0 }),
  traps: (s) => ({ zones: s.state.entities.filter((e) => e.id === 'zone:traps-stream'), fresh: !s.state.entities.find((e) => e.id === 'zone:traps-stream').zone.items.length }),
  drum: (s) => ({ zones: [], fresh: s.state.entities.find((e) => e.id === 'zone:trial-drum').zone.round.dance === null }),
};
const LINK = { planting: 'cay-lua', ducks: 'cho-vit-an', traps: 'dat-lo', drum: 'mua-trong' };

for (const act of ACTS) {
  test(`${act}: the person shows a small example first; after the example, the place of the child has no part of it`, async () => {
    let session = null;
    let during = null;
    const story = {
      name: `example-${act}`, practice: LINK[act],
      profile: { name: 'An', grade: 2, lang: 'vi', seed: 7, flags: {} },
      steps: [
        { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 10 } },
        { read: true },
        { until: { event: 'shows', timeout: 10 } },
        { until: { event: 'example', with: { done: true }, timeout: 40 } },
        { wait: 0.5 },
      ],
    };
    // Each button picture of the example (the last one: all the things of the example are there).
    const look = () => {
      const sc = session.state.entities.find((e) => e.id === `script:example-${act}`);
      during = { numbers: sc.script.numbers, demo: session.state.entities.filter((e) => e.demo).map((e) => ({ ...e.position })), zone: Boolean(session.state.entities.find((e) => e.id === `zone:trial-${act === 'planting' ? 'plant' : act}`)) };
    };
    const failures = await runHeadless(story, {
      onSession: (s) => {
        session = s;
        s.listen((ev) => { if (ev.type === 'shows' && s.state.entities.some((e) => e.id === `script:example-${act}`)) look(); });
      },
    });
    assert.deepEqual(failures, []);
    assert.ok(during.demo.length >= 2, 'the things of the example');
    // The things of the example stand on free ground (the traps float on the stream).
    for (const p of during.demo) {
      const cx = Math.floor(p.x / 2);
      const cz = Math.floor(p.z / 2);
      assert.equal(session.env.near(cx, cz).isBlocked(cx, cz), act === 'traps', `${act}: the ground at ${p.x}, ${p.z}`);
    }
    assert.equal(during.zone, false, 'the round of the child waits for the end of the example');
    // The round of the child: its own numbers, and none of the example.
    const tz = session.state.entities.find((e) => e.id === `zone:trial-${act === 'planting' ? 'plant' : act}`);
    assert.ok(tz, 'the round of the child starts after the example');
    assert.ok(!session.state.entities.some((e) => e.demo || e.id === `script:example-${act}`), 'the example goes');
    const child = CHILD[act](session);
    assert.ok(child.fresh, 'the place of the child is empty: no part of the example');
    for (const z of child.zones) {
      const r = z.zone.rect;
      for (const p of during.demo) assert.ok(p.x < r.x0 - 1 || p.x > r.x1 + 1 || p.z < r.z0 - 1 || p.z > r.z1 + 1, `the example is not in ${z.id}`);
    }
    const [a, b] = during.numbers;
    if (act === 'drum') assert.ok(!tz.zone.round.groups.includes(a), 'another group');
    else if (act !== 'planting') assert.ok(!tz.zone.round.facts.includes(factKey(a, b)), 'another fact');
  });
}
