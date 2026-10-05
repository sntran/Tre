import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLoadProgress, LOAD_STEPS, SLOW_MS, formatTimes, partOfLine, startTarget, roadTo, zoomView, boxOf, ROAD_FROM, SEAL_FROM } from '../src/core/loading.js';
import { createProjection } from '../src/world/geo.js';
import { createProfile } from '../src/core/profile.js';
import { activityOf } from '../src/core/practice.js';
import { loadGameData, load } from './helpers.js';

const data = await loadGameData();
const fakeClock = () => {
  let t = 0;
  return { now: () => t, add: (ms) => { t += ms; } };
};

test('the progress has the steps of the load in their order, never goes back, and reaches the end only when the world is drawn', () => {
  assert.deepEqual(LOAD_STEPS, ['data', 'heights', 'code', 'land', 'world', 'chunks', 'figures']);
  const clock = fakeClock();
  const p = createLoadProgress({ now: clock.now });
  assert.equal(p.step, 'data');
  assert.equal(p.progress, 0);
  let last = 0;
  for (const step of LOAD_STEPS) {
    for (const part of [0, 0.5, 1]) {
      clock.add(100);
      p.report(step, part);
      assert.equal(p.step, step);
      assert.ok(p.progress >= last, `${step} ${part}: the road never goes back`);
      assert.ok(p.progress < 1, `${step} ${part}: the road reaches the seal only at the end`);
      last = p.progress;
    }
  }
  // A step that is closed changes nothing, and a smaller part of the same step changes nothing.
  p.report('land', 1);
  p.report('figures', 0);
  assert.equal(p.step, 'figures');
  assert.equal(p.progress, last);
  p.finish();
  assert.equal(p.progress, 1);
  assert.equal(p.step, null);
  assert.ok(p.finished);
});

test('a later step closes the steps before it, and each step keeps its time', () => {
  const clock = fakeClock();
  const p = createLoadProgress({ now: clock.now });
  clock.add(16);
  p.shown();
  clock.add(100);
  p.report('code');
  clock.add(300);
  p.report('land', 0.5);
  clock.add(50);
  p.finish();
  const times = p.times();
  assert.equal(times.shown, 16);
  assert.equal(times.data, 116);
  assert.equal(times.heights, 0);
  assert.equal(times.code, 300);
  assert.equal(times.land, 50);
  assert.equal(times.total, 466);
  assert.deepEqual(Object.keys(times), ['shown', 'data', 'heights', 'code', 'land', 'world', 'chunks', 'figures', 'total']);
  assert.match(formatTimes(times), /^shown 16 · data 116 · heights 0 · code 300 · land 50 · .* · total 466 ms$/);
});

test('a load longer than ten seconds is slow, and a finished load is not', () => {
  const clock = fakeClock();
  const p = createLoadProgress({ now: clock.now });
  clock.add(SLOW_MS - 1);
  assert.equal(p.slow, false);
  clock.add(2);
  assert.equal(p.slow, true);
  p.finish();
  assert.equal(p.slow, false);
});

test('the drawn part of the road follows its length', () => {
  const line = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
  assert.deepEqual(partOfLine(line, 0), [{ x: 0, y: 0 }, { x: 0, y: 0 }]);
  assert.deepEqual(partOfLine(line, 0.25), [{ x: 0, y: 0 }, { x: 5, y: 0 }]);
  assert.deepEqual(partOfLine(line, 0.75), [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }]);
  assert.deepEqual(partOfLine(line, 1), line);
  assert.deepEqual(partOfLine(line, 2), line);
});

test('the road goes to the place of each kind of start, and the line names that place', () => {
  const world = data.world;
  const now = Date.UTC(2026, 0, 1);
  const profile = createProfile({ id: 'p1', name: 'Mai', grade: 2, lang: 'vi', now, seed: 7 });
  const giong = data.geo.places.find((p) => p.id === 'phu-dong');

  // A new hero, or a profile with a save: the place of the hero.
  const start = startTarget(data, { profile });
  assert.equal(start.region, 'giong');
  assert.equal(start.name, 'Phù Đổng');
  const road = roadTo(world, start);
  assert.ok(road.length >= 2);
  assert.deepEqual(road[road.length - 1], start.at);
  // With no travel, the hero comes from the place of the region of the chapter before.
  assert.deepEqual(road[0], data.geo.places.find((p) => p.id === 'nghia-linh').at);

  // A practice link: the place of the activity.
  const practice = activityOf(data.practice, 'ren-sat');
  const visit = startTarget(data, { profile, practice });
  assert.equal(visit.region, 'giong');
  assert.ok(Math.hypot(visit.at[0] - giong.at[0], visit.at[1] - giong.at[1]) < 0.2, 'the forge is near Phù Đổng');

  // A travel: the way from the region of the start of the travel.
  const entry = world.entryOf('giong');
  const arrival = startTarget(data, { profile, map: entry.map, at: { x: entry.x, y: entry.y } });
  const way = roadTo(world, arrival, 'van-lang');
  const legs = world.travelWay('van-lang', 'giong').legs;
  assert.deepEqual(way[0], legs[0].line[0]);
  assert.deepEqual(way[way.length - 1], arrival.at);
});

test('the loading screen has no fact text and no numeral: one line with the name of the place', () => {
  const src = readFileSync('src/ui/loading.js', 'utf8');
  const keys = [...src.matchAll(/\bt\('([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(keys)].sort(), ['loading.going', 'loading.slow', 'ui.worldmap']);
  for (const lang of ['vi', 'en']) {
    const texts = load(`i18n/${lang}.json`);
    for (const key of keys) {
      assert.ok(texts[key], `${lang}: ${key}`);
      assert.doesNotMatch(texts[key], /[0-9?]/, `${lang}: ${key} has a numeral or a question`);
    }
    assert.match(texts['loading.going'], /\{place\}/);
  }
  // The names of the places that a start can go to.
  for (const r of data.world.regions) {
    const ids = new Set([r.place, ...(r.places ?? [])]);
    for (const p of data.geo.places.filter((x) => ids.has(x.id))) assert.doesNotMatch(p.name, /[0-9?]/, p.name);
  }
});

test('each kind of start shows the loading screen before its first wait, and only the first frame of the world ends it', () => {
  const app = readFileSync('src/ui/app.js', 'utf8');
  const body = (name) => {
    const i = app.indexOf(`async ${name}(`);
    assert.ok(i >= 0, name);
    return app.slice(i, app.indexOf('\n    },', i));
  };
  // A new hero and a practice link (startProfile), a tap on a profile card (playProfile), and a
  // travel or any other new world of the village (go).
  for (const name of ['startProfile', 'playProfile', 'go']) {
    const b = body(name);
    const show = b.indexOf('ctx.beginLoading(');
    assert.ok(show > 0, `${name} shows the loading screen`);
    assert.ok(show < b.indexOf('await '), `${name} shows the loading screen before its first wait`);
  }
  assert.match(body('go'), /name === 'village' && !params\.session/);
  // The screen goes when the world is drawn with the hero (or when no world can show).
  const village = readFileSync('src/ui/village.js', 'utf8');
  const ends = [...village.matchAll(/ctx\.endLoading\(\)/g)].length;
  assert.equal(ends, 3, 'the first frame, no world, and the unmount');
  assert.match(village, /if \(warming === 'done'\) \{\s*\/\/ The first frame of the world is on the screen\.\s*warming = null;\s*ctx\.endLoading\(\);/);
});

test('the first view shows the whole country; the zoom grows with the progress and never goes back; the road draws in the last part, and the seal shows at the end', () => {
  const proj = createProjection(data.geo.bbox);
  const land = data.geo.land.VNM.flatMap((r) => r.map(proj.toMap));
  const aspect = 3 / 4;
  const all = boxOf(land, aspect, 1.08);
  const start = startTarget(data, { profile: createProfile({ id: 'p', name: 'Mai', grade: 2, lang: 'vi', now: 0, seed: 7 }) });
  const road = roadTo(data.world, start).map(proj.toMap);
  const end = boxOf(road, aspect, 1.5);
  // The first view holds the whole land of Vietnam.
  const first = zoomView(all, end, 0);
  for (const p of land) assert.ok(p.x >= first.x && p.x <= first.x + first.w && p.y >= first.y && p.y <= first.y + first.h, 'the whole country is in the first view');
  assert.equal(first.road, 0);
  assert.equal(first.seal, 0);
  // The last view is the view of the road and the place.
  const last = zoomView(all, end, 1);
  for (const k of ['x', 'y', 'w', 'h']) assert.ok(Math.abs(last[k] - end[k]) < 1e-6, k);
  assert.equal(last.road, 1);
  assert.equal(last.seal, 1);
  // The zoom only grows, and the place of the start stays in the view.
  let w = Infinity;
  const place = road[road.length - 1];
  for (let i = 0; i <= 20; i++) {
    const p = i / 20;
    const v = zoomView(all, end, p);
    assert.ok(v.w <= w + 1e-9, `the view never grows wider at ${p.toFixed(2)}`);
    w = v.w;
    assert.ok(place.x >= v.x && place.x <= v.x + v.w && place.y >= v.y && place.y <= v.y + v.h, `the place is in the view at ${p.toFixed(2)}`);
    assert.equal(v.road > 0, p > ROAD_FROM + 1e-9, `the road at ${p.toFixed(2)}`);
    assert.equal(v.seal > 0, p > SEAL_FROM + 1e-9, `the seal at ${p.toFixed(2)}`);
  }
});

test('the loading screen draws the map with soft colors of the regions, and its shown progress never goes back', () => {
  const src = readFileSync('src/ui/loading.js', 'utf8');
  assert.match(src, /drawBase\(svg, ctx, proj, eraSouth, \{ soft: true \}\)/);
  assert.match(src, /zoomView\(all, end, shown\)/);
  assert.match(src, /shown = Math\.max\(shown,/);
});
