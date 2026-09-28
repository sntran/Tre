// The adaptive Văn Miếu exam. It starts easy (or near the grade of the player) and gets
// harder until the player makes a few mistakes. It has "min" to "max" questions.
// The ability estimate is a rating on the same scale as the problem items.
// Until the player has both a correct and a wrong answer, the estimate moves in steps.
// After that, and for the result, the estimate is the maximum likelihood value of all answers.
import { expected, itemStartRating } from './rating.js';

// A ladder of exam items (skill and level), from easy to hard.
// ratingOf(skill, level) gives the item rating. The default is the start rating.
export function buildLadder(skills, ratingCfg, ratingOf = null) {
  const items = [];
  for (const skill of skills) {
    skill.levels.forEach((_, i) => {
      const level = i + 1;
      items.push({ skill: skill.id, level, rating: ratingOf ? ratingOf(skill, level) : itemStartRating(skill, level, ratingCfg) });
    });
  }
  return items.sort((a, b) => a.rating - b.rating || a.skill.localeCompare(b.skill));
}

// The maximum likelihood ability for answers [{ rating, correct }], in the range [lo, hi],
// rounded to a whole number. With only correct answers, it is hi. With only wrong answers, it is lo.
// The log likelihood has one top (it is concave), so a ternary search finds it.
export function maxLikelihood(answers, lo, hi, scale = 400) {
  if (answers.length === 0) return lo;
  if (answers.every((a) => a.correct)) return hi;
  if (answers.every((a) => !a.correct)) return lo;
  const log = (x) => answers.reduce((sum, it) => {
    const e = expected(x, it.rating, scale);
    return sum + Math.log(it.correct ? e : 1 - e);
  }, 0);
  let a = lo;
  let b = hi;
  while (b - a > 0.5) {
    const m1 = a + (b - a) / 3;
    const m2 = b - (b - a) / 3;
    if (log(m1) < log(m2)) a = m1;
    else b = m2;
  }
  return Math.round((a + b) / 2);
}

// settings: { min, max, maxMistakes, kStart, kAfterMistake, kMin, window, startOffset }
// start: the first ability estimate (for example near the grade of the player).
export function createExam({ ladder, settings, rng, scale = 400, start = null }) {
  if (ladder.length === 0) throw new Error('The exam has no items');
  const low = ladder[0].rating;
  const high = ladder[ladder.length - 1].rating;
  const lo = low - 200;
  const hi = high + 200;
  const state = {
    ability: start ?? low + (settings.startOffset ?? 0),
    asked: [],
    mistakes: 0,
    current: null,
    done: false,
  };

  function k() {
    if (state.mistakes === 0) return settings.kStart;
    return Math.max(settings.kMin, settings.kAfterMistake / Math.sqrt(state.mistakes));
  }

  // The next item: an item near the ability. Prefer a skill that was not asked recently.
  function next() {
    if (state.done) return null;
    const target = state.ability;
    const near = ladder.filter((it) => Math.abs(it.rating - target) <= settings.window);
    let pool = near.length ? near : [ladder.reduce((a, b) => (Math.abs(b.rating - target) < Math.abs(a.rating - target) ? b : a))];
    const recent = state.asked.slice(-2).map((a) => a.skill);
    const fresh = pool.filter((it) => !recent.includes(it.skill));
    if (fresh.length) pool = fresh;
    const count = (it) => state.asked.filter((a) => a.skill === it.skill && a.level === it.level).length;
    const least = Math.min(...pool.map(count));
    pool = pool.filter((it) => count(it) === least);
    state.current = rng.pick(pool);
    return state.current;
  }

  const mixed = () => state.asked.some((a) => a.correct) && state.asked.some((a) => !a.correct);

  function answer(correct) {
    const item = state.current;
    if (!item || state.done) throw new Error('No open question');
    const e = expected(state.ability, item.rating, scale);
    if (!correct) state.mistakes += 1;
    state.asked.push({ ...item, correct });
    state.ability = mixed()
      ? maxLikelihood(state.asked, lo, hi, scale)
      : Math.max(lo, Math.min(hi, state.ability + k() * ((correct ? 1 : 0) - e)));
    state.current = null;
    const n = state.asked.length;
    if (n >= settings.max || (n >= settings.min && state.mistakes >= settings.maxMistakes)) state.done = true;
    return { done: state.done, ability: state.ability };
  }

  function result() {
    const perSkill = {};
    for (const a of state.asked) {
      perSkill[a.skill] ??= { asked: 0, correct: 0 };
      perSkill[a.skill].asked += 1;
      perSkill[a.skill].correct += a.correct ? 1 : 0;
    }
    return {
      ability: maxLikelihood(state.asked, lo, hi, scale),
      asked: state.asked.length,
      correct: state.asked.filter((a) => a.correct).length,
      mistakes: state.mistakes,
      perSkill,
    };
  }

  return {
    next,
    answer,
    result,
    get done() { return state.done; },
    get ability() { return state.ability; },
    get count() { return state.asked.length; },
  };
}

// Skills to practice after an exam: skills with a wrong answer,
// and skills of the exam whose items are above the ability.
export function skillsToPractice(result, ladder) {
  const out = new Set();
  for (const [id, s] of Object.entries(result.perSkill)) if (s.correct < s.asked) out.add(id);
  for (const item of ladder) if (item.level === 1 && item.rating > result.ability) out.add(item.skill);
  return [...out];
}

// Run many exams with a simulated player of a known ability. Return the sorted results.
// The game uses this to set a pass mark: at the pass ability, about half of the players pass.
export function simulateExams({ ladder, settings, ability, runs, seed = 'sim', scale = 400, start = null, rngOf }) {
  const out = [];
  for (let i = 0; i < runs; i++) {
    const answers = rngOf(`${seed}:answers:${ability}:${i}`);
    const exam = createExam({ ladder, settings, rng: rngOf(`${seed}:exam:${i}`), scale, start });
    while (!exam.done) {
      const item = exam.next();
      exam.answer(answers.chance(expected(ability, item.rating, scale)));
    }
    out.push(exam.result().ability);
  }
  return out.sort((a, b) => a - b);
}
