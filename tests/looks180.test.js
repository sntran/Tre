// What the child sees (#180): a tap on the iron horse says what it is; the bubble at the growth does
// not cover Gióng; the hero is never an outline behind Gióng or the iron horse (they draw pale); on
// Nghé, the talk of Gióng who rides along is not the button; and the portrait opens the notebook.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query } from '../src/core/world/state.js';
import { placeBubble } from '../src/world/marks.js';

async function play(name, upto = 0) {
  const s0 = load(`tests/stories/${name}.json`);
  let session = null;
  const said = [];
  const failures = await runHeadless({ ...s0, steps: s0.steps.slice(0, upto) }, { onSession: (x) => {
    session = x;
    x.listen((e) => { if (e.type === 'open' && e.textKey) said.push(e); });
  } });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  const run = (sec) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
    }
  };
  return { session, said, run };
}

test('a tap on the iron horse says "Ngựa sắt của Gióng."', async () => {
  const s0 = load('tests/stories/forge-horse.json');
  const h = await play('forge-horse', s0.steps.length);
  const steed = getEntity(h.session.state, 'steed:giong');
  assert.ok(steed, 'the iron horse');
  const from = h.said.length;
  h.session.command({ type: 'tap', target: { ground: { x: steed.position.x / 2, y: steed.position.z / 2, h: steed.position.y / 2, thing: false, object: null } } });
  h.run(1);
  assert.ok(h.said.slice(from).some((e) => e.textKey === 'steed.name'), h.said.slice(from).map((e) => e.textKey).join(', '));
  assert.equal(load('i18n/vi.json')['steed.name'], 'Ngựa sắt của Gióng.');
});

test('a bubble does not cover the figure that its line names', () => {
  const screen = { w: 390, h: 844, top: 0, bottom: 844 };
  const giong = { x0: 170, x1: 220, y0: 260, y1: 420 };
  // The speaker stands beside Gióng: over her head, the bubble would cover his head.
  const b = placeBubble({ x: 230, y: 330 }, 160, 60, { screen, work: [giong] });
  const overlaps = !(b.x1 <= giong.x0 || b.x0 >= giong.x1 || b.y1 <= giong.y0 || b.y0 >= giong.y1);
  assert.ok(!overlaps, JSON.stringify(b));
});

test('the line of the growth names Gióng, so that its bubble does not cover him', () => {
  const src = readFileSync(new URL('../src/core/session.js', import.meta.url), 'utf8');
  assert.match(src, /riceLine\(n \? 'rice\.grow\.rest' : 'rice\.grow', n, \[pot\.id\], pot\.position, boy \? \[boy\.id\] : \[\]\)/);
  const ui = readFileSync(new URL('../src/ui/village.js', import.meta.url), 'utf8');
  assert.match(ui, /showBubble\(ev\.id, [^\n]*, ev\.avoid \?\? \[\]\)/);
});

test('Gióng in front of the hero who rides Nghé draws pale: the hero is never an outline behind him', async () => {
  const h = await play('way-trau-son');
  h.run(2);
  const g = getEntity(h.session.state, 'npc:giong-hero');
  assert.ok(g, 'Gióng rides with the hero');
  const hero = getEntity(h.session.state, 'hero');
  hero.riding = query(h.session.state, 'follow').find((f) => f.follow.target === 'hero')?.id;
  // Gióng between the hero and the camera (the camera looks from the side of the angle of the view).
  const az = h.session.viewAz?.() ?? Math.PI / 4;
  const put = () => Object.assign(g.position, { x: hero.position.x + Math.sin(az) * 3, z: hero.position.z + Math.cos(az) * 3 });
  let pale = false;
  for (let i = 0; i < 20 && !pale; i++) {
    put();
    h.session.step();
    h.session.events();
    pale = h.session.seeThrough().has('npc:giong-hero');
  }
  assert.ok(pale, 'Gióng draws pale');
});

test('on Nghé beside Gióng, the button stays the get off; a tap on Gióng gives his talk', async () => {
  const h = await play('way-trau-son');
  h.run(2);
  const hero = getEntity(h.session.state, 'hero');
  const g = getEntity(h.session.state, 'npc:giong-hero');
  const nghe = query(h.session.state, 'follow').find((f) => f.follow.target === 'hero');
  assert.ok(nghe && g, 'Nghé and Gióng');
  hero.riding = nghe.id;
  Object.assign(g.position, { x: hero.position.x + 2, z: hero.position.z });
  h.session.step();
  h.session.events();
  assert.equal(h.session.action()?.act, 'ride-off', `the button: ${h.session.action()?.act}`);
  h.session.command({ type: 'tap', target: { person: g.id } });
  h.session.step();
  h.session.events();
  assert.equal(h.session.action()?.act, 'talk');
});

test('the portrait at the top opens the notebook, and a touch on it does not go to the world', () => {
  const ui = readFileSync(new URL('../src/ui/village.js', import.meta.url), 'utf8');
  const i = ui.indexOf("heroFace.addEventListener('click'");
  const block = ui.slice(i, ui.indexOf('\n  });', i));
  assert.match(block, /modals\.notebook/);
  assert.doesNotMatch(block, /talkTo/);
  assert.match(ui, /heroFace\.addEventListener\(type, \(e\) => e\.stopPropagation\(\)\)/);
});
