// The solver computes the answer of a problem from its structure (expr),
// separately from the generator. Tests use it to check each generated problem.
// It also checks the answers of the player.

export const SHAPE_SIDES = Object.freeze({ circle: 0, triangle: 3, square: 4, rectangle: 4, pentagon: 5, hexagon: 6 });

function gcd(a, b) {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

export function lcm(a, b) {
  return (a / gcd(a, b)) * b;
}

// Compare two fractions [n, d]. Return a negative number, 0, or a positive number.
export function compareFractions([n1, d1], [n2, d2]) {
  return n1 * d2 - n2 * d1;
}

// The value of an expression.
export function evaluate(expr) {
  switch (expr.op) {
    case 'add': return expr.a + expr.b;
    case 'sub': return expr.a - expr.b;
    case 'mul': return expr.a * expr.b;
    case 'div': {
      if (expr.b === 0 || expr.a % expr.b !== 0) throw new Error('Division has a remainder');
      return expr.a / expr.b;
    }
    case 'next': return expr.n + 1;
    case 'prev': return expr.n - 1;
    case 'plus10': return expr.n + 10;
    case 'max': return Math.max(...expr.values);
    case 'min': return Math.min(...expr.values);
    case 'digit': return Math.floor(expr.n / 10 ** expr.place) % 10;
    case 'sum': return expr.values.reduce((a, b) => a + b, 0);
    case 'area': return expr.w * expr.h;
    case 'perimeter': return 2 * (expr.w + expr.h);
    case 'sides': return SHAPE_SIDES[expr.shape];
    case 'fracEquiv': {
      if ((expr.n * expr.D) % expr.d !== 0) throw new Error('Not an equal fraction');
      return (expr.n * expr.D) / expr.d;
    }
    case 'fracAdd': return expr.a + expr.b;
    case 'fracUnlike': {
      const D = lcm(expr.d1, expr.d2);
      if (D !== expr.D && expr.D % D !== 0) throw new Error('Bad common denominator');
      return expr.a * (expr.D / expr.d1) + expr.b * (expr.D / expr.d2);
    }
    // Decimals: a and b are whole numbers of 10^-places units.
    case 'decimal': {
      const units = expr.sub ? expr.a - expr.b : expr.a + expr.b;
      return units / 10 ** expr.places;
    }
    case 'bank': return expr.answer;
    default: throw new Error(`Unknown op ${expr.op}`);
  }
}

// The correct answer of a problem: a number for "numeric", an index for "choice",
// and a list of card moves for "cards".
export function solve(problem) {
  const { expr } = problem;
  if (problem.kind === 'cards') return solveCards(problem.cards, problem.target, problem.ops);
  if (problem.kind === 'choice') {
    if (expr.op === 'shapeIs') return problem.choices.findIndex((c) => c.shape === expr.shape);
    if (expr.op === 'fracMax' || expr.op === 'fracMin') {
      let best = 0;
      for (let i = 1; i < expr.values.length; i++) {
        const cmp = compareFractions(expr.values[i], expr.values[best]);
        if ((expr.op === 'fracMax' && cmp > 0) || (expr.op === 'fracMin' && cmp < 0)) best = i;
      }
      return problem.choices.findIndex((c) => c.fraction && compareFractions(c.fraction, expr.values[best]) === 0);
    }
    if (expr.op === 'bank') return expr.answer;
    const value = evaluate(expr);
    return problem.choices.findIndex((c) => c.value === value);
  }
  return evaluate(expr);
}

// Read a number that the player typed. Accept "," or "." as the decimal point.
export function parseNumber(text) {
  if (typeof text === 'number') return text;
  const clean = String(text).trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(clean)) return NaN;
  return Number(clean);
}

// Evaluate the cards that the player chose, left to right.
// moves: [{ index, op }] where op is '+', '-', or '×'. The first op must be '+'.
export function evaluateCards(cards, moves) {
  let total = 0;
  moves.forEach((m, i) => {
    const v = cards[m.index];
    if (i === 0) total = v;
    else if (m.op === '+') total += v;
    else if (m.op === '-') total -= v;
    else if (m.op === '×') total *= v;
  });
  return total;
}

export function cardMovesValid(problem, moves) {
  if (!Array.isArray(moves) || moves.length < 2) return false;
  const used = new Set();
  for (let i = 0; i < moves.length; i++) {
    const m = moves[i];
    if (!Number.isInteger(m.index) || m.index < 0 || m.index >= problem.cards.length) return false;
    if (used.has(m.index)) return false;
    used.add(m.index);
    if (i > 0 && !problem.ops.includes(m.op)) return false;
  }
  if (problem.ops.includes('×') && moves.length !== 2) return false;
  return true;
}

// Find a way to make the target with 2 or more cards, or return null.
// With '+' and '-': each card is not used, added, or taken away. Prefer fewer cards.
// With '×': two cards multiplied.
export function solveCards(cards, target, ops, { requireOp = null } = {}) {
  const n = cards.length;
  if (ops.includes('×')) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (cards[i] * cards[j] === target) return [{ index: i, op: '+' }, { index: j, op: '×' }];
      }
    }
    return null;
  }
  const allowSub = ops.includes('-');
  let best = null;
  const signs = new Array(n).fill(0);
  const total = 3 ** n;
  for (let code = 0; code < total; code++) {
    let c = code;
    let sum = 0;
    let used = 0;
    let plus = 0;
    let minus = 0;
    let ok = true;
    for (let i = 0; i < n; i++) {
      const s = c % 3; // 0 = not used, 1 = add, 2 = take away
      c = Math.floor(c / 3);
      signs[i] = s;
      if (s === 1) { sum += cards[i]; used++; plus++; }
      if (s === 2) {
        if (!allowSub) { ok = false; break; }
        sum -= cards[i]; used++; minus++;
      }
    }
    if (!ok || used < 2 || plus === 0 || sum !== target) continue;
    if (requireOp === '-' && minus === 0) continue;
    if (best === null || used < best.used) {
      // Put the added cards first, so that the total does not go below zero.
      const moves = [];
      for (let i = 0; i < n; i++) if (signs[i] === 1) moves.push({ index: i, op: '+' });
      for (let i = 0; i < n; i++) if (signs[i] === 2) moves.push({ index: i, op: '-' });
      best = { used, moves };
    }
  }
  return best ? best.moves : null;
}

// Check the answer of the player.
export function checkAnswer(problem, response) {
  if (problem.kind === 'choice') return response === problem.answer;
  if (problem.kind === 'cards') {
    return cardMovesValid(problem, response) && evaluateCards(problem.cards, response) === problem.target;
  }
  const value = parseNumber(response);
  if (Number.isNaN(value)) return false;
  // Compare decimals as whole numbers of hundredths.
  return Math.round(value * 1000) === Math.round(problem.answer * 1000);
}
