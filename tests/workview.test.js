// The camera sees the work (#38): when a task or an example starts, the view turns (in its steps of
// 90 degrees) to an angle where no house or roof covers the places of the work and its person, and
// where it can, no other tall thing either (#42; workTurn in src/world/fade.js, the event workView
// of the session).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planeOf, load } from './helpers.js';
import { placesOf } from '../src/core/world/env.js';
import { readFileSync } from 'node:fs';
import { workBoxes, workCovers, workTurn, TALL } from '../src/world/fade.js';
import { VIEW, TALK_SAFE, viewSize, inView, inSafe, figureBox, leadFocus } from '../src/world/view.js';
import { runHeadless } from './story-run.js';

const ANGLES = [0, 1, 2, 3].map((k) => Math.PI / 4 + (k * Math.PI) / 2);
const PORTRAIT = viewSize(390, 844, 0);
const NEAR = 12; // cells: a person this near a place of the work stands at the work

// The work of each trial and each station of the hamlet: its places, the place of its example,
// and its person (world units: cells, y the ground in blocks).
function works() {
  const { map, tileMap, terrain } = planeOf(1, { blocks: load('data/world/blocks.json'), places: ['phu-dong', 'xom-ruong'] });
  const places = placesOf(map, tileMap);
  const at = (p) => ({ x: p.x / 2, y: p.y / 2, z: p.z / 2 });
  const npc = (id) => {
    const n = map.npcs.find((x) => x.id === id);
    return n ? { x: n.x + 0.5, y: tileMap.heightAt(Math.floor(n.x), Math.floor(n.y)) + 1, z: n.y + 0.5 } : null;
  };
  const hamlet = load('data/world/hamlet.json');
  const example = (act) => {
    const e = hamlet.examples[act];
    const p = places[e.at];
    return at({ x: p.x + e.dx, y: p.y, z: p.z + e.dz });
  };
  const out = [];
  for (const t of load('data/trials.json').trials) {
    const pts = Object.values(t.places ?? {}).flat().map((n) => places[n]).filter(Boolean).map(at);
    if (pts.length) out.push({ id: t.id, places: pts, person: npc(t.npc), example: null });
  }
  const station = (id, act, names) => out.push({ id, places: names.map((n) => at(places[n])), person: npc(hamlet.stations[act]), example: example(act) });
  station('planting', 'planting', ['plant-seedbed']);
  station('ducks', 'ducks', ['duck-trough', 'duck-jar']);
  station('traps', 'traps', ['trap-spots', 'trap-pile', 'weir']);
  station('drum', 'drum', ['drum-bronze', 'drum-bronze-2', 'dancers']);
  for (const w of out) {
    const near = w.person && [...w.places, ...(w.example ? [w.example] : [])].some((p) => Math.hypot(p.x - w.person.x, p.z - w.person.z) <= NEAR);
    w.points = [...w.places, ...(w.example ? [w.example] : []), ...(near ? [w.person] : [])];
    w.boxes = workBoxes(terrain, w.points);
  }
  return out;
}

test('from each of the four angles, the turn of the view finds an angle where nothing covers the work of each trial and station, and on a portrait screen the person and the example are in sight', () => {
  for (const w of works()) {
    // The person and the example stay on a portrait screen, with the camera at the person.
    const sight = w.person ? [w.person, ...(w.example ? [w.example] : [])] : [];
    const inSight = (az) => sight.every((p) => inView({ x0: p.x - 0.5, x1: p.x + 0.5, y0: p.y, y1: p.y + 1, z0: p.z - 0.5, z1: p.z + 0.5 }, w.person, { az, size: PORTRAIT }));
    for (const az of ANGLES) {
      const steps = workTurn(w.boxes, w.points, az, VIEW.elevation, inSight);
      const to = az + (steps * Math.PI) / 2;
      const houses = (a) => workCovers(w.boxes, w.points, a, VIEW.elevation).filter((b) => b.building).map((b) => b.id);
      assert.deepEqual(houses(to), [], `${w.id} from the angle ${ANGLES.indexOf(az)}: a building covers the work`);
      if (steps === 0) assert.deepEqual(houses(az), [], 'the view stays only when the work is in sight');
      assert.ok(inSight(to), `${w.id} from the angle ${ANGLES.indexOf(az)}: the person and the example on a portrait screen`);
    }
  }
});

test('with the real camera on a phone held upright (the focus on the hero after the walk to the person, led toward the work), the person, the heap, and the places of each trial and station are on the screen', () => {
  for (const w of works()) {
    if (!w.person) continue;
    // The hero stands next to the person after the walk to the person (one cell toward the work).
    const mid = w.places.reduce((a, p) => ({ x: a.x + p.x / w.places.length, z: a.z + p.z / w.places.length }), { x: 0, z: 0 });
    const d = Math.hypot(mid.x - w.person.x, mid.z - w.person.z) || 1;
    // A person far from the work (the woodcutter at his stem, for the staffs at the clump): the hero
    // works at the places alone.
    const atWork = d <= NEAR;
    const hero = atWork ? { x: w.person.x + ((w.person.x - mid.x) / d) * 1.5, y: w.person.y, z: w.person.z + ((w.person.z - mid.z) / d) * 1.5 } : { ...w.places[0], x: w.places[0].x + 1.5 };
    for (const az of ANGLES) {
      const points = [hero, ...(atWork ? [w.person] : []), ...w.places, ...(w.example ? [w.example] : [])];
      const lead = leadFocus(points, { az, width: 390, height: 844 });
      assert.ok(lead.fits, `${w.id} from the angle ${ANGLES.indexOf(az)}: the work fits on the screen`);
      const size = viewSize(390, 844, lead.level);
      for (const p of points) assert.ok(inSafe(figureBox(p), lead.focus, { az, size }), `${w.id}: a point of the work is not fully on the screen, or is under the HUD or the buttons`);
    }
  }
});

// The folk games and the market in the open (#42): the court of nhảy lò cò, the rope of nhảy dây,
// and the stall of a market day (the mat of the rice, the tray of goods, the seller). Nothing tall
// (a house, a gate post, a wall, a tall tree, a stack: workBoxes) stands on the work, and from each
// of the four angles the turn of the view finds an angle where nothing tall covers it.
async function folkPoints(name, read, steps = 1) {
  const story = JSON.parse(readFileSync(new URL(`./stories/${name}.json`, import.meta.url)));
  story.steps = story.steps.slice(0, steps);
  let session = null;
  const failures = await runHeadless(story, { onSession: (s) => { session = s; } });
  assert.deepEqual(failures, []);
  return read((id) => session.state.entities.find((e) => e.id === id)).map((q) => ({ x: q.x / 2, y: q.y / 2, z: q.z / 2 }));
}

test('the court of nhay lo co, the rope of nhay day, and the stall of the market are in the open: nothing tall on them, and a turn of the view finds an angle where nothing tall covers them', async () => {
  const { terrain } = planeOf(1, { blocks: load('data/world/blocks.json'), places: ['phu-dong', 'xom-ruong'] });
  const games = {
    // The half circle to rest has no height of its own: the height of the last square.
    court: await folkPoints('practice-nhay-lo-co', (E) => { const c = E('folk:court').folkCourt; return [...c.squares, { ...c.rest, y: c.squares.at(-1).y }]; }),
    // The two children who turn the rope, and the middle of the rope (as the event workView).
    rope: await folkPoints('practice-nhay-day', (E) => ['npc:rope-child', 'folk:turner:1', 'folk:rope'].map((id) => E(id).position)),
    // The market of the story, after the seller says her trade.
    market: await folkPoints('market-barter', (E) => ['mark:event-market', 'wares:event-market', 'event:market'].map((id) => E(id).position), 5),
  };
  for (const [id, points] of Object.entries(games)) {
    assert.ok(points.length >= 2, id);
    const boxes = workBoxes(terrain, points);
    // Nothing tall on the work: no tall thing holds a point of the work.
    const tall = terrain.objects.filter((o) => !o.gone).map((o) => ({ o, b: terrain.boxOf(o) })).filter(({ b }) => b.y1 - b.y0 >= TALL);
    const on = tall.filter(({ b }) => points.some((p) => p.x >= b.x0 && p.x <= b.x1 && p.z >= b.z0 && p.z <= b.z1)).map(({ o }) => o.id ?? o.kind);
    assert.deepEqual(on, [], `${id}: a tall thing on the work`);
    for (const az of ANGLES) {
      const steps = workTurn(boxes, points, az, VIEW.elevation);
      const to = az + (steps * Math.PI) / 2;
      assert.deepEqual(workCovers(boxes, points, to, VIEW.elevation).map((b) => b.id), [], `${id} from the angle ${ANGLES.indexOf(az)}: a tall thing covers the work`);
    }
  }
});

test('the view stays when the work is in sight, and turns the least way when a house is in front', () => {
  const box = { x0: 4, x1: 8, y0: 0, y1: 6, z0: 4, z1: 8, id: 'house' };
  const work = [{ x: 0, y: 0, z: 0 }];
  // The camera of the first angle looks from +x, +z: the house is in front.
  assert.equal(workCovers([box], work, Math.PI / 4, VIEW.elevation).length, 1);
  assert.equal(Math.abs(workTurn([box], work, Math.PI / 4, VIEW.elevation)), 1);
  assert.equal(workTurn([box], work, Math.PI / 4 + Math.PI, VIEW.elevation), 0);
});

test('the session sends the work of a task and of an example with its points, so that the view can turn', async () => {
  const seen = [];
  const story = {
    name: 'work-view', practice: 'cho-vit-an',
    profile: { name: 'An', grade: 2, lang: 'vi', seed: 1, flags: {} },
    steps: [
      { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 10 } },
      { read: true },
      { until: { event: 'example', with: { done: true }, timeout: 40 } },
      { wait: 1 },
    ],
  };
  const failures = await runHeadless(story, { onSession: (s) => s.listen((ev) => { if (ev.type === 'workView') seen.push(ev); }) });
  assert.deepEqual(failures, []);
  const example = seen.find((e) => e.key === 'example-ducks');
  const task = seen.find((e) => e.key === 'trial-ducks');
  assert.ok(example && example.points.length >= 3, 'the example: its things and the duck girl');
  assert.ok(task && task.points.length >= 2, 'the task: its places and the duck girl');
  assert.ok(seen.indexOf(example) < seen.indexOf(task), 'the example first');
});

// A new word with its thing (#62): while a line of the fisher names a thing (the fish trap, the
// tide, the red float), the thing is in the world, it glows, the fisher points at it, and with the
// real camera on a phone held upright it is on the screen above the talk box, from each of the four
// angles after the turn of the view.
test('each thing that a line of the fisher names is in the world, glows, and is on a phone screen above the talk box', async () => {
  const story = JSON.parse(readFileSync(new URL('./stories/practice-cam-coc.json', import.meta.url)));
  story.steps = story.steps.slice(0, 3);
  const lines = [];
  let line = null;
  const failures = await runHeadless(story, {
    onSession: (s) => {
      s.listen((ev) => {
        if (ev.type === 'open' && ev.screen === 'dialogue') line = ev.textKey;
        if (ev.type === 'names') {
          const E = (id) => s.state.entities.find((e) => e.id === id);
          lines.push({ line, ...ev, hero: { ...E('hero').position }, point: E('npc:fisher').gesture, tide: E('tide:fisher').look });
        }
      });
    },
  });
  assert.deepEqual(failures, []);
  const named = lines.filter((n) => n.points.length);
  assert.deepEqual(named.map((n) => n.line), ['dlg.fisher.trial.n2', 'dlg.fisher.trial.n3', 'dlg.fisher.trial.n4', 'dlg.fisher.trial.n5']);
  assert.deepEqual(named.map((n) => n.ids), [['stake:fisher:a', 'stake:fisher:b'], ['tide:fisher'], ['mark:fisher:end'], ['stake:fisher:a', 'stake:fisher:b']]);
  assert.equal(named[0].spots.length, 1, 'the row of the trap glows as a rim on the ground');
  for (const n of named) assert.equal(n.point?.act, 'point', `${n.line}: the fisher points`);
  assert.deepEqual(named.map((n) => n.tide), ['tide-0', 'tide-1', 'tide-0', 'tide-0'], 'at the tide the water rises a little, and goes back');
  assert.deepEqual(named.map((n) => n.bobs), [[], [], ['mark:fisher:end'], []], 'the red float bobs');
  assert.deepEqual(lines.at(-1).points, [], 'the end of the talk ends the glow');
  const { terrain } = planeOf(story.profile.seed, { blocks: load('data/world/blocks.json'), places: ['phu-dong'] });
  const wu = (p) => ({ x: p.x / 2, y: p.y / 2, z: p.z / 2 });
  for (const n of named) {
    const pts = n.points.map(wu);
    const hero = wu(n.hero);
    for (const az of ANGLES) {
      const steps = workTurn(workBoxes(terrain, pts), pts, az, VIEW.elevation);
      const to = az + (steps * Math.PI) / 2;
      const lead = leadFocus([hero, ...pts], { az: to, width: 390, height: 844, safe: TALK_SAFE });
      assert.ok(lead.fits, `${n.line} from the angle ${ANGLES.indexOf(az)}: the things fit above the talk box`);
      const size = viewSize(390, 844, lead.level);
      for (const p of pts) assert.ok(inSafe(figureBox(p), lead.focus, { az: to, size, safe: TALK_SAFE }), `${n.line}: a named thing is under the talk box or off the screen`);
    }
  }
});
