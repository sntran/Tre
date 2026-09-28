// Crafting: the player builds a machine step by step. A machine works only
// if the player builds it correctly: the right element for the material,
// and each part in its own slot.

export function createCraft(recipe, rules, { bonuses = {} } = {}) {
  const steps = recipe.steps.filter((s) => !(s.skipWith && bonuses[s.skipWith]));
  const state = {
    index: 0,
    material: null,
    placed: {},
    tray: [],
    mistakes: 0,
    done: false,
  };

  function enter() {
    const step = steps[state.index];
    state.mistakes = 0;
    if (!step) {
      state.done = true;
      return;
    }
    if (step.type === 'element') state.material = step.start;
    if (step.type === 'assemble') {
      state.placed = {};
      state.tray = step.tray.map((part, i) => ({ id: i, part, used: false }));
    }
  }

  function next() {
    state.index += 1;
    enter();
  }

  // Use an element on the material. The goal state finishes the step.
  function useElement(element) {
    const step = steps[state.index];
    if (!step || step.type !== 'element') return { ok: false, ignored: true };
    const rule = rules.find(element, state.material);
    if (rule.result === step.goal) {
      state.material = rule.result;
      next();
      return { ok: true, rule };
    }
    state.mistakes += 1;
    return { ok: false, rule };
  }

  // Finish a step of problems (the screen counts the problems).
  function finishProblems() {
    const step = steps[state.index];
    if (step?.type !== 'problems') return false;
    next();
    return true;
  }

  // Put a part from the tray into a slot. The part must fit the slot.
  function place(trayId, slotId) {
    const step = steps[state.index];
    if (!step || step.type !== 'assemble') return { ok: false, ignored: true };
    const item = state.tray.find((x) => x.id === trayId && !x.used);
    const slot = step.slots.find((s) => s.id === slotId);
    if (!item || !slot || state.placed[slotId]) return { ok: false, ignored: true };
    if (item.part !== slot.part) {
      state.mistakes += 1;
      return { ok: false, reason: 'wrong-slot', part: item.part, slot: slot.part };
    }
    item.used = true;
    state.placed[slotId] = item.part;
    const complete = step.slots.every((s) => state.placed[s.id]);
    if (complete) next();
    return { ok: true, complete };
  }

  // The first free slot for a part, or null.
  function freeSlotFor(part) {
    const step = steps[state.index];
    return step?.slots?.find((s) => s.part === part && !state.placed[s.id]) ?? null;
  }

  enter();

  return {
    state,
    steps,
    get step() { return steps[state.index] ?? null; },
    get done() { return state.done; },
    useElement,
    finishProblems,
    place,
    freeSlotFor,
  };
}
