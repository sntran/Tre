// The marks on the screen (#53): a star, an arrow, or a bubble never sits on a control, a star
// never sits on the hero, and a bubble never covers the hero; a person off the screen talks from
// the edge (src/world/marks.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overlaps, starBox, placeStar, placeArrow, placeBubble, upOutOf, spreadArrow, ARROW_GAP } from '../src/world/marks.js';

// A phone held upright: the HUD to y 130, the stick and the buttons at the bottom.
const screen = { w: 390, h: 844, top: 130, bottom: 844 };
const controls = [
  { x0: 24, y0: 684, x1: 136, y1: 796 }, // the stick
  { x0: 270, y0: 680, x1: 380, y1: 830 }, // the big button and the turns
  { x0: 150, y0: 740, x1: 260, y1: 830 }, // the jump
];
const hero = { x0: 175, y0: 380, x1: 215, y1: 460 };

test('a star on the stick or on a button goes up over it; a star on the hero goes over the head of the hero', () => {
  for (let x = 10; x <= 380; x += 10) {
    for (let y = 600; y <= 844; y += 8) {
      const s = placeStar({ x, y }, { controls, hero });
      assert.ok(!controls.some((c) => overlaps(starBox(s), c)), `a star at ${x}, ${y} is on a control`);
    }
  }
  const s = placeStar({ x: 195, y: 420 }, { controls, hero });
  assert.ok(!overlaps(starBox(s), hero), 'the star is over the hero, not on the hero');
  assert.ok(s.y <= hero.y0);
  // A star away from all of them stays where it is.
  assert.deepEqual(placeStar({ x: 100, y: 300 }, { controls, hero }), { x: 100, y: 300 });
});

test('an arrow at the bottom edge goes up over the controls (frame 3 of #53: a star at 82, 806 on the stick)', () => {
  const a = placeArrow({ x: 82, y: 806 }, { controls });
  assert.ok(!controls.some((c) => overlaps({ x0: a.x - 22, y0: a.y - 17, x1: a.x + 22, y1: a.y + 17 }, c)));
});

test('a bubble never covers the hero and never sits on a control; a person off the screen talks from the edge with a tail', () => {
  // A person next to the hero: the bubble over the head would be on the hero.
  const near = placeBubble({ x: 200, y: 440 }, 300, 50, { screen, hero, controls });
  assert.ok(!overlaps(near, hero), 'over the hero, not on the hero');
  assert.equal(near.away, false);
  // A person to the west, off the screen (frame 3 of #53): the bubble is at the west edge, on the
  // screen, not on the hero, and has a tail toward the person.
  const west = placeBubble({ x: -200, y: 420 }, 300, 50, { screen, hero, controls });
  assert.equal(west.away, true);
  assert.deepEqual(west.tail, { x: -200, y: 420 });
  assert.ok(west.x0 >= 0 && west.x1 <= screen.w && west.y0 >= screen.top, 'on the screen');
  assert.ok(!overlaps(west, hero), 'not on the hero');
  // A person under the screen: the bubble is over the controls.
  const south = placeBubble({ x: 80, y: 1200 }, 200, 50, { screen, hero, controls });
  assert.ok(!controls.some((c) => overlaps(south, c)), 'not on a control');
  assert.ok(south.y1 <= screen.bottom);
  // A hero at the top of the screen: the bubble goes under the hero.
  const high = { x0: 175, y0: 140, x1: 215, y1: 220 };
  const under = placeBubble({ x: 195, y: 180 }, 300, 50, { screen, hero: high, controls });
  assert.ok(!overlaps(under, high) && under.y0 >= high.y1);
});

test('a bubble never covers the work of an open task: it goes higher, or to the other side of its person (#64)', () => {
  // The woodcutter stands by the stem; the stem lies on the screen where his bubble would go
  // (frame 7 of #64).
  const head = { x: 200, y: 400 };
  const stem = { x0: 60, y0: 330, x1: 340, y1: 390 };
  const b = placeBubble(head, 260, 50, { screen, hero: null, controls, work: [stem] });
  assert.ok(!overlaps(b, stem), 'not on the stem');
  assert.ok(b.y1 <= stem.y0, 'higher, over the stem');
  // No room over the work (the work is at the top of the screen): the other side of the person.
  const beds = { x0: 20, y0: screen.top + 2, x1: 230, y1: 400 };
  const side = placeBubble({ x: 200, y: 420 }, 140, 40, { screen, hero: null, controls, work: [beds] });
  assert.ok(!overlaps(side, beds), 'not on the beds');
  assert.ok(side.x0 >= beds.x1, 'at the side away from the beds');
  // With no work under it, the bubble stays over the head.
  const free = placeBubble(head, 260, 50, { screen, hero: null, controls, work: [{ x0: 0, y0: 600, x1: 50, y1: 650 }] });
  assert.equal(free.y1, head.y);
});

test('a bubble never covers a star: it goes to the other side of its person (#56)', () => {
  // The woodcutter talks, and the star of the bamboo clump is over his head (frame 4 of #56).
  const head = { x: 120, y: 300 };
  const foot = { x: 120, y: 360 };
  const star = starBox({ x: 128, y: 290 });
  const plain = placeBubble(head, 120, 40, { screen, hero, controls });
  assert.ok(overlaps(plain, star), 'with no stars, the bubble is over the head');
  const b = placeBubble(head, 120, 40, { screen, hero, controls, stars: [star], foot });
  assert.ok(!overlaps(b, star), 'not on the star');
  assert.ok(!overlaps(b, hero), 'not on the hero');
  assert.ok(b.x0 >= 0 && b.x1 <= screen.w && b.y0 >= screen.top, 'on the screen');
  // A star to the left of the head: the bubble goes to the right.
  const west = starBox({ x: 90, y: 290 });
  const r = placeBubble({ x: 250, y: 300 }, 100, 40, { screen, controls, stars: [starBox({ x: 245, y: 290 })], foot: { x: 250, y: 360 } });
  assert.ok(r.x0 >= 250, `right of the head: ${r.x0}`);
  // Stars on both sides: under the feet.
  const both = placeBubble(head, 120, 40, { screen, controls, stars: [star, west, starBox({ x: 190, y: 290 }), starBox({ x: 60, y: 290 })], foot });
  assert.ok(both.y0 >= foot.y, 'under the feet');
});

test('upOutOf moves a box up over every box that it overlaps', () => {
  const b = upOutOf({ x0: 0, y0: 790, x1: 40, y1: 830 }, [{ x0: 0, y0: 800, x1: 50, y1: 844 }, { x0: 0, y0: 740, x1: 50, y1: 790 }]);
  assert.ok(b.y1 <= 736);
});

test('two targets in about the same direction each have their own arrow at the edge, side by side (#72)', () => {
  const box = { left: 12, right: 378, top: 140, bottom: 832 };
  const a = spreadArrow({ x: 378, y: 300, angle: 0 }, [], box);
  const b = spreadArrow({ x: 378, y: 320, angle: 0.1 }, [a], box);
  const c = spreadArrow({ x: 378, y: 310, angle: 0.05 }, [a, b], box);
  for (const [p, q] of [[a, b], [a, c], [b, c]]) assert.ok(Math.hypot(p.x - q.x, p.y - q.y) >= ARROW_GAP, 'no arrow under another');
  assert.ok([a, b, c].every((p) => p.x === 378 && p.y >= box.top && p.y <= box.bottom), 'all on the right edge');
  // On the top edge, they go to the sides.
  const t = spreadArrow({ x: 200, y: 140, angle: -1.5 }, [{ x: 200, y: 140 }], box);
  assert.equal(t.y, 140);
  assert.ok(Math.abs(t.x - 200) >= ARROW_GAP);
});
