// A small finite state machine for scenes and battle turns.
// Only the events in the table can change the state. Other events do nothing.
//
// createMachine({
//   initial: 'idle',
//   states: {
//     idle: { on: { START: 'running' } },
//     running: { on: { STOP: { target: 'idle', guard: (ctx, data) => true, action: (ctx, data) => {} } },
//                enter: (ctx, data) => {}, exit: (ctx, data) => {} },
//   },
//   context: {},
// })

export function createMachine({ initial, states, context = {} }) {
  if (!states[initial]) throw new Error(`Unknown initial state: ${initial}`);
  for (const [name, def] of Object.entries(states)) {
    for (const [event, rule] of Object.entries(def.on ?? {})) {
      const target = typeof rule === 'string' ? rule : rule.target;
      if (target !== undefined && !states[target]) {
        throw new Error(`State "${name}", event "${event}": unknown target "${target}"`);
      }
    }
  }

  let current = initial;
  const listeners = new Set();

  function rule(event) {
    const r = states[current].on?.[event];
    if (r === undefined) return null;
    return typeof r === 'string' ? { target: r } : r;
  }

  function can(event, data) {
    const r = rule(event);
    if (!r) return false;
    return r.guard ? Boolean(r.guard(context, data)) : true;
  }

  // Send an event. Return true when the machine accepted the event.
  function send(event, data) {
    if (!can(event, data)) return false;
    const r = rule(event);
    const from = current;
    const to = r.target ?? current;
    if (to !== from) states[from].exit?.(context, data);
    r.action?.(context, data);
    current = to;
    if (to !== from) states[to].enter?.(context, data);
    for (const fn of listeners) fn({ from, to, event, data });
    return true;
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  states[initial].enter?.(context, undefined);

  return {
    get state() { return current; },
    context,
    can,
    send,
    onChange,
    is: (name) => current === name,
  };
}
