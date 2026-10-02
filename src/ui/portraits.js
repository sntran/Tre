// The portraits in the screens: a canvas that shows a rendered figure (src/render/portrait.js) when
// its image is ready. The renderer and three.js load on the first portrait. The looks come from
// data/figures.json, so that a new villager or a new creature gets its portrait with no new art.
import { h } from './dom.js';
import { heroLook } from '../world/figures.js';
import { speakerLook } from '../world/portraits.js';

let made = null;
function portraits(ctx) {
  made ??= import('../render/portrait.js').then((m) => m.createPortraits(ctx.voxel)).catch((err) => {
    console.warn('portraits', err);
    return null;
  });
  return made;
}

// The look of the hero of a profile (the current profile when hero is not given).
export function heroLookOf(ctx, hero = ctx.profile?.hero) {
  return hero ? heroLook(hero, ctx.data.figures.hero) : null;
}

// The look of a speaker of the dialogue data, or null (the narrator).
export function speakerLookOf(ctx, speaker) {
  return speakerLook(speaker, { figures: ctx.data.figures.figures, flags: ctx.profile?.flags ?? {}, hero: heroLookOf(ctx) });
}

// A canvas with the portrait of a look. opts: { framing (bust or full), mood, size (CSS pixels),
// cls }. The canvas is empty until the image is ready (in a frame or two).
export function portraitCanvas(ctx, look, { framing = 'bust', mood = 'calm', size = 96, cls = '', facing = null } = {}) {
  const c = h('canvas', { class: `portrait-img ${cls}`.trim(), 'aria-hidden': 'true' });
  c.width = 1;
  c.height = 1;
  c.style.width = `${size}px`;
  c.style.height = `${size}px`;
  if (!look) return c;
  portraits(ctx).then((p) => p?.image(look, { framing, mood, size, facing })).then((img) => {
    if (!img) return;
    c.width = img.width;
    c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
  });
  return c;
}

// The image of a portrait (a 2D canvas), for a drawing on another canvas (the country map).
export async function portraitImage(ctx, look, opts = {}) {
  const p = await portraits(ctx);
  return p && look ? p.image(look, opts) : null;
}

// Draw these portraits soon: list of { look, framing, mood, size }.
export function prerender(ctx, list) {
  portraits(ctx).then((p) => p?.prerender(list));
}

// For the tests on a device: { renders, lastMs, cached, queued }, or null.
export async function portraitStats(ctx) {
  return (await portraits(ctx))?.stats() ?? null;
}
