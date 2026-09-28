// The element rule table: fire melts ice, water puts out fire, fire and water
// make steam, and water carries lightning to all wet enemies.
// The rules are data (data/elements.json). This module only reads them.

export function createElementRules(data) {
  const byKey = new Map();
  for (const rule of data.rules) {
    const key = `${rule.attack}>${rule.target}`;
    if (byKey.has(key)) throw new Error(`Two rules for ${key}`);
    byKey.set(key, rule);
  }

  // The rule for an attack on a target state, or a "no effect" rule.
  function find(attack, target) {
    return byKey.get(`${attack}>${target}`) ?? { attack, target, effect: 'none', mistake: true, hintKey: null };
  }

  // The rule for an attack on a target with a state and statuses (for example "wet").
  // The state rule comes first. A status rule applies when no state rule has an effect.
  function resolve(attack, state, statuses = []) {
    const main = state ? find(attack, state) : null;
    if (main && main.effect !== 'none') return main;
    for (const s of statuses) {
      const r = byKey.get(`${attack}>${s}`);
      if (r && r.effect !== 'none') return r;
    }
    return main ?? find(attack, null);
  }

  // The element that works on a state (the first rule that has damage or a result and no mistake).
  function counter(state) {
    for (const rule of data.rules) {
      if (rule.target === state && !rule.mistake && data.available.includes(rule.attack)) return rule.attack;
    }
    return null;
  }

  return { find, resolve, counter, available: data.available, elements: data.elements };
}
