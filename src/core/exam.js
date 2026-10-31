// The adaptive exam (the messenger in Era 1, Văn Miếu from chapter 7). It starts easy (or near the
// grade of the player): after a right answer the next question is harder, after a wrong answer it is
// easier, until the player makes a few mistakes. It has "min" to "max" questions (at most 10, #136),
// it aims at a question that the player gets right about seven times in ten ("target"), not half,
// and two questions of one kind never come one after the other.
// The ability estimate is a rating on the same scale as the problem items.
// Until the player has both a correct and a wrong answer, the estimate moves in steps.
// After that, and for the result, the estimate is the maximum likelihood value of all answers.
import { expected, itemStartRating, gradeBase } from './rating.js';

// The kind of a question: the family of its skill (math.add.10 and math.add.20 are both
// math.add). An exam mixes the kinds (#51).
export const kindOf = (skillId) => skillId.replace(/\.\d+$/, '');
// The most questions of one kind in a row.
export const MAX_RUN = 3;

// A ladder of exam items (skill, kind, and level), from easy to hard.
// ratingOf(skill, level) gives the item rating. The default is the start rating.
export function buildLadder(skills, ratingCfg, ratingOf = null) {
  const items = [];
  for (const skill of skills) {
    skill.levels.forEach((_, i) => {
      const level = i + 1;
      items.push({ skill: skill.id, kind: kindOf(skill.id), level, rating: ratingOf ? ratingOf(skill, level) : itemStartRating(skill, level, ratingCfg) });
    });
  }
  return items.sort((a, b) => a.rating - b.rating || a.skill.localeCompare(b.skill));
}

// The ladder of an exam (#136): the first level of each skill, so that each question uses the
// smallest numbers that still test its skill (23 × 14, not 826 × 74), and no question needs paper.
export function examLadder(skills, ratingCfg, ratingOf = null) {
  return buildLadder(skills.map((s) => ({ ...s, levels: s.levels.slice(0, 1) })), ratingCfg, ratingOf);
}

// The skills of an exam. examDef: an exam of titles.json ({ subject, title }).
// An exam that gives a title uses the skills of the era of that title (the "era" field of
// the title). An exam with no title (placement) uses all skills of the subject.
export function examSkills(graph, examDef, titles) {
  const title = examDef.title ? titles.find((x) => x.id === examDef.title) : null;
  if (examDef.title && !title) throw new Error(`Unknown title ${examDef.title}`);
  return graph.filter((s) => s.subject === examDef.subject && (!title || s.era === title.era));
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

// settings: { min, max, maxMistakes, kStart, kAfterMistake, kMin, window, startOffset, target }
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

  // The rating of an item that the player gets right with the chance "target" (#136: about seven
  // in ten; a study found more fear of failure at half right, Ortner, Weißkopf and Koch 2014).
  const below = settings.target ? scale * Math.log10(settings.target / (1 - settings.target)) : 0;
  // The next item: an item near the target. Prefer a skill that was not asked recently.
  function next() {
    if (state.done) return null;
    const target = state.ability - below;
    const near = ladder.filter((it) => Math.abs(it.rating - target) <= settings.window);
    let pool = near.length ? near : [ladder.reduce((a, b) => (Math.abs(b.rating - target) < Math.abs(a.rating - target) ? b : a))];
    // Mix the kinds (#51): a kind that is not one of the last two questions, near the ability when
    // one is near, else the nearest question of such a kind; else another kind than the last one.
    const kinds = state.asked.slice(-2).map((a) => a.kind ?? kindOf(a.skill));
    const freshKind = (list) => list.filter((it) => !kinds.includes(it.kind ?? kindOf(it.skill)));
    const nearest = (list) => {
      const d = Math.min(...list.map((it) => Math.abs(it.rating - target)));
      return list.filter((it) => Math.abs(it.rating - target) <= d + 1e-9);
    };
    const notLast = (list) => list.filter((it) => (it.kind ?? kindOf(it.skill)) !== kinds.at(-1));
    if (kinds.length && freshKind(pool).length) pool = freshKind(pool);
    else if (kinds.length && freshKind(ladder).length) pool = nearest(freshKind(ladder));
    // Never two of one kind in a row (#136): another kind than the last one, near or not.
    else if (kinds.length && notLast(pool).length) pool = notLast(pool);
    else if (kinds.length && notLast(ladder).length) pool = nearest(notLast(ladder));
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

  // skipped: the player said "I have not learned this yet" (#136): not known, with no guess.
  // what: the part of the skill that the question asked (add or sub of a skill of both), or null.
  function answer(correct, { skipped = false, what = null } = {}) {
    const item = state.current;
    if (!item || state.done) throw new Error('No open question');
    if (skipped) correct = false;
    const e = expected(state.ability, item.rating, scale);
    if (!correct) state.mistakes += 1;
    state.asked.push({ ...item, correct, ...(skipped ? { skipped } : {}), ...(what ? { what } : {}) });
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
      skipped: state.asked.filter((a) => a.skipped).length,
      mistakes: state.mistakes,
      perSkill,
      items: state.asked.map((a) => ({ skill: a.skill, level: a.level, rating: a.rating, correct: a.correct, skipped: Boolean(a.skipped), what: a.what ?? null })),
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

// What the player does well and what comes next, for the line of the result (#136: the result names
// no grade). Done well (#143: "But I got the 3,7 one WRONG"): the hardest skill with all its answers
// right, and at least two of them. With no such skill, the skill with the most right answers (one
// with no wrong answer first), with its count. Next: the easiest skill that the player did not
// answer right (or, with all right, the easiest skill of the ladder above the hardest right one).
// Return { good (a skill id or null), count (the right answers of good when it is not done well, or
// null), what (the parts of good that the test asked, for example ['add']), next (a skill id or null) }.
export function strengths(result, ladder) {
  const skills = new Map();
  for (const a of result.items) {
    const s = skills.get(a.skill) ?? { skill: a.skill, right: 0, wrong: 0, rating: -Infinity, what: new Set() };
    if (a.correct) s.right += 1;
    else s.wrong += 1;
    s.rating = Math.max(s.rating, a.rating);
    if (a.what) s.what.add(a.what);
    skills.set(a.skill, s);
  }
  const list = [...skills.values()];
  const well = list.filter((s) => s.wrong === 0 && s.right >= 2).sort((a, b) => b.rating - a.rating)[0] ?? null;
  const most = well ? null : list.filter((s) => s.right > 0).sort((a, b) => (a.wrong === 0) - (b.wrong === 0) || a.right - b.right || a.rating - b.rating).at(-1) ?? null;
  const good = well ?? most;
  const right = result.items.filter((a) => a.correct).sort((a, b) => b.rating - a.rating)[0] ?? null;
  const wrong = result.items.filter((a) => !a.correct && a.skill !== good?.skill).sort((a, b) => a.rating - b.rating)[0] ?? null;
  const above = right ? ladder.find((it) => it.rating > right.rating && it.skill !== right.skill && !result.items.some((a) => a.skill === it.skill)) : null;
  return { good: good?.skill ?? null, count: most ? most.right : null, what: good ? [...good.what] : [], next: wrong?.skill ?? above?.skill ?? null };
}

// The grade of a placement, for the parent page only (#136: the child hears no grade): the highest
// grade whose base rating is at or under the ability, never above "top" (the top grade that has
// tasks in the game). Return { grade, above } (above: the ability is past the top grade).
export function placedGrade(ability, gradeIds, ratingCfg, top) {
  let g = gradeIds[0];
  for (const grade of gradeIds) if (ability >= gradeBase(grade, ratingCfg)) g = grade;
  return g > top ? { grade: top, above: true } : { grade: g, above: false };
}
