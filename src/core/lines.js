// The lines over the heads of the people (#38): one person talks at a time. A new line of a person
// near the hero takes away the lines of the other people that are still on the screen; a line of a
// person far away does not. A line in the box of a talk (a dialogue or a say) is a new line too.
// The view draws the lines (src/ui/village.js); the rule and the time of a line are here, so that
// the tests can check them. Pure: no DOM.

export const LINE_LIFE = 2.2; // seconds: a short line over a head
export const TALK_NEAR = 24; // half blocks: a person this near the hero talks to the hero

// The seconds that a line stays: a longer line stays longer (a greeting of one sentence).
export const lineLife = (text = '') => Math.max(LINE_LIFE, 0.8 + String(text).length * 0.06);

// lines: [{ id, ... }] on the screen now; id: the person of the new line; near: that person is near
// the hero. Return the lines that stay before the new line shows.
export function linesAfter(lines, id, near) {
  return near ? lines.filter((l) => l.id === id) : lines;
}

// Is a person near the hero? a, b: positions in half blocks ({ x, z }).
export const nearHero = (a, b) => Boolean(a && b) && Math.hypot(a.x - b.x, a.z - b.z) <= TALK_NEAR;
