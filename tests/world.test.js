import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTileMap, findPath, pathNextTo, footprint } from '../src/core/tilemap.js';
import { createTriggers } from '../src/core/triggers.js';
import { createDialogue, checkDialogue } from '../src/core/dialogue.js';
import { check } from '../src/core/conditions.js';
import { questState, currentGoal } from '../src/core/quests.js';
import { applyEffects, pickTalk, isPresent } from '../src/core/game.js';
import { createProfile } from '../src/core/profile.js';
import { load } from './helpers.js';
import { spriteAt, edgeMarker } from '../src/core/hit.js';
import { figureScale } from '../src/core/figures.js';
import { heroLayers } from '../src/render/assets.js';
import { readFileSync, existsSync } from 'node:fs';

const tiles = load('data/tiles.json').types;

function small(rows) {
  return createTileMap({ width: rows[0].length, height: rows.length, layers: { ground: rows }, legend: { '.': 'grass', '#': 'hedge', '~': 'water' } }, tiles);
}

test('A* finds the shortest path around walls', () => {
  const map = small([
    '.....',
    '.###.',
    '...#.',
    '.#...',
  ]);
  const path = findPath(map, { x: 0, y: 0 }, { x: 2, y: 2 });
  assert.equal(path.length, 4);
  assert.deepEqual(path[path.length - 1], { x: 2, y: 2 });
  // Each step moves one tile up, down, left, or right, and never onto a wall.
  let prev = { x: 0, y: 0 };
  for (const p of path) {
    assert.equal(Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y), 1);
    assert.ok(map.walkable(p.x, p.y));
    prev = p;
  }
});

test('A* returns null when no path exists, and [] at the goal', () => {
  const map = small(['..#..', '..#..', '..#..']);
  assert.equal(findPath(map, { x: 0, y: 0 }, { x: 4, y: 0 }), null);
  assert.equal(findPath(map, { x: 0, y: 0 }, { x: 2, y: 0 }), null, 'the goal is a wall');
  assert.deepEqual(findPath(map, { x: 1, y: 1 }, { x: 1, y: 1 }), []);
});

test('people block tiles, and the hero walks next to a person', () => {
  const map = small(['.....', '.....']);
  map.occupy(2, 0, 'teacher');
  assert.equal(map.walkable(2, 0), false);
  assert.equal(map.whoAt(2, 0), 'teacher');
  const path = pathNextTo(map, { x: 0, y: 0 }, { x: 2, y: 0 });
  assert.deepEqual(path, [{ x: 1, y: 0 }]);
  map.free(2, 0);
  assert.equal(map.walkable(2, 0), true);
});

test('objects block their footprint', () => {
  assert.equal(footprint({ w: 2, h: 2 }).length, 4);
  assert.deepEqual(footprint({ w: 2, h: 1, solid: false }), []);
  const map = createTileMap({ width: 4, height: 4, legend: { '.': 'grass', '~': 'water' }, layers: {
    ground: ['....', '....', '....', '...~'],
    objects: [{ x: 1, y: 1, w: 2, h: 2 }],
    collision: [{ x: 0, y: 3, block: true }, { x: 3, y: 3, block: false }],
  } }, tiles);
  assert.equal(map.walkable(1, 1), false);
  assert.equal(map.walkable(2, 2), false);
  assert.equal(map.walkable(3, 2), true);
  // The collision layer blocks a grass tile and opens a water tile.
  assert.equal(map.isBlocked(0, 3), true);
  assert.equal(map.isBlocked(3, 3), false);
  assert.equal(map.groundAt(3, 3), 'water');
  assert.equal(map.isBlocked(-1, 0), true, 'the edge of the map blocks');
  map.setSolid(0, 3, false);
  assert.equal(map.isBlocked(0, 3), false);
});

test('trigger zones fire on enter or tap, with conditions and "once"', () => {
  const zones = createTriggers([
    { id: 'door', x: 1, y: 1, w: 2, h: 1, on: 'enter', action: { open: 'house' } },
    { id: 'gift', x: 5, y: 5, on: 'tap', once: true, when: { flags: ['quest'] }, action: { give: { coin: 1 } } },
    { id: 'gift-early', x: 5, y: 5, on: 'tap', action: { textKey: 'x' } },
  ]);
  assert.equal(zones.fire('enter', 2, 1, { flags: {} }).id, 'door');
  assert.equal(zones.fire('enter', 3, 1, { flags: {} }), null);
  assert.equal(zones.fire('tap', 2, 1, { flags: {} }), null, 'a tap does not fire an enter zone');
  assert.equal(zones.fire('tap', 5, 5, { flags: {} }).id, 'gift-early');
  assert.equal(zones.fire('tap', 5, 5, { flags: { quest: true } }).id, 'gift');
  assert.equal(zones.fire('tap', 5, 5, { flags: { quest: true, 'zone.gift': true } }).id, 'gift-early');
});

test('conditions: flags, not flags, any, grade, and items', () => {
  const s = { flags: { a: true }, grade: 3, inventory: { iron: 4 } };
  assert.equal(check(null, s), true);
  assert.equal(check({ flags: ['a'] }, s), true);
  assert.equal(check({ notFlags: ['a'] }, s), false);
  assert.equal(check({ anyFlags: ['x', 'a'] }, s), true);
  assert.equal(check({ grade: { min: 3 } }, s), true);
  assert.equal(check({ grade: { max: 2 } }, s), false);
  assert.equal(check({ items: { iron: 6 } }, s), false);
  assert.equal(check({ any: [{ items: { iron: 6 } }, { flags: ['a'] }] }, s), true);
});

test('the dialogue runner follows nodes, choices, "if" nodes, and effects', () => {
  const def = {
    id: 't', start: 'a',
    nodes: {
      a: { speaker: 'elder', textKey: 'k.a', next: 'b', effects: [{ set: 'met' }] },
      b: { if: { flags: ['brave'] }, then: 'c', else: 'd' },
      c: { textKey: 'k.c' },
      d: { textKey: 'k.d', choices: [{ textKey: 'k.yes', next: 'c', effects: [{ give: { coin: 1 } }] }, { textKey: 'k.no' }] },
    },
  };
  assert.deepEqual(checkDialogue(def), []);
  const d = createDialogue(def, { flags: {} });
  assert.equal(d.view().textKey, 'k.a');
  assert.deepEqual(d.takeEffects(), [{ set: 'met' }]);
  assert.equal(d.next().textKey, 'k.d');
  assert.equal(d.view().choices.length, 2);
  assert.equal(d.next(0).textKey, 'k.c');
  assert.deepEqual(d.takeEffects(), [{ give: { coin: 1 } }]);
  assert.equal(d.next(), null);
  assert.equal(d.done, true);
  assert.ok(checkDialogue({ id: 'bad', start: 'x', nodes: { x: { textKey: 'a', next: 'zz' } } }).length > 0);
});

test('effects change the profile and give commands', () => {
  const p = createProfile({ id: 'p', name: 'An' });
  const { commands, changes } = applyEffects(p, [
    { set: 'giong.spoke' }, { give: { iron: 2 } }, { friend: 'song' }, { open: 'battle', id: 'river' }, { take: { iron: 5 } },
  ]);
  assert.equal(p.flags['giong.spoke'], true);
  assert.equal(p.inventory.iron, 2, 'a take with too few items does nothing');
  assert.deepEqual(p.friends, ['nghe', 'song']);
  assert.deepEqual(commands, [{ open: 'battle', id: 'river' }]);
  assert.equal(changes.items.iron, 2);
});

test('quests: the state comes from the flags', () => {
  const quest = {
    id: 'q', when: { flags: ['start'] },
    steps: [
      { id: 's1', done: { flags: ['a', 'b'] }, progress: ['a', 'b'] },
      { id: 's2', done: { any: [{ items: { iron: 6 } }, { flags: ['forged'] }] }, count: { item: 'iron', need: 6 } },
    ],
  };
  assert.equal(questState(quest, { flags: {} }).open, false);
  let s = questState(quest, { flags: { start: true, a: true } });
  assert.equal(s.step.id, 's1');
  assert.deepEqual(s.progress, { have: 1, need: 2 });
  s = questState(quest, { flags: { start: true, a: true, b: true }, inventory: { iron: 4 } });
  assert.equal(s.step.id, 's2');
  assert.deepEqual(s.progress, { have: 4, need: 6 });
  assert.equal(questState(quest, { flags: { start: true, a: true, b: true, forged: true } }).done, true);
  assert.equal(currentGoal([quest], { flags: { start: true } }).step.id, 's1');
});

test('talk rules pick the first dialogue whose condition is true', () => {
  const p = createProfile({ id: 'p', name: 'An' });
  const npc = { talk: [{ when: { flags: ['x'] }, dialogue: 'one' }, { dialogue: 'two' }] };
  assert.equal(pickTalk(npc, p), 'two');
  p.flags.x = true;
  assert.equal(pickTalk(npc, p), 'one');
  assert.equal(isPresent({ when: { notFlags: ['x'] } }, p), false);
});

// The maps of the Era 1 region

const regions = load('data/world/regions.json');
const mapIds = regions.regions.flatMap((r) => r.maps);
const maps = new Map(mapIds.map((id) => [id, load(`data/maps/${id}.json`)]));

test('each map is valid, and each person and place on it can be reached', () => {
  for (const [id, m] of maps) {
    const map = createTileMap(m, tiles);
    const L = m.layers;
    const tile = (p) => ({ x: Math.floor(p.x), y: Math.floor(p.y) });
    const start = tile(m.spawn);
    // A ferry moves the hero over a river: the places on the other side are reached from its landing.
    const starts = [start, ...L.triggers.filter((z) => z.action?.move).map((z) => tile(z.action.move))];
    const reach = (target, fn) => starts.some((st) => fn(st, target));
    assert.equal(m.id, id);
    assert.ok(map.walkable(start.x, start.y), `${id}: spawn`);
    for (const row of L.ground) assert.equal(row.length, m.width, `${id}: row length`);
    assert.equal(L.ground.length, m.height);
    for (const key of ['ground', 'objects', 'collision', 'zones', 'paths', 'exits', 'triggers']) assert.ok(L[key], `${id}: layer ${key}`);
    for (const o of L.objects) {
      assert.ok(o.x >= 0 && o.y >= 0 && o.x + o.w <= m.width && o.y + o.h <= m.height, `${id}: ${o.id} is on the map`);
    }
    const targets = [
      ...m.npcs.map((n) => ({ ...n, what: `npc ${n.id}` })),
      ...m.encounters.map((e) => ({ ...e, what: `encounter ${e.id}` })),
    ];
    for (const t of targets) {
      assert.ok(!map.isBlocked(Math.floor(t.x), Math.floor(t.y)), `${id}: ${t.what} stands on a free tile`);
      assert.ok(reach(tile(t), (st, g) => pathNextTo(map, st, g)), `${id}: ${t.what} can be reached`);
    }
    for (const t of L.triggers.filter((z) => z.on === 'tap' && z.w === undefined)) {
      assert.ok(reach(t, (st, g) => pathNextTo(map, st, g)), `${id}: ${t.id} can be reached`);
    }
    // Each exit can be reached, and the hero arrives on a free tile that is not an exit.
    for (const e of L.exits) {
      const cells = [];
      for (let y = e.y; y < e.y + e.h; y++) for (let x = e.x; x < e.x + e.w; x++) if (map.walkable(x, y)) cells.push({ x, y });
      assert.ok(cells.some((c) => findPath(map, start, c)), `${id}: exit ${e.id} can be reached`);
      const target = maps.get(e.to.map);
      assert.ok(target, `${id}: exit ${e.id} goes to a known map`);
      const tmap = createTileMap(target, tiles);
      for (const c of cells) {
        const x = typeof e.to.x === 'number' ? e.to.x : c.x + 0.5 + (e.to.dx ?? 0);
        const y = typeof e.to.y === 'number' ? e.to.y : c.y + 0.5 + (e.to.dy ?? 0);
        if (!findPath(map, start, c)) continue;
        assert.ok(!tmap.isBlocked(Math.floor(x), Math.floor(y)), `${id}: exit ${e.id} at ${c.x},${c.y} lands on a free tile of ${e.to.map}`);
        assert.ok(!target.layers.exits.some((z) => Math.floor(x) >= z.x && Math.floor(x) < z.x + z.w && Math.floor(y) >= z.y && Math.floor(y) < z.y + z.h),
          `${id}: exit ${e.id} does not land on an exit`);
      }
    }
    for (const [pid, line] of Object.entries(L.paths)) {
      for (const [x, y] of line) assert.ok(!map.isBlocked(Math.floor(x), Math.floor(y)), `${id}: path ${pid} at ${x},${y}`);
    }
  }
});

test('Era 1 has the real layout: the Đuống south of Phù Đổng, and the way to Văn Miếu goes south-west', () => {
  const m = maps.get('phu-dong');
  const map = createTileMap(m, tiles);
  // The river is on the south side of the village (map +y is south).
  const home = m.layers.objects.find((o) => o.id === 'home');
  const riverRows = m.layers.ground.map((row, y) => (row.includes('~') ? y : -1)).filter((y) => y >= 0);
  assert.ok(Math.min(...riverRows) > home.y + home.h, 'the Đuống is south of the houses');
  // The bridge is broken: the way over the Đuống goes through the ford.
  const gap = m.layers.zones.find((z) => z.id === 'bridge-gap');
  assert.ok(map.isBlocked(gap.x, gap.y));
  const west = m.layers.exits.find((e) => e.id === 'west-road');
  const path = findPath(map, { x: 10, y: 26 }, { x: west.x, y: west.y });
  assert.ok(path, 'the road south-west');
  assert.ok(path.some((p) => map.groundAt(p.x, p.y) === 'shallow'), 'the road goes through the ford');
  // The exits: north to Sóc Sơn, east to Núi Trâu, south-west to Thăng Long.
  const to = Object.fromEntries(m.layers.exits.map((e) => [e.to.map, e]));
  assert.ok(to['soc-son'].y === 0, 'Sóc Sơn is north');
  assert.ok(to['trau-son'].x + to['trau-son'].w === m.width, 'Núi Trâu is east');
  assert.ok(to['road-thanglong'].x === 0 && to['road-thanglong'].y > gap.y, 'Thăng Long is south-west, across the river');
  // Each map has its real center and the direction of north; north is map -y.
  for (const [id, mm] of maps) {
    assert.equal(mm.geo.at.length, 2, id);
    assert.deepEqual(mm.geo.north, [0, -1], id);
  }
  const vanmieu = maps.get('road-thanglong').layers.triggers.find((z) => z.id === 'vanmieu');
  assert.ok(vanmieu && vanmieu.x === 0, 'the road ends at Văn Miếu, to the west');
});

test('the hero steps up or down one step; a higher step is a cliff', () => {
  const map = createTileMap({ width: 4, height: 1, legend: { '.': 'grass' }, layers: { ground: ['....'], height: ['2314'] } }, tiles);
  assert.equal(map.heightAt(1, 0), 3);
  assert.equal(map.canStep(0, 0, 1, 0), true);
  assert.equal(map.canStep(1, 0, 2, 0), false, 'two steps down');
  assert.equal(findPath(map, { x: 0, y: 0 }, { x: 1, y: 0 }).length, 1);
  assert.equal(findPath(map, { x: 0, y: 0 }, { x: 3, y: 0 }), null, 'a cliff on the way');
});

test('the ground of the maps has depth: river steps, sunken paddies, the dinh mound, and terraces', () => {
  const at = (id) => createTileMap(maps.get(id), tiles);
  for (const [id, m] of maps) {
    assert.equal(m.layers.height.length, m.height, id);
    for (const row of m.layers.height) assert.match(row, new RegExp(`^[0-9]{${m.width}}$`), id);
  }
  // The river bank drops two steps to the water: ground 2, sand 1, water 0.
  const river = at('phu-dong');
  assert.deepEqual([60, 62, 68].map((y) => [river.groundAt(30, y), river.heightAt(30, y)]), [['grass', 2], ['sand', 1], ['water', 0]]);
  // The road and the bridge stay high over the bank, as a causeway.
  assert.equal(river.heightAt(44, 62), 2);
  assert.equal(river.heightAt(44, 66), 2);
  // The paddies are one step lower than the dikes and roads around them.
  for (const [id, m] of maps) {
    const map = at(id);
    for (let y = 0; y < m.height; y++) {
      for (let x = 0; x < m.width; x++) {
        if (map.groundAt(x, y) !== 'field') continue;
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          if (map.groundAt(nx, ny) === 'path') assert.ok(map.heightAt(nx, ny) > map.heightAt(x, y), `${id}: paddy ${x},${y}`);
        }
      }
    }
  }
  // The dinh stands on a mound.
  const village = at('phu-dong');
  const dinh = maps.get('phu-dong').layers.objects.find((o) => o.id === 'dinh');
  assert.ok(village.heightAt(dinh.x, dinh.y) > village.heightAt(dinh.x, dinh.y + dinh.h + 2));
  // The edges of a map rise in terraces (roads and water go through).
  assert.ok(village.heightAt(0, 0) >= 4 && village.heightAt(2, 10) === 3);
});

test('the ducks swim on water or on a paddy', () => {
  let count = 0;
  for (const [id, m] of maps) {
    const map = createTileMap(m, tiles);
    for (const d of m.layers.decor ?? []) {
      count += 1;
      assert.ok(['water', 'shallow', 'field'].includes(map.groundAt(Math.floor(d.x), Math.floor(d.y))), `${id}: duck at ${d.x},${d.y}`);
    }
  }
  assert.ok(count >= 5, 'a few ducks');
});

test('a tap on the head, body, or feet of a person selects the person', () => {
  // A person with feet at (100, 200): the picture is 52 wide and 78 tall.
  const sprites = [{ id: 'elder', x: 100, y: 200, w: 52, h: 78 }, { id: 'smith', x: 140, y: 230, w: 52, h: 78 }];
  assert.equal(spriteAt(sprites, 100, 130)?.id, 'elder', 'head');
  assert.equal(spriteAt(sprites, 80, 170)?.id, 'elder', 'body');
  assert.equal(spriteAt(sprites, 100, 199)?.id, 'elder', 'feet');
  assert.equal(spriteAt(sprites, 200, 130), null, 'next to the person');
  // Where two pictures overlap, the person in front (lower on the screen) wins.
  assert.equal(spriteAt(sprites, 120, 190)?.id, 'smith');
  // Some extra space helps small fingers.
  assert.equal(spriteAt(sprites, 128, 130), null);
  assert.equal(spriteAt(sprites, 128, 130, 4)?.id, 'elder');
});

test('a quest target out of view gets an arrow at the edge of the screen', () => {
  const view = { x: 0, y: 0, w: 400, h: 300 };
  assert.equal(edgeMarker(view, { x: 200, y: 150 }), null, 'in view: no arrow');
  const right = edgeMarker(view, { x: 1000, y: 150 });
  assert.equal(right.x, 400);
  assert.equal(right.y, 150);
  assert.equal(right.angle, 0, 'the arrow points right');
  const up = edgeMarker(view, { x: 200, y: -500 }, { top: 60 });
  assert.ok(Math.abs(up.y - 60) < 1e-9, `the arrow stays below the top bar: ${up.y}`);
  assert.ok(Math.abs(up.angle + Math.PI / 2) < 1e-9, 'the arrow points up');
  const corner = edgeMarker(view, { x: 900, y: 900 });
  assert.ok(corner.x <= 400 && corner.y <= 300 && (corner.x === 400 || corner.y === 300));
  // A target under the top bar is out of view too.
  assert.ok(edgeMarker(view, { x: 200, y: 20 }, { top: 60 }));
});

test('children are drawn smaller than adults, on the map and in battles', () => {
  const game = load('data/config/game.json');
  const fig = game.figures;
  const npcs = load('data/npcs.json').npcs;
  for (const place of ['map', 'battle']) {
    const adult = figureScale({}, place, fig);
    const child = figureScale({ child: true }, place, fig);
    assert.ok(child < adult, place);
    assert.ok(child >= adult * 0.7 && child <= adult * 0.9, `${place}: a child is about 4/5 of an adult`);
  }
  assert.equal(npcs['giong-boy'].child, true, 'Gióng as a boy is a child');
  assert.equal(figureScale(npcs['giong-hero'], 'map', fig), npcs['giong-hero'].scale, 'Gióng as a hero has his own size');
});

test('the hero has a skin tone apart from the face, and girls wear a long skirt', () => {
  const opts = load('data/hero.json');
  assert.deepEqual(opts.skins, [1, 2, 3, 4]);
  const layers = heroLayers({ gender: 'girl', skin: 3, face: 1, hair: 2, clothes: 4 });
  assert.deepEqual(layers, ['hero/skin-3', 'hero/clothes-girl-4', 'hero/face-1', 'hero/hair-2']);
  for (const g of opts.genders) for (const s of opts.skins) for (const f of opts.faces) for (const c of opts.clothes) {
    for (const layer of heroLayers({ gender: g, skin: s, face: f, hair: 1, clothes: c })) {
      assert.ok(existsSync(new URL(`../art/${layer}.svg`, import.meta.url)), layer);
    }
  }
  // The face layer has only the features: no skin colors.
  const skins = ['#f0d6b0', '#deb68a', '#b98859', '#8a5f3d'];
  for (const f of opts.faces) {
    const svg = readFileSync(new URL(`../art/hero/face-${f}.svg`, import.meta.url), 'utf8').toLowerCase();
    for (const c of skins) assert.ok(!svg.includes(c), `face-${f} has no skin color ${c}`);
  }
  // The skirt of the girl clothes goes down to the ankles (y 130 or more in the 150-unit picture).
  for (const c of opts.clothes) {
    const svg = readFileSync(new URL(`../art/hero/clothes-girl-${c}.svg`, import.meta.url), 'utf8');
    const ys = [...svg.matchAll(/[ ,LlMmCcQq](\d+(?:\.\d+)?)/g)].map((m) => Number(m[1])).filter((y) => y <= 150);
    assert.ok(Math.max(...ys) >= 130, `clothes-girl-${c} reaches y ${Math.max(...ys)}`);
  }
});
