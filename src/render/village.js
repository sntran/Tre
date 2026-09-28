// Draw the village map on the canvas: the ground (made once into a bitmap),
// then objects, people, enemies, and the hero, sorted from back to front.
import { C } from './palette.js';
import { bitmap } from './assets.js';
import { createRng } from '../core/rng.js';

const GROUND = {
  grass: C.greenLight,
  flowers: C.greenLight,
  path: '#dcc08a',
  yard: '#e6d3a6',
  sand: '#ecd49b',
  bridge: C.brown,
  water: C.water,
  field: '#9dbb6e',
  hedge: C.greenLight,
  trees: C.greenLight,
};

// Groups of ground types. A black outline shows where two groups meet.
const GROUP = { grass: 'g', flowers: 'g', hedge: 'g', trees: 'g', path: 'p', yard: 'p', sand: 's', bridge: 'b', water: 'w', field: 'f' };

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

  // 1. Flat ground colors.
  for (let y = 0; y < mapData.height; y++) {
    for (let x = 0; x < mapData.width; x++) {
      const type = tileMap.type(x, y);
      g.fillStyle = GROUND[type] ?? C.greenLight;
      g.fillRect(x * T, y * T, T + 0.5, T + 0.5);
    }
  }

  // 2. Details of each tile.
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let y = 0; y < mapData.height; y++) {
    for (let x = 0; x < mapData.width; x++) {
      const type = tileMap.type(x, y);
      const px = x * T;
      const py = y * T;
      if (type === 'grass' || type === 'hedge' || type === 'trees') {
        g.strokeStyle = C.green;
        g.lineWidth = 2;
        for (let i = 0; i < 2; i++) {
          const gx = px + rng.int(6, T - 10);
          const gy = py + rng.int(8, T - 6);
          g.beginPath();
          g.moveTo(gx, gy);
          g.lineTo(gx + 3, gy - 6);
          g.lineTo(gx + 6, gy);
          g.stroke();
        }
      } else if (type === 'flowers') {
        for (let i = 0; i < 4; i++) {
          g.fillStyle = i % 2 ? C.red : C.yellow;
          g.strokeStyle = C.black;
          g.lineWidth = 1.5;
          g.beginPath();
          g.arc(px + rng.int(8, T - 8), py + rng.int(8, T - 8), 4, 0, Math.PI * 2);
          g.fill();
          g.stroke();
        }
      } else if (type === 'path' || type === 'yard' || type === 'sand') {
        g.fillStyle = 'rgba(138, 90, 59, 0.35)';
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.arc(px + rng.int(4, T - 4), py + rng.int(4, T - 4), rng.int(1, 2), 0, Math.PI * 2);
          g.fill();
        }
      } else if (type === 'water') {
        g.strokeStyle = C.white;
        g.lineWidth = 2.5;
        const ox = rng.int(4, 16);
        const oy = rng.int(12, 34);
        g.beginPath();
        g.moveTo(px + ox, py + oy);
        g.quadraticCurveTo(px + ox + 7, py + oy - 7, px + ox + 14, py + oy);
        g.quadraticCurveTo(px + ox + 21, py + oy + 7, px + ox + 28, py + oy);
        g.stroke();
      } else if (type === 'bridge') {
        g.strokeStyle = C.black;
        g.lineWidth = 2;
        for (let i = 1; i < 4; i++) {
          g.beginPath();
          g.moveTo(px, py + (i * T) / 4);
          g.lineTo(px + T, py + (i * T) / 4);
          g.stroke();
        }
      } else if (type === 'field') {
        g.strokeStyle = C.green;
        g.lineWidth = 2.5;
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            const sx = px + 8 + c * 15;
            const sy = py + 12 + r * 15;
            g.beginPath();
            g.moveTo(sx, sy);
            g.lineTo(sx - 3, sy - 8);
            g.moveTo(sx, sy);
            g.lineTo(sx + 3, sy - 8);
            g.stroke();
          }
        }
      }
    }
  }

  // 3. Bold outlines where two ground groups meet, in the Đông Hồ style.
  g.strokeStyle = C.black;
  g.lineWidth = 3;
  g.beginPath();
  for (let y = 0; y < mapData.height; y++) {
    for (let x = 0; x < mapData.width; x++) {
      const a = GROUP[tileMap.type(x, y)];
      if (x + 1 < mapData.width && a !== GROUP[tileMap.type(x + 1, y)]) {
        g.moveTo((x + 1) * T, y * T);
        g.lineTo((x + 1) * T, (y + 1) * T);
      }
      if (y + 1 < mapData.height && a !== GROUP[tileMap.type(x, y + 1)]) {
        g.moveTo(x * T, (y + 1) * T);
        g.lineTo((x + 1) * T, (y + 1) * T);
      }
    }
  }
  g.stroke();

  // 4. Bamboo on the hedge tiles and trees on the tree tiles, row by row.
  const bamboo = await bitmap('map/bamboo', 2);
  const tree = await bitmap('map/tree', 2);
  for (let y = 0; y < mapData.height; y++) {
    for (let x = 0; x < mapData.width; x++) {
      const type = tileMap.type(x, y);
      if (type === 'hedge') g.drawImage(bamboo, x * T, (y + 1) * T - 72, 48, 72);
      if (type === 'trees') g.drawImage(tree, x * T, (y + 1) * T - 72, 48, 72);
    }
  }

  // 5. Paper texture over all the ground.
  const paper = await bitmap('paper', 1);
  g.save();
  g.globalAlpha = 0.28;
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
    ctx.fillStyle = 'rgba(29, 26, 23, 0.22)';
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
    surface.clear(C.greenLight);
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
  }

  return { draw, width: W, height: H, tileSize: T };
}
