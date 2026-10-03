import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { GALLERY_PAGES, galleryItems, galleryPage, placedBox } from '../src/world/gallery.js';
import { PROPS } from '../src/world/props/index.js';
import { HATS } from '../src/world/fine.js';
import { SURFACE, createTerrain } from '../src/world/terrain.js';
import { createTileMap } from '../src/core/tilemap.js';
import { load } from './helpers.js';

const figures = load('data/figures.json');
const tiles = load('data/tiles.json').types;
const blocks = load('data/world/blocks.json');
const maps = readdirSync('data/maps').filter((f) => f.endsWith('.json')).map((f) => load(`data/maps/${f}`));
const data = { figures, maps };

test('the pages of the gallery show every look, hair choice, hat, prop, and kind of ground of the data', () => {
  const ids = Object.fromEntries(GALLERY_PAGES.map((p) => [p, galleryItems(p, data)]));
  const keys = (page) => new Set(ids[page].map((it) => it.key).filter(Boolean));
  // Every look of data/figures.json: the people and the animals on their pages, the things on the
  // page of the things.
  for (const key of Object.keys(figures.figures)) assert.ok(['people', 'animals', 'things'].some((p) => keys(p).has(key)), `${key} is in the gallery`);
  for (const [key, look] of Object.entries(figures.figures)) if (!look.kind) assert.ok(keys('people').has(key), `${key} is a person`);
  for (const k of ['nghe', 'buffalo', 'dog', 'chicken', 'duck', 'duckling', 'fish', 'frog', 'bird']) assert.ok(keys('animals').has(k), `${k} is an animal`);
  const people = ids.people.map((it) => it.look);
  for (const hair of figures.hero.hairs) assert.ok(people.some((l) => l.child && l.hair === hair), `the hair choice ${hair}`);
  for (const hat of HATS) assert.ok(people.some((l) => l.hat === hat), `the hat ${hat}`);
  for (const g of Object.keys(figures.hero.genders)) assert.ok(ids.people.some((it) => it.id === `hero-${g}`), `the hero (${g})`);
  for (const prop of Object.keys(PROPS)) assert.ok(ids.things.some((it) => it.prop === prop), `the prop ${prop}`);
  for (const [name, kind] of Object.entries(SURFACE)) if (kind) assert.ok(ids.ground.some((it) => it.surface === name), `the ground ${name}`);
  assert.ok(['road-bank', 'road-dry', 'paddy', 'river'].every((id) => ids.ground.some((it) => it.id === id)), 'the roads, the paddies, and the river');
});

test('a new look in the data is in the gallery with no other change', () => {
  const more = { ...figures, figures: { ...figures.figures, 'test-weaver': { skin: 'skin3', top: 'green', bottom: 'indigo', hair: 'bun', face: 2 } } };
  const before = galleryItems('people', data).map((it) => it.id);
  const after = galleryItems('people', { figures: more, maps }).map((it) => it.id);
  assert.deepEqual(after.filter((id) => id !== 'test-weaver'), before);
  assert.ok(after.includes('test-weaver'));
});

test('no item is two times in a page, and the items of a page do not touch on the plot', () => {
  for (const page of GALLERY_PAGES) {
    const { items, size } = galleryPage(page, data);
    assert.equal(new Set(items.map((it) => it.id)).size, items.length, `${page}: each item one time`);
    const boxes = items.map(placedBox);
    for (const b of boxes) assert.ok(b.x0 >= 0 && b.z0 >= 0 && b.x1 <= size.width && b.z1 <= size.height, `${page}: on the plot`);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const [a, b] = [boxes[i], boxes[j]];
        const apart = a.x1 + 0.5 <= b.x0 || b.x1 + 0.5 <= a.x0 || a.z1 + 0.5 <= b.z0 || b.z1 + 0.5 <= a.z0;
        assert.ok(apart, `${page}: ${items[i].id} and ${items[j].id} touch`);
      }
    }
  }
});

test('the plot of a page is built by the terrain of the game; the ground page has each surface, a road strip, and a forest floor', () => {
  assert.equal(galleryPage('nothing', data), null, 'a page that does not exist');
  for (const page of GALLERY_PAGES) {
    const { map } = galleryPage(page, data);
    const t = createTerrain(map, tiles, createTileMap(map, tiles), blocks);
    for (let cz = 0; cz * 16 < map.height; cz++) for (let cx = 0; cx * 16 < map.width; cx++) t.chunk(cx, cz);
    if (page === 'things') assert.equal(t.objects.length, Object.keys(PROPS).length, 'every prop is built');
    if (page !== 'ground') continue;
    const kinds = new Set();
    let strips = 0;
    for (let z = 0; z < map.height; z++) {
      for (let x = 0; x < map.width; x++) {
        kinds.add(t.surface(x, z)[0]);
        if (t.strip(x, z)) strips += 1;
      }
    }
    for (const [name, kind] of Object.entries(SURFACE)) if (kind) assert.ok(kinds.has(kind), `the ground ${name} on the plot`);
    assert.ok(strips > 40, `${strips} tops under the strips of the roads`);
  }
});
