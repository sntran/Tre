// The stall of a market day (#26, #42): the seller sits behind the mat of the rice, her tray of
// goods lies in front of her beside the mat, so that the child sees all her goods, and each person
// of the market day stands on a cell of their own (no two people in one place).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runHeadless } from './story-run.js';

async function marketDay() {
  const story = JSON.parse(readFileSync(new URL('./stories/market-barter.json', import.meta.url)));
  // The seller comes, and says her trade.
  story.steps = story.steps.slice(0, 5);
  let session = null;
  const failures = await runHeadless(story, { onSession: (s) => { session = s; } });
  assert.deepEqual(failures, []);
  return session.state.entities;
}

test('the tray of the seller lies in front of her, beside the mat of the rice, toward the child, and the rice lies by the mat', async () => {
  const all = await marketDay();
  const at = (id) => {
    const p = all.find((e) => e.id === id)?.position;
    assert.ok(p, id);
    return { x: p.x / 2, z: p.z / 2, facing: p.facing };
  };
  const seller = at('event:market');
  const mat = at('mark:event-market');
  const tray = at('wares:event-market');
  // In front of her: the way that she faces goes to the mat and to the tray.
  const ahead = (q) => Math.sin(seller.facing) * (q.x - seller.x) + Math.cos(seller.facing) * (q.z - seller.z);
  assert.ok(ahead(mat) > 1, 'the mat is in front of the seller');
  assert.ok(ahead(tray) > 1, 'the tray is in front of the seller, not behind her');
  assert.ok(Math.hypot(tray.x - mat.x, tray.z - mat.z) <= 3.5, 'the tray lies beside the mat');
  assert.ok(Math.hypot(tray.x - mat.x, tray.z - mat.z) >= 2, 'the tray does not lie on the mat');
  // The rice of the basket lies by the mat, a few steps from it.
  const pile = at('zone:event-market-pile');
  assert.ok(Math.hypot(pile.x - mat.x, pile.z - mat.z) <= 6, 'the rice lies by the mat');
});

test('each person of a market day stands on a cell of their own, and nobody stands on the mat, the tray, or the rice', async () => {
  const all = await marketDay();
  const people = all.filter((e) => e.person && e.position).map((e) => ({ id: e.id, x: e.position.x / 2, z: e.position.z / 2 }));
  assert.ok(people.some((p) => p.id === 'event:market'), 'the seller');
  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      const [a, b] = [people[i], people[j]];
      assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= 1, `${a.id} and ${b.id} stand in one place`);
    }
  }
  const things = all.filter((e) => e.id === 'mark:event-market' || e.id === 'wares:event-market' || e.id.startsWith('rice:event-market')).map((e) => ({ id: e.id, x: e.position.x / 2, z: e.position.z / 2 }));
  assert.ok(things.length >= 3);
  for (const p of people) for (const t of things) assert.ok(Math.hypot(p.x - t.x, p.z - t.z) >= 1, `${p.id} stands on ${t.id}`);
});
