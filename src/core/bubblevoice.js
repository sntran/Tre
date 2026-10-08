// The voice of the bubbles (#60): each line of a person in a bubble is spoken in the voice of that
// person, so that a child who cannot read yet hears the hints and the counts of a task. Pure logic,
// no DOM: which key, which voice, and whether a line speaks now, waits for its turn, or goes.
//
// A line: { id (the entity that says it), key (the text key), params, voice (a voice profile),
// kind }. kind: 'count' (a word of a count: num.1, num.2, ...), 'greet' (a greeting of a person who
// walks by), or 'line' (a hint, a wait, and every other line of a person).

const COUNT = /^num\./;
const GREET = /^world\.greet\./;

// The kind of a line by its key.
export function kindOf(key) {
  if (COUNT.test(key)) return 'count';
  if (GREET.test(key)) return 'greet';
  return 'line';
}

// The speaker of a bubble: an NPC id (npc:fisher → fisher), a friend id (friend:nghe → nghe), or
// the entity id.
export function speakerOf(id) {
  const s = String(id ?? '');
  const i = s.indexOf(':');
  return i >= 0 ? s.slice(i + 1) : s;
}

// The line to speak for an event open of the screen callout (a bubble with text), or null.
// voice(speaker): the voice profile of a speaker (src/core/voices.js, voiceOf).
export function bubbleLine(ev, voice = () => 'narrator') {
  if (!ev || ev.screen !== 'callout' || !ev.textKey) return null;
  return { id: ev.id ?? null, key: ev.textKey, params: ev.params ?? {}, voice: voice(speakerOf(ev.id)), kind: kindOf(ev.textKey) };
}

const same = (a, b) => a.id === b.id && a.key === b.key && JSON.stringify(a.params) === JSON.stringify(b.params);
// The same words, from any person: two children who greet the hero at once ("Chào Tí! Chào Tí!"),
// or two villagers who say the same news (#67).
const sameWords = (a, b) => a.key === b.key && JSON.stringify(a.params) === JSON.stringify(b.params);
// Seconds: a line with the same words as a line that the voice said this short time ago goes (#67:
// each line of a bubble is spoken one time). The words of a count are never dropped.
export const SAID_AGAIN = 12;

// The queue of the lines of the bubbles. offer(line, speaking): speaking is true while the voice
// says something (a line of the talk box or of a bubble). Returns:
//   'now'  the line is the next to speak, at once;
//   'wait' the line waits for its turn (a hint, a wait, or a count while the voice is busy; the
//          words of a count keep their order, so that one number never cuts the last one);
//   'drop' a greeting while the voice is busy, or the same line that already waits.
//   A line with the same words as a line that waits, or as a line that the voice said in the last
//   SAID_AGAIN seconds, also goes (not a word of a count).
// next(speaking): the line to speak now, or null while the voice is busy or nothing waits.
// now: the time in seconds (null: no memory of the lines that the voice said).
export function createVoiceQueue() {
  const queue = [];
  const said = []; // { line, at }: the lines that the voice said
  return {
    offer(line, speaking = false, now = null) {
      if (!line) return 'drop';
      if (line.kind === 'greet' && (speaking || queue.length)) return 'drop';
      if (queue.some((q) => same(q, line))) return 'drop';
      if (line.kind !== 'count') {
        if (queue.some((q) => sameWords(q, line))) return 'drop';
        if (now !== null && said.some((x) => sameWords(x.line, line) && now - x.at < SAID_AGAIN)) return 'drop';
      }
      // A newer hint of the same person takes the place of an older hint that still waits.
      if (line.kind === 'line') {
        for (let i = queue.length - 1; i >= 0; i--) if (queue[i].id === line.id && queue[i].kind === 'line') queue.splice(i, 1);
      }
      queue.push(line);
      return !speaking && queue.length === 1 ? 'now' : 'wait';
    },
    next(speaking = false, now = null) {
      const line = speaking ? null : queue.shift() ?? null;
      if (line && now !== null) {
        said.push({ line, at: now });
        while (said.length && now - said[0].at >= SAID_AGAIN) said.shift();
      }
      return line;
    },
    waiting: (id, key) => queue.some((q) => q.id === id && (key === undefined || q.key === key)),
    size: () => queue.length,
    clear: () => { queue.length = 0; },
  };
}
