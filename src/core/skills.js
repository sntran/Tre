// The skill graph. Each skill has the skills that come before it (pre).
// The game offers a new skill only when the skills before it are mastered.
import { isGrade } from './grades.js';

export function createSkillGraph(data) {
  const list = data.skills;
  const byId = new Map(list.map((s) => [s.id, s]));
  const dependents = new Map(list.map((s) => [s.id, []]));
  for (const skill of list) {
    for (const pre of skill.pre) dependents.get(pre)?.push(skill.id);
  }

  // Return a list of problems in the graph. An empty list means the graph is good.
  // grades: the grade configuration. With it, the grade of each skill must be in the list.
  function check(grades = null) {
    const problems = [];
    const ids = new Set();
    for (const skill of list) {
      if (ids.has(skill.id)) problems.push(`duplicate id ${skill.id}`);
      ids.add(skill.id);
      if (!data.subjects.includes(skill.subject)) problems.push(`${skill.id}: unknown subject ${skill.subject}`);
      if (!Number.isInteger(skill.grade) || (grades && !isGrade(skill.grade, grades))) problems.push(`${skill.id}: bad grade`);
      if (!Array.isArray(skill.levels) || skill.levels.length === 0) problems.push(`${skill.id}: no levels`);
      for (const pre of skill.pre) {
        const p = byId.get(pre);
        if (!p) problems.push(`${skill.id}: unknown pre ${pre}`);
        else if (p.grade > skill.grade) problems.push(`${skill.id}: pre ${pre} has a higher grade`);
      }
    }
    try {
      order();
    } catch (e) {
      problems.push(e.message);
    }
    return problems;
  }

  // Skills in an order where each skill comes after all its pre skills.
  function order() {
    const out = [];
    const state = new Map();
    const visit = (id, path) => {
      if (state.get(id) === 'done') return;
      if (state.get(id) === 'open') throw new Error(`cycle: ${[...path, id].join(' > ')}`);
      state.set(id, 'open');
      for (const pre of byId.get(id)?.pre ?? []) visit(pre, [...path, id]);
      state.set(id, 'done');
      out.push(id);
    };
    for (const skill of list) visit(skill.id, []);
    return out;
  }

  // All skills that come before a skill, directly or not.
  function ancestors(id) {
    const out = new Set();
    const stack = [...(byId.get(id)?.pre ?? [])];
    while (stack.length) {
      const next = stack.pop();
      if (out.has(next)) continue;
      out.add(next);
      stack.push(...(byId.get(next)?.pre ?? []));
    }
    return out;
  }

  // isMastered(id) -> boolean
  function isUnlocked(id, isMastered) {
    const skill = byId.get(id);
    return Boolean(skill) && skill.pre.every((pre) => isMastered(pre));
  }

  return {
    subjects: data.subjects,
    all: () => list,
    get: (id) => byId.get(id) ?? null,
    has: (id) => byId.has(id),
    dependents: (id) => dependents.get(id) ?? [],
    ancestors,
    order,
    check,
    isUnlocked,
    filter: (fn) => list.filter(fn),
  };
}
