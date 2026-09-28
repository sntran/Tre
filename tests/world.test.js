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

const tiles = load('data/tiles.json').types;

function small(rows) {
  return createTileMap({ width: rows[0].length, height: rows.length, ground: rows, legend: { '.': 'grass', '#': 'hedge', '~': 'water' } }, tiles);
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
  const map = createTileMap({ width: 4, height: 4, ground: ['....', '....', '....', '....'], legend: { '.': 'grass' },
    objects: [{ x: 1, y: 1, w: 2, h: 2 }] }, tiles);
  assert.equal(map.walkable(1, 1), false);
  assert.equal(map.walkable(2, 2), false);
  assert.equal(map.walkable(3, 3), true);
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
  assert.deepEqual(p.friends, ['song']);
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

// The Phù Đổng map

const village = load('data/maps/phu-dong.json');

test('the village map is valid, and each person and place can be reached', () => {
  const map = createTileMap(village, tiles);
  const start = village.spawn;
  assert.ok(map.walkable(start.x, start.y));
  for (const row of village.ground) assert.equal(row.length, village.width);
  assert.equal(village.ground.length, village.height);
  const targets = [
    ...village.npcs.map((n) => ({ ...n, what: `npc ${n.id}` })),
    ...village.encounters.map((e) => ({ ...e, what: `encounter ${e.id}` })),
  ];
  for (const t of targets) {
    assert.ok(!map.solidAt(t.x, t.y), `${t.what} stands on a free tile`);
  }
  for (const n of targets) map.occupy(n.x, n.y, n.id);
  for (const t of targets) {
    assert.ok(pathNextTo(map, start, t), `${t.what} can be reached`);
  }
  // The ore by the river is behind the river creatures.
  const ore2 = village.objects.find((o) => o.id === 'ore2');
  assert.equal(pathNextTo(map, start, ore2), null, 'the river creatures block the path');
  map.free(4, 19);
  assert.ok(pathNextTo(map, start, ore2), 'after the battle the path is open');
  // The exit to Văn Miếu.
  assert.ok(findPath(map, start, { x: 16, y: 25 }));
});
