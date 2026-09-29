import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGrid, colorIndex, colorName, toneRgb, TONES, seeded } from '../src/world/voxel.js';
import { meshGrid, chunksOf } from '../src/world/mesher.js';
import { buildProp, PROPS } from '../src/world/props/index.js';
import { person, nghe, heroLook, figureOf } from '../src/world/figures.js';
import { createAnimator, animate } from '../src/world/animate.js';
import { load } from './helpers.js';

const palette = load('art/palette.json');

test('a grid keeps a color and an owner for each block, and colors come from the palette', () => {
  const g = createGrid(4, 3, 4, { owners: true });
  g.set(1, 1, 1, 'green-pale', 7);
  assert.equal(colorName(g.get(1, 1, 1)), 'greenPale');
  assert.equal(g.ownerAt(1, 1, 1), 7);
  assert.equal(g.get(9, 0, 0), 0, 'outside the grid is empty');
  g.box(0, 0, 0, 3, 0, 3, 'wood');
  assert.equal(g.top(2, 2), 0);
  assert.equal(g.top(1, 1), 1);
  assert.throws(() => colorIndex('magenta'));
  // The tones are the top color mixed with ink, as the shades in art/palette.json.
  const hex = (rgb) => `#${rgb.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
  assert.equal(hex(toneRgb(colorIndex('greenPale'), TONES.lit)), palette.shades['green-pale'][0]);
  assert.equal(hex(toneRgb(colorIndex('greenPale'), TONES.dark)), palette.shades['green-pale'][1]);
  // The same seed gives the same numbers.
  const a = seeded(5);
  const b = seeded(5);
  assert.deepEqual([a.next(), a.next()], [b.next(), b.next()]);
});

test('the mesher shows only the faces that can be seen, and draws ink only where it means something', () => {
  const g = createGrid(3, 3, 3);
  g.set(1, 1, 1, 'green');
  const one = meshGrid(g);
  assert.equal(one.faces, 6);
  assert.equal(one.segments.length / 6, 12, 'a single block has 12 edges');
  // Two blocks of the same color side by side: no line between them on the top.
  g.set(2, 1, 1, 'green');
  const two = meshGrid(g);
  assert.equal(two.faces, 10, 'the faces between the blocks are hidden');
  assert.equal(two.segments.length / 6, 16, 'the outline of a 2 x 1 x 1 box, and no line between the blocks');
  // Another color: a ring of 4 lines where the colors meet.
  g.set(2, 1, 1, 'yellow');
  assert.equal(meshGrid(g).segments.length / 6, 20);
  // A block of another grid hides a face too (the ground under a prop).
  const hidden = meshGrid(g, { other: (x, y, z) => y === 0 });
  assert.equal(hidden.faces, 8);
  // A shadow makes the top face darker.
  const lit = meshGrid(g);
  const shaded = meshGrid(g, { shade: () => 0.8 });
  // The colors of the top faces (all four corners of a top face are at y = 2).
  const topColors = (m) => {
    const out = [];
    for (let q = 0; q < m.positions.length / 12; q++) {
      if ([1, 4, 7, 10].every((k) => m.positions[q * 12 + k] === 2)) out.push(m.colors[q * 12]);
    }
    return out;
  };
  assert.ok(topColors(shaded).length > 0);
  assert.ok(topColors(shaded).every((c, i) => c < topColors(lit)[i] || c === 0), 'the top is darker in the shadow');
  // Chunks cover the grid.
  const big = createGrid(40, 2, 20);
  const chunks = chunksOf(big, 16);
  assert.equal(chunks.length, 6);
  assert.equal(chunks.reduce((s, c) => s + (c.x1 - c.x0) * (c.z1 - c.z0), 0), 40 * 20);
});

// A small world for the props: flat ground at fine y 4.
function world(sx = 48, sy = 48, sz = 48) {
  const fine = createGrid(sx, sy, sz, { owners: true });
  const shadows = new Set();
  return { fine, shadows, groundTop: () => 4, shadow: (x, z) => shadows.add(`${x},${z}`) };
}

test('a house on stilts has its floor above its posts, and the roof covers the walls', () => {
  const w = world();
  const r = buildProp(w, { kind: 'house', fx: 4, fz: 4, fw: 12, fd: 12, seed: 3 }, 5);
  const info = r.info;
  assert.ok(info.floor > info.ground + 4, 'the floor is high over the ground');
  // Each post goes from the ground to just under the floor.
  const wall = info.walls;
  assert.equal(colorName(w.fine.get(wall.x0, info.ground, wall.z0)), 'wood');
  assert.equal(colorName(w.fine.get(wall.x0, info.floor - 1, wall.z0)), 'wood');
  assert.equal(w.fine.get(wall.x0 + 1, info.ground + 1, wall.z0 + 1), colorIndex('vermilionPale'), 'a jar under the floor');
  assert.ok(w.fine.get(wall.x0, info.floor, wall.z0), 'the floor is on the posts');
  // The roof covers the walls on all sides, and starts over them.
  assert.equal(r.roofs.length, 1);
  const roof = r.roofs[0];
  assert.ok(roof.x0 < wall.x0 && roof.x1 > wall.x1 + 1 && roof.z0 < wall.z0 && roof.z1 > wall.z1 + 1);
  assert.ok(roof.y > wall.top);
  assert.equal(roof.who, 5);
  // The box of the house holds the roof, and the house makes a shadow.
  assert.ok(r.box.y1 >= roof.y + roof.ridgeH);
  assert.ok(w.shadows.size > 10);
  assert.equal(w.fine.ownerAt(wall.x0, info.floor, wall.z0), 5, 'each block knows its house');
});

test('the đình has a vermilion ridge and bird-head finials', () => {
  const r = buildProp(world(), { kind: 'dinh', fx: 2, fz: 2, fw: 16, fd: 16, seed: 1 }, 1);
  assert.equal(r.roofs[0].ridge, 'vermilion');
  assert.equal(r.roofs[0].finials, true);
});

test('every prop builds blocks, and the same seed builds the same prop', () => {
  for (const kind of Object.keys(PROPS)) {
    const a = world();
    const b = world();
    const prop = { kind, fx: 12, fz: 12, fw: 12, fd: 12, seed: 42 };
    const ra = buildProp(a, prop, 1);
    buildProp(b, prop, 1);
    assert.ok(ra.box, `${kind} has blocks`);
    assert.deepEqual(a.fine.data, b.fine.data, `${kind} is the same with the same seed`);
  }
  // Another seed gives another tree.
  const a = world();
  const b = world();
  buildProp(a, { kind: 'tree', fx: 12, fz: 12, fw: 4, fd: 4, seed: 1 }, 1);
  buildProp(b, { kind: 'tree', fx: 12, fz: 12, fw: 4, fd: 4, seed: 2 }, 1);
  assert.notDeepEqual(a.fine.data, b.fine.data);
});

test('the hero is made of parts from the choices at the start', () => {
  const boy = person(heroLook({ gender: 'boy', skin: 3, face: 2, hair: 2, clothes: 2 }));
  const names = boy.parts.map((p) => p.name);
  for (const n of ['legL', 'legR', 'armL', 'armR', 'torso', 'head', 'skull', 'knot', 'mouth']) assert.ok(names.includes(n), n);
  assert.ok(names.includes('shortsL'));
  assert.equal(boy.parts.find((p) => p.name === 'skull').color, 'skin3');
  assert.equal(boy.parts.find((p) => p.name === 'torso').color, 'ochre');
  const girl = person(heroLook({ gender: 'girl', skin: 1, face: 1, hair: 4, clothes: 1 }));
  assert.ok(girl.parts.some((p) => p.name === 'skirt') && girl.parts.some((p) => p.name === 'yem'));
  assert.ok(girl.parts.some((p) => p.name.startsWith('braid')));
  // Every part hangs on a part that exists, and uses a palette color.
  for (const fig of [boy, girl, nghe(), figureOf({ kind: 'serpent' }), figureOf({ hat: 'plume', item: 'sword', beard: true })]) {
    const all = new Set(['body', ...fig.parts.map((p) => p.name)]);
    for (const p of fig.parts) {
      assert.ok(all.has(p.parent), `${p.name} hangs on ${p.parent}`);
      if (p.color) colorIndex(p.color);
    }
  }
});

test('the animation: legs and arms swing in turn, four legs move on the diagonals, and the states change', () => {
  const a = createAnimator('biped');
  let pose = animate(a, { speed: 4, dt: 0.1 });
  assert.equal(pose.state, 'walk');
  assert.ok(Math.abs(pose.rot.legL[0] + pose.rot.legR[0]) < 1e-9, 'the legs swing in turn');
  assert.ok(pose.rot.legL[0] * pose.rot.armL[0] <= 0, 'an arm swings against its leg');
  pose = animate(a, { speed: 7, dt: 0.1 });
  assert.equal(pose.state, 'run');
  for (let i = 0; i < 30; i++) pose = animate(a, { speed: 0, dt: 0.1 });
  assert.equal(pose.state, 'idle');
  assert.notEqual(pose.rot.head[1], 0, 'the head turns a little after some time');
  for (let i = 0; i < 30; i++) pose = animate(a, { speed: 0, dt: 0.1, want: 'rest' });
  assert.equal(pose.state, 'rest');
  assert.ok(pose.sink > 0.5, 'the person sits down');

  const q = createAnimator('quadruped');
  pose = animate(q, { speed: 4, dt: 0.13 });
  assert.equal(pose.rot.legFL[0], pose.rot.legBR[0]);
  assert.equal(pose.rot.legFR[0], pose.rot.legBL[0]);
  assert.ok(pose.rot.legFL[0] !== 0 && pose.rot.legFL[0] === -pose.rot.legFR[0]);
  for (let i = 0; i < 40; i++) pose = animate(q, { speed: 0, dt: 0.1 });
  assert.equal(pose.state, 'graze', 'Nghé eats grass when the hero stops');
});

test('each person, enemy, friend, and duck of the maps has a look, and each look builds', () => {
  const looks = load('data/figures.json').figures;
  const regions = load('data/world/regions.json');
  const npcs = load('data/npcs.json').npcs;
  for (const id of Object.keys(npcs)) assert.ok(looks[id], `a look for ${id}`);
  assert.ok(looks.nghe, 'a look for Nghé');
  for (const id of regions.regions.flatMap((r) => r.maps)) {
    const m = load(`data/maps/${id}.json`);
    for (const e of m.encounters) assert.ok(looks[e.figure], `${id}: a look for ${e.id}`);
    for (const d of m.layers.decor) assert.ok(looks[d.figure], `${id}: a look for ${d.figure}`);
  }
  for (const [id, look] of Object.entries(looks)) {
    const fig = figureOf(look);
    assert.ok(fig.parts.length > 2 && fig.height > 0, id);
    for (const p of fig.parts) if (p.color) colorIndex(p.color);
  }
});
