// The country map on dó paper, drawn from the real map data (data/geo/vietnam.json): the coast,
// the rivers, the mountains, and the 13 regions of the story. The map shows the land of the era:
// the land to the south of it is faint and has no names. A region that is not open yet has a red
// seal. The hero can travel to an open region; the travel takes game hours and has road events.
import { registerModal } from './registry.js';
import { h, img, button } from './dom.js';
import { t } from './i18n.js';
import { speak } from './speak.js';
import { say } from './dialogue.js';
import { conditionState } from '../core/game.js';
import { createRng } from '../core/rng.js';
import { portraitImage, heroLookOf } from './portraits.js';
import { C } from '../render/palette.js';
import { planTravel, applyTravel } from '../world/travel.js';
import { timeOfDay } from '../core/world/clock.js';
import { createProjection, regionAreas, layoutSeals, heightBand } from '../world/geo.js';

export const SVG_NS = 'http://www.w3.org/2000/svg';
const NS = SVG_NS;
const FILLS = [C.greenPale, C.yellowPale, C.vermilionPale];
const SOFT = 0.4; // the opacity of the colors of the regions on the loading screen
const SEAL_PX = 20; // the largest radius of a seal on the screen; a small map has smaller seals
const LABEL_PX = 15; // the size of a name on the screen

export function svgEl(tag, attrs = {}, children = []) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) node.setAttribute(k, v);
  for (const c of children) if (c) node.append(c);
  return node;
}

const el = svgEl;

const pathOf = (rings) => rings.map((r) => `M${r.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('L')}Z`).join('');

// The fixed parts of the map, made one time: land, regions, heights, rivers, and islands. The
// loading screen draws the same map (src/ui/loading.js).
// opts.soft: the loading screen: softer colors of the regions, so that the land, the rivers, the
// coast, and the road stand out, and the sea past the east and the south of the sheet (with no
// frame line at the edge of the sheet).
// The size of a tile of the paper grain on the map (map units).
const PAPER_TILE = 48;

export function drawBase(svg, ctx, proj, eraSouth, opts = {}) {
  const { data } = ctx;
  const geo = data.geo;
  const toMap = proj.toMap;
  const eraY = toMap([geo.bbox.lon0, eraSouth]).y;
  const defs = el('defs', {}, [
    el('clipPath', { id: 'era-land' }, [el('rect', { x: 0, y: 0, width: proj.width, height: eraY })]),
    el('clipPath', { id: 'era-south' }, [el('rect', { x: 0, y: eraY, width: proj.width, height: proj.height - eraY })]),
    // The heights cover the land of Vietnam; the grid does not reach far into the other lands.
    el('clipPath', { id: 'vn-land' }, [el('path', { d: pathOf(geo.land.VNM.map((r) => r.map(toMap))) })]),
    el('pattern', { id: 'sea-waves', width: 12, height: 12, patternUnits: 'userSpaceOnUse' }, [
      el('image', { href: 'art/pattern/waves.svg', width: 12, height: 12 }),
    ]),
    // The grain of the dó paper over the whole sheet, and a soft vignette at its edges (#8: the
    // look of the voxel print style).
    el('pattern', { id: 'paper-grain', width: PAPER_TILE, height: PAPER_TILE, patternUnits: 'userSpaceOnUse' }, [
      el('image', { href: 'art/paper.svg', width: PAPER_TILE, height: PAPER_TILE }),
    ]),
    el('radialGradient', { id: 'map-vignette', cx: '50%', cy: '50%', r: '72%' }, [
      el('stop', { offset: '60%', 'stop-color': C.paperDeep, 'stop-opacity': 0 }),
      el('stop', { offset: '100%', 'stop-color': C.wood, 'stop-opacity': 0.28 }),
    ]),
  ]);
  svg.append(defs);
  // The sheet of the map: the sea inside a frame; outside the frame is the paper of the panel.
  // With opts.soft (the loading screen), the sea goes on past the east and the south of the sheet:
  // there is only sea there, and the first view of the whole country is wider than the sheet.
  const sea = opts.soft ? 2 : 1;
  // The color of the sea under the waves, so that the sea shows before the picture of the waves loads.
  svg.append(el('rect', { x: 0, y: 0, width: proj.width * sea, height: proj.height * sea, fill: C.indigoPale }));
  svg.append(el('rect', { x: 0, y: 0, width: proj.width * sea, height: proj.height * sea, fill: 'url(#sea-waves)' }));

  const stroke = { stroke: C.ink, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round' };
  for (const code of ['CHN', 'LAO', 'KHM', 'THA']) {
    svg.append(el('path', { d: pathOf(geo.land[code].map((r) => r.map(toMap))), fill: C.paperDeep, ...stroke }));
  }
  const vnm = geo.land.VNM.map((r) => r.map(toMap));
  // The land of Vietnam: faint in all places first; the land of the era gets the regions on top.
  svg.append(el('path', { d: pathOf(vnm), fill: C.diep, ...stroke, stroke: C.ashLight }));

  const place = Object.fromEntries(geo.places.map((p) => [p.id, p]));
  const centers = data.world.regions.flatMap((r) => [place[r.place].at, ...(r.seeds ?? [])].map((at) => ({ id: r.id, ...toMap(at) })));
  const { areas, borders } = regionAreas(centers, vnm);
  const borderPath = borders.map(([a, b]) => `M${a.x.toFixed(2)},${a.y.toFixed(2)}L${b.x.toFixed(2)},${b.y.toFixed(2)}`).join('');
  const eraGroup = el('g', { 'clip-path': 'url(#era-land)' });
  const southGroup = el('g', { 'clip-path': 'url(#era-south)' });
  const regionPaths = new Map();
  for (const r of data.world.regions) {
    const d = pathOf(areas.get(r.id));
    const path = el('path', { d, fill: FILLS[r.chapter % FILLS.length], ...(opts.soft ? { 'fill-opacity': SOFT } : {}), class: 'region-area', 'data-region': r.id });
    eraGroup.append(path);
    southGroup.append(el('path', { d, fill: C.diep }));
    regionPaths.set(r.id, path);
  }
  // Only the borders between two regions; the coast is the line of the land below.
  eraGroup.append(el('path', { d: borderPath, fill: 'none', stroke: C.ink, 'stroke-width': 1.2, 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none' }));
  southGroup.append(el('path', { d: borderPath, fill: 'none', stroke: C.ashLight, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none' }));
  svg.append(southGroup, eraGroup);
  // The coast on top of the region areas.
  svg.append(el('path', { d: pathOf(vnm), fill: 'none', stroke: C.ink, 'stroke-width': 1.2, 'vector-effect': 'non-scaling-stroke', 'clip-path': 'url(#era-land)', 'pointer-events': 'none' }));
  svg.append(el('path', { d: pathOf(vnm), fill: 'none', stroke: C.ashLight, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke', 'clip-path': 'url(#era-south)', 'pointer-events': 'none' }));

  // Mountains: three flat tones from the grid of heights, with smooth edges, and hill marks.
  const e = geo.elevation;
  const corner = (row, col) => toMap([e.lon0 + (col + 0.5) * e.step, e.lat1 - (row + 0.5) * e.step]);
  const cell = (row, col) => {
    const a = toMap([e.lon0 + col * e.step, e.lat1 - row * e.step]);
    const b = toMap([e.lon0 + (col + 1) * e.step, e.lat1 - (row + 1) * e.step]);
    return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
  };
  const shade = el('g', { 'pointer-events': 'none', 'clip-path': 'url(#vn-land)' });
  for (const [level, alpha] of [[30, 0.07], [80, 0.07], [150, 0.07]]) {
    shade.append(el('path', { d: pathOf(heightBand(e.data, corner, level)), fill: C.ink, 'fill-opacity': alpha }));
  }
  let hills = '';
  e.data.forEach((row, r) => row.forEach((v, c) => {
    if (v < 60 || r % 2 || c % 2) return;
    const q = cell(r, c);
    const s = Math.min(1.6, 0.6 + v / 150);
    const x = q.x + q.w;
    const y = q.y + q.h;
    hills += `M${(x - s * 2).toFixed(1)},${y.toFixed(1)}Q${x.toFixed(1)},${(y - s * 2.4).toFixed(1)} ${(x + s * 2).toFixed(1)},${y.toFixed(1)}`;
  }));
  shade.append(el('path', { d: hills, fill: 'none', stroke: C.ink, 'stroke-width': 0.8, 'vector-effect': 'non-scaling-stroke', 'stroke-opacity': 0.55 }));
  svg.append(shade);

  // Rivers and lakes.
  const water = el('g', { 'pointer-events': 'none' });
  for (const lake of geo.lakes) water.append(el('path', { d: pathOf([lake.map(toMap)]), fill: C.indigoPale, stroke: C.indigo, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));
  for (const r of geo.rivers) {
    for (const line of r.lines) {
      const d = `M${line.map(toMap).map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('L')}`;
      water.append(el('path', { d, fill: 'none', stroke: C.indigo, 'stroke-width': r.id === 'hong' || r.id === 'mekong' ? 2.2 : 1.5, 'vector-effect': 'non-scaling-stroke', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    }
  }
  svg.append(water);

  // The roads (dashes of wood) and the river ways of travel. In the faint land they are faint too.
  const lineD = (line) => `M${line.map(toMap).map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('L')}`;
  const ways = { road: '', river: '' };
  const at = Object.fromEntries(geo.places.map((p) => [p.id, p.at]));
  for (const r of data.routes.routes) {
    if (at[r.from] && at[r.to]) ways[r.mode] += lineD([at[r.from], ...(r.via ?? []), at[r.to]]);
  }
  for (const [clip, faint] of [['era-land', false], ['era-south', true]]) {
    const g = el('g', { 'clip-path': `url(#${clip})`, 'pointer-events': 'none' });
    g.append(el('path', { d: ways.road, fill: 'none', stroke: faint ? C.ashLight : C.wood, 'stroke-width': 1.4, 'stroke-dasharray': '5 4', 'vector-effect': 'non-scaling-stroke' }));
    g.append(el('path', { d: ways.river, fill: 'none', stroke: faint ? C.ashLight : C.indigo, 'stroke-width': 1.4, 'stroke-dasharray': '2 3', 'vector-effect': 'non-scaling-stroke' }));
    svg.append(g);
  }

  // The islands of Vietnam in the sea: a dot for each small island, so that they show at any size.
  const islands = el('g', { 'pointer-events': 'none' });
  for (const ring of geo.land.VNM) {
    const lon = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    if (lon < 110.5) continue;
    const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    const m = toMap([lon, lat]);
    islands.append(el('circle', { cx: m.x, cy: m.y, r: 0.9, fill: C.paper, stroke: C.ink, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));
  }
  svg.append(islands);
  // The paper over the print: the grain multiplies the flat tones, as ink on dó paper.
  const sheet = { x: 0, y: 0, width: proj.width * sea, height: proj.height * sea, 'pointer-events': 'none' };
  svg.append(el('rect', { ...sheet, fill: 'url(#paper-grain)', opacity: 0.6, style: 'mix-blend-mode: multiply' }));
  if (!opts.soft) svg.append(el('rect', { ...sheet, fill: 'url(#map-vignette)' }));
  if (!opts.soft) svg.append(el('rect', { x: 0, y: 0, width: proj.width, height: proj.height, fill: 'none', stroke: C.ink, 'stroke-width': 2.5, 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none' }));
  return { regionPaths, eraY, place };
}

registerModal('worldmap', async (ctx, cmd = {}) => {
  // In a raid the map only pauses: one line says where the enemies are, and there is no travel.
  const pauseKey = cmd?.pauseKey ?? null;
  const { data, profile } = ctx;
  const world = data.world;
  const geo = data.geo;
  const state = conditionState(profile);
  const hereMap = world.map(profile.world?.map) ? profile.world.map : world.start.map;
  const here = world.regionOf(hereMap) ?? world.start.region;
  const chapter = world.region(here).chapter;
  const eraSouth = world.eraLand?.byChapter?.[chapter] ?? geo.bbox.lat0;
  const time = timeOfDay(profile.world?.clock ?? { minutes: 0 });
  const proj = createProjection(geo.bbox);
  const inEra = (region) => geo.places.find((p) => p.id === region.place).at[1] >= eraSouth;

  const plan = await new Promise((resolve) => {
    const layer = h('div', { class: 'modal-layer' });
    const close = (value = null) => {
      layer.remove();
      window.removeEventListener('keydown', onKey);
      resolve(value);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);

    const svg = el('svg', { class: 'country-svg', xmlns: NS, preserveAspectRatio: 'xMidYMid meet', role: 'img', 'aria-label': t('ui.worldmap') });
    const map = h('div', { class: 'country' }, [svg]);
    const zoom = (k) => setView(view.w * k, null, null);
    const tools = h('div', { class: 'country-tools' }, [
      button('+', () => zoom(0.7), { cls: 'icon-btn', aria: t('world.zoomin') }),
      button('−', () => zoom(1 / 0.7), { cls: 'icon-btn', aria: t('world.zoomout') }),
    ]);
    map.append(tools);
    const info = h('div', { class: 'region-info' });
    const panel = h('div', { class: 'panel worldmap' }, [
      h('div', { class: 'panel-head' }, [
        h('h2', { text: t('ui.worldmap') }),
        h('span', { class: 'world-time', text: t('world.time', { day: time.day, part: t(`time.${time.part}`) }) }),
        button(null, () => close(), { cls: 'icon-btn', icon: 'ui/close', aria: t('ui.close') }),
      ]),
      h('div', { class: 'worldmap-body' }, [map, info]),
    ]);
    layer.append(panel);
    layer.addEventListener('click', (e) => { if (e.target === layer) close(); });
    ctx.ui.append(layer);

    const base = drawBase(svg, ctx, proj, eraSouth);
    const wayLine = el('path', { fill: 'none', stroke: C.vermilion, 'stroke-width': 3.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none' });
    svg.append(wayLine);
    const labels = el('g', { class: 'country-labels', 'pointer-events': 'none' });
    const seals = el('g', { class: 'country-seals' });
    svg.append(labels, seals);

    // The view: the land of the era at the start. Pinch, the wheel, and the buttons zoom; a drag moves.
    const eraBox = { x: proj.toMap([101.8, 0]).x, y: proj.toMap([0, 23.7]).y, w: 0, h: 0 };
    eraBox.w = proj.toMap([109.6, 0]).x - eraBox.x;
    eraBox.h = proj.toMap([0, eraSouth - 0.6]).y - eraBox.y;
    const view = { ...eraBox };
    function setView(w, cx, cy) {
      const aspect = (svg.clientHeight || 1) / (svg.clientWidth || 1);
      const fitAll = Math.max(proj.width, proj.height / aspect);
      const nw = Math.max(eraBox.w / 3, Math.min(fitAll, w));
      const x = cx ?? view.x + view.w / 2;
      const y = cy ?? view.y + view.h / 2;
      view.w = nw;
      view.h = nw * aspect;
      // Keep the view on the sheet; a view larger than the sheet stays in the middle.
      const keep = (c, size, full) => (size >= full ? full / 2 : Math.max(size / 2, Math.min(full - size / 2, c)));
      view.x = keep(x, view.w, proj.width) - view.w / 2;
      view.y = keep(y, view.h, proj.height) - view.h / 2;
      svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
      drawTop();
    }
    const unitsPerPx = () => Math.max(view.w / (svg.clientWidth || 1), view.h / (svg.clientHeight || 1));

    let chosen = null;
    // The names of the places of the open regions, and the seals of all regions.
    function drawTop() {
      const k = unitsPerPx();
      labels.replaceChildren();
      seals.replaceChildren();
      const label = (at, text, bold = false) => {
        const m = proj.toMap(at);
        labels.append(el('circle', { cx: m.x, cy: m.y, r: 2.2 * k, fill: C.ink }));
        const tx = el('text', { x: m.x + 5 * k, y: m.y - 4 * k, 'font-size': LABEL_PX * k, class: bold ? 'place-name big' : 'place-name' });
        tx.textContent = text;
        labels.append(tx);
      };
      // The names of the places show only when the map is near, so that they have room.
      for (const r of world.regions) {
        if (!world.isOpen(r.id, state) || k > 0.2) continue;
        for (const id of r.places ?? []) {
          const p = base.place[id];
          if (p) label(p.at, p.name);
        }
      }
      for (const p of geo.places.filter((x) => x.kind === 'islands')) label(p.at, p.name, true);
      // The hero: a small red diamond at the real place of the hero on the plane.
      const heroEnt = profile.world?.entities?.find((e) => e.id === 'hero');
      const heroGeo = heroEnt ? world.geoAt(hereMap, heroEnt.position.x / 2, heroEnt.position.z / 2) : null;
      if (heroGeo) {
        const m = proj.toMap(heroGeo);
        const d = 5 * k;
        labels.append(el('path', { d: `M${m.x},${m.y - d}L${m.x + d},${m.y}L${m.x},${m.y + d}L${m.x - d},${m.y}Z`, fill: C.vermilion, stroke: C.ink, 'stroke-width': 1.2, 'vector-effect': 'non-scaling-stroke' }));
      }

      const anchors = world.regions.map((r) => ({ id: r.id, ...proj.toMap(base.place[r.place].at) }));
      const sealPx = Math.max(12, Math.min(SEAL_PX, (svg.clientHeight || 600) / 28));
      // The locked chapters near each other share one lock (#45): fewer seals, so that no lock
      // covers another lock or the face of the hero.
      const locked = (id) => id !== here && !world.isOpen(id, state);
      const groups = [];
      for (const a of anchors) {
        const near = locked(a.id) ? groups.find((q) => q.locked && Math.hypot(q.x - a.x, q.y - a.y) < sealPx * k * 4) : null;
        if (near) {
          near.ids.push(a.id);
          near.x += (a.x - near.x) / near.ids.length;
          near.y += (a.y - near.y) / near.ids.length;
        } else groups.push({ id: a.id, ids: [a.id], x: a.x, y: a.y, locked: locked(a.id) });
      }
      const laid = layoutSeals(groups, sealPx * k);
      for (const s of laid) {
        const region = world.region(s.id);
        const open = world.isOpen(s.id, state);
        const kind = s.id === here ? 'here' : open ? 'open' : 'locked';
        const r = sealPx * k;
        const chapters = groups.find((q) => q.id === s.id).ids.map((id) => world.region(id).chapter);
        const g = el('g', { class: `map-seal ${kind}${chosen === s.id ? ' selected' : ''}`, tabindex: 0, role: 'button',
          'aria-label': inEra(region) ? `${t(region.nameKey)}. ${t('world.chapter', { n: region.chapter })}` : chapters.map((n) => t('world.chapter', { n })).join(', ') });
        if (Math.hypot(s.x - s.ax, s.y - s.ay) > r * 0.6) {
          g.append(el('line', { x1: s.ax, y1: s.ay, x2: s.x, y2: s.y, stroke: C.ink, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));
          g.append(el('circle', { cx: s.ax, cy: s.ay, r: 2 * k, fill: C.ink }));
        }
        if (kind === 'locked') {
          g.append(el('rect', { x: s.x - r, y: s.y - r, width: r * 2, height: r * 2, rx: r * 0.2, fill: C.vermilion, stroke: C.ink, 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke' }));
          g.append(el('rect', { x: s.x - r * 0.78, y: s.y - r * 0.78, width: r * 1.56, height: r * 1.56, fill: 'none', stroke: C.diep, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }));
          g.append(el('image', { href: 'art/ui/lock.svg', x: s.x - r * 0.6, y: s.y - r * 0.6, width: r * 1.2, height: r * 1.2 }));
        } else {
          g.append(el('circle', { cx: s.x, cy: s.y, r, fill: C.diep, stroke: C.ink, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }));
          if (kind === 'here') {
            // The face of the hero: the rendered portrait of the hero (src/ui/portraits.js), in the seal.
            const clip = `seal-face-${s.id}`;
            g.append(el('clipPath', { id: clip }, [el('circle', { cx: s.x, cy: s.y, r: r * 0.9 })]));
            const face = el('image', { 'clip-path': `url(#${clip})`, x: s.x - r, y: s.y - r, width: r * 2, height: r * 2 });
            portraitImage(ctx, heroLookOf(ctx, profile.hero), { size: 64 }).then((c) => { if (c) face.setAttribute('href', c.toDataURL()); });
            g.append(face);
          } else {
            const n = el('text', { x: s.x, y: s.y + r * 0.35, 'font-size': r, 'text-anchor': 'middle', class: 'place-name big' });
            n.textContent = String(region.chapter);
            g.append(n);
          }
        }
        g.addEventListener('click', (ev) => { ev.stopPropagation(); select(region); });
        g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') select(region); });
        seals.append(g);
      }
    }

    function select(region) {
      chosen = region.id;
      for (const [id, p] of base.regionPaths) p.classList.toggle('selected', id === region.id);
      drawTop();
      const open = world.isOpen(region.id, state);
      const named = inEra(region) || open;
      const lines = [h('div', { class: 'region-chapter', text: t('world.chapter', { n: region.chapter }) })];
      if (named) lines.push(h('h3', { text: t(region.nameKey) }));
      // The way from the region of the hero, drawn in red, with its length and days.
      const way = region.id === here ? null : world.travelWay(here, region.id);
      wayLine.setAttribute('d', way ? way.legs.map((l) => `M${l.line.map((c) => proj.toMap(c)).map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('L')}`).join('') : '');
      if (way) lines.push(h('p', { class: 'region-way', text: t('world.way', { km: Math.round(way.km), days: Math.max(1, Math.ceil(world.travelHours(here, region.id) / 24)) }) }));
      if (region.id === here) lines.push(h('p', { text: t('world.here') }));
      else if (!open) lines.push(h('p', { text: t('world.locked') }));
      if (pauseKey) lines.push(h('p', { class: 'region-way', text: t(pauseKey) }));
      else if (open && region.id !== here) {
        const hours = world.travelHours(here, region.id);
        lines.push(button(t('world.travel', { hours }), () => {
          const rng = createRng(`${profile.seed}:${Math.round(profile.world.clock.minutes)}:${region.id}`);
          const p = planTravel(world, here, region.id, state, rng, data.roadEvents.events);
          if (p.ok) close(p);
        }, { cls: 'btn big red' }));
      }
      info.replaceChildren(...lines);
      speak(pauseKey ?? (named ? region.nameKey : 'world.locked'));
    }

    for (const [id, p] of base.regionPaths) p.addEventListener('click', () => select(world.region(id)));

    // Pan and zoom with pointers and the wheel.
    const pointers = new Map();
    let pinch = null;
    svg.addEventListener('pointerdown', (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), w: view.w };
      }
    });
    svg.addEventListener('pointermove', (e) => {
      const last = pointers.get(e.pointerId);
      if (!last) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        setView(pinch.w * (pinch.d / Math.max(10, Math.hypot(a.x - b.x, a.y - b.y))), null, null);
        return;
      }
      const k = unitsPerPx();
      const dx = (e.clientX - last.x) * k;
      const dy = (e.clientY - last.y) * k;
      if (Math.abs(dx) + Math.abs(dy) > 0) setView(view.w, view.x + view.w / 2 - dx, view.y + view.h / 2 - dy);
    });
    const up = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
    };
    svg.addEventListener('pointerup', up);
    svg.addEventListener('pointercancel', up);
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      setView(view.w * (e.deltaY > 0 ? 1.2 : 1 / 1.2), null, null);
    }, { passive: false });

    requestAnimationFrame(() => {
      // Start on the land of the era, around the hero.
      const aspect = (svg.clientHeight || 1) / (svg.clientWidth || 1);
      const heroAt = proj.toMap(base.place[world.region(here).place].at);
      setView(Math.max(eraBox.w, eraBox.h / aspect), eraBox.x + eraBox.w / 2, (eraBox.y + eraBox.h / 2 + heroAt.y) / 2);
      select(world.region(here));
    });
  });

  if (!plan) return;
  // The travel: the road events, one after the other, then the arrival.
  for (const e of plan.events) await say(ctx, e.textKey);
  applyTravel(profile, plan);
  await ctx.save('travel');
  await say(ctx, 'world.arrive', { hours: plan.hours });
  await ctx.go('village', { map: plan.entry.map, at: { x: plan.entry.x, y: plan.entry.y }, arrive: true, from: here });
});
