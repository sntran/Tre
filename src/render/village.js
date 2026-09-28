// Draw the village map on the canvas: the ground (made once into a bitmap),
// then objects, people, enemies, and the hero, sorted from back to front.
import { C } from './palette.js';
import { bitmap } from './assets.js';
import { createRng } from '../core/rng.js';
import { edgeMarker } from '../core/hit.js';

const GROUND = {
  grass: C.greenPale,
  flowers: C.greenPale,
  path: C.paperDeep,
  yard: C.paper,
  sand: C.yellowPale,
  bridge: C.ochre,
  water: C.indigoPale,
  field: C.greenPale,
  hedge: C.greenPale,
  trees: C.greenPale,
};

// Groups of ground types. A keyline shows where two groups meet.
const GROUP = { grass: 'g', flowers: 'g', hedge: 'g', trees: 'g', path: 'p', yard: 'y', sand: 's', bridge: 'b', water: 'w', field: 'f' };

export async function createVillageRenderer(mapData, tileMap) {
  const T = mapData.tileSize;
  const W = mapData.width * T;
  const H = mapData.height * T;
  // The scale of the ground bitmap. Keep it under about 6 million pixels for the iPad.
  const scale = Math.min(2, Math.sqrt(6e6 / (W * H)));
  const ground = document.createElement('canvas');
  ground.width = Math.ceil(W * scale);
  ground.height = Math.ceil(H * scale);
  const g = ground.getContext('2d');
  g.scale(scale, scale);
  const rng = createRng(mapData.id);
  const each = (fn) => {
    for (let y = 0; y < mapData.height; y++) for (let x = 0; x < mapData.width; x++) fn(x, y, tileMap.type(x, y));
  };

  // 1. Flat ground colors.
  each((x, y, type) => {
    g.fillStyle = GROUND[type] ?? C.greenPale;
    g.fillRect(x * T, y * T, T + 0.5, T + 0.5);
  });

  // 2. Water: the traditional wave pattern (sóng nước).
  const waves = await bitmap('pattern/waves', 2);
  const wavePattern = g.createPattern(waves, 'repeat');
  // The tile is 64 units, drawn at 2x; show it at 48 world units (one map tile).
  wavePattern.setTransform(new DOMMatrix().scale(48 / 128));
  g.save();
  g.beginPath();
  each((x, y, type) => { if (type === 'water') g.rect(x * T, y * T, T, T); });
  g.clip();
  g.fillStyle = wavePattern;
  g.fillRect(0, 0, W, H);
  g.restore();

  // 3. Details of each tile, drawn like small cut marks of a woodblock.
  g.lineCap = 'round';
  g.lineJoin = 'round';
  each((x, y, type) => {
    const px = x * T;
    const py = y * T;
    if (type === 'grass' || type === 'hedge' || type === 'trees') {
      g.strokeStyle = C.green;
      g.lineWidth = 1.4;
      for (let i = 0; i < 2; i++) {
        const gx = px + rng.int(6, T - 10);
        const gy = py + rng.int(10, T - 6);
        g.beginPath();
        g.moveTo(gx, gy);
        g.quadraticCurveTo(gx + 1, gy - 5, gx - 1, gy - 8);
        g.moveTo(gx + 3, gy);
        g.quadraticCurveTo(gx + 4, gy - 4, gx + 6, gy - 6);
        g.stroke();
      }
    } else if (type === 'flowers') {
      for (let i = 0; i < 3; i++) {
        const fx = px + rng.int(8, T - 8);
        const fy = py + rng.int(8, T - 8);
        g.fillStyle = i % 2 ? C.vermilionPale : C.yellow;
        g.strokeStyle = C.ink;
        g.lineWidth = 1;
        for (let k = 0; k < 4; k++) {
          const a = (k * Math.PI) / 2;
          g.beginPath();
          g.ellipse(fx + Math.cos(a) * 3, fy + Math.sin(a) * 3, 2.6, 2.6, 0, 0, Math.PI * 2);
          g.fill();
          g.stroke();
        }
      }
    } else if (type === 'path' || type === 'yard' || type === 'sand') {
      g.fillStyle = C.ochre;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.arc(px + rng.int(4, T - 4), py + rng.int(4, T - 4), 1, 0, Math.PI * 2);
        g.fill();
      }
    } else if (type === 'bridge') {
      g.strokeStyle = C.ink;
      g.lineWidth = 1.4;
      for (let i = 1; i < 4; i++) {
        g.beginPath();
        g.moveTo(px, py + (i * T) / 4);
        g.lineTo(px + T, py + (i * T) / 4);
        g.stroke();
      }
    } else if (type === 'field') {
      // Rows of young rice with thin water lines between the rows.
      g.strokeStyle = C.indigoPale;
      g.lineWidth = 1.2;
      for (let r = 0; r < 3; r++) {
        g.beginPath();
        g.moveTo(px + 2, py + 16 + r * 15);
        g.lineTo(px + T - 2, py + 16 + r * 15);
        g.stroke();
      }
      g.strokeStyle = C.greenDeep;
      g.lineWidth = 1.4;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          const sx = px + 7 + c * 11;
          const sy = py + 13 + r * 15;
          g.beginPath();
          g.moveTo(sx, sy);
          g.lineTo(sx - 2, sy - 7);
          g.moveTo(sx, sy);
          g.lineTo(sx + 2, sy - 7);
          g.stroke();
        }
      }
    }
  });

  // 4. Keylines where two ground groups meet.
  g.strokeStyle = C.ink;
  g.lineWidth = 2.2;
  g.beginPath();
  each((x, y, type) => {
    const a = GROUP[type];
    if (x + 1 < mapData.width && a !== GROUP[tileMap.type(x + 1, y)]) {
      g.moveTo((x + 1) * T, y * T);
      g.lineTo((x + 1) * T, (y + 1) * T);
    }
    if (y + 1 < mapData.height && a !== GROUP[tileMap.type(x, y + 1)]) {
      g.moveTo(x * T, (y + 1) * T);
      g.lineTo((x + 1) * T, (y + 1) * T);
    }
  });
  g.stroke();

  // 5. Bamboo on the hedge tiles and trees on the tree tiles, row by row.
  const bamboo = await bitmap('map/bamboo', 2);
  const tree = await bitmap('map/tree', 2);
  each((x, y, type) => {
    if (type === 'hedge') g.drawImage(bamboo, x * T, (y + 1) * T - 72, 48, 72);
    if (type === 'trees') g.drawImage(tree, x * T, (y + 1) * T - 72, 48, 72);
  });

  // 6. The dó paper texture over all the ground.
  const paper = await bitmap('paper', 1);
  g.save();
  g.globalAlpha = 0.35;
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = g.createPattern(paper, 'repeat');
  g.fillRect(0, 0, W, H);
  g.restore();

  // Objects as bitmaps.
  const objects = [];
  for (const o of mapData.objects) {
    const bmp = await bitmap(o.art, 2);
    objects.push({ ...o, bmp, w: bmp.unitW, h: bmp.unitH, baseY: (o.y + (o.h ?? 1)) * T });
  }
  const star = await bitmap('ui/star', 2);

  function drawSprite(ctx, s, t) {
    const { bmp } = s;
    const w = s.w ?? bmp.unitW * (s.scale ?? 0.48);
    const h = s.h ?? bmp.unitH * (s.scale ?? 0.48);
    const bob = s.walking ? Math.abs(Math.sin(t * 12)) * 3 : 0;
    // A soft shadow under the feet.
    ctx.fillStyle = 'rgba(31, 27, 23, 0.2)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y - 2, w * 0.32, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(s.x, s.y - bob);
    if (s.flip) ctx.scale(-1, 1);
    ctx.drawImage(bmp, -w / 2, -h, w, h);
    ctx.restore();
  }

  // Draw one frame. scene: { camera, sprites: [{ bmp, x, y (feet), scale, flip, walking }], markers: [{x, y}], tap: {x, y, age} }
  function draw(surface, scene, t) {
    const { ctx } = surface;
    const cam = scene.camera;
    surface.clear(C.greenPale);
    ctx.save();
    ctx.translate(surface.width / 2, surface.height / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);
    const v = cam.view();
    // The ground: copy only the visible part.
    const sx = Math.max(0, v.x);
    const sy = Math.max(0, v.y);
    const sw = Math.min(W, v.x + v.w) - sx;
    const sh = Math.min(H, v.y + v.h) - sy;
    if (sw > 0 && sh > 0) ctx.drawImage(ground, sx * scale, sy * scale, sw * scale, sh * scale, sx, sy, sw, sh);

    if (scene.tap && scene.tap.age < 0.5) {
      ctx.strokeStyle = C.yellow;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(scene.tap.x, scene.tap.y, 8 + scene.tap.age * 30, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Objects and sprites, sorted by the y of their feet.
    const items = [];
    for (const o of objects) {
      if (o.x * T > v.x + v.w || (o.x * T + o.w) < v.x || o.baseY - o.h > v.y + v.h || o.baseY < v.y) continue;
      items.push({ y: o.baseY, draw: () => ctx.drawImage(o.bmp, o.x * T, o.baseY - o.h, o.w, o.h) });
    }
    for (const s of scene.sprites) items.push({ y: s.y, draw: () => drawSprite(ctx, s, t) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    // Quest markers: a star that moves up and down.
    for (const m of scene.markers) {
      const bob = Math.sin(t * 4) * 4;
      ctx.drawImage(star, m.x - 14, m.y - 30 + bob, 28, 28);
    }
    ctx.restore();

    // A marker out of view: an arrow at the edge of the screen that points to it.
    const inset = scene.inset ?? {};
    const toWorld = (px) => px / cam.zoom;
    const worldInset = { top: toWorld(inset.top ?? 0), right: toWorld(inset.right ?? 0), bottom: toWorld(inset.bottom ?? 0), left: toWorld(inset.left ?? 0) };
    for (const m of scene.markers) {
      const edge = edgeMarker(v, { x: m.x, y: m.y - 16 }, worldInset);
      if (edge) drawEdgeArrow(ctx, cam.toScreen(edge.x, edge.y), edge.angle, t);
    }
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
    // The star stays upright in the middle of the circle.
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

  return { draw, width: W, height: H, tileSize: T };
}
