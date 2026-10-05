// The camera sees the work (#38): when a task or an example starts, the view turns (in its steps of
// 90 degrees) to an angle where no house or roof covers the places of the work and its person
// (workTurn in src/world/fade.js, the event workView of the session).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planeOf, load } from './helpers.js';
import { placesOf } from '../src/core/world/env.js';
import { workBoxes, workCovers, workTurn } from '../src/world/fade.js';
import { VIEW, viewSize, inView } from '../src/world/view.js';
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
      assert.deepEqual(workCovers(w.boxes, w.points, to, VIEW.elevation).map((b) => b.id), [], `${w.id} from the angle ${ANGLES.indexOf(az)}: a building covers the work`);
      if (steps === 0) assert.equal(workCovers(w.boxes, w.points, az, VIEW.elevation).length, 0, 'the view stays only when the work is in sight');
      assert.ok(inSight(to), `${w.id} from the angle ${ANGLES.indexOf(az)}: the person and the example on a portrait screen`);
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
