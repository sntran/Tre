// The portraits in the screens: a canvas that shows a rendered figure (src/render/portrait.js) when
// its image is ready. The renderer and three.js load on the first portrait. The looks come from
// data/figures.json, so that a new villager or a new creature gets its portrait with no new art.
import { h } from './dom.js';
import { heroLook } from '../world/figures.js';
import { speakerLook } from '../world/portraits.js';
import { retryDraw, DRAW_TRIES } from './retry.js';

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
  // A portrait that did not render (a busy or lost context) tries again with a growing wait, so
  // that the face in a talk box and a print are never empty (#67, #162). While it waits, the box
  // shows an outline of a thing. A canvas on the screen tries until it draws; a canvas that is not
  // on the screen (yet, or any more) stops after DRAW_TRIES.
  outline(c, size);
  retryDraw(() => portraits(ctx).then((p) => p?.image(look, { framing, mood, size, facing })).then((img) => {
    if (!img) return false;
    c.width = img.width;
    c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    c.classList.remove('portrait-wait');
    return true;
  }), { alive: (n) => c.isConnected || n < DRAW_TRIES });
  return c;
}

// The outline of a thing that waits for its picture: a soft round shape on a line of ground.
function outline(c, size) {
  const px = Math.max(8, Math.round(size * Math.min(globalThis.devicePixelRatio || 1, 2)));
  c.width = px;
  c.height = px;
  c.classList.add('portrait-wait');
  const g = c.getContext?.('2d');
  if (!g) return;
  g.strokeStyle = 'rgba(90, 70, 50, 0.45)';
  g.lineWidth = Math.max(1, px / 24);
  g.beginPath();
  g.ellipse(px / 2, px * 0.52, px * 0.28, px * 0.24, 0, 0, Math.PI * 2);
  g.moveTo(px * 0.14, px * 0.82);
  g.lineTo(px * 0.86, px * 0.82);
  g.stroke();
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
