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

export function createSeen() {
  const keys = new Set();
  return {
    has: (p) => keys.has(problemKey(p)),
    add: (p) => keys.add(problemKey(p)),
    get size() { return keys.size; },
    // Make a problem that was not shown. makers: functions that make a problem, in the order
    // of preference. Return null when no maker gives a new problem.
    fresh(makers, tries = 12) {
      for (const make of makers) {
        for (let i = 0; i < tries; i++) {
          const p = make();
          if (!p) break;
          const key = problemKey(p);
          if (!keys.has(key)) {
            keys.add(key);
            return p;
          }
        }
      }
      return null;
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
