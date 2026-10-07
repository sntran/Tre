// Element.append writes null or undefined as text: a line "null" showed in the parent area (#52).
// h() leaves out a child that is null, but append does not. This test finds each call of append
// in the screens whose arguments have a branch to null, undefined, or false at their top level
// (a ternary with null, or a && b).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const DIR = new URL('../src/ui/', import.meta.url);

// The text of the arguments of each call of .append( in a source, with the line of the call.
function appendCalls(src) {
  const out = [];
  const re = /\.append\(/g;
  let m;
  while ((m = re.exec(src))) {
    let i = m.index + 8;
    let depth = 1;
    while (depth && i < src.length) {
      if (src[i] === '(') depth += 1;
      else if (src[i] === ')') depth -= 1;
      i += 1;
    }
    // Only the text at the top level of the arguments (not inside calls, arrays, or objects).
    let top = '';
    let d = 0;
    for (const c of src.slice(m.index + 8, i - 1)) {
      if ('([{'.includes(c)) d += 1;
      else if (')]}'.includes(c)) d -= 1;
      else if (d === 0) top += c;
    }
    out.push({ line: src.slice(0, m.index).split('\n').length, top });
  }
  return out;
}

test('no call of append in the screens can get null, undefined, or false (#52)', () => {
  const bad = [];
  for (const f of readdirSync(DIR).filter((x) => x.endsWith('.js'))) {
    for (const c of appendCalls(readFileSync(new URL(f, DIR), 'utf8'))) {
      if (/:\s*(null|undefined|false)\b|&&/.test(c.top)) bad.push(`src/ui/${f}:${c.line}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('the check finds a branch to null in a call of append', () => {
  const [c] = appendCalls("body.append(h('p'), limit ? h('p', { text: t('x') }) : null);");
  assert.match(c.top, /:\s*null/);
});
