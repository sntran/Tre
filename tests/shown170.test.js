// What the voice says, the screen shows (#170): the iron horse is in the view of "Ngựa sắt đã
// xong!", steam rises at "Xèo!", the view comes close for the growth of Gióng, a person out of the
// screen does not say a line of the day, and a card waits for its print.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runHeadless } from './story-run.js';
import { load } from './helpers.js';
import { getEntity } from '../src/core/world/state.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const village = load('data/dialogue/village.json');
const talk = (id) => village.dialogues.find((d) => d.id === id);

test('the line of the done horse names the horse, and the horse stands there when the line shows', async () => {
  assert.deepEqual(talk('smith.horse').nodes.n1.names, ['steed:giong']);
  const s = load('tests/stories/forge-horse.json');
  let steed = null;
  let steam = false;
  let session = null;
  const failures = await runHeadless(s, { onSession: (x) => {
    session = x;
    x.listen((e) => {
      if (e.type === 'open' && e.textKey === 'dlg.smith.horse.n1') steed = getEntity(x.state, 'steed:giong');
      if (e.type === 'names' && getEntity(x.state, 'steam:talk')) steam = true;
    });
  } });
  assert.deepEqual(failures.map((f) => f.message), []);
  assert.ok(steed, 'the horse at the line');
  assert.ok(session);
  assert.ok(steam, 'the steam while the line of the water shows');
});

test('"Xèo! Hơi nước bay lên" names the steam, and the steam is a thing of the world while the line shows', () => {
  const water = talk('smith.forge').nodes.water;
  assert.deepEqual(water.names, [{ id: 'hearth:horse', act: 'steam' }]);
  const s = src('src/core/session.js');
  assert.match(s, /addEntity\(state, \{ id: 'steam:talk', position: \{ \.\.\.steam\.e\.position \}, look: 'steam-puff' \}\)/);
  assert.match(src('src/world/figures.js'), /if \(k === 'steam-puff'\) return \{ kind: 'steam-puff' \};/);
});

test('the growth of Gióng comes close in the view, a person out of the screen says no line of the day, and a card waits for its print', () => {
  assert.match(src('src/core/session.js'), /key: 'grow-boy', points: \[\{ \.\.\.boy\.position \}, \{ \.\.\.pot\.position \}\], sight: \[\{ \.\.\.boy\.position \}\], close: GROW_CLOSE/);
  const v = src('src/ui/village.js');
  assert.match(v, /\/\^world\\\.\/\.test\(String\(ev\.textKey \?\? ''\)\) && !onScreen\(ev\.id\)\) return;/);
  assert.match(v, /if \(pic\.classList\?\.contains\('portrait-wait'\) && waited < PRINT_WAIT\)/);
  // While a card waits for its print, no other card starts (two cards lay over each other).
  assert.match(v, /if \(printCard \|\| printWait \|\| !printQueue\.length/);
});
