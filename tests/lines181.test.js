// Lines and dead ends (#181): the line of rest only at dusk and at night; the drag of the slingshot
// only from grade 3, in words that a child knows; the call and the count of the farmer; Gióng's line
// of the crossroads shows the crossroads and is not said again at each press; one line after a hit
// on a soldier who holds rice; and the star of a riddle starts the riddle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { check } from '../src/core/conditions.js';
import { createI18n } from '../src/core/i18n.js';
import { sideMarks } from '../src/world/marks.js';
import { load } from './helpers.js';

const vi = load('i18n/vi.json');
const i18n = createI18n(vi, 'vi');
const session = readFileSync(new URL('../src/core/session.js', import.meta.url), 'utf8');

test('the line of rest of grandma comes only at dusk and at night', () => {
  const talks = load('data/npcs.json').npcs.grandma.talk;
  const pick = (dark) => talks.find((t) => check(t.when, { flags: { 'prologue.started': true }, dark }))?.dialogue;
  assert.equal(pick(true), 'grandma.home');
  assert.equal(pick(false), 'grandma.day');
  assert.equal(vi['dlg.grandma.home.n1'], 'Cháu về rồi. Vào nhà nghỉ một lát nhé.');
  assert.ok(!/nghỉ/.test(vi['dlg.grandma.day.n1']));
});

test('the drag of the slingshot comes only from grade 3, in words that a child knows', () => {
  assert.equal(vi['raid.tool.drag'], 'Cháu cũng có thể kéo cái ná về phía sau.');
  assert.match(session, /const drag = Number\(profile\.grade \?\? 1\) >= 3 && /);
});

test('the farmer says how to call her, and counts the ducks aloud by twos', () => {
  assert.equal(vi['event.duck.all'].replace('{n}', vi['num.10']), 'Đủ mười con rồi. Xong thì cháu chạm vào cô, cô đếm cho.');
  const counts = [2, 4, 6, 8, 10];
  const list = counts.slice(1).reduce((a, k) => ({ key: 'count.next', params: { a, b: { key: `num.${k}` } } }), { key: `num.${counts[0]}` });
  assert.equal(i18n.t('event.duck.counted', { list }), 'Hai, bốn, sáu, tám, mười. Đủ đàn rồi!');
  const events = load('data/world/events.json');
  const duck = (events.events ?? events).find?.((e) => e.id === 'duck') ?? Object.values(events.events ?? events).find((e) => e.id === 'duck');
  assert.equal(duck.lines.counted, 'event.duck.counted');
});

test('the line of the crossroads shows the crossroads, and a press next to Gióng does not say it again', () => {
  assert.match(session, /if \(id === 'giong\.here'\) crossroadsView\(\);/);
  assert.match(session, /heard\.add\(id\);\n\s+id = giongLine\(\);/);
});

test('one line after a hit on a soldier who holds rice', () => {
  const text = i18n.t('raid.hit.took', { who: { key: 'raid.who.soldier' }, ball: { key: 'raid.ball.stone' }, n: { key: 'num.2' } });
  assert.equal(text, 'Trúng rồi! Lính này cầm gạo: còn hai hòn đá nữa.');
});

test('the star of a riddle is a tap on the person of the riddle', () => {
  const [ferry] = sideMarks([{ id: 'pz:mark:ferry', look: 'mark-side', position: { x: 10, y: 4, z: 20 } }]);
  const [pots] = sideMarks([{ id: 'pz:mark:pots', look: 'mark-side', position: { x: 10, y: 4, z: 20 } }]);
  assert.equal(ferry.person, 'pz:traveler');
  assert.equal(pots.person, 'npc:healer');
  const ui = readFileSync(new URL('../src/ui/village.js', import.meta.url), 'utf8');
  assert.match(ui, /if \(m\.side && m\.person\) send\(\{ type: 'tap', target: \{ person: m\.person \} \}\);/);
});
