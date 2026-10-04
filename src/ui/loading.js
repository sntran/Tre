// The loading screen: the map of Vietnam on dó paper (the same drawing as the country map,
// src/ui/worldmap.js), from the tap that starts the game to the first frame of the world. A red
// seal marks the place of the start, a dashed road draws toward it, and the hero walks on the
// road with Nghé. The road is the real progress of the load (src/core/loading.js). Under the map
// one line names the place; after ten seconds it adds that the land is still not ready. At the
// end the screen fades into the world. No facts and no questions show here (docs/LOADING.md).
import { h } from './dom.js';
import { t } from './i18n.js';
import { C } from '../render/palette.js';
import { createProjection } from '../world/geo.js';
import { createLoadProgress, partOfLine, startTarget, roadTo } from '../core/loading.js';
import { drawBase, svgEl as el, SVG_NS } from './worldmap.js';
import { portraitImage, heroLookOf, speakerLookOf } from './portraits.js';

const MIN_VIEW = 4; // the smallest width of the view of the map (degrees of longitude)
const FADE_MS = 450;

// Show the loading screen at once, over the scenes. opts: profile (or null until it loads),
// practice (the activity of a practice link), map and at (the arrival of a travel), from (the
// region of the start of a travel). Returns { report(step, part), finish(), setProfile(p), progress }.
export function showLoading(ctx, opts = {}) {
  const { data } = ctx;
  const world = data.world;
  const geo = data.geo;
  const progress = createLoadProgress({ now: () => performance.now() });
  let profile = opts.profile ?? null;
  let target = startTarget(data, { ...opts, profile });

  const svg = el('svg', { class: 'loading-svg', xmlns: SVG_NS, preserveAspectRatio: 'xMidYMid meet', role: 'img', 'aria-label': t('ui.worldmap') });
  // The road and the hero are on a layer of their own over the map, so that the map is drawn one
  // time and a step of the road draws only this layer.
  const top = el('svg', { class: 'loading-svg loading-top', xmlns: SVG_NS, preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' });
  const inset = el('svg', { class: 'loading-inset', xmlns: SVG_NS, preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' });
  const line = h('p', { class: 'loading-line' });
  const slowLine = h('p', { class: 'loading-line slow', hidden: true });
  const layer = h('div', { class: 'loading-map', 'aria-live': 'polite' }, [
    h('div', { class: 'loading-sheet' }, [svg, top, inset]),
    line,
    slowLine,
  ]);
  (ctx.ui.parentElement ?? document.body).append(layer);

  const proj = createProjection(geo.bbox);
  const chapter = world.region(target.region)?.chapter;
  const eraSouth = world.eraLand?.byChapter?.[chapter] ?? geo.bbox.lat0;
  drawBase(svg, ctx, proj, eraSouth);

  // The road, the seal of the place, and the hero with Nghé on top of the map.
  const roadBack = el('path', { fill: 'none', stroke: C.diep, 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' });
  const road = el('path', { fill: 'none', stroke: C.vermilion, 'stroke-width': 3.5, 'stroke-dasharray': '7 5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' });
  const seal = el('g', { class: 'loading-seal' });
  const walker = el('g', { class: 'loading-walker' });
  top.append(roadBack, road, seal, walker);

  // The small map of the whole country, with a red frame on the part that the big map shows.
  const all = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const vnm = geo.land.VNM.map((r) => r.map(proj.toMap));
  for (const ring of vnm) for (const p of ring) {
    all.x0 = Math.min(all.x0, p.x); all.y0 = Math.min(all.y0, p.y);
    all.x1 = Math.max(all.x1, p.x); all.y1 = Math.max(all.y1, p.y);
  }
  inset.setAttribute('viewBox', `${all.x0 - 4} ${all.y0 - 4} ${all.x1 - all.x0 + 8} ${all.y1 - all.y0 + 8}`);
  inset.append(el('path', { d: vnm.map((r) => `M${r.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('L')}Z`).join(''), fill: C.diep, stroke: C.ink, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));
  const frame = el('rect', { fill: 'none', stroke: C.vermilion, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' });
  inset.append(frame);

  let points = [];
  let view = null;
  const unitsPerPx = () => (view ? Math.max(view.w / (svg.clientWidth || 1), view.h / (svg.clientHeight || 1)) : 1);
  const face = { hero: null, nghe: null };

  // The road and the view for the target now.
  function layout() {
    points = roadTo(world, target, opts.from ?? null).map(proj.toMap);
    const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (const p of points) {
      box.x0 = Math.min(box.x0, p.x); box.y0 = Math.min(box.y0, p.y);
      box.x1 = Math.max(box.x1, p.x); box.y1 = Math.max(box.y1, p.y);
    }
    const end = points[points.length - 1];
    const minW = proj.toMap([geo.bbox.lon0 + MIN_VIEW, 0]).x - proj.toMap([geo.bbox.lon0, 0]).x;
    const aspect = (svg.clientHeight || 3) / (svg.clientWidth || 4);
    let w = Math.max(minW, (box.x1 - box.x0) * 1.5, ((box.y1 - box.y0) * 1.5) / aspect);
    const cx = (box.x0 + box.x1) / 2;
    const cy = (box.y0 + box.y1) / 2;
    view = { x: cx - w / 2, y: cy - (w * aspect) / 2, w, h: w * aspect };
    for (const s of [svg, top]) s.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    frame.setAttribute('x', view.x);
    frame.setAttribute('y', view.y);
    frame.setAttribute('width', view.w);
    frame.setAttribute('height', view.h);
    roadBack.setAttribute('d', dOf(points));
    // The seal of the place of the start: a red square stamp with a thin inner line.
    const k = unitsPerPx();
    const r = 13 * k;
    seal.replaceChildren(
      el('rect', { x: end.x - r, y: end.y - r, width: r * 2, height: r * 2, rx: r * 0.2, fill: C.vermilion, stroke: C.ink, 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke' }),
      el('rect', { x: end.x - r * 0.72, y: end.y - r * 0.72, width: r * 1.44, height: r * 1.44, fill: 'none', stroke: C.diep, 'stroke-width': 1.2, 'vector-effect': 'non-scaling-stroke' }),
    );
    const name = el('text', { x: end.x + r * 1.4, y: end.y + r * 0.4, 'font-size': 17 * k, class: 'place-name big' });
    name.textContent = target.name;
    seal.append(name);
    drawWalker();
  }

  // The hero and Nghé: two round faces at the end of the drawn road (a red diamond until the
  // portraits are ready).
  function drawWalker() {
    const k = unitsPerPx();
    const r = 15 * k;
    walker.replaceChildren();
    const one = (href, dx, size, id) => {
      const g = el('g', { transform: `translate(${dx} 0)` });
      if (href) {
        g.append(el('clipPath', { id }, [el('circle', { cx: 0, cy: -size, r: size * 0.92 })]));
        g.append(el('circle', { cx: 0, cy: -size, r: size, fill: C.diep, stroke: C.ink, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }));
        g.append(el('image', { href, x: -size, y: -size * 2, width: size * 2, height: size * 2, 'clip-path': `url(#${id})` }));
      } else {
        const d = size * 0.45;
        g.append(el('path', { d: `M0,${-d * 2}L${d},${-d}L0,0L${-d},${-d}Z`, fill: C.vermilion, stroke: C.ink, 'stroke-width': 1.2, 'vector-effect': 'non-scaling-stroke' }));
      }
      return g;
    };
    const step = el('g', { class: 'loading-step' });
    step.append(one(face.nghe, -r * 1.5, r * 0.8, 'loading-nghe'), one(face.hero, 0, r, 'loading-hero'));
    walker.append(step);
    place();
  }

  function setLine() {
    line.textContent = t('loading.going', { place: target.name });
    slowLine.textContent = t('loading.slow');
  }

  // Draw the road up to the progress, and put the hero at its end.
  let drawnAt = -1;
  function place() {
    const p = progress.progress;
    const part = partOfLine(points, p);
    road.setAttribute('d', dOf(part));
    const at = part[part.length - 1];
    walker.setAttribute('transform', `translate(${at.x} ${at.y})`);
    drawnAt = p;
  }

  function loadFaces() {
    if (!profile) return;
    portraitImage(ctx, heroLookOf(ctx, profile.hero), { size: 64 }).then((c) => {
      if (c && alive) { face.hero = c.toDataURL(); drawWalker(); }
    }).catch(() => {});
    portraitImage(ctx, speakerLookOf(ctx, 'nghe'), { size: 64 }).then((c) => {
      if (c && alive) { face.nghe = c.toDataURL(); drawWalker(); }
    }).catch(() => {});
  }

  let alive = true;
  let raf = 0;
  function tick() {
    if (!alive) return;
    if (progress.progress !== drawnAt) place();
    if (progress.slow && slowLine.hidden) slowLine.hidden = false;
    raf = requestAnimationFrame(tick);
  }

  setLine();
  layout();
  // The faces render after the first frame of the screen, so that the screen shows at once. The
  // load waits for this frame too (painted).
  let onPaint = null;
  const painted = new Promise((r) => { onPaint = r; });
  requestAnimationFrame(() => {
    progress.shown();
    setTimeout(() => {
      onPaint();
      loadFaces();
    }, 0);
  });
  raf = requestAnimationFrame(tick);
  const offLang = ctx.bus?.on?.('lang', setLine);
  const onResize = () => layout();
  window.addEventListener('resize', onResize);

  return {
    // A promise: the first frame of the screen is on the screen.
    painted,
    report(step, part = 0) {
      progress.report(step, part);
    },
    // The profile is known (a tap on a profile card loads it after the tap).
    setProfile(p) {
      if (!p || p === profile) return;
      profile = p;
      target = startTarget(data, { ...opts, profile });
      setLine();
      layout();
      requestAnimationFrame(() => setTimeout(loadFaces, 0));
    },
    get progress() { return progress.progress; },
    get step() { return progress.step; },
    get finished() { return progress.finished; },
    times: () => progress.times(),
    // The world is drawn: the road reaches the seal, and the screen fades into the world.
    finish() {
      if (!alive) return;
      progress.finish();
      place();
      alive = false;
      cancelAnimationFrame(raf);
      offLang?.();
      window.removeEventListener('resize', onResize);
      layer.classList.add('out');
      setTimeout(() => layer.remove(), FADE_MS);
    },
  };
}

const dOf = (pts) => (pts.length ? `M${pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('L')}` : '');
