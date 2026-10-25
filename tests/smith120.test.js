// The smith after the play test of #105 to #114 (#120): colors named by things of the village, a
// word after each bar, the bars apart from the iron of the gift, and the fair test in view with its
// reason.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { createI18n } from '../src/core/i18n.js';

const vi = createI18n(load('i18n/vi.json'), 'vi');

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
        if (['skill', 'bend', 'hiss', 'pour', 'rack', 'glow', 'cue', 'workView'].includes(e.type)) events.push(e);
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
  for (const [i, m] of moves.entries()) {
    if (m === 'water' || m === 'rack') {
      run(15, () => tz().test && tz().test.check == null && !tz().test.show);
      run(1.2);
      if (m === 'rack') tapOn('rack:smith');
      session.command({ type: 'hands' });
      run(1);
      // The guess before the bend (#127): a pebble by the bar in the water, or by the bar on the
      // rack when the next move is 'guess-rack'.
      if (tz().test?.guessWait) {
        const how = moves[i + 1] === 'guess-rack' ? 'rack' : 'water';
        tapOn(tz().test.tries.find((q) => q.how === how).id);
        session.command({ type: 'hands' });
        run(1);
      }
    } else if (m === 'guess-rack') {
      continue;
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
  return { session, said, events, failures, zone: tz(), run };
}


test('no line of the smith says "anh đào", and the colors are things of the village', () => {
  const lines = load('i18n/vi.json');
  for (const [k, v] of Object.entries(lines)) {
    if (!/smith/.test(k)) continue;
    assert.ok(!/anh đào/.test(v), `${k}: ${v}`);
  }
  assert.match(lines['dlg.smith.trial.n4.color'], /quả gấc/);
});

test('grade 3: the first quench shows the gấc next to the hot iron; each bar gets its word; the pips of the bars and the iron of the gift are two counts', async () => {
  const { session, said, zone } = await play(3, ['cherry', 'dark', 'cherry']);
  assert.ok(getEntity(session.state, 'gac:smith'), 'a gấc on the bench');
  const k = said.map((l) => l.key);
  assert.ok(k.includes('smith.gac'), k.join(', '));
  assert.equal(k.filter((x) => x === 'smith.good').length, 2, k.join(', '));
  assert.ok(k.includes('smith.color.dark.gac'));
  assert.deepEqual(session.workCount(), { pip: 'bar', have: 2, need: 3 });
  assert.ok(!zone.done);
});

test('grade 3: the line of the gift comes after the last bar', async () => {
  const { said, zone } = await play(3, ['cherry', 'cherry', 'cherry']);
  const k = said.map((l) => l.key);
  assert.ok(zone.done);
  assert.ok(k.includes('smith.gift'), k.join(', '));
  assert.ok(k.lastIndexOf('smith.good') < k.indexOf('smith.gift'), 'after the bars');
  assert.equal(said.find((l) => l.key === 'smith.gift').text, 'Bác cho cháu hai thanh sắt.');
});

test('grade 5: the smith bends the two bars one after the other in view, says what each did, and then why; a wave after the line of the rest gives the step of the rest', async () => {
  const { session, said, events, run } = await play(5, ['water', 'rack']);
  run(16);
  const k = said.map((l) => l.key);
  const view = events.find((e) => e.type === 'workView' && e.key === 'smith-bend');
  assert.ok(view && view.points.length >= 2, 'the view frames the bars');
  const a = k.indexOf('smith.fair.bar.water');
  const b = k.indexOf('smith.fair.bar.rack');
  const why = k.findIndex((x) => x.startsWith('smith.fair.why'));
  assert.ok(a >= 0 && b >= 0 && why > Math.max(a, b), k.join(', '));
  assert.ok(k.includes('smith.fair.rest'), k.join(', '));
  session.command({ type: 'wave' });
  run(6);
  const after = said.map((l) => l.key).slice(k.length);
  assert.ok(!after.includes('mentor.show.smith.fair'), after.join(', '));
});
