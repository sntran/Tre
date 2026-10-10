// When the work is right, the person says it (#74): after the extra things go back, the person says
// the count of the work now, no help comes, and the next press finishes the task; the count of the
// healer names each row; a right bundle has its line; and a line of a put never sounds like an order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { STEP } from './restless.js';
import { getEntity } from '../src/core/world/state.js';
import { load } from './helpers.js';

async function afterTalk(name) {
  const story = load(`tests/stories/${name}.json`);
  const first = story.steps.findIndex((s) => s.read === true);
  let session = null;
  const failures = await runHeadless({ ...story, steps: story.steps.slice(0, first + 1) }, { onSession: (s) => { session = s; } });
  assert.deepEqual(failures, []);
  run(session, 3);
  run(session, 40, () => !session.state.entities.some((e) => e.script) && !session.carried());
  return session;
}
function run(session, seconds, until = () => false) {
  for (let i = 0; i < seconds / STEP && !until(); i++) {
    if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
    session.step();
    session.events();
  }
}
const send = (session, cmd) => {
  session.command(cmd);
  session.events();
};
function linesOf(session, id) {
  const lines = [];
  session.listen((ev) => { if (ev.type === 'open' && ev.screen === 'callout' && ev.id === id) lines.push({ key: ev.textKey, params: ev.params ?? {} }); });
  return lines;
}
const HELPS = /^mentor\.(demo|scholar\.(demo|smallerPut|sharePut)|healer\.putKind|putDone|again|offer)/;
const mat = (session) => getEntity(session.state, 'zone:mat').zone.items.length;
const press = (session, n) => {
  for (let k = 0; k < n; k++) {
    send(session, { type: 'hands' });
    run(session, 1.2);
  }
};

test('the teacher: after a tie of 11 rods the extra rod goes back, he says the mat has ten, no help comes, and the next press ties the bundle', async () => {
  const session = await afterTalk('trial-scholar');
  run(session, 30, () => !session.carried() && mat(session) === 0);
  for (let k = 0; k < 30 && mat(session) < 11; k++) press(session, 1);
  assert.equal(mat(session), 11);
  const lines = linesOf(session, 'npc:teacher');
  const moves = [];
  session.listen((ev) => { if (ev.type === 'mentor') moves.push(ev.move); });
  send(session, { type: 'tap', target: { person: 'npc:teacher' } });
  send(session, { type: 'hands' });
  run(session, 40, () => lines.some((l) => l.key === 'mentor.scholar.now'));
  const keys = lines.map((l) => l.key);
  const now = lines.find((l) => l.key === 'mentor.scholar.now');
  assert.ok(now, `the count of the work now: ${keys.join(' ')}`);
  assert.equal(now.params.n.key, 'num.10');
  assert.ok(keys.indexOf('mentor.scholar.extra') < keys.indexOf('mentor.scholar.now'), keys.join(' '));
  assert.equal(mat(session), 10, 'the extra rod is back on the heap');
  // No help comes while the work is right.
  run(session, 25);
  assert.ok(!lines.some((l) => HELPS.test(l.key)), `no help: ${lines.map((l) => l.key).join(' ')}`);
  assert.equal(mat(session), 10, 'nobody puts a rod');
  // The next press, with no tap, ties the bundle.
  const ties = [];
  session.listen((ev) => { if (ev.type === 'tie') ties.push(ev); });
  assert.equal(session.action()?.act, 'tie', `the button shows the tie: ${session.action()?.act}`);
  press(session, 1);
  run(session, 2);
  assert.equal(ties.length, 1, 'the bundle is tied');
  // A right bundle has its line.
  run(session, 3);
  assert.ok(lines.some((l) => l.key === 'scholar.tied' && l.params.n.key === 'num.1'), lines.map((l) => l.key).join(' '));
});

const bedThing = (session, kind) => getEntity(session.state, `zone:bed-${kind}`).zone.items.find((id) => !getEntity(session.state, id).item.held);
function putFrom(session, kind, n) {
  send(session, { type: 'tap', target: { thing: bedThing(session, kind) } });
  run(session, 8, () => !getEntity(session.state, 'hero').route);
  run(session, 1);
  const basket = () => getEntity(session.state, 'zone:basket').zone.items.filter((id) => getEntity(session.state, id)?.item.kind === `herb-${kind}`).length;
  const before = basket();
  for (let k = 0; k < n + 4 && basket() < before + n; k++) press(session, 1);
  assert.equal(basket(), before + n, `${n} bunches of ${kind}`);
}

test('the healer: after a give of 3, 2, and 2 she names each row and counts it, says the extra bunch, says each kind has two, no help comes, and the next press gives the basket', async () => {
  const session = await afterTalk('trial-healer');
  putFrom(session, 'ngai', 3);
  putFrom(session, 'tiato', 2);
  putFrom(session, 'rauma', 2);
  const lines = linesOf(session, 'npc:healer');
  send(session, { type: 'tap', target: { person: 'npc:healer' } });
  send(session, { type: 'hands' });
  run(session, 60, () => lines.some((l) => l.key === 'mentor.healer.now'));
  const keys = lines.map((l) => l.key);
  // Each row starts with its name.
  for (const k of ['ngai', 'tiato', 'rauma']) {
    const i = keys.indexOf(`mentor.healer.row.${k}`);
    assert.ok(i >= 0 && keys[i + 1] === 'num.1', `the row ${k} starts with its name: ${keys.join(' ')}`);
  }
  const extra = lines.find((l) => l.key === 'mentor.healer.extra.ngai');
  assert.equal(extra?.params.n.key, 'num.1', keys.join(' '));
  const now = lines.find((l) => l.key === 'mentor.healer.now');
  assert.equal(now?.params.n.key, 'num.2', keys.join(' '));
  run(session, 25);
  assert.ok(!lines.some((l) => HELPS.test(l.key)), `no help: ${lines.map((l) => l.key).join(' ')}`);
  // A help with nothing to put says nothing (#74): the count of the work comes in its place.
  let adds = 0;
  session.listen((ev) => { if (ev.type === 'put' && ev.id === 'npc:healer') adds += 1; });
  lines.length = 0;
  send(session, { type: 'mentor', key: 'trial-healer', move: 'share' });
  run(session, 20, () => !getEntity(session.state, 'script:trial-healer'));
  assert.equal(adds, 0, 'she puts nothing');
  const said = lines.map((l) => l.key);
  assert.ok(!said.some((k) => /putKind|share|smaller/.test(k)), `no line of a put: ${said.join(' ')}`);
  assert.ok(said.includes('mentor.healer.row.ngai'), `the count of the work: ${said.join(' ')}`);
  run(session, 3);
  const skills = [];
  session.listen((ev) => { if (ev.type === 'skill') skills.push(ev); });
  assert.equal(session.action()?.act, 'give', `the button shows the give: ${session.action()?.act}`);
  press(session, 1);
  run(session, 3);
  assert.equal(skills.length, 1);
  assert.equal(skills[0].solved, true, 'the right basket');
});

test('a line of a put never sounds like an order (#74: "Thêm một bó … nữa" made a child put one more)', () => {
  const vi = load('i18n/vi.json');
  for (const k of ['ngai', 'tiato', 'rauma']) {
    assert.ok(!/^Thêm/.test(vi[`healer.more.${k}`]), vi[`healer.more.${k}`]);
    assert.match(vi[`healer.more.${k}`], /vào giỏ rồi\.$/);
  }
  // No help line has "nốt" or "một nửa".
  for (const [key, text] of Object.entries(vi)) if (/^mentor\./.test(key)) assert.ok(!/nốt|một nửa/.test(text), `${key}: ${text}`);
});

async function healerAt(clock) {
  const story = load('tests/stories/trial-healer.json');
  story.clock = clock;
  const first = story.steps.findIndex((s) => s.read === true);
  let session = null;
  const failures = await runHeadless({ ...story, steps: story.steps.slice(0, first + 1) }, { onSession: (s) => { session = s; } });
  assert.deepEqual(failures, []);
  run(session, 3);
  run(session, 40, () => !session.state.entities.some((e) => e.script) && !session.carried());
  return session;
}

test('the healer stays at her work while the child works there, also at 11:30, and goes to the well when the child leaves', async () => {
  const session = await healerAt(11 * 60 + 25);
  const healer = getEntity(session.state, 'npc:healer');
  const start = { ...healer.position };
  putFrom(session, 'ngai', 1);
  // The clock goes past 11:30 while the child works at the beds.
  let far = 0;
  for (let k = 0; k < 40 && session.state.clock.minutes % 1440 < 11 * 60 + 35; k++) {
    run(session, 2);
    far = Math.max(far, Math.hypot(healer.position.x - start.x, healer.position.z - start.z));
  }
  assert.ok(session.state.clock.minutes % 1440 >= 11 * 60 + 30, `the clock: ${session.state.clock.minutes}`);
  assert.ok(far < 4, `the healer stays at her work: ${far.toFixed(1)} half blocks away`);
  // The child leaves the place of the task: the healer goes on with her day.
  const hero = getEntity(session.state, 'hero');
  Object.assign(hero.position, { x: start.x - 60, z: start.z + 30 });
  delete hero.route;
  run(session, 20);
  const now = getEntity(session.state, 'npc:healer');
  assert.ok(!now.schedule.hold, 'she is free again');
  assert.ok(Math.hypot(now.position.x - start.x, now.position.z - start.z) > 6, `she walks to the well (clock ${session.state.clock.minutes % 1440}, hold ${now.schedule.hold}, hidden ${now.hidden}, hero ${Math.round(hero.position.x - start.x)} ${Math.round(hero.position.z - start.z)})`);
});

test('a walk to a bed chooses that bed: the next press picks its kind, not the kind of the last pick', async () => {
  const session = await afterTalk('trial-healer');
  putFrom(session, 'ngai', 1);
  // The child walks to the bed of tía tô with the stick (no tap): the walk ends next to the bed,
  // and the child presses.
  const bed = getEntity(session.state, 'zone:bed-tiato');
  const hero = getEntity(session.state, 'hero');
  const free = (x, z) => session.tileMap.walkable(Math.floor(x / 2), Math.floor(z / 2));
  let spot = null;
  for (const [dx, dz] of [[0, -3], [0, 3], [-3, 0], [3, 0], [-2, -2], [2, 2], [-2, 2], [2, -2]]) if (!spot && free(bed.position.x + dx, bed.position.z + dz)) spot = { x: bed.position.x + dx, z: bed.position.z + dz };
  assert.ok(spot, 'a free place next to the bed');
  Object.assign(hero.position, spot);
  delete hero.route;
  run(session, 1);
  const picks = [];
  session.listen((ev) => { if (ev.type === 'pick' && ev.id === 'hero') picks.push(getEntity(session.state, ev.item)?.item.kind); });
  press(session, 1);
  run(session, 4);
  assert.deepEqual(picks, ['herb-tiato'], `the pick at the bed of tía tô: ${picks.join(' ')}`);
});
