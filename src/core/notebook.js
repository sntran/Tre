// The notebook (Sổ tay, #8): a collection of prints that fills in as the child plays. Each skill,
// legend, creature, and place gets a print when the child meets it; a mastered skill gets a red
// seal. The child sees the gaps; the parent page shows the same notebook. Pure: no DOM.
// def: data/notebook.json; skills: the list of data/skills.json.

// The things that the child met: profile.notebook.seen = { key: game minute } (keys: talk:<dialogue>,
// creature:<kind>, map:<id>).
export function seenOf(profile) {
  profile.notebook ??= { seen: {} };
  profile.notebook.seen ??= {};
  return profile.notebook.seen;
}

// Note a thing that the child met. Return true when it is new.
export function noteSeen(profile, key, minute = 0) {
  const seen = seenOf(profile);
  if (key in seen) return false;
  seen[key] = Math.max(0, Math.floor(minute));
  return true;
}

// Is a rule of an entry met? met: talk:/creature:/map: (a key of seen) or flag:<flag>.
export function isMet(rule, profile) {
  if (!rule) return false;
  if (rule.startsWith('flag:')) return Boolean(profile.flags?.[rule.slice(5)]);
  return rule in (profile.notebook?.seen ?? {});
}

// The skills of the notebook: the skills of the era of the story (def.skillEra) up to the grade of
// the child, and a skill of a higher grade that the child met (learned: profile.learning.skills).
export function notebookSkills(def, skills, grade = 1, learned = {}) {
  return skills.filter((s) => (s.era ?? 1) <= (def.skillEra ?? 1) && (s.grade <= grade || learned[s.id]?.n > 0));
}

// All the prints of the notebook, in the order of the pages: [{ id, kind, titleKey, look, met,
// sealed }]. A skill is met after its first skill event (n > 0), and it is sealed when it is
// mastered. On a page, the met prints come first. A skill that starts as mastered (below the grade of the child) is not met until the
// child does it.
export function notebookOf(def, skills, profile) {
  const learned = profile.learning?.skills ?? {};
  const out = [];
  for (const s of notebookSkills(def, skills, profile.grade ?? 1, learned)) {
    const e = learned[s.id];
    const met = Boolean(e && e.n > 0);
    out.push({ id: `skill:${s.id}`, kind: 'skill', skill: s.id, subject: s.subject, titleKey: `skill.${s.id}`, look: null, met, sealed: met && Boolean(e.mastered) });
  }
  for (const e of def.entries) out.push({ id: e.id, kind: e.kind, titleKey: e.titleKey, look: e.look ?? null, met: isMet(e.met, profile), sealed: false });
  // The pages in their order; on a page, the prints that the child met come first, so that the
  // child sees them before the gaps.
  const order = def.kinds ?? ['skill', 'legend', 'creature', 'place'];
  return out.map((e, i) => ({ e, i })).sort((a, b) => order.indexOf(a.e.kind) - order.indexOf(b.e.kind) || Number(b.e.met) - Number(a.e.met) || a.i - b.i).map(({ e }) => e);
}

// The entries that a new key fills in (the entries whose rule is the key).
export const entriesOfKey = (def, key) => def.entries.filter((e) => e.met === key);

// The count of the prints: { have, all, sealed }.
export function notebookCount(list) {
  return { have: list.filter((e) => e.met).length, all: list.length, sealed: list.filter((e) => e.sealed).length };
}
