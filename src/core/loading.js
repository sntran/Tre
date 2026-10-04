// The load of the world, from the tap that starts the game to the first frame of the world with
// the hero in it (docs/LOADING.md). The loading screen (src/ui/loading.js) draws a road on the map
// of Vietnam, and the length of the road is the progress of these steps, never a timer.

import { heroPlace } from './world/save.js';

// The steps of the load, in their order:
// - data: the texts of the language of the profile, the profile, and the learning log;
// - heights: the height tiles of the land around the start;
// - code: the drawing code (three.js and src/render), while the workers make the land;
// - land: the tiles of the land around the hero (made in the workers);
// - world: the session and the world state of the map;
// - chunks: the meshes of the near chunks around the hero;
// - figures: the shaders and the first frame of the world with the hero in it.
export const LOAD_STEPS = Object.freeze(['data', 'heights', 'code', 'land', 'world', 'chunks', 'figures']);
// The part of the road for each step (about the part of the time on a phone).
const WEIGHTS = Object.freeze({ data: 1, code: 2, heights: 2, world: 2, land: 3, chunks: 4, figures: 1 });
// After this time, the line of the screen adds that the game is still getting the land ready.
export const SLOW_MS = 10000;

// now: a clock in milliseconds (performance.now in the browser).
export function createLoadProgress({ now, steps = LOAD_STEPS, weights = WEIGHTS, slowMs = SLOW_MS }) {
  const weight = (id) => weights[id] ?? 1;
  const total = steps.reduce((s, id) => s + weight(id), 0);
  const t0 = now();
  const times = {};
  let index = 0; // the step that goes on now
  let part = 0; // the part of that step that is done (0 to 1)
  let since = t0; // the start of that step
  let drawn = 0; // the progress that the screen shows
  let finished = false;
  let end = null;
  let shown = null; // the time from the start to the first frame of the screen

  // Close the steps before the step i, and keep the time of each.
  function closeTo(i) {
    while (index < i) {
      const t = now();
      times[steps[index]] = t - since;
      since = t;
      index += 1;
      part = 0;
    }
  }

  return {
    // A step tells its part (0 to 1). A later step closes the steps before it; a step that is
    // already closed changes nothing.
    report(id, fraction = 0) {
      const i = steps.indexOf(id);
      if (finished || i < index) return;
      closeTo(i);
      part = Math.max(part, Math.min(1, Math.max(0, fraction)));
    },
    // The first frame of the screen is drawn.
    shown() {
      if (shown === null) shown = now() - t0;
    },
    // The world is drawn with the hero: all steps are done.
    finish() {
      if (finished) return;
      closeTo(steps.length);
      finished = true;
      end = now();
    },
    // The part of the road (0 to 1). It never goes back, and it is 1 only after finish.
    get progress() {
      if (finished) return 1;
      let done = 0;
      for (let i = 0; i < index; i++) done += weight(steps[i]);
      drawn = Math.max(drawn, Math.min(0.99, (done + weight(steps[index]) * part) / total));
      return drawn;
    },
    get step() { return finished ? null : steps[index]; },
    get finished() { return finished; },
    // Is the load longer than the limit of the attention of the user?
    get slow() { return !finished && now() - t0 > slowMs; },
    // The time of each step that is done (ms), and the time of all of them.
    times() {
      return { ...(shown === null ? {} : { shown }), ...times, total: (end ?? now()) - t0 };
    },
  };
}

// The times of the steps for the ?fps meter: "shown 16 · data 12 · … · total 2100 ms" (shown: the
// first frame of the loading screen after the tap).
export function formatTimes(times) {
  const parts = ['shown', ...LOAD_STEPS, 'total'].filter((id) => Number.isFinite(times?.[id])).map((id) => `${id} ${Math.round(times[id])}`);
  return parts.length ? `${parts.join(' · ')} ms` : '';
}

// The first part of a line (points { x, y }) for a part f (0 to 1) of its length: the drawn part of
// the road on the map. The last point is on the line at that length.
export function partOfLine(points, f) {
  if (points.length < 2) return points.slice();
  const lengths = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const l = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    lengths.push(l);
    total += l;
  }
  let left = Math.max(0, Math.min(1, f)) * total;
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const l = lengths[i - 1];
    if (left >= l) {
      out.push(points[i]);
      left -= l;
      continue;
    }
    const k = l ? left / l : 0;
    out.push({ x: points[i - 1].x + (points[i].x - points[i - 1].x) * k, y: points[i - 1].y + (points[i].y - points[i - 1].y) * k });
    break;
  }
  return out;
}

// The place where a start goes: { map, region, at: [longitude, latitude], name }. The name is the
// nearest named place of the region. practice: the activity of a practice link; map and at: the
// arrival of a travel; else the place of the hero in the save (or the start of the game).
export function startTarget(data, { profile = null, practice = null, map = null, at = null } = {}) {
  const world = data.world;
  let mapId = null;
  let x = null;
  let y = null;
  if (practice) {
    mapId = world.regionOf(practice.at[0]);
    [x, y] = world.at(...practice.at);
  } else if (map) {
    mapId = map;
    x = at?.x ?? null;
    y = at?.y ?? null;
  } else {
    const p = profile?.world ? heroPlace(profile.world) : { map: null, x: null, y: null };
    if (world.map(p.map)) ({ map: mapId, x, y } = p);
  }
  const region = world.regionOf(mapId) ?? world.start.region;
  const r = world.region(region);
  const places = data.geo.places;
  const home = places.find((p) => p.id === r.place);
  const point = Number.isFinite(x) && Number.isFinite(y) ? world.geoAt(mapId, x, y) : null;
  const geo = point ?? home.at;
  const ids = new Set([r.place, ...(r.places ?? [])]);
  const d = (p) => (p.at[0] - geo[0]) ** 2 + (p.at[1] - geo[1]) ** 2;
  const named = places.filter((p) => ids.has(p.id)).sort((a, b) => d(a) - d(b))[0] ?? home;
  return { map: mapId ?? world.start.map, region, at: geo, name: named.name };
}

// The road on the map to a start ([longitude, latitude] points): the way of the travel from the
// region `from`; for a start with no travel, the way from the region of the chapter before (the
// hero comes from there). The last point is the place of the start.
export function roadTo(world, target, from = null) {
  const here = world.region(target.region);
  const before = from && from !== target.region
    ? from
    : world.regions.filter((r) => r.chapter < here.chapter).sort((a, b) => b.chapter - a.chapter)[0]?.id ?? world.regions.find((r) => r.id !== target.region)?.id;
  const way = before ? world.travelWay(before, target.region) : null;
  const line = way ? way.legs.flatMap((l, i) => (i ? l.line.slice(1) : l.line)) : [];
  const last = line[line.length - 1];
  if (!last || Math.hypot(last[0] - target.at[0], last[1] - target.at[1]) > 1e-4) line.push(target.at);
  // With no way, a short road from the south-west.
  if (line.length < 2) line.unshift([target.at[0] - 0.5, target.at[1] - 0.3]);
  return line;
}
