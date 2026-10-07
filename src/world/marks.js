// The marks on the screen over the world (#53): the stars of the goals, the arrows at the edge of
// the screen, and the bubbles of the lines of the people. What is on the screen must not hide what
// the child needs: a mark never sits on a control (the stick, the buttons), a star never sits on
// the hero, and a bubble never covers the hero or a star (#56). Pure: screen pixels in, screen
// pixels out; the village (src/ui/village.js) draws them.

// A box on the screen: { x0, y0, x1, y1 } (pixels, y down).
export const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

// Move a box up until it overlaps none of the boxes (the controls are at the bottom of the screen,
// so up is always free). Return the new box.
export function upOutOf(box, boxes, gap = 4) {
  let b = { ...box };
  for (let n = 0; n < boxes.length + 1; n++) {
    const hit = boxes.find((o) => overlaps(b, o));
    if (!hit) break;
    const dy = b.y1 - (hit.y0 - gap);
    b = { x0: b.x0, x1: b.x1, y0: b.y0 - dy, y1: b.y1 - dy };
  }
  return b;
}

// The box of a star over a target at the screen point p (the star stands on the point): 30 x 30.
export const STAR = 30;
export const starBox = (p) => ({ x0: p.x - STAR / 2, y0: p.y - STAR, x1: p.x + STAR / 2, y1: p.y });

// Where a star goes: over its point, but off the controls, and over the head of the hero when the
// point is on the hero (a person next to the hero). hero: the box of the hero, or null.
export function placeStar(p, { controls = [], hero = null } = {}) {
  let b = starBox(p);
  if (hero && overlaps(b, hero)) {
    const dy = b.y1 - (hero.y0 - 2);
    b = { ...b, y0: b.y0 - dy, y1: b.y1 - dy };
  }
  b = upOutOf(b, controls);
  return { x: (b.x0 + b.x1) / 2, y: b.y1 };
}

// Where an arrow at the edge of the screen goes: its point, off the controls (an arrow is about
// 44 x 34).
export function placeArrow(p, { controls = [] } = {}) {
  const b = upOutOf({ x0: p.x - 22, y0: p.y - 17, x1: p.x + 22, y1: p.y + 17 }, controls);
  return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
}

// The longest time of a line of a person who is not on the screen (seconds): the bubble waits at
// the edge only a short time.
export const AWAY_LIFE = 3;

// Where a bubble goes. head: the screen point over the head of the person; w, h: the size of the
// bubble; screen: { w, h, top (the bottom of the HUD), bottom (the top of the controls) }; hero: the
// box of the hero, or null; controls: the boxes of the controls. The bubble stands over the head,
// and stays on the screen: a person off the screen talks from the edge nearest to the person, with
// a tail toward the person. A bubble never covers the hero: it goes over the hero, or under the
// hero when there is no room over it. A bubble never covers a star (#56): it goes to the other side
// of its person (the side away from the star, or under the feet). stars: the boxes of the stars and
// the arrows; foot: the screen point of the feet of the person, or null. Return { x0, y0, x1, y1,
// away, tail } (tail: the screen point of the person when away, else null).
export function placeBubble(head, w, h, { screen, hero = null, controls = [], stars = [], foot = null }) {
  const margin = 8;
  const top = screen.top ?? 0;
  const bottom = screen.bottom ?? screen.h;
  const away = head.x < 0 || head.x > screen.w || head.y < top || head.y > bottom + h;
  const clampX = (x) => Math.max(margin + w / 2, Math.min(screen.w - margin - w / 2, x));
  const clampY = (y1) => Math.max(top + margin + h, Math.min(bottom - margin, y1));
  const x = clampX(head.x);
  let b = { x0: x - w / 2, x1: x + w / 2, y1: clampY(head.y) };
  b.y0 = b.y1 - h;
  if (hero && overlaps(b, hero)) {
    // Over the hero, or under the hero when the top of the screen is too near.
    const over = hero.y0 - 4;
    const y1 = over - h >= top + margin ? over : hero.y1 + 4 + h;
    b = { ...b, y0: y1 - h, y1 };
  }
  b = upOutOf(b, controls);
  const star = stars.find((o) => overlaps(b, o));
  if (star && !away) {
    // The other side of the person: beside the head, away from the star, then under the feet.
    const gap = 6;
    const low = (foot?.y ?? head.y + h) + gap;
    const lx = Math.min(head.x, star.x0) - gap;
    const rx = Math.max(head.x, star.x1) + gap;
    const left = { x0: lx - w, x1: lx, y0: head.y - h, y1: head.y };
    const right = { x0: rx, x1: rx + w, y0: head.y - h, y1: head.y };
    const under = { x0: x - w / 2, x1: x + w / 2, y0: low, y1: low + h };
    const sides = (star.x0 + star.x1) / 2 > head.x ? [left, right, under] : [right, left, under];
    const fits = (c) => c.x0 >= margin && c.x1 <= screen.w - margin && c.y0 >= top + margin && c.y1 <= bottom - margin;
    const free = (c) => fits(c) && !stars.some((o) => overlaps(c, o)) && !(hero && overlaps(c, hero)) && !controls.some((o) => overlaps(c, o));
    const other = sides.find(free);
    if (other) b = other;
  }
  return { ...b, away, tail: away ? { x: head.x, y: head.y } : null };
}
