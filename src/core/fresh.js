// A quiz never shows the same question twice. This file finds a new question:
// it tries the first way to make a problem a few times, then the next way (for example
// another skill of the trial, or another level of the skill).

// The identity of a question: the hand-written question, or the skill, the prompt, and the numbers.
export function problemKey(p) {
  if (p.source) return `bank:${p.source}`;
  if (p.kind === 'cards') return `cards:${p.skill}:${p.target}:${[...p.cards].sort((a, b) => a - b).join(',')}`;
  const prompt = p.prompt?.key ?? p.prompt?.text ?? '';
  return `${p.skill}|${prompt}|${JSON.stringify(p.expr ?? null)}`;
}

// parent: the questions of the whole play session (optional). A quiz first tries a question
// that the session did not show. When there is none, it takes a question that this quiz
// did not show. So a quiz never repeats itself, and repeats of the session are rare.
export function createSeen(parent = null) {
  const keys = new Set();
  const skills = [];
  const remember = (p) => {
    keys.add(problemKey(p));
    if (!skills.includes(p.skill)) skills.push(p.skill);
    parent?.add(p);
  };
  const ownHas = (key) => keys.has(key);
  const allHas = (key) => keys.has(key) || Boolean(parent?.hasKey(key));
  const pass = (makers, tries, isSeen) => {
    for (const make of makers) {
      for (let i = 0; i < tries; i++) {
        const p = make();
        if (!p) break;
        if (!isSeen(problemKey(p))) return p;
      }
    }
    return null;
  };
  return {
    has: (p) => allHas(problemKey(p)),
    hasKey: allHas,
    add: remember,
    get size() { return keys.size; },
    // The skills of the questions that were shown, in order, each one time.
    skills: () => [...skills],
    // Make a problem that was not shown. makers: functions that make a problem, in the order
    // of preference. Return null when no maker gives a new problem.
    fresh(makers, tries = 12) {
      const p = pass(makers, tries, allHas) ?? (parent ? pass(makers, tries, ownHas) : null);
      if (p) remember(p);
      return p;
    },
  };
}

// The ways to make a problem of a skill at its other levels, nearest level first.
export function otherLevels(learner, skill, level) {
  return skill.levels
    .map((_, i) => i + 1)
    .filter((l) => l !== level)
    .sort((a, b) => Math.abs(a - level) - Math.abs(b - level) || a - b)
    .map((l) => () => learner.problem(skill.id, { level: l }));
}
