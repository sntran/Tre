// The loading screen: the map of Vietnam on dó paper (the same drawing as the country map,
// src/ui/worldmap.js, with softer colors of the regions), from the tap that starts the game to the
// first frame of the world. It opens on the whole country and zooms slowly toward the place of the
// start; in the last part of the zoom a dashed road draws toward it with the hero and Nghé on it,
// and a red seal marks the place at the end. The zoom and the road are the real progress of the
// load (src/core/loading.js). Under the map
// one line names the place; after ten seconds it adds that the land is still not ready. At the
// end the screen fades into the world. No facts and no questions show here (docs/LOADING.md).
import { h } from './dom.js';
import { t } from './i18n.js';
import { C } from '../render/palette.js';
import { createProjection } from '../world/geo.js';
import { createLoadProgress, partOfLine, startTarget, roadTo, zoomView, boxOf } from '../core/loading.js';
import { drawBase, svgEl as el, SVG_NS } from './worldmap.js';
import { portraitImage, heroLookOf, speakerLookOf } from './portraits.js';

const MIN_VIEW = 4; // the smallest width of the view of the map (degrees of longitude)
const FADE_MS = 450;
const HOLD_MS = 500; // the last view, with the seal, before the fade
const EASE = 2.5; // the shown progress comes to the real progress at this rate (each second)

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
  drawBase(svg, ctx, proj, eraSouth, { soft: true });

  // The road, the seal of the place, and the hero with Nghé on top of the map.
  const roadBack = el('path', { fill: 'none', stroke: C.diep, 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' });
  const road = el('path', { fill: 'none', stroke: C.vermilion, 'stroke-width': 3.5, 'stroke-dasharray': '7 5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' });
  const seal = el('g', { class: 'loading-seal' });
  const walker = el('g', { class: 'loading-walker' });
  top.append(roadBack, road, seal, walker);

  // The small map of the whole country, with a red frame on the part that the big map shows.
  const land = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const vnm = geo.land.VNM.map((r) => r.map(proj.toMap));
  for (const ring of vnm) for (const p of ring) {
    land.x0 = Math.min(land.x0, p.x); land.y0 = Math.min(land.y0, p.y);
    land.x1 = Math.max(land.x1, p.x); land.y1 = Math.max(land.y1, p.y);
  }
  inset.setAttribute('viewBox', `${land.x0 - 4} ${land.y0 - 4} ${land.x1 - land.x0 + 8} ${land.y1 - land.y0 + 8}`);
  inset.append(el('path', { d: vnm.map((r) => `M${r.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('L')}Z`).join(''), fill: C.diep, stroke: C.ink, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));
  const frame = el('rect', { fill: 'none', stroke: C.vermilion, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' });
  inset.append(frame);

  let points = [];
  let all = null; // the view of the whole country
  let end = null; // the view of the road and the place of the start
  let view = null; // the view now
  let shown = 0; // the progress that the view shows (it follows the real progress softly)
  const face = { hero: null, nghe: null };
  const aspect = () => (svg.clientHeight || 3) / (svg.clientWidth || 4);
  // Screen pixels to map units in the view now.
  const unitsPerPx = () => (view ? view.w / (svg.clientWidth || 1) : 1);

  // The road, the seal, and the two views for the target now.
  function layout() {
    points = roadTo(world, target, opts.from ?? null).map(proj.toMap);
    const minW = proj.toMap([geo.bbox.lon0 + MIN_VIEW, 0]).x - proj.toMap([geo.bbox.lon0, 0]).x;
    // The views stay on the sheet in the west and the north (the land of the other countries ends
    // at its edges); past the east and the south there is only sea.
    const onSheet = (v) => ({ ...v, x: Math.max(0, v.x), y: Math.max(0, v.y) });
    all = onSheet(boxOf(vnm.flat(), aspect(), 1.08));
    end = onSheet(boxOf(points, aspect(), 1.5, minW));
    roadBack.setAttribute('d', dOf(points));
    // The seal of the place of the start: a red square stamp with a thin inner line, in screen
    // pixels (the group scales with the view).
    const r = 13;
    seal.replaceChildren(
      el('rect', { x: -r, y: -r, width: r * 2, height: r * 2, rx: r * 0.2, fill: C.vermilion, stroke: C.ink, 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke' }),
      el('rect', { x: -r * 0.72, y: -r * 0.72, width: r * 1.44, height: r * 1.44, fill: 'none', stroke: C.diep, 'stroke-width': 1.2, 'vector-effect': 'non-scaling-stroke' }),
    );
    const name = el('text', { x: r * 1.4, y: r * 0.4, 'font-size': 17, class: 'place-name big' });
    name.textContent = target.name;
    seal.append(name);
    drawWalker();
  }

  // The hero and Nghé: two round faces at the end of the drawn road (a red diamond until the
  // portraits are ready), in screen pixels.
  function drawWalker() {
    const r = 15;
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

  // The view, the road, the hero, and the seal for the shown progress.
  let drawnAt = -1;
  function place() {
    const v = zoomView(all, end, shown);
    view = v;
    for (const s of [svg, top]) s.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
    frame.setAttribute('x', v.x);
    frame.setAttribute('y', v.y);
    frame.setAttribute('width', v.w);
    frame.setAttribute('height', v.h);
    const k = unitsPerPx();
    const part = partOfLine(points, v.road);
    road.setAttribute('d', dOf(part));
    roadBack.setAttribute('opacity', v.road > 0 ? 1 : 0);
    const at = part[part.length - 1];
    walker.setAttribute('transform', `translate(${at.x} ${at.y}) scale(${k})`);
    walker.setAttribute('opacity', v.road > 0 ? 1 : 0);
    const last = points[points.length - 1];
    seal.setAttribute('transform', `translate(${last.x} ${last.y}) scale(${k})`);
    seal.setAttribute('opacity', v.seal);
    drawnAt = shown;
  }

  function setLine() {
    line.textContent = t('loading.going', { place: target.name });
    slowLine.textContent = t('loading.slow');
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
  let last = performance.now();
  function tick() {
    if (!alive) return;
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;
    // The shown progress follows the real progress softly (also when the frames are far apart
    // while the load works), and never goes back.
    shown = Math.max(shown, progress.progress - (progress.progress - shown) * Math.exp(-dt * EASE));
    if (Math.abs(shown - drawnAt) > 0.002) place();
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
      shown = 1;
      place();
      alive = false;
      cancelAnimationFrame(raf);
      offLang?.();
      window.removeEventListener('resize', onResize);
      // The last view (the whole road and the seal) stays for a moment, then fades.
      setTimeout(() => {
        layer.classList.add('out');
        setTimeout(() => layer.remove(), FADE_MS);
      }, HOLD_MS);
    },
  };
}

const dOf = (pts) => (pts.length ? `M${pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('L')}` : '');
