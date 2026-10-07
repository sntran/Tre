// The finger of the slingshot in a raid (#50). Pure: screen pixels in, a choice out; the raid view
// (src/ui/raid.js) uses it.
//   - A finger takes the slingshot only on the hero, and only when it is nearer to the hero than
//     to Nghé (Nghé stands next to the hero; a tap on Nghé is not a pull).
//   - A touch that does not pull (the finger stays near the place where it came down) is a tap,
//     never a shot.

// box: the box of the hero on the screen ({ x0, y0, x1, y1 }); hero: the middle of the hero;
// others: the middles of the figures next to the hero (Nghé). Does the finger at p take the
// slingshot?
export function takesSling(p, box, hero, others = []) {
  if (!box || !hero) return false;
  if (p.x < box.x0 || p.x > box.x1 || p.y < box.y0 || p.y > box.y1) return false;
  const d = Math.hypot(p.x - hero.x, p.y - hero.y);
  return others.every((o) => !o || Math.hypot(p.x - o.x, p.y - o.y) >= d);
}

// The least move of the finger (in steps of the band) for a pull: less is a tap.
export const PULL_MIN = 1.5;

// start: where the finger came down; end: where it is now; step: the pixels of one step. Is the
// touch a pull (a shot at the release)?
export const isPull = (start, end, step) => Math.hypot(end.x - start.x, end.y - start.y) >= PULL_MIN * step;
