// Draw a battle in side view on the canvas: the background, the party on the left,
// the enemies on the right, the guards (number shields and element states), and effects.
import { bitmap, heroLayers } from './assets.js';
import { C } from './palette.js';

const W = 960;
const H = 540;
const GROUND = 445;

export async function createBattleRenderer({ bg, hero, friends, companion, enemies }) {
  const art = {
    bg: await bitmap(bg, 1.5),
    hero: await bitmap(heroLayers(hero), 2),
    friends: await Promise.all(friends.map((f) => bitmap(f.art, 2))),
    companion: companion ? await bitmap(companion.art, 2) : null,
    companionBamboo: companion?.bambooArt ? await bitmap(companion.bambooArt, 2) : null,
    horse: companion ? await bitmap('thing/iron-horse', 1.5) : null,
    staffBroken: await bitmap('thing/iron-staff-broken', 2),
    enemies: await Promise.all(enemies.map(async (e) => ({ main: await bitmap(e.art, 2), done: await bitmap(e.doneArt ?? e.art, 2) }))),
    fx: {},
  };
  for (const name of ['fire', 'water', 'steam', 'ice', 'shield', 'spark', 'bubble']) art.fx[name] = await bitmap(`fx/${name}`, 2);
  const star = await bitmap('ui/star', 2);

  // Places in the 960 x 540 stage.
  const heroPos = { x: companion ? 330 : 250, y: GROUND };
  const companionPos = { x: 150, y: GROUND };
  const friendPos = (i) => ({ x: heroPos.x - 95 - i * 50, y: GROUND + 4 });
  const enemyPos = (i, n) => ({ x: n === 1 ? 720 : 620 + i * 190, y: GROUND });
  const effects = [];
  let view = { scale: 1, ox: 0, oy: 0 };

  function add(effect) {
    effects.push({ start: performance.now() / 1000, dur: 0.6, ...effect });
  }

  function sizeOf(bmp, scale) {
    return { w: bmp.unitW * scale, h: bmp.unitH * scale };
  }

  function drawSprite(ctx, bmp, x, y, scale, { flip = false, alpha = 1, dx = 0, dy = 0 } = {}) {
    const { w, h } = sizeOf(bmp, scale);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(29, 26, 23, 0.25)';
    ctx.beginPath();
    ctx.ellipse(x + dx, y + 2, w * 0.33, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(x + dx, y + dy);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(bmp, -w / 2, -h, w, h);
    ctx.restore();
    return { x: x + dx - w / 2, y: y + dy - h, w, h };
  }

  function enemyScale(e) {
    return 1.05 * (e.type.size ?? 1) * (e.type.kind === 'creature' ? 1.1 : 1);
  }

  // The rectangle of each enemy on the screen, for taps.
  let enemyBoxes = [];

  // state: the battle state. stage: { width, height } of the free area in CSS pixels.
  function draw(surface, state, t, stage) {
    const { ctx } = surface;
    // Show the band of the stage from y = 140 to y = 480, where the people stand,
    // and the width from x = 70 to x = 890.
    // On a wide screen, fill the width, but keep the people (y = 250 to 480) in view.
    const fit = Math.min((stage.height - 40) / 340, stage.width / 820);
    const scale = Math.max(0.4, Math.min(Math.max(fit, stage.width / W), (stage.height - 30) / 230));
    const ox = (surface.width - W * scale) / 2;
    const oy = stage.height - 480 * scale;
    view = { scale, ox, oy };
    surface.clear(C.paper);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    ctx.drawImage(art.bg, 0, 0, W, H);
    // Mirror copies of the background fill a wide screen with no gaps.
    if (ox > 0) {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(art.bg, 0, 0, W, H);
      ctx.restore();
      ctx.save();
      ctx.translate(2 * W, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(art.bg, 0, 0, W, H);
      ctx.restore();
    }

    const now = performance.now() / 1000;
    const active = (kind, filter = () => true) => effects.find((e) => e.kind === kind && filter(e) && now - e.start < e.dur);
    const progress = (e) => Math.min(1, (now - e.start) / e.dur);

    // The companion (Gióng) and the iron horse.
    if (companion && art.companion) {
      const strike = active('strike');
      const dx = strike ? Math.sin(progress(strike) * Math.PI) * 120 : 0;
      drawSprite(ctx, art.horse, companionPos.x + dx - 10, companionPos.y + 6, 0.9);
      const weapon = state.companion?.weapon;
      const bmp = weapon === 'bamboo' && art.companionBamboo ? art.companionBamboo : art.companion;
      drawSprite(ctx, bmp, companionPos.x + dx + 10, companionPos.y - 60, 1.05);
      const broken = active('staffBreak');
      if (broken) {
        const p = progress(broken);
        drawSprite(ctx, art.staffBroken, companionPos.x + 70 + p * 40, companionPos.y - 40 + p * 40, 0.7, { alpha: 1 - p * 0.3 });
      }
    }

    // The friends and the hero.
    state.friends?.forEach((_, i) => {
      if (!art.friends[i]) return;
      const pos = friendPos(i);
      drawSprite(ctx, art.friends[i], pos.x, pos.y, 0.62, { dy: Math.sin(t * 3 + i) * 3 });
    });
    const hurt = active('hurt');
    const hurtDx = hurt ? Math.sin(progress(hurt) * Math.PI * 6) * 10 : 0;
    const cast = active('cast');
    const castDx = cast ? Math.sin(progress(cast) * Math.PI) * 30 : 0;
    drawSprite(ctx, art.hero, heroPos.x, heroPos.y, 1.05, { dx: hurtDx + castDx, dy: Math.abs(Math.sin(t * 2)) * -3 });
    if (state.hidden) {
      ctx.globalAlpha = 0.85;
      ctx.drawImage(art.fx.steam, heroPos.x - 150, heroPos.y - 210, 240, 170);
      ctx.globalAlpha = 1;
    }

    // Enemies.
    const n = state.enemies.length;
    enemyBoxes = [];
    state.enemies.forEach((e, i) => {
      const pos = enemyPos(i, n);
      const scaleE = enemyScale(e);
      const retreat = active('retreat', (x) => x.enemy === i);
      const hit = active('hit', (x) => x.enemy === i);
      const hitDx = hit ? Math.sin(progress(hit) * Math.PI * 5) * 8 : 0;
      if (e.done && e.outcome === 'retreat' && !retreat) return;
      let dx = hitDx;
      let alpha = 1;
      if (retreat) {
        dx = progress(retreat) * 420;
        alpha = 1 - progress(retreat);
      }
      const bmp = e.done ? art.enemies[i].done : art.enemies[i].main;
      const box = drawSprite(ctx, bmp, pos.x, pos.y, scaleE, { dx, alpha, flip: e.done && e.outcome === 'retreat' ? false : false, dy: e.done ? Math.sin(t * 4) * 3 : 0 });
      enemyBoxes[i] = box;
      if (e.done) return;

      // The guard.
      const g = e.guard;
      if (g?.kind === 'element') {
        if (g.state === 'fire') {
          const s = 70 + Math.sin(t * 8) * 6;
          ctx.drawImage(art.fx.fire, box.x - 10, box.y - 10, s, s);
        } else if (g.state === 'ice') {
          ctx.globalAlpha = 0.8;
          ctx.drawImage(art.fx.ice, box.x - 20, box.y - 10, box.w + 40, box.h + 20);
          ctx.globalAlpha = 1;
        } else if (g.state === 'water') {
          ctx.globalAlpha = 0.7;
          ctx.drawImage(art.fx.bubble, box.x - 25, box.y - 20, box.w + 50, box.h + 30);
          ctx.globalAlpha = 1;
        }
      } else if (g?.kind === 'shield') {
        const sx = box.x - 30;
        const sy = box.y + box.h * 0.35;
        const size = 96;
        const breaking = active('break', (x) => x.enemy === i);
        if (!breaking) {
          ctx.drawImage(art.fx.shield, sx - size / 2, sy - size / 2, size, size);
          const label = g.problem.kind === 'cards' ? String(g.problem.target) : '?';
          ctx.font = `800 ${label.length > 3 ? 26 : 34}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = C.black;
          ctx.fillText(label, sx, sy + 2);
        }
      }
      // Spirit: one dot for each point.
      const pip = Math.min(14, 120 / e.max);
      for (let k = 0; k < e.max; k++) {
        ctx.beginPath();
        ctx.arc(box.x + box.w / 2 - ((e.max - 1) * pip) / 2 + k * pip, box.y - 18, pip * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = k < e.spirit ? C.yellow : C.white;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = C.black;
        ctx.stroke();
      }
      if (state.target === i && n > 1) {
        ctx.drawImage(star, box.x + box.w / 2 - 16, box.y - 58 + Math.sin(t * 5) * 4, 32, 32);
      }
    });

    // Moving effects: magic that flies, sparks, and breaking shields.
    for (const e of effects) {
      const p = (now - e.start) / e.dur;
      if (p < 0 || p > 1) continue;
      if (e.kind === 'projectile') {
        const to = enemyBoxes[e.enemy] ?? { x: 700, y: 300, w: 80, h: 100 };
        const tx = to.x + to.w / 2;
        const ty = to.y + to.h / 2;
        const x = heroPos.x + (tx - heroPos.x) * p;
        const y = heroPos.y - 90 + (ty - heroPos.y + 90) * p - Math.sin(p * Math.PI) * 60;
        ctx.drawImage(art.fx[e.sprite], x - 36, y - 36, 72, 72);
      } else if (e.kind === 'burst') {
        const to = enemyBoxes[e.enemy];
        if (!to) continue;
        const s = 60 + p * 80;
        ctx.globalAlpha = 1 - p;
        ctx.drawImage(art.fx[e.sprite ?? 'spark'], to.x + to.w / 2 - s / 2, to.y + to.h / 2 - s / 2, s, s);
        ctx.globalAlpha = 1;
      } else if (e.kind === 'break') {
        const to = enemyBoxes[e.enemy];
        if (!to) continue;
        const sx = to.x - 30;
        const sy = to.y + to.h * 0.35;
        ctx.globalAlpha = 1 - p;
        ctx.drawImage(art.fx.shield, sx - 48 - p * 40, sy - 48 + p * 60, 48, 96);
        ctx.drawImage(art.fx.shield, sx + p * 40, sy - 48 + p * 60, 48, 96);
        ctx.globalAlpha = 1;
      } else if (e.kind === 'steamPuff') {
        ctx.globalAlpha = 1 - p;
        const to = enemyBoxes[e.enemy];
        if (to) ctx.drawImage(art.fx.steam, to.x - 40, to.y - 40 - p * 60, to.w + 80, to.h * 0.7);
        ctx.globalAlpha = 1;
      }
    }
    // Remove old effects.
    for (let i = effects.length - 1; i >= 0; i--) if (now - effects[i].start > effects[i].dur + 0.1) effects.splice(i, 1);
    ctx.restore();
  }

  // The enemy under a tap, or -1.
  function enemyAt(sx, sy) {
    const x = (sx - view.ox) / view.scale;
    const y = (sy - view.oy) / view.scale;
    return enemyBoxes.findIndex((b) => b && x >= b.x - 20 && x <= b.x + b.w + 20 && y >= b.y - 40 && y <= b.y + b.h);
  }

  return { draw, add, enemyAt, busy: () => effects.some((e) => e.blocking && performance.now() / 1000 - e.start < e.dur) };
}
