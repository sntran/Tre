// The table of the tasks (docs/TASKS.md): one action button does every step of every task. A tap
// only walks, and makes a thing the target. For each task: at each target, the act and the picture
// of the button; one press is one thing; empty hands at a place take one back; the finish at the
// person. Each row plays a short story headless (tests/story-run.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { runHeadless } from './story-run.js';

const profile = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true } };
// The start of a trial: the talk of the person, and the first step that the person shows.
const FIRST = { woodcutter: 'mentor.woodcutter.first', smith: 'smith.quench.watch' };
const start = (npc) => [
  { press: { entity: `npc:${npc}` } },
  { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 20 } },
  { read: true },
  { until: { event: 'call', with: { key: FIRST[npc] ?? 'mentor.first.you' }, timeout: 15 } },
];
const carry = (item, zone) => [{ press: { item } }, { until: { event: 'pick', timeout: 15 } }, { press: { zone } }, { until: { event: 'put', timeout: 15 } }];

async function play(name, at, steps) {
  const failures = await runHeadless({ name, profile, clock: 540, at: ['phu-dong', ...at], steps });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
}

test('the teacher: the button picks up one rod at the heap and puts it on the mat; with empty hands at the mat it takes one back; at the teacher, the teacher ties', async () => {
  await play('task-teacher', [54, 27], [
    ...start('teacher'),
    // The teacher showed the first step and took the rod back: the mat is empty.
    { expect: [{ zone: 'mat', planks: 0 }] },
    { press: { thing: 'rod:scholar:2' } },
    { until: { event: 'pick', timeout: 10 } },
    { expect: [{ hero: { holding: true } }, { zone: 'mat', planks: 0 }] },
    { tap: { zone: 'mat' } },
    { wait: 2 },
    { expect: [{ action: { act: 'put', icon: 'hand-put' } }] },
    { press: true },
    { until: { event: 'put', timeout: 10 } },
    { expect: [{ zone: 'mat', planks: 1 }, { hero: { holding: false } }, { action: { act: 'pick', icon: 'hand-pick' } }] },
    // Empty hands at the mat: one rod comes back into the hands, and goes back on the heap.
    { press: { zone: 'mat' } },
    { until: { event: 'pick', timeout: 10 } },
    { expect: [{ zone: 'mat', planks: 0 }, { hero: { holding: true } }] },
    { press: { zone: 'rods' } },
    { until: { event: 'put', timeout: 10 } },
    ...carry('rod', 'mat'),
    { press: { entity: 'npc:teacher' } },
    { until: { event: 'snap', timeout: 10 } },
    { expect: [{ event: 'skill', with: { solved: false, parts: [1] } }, { event: 'pulse', with: { id: 'npc:teacher' } }] },
  ]);
});

test('the smith: the fire is ready at the start; the smith quenches his own piece; the button quenches the iron of the child at the anvil', async () => {
  await play('task-smith', [53, 43], [
    { press: { entity: 'npc:smith' } },
    { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 20 } },
    { read: true },
    // The ore is in the forge and the water is in the trough: no heap, no bucket.
    { expect: [{ zone: 'forge', planks: '>= 2' }, { count: { entities: 'bucket', max: 0 } }, { entity: 'trough:smith', look: 'trough-full' }] },
    { tap: { thing: 'iron:smith-demo' } },
    { until: { event: 'hiss', timeout: 20 } },
    { expect: [{ event: 'call', with: { key: 'smith.quench.show' } }, { event: 'skill', not: true }, { flag: 'trial.smith.done', is: false }] },
    { until: { event: 'fire', timeout: 10 } },
    { tap: { thing: 'iron:smith' } },
    { until: { event: 'glow', timeout: 15 } },
    { expect: [{ action: { act: 'quench', icon: 'water' } }] },
    { press: true },
    { until: { event: 'hiss', timeout: 5 } },
    { expect: [{ event: 'pulse', with: { id: 'iron:smith' } }, { flag: 'trial.smith.done' }] },
  ]);
});

test('the healer: the button puts a bunch into the basket, takes one back with empty hands, and at the healer the healer takes the basket', async () => {
  await play('task-healer', [33, 44], [
    ...start('healer'),
    // The healer showed the first step and took the bunch back: the basket is empty.
    { expect: [{ zone: 'basket', planks: 0 }] },
    ...carry('herb-ngai', 'basket'),
    ...carry('herb-ngai', 'basket'),
    { expect: [{ zone: 'basket', planks: 2 }, { hero: { holding: false } }] },
    // Empty hands at the basket: one bunch comes back into the hands.
    { press: { zone: 'basket' } },
    { until: { event: 'pick', timeout: 10 } },
    { expect: [{ zone: 'basket', planks: 1 }, { hero: { holding: true } }] },
    { press: { zone: 'basket' } },
    { until: { event: 'put', timeout: 10 } },
    { tap: { entity: 'npc:healer' } },
    { wait: 3 },
    { expect: [{ action: { act: 'give', icon: 'basket' } }] },
    { press: true },
    { until: { event: 'nope', timeout: 15 } },
    { expect: [{ event: 'pulse', with: { id: 'npc:healer' } }, { flag: 'trial.healer.done', is: false }] },
  ]);
});

test('the woodcutter: the button puts a chalk mark at the place in front of the hero, takes it away at a mark, and the woodcutter cuts', async () => {
  await play('task-woodcutter', [51, 8.5], [
    ...start('woodcutter'),
    { press: { stem: 3 } },
    { until: { event: 'mark', timeout: 10 } },
    { expect: [{ count: { entities: 'chalk', min: 1, max: 1 } }, { action: { act: 'unmark', icon: 'clear' } }] },
    { press: { stem: 3 } },
    { until: { event: 'mark', timeout: 10 } },
    { expect: [{ count: { entities: 'chalk', max: 0 } }, { action: { act: 'mark', icon: 'chalk' } }] },
    { press: { stem: 4 } },
    { until: { event: 'mark', timeout: 10 } },
    { press: { entity: 'npc:woodcutter' } },
    { until: { event: 'chop', timeout: 10 } },
    { expect: [{ event: 'pulse', with: { id: 'npc:woodcutter' } }, { event: 'skill', with: { solved: true } }] },
  ]);
});

test('the fisher: the button puts a stake on the line at the ghost, and with empty hands at a stake it takes the stake back while the tide is low', async () => {
  await play('task-fisher', [27, 64.5], [
    ...start('fisher'),
    // The fisher showed the first step and took the stake back: the line is empty.
    { expect: [{ zone: 'line', planks: 0 }] },
    { press: { thing: 'stake:fisher:2' } },
    { until: { event: 'pick', timeout: 15 } },
    { tap: { line: 8 } },
    { wait: 3 },
    { expect: [{ action: { act: 'put', icon: 'hand-put', ghost: true } }] },
    { press: true },
    { until: { event: 'put', timeout: 15 } },
    { expect: [{ hero: { holding: false } }, { zone: 'line', planks: 1 }] },
    { press: { thing: 'stake:fisher:2' } },
    { until: { event: 'pick', timeout: 15 } },
    { expect: [{ hero: { holding: true } }, { zone: 'line', planks: 0 }] },
  ]);
});

test('a tap on a rod, the mat, the basket, the stem, or the iron only walks the hero there: it changes nothing in the task', async () => {
  const quiet = { event: 'pick', not: true };
  await play('task-taps-teacher', [54, 27], [
    ...start('teacher'),
    { tap: { thing: 'rod:scholar:2' } }, { wait: 3 },
    { tap: { zone: 'mat' } }, { wait: 3 },
    { expect: [quiet, { event: 'put', not: true }, { event: 'tie', not: true }, { zone: 'mat', planks: 0 }, { hero: { holding: false } }] },
  ]);
  await play('task-taps-healer', [33, 44], [
    ...start('healer'),
    { tap: { zone: 'basket' } }, { wait: 3 },
    { expect: [quiet, { event: 'nope', not: true }, { event: 'given', not: true }] },
  ]);
  await play('task-taps-woodcutter', [51, 8.5], [
    ...start('woodcutter'),
    { tap: { stem: 3 } }, { wait: 3 },
    { expect: [{ event: 'mark', not: true }, { count: { entities: 'chalk', max: 0 } }] },
  ]);
  await play('task-taps-smith', [53, 43], [
    { press: { entity: 'npc:smith' } },
    { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 20 } },
    { read: true },
    { until: { event: 'fire', timeout: 30 } },
    { until: { event: 'glow', timeout: 15 } },
    { tap: { thing: 'iron:smith' } }, { wait: 1 },
    { expect: [{ event: 'skill', not: true }, { flag: 'trial.smith.done', is: false }] },
  ]);
});

test('Nghé: the button gets on Nghé, and on Nghé the button shows the way down and gets off', async () => {
  await play('task-nghe', [40, 30], [
    { wait: 2 },
    { tap: { entity: 'friend:nghe' } },
    { wait: 2 },
    { expect: [{ action: { act: 'ride', icon: 'ride' } }] },
    { press: true },
    { until: { event: 'mount', timeout: 5 } },
    { expect: [{ hero: { riding: true } }, { action: { act: 'ride-off', icon: 'ride-off' } }] },
    { press: true },
    { until: { event: 'dismount', timeout: 5 } },
    { expect: [{ hero: { riding: false } }] },
  ]);
});

test('every story plays with moves and the action button only: no story taps a thing or a place of a task', () => {
  const taps = [];
  for (const f of readdirSync('tests/stories').filter((n) => n.endsWith('.json'))) {
    const text = readFileSync(`tests/stories/${f}`, 'utf8');
    for (const m of text.matchAll(/"tap":\s*\{\s*"(item|thing|plank|zone|span|stem|culm|line)"/g)) taps.push(`${f}: ${m[1]}`);
    for (const m of text.matchAll(/"type":\s*"drag"/g)) taps.push(`${f}: drag ${m.index}`);
  }
  assert.deepEqual(taps, []);
});

test('no two buttons on the screen have the same picture: the action button never shows the wave hand or the jump', () => {
  // The pictures of the action button (the icons of action() in the session), and of the other
  // buttons beside it.
  const icons = [...new Set([...readFileSync('src/core/session.js', 'utf8').matchAll(/icon: '([a-z-]+)'/g)].map((m) => m[1]))];
  const others = [...readFileSync('src/ui/village.js', 'utf8').matchAll(/img\('ui\/([a-z-]+)', 'btn-icon'\)/g)].map((m) => m[1]).filter((n) => !icons.includes(n));
  assert.ok(others.includes('wave') && others.includes('jump'));
  const art = (n) => readFileSync(`art/ui/${n}.svg`, 'utf8');
  for (const n of [...icons, ...others]) assert.ok(existsSync(`art/ui/${n}.svg`), `art/ui/${n}.svg`);
  const all = [...icons, ...others];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) assert.notEqual(art(all[i]), art(all[j]), `${all[i]} and ${all[j]} have the same picture`);
  }
  for (const act of ['pick', 'put']) assert.ok(icons.includes(`hand-${act}`));
});

test('the act talk has its own picture, a speech bubble; the loudspeaker is only for the voice, and no act of the button uses it (#38)', () => {
  const src = readFileSync('src/core/session.js', 'utf8');
  assert.match(src, /act: 'talk', icon: 'talk'/);
  assert.ok(existsSync('art/ui/talk.svg'));
  assert.ok(![...src.matchAll(/icon: '([a-z-]+)'/g)].some((m) => m[1] === 'speak'), 'no act shows the loudspeaker');
  assert.match(readFileSync('src/ui/dialogue.js', 'utf8'), /icon: 'ui\/speak', aria: t\('ui\.listen'\)/, 'the loudspeaker reads a line aloud');
});

// The places of the trials from the first angle of the camera (src/world/view.js): the line from a
// place to the camera crosses no house or roof. A building counts within its eaves (two cells
// around its cells), so that the kite over the school, high in the sky, is not a roof.
test('from the first camera angle, no house or roof covers a place of a trial, and nothing covers the work of the smith', async () => {
  const { planeOf, load } = await import('./helpers.js');
  const { placesOf } = await import('../src/core/world/env.js');
  const { rayHits, toCamera } = await import('../src/world/fade.js');
  const { VIEW } = await import('../src/world/view.js');
  const { map, tileMap, terrain } = planeOf(1, { blocks: load('data/world/blocks.json') });
  const places = placesOf(map, tileMap);
  const toCam = toCamera(Math.PI / 4, VIEW.elevation);
  const BUILDINGS = new Set(['house', 'hut', 'giong-house', 'dinh', 'school', 'forge']);
  const EAVES = 2;
  const boxOf = (o) => {
    const b = terrain.boxOf(o);
    if (!BUILDINGS.has(o.kind)) return b;
    return { ...b, x0: Math.max(b.x0, o.x - EAVES), x1: Math.min(b.x1, o.x + o.w + EAVES), z0: Math.max(b.z0, o.y - EAVES), z1: Math.min(b.z1, o.y + o.h + EAVES) };
  };
  // The things of the work lie on the ground, and they are about a block high.
  const covers = (p, kinds) => terrain.objects.filter((o) => (!kinds || kinds.has(o.kind)) && [0.3, 1].some((h) => rayHits(boxOf(o), { x: p.x / 2, y: p.y / 2 + h, z: p.z / 2 }, toCam))).map((o) => o.id ?? o.kind);
  const trials = load('data/trials.json').trials;
  for (const t of trials) {
    for (const name of Object.values(t.places ?? {}).flat()) {
      if (!places[name]) continue;
      assert.deepEqual(covers(places[name], BUILDINGS), [], `${t.id}: a building covers the place ${name}`);
    }
  }
  const smith = trials.find((t) => t.id === 'smith');
  for (const name of ['forge', 'anvil', 'trough'].map((k) => smith.places[k])) assert.deepEqual(covers(places[name], null), [], `something covers the place ${name} of the smith`);
});

test('the things of the trials are solid: the hero walks into the trough and the anvil, and stays outside them', async () => {
  const { getEntity } = await import('../src/core/world/state.js');
  const inside = (p, r) => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1;
  // The hero walks with the stick (dx, dz) for some seconds, then stops.
  const walk = (dx, dz, s) => [{ do: { type: 'move', dx, dz, strength: 1 } }, { wait: s }, { do: { type: 'move', dx: 0, dz: 0, strength: 0 } }];
  const bad = [];
  const touched = new Set();
  const failures = await runHeadless({ name: 'task-solid', profile, clock: 540, at: ['phu-dong', 53, 43], steps: [
    { press: { entity: 'npc:smith' } }, { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 20 } }, { read: true },
    { until: { event: 'hiss', timeout: 30 } }, { until: { event: 'fire', timeout: 10 } },
    // From the north into the trough, from the north into the anvil.
    { walk: { to: [54.9, 44.1] } }, ...walk(-0.2, 1, 2),
    { walk: { to: [54.2, 41.6] } }, ...walk(0, 1, 2),
  ] }, { onSession: (s) => {
    s.listen(() => {
      const hero = getEntity(s.state, 'hero');
      for (const id of ['trough:smith', 'iron:smith']) {
        const rect = getEntity(s.state, id)?.solid?.rect;
        if (!rect) continue;
        if (inside(hero.position, rect)) bad.push(id);
        if (inside(hero.position, { x0: rect.x0 - 1.2, x1: rect.x1 + 1.2, z0: rect.z0 - 1.2, z1: rect.z1 + 1.2 })) touched.add(id);
      }
    });
  } });
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
  assert.deepEqual([...new Set(bad)], [], 'the hero stood inside a solid thing');
  assert.ok(touched.has('trough:smith') && touched.has('iron:smith'), `the hero came to the trough and the anvil: ${[...touched]}`);
  // The forge and the well are things of the map that block their cells.
  const { planeOf } = await import('./helpers.js');
  const { map, tileMap } = planeOf(1);
  for (const id of ['forge', 'well']) {
    const o = map.layers.objects.find((x) => x.id === id && x.place === 'phu-dong') ?? map.layers.objects.find((x) => x.id === id);
    assert.ok(o, id);
    assert.ok(tileMap.isBlocked(Math.floor(o.x + o.w / 2), Math.floor(o.y + o.h / 2)), `${id} blocks its cells`);
  }
});

test('the heap and the place of a task stand close, and two targets that the child moves between stand at least two blocks apart', async () => {
  const { planeOf, load } = await import('./helpers.js');
  const { placesOf } = await import('../src/core/world/env.js');
  const { map, tileMap } = planeOf(1, { blocks: load('data/world/blocks.json') });
  const places = placesOf(map, tileMap);
  // Places are in half blocks; the distances here are in blocks.
  const apart = (a, b) => Math.hypot(places[a].x - places[b].x, places[a].z - places[b].z) / 2;
  const NEAR = 4; // one or two steps
  const MIN = 2;
  // The trips of each task: the heap (or the beds) and the place that takes the things.
  const trips = [
    ['school-rods', 'school-mat'],
    ['fisher-stakes', 'fisher-line'],
    ['healer-bed-1', 'healer-basket'], ['healer-bed-2', 'healer-basket'], ['healer-bed-3', 'healer-basket'],
    ['horse-ore', 'smith-forge'],
    ['rice-trays', 'giong-pot'],
    ['trap-pile', 'trap-spots'],
  ];
  for (const [heap, place] of trips) {
    const d = apart(heap, place);
    assert.ok(d <= NEAR, `${heap} is ${d.toFixed(1)} blocks from ${place}`);
    assert.ok(d >= MIN, `${heap} is only ${d.toFixed(1)} blocks from ${place}`);
  }
  for (const [a, b] of [['healer-bed-1', 'healer-bed-2'], ['healer-bed-2', 'healer-bed-3']]) assert.ok(apart(a, b) >= MIN, `${a} and ${b}`);
  // The person of the task (the finish) is a target too.
  for (const [npc, place] of [['teacher', 'school-mat'], ['teacher', 'school-rods'], ['smith', 'smith-anvil'], ['healer', 'healer-basket'], ['woodcutter', 'woodcutter-stem']]) {
    const n = map.npcs.find((x) => x.id === npc);
    const d = Math.hypot(places[place].x / 2 - n.x, places[place].z / 2 - n.y);
    assert.ok(d >= MIN, `${npc} is only ${d.toFixed(1)} blocks from ${place}`);
  }
});

test('the guess at the bridge: a tap on an outline only walks there; the outline in front gets the light, and the button chooses it', async () => {
  const story = {
    name: 'task-guess', profile: { name: 'An', grade: 2, lang: 'vi', seed: 7, flags: { 'intro.seen': true } }, clock: 540, at: ['phu-dong', 46, 61],
    steps: [
      { wait: 1 },
      { tap: { guess: 4 } },
      { wait: 4 },
      { expect: [{ event: 'guess', not: true }, { action: { act: 'guess', icon: 'check' } }] },
      { press: true },
      { until: { event: 'guess', timeout: 3 } },
      { expect: [{ event: 'guess', with: { n: 4 } }] },
    ],
  };
  const failures = await runHeadless(story);
  assert.deepEqual(failures.map((f) => `step ${f.step}: ${f.message}`), []);
});
