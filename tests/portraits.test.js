import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { portraitKey, createLru, speakerLook, MOODS, CACHE_SIZE } from '../src/world/portraits.js';
import { heroLook } from '../src/world/figures.js';
import { personFine } from '../src/world/fine.js';
import { colorIndex } from '../src/world/voxel.js';
import { load } from './helpers.js';

const figures = load('data/figures.json');

test('the same key gives the same image; a change of look, mood, or framing gives a new key', () => {
  const a = { skin: 'skin2', top: 'indigo', hair: 'short' };
  const b = { hair: 'short', top: 'indigo', skin: 'skin2' };
  assert.equal(portraitKey({ look: a }), portraitKey({ look: b }), 'the order of the keys does not count');
  assert.notEqual(portraitKey({ look: a }), portraitKey({ look: { ...a, hair: 'bun' } }));
  assert.notEqual(portraitKey({ look: a }), portraitKey({ look: a, mood: 'happy' }));
  assert.notEqual(portraitKey({ look: a }), portraitKey({ look: a, framing: 'full' }));
  assert.notEqual(portraitKey({ look: a }), portraitKey({ look: a, size: 56 }));
  assert.notEqual(portraitKey({ look: a }), portraitKey({ look: a, ratio: 2 }));
  assert.equal(portraitKey({ look: a, mood: 'angry' }), portraitKey({ look: a }), 'a mood out of the list is calm');
});

test('the cache keeps the portraits that were used last', () => {
  const c = createLru(3);
  c.set('a', 1);
  c.set('b', 2);
  c.set('c', 3);
  assert.equal(c.get('a'), 1);
  c.set('d', 4);
  assert.deepEqual(c.keys(), ['c', 'a', 'd'], 'b was used least recently');
  assert.equal(c.size, 3);
  assert.equal(CACHE_SIZE, 64);
});

test('every speaker of the dialogue data has a look in data/figures.json', () => {
  const speakers = new Set(['examiner', 'giong', 'hero']);
  for (const f of readdirSync(new URL('../data/dialogue/', import.meta.url))) {
    for (const d of load(`data/dialogue/${f}`).dialogues) {
      for (const n of Object.values(d.nodes)) {
        if (n.speaker) speakers.add(n.speaker);
        if (n.mood !== undefined) assert.ok(MOODS.includes(n.mood), `the mood ${n.mood} of ${d.id}`);
      }
    }
  }
  const hero = heroLook({ gender: 'girl', skin: 3, face: 2, hair: 4, clothes: 2 }, figures.hero);
  for (const s of speakers) {
    if (s === 'narrator') continue;
    for (const flags of [{}, { 'giong.grown': true }]) assert.ok(speakerLook(s, { figures: figures.figures, flags, hero }), `a look for ${s}`);
  }
  assert.equal(speakerLook('narrator', { figures: figures.figures }), null);
  assert.notDeepEqual(speakerLook('giong', { figures: figures.figures }), speakerLook('giong', { figures: figures.figures, flags: { 'giong.grown': true } }), 'Gióng grows');
});

test('every option of hero creation comes from data/figures.json', () => {
  const o = figures.hero;
  assert.deepEqual(Object.keys(load('data/hero.json')).filter((k) => !k.startsWith('_')), ['nameMax'], 'data/hero.json has no looks');
  for (const s of o.skins) assert.ok(colorIndex(s) > 0, `the skin ${s} is a color of the palette`);
  for (const c of o.clothes) for (const v of Object.values(c)) assert.ok(colorIndex(v) > 0, v);
  const seen = new Set();
  for (const gender of Object.keys(o.genders)) {
    for (let skin = 1; skin <= o.skins.length; skin++) for (let face = 1; face <= o.faces.length; face++) for (let hair = 1; hair <= o.hairs.length; hair++) for (let clothes = 1; clothes <= o.clothes.length; clothes++) {
      const look = heroLook({ gender, skin, face, hair, clothes }, o);
      assert.equal(look.skin, o.skins[skin - 1]);
      assert.equal(look.hair, o.hairs[hair - 1]);
      assert.equal(look.top, o.clothes[clothes - 1].top);
      assert.equal(look.bottomKind, o.genders[gender].bottomKind);
      seen.add(JSON.stringify(look));
    }
  }
  assert.equal(seen.size, 2 * o.skins.length * o.faces.length * o.hairs.length * o.clothes.length, 'each choice gives its own hero');
  assert.equal(heroLook({ gender: 'girl', clothes: 1 }, o).bottomKind, 'skirt', 'a girl wears a skirt');
  // Hero creation reads the choices from data/figures.json, and no picture file.
  const create = readFileSync(new URL('../src/ui/create.js', import.meta.url), 'utf8');
  assert.ok(create.includes('ctx.data.figures.hero'));
  assert.ok(!/art\/hero|hero\/skin|hero\/face|hero\/hair|hero\/clothes/.test(create));
});

test('a mood changes the brows and the mouth of a face', () => {
  const look = figures.figures.elder;
  const face = (mood) => JSON.stringify(personFine({ ...look, mood }).parts.filter((p) => /^(brow|mouth)/.test(p.name)).map((p) => [p.name, p.at, p.size, p.color]));
  const all = MOODS.map(face);
  assert.equal(new Set(all).size, MOODS.length, 'each mood has its own face');
  assert.equal(face(undefined), face('calm'));
});

test('no picture of a person or a thing of the world is left, and no code asks for one', () => {
  for (const dir of ['hero', 'npc', 'friend', 'thing', 'calling']) {
    assert.throws(() => readdirSync(new URL(`../art/${dir}/`, import.meta.url)), `art/${dir} is gone`);
  }
  const files = [];
  const walk = (url) => {
    for (const e of readdirSync(url, { withFileTypes: true })) {
      if (e.isDirectory()) walk(new URL(`${e.name}/`, url));
      else if (/\.(js|json|html|css)$/.test(e.name)) files.push(new URL(e.name, url));
    }
  };
  for (const d of ['src/', 'data/', 'styles/']) walk(new URL(`../${d}`, import.meta.url));
  files.push(new URL('../sw.js', import.meta.url), new URL('../index.html', import.meta.url));
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    assert.ok(!/art\/(hero|npc|friend|thing|calling)\/|['"](hero|npc|friend|thing|calling)\/[a-z-]+['"]/.test(text), `${f.pathname} asks for an old picture`);
  }
});
