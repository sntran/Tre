// The search of a path (src/core/tilemap.js): the far walk of a tap on a star goes in legs, and a
// leg goes to the cell nearest to the goal that the search finds (#53).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPath } from '../src/core/tilemap.js';

// A map of 5 x 4 cells with a wall across the third row.
const rows = ['.....', '.....', '#####', '.....'];
const map = { width: 5, height: 4, inside: (x, y) => x >= 0 && y >= 0 && x < 5 && y < 4, walkable: (x, y) => rows[y]?.[x] === '.' };

test('findPath with nearest: a goal out of reach gives the path to the nearest cell that the search found', () => {
  assert.equal(findPath(map, { x: 0, y: 0 }, { x: 4, y: 3 }), null);
  const way = findPath(map, { x: 0, y: 0 }, { x: 4, y: 3 }, { nearest: true });
  assert.deepEqual(way.at(-1), { x: 4, y: 1 });
  // A goal in reach: the same path as with no nearest.
  assert.deepEqual(findPath(map, { x: 0, y: 0 }, { x: 4, y: 1 }, { nearest: true }), findPath(map, { x: 0, y: 0 }, { x: 4, y: 1 }));
  // Past the most cells of the search: the nearest cell so far.
  const short = findPath(map, { x: 0, y: 0 }, { x: 4, y: 1 }, { nearest: true, maxNodes: 2 });
  assert.ok(short.length > 0 && short.length < 5);
});
