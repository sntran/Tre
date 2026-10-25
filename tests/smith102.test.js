// The smith by grade (#102): the pulse of the heat (grades 1 and 2), and from grade 3 the colors of
// the iron in the fire with no pulse that says when, the heat that goes into the water of the
// trough (grade 4), and a fair test of the water and the air (grade 5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { colorAt, fairResult } from '../src/core/world/trials.js';
import { createI18n } from '../src/core/i18n.js';

const smith = load('data/trials.json').trials.find((t) => t.id === 'smith');
const vi = createI18n(load('i18n/vi.json'), 'vi');

test('the colors of the fire come in order, and a fair test changes only where the piece cools', () => {
  const c = smith.levels[2].colors;
  const seen = [];
  for (let t = 0; t < 9; t += 0.1) if (seen.at(-1) !== colorAt(t, c)) seen.push(colorAt(t, c));
  assert.deepEqual(seen, ['dark', 'cherry', 'orange', 'yellow', 'cool']);
  assert.equal(colorAt(c.dark + 0.1, c), 'cherry');
  assert.deepEqual(fairResult([{ how: 'water', t: 1 }, { how: 'rack', t: 2 }]), { compare: true, fair: true });
  assert.deepEqual(fairResult([{ how: 'water', t: 1 }, { how: 'rack', t: 9 }]), { compare: true, fair: false });
  assert.deepEqual(fairResult([{ how: 'water', t: 1 }, { how: 'water', t: 2 }]), { compare: false, fair: false });
});

// A child at the forge: the talk, the piece that the smith shows, and then the moves of the child
// (cherry, dark, orange, yellow: a press when the iron has that color; water and rack: a piece of the
// fair test; pour: a pail from the jar into the trough).
async function play(grade, moves) {
  const s = load('tests/stories/trial-smith.json');
  s.profile = { ...s.profile, grade };
  let session = null;
  const said = [];
  const events = [];
  const failures = await runHeadless({ ...s, steps: [...s.steps.slice(0, 3), { until: { event: 'hiss', timeout: 40 } }, { until: { event: 'fire', timeout: 10 } }] }, {
    onSession: (x) => {
      session = x;
      x.listen((e) => {
        if (e.type === 'open' && e.textKey) said.push({ key: e.textKey, text: vi.t(e.textKey, e.params ?? {}) });
        if (['skill', 'bend', 'hiss', 'pour', 'rack', 'glow', 'cue'].includes(e.type)) events.push(e);
      });
    },
  });
  const run = (sec, stop) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
      if (stop?.()) return true;
    }
    return false;
  };
  const tz = () => getEntity(session.state, 'zone:trial-smith').zone;
  const still = () => run(2, () => !getEntity(session.state, 'hero').route) && run(1);
  const tapOn = (id) => {
    const e = getEntity(session.state, id);
    session.command({ type: 'tap', target: { thing: e.id } });
    still();
  };
  for (const m of moves) {
    if (m === 'water' || m === 'rack') {
      run(15, () => tz().test && tz().test.check == null && !tz().test.show);
      run(1.2);
      if (m === 'rack') tapOn('rack:smith');
      session.command({ type: 'hands' });
      run(1);
      // The guess before the bend (#127): a pebble by the bar in the water.
      if (tz().test?.guessWait) {
        tapOn(tz().test.tries.find((q) => q.how === 'water').id);
        session.command({ type: 'hands' });
        run(1);
      }
    } else if (m === 'pour') {
      tapOn(getEntity(session.state, 'zone:jar').zone.items[0]);
      session.command({ type: 'hands' });
      run(1);
      const t = getEntity(session.state, 'zone:trough');
      session.command({ type: 'tap', target: session.targetAt(t.position.x / 2, t.position.z / 2) });
      still();
      session.command({ type: 'hands' });
      run(1);
    } else {
      run(10, () => getEntity(session.state, 'iron:smith') && tz().heat !== null);
      tapOn('iron:smith');
      assert.ok(run(30, () => getEntity(session.state, 'iron:smith')?.look === `iron-${m}` && !tz().bent && tz().heat !== null), `the iron turns ${m}`);
      session.command({ type: 'hands' });
      run(2);
    }
  }
  run(6);
  return { session, said, events, failures, zone: tz() };
}

test('each grade gets its forge: the colors from grade 3, with no glow sound and no cue, and three pieces at cherry red', async () => {
  for (const [grade, form] of [[1, 'pulse'], [2, 'pulse'], [3, 'color'], [4, 'water'], [5, 'fair']]) {
    const { zone, said, failures } = await play(grade, []);
    assert.deepEqual(failures, []);
    assert.equal(zone.form, form, `grade ${grade}`);
    if (grade >= 3) {
      const n4 = said.find((l) => l.key.startsWith('dlg.smith.trial.n4'));
      assert.ok(n4.key.endsWith(form === 'fair' ? '.fair' : '.color'), n4.key);
      assert.ok(!/\{|\d/.test(n4.text), n4.text);
    }
  }
  const { zone, events, said } = await play(3, ['cherry', 'cherry', 'cherry']);
  assert.ok(zone.done, 'three hard pieces');
  assert.deepEqual(events.filter((e) => e.type === 'skill').map((e) => [e.skill, e.solved]), Array(3).fill(['sci.matter.materials', true]));
  assert.ok(!events.some((e) => e.type === 'glow'), 'no sound says when');
  assert.ok(!events.some((e) => e.type === 'cue' && e.ids?.some((id) => id.startsWith('iron:'))), 'no cue says when');
  // The smith holds up the gấc next to the hot iron (#120).
  assert.ok(said.some((l) => l.key === 'smith.gac'));
});

test('too early or too late: the piece bends, and the smith says the color that it had', async () => {
  const { said, events, zone } = await play(3, ['orange', 'yellow', 'dark']);
  assert.deepEqual(events.filter((e) => e.type === 'skill').map((e) => e.solved), [false, false, false]);
  const lines = said.map((l) => l.key).filter((k) => k.startsWith('smith.color.'));
  // Each with the right color, while the gấc comes up next to the iron (#127).
  assert.deepEqual(lines, ['smith.color.orange.gac', 'smith.color.yellow.gac', 'smith.color.dark.gac']);
  assert.equal(said.find((l) => l.key === 'smith.color.dark.gac').text, 'Lúc nãy sắt mới đỏ sẫm như hòn than. Đỏ như quả gấc này thì nhúng.');
  assert.ok(!zone.done);
});

test('grade 4: the steam grows with each piece, a piece in the warm water stays soft, and a pail of cold water makes the next piece hard', async () => {
  const warm = await play(4, ['cherry', 'cherry', 'cherry', 'cherry']);
  const skills = warm.events.filter((e) => e.type === 'skill');
  assert.deepEqual(skills.map((e) => [e.skill, e.solved]), [...Array(3).fill(['sci.energy', true]), ['sci.energy', false]]);
  assert.ok(warm.said.some((l) => l.key === 'smith.warm'), warm.said.map((l) => l.key).join(', '));
  assert.equal(getEntity(warm.session.state, 'trough:smith').look, 'trough-steam-3');
  const cold = await play(4, ['cherry', 'cherry', 'cherry', 'cherry', 'pour', 'cherry', 'cherry']);
  assert.ok(cold.events.some((e) => e.type === 'pour'));
  assert.deepEqual(cold.events.filter((e) => e.type === 'skill').map((e) => e.solved), [true, true, true, false, true, true]);
  assert.ok(cold.zone.done, 'five hard pieces');
});

test('grade 5: one piece in the water and one on the rack is a fair test; two pieces the same way is no test, and it comes again', async () => {
  const fair = await play(5, ['water', 'rack', 'cherry', 'cherry']);
  const first = fair.events.find((e) => e.type === 'skill');
  assert.deepEqual([first.skill, first.solved, first.compare, first.fair], ['sci.energy', true, true, true]);
  const keys = fair.said.map((l) => l.key);
  assert.ok(keys.indexOf('smith.fair.right') < keys.indexOf('smith.fair.rest'), keys.join(', '));
  assert.ok(fair.zone.done, 'the test and the rest of the pieces');
  const same = await play(5, ['water', 'water']);
  const ev = same.events.find((e) => e.type === 'skill');
  assert.deepEqual([ev.solved, ev.fair], [false, false]);
  assert.ok(same.said.some((l) => l.key === 'smith.fair.water'));
  assert.ok(same.session.state.entities.some((e) => e.id === 'iron:smith-b'), 'a new pair');
});
