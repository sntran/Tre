import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorldState, addEntity } from '../src/core/world/state.js';
import { HEAR, loudness, createHearing } from '../src/core/hearing.js';

function world() {
  const w = createWorldState({ seed: 1, map: 'test', clock: { minutes: 600 } });
  addEntity(w, { id: 'hero', position: { x: 0, y: 0, z: 0, facing: 0 } });
  addEntity(w, { id: 'duck:1', position: { x: 4, y: 0, z: 0, facing: 0 } });
  addEntity(w, { id: 'duck:far', position: { x: HEAR.far + 2, y: 0, z: 0, facing: 0 } });
  addEntity(w, { id: 'npc:smith', position: { x: 20, y: 0, z: 0, facing: 0 } });
  return w;
}

test('a sound of the world is softer with the distance, and none plays past about twenty blocks (#49)', () => {
  assert.equal(loudness(0), 1);
  assert.equal(loudness(HEAR.near), 1);
  assert.ok(loudness(20) > 0 && loudness(20) < 1);
  assert.ok(loudness(30) < loudness(20));
  assert.equal(loudness(HEAR.far), 0);
  const w = world();
  const ears = createHearing();
  assert.equal(ears.hear({ type: 'flee', id: 'duck:far', sound: 'quack' }, w, 0), 0, 'a far duck is not heard');
  assert.ok(ears.hear({ type: 'greet', id: 'npc:smith', sound: 'greet' }, w, 0) < 1, 'a person at ten blocks is soft');
  assert.equal(ears.hear({ type: 'flee', id: 'duck:1', sound: 'quack' }, w, 0), 1, 'a near duck is heard');
  assert.equal(ears.hear({ type: 'x', id: 'gone', at: { x: 100, z: 0 }, sound: 'splash' }, w, 10), 0, 'the point of an event is its place');
});

test('a sound of a kind plays at most once in a short time and a few times a minute; at most a few sounds at once', () => {
  const w = world();
  const ears = createHearing();
  const quack = { type: 'flee', id: 'duck:1', sound: 'quack' };
  // A duck that flees every second for a minute.
  let heard = 0;
  for (let s = 0; s < 60; s++) if (ears.hear(quack, w, s) > 0) heard++;
  assert.equal(heard, HEAR.perMinute);
  // The gap: two quacks within the gap are one.
  const ears2 = createHearing();
  assert.ok(ears2.hear(quack, w, 0) > 0);
  assert.equal(ears2.hear(quack, w, HEAR.gap / 2), 0);
  assert.ok(ears2.hear(quack, w, HEAR.gap + 0.1) > 0);
  // Nine kinds at the same time: only the first few play.
  const ears3 = createHearing();
  const names = ['quack', 'cluck', 'bark', 'moo', 'rustle', 'snore', 'peep', 'frog', 'pot'];
  const at = names.filter((n) => ears3.hear({ type: 'x', id: 'duck:1', sound: n }, w, 0) > 0);
  assert.equal(at.length, HEAR.most);
});

test('the sounds of the acts of the child always play: each put, each snap', () => {
  const w = world();
  const ears = createHearing();
  for (let i = 0; i < 20; i++) {
    assert.equal(ears.hear({ type: 'put', id: 'hero', sound: 'plank-down' }, w, i * 0.2), 1);
    assert.equal(ears.hear({ type: 'snap', id: 'zone:mat', sound: 'crack' }, w, i * 0.2), 1);
  }
  assert.equal(ears.hear({ type: 'x', id: 'hero' }, w, 0), 0, 'no sound, nothing to hear');
});

