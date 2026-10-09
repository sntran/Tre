// The smith (#70): the hot iron looks red and only red, the child sees the anvil, and a miss says
// why.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ironLook } from '../src/core/world/systems/work.js';
import { glowAt, quenchResult } from '../src/core/world/trials.js';
import { figureOf } from '../src/world/figures.js';
import { load } from './helpers.js';

const trials = load('data/trials.json');
const looks = load('data/figures.json').figures;
const smith = trials.trials.find((t) => t.id === 'smith');

test('the iron has the hot look if and only if a quench at that glow is right', () => {
  for (const level of smith.levels) {
    const cycle = smith.glow.rise + level.hold + smith.glow.dim + smith.glow.cold;
    for (let t = 0; t <= cycle; t += 0.01) {
      const value = glowAt(t, smith.glow, level.hold);
      assert.equal(ironLook(value, smith.glow) === 'iron-hot', quenchResult(value, smith.glow), `glow ${value.toFixed(3)} at ${t.toFixed(2)} s`);
    }
  }
});

test('the iron is never yellow: grey when cold, dark red-brown when warm, bright red when hot', () => {
  const colors = (key) => figureOf(looks[key]).parts.map((p) => p.color);
  for (const key of ['iron-0', 'iron-warm', 'iron-hot']) {
    assert.ok(looks[key], key);
    assert.ok(!colors(key).some((c) => /^yellow/.test(c)), `${key}: ${colors(key).join(' ')}`);
  }
  const bar = (key) => figureOf(looks[key]).parts.find((p) => p.name === 'bar').color;
  assert.deepEqual(['iron-0', 'iron-warm', 'iron-hot'].map(bar), ['ash', 'wood', 'vermilion']);
  assert.ok(figureOf(looks['iron-hot']).parts.some((p) => p.name.startsWith('spark')), 'sparks over the hot iron');
});

// The session of the trial of the smith after his start talk (the story trial-smith up to its
// first read), with the iron of the child on the anvil.
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { getEntity } from '../src/core/world/state.js';

async function atAnvil() {
  const story = load('tests/stories/trial-smith.json');
  const first = story.steps.findIndex((s) => s.read === true);
  let session = null;
  const failures = await runHeadless({ ...story, steps: story.steps.slice(0, first + 1) }, { onSession: (s) => { session = s; } });
  assert.deepEqual(failures, []);
  run(session, 60, () => Boolean(getEntity(session.state, 'iron:smith')) && !session.state.entities.some((e) => e.script));
  return session;
}
function run(session, seconds, until = () => false) {
  for (let i = 0; i < seconds / STEP && !until(); i++) {
    if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
    session.step();
    session.events();
  }
}
const iron = (session) => getEntity(session.state, 'iron:smith');

test('a miss says why: too early, the iron was not hot enough; too late, it got cold', async () => {
  for (const [when, key] of [['early', 'smith.bend.early'], ['late', 'smith.bend.late']]) {
    const session = await atAnvil();
    const lines = [];
    session.listen((ev) => { if (ev.type === 'open' && ev.screen === 'callout' && ev.id === 'npc:smith') lines.push(ev.textKey); });
    // The hero at the anvil.
    session.command({ type: 'tap', target: { thing: 'iron:smith' } });
    session.events();
    run(session, 15, () => !getEntity(session.state, 'hero').route);
    // Early: the iron is warm and still rises. Late: the iron was hot and is cold again.
    if (when === 'early') run(session, 20, () => iron(session).look === 'iron-warm' && (iron(session).glow ?? 0) < 0.5);
    else {
      run(session, 20, () => iron(session).look === 'iron-hot');
      run(session, 20, () => iron(session).look === 'iron-0');
    }
    session.command({ type: 'hands' });
    session.events();
    run(session, 3);
    assert.ok(iron(session).look === 'iron-bent' || lines.includes(key), `${when}: ${iron(session).look}`);
    assert.ok(lines.includes(key), `${when}: ${lines.join(' ')}`);
  }
});

test('the picture of another station comes only after the iron of the child was hot one time', async () => {
  const session = await atAnvil();
  const lines = [];
  session.listen((ev) => { if (ev.type === 'open' && ev.screen === 'callout' && ev.id === 'npc:smith') lines.push(ev.textKey); });
  session.command({ type: 'tap', target: { thing: 'iron:smith' } });
  session.events();
  run(session, 15, () => !getEntity(session.state, 'hero').route);
  // Three quick misses before the iron is ever hot.
  const glows = [];
  session.listen((ev) => { if (ev.type === 'glow') glows.push(ev.id); });
  for (let k = 0; k < 3; k++) {
    run(session, 10, () => iron(session).look !== 'iron-bent');
    // The button settles on the drop again (0.6 seconds, #60).
    run(session, 0.7);
    session.command({ type: 'hands' });
    session.events();
    run(session, 0.5);
  }
  run(session, 0.5);
  assert.deepEqual(glows, [], 'the iron was never hot');
  assert.ok(!lines.includes('mentor.picture.smith'), lines.join(' '));
});
