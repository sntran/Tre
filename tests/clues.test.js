// Find Trâu Sơn by real clues, not by a mark (#27): data/world/clues.json and src/core/clues.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { areaOf, questMark, clueLine, hiddenAt, onWay } from '../src/core/clues.js';
import { load, worldOf } from './helpers.js';

const clues = load('data/world/clues.json');
const find = clues.finds.find((f) => f.id === 'trau-son');
const at = (frame, x, y) => worldOf().at(frame, x, y);
const vi = load('i18n/vi.json');
const en = load('i18n/en.json');
const encounter = (id) => load('data/maps/trau-son.json').encounters.find((e) => e.id === id);

test('each line of the two clues and of the person on the tall hill has a source', () => {
  assert.equal(find.clues.length, 2);
  for (const line of [...find.clues, ...find.wrong]) {
    assert.ok(line.source?.trim(), `${line.textKey}: a source`);
    assert.ok(vi[line.textKey] && en[line.textKey], `${line.textKey}: the texts`);
  }
  const talk = load('data/dialogue/giong.json').dialogues.find((d) => d.id === 'dam-elder.hill');
  assert.ok(talk.nodes.n1.source?.trim(), 'the talk of the old man on Núi Dạm has its source');
  assert.equal(talk.nodes.n1.textKey, find.wrong[0].textKey);
  assert.ok(load('data/maps/trau-son.json').npcs.some((n) => n.id === 'dam-elder'));
});

test('the note of the battle has the mark Legend and says that nobody knows the hill', () => {
  const raids = load('data/raids.json').raids;
  const boss = Array.isArray(raids) ? raids.find((r) => r.id === 'boss') : raids.boss;
  assert.equal(boss.mark, 'legend');
  assert.match(en[boss.noteKey], /Nobody knows/);
  assert.match(vi[boss.noteKey], /Không ai biết chắc/);
  assert.match(en[boss.noteKey], /Châu Cầu/);
  assert.equal(en['mark.legend'], 'Legend');
});

test('before the hero stands on the low hills, the arrow of the quest points east and not at the hill', () => {
  const s = encounter('soldier1');
  const [sx, sy] = at('trau-son', s.x, s.y);
  const mark = { x: sx, y: sy, h: 5 };
  const hero = { x: at('phu-dong', 90, 30)[0], y: at('phu-dong', 90, 30)[1] };
  const shown = questMark(clues, at, {}, mark, hero);
  assert.equal(shown.y, hero.y, 'straight toward the sunrise');
  assert.ok(shown.x > hero.x);
  assert.ok(Math.hypot(shown.x - mark.x, shown.y - mark.y) > 100, 'not at the place of the battle');
  // After the hero stands on the low hills, the arrow shows the place.
  assert.deepEqual(questMark(clues, at, { [find.flag]: true }, mark, hero), mark);
  // A mark out of the area (Phù Đổng) does not change.
  const home = { x: hero.x - 20, y: hero.y, h: 3 };
  assert.deepEqual(questMark(clues, at, {}, home, hero), home);
  // The fields at the foot of the low hills and the hills are the area; Núi Dạm is not.
  const [tx, ty] = at('trau-son', 176, 20);
  assert.ok(hiddenAt(clues, at, {}, tx, ty));
  const [dx, dy] = at('trau-son', -133, 7);
  assert.equal(hiddenAt(clues, at, {}, dx, dy), null);
});

test('on the way, two people say the two clues in order, each once; the old man on the tall hill says why it is not the place', () => {
  const flags = {};
  const [wx, wy] = at('trau-son', -60, 30);
  const way = { x: wx, y: wy };
  assert.ok(onWay(find, at, way.x, way.y));
  const say = (who, hero = way, leads = () => true) => {
    const line = clueLine(clues, at, flags, who, hero, leads);
    if (line?.set) Object.assign(flags, line.set);
    return line?.textKey ?? null;
  };
  assert.equal(say('npc:a', way, () => false), null, 'no clue when the quest does not lead there');
  const [hx, hy] = at('phu-dong', 30, 20);
  assert.equal(say('npc:a', { x: hx, y: hy }), null, 'no clue in Phù Đổng');
  assert.equal(say('npc:a'), 'clue.trau.sunrise');
  assert.equal(say('npc:a'), null, 'the same person does not say the next clue');
  assert.equal(say('npc:b'), 'clue.trau.line');
  assert.equal(say('npc:c'), null, 'two clues only');
  // The old man on Núi Dạm, before and after the hero finds the hills; his line gives and takes nothing.
  const wrong = clueLine(clues, at, flags, 'npc:dam-elder', way);
  assert.deepEqual(wrong, { textKey: 'clue.trau.dam', set: null });
  assert.equal(clueLine(clues, at, { ...flags, [find.flag]: true }, 'npc:dam-elder', way), null);
  assert.ok(clues.finds.every((f) => [...f.clues, ...f.wrong].every((l) => !l.give && !l.effects)), 'no line gives or takes anything');
  assert.ok(areaOf(find, at).x0 > at('trau-son', -133, 7)[0], 'the area is east of Núi Dạm');
});
