// The words that have a line of their own (#139: "Tiều phu? I don't know that word."): the first
// time that any line has such a word (a marker, a goal, a talk, a raid), the line of the word comes
// right after it. The words are in the texts of each language: "word.<id>.forms" (the forms of the
// word, with "|" between them) and "word.<id>" or "word.<id>.what" (its line). The flag
// word.<id> keeps the word as heard, as the word lines of the raids and the talks do. Pure: no DOM.

const LETTER = /[\p{L}\p{N}]/u;

// The words of a dictionary of texts: [{ id, line, forms }].
export function wordList(dict) {
  const out = [];
  for (const [key, value] of Object.entries(dict ?? {})) {
    const m = /^word\.([a-z0-9]+)\.forms$/.exec(key);
    if (!m) continue;
    const id = m[1];
    const line = `word.${id}.what` in dict ? `word.${id}.what` : `word.${id}`;
    if (!(line in dict)) continue;
    out.push({ id, line, forms: String(value).split('|').map((f) => f.trim().toLocaleLowerCase()).filter(Boolean) });
  }
  return out;
}

// Is a form a whole word of a text (lower case)? The index of the first one, or -1.
function wordAt(text, form) {
  for (let i = text.indexOf(form); i >= 0; i = text.indexOf(form, i + 1)) {
    const before = text[i - 1];
    const after = text[i + form.length];
    if ((!before || !LETTER.test(before)) && (!after || !LETTER.test(after))) return i;
  }
  return -1;
}

// The words of a text that the child did not hear yet: { say: the words whose line comes next,
// seen: the ids to keep as heard }. A text that is the line of a word, or that says what the word
// is ("đe là …", "an anvil is …"), makes the word heard with no line after it. flags: the flags of
// the profile; lineKey: the key of the text.
export function freshWords(text, list, flags = {}, lineKey = null) {
  const low = String(text ?? '').toLocaleLowerCase();
  const say = [];
  const seen = [];
  for (const w of list) {
    if (flags[`word.${w.id}`]) continue;
    const at = w.forms.map((f) => [f, wordAt(low, f)]).filter(([, i]) => i >= 0);
    if (!at.length) continue;
    seen.push(w.id);
    const told = w.line === lineKey || at.some(([f]) => [' là ', ' is ', ' are '].some((v) => low.includes(f + v)));
    if (!told) say.push(w);
  }
  return { say, seen };
}
