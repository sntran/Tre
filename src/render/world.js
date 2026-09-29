// Draw the isometric world on the canvas: the ground (made into bitmap pieces once),
// then objects, people, and the hero in depth order, then markers.
// World units are the screen units of grid.js: one tile is 64 wide and 32 tall.
import { C } from './palette.js';
import { bitmap } from './assets.js';
import { toScreen, spriteBox, mapBounds, TILE_W, TILE_H } from '../iso/grid.js';
import { depthSort } from '../iso/depth.js';
import { createRng } from '../core/rng.js';
import { edgeMarker } from '../core/hit.js';

// Groups of ground types. A keyline shows where two groups meet.
const GROUP = { grass: 'g', flowers: 'g', hedge: 'g', path: 'p', yard: 'y', sand: 's', bridge: 'b', water: 'w', shallow: 'w', field: 'f' };
const CHUNK = 512; // the size of one ground piece, in world units

export async function createWorldRenderer(mapData, tileMap, tileTypes) {
  const W = mapData.width;
  const H = mapData.height;
  const bounds = mapBounds(W, H);
  const rng = createRng(mapData.id);

  // The picture of each ground tile, picked once.
  const tileArt = new Map();
  for (const t of Object.values(tileTypes)) for (const a of t.art ?? []) tileArt.set(a, null);
  await Promise.all([...tileArt.keys()].map(async (a) => tileArt.set(a, await bitmap(a, 2))));
  const pick = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const list = tileTypes[tileMap.type(x, y)]?.art ?? [];
      pick.push(list.length ? tileArt.get(list[rng.int(0, list.length - 1)]) : null);
    }
  }
  const paper = await bitmap('paper', 1);

  // The ground pieces. Each piece is made when it first comes into view.
  const scale = Math.min(2, window.devicePixelRatio || 1) >= 2 ? 1.5 : 1;
  const chunks = new Map();
  function chunk(cx, cy) {
    const key = `${cx},${cy}`;
    if (chunks.has(key)) return chunks.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(CHUNK * scale);
    canvas.height = Math.ceil(CHUNK * scale);
    const g = canvas.getContext('2d');
    g.scale(scale, scale);
    g.translate(-cx * CHUNK, -cy * CHUNK);
    drawGround(g, cx * CHUNK, cy * CHUNK, CHUNK, CHUNK);
    chunks.set(key, canvas);
    return canvas;
  }

  // The tiles whose diamond meets a rectangle of the world.
  function tilesIn(left, top, width, height, fn) {
    // The map point of each corner gives the range of x and y.
    const pts = [[left, top], [left + width, top], [left, top + height], [left + width, top + height]].map(([sx, sy]) => ({
      x: (sx / 32 + sy / 16) / 2,
      y: (sy / 16 - sx / 32) / 2,
    }));
    const x0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.x))) - 1);
    const x1 = Math.min(W - 1, Math.ceil(Math.max(...pts.map((p) => p.x))) + 1);
    const y0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.y))) - 1);
    const y1 = Math.min(H - 1, Math.ceil(Math.max(...pts.map((p) => p.y))) + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) fn(x, y);
  }

  function diamondPath(g, x, y) {
    const n = toScreen(x, y);
    g.moveTo(n.x, n.y);
    g.lineTo(n.x + TILE_W / 2, n.y + TILE_H / 2);
    g.lineTo(n.x, n.y + TILE_H);
    g.lineTo(n.x - TILE_W / 2, n.y + TILE_H / 2);
    g.closePath();
  }

  function drawGround(g, left, top, width, height) {
    g.fillStyle = C.greenDeep;
    g.fillRect(left, top, width, height);
    tilesIn(left, top, width, height, (x, y) => {
      const n = toScreen(x, y);
      const art = pick[y * W + x];
      if (art) {
        // A little overlap hides the thin seams between tiles.
        g.drawImage(art, n.x - TILE_W / 2 - 0.5, n.y - 0.5, TILE_W + 1, TILE_H + 1);
      } else {
        g.fillStyle = C.greenPale;
        g.beginPath();
        diamondPath(g, x, y);
        g.fill();
      }
    });
    // Keylines where two ground groups meet: on the south-east and the south-west edge of a tile.
    g.strokeStyle = C.ink;
    g.lineWidth = 2;
    g.lineCap = 'round';
    g.beginPath();
    tilesIn(left, top, width, height, (x, y) => {
      const a = GROUP[tileMap.type(x, y)];
      if (x + 1 < W && a !== GROUP[tileMap.type(x + 1, y)]) {
        const p = toScreen(x + 1, y);
        const q = toScreen(x + 1, y + 1);
        g.moveTo(p.x, p.y);
        g.lineTo(q.x, q.y);
      }
      if (y + 1 < H && a !== GROUP[tileMap.type(x, y + 1)]) {
        const p = toScreen(x, y + 1);
        const q = toScreen(x + 1, y + 1);
        g.moveTo(p.x, p.y);
        g.lineTo(q.x, q.y);
      }
    });
    g.stroke();
    // The dó paper texture over the ground.
    g.save();
    g.globalAlpha = 0.3;
    g.globalCompositeOperation = 'multiply';
    const pattern = g.createPattern(paper, 'repeat');
    g.fillStyle = pattern;
    g.fillRect(left, top, width, height);
    g.restore();
  }

  // The tall things that stand on the map: objects, and a bamboo on each hedge tile.
  const statics = [];
  for (const o of mapData.layers.objects) {
    const bmp = await bitmap(o.art, 2);
    const d = o.depth ?? [0, 0, o.w, o.h];
    const box = spriteBox(o.x, o.y, o.w, o.h, bmp.unitH);
    statics.push({
      id: o.id, bmp, rect: box,
      x0: o.x + d[0], y0: o.y + d[1], x1: o.x + d[2], y1: o.y + d[3],
    });
  }
  const spriteArt = new Map();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const art = tileTypes[tileMap.type(x, y)]?.sprite;
      if (!art) continue;
      if (!spriteArt.has(art)) spriteArt.set(art, await bitmap(art, 2));
      const bmp = spriteArt.get(art);
      statics.push({ id: null, bmp, rect: spriteBox(x, y, 1, 1, bmp.unitH), x0: x, y0: y, x1: x + 1, y1: y + 1 });
    }
  }
  const star = await bitmap('ui/star', 2);

  const overlaps = (r, v) => r.left < v.left + v.width && r.left + r.width > v.left && r.top < v.top + v.height && r.top + r.height > v.top;

  // A person: feet at the map point (x, y). The picture stands up from the feet.
  function drawPerson(ctx, s, t) {
    const p = toScreen(s.x, s.y);
    const w = s.bmp.unitW * s.scale;
    const h = s.bmp.unitH * s.scale;
    const bob = s.walking ? Math.abs(Math.sin(t * 12)) * 3 : 0;
    const sink = s.sink ?? 0;
    ctx.fillStyle = 'rgba(31, 27, 23, 0.22)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, w * 0.3, w * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    if (sink) {
      // In the water: hide the feet.
      ctx.beginPath();
      ctx.rect(p.x - w, p.y - h - 20, w * 2, h + 20 - sink);
      ctx.clip();
    }
    ctx.translate(p.x, p.y - bob + sink);
    if (s.flip) ctx.scale(-1, 1);
    ctx.drawImage(s.bmp, -w / 2, -h, w, h);
    ctx.restore();
  }

  // Draw one frame.
  // scene: { camera, people: [{ id, bmp, x, y, scale, flip, walking, sink }], markers: [{ x, y, z }],
  //          tap: { x, y, age }, inset, stick: { x, y, kx, ky } (screen units) }
  // Return the draw list (front last), for taps.
  function draw(surface, scene, t) {
    const { ctx } = surface;
    const cam = scene.camera;
    surface.clear(C.greenDeep);
    ctx.save();
    ctx.translate(surface.width / 2, surface.height / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);
    const v = cam.view();

    // The ground pieces in view.
    const cx0 = Math.floor(v.left / CHUNK);
    const cx1 = Math.floor((v.left + v.width) / CHUNK);
    const cy0 = Math.floor(v.top / CHUNK);
    const cy1 = Math.floor((v.top + v.height) / CHUNK);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const left = cx * CHUNK;
        const top = cy * CHUNK;
        if (left > bounds.right || left + CHUNK < bounds.left || top > bounds.bottom + TILE_H || top + CHUNK < bounds.top) continue;
        ctx.drawImage(chunk(cx, cy), left, top, CHUNK + 0.5, CHUNK + 0.5);
      }
    }

    if (scene.tap && scene.tap.age < 0.5) {
      const p = toScreen(scene.tap.x, scene.tap.y);
      const r = 1 + scene.tap.age * 2;
      ctx.strokeStyle = C.yellow;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 14 * r, 7 * r, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Tall things and people in depth order.
    const items = [];
    for (const s of statics) {
      if (!overlaps(s.rect, v)) continue;
      items.push({ ...s, draw: () => ctx.drawImage(s.bmp, s.rect.left, s.rect.top, s.rect.width, s.rect.height) });
    }
    for (const s of scene.people) {
      const p = toScreen(s.x, s.y);
      const w = s.bmp.unitW * s.scale;
      const h = s.bmp.unitH * s.scale;
      const rect = { left: p.x - w / 2, top: p.y - h, width: w, height: h };
      if (!overlaps(rect, v)) continue;
      const r = s.radius ?? 0.25;
      items.push({ id: s.id, kind: s.kind, rect, x0: s.x - r, y0: s.y - r, x1: s.x + r, y1: s.y + r, z: 1, draw: () => drawPerson(ctx, s, t) });
    }
    const order = depthSort(items);
    // A tall thing in front of the hero turns thin, so that the child can always see the hero.
    const heroAt = order.findIndex((it) => it.kind === 'hero');
    const hero = order[heroAt];
    for (let i = 0; i < order.length; i++) {
      const it = order[i];
      const r = it.rect;
      const hides = hero && i > heroAt && !it.kind && r.left < hero.rect.left + hero.rect.width * 0.8
        && r.left + r.width > hero.rect.left + hero.rect.width * 0.2
        && r.top < hero.rect.top + hero.rect.height * 0.8 && r.top + r.height > hero.rect.top + hero.rect.height * 0.5;
      if (hides) {
        ctx.save();
        ctx.globalAlpha = 0.45;
        it.draw();
        ctx.restore();
      } else {
        it.draw();
      }
    }

    // Quest markers: a star that moves up and down over the target.
    for (const m of scene.markers) {
      const p = toScreen(m.x, m.y, m.z ?? 90);
      const bob = Math.sin(t * 4) * 4;
      ctx.drawImage(star, p.x - 15, p.y - 30 + bob, 30, 30);
    }
    ctx.restore();

    // A marker out of view: an arrow at the edge of the screen that points to it.
    const inset = scene.inset ?? {};
    const k = 1 / cam.zoom;
    const worldInset = { top: (inset.top ?? 0) * k, right: (inset.right ?? 0) * k, bottom: (inset.bottom ?? 0) * k, left: (inset.left ?? 0) * k };
    const view = { x: v.left, y: v.top, w: v.width, h: v.height };
    const shown = [];
    for (const m of scene.markers) {
      const p = toScreen(m.x, m.y, (m.z ?? 90) / 2);
      const edge = edgeMarker(view, p, worldInset);
      if (!edge) continue;
      const at = cam.toView(edge.x, edge.y);
      // Targets in about the same direction share one arrow.
      if (shown.some((q) => Math.hypot(q.x - at.x, q.y - at.y) < 56)) continue;
      shown.push(at);
      drawEdgeArrow(ctx, at, edge.angle, t);
    }
    if (scene.stick) drawStick(ctx, scene.stick);
    return order;
  }

  // The virtual stick, in screen units.
  function drawStick(ctx, s) {
    ctx.save();
    ctx.globalAlpha = s.active ? 0.8 : 0.45;
    ctx.fillStyle = C.paper;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.vermilion;
    ctx.beginPath();
    ctx.arc(s.x + (s.kx ?? 0), s.y + (s.ky ?? 0), s.r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // An arrow in screen units: a vermilion point with an ink keyline, and a star behind it.
  function drawEdgeArrow(ctx, at, angle, t) {
    const pulse = Math.sin(t * 5) * 3;
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.rotate(angle);
    ctx.translate(-22 + pulse, 0);
    ctx.fillStyle = C.paper;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-14, 0, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.translate(-14, 0);
    ctx.rotate(-angle);
    ctx.drawImage(star, -12, -12, 24, 24);
    ctx.restore();
    ctx.fillStyle = C.vermilion;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(4, -11);
    ctx.lineTo(4, 11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  return { draw, bounds, statics };
}
