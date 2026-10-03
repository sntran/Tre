// The registry of props: each kind of thing in the world is a function that writes blocks.
// buildProp() runs one of them with a seed, and returns its box and its roofs.
import { propContext } from './context.js';
import { house, giongHouse, dinh, hut, school, forge } from './houses.js';
import { tree, banyan, bamboo, banana, herbs, bush, areca } from './plants.js';
import { well, haystack, coop, rock, ore, boat, signpost, gate, fence, riceStack, vanmieuGate, stele } from './things.js';

export const PROPS = Object.freeze({
  house, 'giong-house': giongHouse, dinh, hut, school, forge,
  tree, banyan, bamboo, banana, herbs, bush, areca,
  well, haystack, coop, rock, ore, boat, signpost, gate, fence, 'rice-stack': riceStack,
  'vanmieu-gate': vanmieuGate, stele,
});

// Build one prop into the fine grid.
// world: { fine, groundTop(fx, fz), shadow(cx, cz) }. prop: { kind, fx, fz, fw, fd, seed, ... }.
// who: the number of the object (for the fade of things in front of the hero).
// Return { box, roofs, smooth, info } (box in fine units, or null for a prop with no blocks).
export function buildProp(world, prop, who) {
  const fn = PROPS[prop.kind];
  if (!fn) throw new Error(`Unknown prop ${prop.kind}`);
  const ctx = propContext(world.fine, world.groundTop, world.shadow, { who, seed: prop.seed ?? 1 });
  fn(ctx, prop);
  return { ...ctx.result(), info: ctx.info ?? null };
}
