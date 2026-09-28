import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElementRules } from '../src/core/elements.js';
import { createBattle } from '../src/core/battle.js';
import { load, learningConfig } from './helpers.js';

const elementData = load('data/elements.json');
const rules = createElementRules(elementData);
const gameConfig = load('data/config/game.json');

// Element rules

test('element rules: fire melts ice, water puts out fire, fire and water make steam', () => {
  assert.equal(rules.find('fire', 'ice').effect, 'melt');
  assert.equal(rules.find('water', 'fire').effect, 'extinguish');
  const steam = rules.find('fire', 'water');
  assert.equal(steam.effect, 'steam');
  assert.equal(steam.partyStatus, 'hidden');
  assert.equal(rules.find('fire', 'fire').mistake, true);
  assert.equal(rules.find('water', 'ice').mistake, true);
  assert.equal(rules.find('fire', 'nothing').effect, 'none', 'an unknown pair has no effect');
});

test('element rules: water carries lightning to wet enemies', () => {
  const r = rules.resolve('lightning', null, ['wet']);
  assert.equal(r.effect, 'shock');
  assert.equal(r.spread, 'wet');
});

test('element rules: fire makes iron soft, water makes hot iron hard', () => {
  assert.equal(rules.find('fire', 'iron').result, 'hot-iron');
  assert.equal(rules.find('water', 'hot-iron').result, 'hard-iron');
  assert.equal(rules.counter('fire'), 'water');
  assert.equal(rules.counter('ice'), 'fire');
});

test('element rules: each pair has one rule only, and each key has text', () => {
  const vi = load('i18n/vi.json');
  const seen = new Set();
  for (const r of elementData.rules) {
    const key = `${r.attack}>${r.target}`;
    assert.ok(!seen.has(key), key);
    seen.add(key);
    assert.ok(elementData.elements.includes(r.attack));
  }
  assert.throws(() => createElementRules({ available: [], rules: [{ attack: 'a', target: 'b' }, { attack: 'a', target: 'b' }] }));
  assert.ok(vi);
});

// Battles

const TYPES = {
  scout: { spirit: 2, kind: 'soldier', guards: ['shield', 'fire'] },
  serpent: { spirit: 2, kind: 'creature', guards: ['water', 'ice'] },
  general: { spirit: 6, kind: 'soldier', guards: ['shield'] },
};

// A simple number shield: make 7 from the cards 3, 4, 9.
function shield() {
  return { skill: 'math.add.10', level: 2, kind: 'cards', cards: [3, 4, 9], target: 7, ops: ['+'],
    solution: [{ index: 0, op: '+' }, { index: 1, op: '+' }], hint: { key: 'hint.cards.add', params: {} } };
}
const RIGHT = [{ index: 0, op: '+' }, { index: 1, op: '+' }];
const WRONG = [{ index: 0, op: '+' }, { index: 2, op: '+' }];

function battle(enemies, extra = {}) {
  const b = createBattle({
    def: { enemies, events: extra.events ?? [] },
    enemyTypes: TYPES,
    rules,
    config: gameConfig.battle,
    feedback: learningConfig.feedback,
    party: extra.party ?? {},
    makeShield: () => shield(),
  });
  b.start();
  return b;
}

const types = (events) => events.map((e) => e.type);

test('a correct answer breaks the shield; a soldier retreats at zero spirit', () => {
  const b = battle(['scout']);
  assert.equal(b.phase, 'player');
  let r = b.answer(RIGHT);
  assert.equal(r.ok, true);
  assert.ok(types(r.events).includes('shieldBreaks'));
  assert.equal(b.state.enemies[0].spirit, 1);
  assert.equal(b.target.guard.kind, 'element', 'the next guard is fire');
  r = b.cast('water');
  assert.equal(r.ok, true);
  assert.deepEqual(r.events.find((e) => e.type === 'enemyDone'), { type: 'enemyDone', enemy: 0, outcome: 'retreat' });
  assert.equal(b.phase, 'won');
});

test('a creature becomes calm, and the answer events tell the first try', () => {
  const b = battle(['serpent']);
  let r = b.cast('water');
  assert.equal(r.ok, false);
  assert.equal(r.events[0].first, true);
  r = b.cast('fire');
  assert.equal(r.ok, true);
  assert.equal(r.events[0].first, false, 'the second try is not the first try');
  assert.equal(b.state.hidden, true, 'fire on water makes steam that hides the party');
  r = b.cast('fire');
  assert.ok(b.state.enemies[0].statuses.includes('wet'), 'melted ice makes the enemy wet');
  assert.equal(r.events.find((e) => e.type === 'enemyDone').outcome, 'calm');
});

test('a wrong answer costs health and gives a hint, then an example, then a similar problem', () => {
  const b = battle(['general']);
  const start = b.state.hero.health;
  let r = b.answer(WRONG);
  let m = r.events.find((e) => e.type === 'mistake');
  assert.equal(m.feedback, 'hint');
  assert.equal(b.state.hero.health, start - gameConfig.battle.mistakeCost);
  r = b.answer(WRONG);
  assert.equal(r.events.find((e) => e.type === 'mistake').feedback, 'example');
  r = b.answer(WRONG);
  m = r.events.find((e) => e.type === 'mistake');
  assert.equal(m.feedback, 'similar');
  assert.ok(types(r.events).includes('reveal'));
  assert.ok(types(r.events).includes('newGuard'));
  assert.equal(b.state.mistakes, 0);
});

test('the steam cloud and the friend shield block the health loss of a mistake', () => {
  const b = battle(['serpent', 'general'], { party: { shieldBlocks: 1 } });
  b.cast('fire'); // steam: the party is hidden
  const h0 = b.state.hero.health;
  b.setTarget(1);
  let r = b.answer(WRONG);
  assert.equal(r.events.find((e) => e.type === 'mistake').blockedBy, 'steam');
  r = b.answer(WRONG);
  assert.equal(r.events.find((e) => e.type === 'mistake').blockedBy, 'shield');
  assert.equal(b.state.hero.health, h0);
  b.answer(WRONG);
  assert.equal(b.state.hero.health, h0 - 1);
});

test('the battle is lost at zero health', () => {
  const b = battle(['general']);
  let lost = false;
  for (let i = 0; i < 20 && !lost; i++) lost = types(b.answer(WRONG).events).includes('lost');
  assert.ok(lost);
  assert.equal(b.phase, 'lost');
  assert.equal(b.answer(RIGHT).ignored, true, 'no answers after the end');
});

test('the companion strikes after a correct answer; the staff breaks and bamboo helps', () => {
  const b = battle(['general'], {
    party: { companion: { id: 'giong', strike: 1 } },
    events: [{ id: 'staff', atSpirit: 3, breaks: true, then: { weapon: 'bamboo' } }],
  });
  let r = b.answer(RIGHT);
  assert.equal(r.events.filter((e) => e.type === 'hit').length, 2);
  assert.equal(b.state.enemies[0].spirit, 4);
  r = b.answer(RIGHT);
  assert.ok(types(r.events).includes('event'));
  assert.equal(b.phase, 'event');
  assert.equal(b.state.companion.weapon, 'broken');
  assert.equal(b.answer(RIGHT).ignored, true, 'no answers during the story event');
  b.resolveEvent();
  assert.equal(b.phase, 'player');
  assert.equal(b.state.companion.weapon, 'bamboo');
  r = b.answer(RIGHT);
  assert.equal(r.events.filter((e) => e.type === 'hit').length, 2, 'Gióng strikes again with bamboo');
});

test('calling bonuses: more damage, more health, more cards, and a shield', () => {
  let extra = null;
  const b = createBattle({
    def: { enemies: ['general'] }, enemyTypes: TYPES, rules, config: gameConfig.battle, feedback: learningConfig.feedback,
    party: { bonuses: { damage: { shield: 1 }, heal: 1, extraCards: 1, shieldBlock: 1 } },
    makeShield: (_e, _s, o) => { extra = o.extraCards; return shield(); },
  });
  b.start();
  assert.equal(extra, 1);
  assert.equal(b.state.hero.max, gameConfig.battle.heroHealth + 1);
  assert.equal(b.state.blocks, 1);
  b.answer(RIGHT);
  assert.equal(b.state.enemies[0].spirit, 4);
});

test('hints: a card of the solution, the right element, and a limit', () => {
  const b = battle(['scout']);
  assert.deepEqual(b.useHint(), { kind: 'cards', index: 0 });
  b.answer(RIGHT);
  assert.deepEqual(b.useHint(), { kind: 'element', element: 'water' });
  assert.equal(b.useHint(), null, 'no more hints');
});

test('the target moves to the next enemy when one is done', () => {
  const b = battle(['scout', 'scout']);
  b.answer(RIGHT);
  const r = b.cast('water');
  assert.deepEqual(r.events.find((e) => e.type === 'target'), { type: 'target', enemy: 1 });
  assert.equal(b.phase, 'player');
});
