import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGrid, colorIndex, colorName, toneRgb, TONES, seeded } from '../src/world/voxel.js';
import { meshGrid, chunksOf } from '../src/world/mesher.js';
import { buildProp, PROPS } from '../src/world/props/index.js';
import { person, nghe, heroLook, figureOf } from '../src/world/figures.js';
import { createAnimator, animate } from '../src/world/animate.js';
import { load, mapOf } from './helpers.js';

const palette = load('art/palette.json');
const HERO = load('data/figures.json').hero;

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
  // Each line knows its owner, and if it is on the outline of the owner. The ring between the two
  // colors of one owner is inside; the other lines are its outline.
  const o = createGrid(4, 3, 3, { owners: true });
  o.set(1, 1, 1, 'green', 4);
  o.set(2, 1, 1, 'yellow', 4);
  const inked = meshGrid(o);
  assert.equal(inked.segOwners.length, inked.segments.length / 6);
  assert.ok(inked.segOwners.every((w) => w === 4));
  assert.equal(inked.segOuter.filter((v) => v === 0).length, 4, 'the ring where the colors meet is inside');
  assert.equal(inked.segOuter.filter((v) => v === 1).length, 16, 'the outline of the box');
  // With another owner, the ring is an outline too.
  o.set(2, 1, 1, 'yellow', 5);
  assert.equal(meshGrid(o).segOuter.filter((v) => v === 0).length, 0);
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

test('a round roof is a low oval shell, long along the house, with its eaves below the top of the walls', async () => {
  const { roundShell } = await import('../src/world/roofs.js');
  let seen = 0;
  for (let seed = 1; seed < 60 && seen < 4; seed++) {
    for (const [fw, fd] of [[12, 12], [16, 12], [12, 16]]) {
      const r = buildProp(world(), { kind: 'house', gen: true, fx: 4, fz: 4, fw, fd, seed }, 5);
      const roof = r.roofs[0];
      if (roof.shape !== 'round') continue;
      seen += 1;
      const wall = r.info.walls;
      const wallTop = (wall.top + 1) / 2;
      const shell = roundShell(roof);
      assert.ok(shell.eave < wallTop, 'the eaves come down below the top of the walls');
      // About half as tall as a dome that rose 1.15 ridges over the walls.
      assert.ok(shell.top - wallTop <= (roof.ridgeH / 2) * 1.15 * 0.5 + 1e-9, `low: ${(shell.top - wallTop).toFixed(2)}`);
      // Oval: long along the longer side of the house.
      const long = roof.x1 - roof.x0 >= roof.z1 - roof.z0;
      assert.ok(long ? shell.rx > shell.rz : shell.rz > shell.rx, 'long along the house');
      // It covers the corners of the walls at their top.
      for (const x of [wall.x0 / 2, (wall.x1 + 1) / 2]) for (const z of [wall.z0 / 2, (wall.z1 + 1) / 2]) assert.ok(shell.covers(x, wallTop - 0.01, z), `the corner ${x}, ${z} is under the roof`);
    }
  }
  assert.ok(seen >= 4, 'some houses of the land have a round roof');
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
    const rb = buildProp(b, prop, 1);
    assert.ok(ra.box, `${kind} has blocks`);
    assert.deepEqual(a.fine.data, b.fine.data, `${kind} is the same with the same seed`);
    assert.deepEqual(ra.smooth, rb.smooth, `${kind}: the same smooth looks`);
    // Each smooth look has an owner block of its prop.
    for (const sm of ra.smooth) assert.ok(sm.owner && a.fine.get(...sm.owner), `${kind}: ${sm.kind} has an owner block`);
  }
  // Another seed gives another tree (its trunk, or its smooth crown).
  const a = world();
  const b = world();
  const ta = buildProp(a, { kind: 'tree', fx: 12, fz: 12, fw: 4, fd: 4, seed: 1 }, 1);
  const tb = buildProp(b, { kind: 'tree', fx: 12, fz: 12, fw: 4, fd: 4, seed: 2 }, 1);
  assert.notDeepEqual([a.fine.data, ta.smooth], [b.fine.data, tb.smooth]);
});

test('a crown is at least about 2.5 times as wide as its trunk, for each size of the forest', () => {
  for (const crown of [2, 3, 5]) {
    const g = world();
    const r = buildProp(g, { kind: 'tree', fx: 12, fz: 12, fw: 4, fd: 4, seed: 3, crown }, 1);
    // The width of the trunk in fine blocks: the wood blocks in the lowest layer of the tree.
    const xs = new Set();
    let low = Infinity;
    for (let y = 0; y < g.fine.h && low === Infinity; y++) {
      for (let z = 0; z < g.fine.d; z++) for (let x = 0; x < g.fine.w; x++) if (colorName(g.fine.get(x, y, z)) === 'wood') { low = y; xs.add(x); }
    }
    const crownLook = r.smooth.find((s) => s.kind === 'crown');
    // The crown radius is in ground blocks; a fine block is half a ground block.
    assert.ok((crownLook.r * 2) / (xs.size / 2) >= 2.5, `crown ${crown}: ${crownLook.r * 2} wide over a trunk of ${xs.size / 2}`);
  }
});

test('the hero is made of parts from the choices at the start', () => {
  const boy = person(heroLook({ gender: 'boy', skin: 3, face: 2, hair: 2, clothes: 2 }, HERO));
  const names = boy.parts.map((p) => p.name);
  for (const n of ['legL', 'legR', 'armL', 'armR', 'torso', 'head', 'skull', 'knot', 'mouth']) assert.ok(names.includes(n), n);
  assert.ok(names.includes('shortsL'));
  assert.equal(boy.parts.find((p) => p.name === 'skull').color, 'skin3');
  assert.equal(boy.parts.find((p) => p.name === 'torso').color, 'ochre');
  const girl = person(heroLook({ gender: 'girl', skin: 1, face: 1, hair: 4, clothes: 1 }, HERO));
  assert.ok(girl.parts.some((p) => p.name === 'skirt') && girl.parts.some((p) => p.name === 'yem'));
  assert.ok(girl.parts.some((p) => p.name.startsWith('braid')));
  // Every part hangs on a part that exists, and uses a palette color.
  for (const fig of [boy, girl, nghe(), figureOf({ kind: 'serpent' }), figureOf({ hat: 'plume', item: 'staff', beard: true })]) {
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
    const m = mapOf(id);
    for (const e of m.encounters) assert.ok(looks[e.figure], `${id}: a look for ${e.id}`);
    for (const g of m.layers.life) for (const look of load('data/world/life.json').kinds[g.kind].looks) assert.ok(looks[look], `${id}: a look for ${look}`);
  }
  for (const [id, look] of Object.entries(looks)) {
    const fig = figureOf(look);
    assert.ok(fig.parts.length > 2 && fig.height > 0, id);
    for (const p of fig.parts) if (p.color) colorIndex(p.color);
  }
});

test('the fine figures: a quarter-block grid, the same size in the world, and parts under the limits', async () => {
  const { personFine, ngheFine } = await import('../src/world/fine.js');
  const limits = load('data/config/limits.json').figureParts;
  const looks = load('data/figures.json').figures;
  for (const [id, look] of Object.entries(looks)) {
    const fine = figureOf(look, 'fine');
    const coarse = figureOf(look, 'coarse');
    assert.ok(limits[fine.kind], `a limit for ${fine.kind}`);
    assert.ok(fine.parts.length <= limits[fine.kind], `${id}: ${fine.parts.length} parts, over ${limits[fine.kind]}`);
    // Far away the coarse figure takes its place: the same size in the world.
    const size = (f) => f.height * f.scale * (f.grid ?? 0.5);
    assert.ok(Math.abs(size(fine) - size(coarse)) < 0.15, `${id}: ${size(fine).toFixed(2)} and ${size(coarse).toFixed(2)} blocks`);
    const all = new Set(['body', ...fine.parts.map((p) => p.name)]);
    for (const p of fine.parts) {
      assert.ok(all.has(p.parent), `${id}: ${p.name} hangs on ${p.parent}`);
      if (p.color) colorIndex(p.color);
    }
  }
  const boy = personFine(heroLook({ gender: 'boy', skin: 3, face: 2, hair: 2, clothes: 2 }, HERO));
  assert.equal(boy.grid, 0.25);
  const names = new Set(boy.parts.map((p) => p.name));
  for (const n of ['skull', 'skullX', 'skullT', 'eyeWL', 'eyeL', 'browL', 'mouth', 'cheekL', 'handR', 'shinL', 'footL', 'toeLa', 'toeLb', 'knot', 'fringe', 'hairT', 'sashTail', 'waist']) assert.ok(names.has(n), n);
  // The head is a ball of seven units: its layers are 7, 5, and 3 units wide, from the middle out,
  // on both sides; the hair is a cap one unit out of it, with no flat top of the width of the head.
  const skull = boy.parts.filter((p) => p.name.startsWith('skull'));
  const widthAt = (y) => Math.max(...skull.filter((p) => Math.abs(p.at[1] - y) < p.size[1] / 2).map((p) => p.size[0]));
  assert.deepEqual([widthAt(0), widthAt(2), widthAt(3)], [7, 5, 3]);
  assert.equal(Math.max(...skull.map((p) => p.at[1] + p.size[1] / 2)), 3.5);
  const hairTop = boy.parts.find((p) => p.name === 'hairT');
  assert.ok(hairTop.size[0] < 7 && hairTop.at[1] - hairTop.size[1] / 2 >= 3.5, 'the top of the hair is round, over the head');
  // The torso: the chest one unit narrower than the hips at the sash, and a waist.
  const size = (n) => boy.parts.find((p) => p.name === n).size;
  assert.equal(size('hips')[0] - size('torso')[0], 1);
  assert.ok(size('waist')[0] < size('torso')[0]);
  // The smooth variant: the head and the hair are balls on the same body.
  const round = personFine(heroLook({ gender: 'boy', hair: 2 }, HERO), { smooth: true });
  assert.deepEqual(round.parts.filter((p) => p.shape === 'ball').map((p) => p.name).sort(), ['hair', 'skull']);
  assert.ok(round.parts.some((p) => p.name === 'waist'));
  // A thing in the hands hangs on the hand, not on the arm.
  const smith = figureOf({ ...looks.smith }, 'fine');
  assert.equal(smith.parts.find((p) => p.name === 'item').parent, 'handR');
  const calf = ngheFine();
  for (const n of ['shinFL', 'hoofBR', 'hornL1', 'hornL3', 'tuft', 'eyeWL']) assert.ok(calf.parts.some((p) => p.name === n), n);
});

test('the level of detail follows the distance with a small hysteresis, and the view culls figures', async () => {
  const { detailFor, inView, LOD } = await import('../src/world/lod.js');
  assert.equal(detailFor(null, 5), 'fine');
  assert.equal(detailFor(null, 40), 'coarse');
  // At the edge a figure keeps its level: walking back and forth over 30 blocks does not switch it.
  let level = 'fine';
  for (const d of [29.5, 30.2, 30.8, 30.1, 29.6]) {
    level = detailFor(level, d);
    assert.equal(level, 'fine', `at ${d}`);
  }
  level = detailFor(level, LOD.far + 0.1);
  assert.equal(level, 'coarse');
  for (const d of [30.8, 30, 29.3]) {
    level = detailFor(level, d);
    assert.equal(level, 'coarse', `at ${d}`);
  }
  assert.equal(detailFor(level, LOD.near - 0.1), 'fine');
  // The line follows the zoom: 30 blocks at the near zoom, 45 at the far zoom.
  const { lodFor } = await import('../src/world/lod.js');
  assert.equal(detailFor(null, 40, lodFor(0)), 'coarse');
  assert.equal(detailFor(null, 40, lodFor(1)), 'fine');
  assert.equal(detailFor('fine', 45.5, lodFor(1)), 'fine', 'the same hysteresis');
  assert.equal(detailFor(null, 47, lodFor(1)), 'coarse');
  // A box view from -10 to 10 on x and z: a figure out of it is dropped; one on its edge stays.
  const planes = [
    { nx: 1, ny: 0, nz: 0, d: 10 }, { nx: -1, ny: 0, nz: 0, d: 10 },
    { nx: 0, ny: 0, nz: 1, d: 10 }, { nx: 0, ny: 0, nz: -1, d: 10 },
    { nx: 0, ny: 1, nz: 0, d: 100 }, { nx: 0, ny: -1, nz: 0, d: 100 },
  ];
  assert.ok(inView(planes, { x: 0, y: 0, z: 0 }, 1));
  assert.ok(inView(planes, { x: 10.5, y: 0, z: 0 }, 1), 'a part of it is in the view');
  assert.ok(!inView(planes, { x: 12, y: 0, z: 0 }, 1));
  assert.ok(!inView(planes, { x: 0, y: 0, z: -30 }, 2));
});

test('the knees: a knee bends while its leg swings through, the heel lifts, and both bend to sit', () => {
  const a = createAnimator('biped');
  let pose = animate(a, { speed: 4, dt: 0.1 });
  for (let i = 0; i < 12; i++) pose = animate(a, { speed: 4, dt: 0.05 });
  const back = pose.rot.legL[0] > 0 ? 'L' : 'R';
  const front = back === 'L' ? 'R' : 'L';
  assert.ok(pose.rot[`shin${back}`][0] > 0, 'the knee of the leg behind bends');
  assert.equal(pose.rot[`shin${front}`][0], 0, 'the leg in front is straight');
  assert.ok(pose.rot[`foot${back}`][0] < 0, 'the heel lifts');
  for (let i = 0; i < 30; i++) pose = animate(a, { speed: 0, dt: 0.1, want: 'rest' });
  assert.ok(pose.rot.shinL[0] > 1 && pose.rot.shinR[0] > 1, 'the knees bend to sit');
});

test('a rock is irregular: its top is never a plus, an X, or a line of three blocks', () => {
  const shapes = new Set();
  for (let seed = 1; seed <= 500; seed++) {
    for (const [fw, fd] of [[4, 4], [6, 6]]) {
      const fine = createGrid(16, 16, 16, { owners: true });
      buildProp({ fine, groundTop: () => 0, shadow: () => {} }, { kind: 'rock', fx: 4, fz: 4, fw, fd, seed }, 1);
      let top = -1;
      const cells = [];
      for (let y = 0; y < 16; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) if (fine.get(x, y, z)) {
        if (y > top) { top = y; cells.length = 0; }
        if (y === top) cells.push([x, z]);
      }
      assert.ok(top >= 1, `seed ${seed}: a rock has some height`);
      assert.ok(cells.length <= 2, `seed ${seed}: the top has ${cells.length} blocks`);
      const key = (x, z) => `${x},${z}`;
      const at = new Set(cells.map(([x, z]) => key(x, z)));
      for (const [x, z] of cells) {
        const line = [[1, 0], [0, 1], [1, 1], [1, -1]].some(([dx, dz]) => at.has(key(x - dx, z - dz)) && at.has(key(x + dx, z + dz)));
        assert.ok(!line, `seed ${seed}: a line or a cross on the top`);
      }
      // The rocks differ from seed to seed.
      const bottom = [];
      for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) if (fine.get(x, 0, z)) bottom.push(key(x, z));
      shapes.add(bottom.sort().join(' '));
    }
  }
  assert.ok(shapes.size > 100, `${shapes.size} different rocks`);
});
