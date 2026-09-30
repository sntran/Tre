import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import { createSkillGraph } from '../src/core/skills.js';
import { generate, generateShield, hasCards, GENERATOR_NAMES } from '../src/core/generators.js';
import { solve, checkAnswer, solveCards, evaluateCards, SHAPE_SIDES, parseNumber } from '../src/core/solver.js';
import { itemStartRating } from '../src/core/rating.js';
import { skillsData, learningConfig, bank } from './helpers.js';

const graph = createSkillGraph(skillsData);
const RUNS = 150;

const digits = (n) => String(n).length;
const decimalsOf = (x) => (String(x).split('.')[1] ?? '').length;

// Independent checks of the level limits, one for each generator.
const LIMITS = {
  count(p, pr) {
    assert.ok(pr.answer >= 0 && pr.answer <= p.max, `answer ${pr.answer} > max ${p.max}`);
    if (pr.expr.op === 'plus10') assert.ok(p.tens);
  },
  compare(p, pr) {
    const [a, b] = pr.expr.values;
    assert.notEqual(a, b);
    assert.ok(a <= p.max && b <= p.max && a >= 0 && b >= 0);
    if (pr.expr.op === 'min') assert.ok(p.smaller);
  },
  add(p, pr) {
    const { a, b } = pr.expr;
    if (pr.expr.op === 'add') {
      assert.ok(a >= 1 && b >= 1);
      assert.ok(a + b >= p.min && a + b <= p.max, `${a}+${b} not in ${p.min}..${p.max}`);
    } else {
      assert.ok(p.missing);
      assert.ok(a >= p.min && a <= p.max, 'the sum is in the range');
      assert.ok(pr.answer >= 1);
    }
  },
  sub(p, pr) {
    const { a, b } = pr.expr;
    assert.ok(a >= p.minA && a <= p.maxA);
    assert.ok(b >= 1 && b < a);
  },
  addsub(p, pr) {
    const { a, b, op } = pr.expr;
    assert.ok(a >= p.minOperand && b >= p.minOperand);
    assert.ok(pr.answer >= 0 && pr.answer <= p.max);
    const carry = (x, y) => { for (; x || y; x = Math.floor(x / 10), y = Math.floor(y / 10)) if ((x % 10) + (y % 10) >= 10) return true; return false; };
    const borrow = (x, y) => { for (; y; x = Math.floor(x / 10), y = Math.floor(y / 10)) if (x % 10 < y % 10) return true; return false; };
    assert.equal(op === 'add' ? carry(a, b) : borrow(a, b), Boolean(p.regroup));
  },
  place(p, pr) {
    if (p.expanded) {
      assert.equal(digits(pr.answer), 3);
    } else {
      assert.equal(digits(pr.expr.n), p.digits);
      assert.ok(pr.answer >= 0 && pr.answer <= 9);
      assert.ok(pr.expr.place < p.digits);
    }
  },
  mul(p, pr) {
    assert.ok(pr.expr.a >= p.minA && pr.expr.a <= p.maxA);
    assert.ok(pr.expr.b >= p.minB && pr.expr.b <= p.maxB);
  },
  div(p, pr) {
    assert.ok(pr.answer >= p.minA && pr.answer <= p.maxA);
    assert.ok(pr.expr.b >= Math.max(1, p.minB) && pr.expr.b <= p.maxB);
  },
  share(p, pr) {
    const { n, k, ask } = pr.expr;
    assert.ok(k >= p.minK && k <= p.maxK);
    assert.ok(Math.floor(n / k) >= 1 && Math.floor(n / k) <= p.maxEach);
    if (!p.rest) assert.ok(n % k === 0 && ask === 'each', 'no remainder at this level');
  },
  fracCompare(p, pr) {
    for (const [n, d] of pr.expr.values) {
      assert.ok(d <= p.maxDen && n < d);
      if (!p.sameNum) assert.equal(n, 1);
    }
  },
  fracEquiv(p, pr) {
    assert.ok(pr.expr.d <= p.maxDen && pr.expr.D <= p.maxDen * p.maxK);
    assert.equal(pr.answer * pr.expr.d, pr.expr.n * pr.expr.D);
  },
  fracAdd(p, pr) {
    assert.ok(pr.expr.d <= p.maxDen);
    assert.ok(pr.answer <= p.maxSum * pr.expr.d);
  },
  fracUnlike(p, pr) {
    assert.ok(p.pairs.some(([x, y]) => x === pr.expr.d1 && y === pr.expr.d2));
    assert.equal(pr.expr.D % pr.expr.d1, 0);
    assert.equal(pr.expr.D % pr.expr.d2, 0);
  },
  area(p, pr) {
    assert.ok(pr.expr.w >= 2 && pr.expr.w <= p.max && pr.expr.h >= 2 && pr.expr.h <= p.max);
  },
  mulMulti(p, pr) {
    assert.ok(pr.expr.a >= p.minA && pr.expr.a <= p.maxA && pr.expr.b >= p.minB && pr.expr.b <= p.maxB);
  },
  decimal(p, pr) {
    assert.ok(pr.answer > 0);
    assert.ok(decimalsOf(pr.answer) <= p.places);
    assert.ok(pr.answer <= p.max);
  },
  shapes(p, pr) {
    if (p.ask === 'sides') assert.ok(p.shapes.includes(pr.expr.shape));
    else for (const c of pr.choices) assert.ok(p.shapes.includes(c.shape));
  },
  bank(p, pr, skill) {
    assert.ok(pr.source);
    assert.equal(bank.find((q) => q.id === pr.source).skill, skill.id);
  },
};

test('the skill graph is good: no cycles, known pre skills, known generators', () => {
  assert.deepEqual(graph.check(), []);
  for (const s of graph.all()) assert.ok(GENERATOR_NAMES.includes(s.generator), s.id);
  const order = graph.order();
  for (const s of graph.all()) for (const pre of s.pre) assert.ok(order.indexOf(pre) < order.indexOf(s.id));
});

test('each generated problem has an answer at the correct level', () => {
  for (const skill of graph.all()) {
    skill.levels.forEach((params, i) => {
      const level = i + 1;
      for (let run = 0; run < RUNS; run++) {
        const rng = createRng(`${skill.id}:${level}:${run}`);
        const pr = generate(skill, level, rng, { bank, lang: 'vi' });
        assert.equal(pr.skill, skill.id);
        assert.equal(pr.level, level);
        assert.ok(pr.prompt?.key || pr.prompt?.text, 'a prompt');
        assert.ok(pr.hint, 'a hint');
        const solved = solve(pr);
        if (pr.kind === 'choice') {
          assert.ok(solved >= 0 && solved < pr.choices.length, `${skill.id}: the answer is one of the choices`);
          assert.equal(solved, pr.answer, `${skill.id}: the solver agrees`);
        } else {
          assert.ok(Number.isFinite(solved));
          assert.equal(solved, pr.answer, `${skill.id} L${level}: the solver agrees`);
        }
        assert.equal(checkAnswer(pr, pr.answer), true);
        LIMITS[skill.generator](params, pr, skill);
      }
    });
  }
});

test('a wrong answer is not accepted', () => {
  const skill = graph.get('math.add.20');
  const pr = generate(skill, 2, createRng(1));
  assert.equal(checkAnswer(pr, pr.answer + 1), false);
  assert.equal(checkAnswer(pr, 'abc'), false);
  assert.equal(checkAnswer(pr, String(pr.answer)), true);
  const dec = generate(graph.get('math.decimal'), 2, createRng(5));
  assert.equal(checkAnswer(dec, String(dec.answer).replace('.', ',')), true);
  assert.equal(parseNumber('1,25'), 1.25);
});

test('the same seed makes the same problem', () => {
  const skill = graph.get('math.sub.20');
  assert.deepEqual(generate(skill, 3, createRng('x')), generate(skill, 3, createRng('x')));
});

test('each number shield has a solution with the correct operations', () => {
  for (const skill of graph.all()) {
    skill.levels.forEach((params, i) => {
      if (!hasCards(skill, i + 1)) return;
      for (let run = 0; run < RUNS; run++) {
        const sh = generateShield(skill, i + 1, createRng(`shield:${skill.id}:${i}:${run}`));
        assert.equal(sh.cards.length, params.cards.count);
        assert.ok(!sh.cards.includes(sh.target), 'no card is the target');
        assert.ok(checkAnswer(sh, sh.solution), `${skill.id}: the solution works`);
        assert.equal(evaluateCards(sh.cards, sh.solution), sh.target);
        if (skill.generator === 'add') {
          assert.deepEqual(sh.ops, ['+']);
          assert.ok(sh.target >= params.min && sh.target <= params.max);
        }
        if (skill.generator === 'sub') {
          assert.ok(sh.ops.includes('-'));
          assert.equal(solveCards(sh.cards, sh.target, ['+']), null, 'adding alone does not work');
          assert.ok(sh.cards.every((c) => c <= params.maxA));
          assert.ok(sh.target >= 1 && sh.target < params.maxA);
        }
        if (skill.generator === 'mul') assert.deepEqual(sh.ops, ['×']);
      }
    });
  }
});

// The param of each worked example that has the result of the example.
const EXAMPLE_RESULT = {
  'ex.count.after': 'm1', 'ex.count.before': 'm1', 'ex.count.ten': 'm10', 'ex.add': 'z', 'ex.add.missing': 'y',
  'ex.sub': 'z', 'ex.split.add': 'z', 'ex.split.sub': 'z', 'ex.place.expanded': 'm', 'ex.place': 'd',
  'ex.mul': 'z', 'ex.div': 'x', 'ex.share.each': 'x', 'ex.share.left': 'r', 'ex.frac.equiv': 'ak', 'ex.frac.add': 's', 'ex.frac.unlike': 's',
  'ex.area': 'z', 'ex.perimeter': 'z', 'ex.mul.multi': 'z', 'ex.decimal.add': 'z', 'ex.decimal.sub': 'z', 'ex.shape.sides': 'n',
};
const numbersOf = (params) => Object.values(params ?? {}).filter((v) => typeof v === 'number');

test('worked examples use other numbers and never show the answer', () => {
  for (const skill of graph.all()) {
    skill.levels.forEach((_, i) => {
      for (let run = 0; run < RUNS; run++) {
        const pr = generate(skill, i + 1, createRng(`ex:${skill.id}:${i}:${run}`), { bank, lang: 'vi' });
        if (skill.generator === 'bank') {
          assert.equal(pr.example, null, 'the explanation comes only with the answer');
          continue;
        }
        assert.ok(pr.example?.key, `${skill.id}: an example`);
        const ex = pr.example.params;
        const own = numbersOf(pr.prompt.params);
        const exNumbers = numbersOf(ex);
        if (own.length) {
          assert.ok(!own.every((n) => exNumbers.includes(n)) || exNumbers.length === 0,
            `${skill.id}: the example ${JSON.stringify(ex)} uses the numbers of the problem ${JSON.stringify(pr.prompt.params)}`);
        }
        if (pr.kind === 'numeric') {
          const key = EXAMPLE_RESULT[pr.example.key];
          assert.ok(key, `${pr.example.key}: the result param is known`);
          assert.notEqual(ex[key], pr.answer, `${skill.id}: the example result is not the answer`);
        }
        if (skill.generator === 'compare') {
          assert.ok(!pr.expr.values.includes(ex.big) && !pr.expr.values.includes(ex.small));
        }
        if (skill.generator === 'fracCompare') {
          const dens = pr.expr.values.map((f) => f[1]);
          assert.ok(!dens.includes(ex.x) && !dens.includes(ex.y));
        }
      }
    });
  }
});

test('number card hints name no card, and the example uses other cards', () => {
  for (const skill of graph.all()) {
    skill.levels.forEach((_, i) => {
      if (!hasCards(skill, i + 1)) return;
      for (let run = 0; run < RUNS; run++) {
        const sh = generateShield(skill, i + 1, createRng(`hint:${skill.id}:${i}:${run}`));
        assert.deepEqual(Object.keys(sh.hint.params), ['target']);
        assert.notEqual(sh.example.params.target, sh.target, 'the example has another target');
        assert.ok(!sh.example.params.expr.includes('undefined'));
      }
    });
  }
});

test('number shields follow the "regroup" value of the level', () => {
  const carry = (a, b) => String(a).split('').reverse().some((d, i) => Number(d) + Number(String(b).split('').reverse()[i] ?? 0) >= 10);
  const borrow = (a, b) => String(a).split('').reverse().some((d, i) => Number(d) < Number(String(b).split('').reverse()[i] ?? 0));
  for (const skill of graph.all().filter((s) => s.generator === 'addsub')) {
    skill.levels.forEach((params, i) => {
      if (!params.cards) return;
      for (let run = 0; run < RUNS; run++) {
        const sh = generateShield(skill, i + 1, createRng(`regroup:${skill.id}:${i}:${run}`));
        const [m1, m2] = sh.solution;
        const a = sh.cards[m1.index];
        const b = sh.cards[m2.index];
        const regroup = m2.op === '-' ? borrow(a, b) : carry(a, b);
        assert.equal(regroup, Boolean(params.regroup), `${skill.id} L${i + 1}: ${a} ${m2.op} ${b}`);
      }
    });
  }
});

test('a set of number cards never has three or more identical cards', () => {
  for (const skill of graph.all()) {
    skill.levels.forEach((_, i) => {
      if (!hasCards(skill, i + 1)) return;
      for (const extraCards of [0, 1, 2]) {
        for (let run = 0; run < RUNS; run++) {
          const sh = generateShield(skill, i + 1, createRng(`same:${skill.id}:${i}:${extraCards}:${run}`), { extraCards });
          for (const v of sh.cards) {
            assert.ok(sh.cards.filter((x) => x === v).length <= 2, `${skill.id} L${i + 1}: ${sh.cards.join(', ')}`);
          }
          const exampleCards = sh.example.params.cards.split(', ').map(Number);
          for (const v of exampleCards) assert.ok(exampleCards.filter((x) => x === v).length <= 2, 'example cards');
        }
      }
    });
  }
});

test('extra cards give more cards', () => {
  const sh = generateShield(graph.get('math.add.20'), 1, createRng(3), { extraCards: 1 });
  assert.equal(sh.cards.length, 5);
});

test('card answers must use known cards and allowed operations', () => {
  const sh = { kind: 'cards', cards: [5, 4, 7, 3], target: 12, ops: ['+'] };
  assert.equal(checkAnswer(sh, [{ index: 0, op: '+' }, { index: 2, op: '+' }]), true);
  assert.equal(checkAnswer(sh, [{ index: 0, op: '+' }, { index: 0, op: '+' }, { index: 3, op: '+' }]), false, 'a card only once');
  assert.equal(checkAnswer(sh, [{ index: 2, op: '+' }]), false, 'at least two cards');
  assert.equal(checkAnswer(sh, [{ index: 2, op: '+' }, { index: 3, op: '-' }, { index: 0, op: '+' }]), false, 'no subtraction here');
  assert.deepEqual(solveCards([5, 4, 7, 3], 12, ['+']).map((m) => m.index).sort(), [0, 2]);
  assert.deepEqual(solveCards([12, 5, 1], 7, ['+', '-']), [{ index: 0, op: '+' }, { index: 1, op: '-' }]);
  assert.equal(solveCards([2, 3], 7, ['+']), null);
});

test('shapes have the correct number of sides', () => {
  assert.deepEqual(SHAPE_SIDES, { circle: 0, triangle: 3, square: 4, rectangle: 4, pentagon: 5, hexagon: 6 });
});

test('item ratings go up with the level and the grade', () => {
  for (const skill of graph.all()) {
    for (let l = 2; l <= skill.levels.length; l++) {
      assert.ok(itemStartRating(skill, l, learningConfig.rating) > itemStartRating(skill, l - 1, learningConfig.rating));
    }
  }
  const g1 = itemStartRating(graph.get('math.add.10'), 1, learningConfig.rating);
  const g3 = itemStartRating(graph.get('math.mul.10'), 1, learningConfig.rating);
  assert.ok(g3 > g1);
});

test('each hand-written skill has questions', () => {
  for (const skill of graph.filter((s) => s.generator === 'bank')) {
    const own = bank.filter((q) => q.skill === skill.id);
    assert.ok(own.length >= 3, `${skill.id} has ${own.length} questions`);
  }
  for (const q of bank) {
    assert.ok(graph.has(q.skill), q.id);
    if (q.type === 'choice') assert.ok(q.answer >= 0 && q.answer < q.choices.length);
    else assert.equal(typeof q.answer, 'number');
  }
});
