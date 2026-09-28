// The learner model of one player. It joins the skill graph, the mastery model
// (BKT), the difficulty rating (Elo), the spaced review (Leitner boxes), and the
// problem generators. The state is a plain object in the profile (profile.learning).
import { bktUpdate, masteryState } from './mastery.js';
import { chooseLevel, itemStartRating, playerStartRating, updateRatings, expected } from './rating.js';
import { startReview, recordReview, isDue } from './review.js';
import { generate, generateShield, hasCards } from './generators.js';

const RECENT = 12;

// The feedback after a number of mistakes on one problem:
// first a hint, then a worked example, then a similar problem.
export function feedbackFor(mistakes, cfg) {
  if (mistakes >= cfg.similarAt) return 'similar';
  if (mistakes >= cfg.exampleAt) return 'example';
  if (mistakes >= cfg.hintAt) return 'hint';
  return null;
}

export function createLearner({ graph, config, learning, grade, rng, bank = [], lang = 'vi', clock = () => Date.now() }) {
  learning.skills ??= {};
  learning.items ??= {};
  learning.recent ??= [];
  const m = config.mastery;
  const r = config.rating;

  function prior(skill) {
    if (skill.grade < grade) return m.priorBelowGrade;
    if (skill.grade === grade) return m.priorAtGrade;
    return m.priorAboveGrade;
  }

  function entry(id) {
    let e = learning.skills[id];
    if (!e) {
      const skill = graph.get(id);
      if (!skill) throw new Error(`Unknown skill ${id}`);
      e = { p: prior(skill), r: playerStartRating(grade, r), n: 0, c: 0, streak: 0, box: 0, due: 0, last: 0 };
      learning.skills[id] = e;
      if (e.p >= m.mastered) {
        // A skill below the grade of the player goes into review now, to check it soon.
        e.box = 1;
        e.due = clock();
      }
    }
    return e;
  }

  const status = (id) => masteryState(entry(id).p, m);
  const isMastered = (id) => status(id) === 'mastered';
  const unlocked = (id) => graph.isUnlocked(id, isMastered);

  function itemRating(skill, level) {
    const key = `${skill.id}#${level}`;
    return learning.items[key] ?? itemStartRating(skill, level, r);
  }

  function levelFor(id) {
    const skill = graph.get(id);
    const ratings = skill.levels.map((_, i) => itemRating(skill, i + 1));
    return chooseLevel(entry(id).r, ratings, r);
  }

  // Make a problem for a skill. opts: { level, cards, extraCards }
  function problem(id, opts = {}) {
    const skill = graph.get(id);
    const level = opts.level ?? levelFor(id);
    if (opts.cards && hasCards(skill, level)) return generateShield(skill, level, rng, opts);
    // Questions from the parent editor come up for their skill, in their language, for any kind of skill.
    const parent = bank.filter((q) => q.parent && q.skill === id && (!q.lang || q.lang === lang));
    if (parent.length && skill.generator !== 'bank' && rng.chance(config.practice.parentShare ?? 0.5)) {
      const p = generate({ ...skill, generator: 'bank' }, 1, rng, { bank: parent, lang, recent: learning.recent });
      return { ...p, level };
    }
    const p = generate(skill, level, rng, { bank, lang, recent: learning.recent });
    if (p.source) {
      learning.recent.push(p.source);
      if (learning.recent.length > RECENT) learning.recent.shift();
    }
    return p;
  }

  // Pick the next skill to practice.
  // filter(skill) -> boolean limits the skills, for example to one subject or to skills with cards.
  function pickSkill({ filter = () => true } = {}) {
    const now = clock();
    const pool = graph.filter(filter);
    if (pool.length === 0) return null;
    const due = pool.filter((s) => isMastered(s.id) && isDue(entry(s.id), now));
    const frontier = pool.filter((s) => !isMastered(s.id) && unlocked(s.id));
    const learned = pool.filter((s) => status(s.id) !== 'learning');

    if (due.length && rng.chance(config.review.share)) return rng.pick(due).id;
    if (learned.length && frontier.length && rng.chance(config.practice.mixShare)) return rng.pick(learned).id;
    if (frontier.length) {
      const low = Math.min(...frontier.map((s) => s.grade));
      return rng.weighted(frontier, (s) =>
        config.practice.frontierWeightDrop ** (s.grade - low) * (entry(s.id).n > 0 ? 1.5 : 1)).id;
    }
    if (due.length) return rng.pick(due).id;
    if (learned.length) return rng.pick(learned).id;
    return pool[0].id;
  }

  function next(opts = {}) {
    const filter = opts.cards
      ? (s) => (opts.filter ? opts.filter(s) : true) && hasCards(s, 1)
      : opts.filter;
    const id = pickSkill({ filter });
    return id ? problem(id, opts) : null;
  }

  // Record an answer. Return what changed.
  function record(prob, correct) {
    const now = clock();
    const skill = graph.get(prob.skill);
    const e = entry(prob.skill);
    const before = masteryState(e.p, m);
    const wasMastered = before === 'mastered';
    e.n += 1;
    e.c += correct ? 1 : 0;
    e.streak = correct ? e.streak + 1 : 0;
    e.last = now;
    e.p = bktUpdate(e.p, correct, m);
    const k = e.n <= r.newAnswers ? r.kPlayerNew : r.kPlayer;
    const level = prob.level ?? 1;
    const result = updateRatings(e.r, itemRating(skill, level), correct, { kPlayer: k, kItem: r.kItem, scale: r.scale });
    e.r = result.player;
    learning.items[`${skill.id}#${level}`] = result.item;
    if (wasMastered) recordReview(e, correct, now, config.review);
    const after = masteryState(e.p, m);
    if (after === 'mastered' && !wasMastered) startReview(e, now, config.review);
    return { skill: skill.id, before, after, p: e.p, newlyMastered: after === 'mastered' && !wasMastered };
  }

  // Skills to practice: tried skills that are not mastered, and review skills that are due.
  function toPractice(filter = () => true) {
    const now = clock();
    return graph.filter(filter)
      .filter((s) => learning.skills[s.id])
      .filter((s) => {
        const e = learning.skills[s.id];
        return (e.n > 0 && masteryState(e.p, m) !== 'mastered') || isDue(e, now) && e.n > 0;
      })
      .sort((a, b) => learning.skills[a.id].p - learning.skills[b.id].p)
      .map((s) => s.id);
  }

  // Use the result of a placement exam. ability is a rating.
  function applyPlacement(ability, ids, cfg) {
    const now = clock();
    for (const id of ids) {
      const skill = graph.get(id);
      const e = entry(id);
      const top = itemRating(skill, skill.levels.length);
      const chance = expected(ability, top, r.scale);
      // The ability is on the scale of the items, so the player rating is the ability.
      e.r = ability;
      if (chance >= cfg.masteredAt) {
        e.p = Math.max(e.p, cfg.masteredP);
        if (!e.box) { e.box = 1; e.due = now; }
      } else if (chance >= cfg.almostAt) {
        e.p = cfg.almostP;
        e.box = 0;
      } else {
        e.p = Math.min(e.p, m.priorAtGrade);
        e.box = 0;
      }
    }
  }

  function summary(filter = () => true) {
    return graph.filter(filter).map((s) => {
      const e = learning.skills[s.id];
      return {
        id: s.id,
        subject: s.subject,
        grade: s.grade,
        status: e ? masteryState(e.p, m) : 'new',
        p: e?.p ?? null,
        answers: e?.n ?? 0,
        correct: e?.c ?? 0,
        box: e?.box ?? 0,
      };
    });
  }

  return {
    entry, status, isMastered, unlocked, itemRating, levelFor, problem, pickSkill, next, record,
    toPractice, applyPlacement, summary, setGrade: (g) => { grade = g; },
  };
}
