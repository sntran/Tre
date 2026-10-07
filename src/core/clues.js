// Find a place by real clues, not by a mark (#27; data/world/clues.json; docs/WORLD.md, "Finding
// Trâu Sơn"). The hero has never seen the place: the arrow of the quest shows only the way (toward
// the sunrise) until the hero stands in the area of the place, people on the way say what they
// know, and a person at a wrong place says why it is not the place. Pure: no DOM.

// The cells ahead of the hero where the arrow of the quest points before the place is found.
export const AHEAD = 40;

// The area of a find on the plane: { x0, y0, x1, y1 } (cells). at(frame, x, y): the plane cell of a
// cell of a frame (data.world.at).
export function areaOf(find, at) {
  const [x0, y0] = at(find.frame, find.area[0], find.area[1]);
  const [x1, y1] = at(find.frame, find.area[2], find.area[3]);
  return { x0, y0, x1, y1 };
}

export const inArea = (a, x, y) => x >= a.x0 && x < a.x1 && y >= a.y0 && y < a.y1;

// The finds that the hero did not find yet.
export const openFinds = (clues, flags) => (clues?.finds ?? []).filter((f) => !flags[f.flag]);

// The find whose area holds the cell, and that the hero did not find yet; or null.
export function hiddenAt(clues, at, flags, x, y) {
  return openFinds(clues, flags).find((f) => inArea(areaOf(f, at), x, y)) ?? null;
}

// The road of a find on the plane (the road that the people of the way use, data path): its two
// ends { a, b } (plane cells), or null.
export function wayOf(find, at) {
  if (!find.path) return null;
  const [a, b] = find.path.map(([frame, x, y]) => at(frame, x, y));
  return { a: { x: a[0], y: a[1] }, b: { x: b[0], y: b[1] } };
}

// The point of the road of a find at the part t (0: its start, 1: its end in the area).
export function wayPoint(way, t) {
  return { x: way.a.x + (way.b.x - way.a.x) * t, y: way.a.y + (way.b.y - way.a.y) * t };
}

// A mark of the quest ({ x, y, h }, plane cells) as the hero sees it: a mark in the area of a place
// that the hero did not find yet points only the way, ahead of the hero (hero: { x, y }). With a
// road (#56), the mark is on the road, AHEAD cells past the point of the road nearest to the
// hero, and the road ends in the area: a child who follows the star walks the road, meets the
// people of the way, and comes into the area. A hero who went past the area turns back to it.
export function questMark(clues, at, flags, mark, hero) {
  const f = hiddenAt(clues, at, flags, mark.x, mark.y);
  if (!f) return mark;
  const way = wayOf(f, at);
  if (!way) return { ...mark, x: hero.x + f.toward[0] * AHEAD, y: hero.y + f.toward[1] * AHEAD };
  const dx = way.b.x - way.a.x;
  const dy = way.b.y - way.a.y;
  const len = Math.hypot(dx, dy) || 1;
  const t = Math.max(0, Math.min(1, ((hero.x - way.a.x) * dx + (hero.y - way.a.y) * dy) / (len * len)));
  const a = areaOf(f, at);
  const past = (hero.x - a.x1) * f.toward[0] + (hero.y - a.y1) * f.toward[1] > 0;
  const p = wayPoint(way, past ? 1 : Math.min(1, t + AHEAD / len));
  return { ...mark, x: p.x, y: p.y };
}

// Is the hero on the way to the place: east of the column of the way, and not in the area yet?
export function onWay(find, at, x, y) {
  const a = areaOf(find, at);
  const [wx] = at(find.way.frame, find.way.x, 0);
  return x > wx && x < a.x0 && !inArea(a, x, y);
}

// The line of a person who greets the hero (who: the id of the person), or null. A person at a
// wrong place says why it is not the place. On the way, when the quest leads to the place (leads(find)),
// the next clue that nobody said yet: each clue from another person. The flag clue.<find>.<n>
// keeps the person who said it. Return { textKey, set: { flag: who } | null }.
export function clueLine(clues, at, flags, who, hero, leads = () => true) {
  for (const f of openFinds(clues, flags)) {
    const wrong = (f.wrong ?? []).find((w) => `npc:${w.npc}` === who);
    if (wrong) return { textKey: wrong.textKey, set: null };
    if (!leads(f) || !onWay(f, at, hero.x, hero.y)) continue;
    const n = f.clues.findIndex((_, k) => !flags[`clue.${f.id}.${k}`]);
    if (n < 0) continue;
    if (Object.keys(flags).some((k) => k.startsWith(`clue.${f.id}.`) && flags[k] === who)) continue;
    return { textKey: f.clues[n].textKey, set: { [`clue.${f.id}.${n}`]: who } };
  }
  return null;
}
