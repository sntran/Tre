// The module hooks of a test of the drawing code: 'three' gives a stand-in (tests/three-stub.js)
// with each name that src/render/ uses (THREE.Name).
import { readFileSync, readdirSync } from 'node:fs';

const STUB = 'tre:three-stub';

export async function resolve(specifier, context, next) {
  if (specifier === 'three') return { url: STUB, shortCircuit: true };
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url !== STUB) return next(url, context);
  const dir = new URL('../src/render/', import.meta.url);
  const names = new Set();
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.js')) continue;
    for (const m of readFileSync(new URL(f, dir), 'utf8').matchAll(/THREE\.(\w+)/g)) names.add(m[1]);
  }
  const stub = new URL('./three-stub.js', import.meta.url).href;
  const source = [`import stub from ${JSON.stringify(stub)};`, ...[...names].map((n) => `export const ${n} = stub;`)].join('\n');
  return { format: 'module', source, shortCircuit: true };
}
