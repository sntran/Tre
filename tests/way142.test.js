// The way to Trâu Sơn after the play test of #135–#139 (#142): a tap on the star walks to the next
// person of the way, then into the area, and then to the soldiers; each clue comes from a person on
// the screen; Gióng rides in front of the child; the map of the village has the star on its edge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runHeadless, data } from './story-run.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';
import { questMark, MET } from '../src/core/clues.js';
import { sessionCamera } from '../src/world/hit.js';
import { villageMapItems } from '../src/world/minimap.js';
import { createI18n } from '../src/core/i18n.js';

const story = JSON.parse(readFileSync(new URL('./stories/find-trau-son.json', import.meta.url), 'utf8'));
const soldier = load('data/maps/trau-son.json').encounters.find((e) => e.id === 'soldier1');
const [sx, sy] = data.world.at('trau-son', soldier.x, soldier.y);

// The walk with taps on the star alone, from the east gate. Return what happened.
async function walk(grade, clock) {
  let session = null;
  const profile = { ...story.profile, grade, flags: { ...story.profile.flags, 'giong.follow': true } };
  await runHeadless({ name: 'way-142', profile, clock, at: ['phu-dong', 82.5, 30.5], steps: [] }, { onSession: (x) => { session = x; } });
  const hero = () => getEntity(session.state, 'hero');
  const cell = () => ({ x: hero().position.x / 2, y: hero().position.z / 2 });
  const spotOf = (id) => {
    const e = getEntity(session.state, `way:${id}`);
    return e ? { x: e.position.x / 2, y: e.position.z / 2 } : null;
  };
  const got = { taps: 0, clues: [], unseen: [], stops: [], seen: 0, walked: 0, edge: null, lantern: false };
  let said = false;
  session.listen((ev) => {
    if (ev.type === 'clue') {
      got.clues.push(ev.textKey);
      const p = getEntity(session.state, ev.id);
      const q = sessionCamera(session).project(p.position.x / 2, p.position.y / 2 + 1, p.position.z / 2);
      if (!(q.x > 0 && q.x < 390 && q.y > 0 && q.y < 844)) got.unseen.push(ev.textKey);
      if (p.carry === 'lantern') got.lantern = true;
    }
    if (ev.type === 'open' && ev.screen === 'callout' && String(ev.id).startsWith('way:')) said = true;
  });
  const near = () => Math.hypot(cell().x - sx, cell().y - sy) < 8;
  let idle = 0;
  for (let k = 0; k < 30 * 60 * 12 && !near(); k++) {
    const screen = session.screen;
    if (screen === 'dialogue' || screen === 'say') session.command({ type: 'next' });
    else if (screen) session.command({ type: 'close' });
    idle = hero().route || hero().aboard || screen ? 0 : idle + 1;
    if (idle > 60) {
      // A stop: a person of the way said a line here, or the hero came into the area.
      if (got.taps) got.stops.push({ said, found: Boolean(session.profile.flags['trauson.found']), at: cell() });
      said = false;
      const m = questMark(data.clues, data.world.at, session.profile.flags, { x: sx, y: sy, h: 3 }, cell(), spotOf);
      // The map of the village: the star of the goal on its edge, when it is out of the map.
      if (!got.edge && Math.hypot(m.x - cell().x, m.y - cell().y) > 40) got.edge = villageMapItems(cell(), [], [m]).find((i) => i.kind === 'star');
      session.command({ type: 'tap', target: { ground: { x: m.x, y: m.y, h: 3, thing: false, object: null, goal: true } } });
      got.taps += 1;
      idle = 0;
    }
    session.step();
    session.events();
    // Gióng in the view while the hero walks the way.
    if (hero().route && k % 30 === 0 && !session.profile.flags['trauson.found']) {
      const g = getEntity(session.state, 'npc:giong-hero');
      got.walked += 1;
      if (g && !g.hidden) {
        const q = sessionCamera(session).project(g.position.x / 2, g.position.y / 2 + 1, g.position.z / 2);
        if (q.x > 0 && q.x < 390 && q.y > 0 && q.y < 844) got.seen += 1;
      }
    }
  }
  got.near = near();
  got.found = Boolean(session.profile.flags['trauson.found']);
  return got;
}

for (const [grade, clock, name] of [[0, 420, 'K by day'], [0, 1260, 'K at night'], [2, 420, 'grade 2 by day'], [2, 1260, 'grade 2 at night']]) {
  test(`at ${name}, from the east gate, taps on the star alone take the hero to the first soldiers in at most four taps; each stop has a person and a line, each clue comes from a person on the screen, Gióng leads in the view, and the map of the village has the star on its edge`, async () => {
    const r = await walk(grade, clock);
    assert.ok(r.found && r.near, `the hero comes to the soldiers (${r.taps} taps)`);
    assert.ok(r.taps <= 4, `${r.taps} taps`);
    for (const s of r.stops.filter((x) => !x.found)) assert.ok(s.said, `a stop on the road with no person and no line at ${JSON.stringify(s.at)}`);
    assert.equal(r.clues.length, 2, r.clues.join(', '));
    assert.deepEqual(r.unseen, [], 'a clue from a person off the screen');
    if (clock >= 1260) {
      assert.equal(r.clues[0], 'clue.trau.sunrise.night');
      assert.ok(r.lantern, 'the person of the way has a lantern at night');
    }
    assert.ok(r.walked > 0 && r.seen / r.walked >= 0.6, `Gióng is in the view for ${r.seen} of ${r.walked} looks`);
    assert.ok(r.edge?.edge, 'the star on the edge of the map of the village');
  });
}

test('the lines of the way: Gióng says the true place, the clue at night says the road, and the raid of the soldiers has the line of Gióng', () => {
  const vi = createI18n(load('i18n/vi.json'), 'vi');
  assert.match(vi.t('dlg.giong.grown.n3'), /chân núi Trâu, xa làng mình/);
  assert.equal(vi.t('clue.trau.sunrise.night'), 'Cứ theo con đường này, về phía mặt trời mọc. Núi Trâu ở đó.');
  assert.equal(vi.t('giong.raid.ahead'), 'Gióng đi trước đánh tướng giặc. Cháu giữ ngã tư này nhé.');
  const raids = load('data/raids.json');
  for (const id of ['soldier1', 'soldier2']) assert.equal(raids.raids[id].leaveKey, 'giong.raid.ahead');
  assert.ok(vi.has('word.phiadong') && vi.has('word.phiadong.forms'));
  assert.ok(MET > 0);
});

test('at the start of the raid of the first soldiers, Gióng says where he goes and rides away along the road in the view', async () => {
  const s = load('tests/stories/raid-soldiers-traps.json');
  let session = null;
  const said = [];
  await runHeadless({ ...s, steps: [...s.steps.slice(0, 3), { wait: 0.5 }] }, { onSession: (x) => {
    session = x;
    x.listen((ev) => { if (ev.type === 'open' && ev.textKey) said.push([ev.id, ev.textKey]); });
  } });
  assert.ok(said.some(([id, key]) => id === 'companion:raid' && key === 'giong.raid.ahead'), JSON.stringify(said));
  const raid = getEntity(session.state, 'raid').raid;
  const c = getEntity(session.state, 'companion:raid');
  assert.ok(c && getEntity(session.state, 'steed:raid'), 'Gióng on his horse');
  const along = (p) => (p.x - raid.wall.x) * raid.dir.x + (p.z - raid.wall.z) * raid.dir.z;
  const from = along(c.position);
  for (let i = 0; i < 30 * 4; i++) {
    session.step();
    session.events();
  }
  const now = getEntity(session.state, 'companion:raid');
  assert.ok(now && along(now.position) > from + 3, 'he rides along the road');
  for (let i = 0; i < 30 * 12; i++) {
    session.step();
    session.events();
  }
  assert.equal(getEntity(session.state, 'companion:raid'), null, 'he is gone');
});
