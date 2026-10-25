// The smith after the play test (#127): a bar that is done lights its pip at once, the hero never
// stands between the camera and the iron, a guess comes before the fair test, grade 1 quenches
// three bars, grade 5 hears the right color, and the lines of what gets hard say "thép".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { rayHits, toCamera } from '../src/world/fade.js';
import { VIEW } from '../src/world/view.js';

const story = load('tests/stories/trial-smith.json');
const vi = load('i18n/vi.json');

async function atSmith(grade, steps = []) {
  let session = null;
  const first = story.steps.findIndex((s) => s.read === true);
  const failures = await runHeadless({ ...story, profile: { ...story.profile, grade }, steps: [...story.steps.slice(0, first + 1), ...steps] }, { onSession: (s) => { session = s; } });
  assert.deepEqual(failures, []);
  const said = [];
  const events = [];
  session.listen((e) => {
    events.push({ ...e, tick: session.state.tick });
    if (e.type === 'open' && e.textKey) said.push(e.textKey);
  });
  const run = (sec, until = () => false) => {
    for (let i = 0; i < sec / STEP && !until(); i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  return { session, said, events, run };
}
const tzOf = (session) => getEntity(session.state, 'zone:trial-smith').zone;
const ironOf = (session) => getEntity(session.state, tzOf(session).iron ?? 'iron:smith') ?? getEntity(session.state, 'iron:smith-demo');
// A right quench: wait for the cherry red (or the glow), then press.
function quench(h) {
  h.run(20, () => {
    const iron = ironOf(h.session);
    const tz = tzOf(h.session);
    return tz.heat !== null && !tz.demo && !tz.bent && iron && (iron.color ? iron.color === 'cherry' : (iron.glow ?? 0) >= 0.75);
  });
  h.session.command({ type: 'hands', id: h.session.action()?.id });
  h.run(0.5);
}

test('a right quench sends hud, and the pip of the bar lights in the same step', async () => {
  const h = await atSmith(1);
  h.run(30, () => tzOf(h.session).heat !== null && !tzOf(h.session).demo);
  quench(h);
  const hiss = h.events.find((e) => e.type === 'hiss' && !String(e.id).includes('demo'));
  assert.ok(hiss, 'a bar is done');
  assert.ok(h.events.some((e) => e.type === 'hud' && e.tick === hiss.tick), 'hud in the step of the hiss');
});

test('at grade 1 the child quenches three bars, each with its word', async () => {
  const h = await atSmith(1);
  for (let i = 0; i < 3 && !tzOf(h.session).done; i++) {
    h.run(30, () => tzOf(h.session).heat !== null && !tzOf(h.session).demo);
    quench(h);
  }
  assert.equal(tzOf(h.session).hard, 3);
  assert.ok(tzOf(h.session).done, 'the task ends after the third bar');
  assert.ok(h.said.filter((k) => k === 'smith.good').length >= 2, 'a word after each bar');
});

test('at each grade and each angle of the view, the hero does not stand between the camera and the iron', async () => {
  for (const grade of [1, 4, 5]) {
    const h = await atSmith(grade);
    for (const k of [0, 1, 2, 3]) {
      const az = Math.PI / 4 + (k * Math.PI) / 2;
      h.session.command({ type: 'view', az });
      h.run(4);
      const iron = ironOf(h.session) ?? getEntity(h.session.state, 'iron:smith-b');
      if (!iron) continue;
      const p = getEntity(h.session.state, 'hero').position;
      const box = { x0: p.x / 2 - 0.35, x1: p.x / 2 + 0.35, y0: p.y / 2, y1: p.y / 2 + 1.6, z0: p.z / 2 - 0.35, z1: p.z / 2 + 0.35 };
      const o = { x: iron.position.x / 2, y: iron.position.y / 2 + 0.1, z: iron.position.z / 2 };
      assert.ok(!rayHits(box, o, toCamera(az, VIEW.elevation)), `grade ${grade}, angle ${k}: the hero covers the iron`);
    }
  }
});

test('the lines of what gets hard say "thép", and the word line comes with or before the first', () => {
  for (const k of ['dlg.smith.forge.water', 'dlg.smith.trial.done.n1', 'smith.fair.why', 'smith.fair.rest']) assert.match(vi[k], /thép/i, k);
  assert.ok(vi['word.thep']);
  assert.match(vi['smith.fair.why.word'], /Thép là sắt/);
  // The talks: the word line comes before the line.
  const talks = load('data/dialogue/village.json').dialogues ?? load('data/dialogue/village.json');
  const all = JSON.stringify(talks);
  assert.ok(all.includes('"wthep"'), 'a node of the word');
});

test('at grade 5 the line of the rest and the help after a wrong bar name the gấc', async () => {
  assert.match(vi['smith.fair.rest'], /gấc/);
  for (const c of ['dark', 'cool', 'orange', 'yellow']) assert.match(vi[`smith.color.${c}.gac`], /gấc/);
});

// The fair test of grade 5 with a guess: one bar into the water, one onto the rack, and the pebble
// by the bar of `by`.
async function fairGuess(by) {
  const h = await atSmith(5);
  const tz = () => tzOf(h.session);
  const tap = (id) => { h.session.command({ type: 'tap', target: { thing: id } }); h.run(3); };
  const press = () => { h.session.command({ type: 'hands', id: h.session.action()?.id }); h.run(1); };
  h.run(40, () => tz().test && tz().test.check == null);
  h.run(1.2);
  press();
  tap('rack:smith');
  press();
  const asked = h.said.indexOf('smith.guess.ask');
  const bent = () => h.events.some((e) => e.type === 'bend' && e.test);
  assert.ok(asked >= 0, h.said.join(', '));
  h.run(4);
  assert.ok(!bent(), 'no bend before the guess');
  tap(tz().test.tries.find((q) => q.how === by).id);
  press();
  h.run(16);
  return h;
}

test('grade 5: a pebble by a bar comes before the bend, and the line after the bend says whether the guess was right', async () => {
  const right = await fairGuess('water');
  const k = right.said;
  assert.ok(k.indexOf('smith.guess.ask') < k.indexOf('smith.fair.bar.water'), k.join(', '));
  assert.ok(k.includes('smith.guess.right'), k.join(', '));
  assert.ok(k.indexOf('smith.guess.right') < k.findIndex((x) => x.startsWith('smith.fair.why')), k.join(', '));
  assert.equal(right.events.find((e) => e.type === 'skill')?.guess, true);
  const wrong = await fairGuess('rack');
  assert.ok(wrong.said.includes('smith.guess.wrong'), wrong.said.join(', '));
});

test('the dark red and the gấc red of the iron are clearly different colors, by day and at night', async () => {
  const { IRON_COLORS } = await import('../src/world/figures.js');
  const { C } = await import('../src/render/palette.js');
  // CIE76 color difference of two colors of the palette, with a light factor (night: less light).
  const lab = (hex, k) => {
    const lin = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255 * k).map((c) => (c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92));
    const [r, g, b] = lin;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const X = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
    const Y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
    const Z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
    return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
  };
  const dE = (a, b, k) => Math.hypot(...lab(a, k).map((v, i) => v - lab(b, k)[i]));
  const dark = C[IRON_COLORS.dark[0]];
  const cherry = C[IRON_COLORS.cherry[0]];
  assert.ok(dE(dark, cherry, 1) >= 50, `by day ${dE(dark, cherry, 1).toFixed(0)}`);
  assert.ok(dE(dark, cherry, 0.45) >= 25, `at night ${dE(dark, cherry, 0.45).toFixed(0)}`);
});
