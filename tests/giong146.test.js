// Gióng on his horse after the play test of #140–#145 (#146): he never stands on the work or between
// the camera and the work or the hero, the raid starts with the posts in view, there is one Gióng at
// the share, and he rides next to the child in the village.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { load } from './helpers.js';
import { getEntity, query } from '../src/core/world/state.js';
import { sessionCamera } from '../src/world/hit.js';
import { rayHits, toCamera } from '../src/world/fade.js';
import { VIEW } from '../src/world/view.js';
import { FIGURES, figureBox, THING_HEIGHTS, HERO_HEIGHTS } from '../src/core/world/sight.js';

const AZ = Math.PI / 4; // the view of a story run
const follow = (s) => ({ ...s, profile: { ...s.profile, flags: { ...s.profile.flags, 'giong.grown': true, 'giong.follow': true } } });

// Does the figure e (with its size) hide the point p (half blocks)? The ray test of the fade.
function hidden(e, size, p, heights) {
  const d = toCamera(AZ, VIEW.elevation);
  const box = figureBox(e.position, size);
  return heights.some((h) => rayHits(box, { x: p.x / 2, y: (p.y ?? 0) / 2 + h, z: p.z / 2 }, d));
}

async function at(s) {
  let session = null;
  const failures = await runHeadless(s, { onSession: (x) => { session = x; } });
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

// The longest time (seconds) that the rider Gióng hides one of the points or the hero, in a run.
function watch(h, sec, points) {
  const g = () => getEntity(h.session.state, 'npc:giong-hero');
  let t = 0;
  let most = 0;
  let seen = 0;
  h.run(sec, () => {
    const e = g();
    if (!e || e.hidden) return;
    seen += 1;
    const size = e.afoot ? FIGURES.person : FIGURES.rider;
    const hero = getEntity(h.session.state, 'hero').position;
    const any = points().some((p) => hidden(e, size, p, THING_HEIGHTS)) || hidden(e, size, hero, HERO_HEIGHTS);
    t = any ? t + STEP : 0;
    most = Math.max(most, t);
  });
  return { most, seen };
}

test('at the cart in the mud, the hero at the work: Gióng never hides the hole, the cart, the carter, or the hero for more than one second', async () => {
  const s = follow(load('tests/stories/event-cart.json'));
  const h = await at({ ...s, steps: s.steps.slice(0, 2) });
  const pts = () => h.session.state.entities.filter((e) => e.dayEvent && e.position && !e.hidden).map((e) => e.position)
    .concat(query(h.session.state, 'zone').filter((z) => String(z.zone.task).startsWith('trial-') && Number.isFinite(z.zone.x)).map((z) => ({ x: z.zone.x, y: z.zone.y, z: z.zone.z })));
  const r = watch(h, 12, pts);
  assert.ok(r.seen > 0, 'Gióng is there');
  assert.ok(r.most <= 1, `Gióng hides the work for ${r.most.toFixed(1)} seconds`);
});

test('at the ducks: Gióng never stands on the pen or hides it, and never hides the hero for more than one second', async () => {
  const s = follow(load('tests/stories/event-duck.json'));
  const h = await at({ ...s, steps: s.steps.slice(0, 5) });
  const pts = () => query(h.session.state, 'zone').filter((z) => String(z.zone.task).startsWith('trial-') && Number.isFinite(z.zone.x)).map((z) => ({ x: z.zone.x, y: z.zone.y, z: z.zone.z }));
  assert.ok(pts().length, 'the pen');
  const r = watch(h, 12, pts);
  assert.ok(r.seen > 0, 'Gióng is there');
  assert.ok(r.most <= 1, `Gióng hides the work for ${r.most.toFixed(1)} seconds`);
});

test('at the share: one Gióng, at his mat; no figure on a mat; Gióng never hides a mat or the hero', async () => {
  const s0 = follow(load('tests/stories/raid-soldiers.json'));
  const upto = s0.steps.findIndex((x) => x.expect?.some?.((f) => f.text?.shown === 'share.start'));
  // The story without the rider has the Gióng of the share; here the rider is that Gióng.
  const steps = s0.steps.slice(0, upto + 1).map((x) => (x.expect ? { ...x, expect: x.expect.filter((f) => f.entity !== 'by:share-giong') } : x));
  const h = await at({ ...s0, steps });
  const mats = () => ['hero', 'nghe', 'giong'].map((w) => getEntity(h.session.state, `mat:share-${w}`)?.position).filter(Boolean);
  const r = watch(h, 8, mats);
  assert.equal(mats().length, 3);
  assert.ok(r.most <= 1, `Gióng hides a mat for ${r.most.toFixed(1)} seconds`);
  const giongs = h.session.state.entities.filter((e) => e.look === 'giong-hero' && e.position && !e.hidden);
  assert.equal(giongs.length, 1, giongs.map((e) => e.id).join(', '));
  const g = getEntity(h.session.state, 'npc:giong-hero');
  const by = getEntity(h.session.state, 'zone:share-giong').zone.by;
  assert.ok(Math.hypot(g.position.x - by.x, g.position.z - by.z) < 6, 'Gióng is at his mat');
  assert.ok(g.afoot && getEntity(h.session.state, 'mount:giong-hero')?.hidden !== false, 'on foot; the horse is not by the mats');
  for (const w of ['hero', 'nghe', 'giong']) {
    const rect = getEntity(h.session.state, `zone:share-${w}`).zone.rect;
    for (const e of [g, getEntity(h.session.state, 'friend:nghe')].filter(Boolean)) {
      const q = e.position;
      assert.ok(!(q.x > rect.x0 && q.x < rect.x1 && q.z > rect.z0 && q.z < rect.z1), `${e.id} on the mat of ${w}`);
    }
  }
});

test('at the start of the raid of the soldiers, Gióng speaks first, hides no post and not the hero for more than one second, and is gone in less than three seconds while the first line of the elder is open', async () => {
  for (const name of ['raid-soldiers-traps', 'raid-soldiers-second']) {
    const s = load(`tests/stories/${name}.json`);
    let session = null;
    const said = [];
    const failures = await runHeadless({ ...s, steps: s.steps.slice(0, 3) }, { onSession: (x) => {
      session = x;
      x.listen((ev) => { if (ev.type === 'open' && ev.textKey) said.push({ id: ev.id, key: ev.textKey, gone: !getEntity(x.state, 'companion:raid') }); });
    } });
    assert.deepEqual(failures, []);
    let t = 0;
    let most = 0;
    let gone = null;
    for (let i = 0; i < 8 / STEP; i++) {
      session.step();
      session.events();
      const c = getEntity(session.state, 'companion:raid');
      if (!c) {
        gone ??= i * STEP;
        continue;
      }
      const posts = query(session.state, 'position').filter((e) => String(e.id).startsWith('post:')).map((e) => e.position);
      const hero = getEntity(session.state, 'hero').position;
      const any = posts.some((p) => hidden(c, FIGURES.rider, p, THING_HEIGHTS)) || hidden(c, FIGURES.rider, hero, HERO_HEIGHTS);
      t = any ? t + STEP : 0;
      most = Math.max(most, t);
    }
    assert.ok(most <= 1, `${name}: Gióng hides a post or the hero for ${most.toFixed(1)} seconds`);
    const first = said.findIndex((l) => l.key === 'giong.raid.ahead');
    assert.ok(first >= 0, said.map((l) => l.key).join(', '));
    const elder = said.findIndex((l) => /^raid\.(rule|tool|trap)/.test(l.key));
    assert.ok(elder < 0 || first < elder, `${name}: Gióng speaks first: ${said.map((l) => l.key).join(', ')}`);
    assert.ok(gone !== null && gone < 3, `${name}: Gióng is gone after ${gone} seconds`);
  }
});

test('in the village after "Có!", Gióng rides next to the child: in the view of the phone for at least 9 of 10 looks in a walk of one minute', async () => {
  const s = follow(load('tests/stories/event-cart.json'));
  const h = await at({ ...s, steps: [] });
  const hero = () => getEntity(h.session.state, 'hero');
  const g = () => getEntity(h.session.state, 'npc:giong-hero');
  let looks = 0;
  let seen = 0;
  // Taps on the ground far away, one after the other, as a child walks around.
  const turns = [[30, 0], [0, 30], [-30, 0], [0, -30]];
  for (let k = 0; k < 4; k++) {
    const c = { x: hero().position.x / 2 + turns[k][0], y: hero().position.z / 2 + turns[k][1] };
    h.session.command({ type: 'tap', target: { ground: { x: c.x, y: c.y, h: 3, thing: false, object: null } } });
    let i = 0;
    h.run(15, () => {
      i += 1;
      if (i % 45 !== 0 || !hero().route) return;
      looks += 1;
      const e = g();
      if (!e || e.hidden) return;
      const q = sessionCamera(h.session).project(e.position.x / 2, e.position.y / 2 + 1, e.position.z / 2);
      if (q.x > 0 && q.x < 390 && q.y > 0 && q.y < 844) seen += 1;
    });
  }
  assert.ok(looks >= 10, `${looks} looks`);
  assert.ok(seen / looks >= 0.9, `Gióng is in the view for ${seen} of ${looks} looks`);
});
