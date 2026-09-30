import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProfile } from '../src/core/profile.js';
import { createSession } from '../src/core/session.js';
import { buildTerrain } from '../src/world/terrain.js';
import { loadGameData } from './helpers.js';

const data = await loadGameData();
const terrainOf = (map, tileMap) => buildTerrain(map, data.tiles.types, tileMap);

function newSession(extra = {}) {
  const profile = createProfile({ id: 'p', name: 'An', seed: 7 });
  const saves = [];
  const session = createSession({ data, profile, terrainOf, save: (r) => saves.push(r), ...extra });
  session.start();
  return { session, profile, saves };
}
const opens = (events) => events.filter((e) => e.type === 'open');
// Read the open talk to its end: the first choice at each choice.
function readAll(session) {
  let last = null;
  for (let i = 0; i < 50 && session.screen === 'dialogue'; i++) {
    last = opens(session.events()).at(-1) ?? last;
    session.command(last?.choices?.length ? { type: 'choose', n: 0 } : { type: 'next' });
  }
}

test('a new profile: the intro opens as lines; the choice and the next screen come as events', () => {
  const { session, profile } = newSession();
  assert.equal(session.map.id, 'phu-dong');
  assert.equal(session.screen, 'dialogue');
  assert.equal(opens(session.events())[0].textKey, 'dlg.grandma.intro.n1');
  // The world waits while a screen is open.
  const t0 = session.state.clock.minutes;
  session.step();
  assert.equal(session.state.clock.minutes, t0);
  let seen = [];
  for (let i = 0; i < 20 && session.screen === 'dialogue'; i++) {
    const last = opens(session.events()).at(-1);
    if (last) seen.push(last);
    session.command(last?.choices?.length ? { type: 'choose', n: 0 } : { type: 'next' });
  }
  seen = [...seen, ...opens(session.events())];
  assert.ok(profile.flags['intro.seen']);
  assert.equal(session.screen, 'nameFriend', 'the talk asks for the name of Nghé');
  assert.ok(seen.some((e) => e.choices.length), 'a line with a choice');
  // The view closes the screen: the world goes on.
  session.command({ type: 'closed' });
  assert.equal(session.screen, null);
  assert.equal(session.busy, false);
  session.step();
  session.step();
  assert.ok(session.state.clock.minutes > t0);
});

test('a tap on a person: the hero walks there and the talk opens', () => {
  const { session } = newSession();
  readAll(session);
  session.command({ type: 'closed' });
  session.events();
  const elder = session.persons().find((p) => p.ref === 'elder');
  const target = session.targetAt(elder.x, elder.y);
  assert.deepEqual(target, { person: elder.entity });
  session.command({ type: 'tap', target });
  let i = 0;
  for (; i < 1800 && !session.screen; i++) session.step();
  assert.equal(session.screen, 'dialogue');
  assert.ok(opens(session.events()).some((e) => e.textKey.startsWith('dlg.elder.')));
});

test('the target of a tap at a cell, and the snapshot as plain data', () => {
  const { session } = newSession();
  const c = session.heroCell();
  const t = session.targetAt(c.x + 1, c.y);
  assert.ok(t.ground && Number.isFinite(t.ground.h));
  const snap = session.snapshot();
  assert.equal(snap.map, 'phu-dong');
  assert.deepEqual(JSON.parse(JSON.stringify(snap)), snap);
});
