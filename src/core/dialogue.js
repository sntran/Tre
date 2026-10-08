// Dialogue runner for our own JSON format. All text is a key.
// {
//   "id": "elder.intro", "start": "a", "mark": "legend",
//   "nodes": {
//     "a": { "speaker": "elder", "textKey": "dlg.elder.1", "next": "b" },
//     "b": { "if": { "flags": ["x"] }, "then": "c", "else": "d" },
//     "c": { "speaker": "hero", "textKey": "dlg.elder.2",
//            "choices": [{ "textKey": "dlg.yes", "next": "d", "effects": [{ "set": "y" }] }] },
//     "d": { "speaker": "elder", "textKey": "dlg.elder.3", "effects": [{ "open": "trial", "id": "scholar" }] }
//   }
// }
// A node with no "next" and no "choices" ends the dialogue. "mood" (optional): the face of the speaker in
// the portrait (calm, happy, worried, surprised; calm when it is not given).
// "effects" run when the node shows (or when the player picks a choice). "mark" (optional, on a
// node): the seal of that line, in place of the seal of the dialogue (null: no seal). "names"
// (optional, on a node): the things that the line talks about, each an id or { id, act }. While
// the line shows, the person points at them, they glow, and the view shows them (#62: a new word
// with its thing). act: "bob" (the thing bobs, as a float), or "rise" (the water rises a little,
// and goes back at the end of the line). "calling" (optional, on a node): the id of a calling
// that the line names; the card of the calling shows next to the talk box (#62).
// An effect { "open": "trial", "now": true } starts the task when its line shows, so that the
// things of the task are there for the next lines.
import { check } from './conditions.js';

export function createDialogue(def, state) {
  if (!def.nodes[def.start]) throw new Error(`Dialogue ${def.id}: no start node`);
  let current = null;
  const pending = [];

  // Follow "if" nodes until a node with text.
  function resolve(id) {
    let steps = 0;
    while (id) {
      const node = def.nodes[id];
      if (!node) throw new Error(`Dialogue ${def.id}: unknown node ${id}`);
      if (!('if' in node)) return id;
      id = check(node.if, state) ? node.then : node.else;
      if (++steps > 50) throw new Error(`Dialogue ${def.id}: loop in "if" nodes`);
    }
    return null;
  }

  function enter(id) {
    const resolved = resolve(id);
    current = resolved;
    if (resolved) pending.push(...(def.nodes[resolved].effects ?? []));
    return view();
  }

  function view() {
    if (!current) return null;
    const node = def.nodes[current];
    const choices = (node.choices ?? []).filter((c) => check(c.when, state));
    return { id: current, speaker: node.speaker ?? null, textKey: node.textKey, params: node.params ?? {}, choices, mood: node.mood ?? null, mark: 'mark' in node ? node.mark : def.mark ?? null, names: (node.names ?? []).map((n) => (typeof n === 'string' ? { id: n } : n)), calling: node.calling ?? null };
  }

  // Go on. choice is the index of a choice, when the node has choices.
  function next(choice = null) {
    if (!current) return null;
    const node = def.nodes[current];
    const choices = (node.choices ?? []).filter((c) => check(c.when, state));
    if (choices.length) {
      const c = choices[choice ?? -1];
      if (!c) return view();
      pending.push(...(c.effects ?? []));
      return enter(c.next ?? null);
    }
    return enter(node.next ?? null);
  }

  // Take the effects that the game must apply now.
  function takeEffects() {
    return pending.splice(0);
  }

  enter(def.start);

  return {
    id: def.id,
    mark: def.mark ?? null,
    view,
    next,
    takeEffects,
    get done() { return current === null; },
  };
}

// Check a dialogue file. Return a list of problems.
export function checkDialogue(def) {
  const problems = [];
  const ids = new Set(Object.keys(def.nodes));
  const ref = (from, to) => { if (to && !ids.has(to)) problems.push(`${def.id}.${from}: unknown node ${to}`); };
  if (!ids.has(def.start)) problems.push(`${def.id}: unknown start ${def.start}`);
  for (const [id, n] of Object.entries(def.nodes)) {
    if ('if' in n) {
      ref(id, n.then);
      ref(id, n.else);
      continue;
    }
    if (!n.textKey) problems.push(`${def.id}.${id}: no textKey`);
    ref(id, n.next);
    for (const c of n.choices ?? []) {
      if (!c.textKey) problems.push(`${def.id}.${id}: a choice has no textKey`);
      ref(id, c.next);
    }
  }
  return problems;
}
