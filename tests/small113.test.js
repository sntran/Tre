// Small things after the play test of #95 to #104 (#113): the elder looks like an old man from each
// angle of the view.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { personFine } from '../src/world/fine.js';
import { person } from '../src/world/figures.js';
import { load } from './helpers.js';

const figs = load('data/figures.json').figures;

// The rectangle of a part of the head as the camera sees it from a side: from the front or the
// back, x and y; from the left or the right, z and y.
const rectOf = (p, side) => {
  const [w, h, d] = p.size;
  const [x, y, z] = p.at;
  const u = side === 'x' ? [z - d / 2, z + d / 2] : [x - w / 2, x + w / 2];
  return { u0: u[0], u1: u[1], v0: y - h / 2, v1: y + h / 2 };
};
// Does a point of the beard show out of the other parts of the head, from that side?
function beardShows(parts, side) {
  const head = parts.filter((p) => p.parent === 'head' && !/^beard/.test(p.name) && p.size[0] > 0.05);
  const beard = parts.filter((p) => /^beard/.test(p.name));
  for (const b of beard) {
    const r = rectOf(b, side);
    for (let i = 0; i <= 8; i++) {
      for (let j = 0; j <= 8; j++) {
        const u = r.u0 + ((r.u1 - r.u0) * i) / 8;
        const v = r.v0 + ((r.v1 - r.v0) * j) / 8;
        // From the front, the beard is in front of the face; from the back and the sides, it shows
        // only out of the head.
        if (side === 'front') return true;
        if (!head.some((p) => { const q = rectOf(p, side); return u > q.u0 && u < q.u1 && v > q.v0 && v < q.v1; })) return true;
      }
    }
  }
  return false;
}

test('the elder: a dark robe, a khăn, and a white beard that shows from the front, the side, and the back', () => {
  const e = figs.elder;
  assert.equal(e.hat, 'khan');
  assert.ok(['wood', 'ink', 'indigo'].includes(e.top), `a dark robe: ${e.top}`);
  assert.equal(e.beard, true);
  assert.equal(e.item, 'staff');
  for (const fig of [personFine(e), person(e)]) {
    for (const side of ['front', 'back', 'x']) assert.ok(beardShows(fig.parts, side), `${fig.grid ? 'fine' : 'coarse'}: the beard shows from the ${side === 'x' ? 'side' : side}`);
  }
});
