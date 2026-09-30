// Problem generators. Code makes a new problem each time, from the skill,
// the level, and a seeded random generator. Each problem has an "expr"
// that the solver (solver.js) uses to check the answer.
// All text is a key with params. There is no text in this file.
import { SHAPE_SIDES, solveCards, lcm, evaluate } from './solver.js';

const k = (key, params = {}) => ({ key, params });
const range = (n) => Array.from({ length: n }, (_, i) => i);

// A short list of numbers for a worked example, for example "9, 10, 11".
function countSeq(from, steps, dir) {
  return range(steps).map((i) => from + dir * (i + 1)).join(', ');
}

// Split a number into its highest place part and the rest: 347 -> 300 and 47.
function split(n) {
  if (n < 10) return [n, 0];
  const place = 10 ** Math.floor(Math.log10(n));
  const big = Math.floor(n / place) * place;
  return [big, n - big];
}

function hasCarry(a, b) {
  while (a > 0 || b > 0) {
    if ((a % 10) + (b % 10) >= 10) return true;
    a = Math.floor(a / 10);
    b = Math.floor(b / 10);
  }
  return false;
}

function hasBorrow(a, b) {
  while (b > 0) {
    if (a % 10 < b % 10) return true;
    a = Math.floor(a / 10);
    b = Math.floor(b / 10);
  }
  return false;
}

// A worked example uses other numbers than the problem. It never shows the answer.
// Try a maker until the test passes.
function retry(make, test, tries = 500) {
  for (let i = 0; i < tries; i++) {
    const v = make();
    if (test(v)) return v;
  }
  throw new Error('The generator could not make a problem');
}

// Two bottom numbers for an example of unit fractions, not the numbers of the problem.
function otherUnitPair(used, rng) {
  const [x, y] = retry(() => [rng.int(2, 9), rng.int(2, 9)], ([u, v]) => u < v && !used.includes(u) && !used.includes(v));
  return { x, y };
}

// All ways to make the target from two cards with + or −: [x, op, y].
function pairWays(cards, target) {
  const out = [];
  cards.forEach((x, i) => cards.forEach((y, j) => {
    if (i === j) return;
    if (i < j && x + y === target) out.push([x, '+', y]);
    if (x - y === target) out.push([x, '-', y]);
  }));
  return out;
}

// Two numbers for "addsub". p.regroup tells if the sum needs a carry, or the difference a borrow.
function addsubPair(p, add, rng) {
  const minOp = p.minOperand ?? 1;
  return retry(() => {
    if (add) {
      const x = rng.int(minOp, p.max - minOp);
      return [x, rng.int(minOp, p.max - x)];
    }
    const x = rng.int(minOp * 2, p.max);
    return [x, rng.int(minOp, x - minOp)];
  }, ([x, y]) => {
    const regroup = add ? hasCarry(x, y) : hasBorrow(x, y);
    return x >= minOp && y >= minOp && (add ? x + y <= p.max : x - y >= 0) && regroup === Boolean(p.regroup);
  });
}

const GENERATORS = {
  count(p, rng) {
    const modes = p.tens ? ['next', 'prev', 'plus10'] : ['next', 'prev'];
    const op = rng.pick(modes);
    const n = op === 'next' ? rng.int(0, p.max - 1) : op === 'prev' ? rng.int(1, p.max) : rng.int(1, p.max - 10);
    // The example number m: for "prev", the example counts back from m + 1.
    const answer = op === 'next' ? n + 1 : op === 'prev' ? n - 1 : n + 10;
    const m = retry(() => (op === 'plus10' ? rng.int(1, p.max - 10) : rng.int(1, p.max - 1)), (v) => {
      const shown = op === 'plus10' ? [v, v + 10] : [v, v + 1];
      return !shown.includes(n) && !shown.includes(answer);
    });
    const promptKey = { next: 'prob.count.after', prev: 'prob.count.before', plus10: 'prob.count.ten' }[op];
    const example = op === 'plus10'
      ? k('ex.count.ten', { m, m10: m + 10 })
      : op === 'next' ? k('ex.count.after', { m, m1: m + 1 }) : k('ex.count.before', { m: m + 1, m1: m });
    return {
      kind: 'numeric',
      prompt: k(promptKey, { n }),
      expr: { op, n },
      hint: k(`hint.count.${op}`, { n }),
      example,
    };
  },

  compare(p, rng) {
    const [a, b] = retry(() => [rng.int(0, p.max), rng.int(0, p.max)], ([x, y]) => x !== y);
    const op = p.smaller && rng.chance(0.5) ? 'min' : 'max';
    const [x, y] = retry(() => [rng.int(10, 99), rng.int(10, 99)],
      ([s, t]) => Math.floor(s / 10) !== Math.floor(t / 10) && ![a, b].includes(s) && ![a, b].includes(t));
    const big = Math.max(x, y);
    const small = Math.min(x, y);
    return {
      kind: 'choice',
      prompt: k(op === 'max' ? 'prob.compare.bigger' : 'prob.compare.smaller'),
      expr: { op, values: [a, b] },
      choices: [{ value: a }, { value: b }],
      hint: k('hint.compare'),
      example: k('ex.compare', { big, small, bt: Math.floor(big / 10), st: Math.floor(small / 10) }),
    };
  },

  add(p, rng) {
    const s = rng.int(p.min, p.max);
    const a = rng.int(1, s - 1);
    const b = s - a;
    const [x, y] = retry(() => [rng.int(2, 9), rng.int(1, 4)], ([u, v]) => [u, v, u + v].every((w) => ![a, b, s].includes(w)));
    const missing = p.missing && rng.chance(0.4);
    const visual = p.max <= 10 ? { type: 'dots', groups: [a, b] } : null;
    if (missing) {
      return {
        kind: 'numeric',
        prompt: k('prob.add.missing', { a, s }),
        expr: { op: 'sub', a: s, b: a },
        visual: null,
        hint: k('hint.add.missing', { a, s }),
        example: k('ex.add.missing', { x, y, z: x + y, seq: countSeq(x, y, 1) }),
      };
    }
    return {
      kind: 'numeric',
      prompt: k('prob.add', { a, b }),
      expr: { op: 'add', a, b },
      visual,
      hint: k('hint.add', { a, b }),
      example: k('ex.add', { x, y, z: x + y, seq: countSeq(x, y, 1) }),
    };
  },

  sub(p, rng) {
    const a = rng.int(p.minA, p.maxA);
    const b = rng.int(1, a - 1);
    const [x, y] = retry(() => [rng.int(6, 12), rng.int(1, 4)], ([u, v]) => [u, v, u - v].every((w) => ![a, b, a - b].includes(w)));
    return {
      kind: 'numeric',
      prompt: k('prob.sub', { a, b }),
      expr: { op: 'sub', a, b },
      visual: p.maxA <= 10 ? { type: 'dots', groups: [a], crossed: b } : null,
      hint: k('hint.sub', { a, b }),
      example: k('ex.sub', { x, y, z: x - y, seq: countSeq(x, y, -1) }),
    };
  },

  addsub(p, rng) {
    const add = rng.chance(0.5);
    const [a, b] = addsubPair(p, add, rng);
    const z = add ? a + b : a - b;
    // The worked example: other numbers of the same kind (with or without regrouping).
    const [x, y] = retry(() => addsubPair(p, add, rng), ([u, v]) => {
      const [vb, vr] = split(v);
      const result = add ? u + v : u - v;
      const shown = [u, v, vb, vr, add ? u + vb : u - vb, result];
      return ![a, b].includes(u) && ![a, b].includes(v) && result !== z && ![a, b].every((w) => shown.includes(w));
    });
    const [big, rest] = split(y);
    const mid = add ? x + big : x - big;
    return {
      kind: 'numeric',
      prompt: k(add ? 'prob.add' : 'prob.sub', { a, b }),
      expr: { op: add ? 'add' : 'sub', a, b },
      hint: k(add ? 'hint.addsub.add' : 'hint.addsub.sub'),
      example: k(add ? 'ex.split.add' : 'ex.split.sub', { x, y, big, rest, mid, z: add ? x + y : x - y }),
      reveal: true,
    };
  },

  place(p, rng) {
    const lo = 10 ** (p.digits - 1);
    const n = rng.int(lo, 10 ** p.digits - 1);
    if (p.expanded) {
      const h = Math.floor(n / 100) * 100;
      const t = Math.floor((n % 100) / 10) * 10;
      const o = n % 10;
      const m = retry(() => rng.int(100, 999), (v) => Math.floor(v / 100) !== Math.floor(n / 100));
      return {
        kind: 'numeric',
        prompt: k('prob.place.expanded', { h, t, o }),
        expr: { op: 'sum', values: [h, t, o] },
        hint: k('hint.place.expanded'),
        example: k('ex.place.expanded', { h: Math.floor(m / 100) * 100, t: Math.floor((m % 100) / 10) * 10, o: m % 10, m }),
      };
    }
    const place = rng.int(0, p.digits - 1);
    const names = ['place.ones', 'place.tens', 'place.hundreds'];
    const digit = (v) => Math.floor(v / 10 ** place) % 10;
    const m = retry(() => rng.int(lo, 10 ** p.digits - 1), (v) => v !== n && digit(v) !== digit(n));
    return {
      kind: 'numeric',
      prompt: k('prob.place.digit', { n, place: k(names[place]) }),
      expr: { op: 'digit', n, place },
      hint: k('hint.place'),
      example: k('ex.place', { m, place: k(names[place]), d: digit(m) }),
    };
  },

  mul(p, rng) {
    const a = rng.int(p.minA, p.maxA);
    const b = rng.int(p.minB, p.maxB);
    const [x, y] = retry(() => [rng.int(2, 5), rng.int(2, 4)], ([u, v]) => u * v !== a * b && ![a, b].includes(u) && ![a, b].includes(v) && ![a, b].includes(u * v));
    return {
      kind: 'numeric',
      prompt: k('prob.mul', { a, b }),
      expr: { op: 'mul', a, b },
      visual: a <= 5 && b <= 5 ? { type: 'array', rows: b, cols: a } : null,
      hint: k('hint.mul', { a, b }),
      example: k('ex.mul', { x, y, seq: range(y).map(() => x).join(' + '), z: x * y }),
    };
  },

  div(p, rng) {
    const a = rng.int(p.minA, p.maxA);
    const b = rng.int(Math.max(1, p.minB), p.maxB);
    const [x, y] = retry(() => [rng.int(2, 6), rng.int(2, 5)], ([u, v]) => u !== a && [u, v, u * v].every((w) => ![a * b, b].includes(w)));
    return {
      kind: 'numeric',
      prompt: k('prob.div', { a: a * b, b }),
      expr: { op: 'div', a: a * b, b },
      hint: k('hint.div', { p: a * b, b }),
      example: k('ex.div', { p: x * y, y, x }),
    };
  },

  // Fair sharing: n things shared equally among m friends. Ask the share of each friend, or (with
  // p.rest) the things that are left over.
  share(p, rng) {
    const m = rng.int(p.minK, p.maxK);
    const each = rng.int(1, p.maxEach);
    const n = each * m + (p.rest ? rng.int(0, m - 1) : 0);
    const ask = p.rest && rng.chance(0.5) ? 'left' : 'each';
    const answer = ask === 'left' ? n % m : each;
    const [x, y, r] = retry(() => {
      const yy = rng.int(2, 4);
      return [rng.int(1, 5), yy, p.rest ? rng.int(0, yy - 1) : 0];
    }, ([u, v, w]) => (ask === 'left' ? w : u) !== answer && ![n, m].every((z) => [u * v + w, v, u, w].includes(z)));
    return {
      kind: 'numeric',
      prompt: k(ask === 'left' ? 'prob.share.left' : 'prob.share.each', { n, k: m }),
      expr: { op: 'share', n, k: m, ask },
      hint: k('hint.share', { n, k: m }),
      example: k(ask === 'left' ? 'ex.share.left' : 'ex.share.each', { p: x * y + r, y, x, r }),
    };
  },

  fracCompare(p, rng) {
    const [d1, d2] = retry(() => [rng.int(2, p.maxDen), rng.int(2, p.maxDen)], ([x, y]) => x !== y);
    const n = p.sameNum ? rng.int(1, Math.min(d1, d2) - 1) : 1;
    const values = [[n, d1], [n, d2]];
    return {
      kind: 'choice',
      prompt: k('prob.frac.bigger'),
      expr: { op: 'fracMax', values },
      choices: values.map((f) => ({ fraction: f })),
      visual: { type: 'fractions', values },
      hint: k(p.sameNum ? 'hint.frac.samenum' : 'hint.frac.unit'),
      example: k('ex.frac.unit', otherUnitPair([d1, d2], rng)),
    };
  },

  fracEquiv(p, rng) {
    const d = rng.int(2, p.maxDen);
    const n = rng.int(1, d - 1);
    const f = rng.int(2, p.maxK);
    const D = d * f;
    return {
      kind: 'numeric',
      prompt: k('prob.frac.equiv', { a: n, b: d, c: D }),
      expr: { op: 'fracEquiv', n, d, D },
      visual: { type: 'fractions', values: [[n, d]] },
      hint: k('hint.frac.equiv', { b: d, c: D }),
      example: (() => {
        const [ea, eb, ek] = retry(() => {
          const bb = rng.int(2, 6);
          return [rng.int(1, bb - 1), bb, rng.int(2, 3)];
        }, ([u, v, w]) => v !== d && v * w !== D && u * w !== n * f && ![n, d, D].every((x) => [u, v, w, u * w, v * w].includes(x)));
        return k('ex.frac.equiv', { a: ea, b: eb, k: ek, ak: ea * ek, bk: eb * ek });
      })(),
    };
  },

  fracAdd(p, rng) {
    const d = rng.int(3, p.maxDen);
    const limit = p.maxSum * d - (p.maxSum > 1 ? 1 : 0);
    const [a, b] = retry(() => [rng.int(1, d - 1), rng.int(1, d - 1)], ([x, y]) => x + y <= limit);
    return {
      kind: 'numeric',
      prompt: k('prob.frac.add', { a, b, d }),
      expr: { op: 'fracAdd', a, b, d },
      hint: k('hint.frac.add'),
      example: (() => {
        const [ea, eb, ed] = retry(() => {
          const dd = rng.int(3, 9);
          return [rng.int(1, dd - 2), rng.int(1, dd - 2), dd];
        }, ([u, v, w]) => w !== d && u + v < w && u + v !== a + b && ![a, b, d].every((x) => [u, v, w, u + v].includes(x)));
        return k('ex.frac.add', { a: ea, b: eb, d: ed, s: ea + eb });
      })(),
    };
  },

  fracUnlike(p, rng) {
    const [d1, d2] = rng.pick(p.pairs);
    const D = lcm(d1, d2);
    const a = rng.int(1, d1 - 1);
    const b = rng.int(1, d2 - 1);
    return {
      kind: 'numeric',
      prompt: k('prob.frac.unlike', { a, d1, b, d2, D }),
      expr: { op: 'fracUnlike', a, d1, b, d2, D },
      hint: k('hint.frac.unlike', { D }),
      example: (() => {
        const pairs = [[2, 4], [3, 6], [2, 3], [4, 8], [2, 6], [3, 9], [2, 5], [5, 10], [3, 4], [2, 7]];
        const own = [a, d1, b, d2, D];
        const answer = a * (D / d1) + b * (D / d2);
        const [e1, e2, ea, eb] = retry(() => {
          const [u, v] = rng.pick(pairs);
          return [u, v, rng.int(1, u - 1), rng.int(1, v - 1)];
        }, ([u, v, x, y]) => {
          const ED = lcm(u, v);
          const shown = [x, u, y, v, x * (ED / u), y * (ED / v), ED, x * (ED / u) + y * (ED / v)];
          return ![d1, d2].includes(u) && ![d1, d2].includes(v) && shown[7] !== answer
            && !own.every((n) => shown.includes(n));
        });
        const ED = lcm(e1, e2);
        const a2 = ea * (ED / e1);
        const b2 = eb * (ED / e2);
        return k('ex.frac.unlike', { a: ea, d1: e1, b: eb, d2: e2, a2, b2, D: ED, s: a2 + b2 });
      })(),
    };
  },

  area(p, rng) {
    const w = rng.int(2, p.max);
    const h = rng.int(2, p.max);
    const ask = p.ask === 'mixed' ? rng.pick(['area', 'perimeter']) : p.ask;
    const value = (u, v) => (ask === 'area' ? u * v : 2 * (u + v));
    const [x, y] = retry(() => [rng.int(2, 6), rng.int(2, 6)], ([u, v]) => value(u, v) !== value(w, h) && ![w, h].every((n) => [u, v, value(u, v)].includes(n)));
    return {
      kind: 'numeric',
      prompt: k(ask === 'area' ? 'prob.area' : 'prob.perimeter', { w, h }),
      expr: { op: ask, w, h },
      visual: { type: 'rect', w, h, grid: ask === 'area' },
      hint: k(ask === 'area' ? 'hint.area' : 'hint.perimeter'),
      example: ask === 'area' ? k('ex.area', { w: x, h: y, z: x * y }) : k('ex.perimeter', { w: x, h: y, z: 2 * (x + y) }),
    };
  },

  mulMulti(p, rng) {
    const a = rng.int(p.minA, p.maxA);
    const b = rng.int(p.minB, p.maxB);
    const [x, y] = retry(() => [rng.int(12, 48), rng.int(3, 9)], ([u, v]) => {
      const [ub, ur] = split(u);
      return u * v !== a * b && ![a, b].every((n) => [u, v, ub, ur, ub * v, ur * v, u * v].includes(n));
    });
    const [big, rest] = split(x);
    return {
      kind: 'numeric',
      prompt: k('prob.mul', { a, b }),
      expr: { op: 'mul', a, b },
      hint: k('hint.mul.multi'),
      example: k('ex.mul.multi', { x, y, big, rest, p1: big * y, p2: rest * y, z: x * y }),
      reveal: true,
    };
  },

  decimal(p, rng) {
    const unit = 10 ** p.places;
    const sub = p.sub && rng.chance(0.5);
    const [a, b] = retry(() => [rng.int(1, p.max * unit - 1), rng.int(1, p.max * unit - 1)],
      ([x, y]) => (sub ? x > y : x + y <= p.max * unit) && x % unit !== 0 && y % unit !== 0);
    const va = a / unit;
    const vb = b / unit;
    const units = sub ? a - b : a + b;
    const [ea, eb] = retry(() => [rng.int(1, p.max * unit - 1), rng.int(1, p.max * unit - 1)],
      ([x, y]) => (sub ? x > y : x + y <= p.max * unit) && x % unit !== 0 && y % unit !== 0
        && ![a, b].includes(x) && ![a, b].includes(y) && (sub ? x - y : x + y) !== units);
    return {
      kind: 'numeric',
      decimals: p.places,
      prompt: k(sub ? 'prob.sub' : 'prob.add', { a: va, b: vb }),
      expr: { op: 'decimal', a, b, places: p.places, sub },
      hint: k('hint.decimal'),
      example: k(sub ? 'ex.decimal.sub' : 'ex.decimal.add', { x: ea / unit, y: eb / unit, z: (sub ? ea - eb : ea + eb) / unit }),
    };
  },

  shapes(p, rng) {
    if (p.ask === 'sides') {
      const shape = rng.pick(p.shapes);
      // The example shape has another number of sides, so it does not show the answer.
      const other = rng.pick(p.shapes.filter((s) => SHAPE_SIDES[s] !== SHAPE_SIDES[shape]));
      return {
        kind: 'numeric',
        prompt: k('prob.shape.sides'),
        expr: { op: 'sides', shape },
        visual: { type: 'shape', shape },
        hint: k('hint.shape.sides'),
        example: k('ex.shape.sides', { shape: k(`shape.${other}`), n: SHAPE_SIDES[other] }),
      };
    }
    const shape = rng.pick(p.shapes);
    const others = rng.shuffle(p.shapes.filter((s) => s !== shape && !(
      (s === 'square' && shape === 'rectangle') || (s === 'rectangle' && shape === 'square')))).slice(0, 2);
    const choices = rng.shuffle([shape, ...others]).map((s) => ({ shape: s }));
    return {
      kind: 'choice',
      prompt: k('prob.shape.name', { shape: k(`shape.${shape}`) }),
      expr: { op: 'shapeIs', shape },
      choices,
      hint: k(`hint.shape.${shape}`),
      example: k('ex.shape.name', { shape: k(`shape.${shape}`) }),
    };
  },
};

// Hand-written questions. ctx.bank is the list of questions for all skills.
// A question: { id, skill, level, type: 'choice' | 'numeric', promptKey, choices: [keys], answer, hintKey, explainKey, order: 'keep' }
// Parent questions have "text" in place of keys.
function bankProblem(skill, level, rng, ctx) {
  const own = (ctx.bank ?? []).filter((q) => q.skill === skill.id && (!q.lang || q.lang === ctx.lang));
  if (own.length === 0) throw new Error(`No questions for ${skill.id}`);
  const best = Math.min(...own.map((q) => Math.abs((q.level ?? 1) - level)));
  const near = own.filter((q) => Math.abs((q.level ?? 1) - level) === best);
  const fresh = near.filter((q) => !ctx.recent?.includes(q.id));
  const q = rng.pick(fresh.length ? fresh : near);
  const base = {
    source: q.id,
    hint: q.hintKey ? k(q.hintKey) : q.hintText ? { text: q.hintText } : k('hint.bank'),
    // The explanation tells the answer, so it shows only with the answer, after the question.
    example: null,
    explain: q.explainKey ? k(q.explainKey) : null,
    visual: q.visual ?? null,
  };
  const prompt = q.promptKey ? k(q.promptKey) : { text: q.text };
  if (q.type === 'numeric') {
    return { ...base, kind: 'numeric', prompt, expr: { op: 'bank', answer: q.answer } };
  }
  const labels = q.choices.map((c, i) => ({ i, label: typeof c === 'string' && !q.text ? k(c) : { text: String(c) } }));
  const order = q.order === 'keep' ? labels : rng.shuffle(labels);
  const answer = order.findIndex((c) => c.i === q.answer);
  return {
    ...base,
    kind: 'choice',
    prompt,
    expr: { op: 'bank', answer },
    choices: order.map((c) => ({ label: c.label })),
  };
}

export const GENERATOR_NAMES = [...Object.keys(GENERATORS), 'bank'];

// Make a problem. skill is a skill object from the graph. level starts at 1.
export function generate(skill, level, rng, ctx = {}) {
  const lv = Math.max(1, Math.min(level, skill.levels.length));
  const params = skill.levels[lv - 1];
  const body = skill.generator === 'bank'
    ? bankProblem(skill, lv, rng, ctx)
    : GENERATORS[skill.generator](params, rng, ctx);
  const problem = { skill: skill.id, level: lv, item: `${skill.id}#${lv}`, visual: null, reveal: false, ...body };
  problem.answer = problem.kind === 'choice' && problem.expr.op !== 'bank'
    ? answerIndex(problem)
    : problem.expr.op === 'bank' ? problem.expr.answer : evaluate(problem.expr);
  return problem;
}

function answerIndex(problem) {
  const { expr, choices } = problem;
  if (expr.op === 'shapeIs') return choices.findIndex((c) => c.shape === expr.shape);
  if (expr.op === 'fracMax') {
    const [f1, f2] = expr.values;
    return f1[0] * f2[1] > f2[0] * f1[1] ? 0 : 1;
  }
  const value = evaluate(expr);
  return choices.findIndex((c) => c.value === value);
}

// Does this skill have number cards (number shields) at this level?
export function hasCards(skill, level = 1) {
  return Boolean(skill.levels[Math.max(1, Math.min(level, skill.levels.length)) - 1]?.cards);
}

// Make a number shield: a target number and attack cards.
// The player must make the target exactly with 2 or more cards.
// opts.extraCards adds more cards (a bonus of the Scholar calling).
export function generateShield(skill, level, rng, opts = {}) {
  const lv = Math.max(1, Math.min(level, skill.levels.length));
  const p = skill.levels[lv - 1];
  if (!p.cards) throw new Error(`${skill.id} has no cards`);
  const count = p.cards.count + (opts.extraCards ?? 0);
  const kind = skill.generator;
  const maxCard = kind === 'add' ? p.max : kind === 'sub' ? p.maxA : kind === 'mul' ? p.maxA : p.max;
  const ops = kind === 'add' ? ['+'] : kind === 'mul' ? ['×'] : ['+', '-'];

  // One set of cards with a target. avoid: a target that the set must not use.
  const makeSet = (avoid = null) => {
    let target;
    let parts;
    let requireOp = null;
    const make = () => {
      if (kind === 'add') {
        target = rng.int(p.min, p.max);
        const use = Array.isArray(p.cards.use) ? rng.int(...p.cards.use) : (p.cards.use ?? 2);
        parts = [];
        let left = target;
        for (let i = 0; i < use - 1; i++) {
          const v = rng.int(1, Math.max(1, left - (use - 1 - i)));
          parts.push(v);
          left -= v;
        }
        parts.push(left);
      } else if (kind === 'sub') {
        requireOp = '-';
        const a = rng.int(p.minA, p.maxA);
        const b = rng.int(1, a - 1);
        target = a - b;
        parts = [a, b];
      } else if (kind === 'addsub') {
        // The cards follow the "regroup" value of the level, as the addsub problems do.
        const add = rng.chance(0.5);
        const [a, b] = addsubPair(p, add, rng);
        target = add ? a + b : a - b;
        parts = [a, b];
        requireOp = add ? null : '-';
      } else if (kind === 'mul') {
        const a = rng.int(Math.max(2, p.minA), p.maxA);
        const b = rng.int(Math.max(2, p.minB), p.maxB);
        target = a * b;
        parts = [a, b];
      } else {
        throw new Error(`No cards for generator ${kind}`);
      }
      const cards = [...parts];
      while (cards.length < count) {
        const lo = kind === 'mul' ? 2 : 1;
        cards.push(rng.int(lo, Math.max(lo + 1, maxCard)));
      }
      return rng.shuffle(cards);
    };
    const cards = retry(make, (c) => {
      if (target === avoid) return false;
      if (c.includes(target)) return false;
      // No number comes on three or more cards of one set.
      if (c.some((x) => c.filter((y) => y === x).length >= 3)) return false;
      if (parts.some((x) => x <= 0)) return false;
      // For subtraction practice, adding alone must not reach the target.
      if (requireOp === '-' && solveCards(c, target, ['+'])) return false;
      // Each way to make the target with two cards follows the "regroup" value of the level.
      if (kind === 'addsub' && !pairWays(c, target).every(([x, op, y]) => (op === '+' ? hasCarry(x, y) : hasBorrow(x, y)) === Boolean(p.regroup))) return false;
      return solveCards(c, target, ops, { requireOp }) !== null;
    });
    const solution = solveCards(cards, target, ops, { requireOp });
    return { cards, target, requireOp, solution };
  };

  const { cards, target, requireOp, solution } = makeSet();
  // The worked example uses other cards and another target.
  const ex = makeSet(target);
  const hintKey = ops.includes('×') ? 'hint.cards.mul' : requireOp === '-' ? 'hint.cards.sub' : 'hint.cards.add';
  const exprText = ex.solution.map((m, i) => (i === 0 ? '' : ` ${m.op === '-' ? '−' : m.op} `) + ex.cards[m.index]).join('');
  return {
    skill: skill.id,
    level: lv,
    item: `${skill.id}#${lv}`,
    kind: 'cards',
    prompt: k('prob.cards', { target }),
    target,
    cards,
    ops,
    solution,
    answer: target,
    expr: { op: 'cards' },
    visual: null,
    reveal: false,
    hint: k(hintKey, { target }),
    example: k('ex.cards', { cards: ex.cards.join(', '), expr: exprText, target: ex.target }),
  };
}
