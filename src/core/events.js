// A small event bus. Battle, quests, and sound stay separate:
// they send and get events, and they do not call each other.

export function createBus() {
  const handlers = new Map();

  function on(type, fn) {
    if (!handlers.has(type)) handlers.set(type, new Set());
    handlers.get(type).add(fn);
    return () => off(type, fn);
  }

  function off(type, fn) {
    handlers.get(type)?.delete(fn);
  }

  function once(type, fn) {
    const stop = on(type, (payload) => {
      stop();
      fn(payload);
    });
    return stop;
  }

  // Handlers of "*" get all events as (type, payload).
  function emit(type, payload) {
    for (const fn of [...(handlers.get(type) ?? [])]) fn(payload);
    for (const fn of [...(handlers.get('*') ?? [])]) fn(type, payload);
  }

  function clear() {
    handlers.clear();
  }

  return { on, off, once, emit, clear };
}
