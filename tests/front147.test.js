// Figures in front of the work after the play test of #140–#145 (#147): a figure that stands
// between the camera and a thing that the child must see draws pale and see-through, the stones of
// the cart lie in a row that a child can count, Gióng grows in sight, and Nghé keeps out of a small
// event.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query, command as worldCommand } from '../src/core/world/state.js';
import { sessionCamera } from '../src/world/hit.js';
import { rayHits, toCamera } from '../src/world/fade.js';
import { VIEW } from '../src/world/view.js';
import { figureBox, sizeOf, THING_HEIGHTS, seeThrough } from '../src/core/world/sight.js';

const AZ = Math.PI / 4; // the view of a story run

async function at(s, steps) {
  let session = null;
  const failures = await runHeadless({ ...s, steps }, { onSession: (x) => { session = x; } });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  const run = (sec, each = () => {}) => {
    for (let i = 0; i < sec / STEP; i++) {
      if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      session.step();
      session.events();
      each();
    }
  };
  return { session, run };
}

// The figures that hide one of the things (ids) from the camera, and are not in the fade. Since
// #158 people step aside and only things fade, and the hero is never pale: the hero has the rules of
// the stand at the work (besideWork, anvilStand, tests/smith127.test.js), so the hero is
// not one of the figures here.
function covering(session, ids) {
  const d = toCamera(AZ, VIEW.elevation);
  const faded = session.seeThrough();
  const out = [];
  for (const id of ids) {
    const t = getEntity(session.state, id)?.position;
    if (!t) continue;
    for (const e of session.state.entities) {
      const size = sizeOf(e);
      if (e.id === 'hero') continue;
      if (!size || e.id === id || Math.hypot(e.position.x - t.x, e.position.z - t.z) <= size.r * 2 + 0.6) continue;
      const box = figureBox(e.position, size);
      if (THING_HEIGHTS.some((h) => rayHits(box, { x: t.x / 2, y: t.y / 2 + h, z: t.z / 2 }, d)) && !faded.has(e.id)) out.push(`${e.id} over ${id}`);
    }
  }
  return out;
}
// In a run of sec seconds, each step: no figure that is not in the fade hides one of the things.
function watch(h, sec, things) {
  const bad = new Set();
  h.run(sec, () => {
    if (h.session.state.tick % 5) return;
    for (const b of covering(h.session, things())) bad.add(b);
  });
  return [...bad];
}

test('the rule: a figure whose box hides a point of the work fades; a point in its own body does not count', () => {
  const hero = { x: 0, y: 0, z: 0 };
  // The camera is toward (sin, cos) of AZ: a point behind the hero from the camera.
  const behind = { x: -2, y: 0, z: -2 };
  const figs = [{ id: 'hero', position: hero, size: { r: 0.55, h: 2 } }];
  assert.deepEqual([...seeThrough(figs, [behind], AZ, VIEW.elevation)], ['hero']);
  assert.deepEqual([...seeThrough(figs, [{ x: 0.2, y: 0, z: 0.2 }], AZ, VIEW.elevation)], [], 'the hero itself');
  assert.deepEqual([...seeThrough(figs, [{ x: 3, y: 0, z: 3 }], AZ, VIEW.elevation)], [], 'a point in front of the hero');
});

test('the quench at grade 1: no figure hides the iron unless it fades', async () => {
  const s = load('tests/stories/trial-smith.json');
  const upto = s.steps.findIndex((x) => x.until?.event === 'hiss');
  const h = await at(s, s.steps.slice(0, upto));
  const iron = () => query(h.session.state, 'item').filter((e) => e.item.kind === 'iron').map((e) => e.id);
  assert.ok(iron().length, 'the iron');
  assert.deepEqual(watch(h, 6, iron), []);
});

test('the pieces of the woodcutter: no figure hides a piece unless it fades', async () => {
  const s = load('tests/stories/woodcutter-long.json');
  const upto = s.steps.findIndex((x) => x.until?.with?.key === 'woodcutter.long');
  const h = await at(s, s.steps.slice(0, upto + 1));
  const pieces = () => query(h.session.state, 'item').filter((e) => /^piece|^stem/.test(e.id) || e.item.kind === 'piece').map((e) => e.id);
  assert.deepEqual(watch(h, 6, pieces), []);
});

test('the ferry: no figure hides the dog, the chicken, or the rice unless it fades', async () => {
  const s = load('tests/stories/puzzle-ferry.json');
  const h = await at(s, s.steps);
  const things = () => ['pz:dog', 'pz:chicken', 'pz:rice'];
  assert.ok(getEntity(h.session.state, 'pz:dog'), 'the dog');
  assert.deepEqual(watch(h, 6, things), []);
});

test('the cart at grade 1: the stones lie in rows of six across the view, each on the screen and clear of the cart; no figure hides them unless it fades; Nghé keeps out of the cart and the carter', async () => {
  const s = load('tests/stories/event-cart.json');
  const h = await at(s, s.steps.slice(0, 5));
  h.run(3);
  const place = getEntity(h.session.state, 'zone:event-cart-place').zone;
  const pile = getEntity(h.session.state, 'zone:event-cart-pile').zone;
  // Put the stones of the pile on the place, one after the other (the hands of the hero).
  const hero = getEntity(h.session.state, 'hero');
  for (const id of [...pile.items].slice(0, 5)) {
    Object.assign(hero.position, { x: pile.x + 1, z: pile.z + 1 });
    worldCommand(h.session.state, { type: 'pick', id: 'hero', item: id });
    h.run(0.3);
    Object.assign(hero.position, { x: place.x + 1, z: place.z + 2.5 });
    worldCommand(h.session.state, { type: 'put', id: 'hero', zone: place.id });
    h.run(0.3);
  }
  assert.equal(place.items.length, 5, 'five stones on the place');
  h.session.command({ type: 'wave' });
  h.run(1);
  const stones = place.items.map((id) => getEntity(h.session.state, id));
  const cart = getEntity(h.session.state, 'event:cart:cart');
  const cam = sessionCamera(h.session);
  const pts = stones.map((e) => cam.project(e.position.x / 2, e.position.y / 2, e.position.z / 2));
  for (const q of pts) assert.ok(q.x > 0 && q.x < 390 && q.y > 0 && q.y < 844, `a stone off the screen: ${Math.round(q.x)}, ${Math.round(q.y)}`);
  // A space between two stones on the screen: a child counts them.
  const sorted = [...pts].sort((a, b) => a.x - b.x);
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i].x - sorted[i - 1].x > 12, `two stones ${Math.round(sorted[i].x - sorted[i - 1].x)} points apart`);
  // The cart does not cover a stone: no stone is under the box of the cart from the camera.
  const d = toCamera(AZ, VIEW.elevation);
  const box = figureBox(cart.position, { r: 1.1, h: 1.6 });
  for (const e of stones) assert.ok(!rayHits(box, { x: e.position.x / 2, y: e.position.y / 2 + 0.2, z: e.position.z / 2 }, d), `${e.id} under the cart`);
  assert.deepEqual(watch(h, 4, () => place.items), []);
  // Nghé keeps out of the cart and the carter.
  const nghe = query(h.session.state, 'follow')[0];
  for (const id of ['event:cart', 'event:cart:cart']) {
    const p = getEntity(h.session.state, id).position;
    assert.ok(Math.hypot(nghe.position.x - p.x, nghe.position.z - p.z) > 1.6, `Nghé on ${id}`);
  }
});

test('at ten bowls, Gióng is the point of the line: the view shows him, he glows, he stretches up one head, and no figure hides him unless it fades', async () => {
  const s = load('tests/stories/rice-giong.json');
  let session = null;
  let grew = null;
  const failures = await runHeadless(s, { onSession: (x) => {
    session = x;
    x.listen((e) => {
      if (e.type === 'workView' && e.key === 'grow-boy' && !grew) {
        const boy = query(x.state, 'person').find((p) => p.person.ref === 'giong-boy');
        grew = { boy: boy?.id, stretch: boy?.stretch, faded: [...x.seeThrough()] };
      }
    });
  } });
  assert.deepEqual(failures, []);
  assert.ok(grew, 'a view of Gióng at ten bowls');
  assert.ok(grew.stretch >= 1, `he stretches: ${grew.stretch}`);
  assert.ok(session);
});

test('the packet that bà lang names at grade 4: no figure hides it unless it fades', async () => {
  const s = load('tests/stories/trial-healer.json');
  const first = s.steps.findIndex((x) => x.read === true) + 1;
  const h = await at({ ...s, profile: { ...s.profile, grade: 4 } }, [...s.steps.slice(0, first), { until: { event: 'call', with: { key: 'mentor.first.you' }, timeout: 90 } }, { wait: 2 }]);
  const zone = (id) => getEntity(h.session.state, `zone:${id}`)?.zone;
  const press = (sec = 1.5) => { h.session.command({ type: 'hands', id: h.session.action()?.id }); h.run(sec); };
  const put = (k) => {
    const id = zone(`bed-${k}`).items.find((x) => !getEntity(h.session.state, x)?.item.held);
    h.session.command({ type: 'tap', target: { thing: id } });
    h.run(4);
    press();
    if (getEntity(h.session.state, 'hero').hands?.holds) press();
  };
  for (const k of ['ngai', 'tiato']) put(k);
  h.session.command({ type: 'tap', target: { person: 'npc:healer' } });
  h.run(4);
  press(20);
  h.session.command({ type: 'wave' });
  let seen = false;
  const bad = new Set();
  for (let i = 0; i < 15 / STEP && !seen; i++) {
    h.run(STEP);
    seen = h.session.work()?.key === 'packet';
  }
  assert.ok(seen, 'the view of the packet');
  h.run(2, () => {
    if (h.session.state.tick % 5) return;
    for (const b of covering(h.session, zone('leaf-0').items)) bad.add(b);
  });
  assert.deepEqual([...bad], []);
});
