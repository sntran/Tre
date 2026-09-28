// Battle rules. Battles are turn-based: the player answers, then the enemy
// makes a new guard. A guard is a number shield (a problem) or an element state
// (fire, ice, water). A wrong answer costs health and gives feedback.
// Defeated soldiers retreat, and creatures become calm. There is no blood.
import { createMachine } from './fsm.js';
import { checkAnswer } from './solver.js';
import { feedbackFor } from './learner.js';

// opts:
//   def: the battle data ({ enemies, events, elementSkill, states: ['fire', 'ice', 'water'] })
//   enemyTypes: { id: { spirit, guards: ['shield', 'element', ...], kind: 'creature' | 'soldier' } }
//     "element" is an element guard. Its state comes from def.states.
//     A state name (for example 'fire') is also an element guard.
//   rng: with a random generator, the order of the guards of each enemy and the element states
//     are random. The states come from a shuffled deck of def.states, so each state that the
//     battle allows comes up before a state comes again. With no rng, the order is the data order.
//   rules: the element rules (elements.js)
//   config: { heroHealth, mistakeCost, hintsPerBattle }
//   feedback: { hintAt, exampleAt, similarAt }
//   party: { shieldBlocks, bonuses: { extraCards, damage: { shield, fire, water }, heal, shieldBlock }, companion: { id, strike } }
//   makeShield(enemy, similarTo): a problem for a number shield (cards, numeric, or choice)
export function createBattle(opts) {
  const { def, enemyTypes, rules, config, feedback, makeShield, rng = null } = opts;
  const STATES = ['fire', 'ice', 'water'];
  const allowed = def.states ?? STATES;
  let deck = [];

  // The next element state from the deck.
  function drawState() {
    if (deck.length === 0) deck = rng ? rng.shuffle([...allowed]) : [...allowed];
    return deck.shift();
  }

  // The next guard kind of an enemy: 'shield' or an element state.
  function nextGuardKind(enemy) {
    if (enemy.queue.length === 0) enemy.queue = rng ? rng.shuffle([...enemy.type.guards]) : [...enemy.type.guards];
    const token = enemy.queue.shift();
    if (token === 'shield') return 'shield';
    // With rng, each element guard gets a state from the deck. With no rng, a state name stays.
    return token === 'element' || rng ? drawState() : token;
  }
  const party = opts.party ?? {};
  const bonus = party.bonuses ?? {};
  const damageBonus = bonus.damage ?? {};
  const maxHealth = config.heroHealth + (bonus.heal ?? 0);

  const s = {
    hero: { health: maxHealth, max: maxHealth },
    enemies: def.enemies.map((typeId, i) => {
      const type = enemyTypes[typeId];
      if (!type) throw new Error(`Unknown enemy ${typeId}`);
      return { index: i, typeId, type, spirit: type.spirit, max: type.spirit, guardIndex: 0, queue: [], guard: null, statuses: [], done: false, outcome: null };
    }),
    target: 0,
    hidden: false,
    blocks: (party.shieldBlocks ?? 0) + (bonus.shieldBlock ?? 0),
    hints: config.hintsPerBattle,
    mistakes: 0,
    firstTry: true,
    hinted: false,
    companion: party.companion ? { ...party.companion, weapon: party.companion.weapon ?? 'staff' } : null,
    fired: [],
    event: null,
  };

  const machine = createMachine({
    initial: 'intro',
    states: {
      intro: { on: { START: 'player' } },
      player: { on: { EVENT: 'event', WIN: 'won', LOSE: 'lost' } },
      event: { on: { RESUME: 'player', WIN: 'won' } },
      won: {},
      lost: {},
    },
  });

  // An element guard is a problem too. The hint is a question about the method.
  // The worked example shows the rule for another state, so it does not give the answer.
  function elementProblem(state) {
    const skill = def.elementSkill ?? 'sci.matter.states';
    const other = ['fire', 'ice', 'water'].find((x) => x !== state);
    return {
      skill, level: 1, item: `${skill}#1`, kind: 'element', state,
      hint: { key: `element.ask.${state}`, params: {} },
      example: { key: `element.example.${other}`, params: {} },
    };
  }

  function newGuard(enemy, similarTo = null) {
    const kind = nextGuardKind(enemy);
    s.mistakes = 0;
    s.firstTry = true;
    s.hinted = false;
    if (kind === 'shield') enemy.guard = { kind: 'shield', problem: makeShield(enemy, similarTo, { extraCards: bonus.extraCards ?? 0 }) };
    else enemy.guard = { kind: 'element', state: kind, problem: elementProblem(kind) };
  }

  const alive = () => s.enemies.filter((e) => !e.done);
  const current = () => s.enemies[s.target];

  function start() {
    for (const e of s.enemies) newGuard(e);
    machine.send('START');
    return { events: [{ type: 'start' }] };
  }

  function setTarget(i) {
    if (s.enemies[i] && !s.enemies[i].done) s.target = i;
    return s.target;
  }

  // "credit" is what the learner model records: correct on the first try, with no hint.
  function answerEvent(problem, ok) {
    const e = { type: 'answer', problem, ok, first: s.firstTry, credit: ok && !s.hinted };
    s.firstTry = false;
    return e;
  }

  // Damage to one enemy. Return the events.
  function hit(enemy, damage, by, element = null) {
    const events = [];
    enemy.spirit = Math.max(0, enemy.spirit - damage);
    events.push({ type: 'hit', enemy: enemy.index, damage, by, element });
    if (enemy.spirit === 0 && !enemy.done) {
      enemy.done = true;
      enemy.guard = null;
      enemy.outcome = enemy.type.kind === 'creature' ? 'calm' : 'retreat';
      events.push({ type: 'enemyDone', enemy: enemy.index, outcome: enemy.outcome });
    }
    return events;
  }

  // After a correct answer: the companion strikes, a story event can start,
  // and the enemy makes a new guard.
  function afterSuccess(enemy, events) {
    if (s.companion && s.companion.weapon !== 'broken' && !enemy.done) {
      events.push(...hit(enemy, s.companion.strike ?? 1, 'companion'));
    }
    for (const ev of def.events ?? []) {
      if (s.fired.includes(ev.id) || enemy.done) continue;
      if (enemy.spirit <= ev.atSpirit) {
        s.fired.push(ev.id);
        if (ev.breaks && s.companion) s.companion.weapon = 'broken';
        s.event = ev;
        events.push({ type: 'event', id: ev.id });
      }
    }
    if (!enemy.done) {
      enemy.guardIndex += 1;
      newGuard(enemy);
      events.push({ type: 'newGuard', enemy: enemy.index });
    }
    if (alive().length === 0) {
      machine.send('WIN');
      events.push({ type: 'won' });
      return events;
    }
    if (enemy.done) {
      s.target = alive()[0].index;
      events.push({ type: 'target', enemy: s.target });
    }
    if (s.event) machine.send('EVENT');
    return events;
  }

  // A wrong answer. It costs health unless the steam cloud or a shield blocks it.
  function mistake(problem, hint, events) {
    s.mistakes += 1;
    const step = feedbackFor(s.mistakes, feedback);
    let blockedBy = null;
    let damage = 0;
    if (s.hidden) {
      s.hidden = false;
      blockedBy = 'steam';
    } else if (s.blocks > 0) {
      s.blocks -= 1;
      blockedBy = 'shield';
    } else {
      damage = config.mistakeCost;
      s.hero.health = Math.max(0, s.hero.health - damage);
    }
    events.push({ type: 'mistake', feedback: step, hint, blockedBy, damage, health: s.hero.health });
    if (s.hero.health === 0) {
      machine.send('LOSE');
      events.push({ type: 'lost' });
      return events;
    }
    if (step === 'similar') {
      const enemy = current();
      events.push({ type: 'reveal', problem });
      if (enemy.guard.kind === 'shield') {
        newGuard(enemy, problem);
        events.push({ type: 'newGuard', enemy: enemy.index, similar: true });
      } else {
        s.mistakes = 0;
      }
    }
    return events;
  }

  function canAct(kind) {
    const enemy = current();
    return machine.is('player') && enemy && !enemy.done && enemy.guard?.kind === kind;
  }

  // Answer a number shield: card moves for a card shield, or a number or choice index.
  function answer(response) {
    if (!canAct('shield')) return { ok: false, ignored: true, events: [] };
    const enemy = current();
    const problem = enemy.guard.problem;
    const ok = checkAnswer(problem, response);
    const events = [answerEvent(problem, ok)];
    if (!ok) return { ok, events: mistake(problem, problem.hint, events) };
    const damage = 1 + (damageBonus.shield ?? 0);
    events.push({ type: 'shieldBreaks', enemy: enemy.index });
    events.push(...hit(enemy, damage, 'hero'));
    return { ok, events: afterSuccess(enemy, events) };
  }

  // Cast an element on the target.
  function cast(element) {
    if (!canAct('element')) return { ok: false, ignored: true, events: [] };
    const enemy = current();
    const problem = enemy.guard.problem;
    const rule = rules.resolve(element, enemy.guard.state, enemy.statuses);
    const ok = !rule.mistake && (rule.damage ?? 0) > 0;
    const events = [answerEvent(problem, ok), { type: 'cast', element, enemy: enemy.index, effect: rule.effect, textKey: rule.textKey ?? null }];
    if (!ok) return { ok, events: mistake(problem, rule.hintKey ? { key: rule.hintKey, params: {} } : null, events) };
    if (rule.addStatus && !enemy.statuses.includes(rule.addStatus)) enemy.statuses.push(rule.addStatus);
    if (rule.partyStatus === 'hidden') {
      s.hidden = true;
      events.push({ type: 'hidden' });
    }
    const damage = (rule.damage ?? 0) + (damageBonus[element] ?? 0);
    events.push(...hit(enemy, damage, 'hero', element));
    // Some elements go to all enemies with a status, for example lightning to all wet enemies.
    if (rule.spread) {
      for (const other of alive()) {
        if (other !== enemy && other.statuses.includes(rule.spread)) events.push(...hit(other, rule.damage ?? 1, 'spread', element));
      }
    }
    return { ok, events: afterSuccess(enemy, events) };
  }

  // A hint with no health cost. The number of hints is limited.
  // The hint tells a method. It never tells the answer or the card to use.
  // A problem solved after a hint does not count as correct on the first try.
  function useHint() {
    if (s.hints <= 0 || !machine.is('player')) return null;
    const enemy = current();
    const guard = enemy?.guard;
    if (!guard) return null;
    s.hints -= 1;
    s.hinted = true;
    return { kind: 'text', hint: guard.problem.hint ?? null };
  }

  // Go on after a story event (for example: the player found bamboo).
  function resolveEvent(result = {}) {
    if (!machine.is('event')) return { events: [] };
    if (s.event?.then?.weapon && s.companion) s.companion.weapon = s.event.then.weapon;
    if (result.weapon && s.companion) s.companion.weapon = result.weapon;
    s.event = null;
    machine.send('RESUME');
    return { events: [{ type: 'resume' }] };
  }

  return {
    state: s,
    start,
    setTarget,
    answer,
    cast,
    useHint,
    resolveEvent,
    get phase() { return machine.state; },
    get target() { return current(); },
  };
}
