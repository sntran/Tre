// The slingshot prototype: one battle screen with no question and no answer field.
// The child pulls the slingshot. The distance of the stone is the answer, and the model
// records each shot as a skill event, with no sign to the child.
// URL: prototype/slingshot.html?level=2&lang=en&debug=1&seed=abc&grade=1
import { createSurface } from '../../src/render/surface.js';
import { C } from '../../src/render/palette.js';
import { bitmap, heroLayers } from '../../src/render/assets.js';
import { setLanguage, t } from '../../src/ui/i18n.js';
import { h, img } from '../../src/ui/dom.js';
import { play, unlockAudio } from '../../src/ui/audio.js';
import { createRng } from '../../src/core/rng.js';
import { createSkillGraph } from '../../src/core/skills.js';
import { createLearner } from '../../src/core/learner.js';
import { PHYSICS, shotFromDrag, previewPoints } from './physics.js';
import { createBattle, RULES } from './battle.js';
import './sounds.js';

const params = new URLSearchParams(location.search);
const LEVEL = String(Math.max(1, Math.min(3, Number(params.get('level')) || 1)));
const LANG = params.get('lang') === 'en' ? 'en' : 'vi';
const DEBUG = params.get('debug') === '1';
const SEED = params.get('seed') ?? String(Date.now());
const GRADE = Number(params.get('grade') ?? 1);

// Sizes in world units (1 unit = 1 step between the ticks).
const SIZE = { adult: 1.8, child: 1.8 * 0.8, nghe: 1.1, sling: 1.2, fence: 1.3, stone: 0.34, shield: 1.15 };
const X = { hero: -1.05, nghe: -2.55, left: -3.6 };
const RUN_SPEED = 7; // units per second, for enemies that retreat

async function loadJson(path) {
  const response = await fetch(path);
  return response.json();
}

async function start() {
  const [levels, skillsData, learningConfig] = await Promise.all([
    loadJson('prototype/slingshot/levels.json'),
    loadJson('data/skills.json'),
    loadJson('data/config/learning.json'),
  ]);
  await setLanguage(LANG);
  document.title = t('slingshot.title');

  // The learner model with a temporary profile in memory. Nothing is saved.
  const graph = createSkillGraph(skillsData);
  const learning = { skills: {}, items: {}, exams: [] };
  const learner = createLearner({ graph, config: learningConfig, learning, grade: GRADE, rng: createRng(`learner:${SEED}`), bank: [] });

  const def = levels.levels[LEVEL];
  const battle = createBattle({ def, types: levels.enemyTypes, rng: createRng(`level:${LEVEL}:${SEED}`) });
  const s = battle.state;

  // Art. Bitmaps are made one time, at 2x, for sharp lines on the iPad.
  const hero = { gender: 'boy', skin: 2, face: 1, hair: 2, clothes: 1 };
  const art = {
    hero: await bitmap(heroLayers(hero), 2),
    nghe: await bitmap('friend/nghe', 2),
    sling: await bitmap('thing/slingshot', 2),
    stone: await bitmap('thing/stone', 2),
    fence: await bitmap('thing/bamboo-fence', 2),
    shield: await bitmap('thing/bamboo-shield', 2),
    dust: await bitmap('fx/dust', 2),
    spark: await bitmap('fx/spark', 2),
    retreat: await bitmap('enemy/retreat', 2),
    heart: 'ui/heart',
  };
  const enemyArt = {};
  for (const [kind, type] of Object.entries(levels.enemyTypes)) enemyArt[kind] = await bitmap(type.art, 2);

  const canvas = document.getElementById('world');
  const surface = createSurface(canvas);
  const ui = document.getElementById('ui');

  // World to screen.
  let k = 40;
  let groundY = 300;
  let background = null;
  const toS = (x, y) => ({ x: (x - X.left) * k, y: groundY - y * k });
  const toWorld = (sx, sy) => ({ x: sx / k + X.left, y: (groundY - sy) / k });

  // On a long field, the people are drawn a little larger, so that they stay clear on a phone.
  // This changes only the pictures, not the distances or the hit rules.
  let big = 1;
  function layout() {
    surface.resize();
    const range = s.field + 2.6 - X.left;
    k = surface.width / range;
    big = Math.min(1.45, Math.max(1, 34 / k, surface.height / k / 11));
    // Keep room under the ground line for the landing marker and the buttons.
    groundY = surface.height - Math.max(100, surface.height * 0.2);
    background = drawBackground();
  }

  // The static part of the scene: paper, hills, ground, ticks, and the bamboo markers.
  function drawBackground() {
    const c = document.createElement('canvas');
    c.width = surface.canvas.width;
    c.height = surface.canvas.height;
    const g = c.getContext('2d');
    g.scale(surface.dpr, surface.dpr);
    const W = surface.width;
    g.fillStyle = C.paper;
    g.fillRect(0, 0, W, surface.height);
    // Far hills, flat colors with a keyline.
    g.lineWidth = 2;
    g.strokeStyle = C.ink;
    // Clouds in the style of the prints: round puffs with a keyline and a curl.
    for (const [cx, cy, r] of [[0.16, 0.16, 1], [0.5, 0.1, 0.8], [0.82, 0.2, 1.1]]) {
      const x0 = W * cx;
      const y0 = groundY * cy + 20;
      const u = Math.max(14, surface.height * 0.03) * r;
      g.fillStyle = C.diep;
      g.beginPath();
      for (const [dx, dy, rr] of [[-2.2, 0.3, 1], [-0.9, -0.5, 1.4], [0.6, -0.3, 1.2], [1.9, 0.3, 0.95]]) {
        g.moveTo(x0 + dx * u + rr * u, y0 + dy * u);
        g.arc(x0 + dx * u, y0 + dy * u, rr * u, 0, Math.PI * 2);
      }
      g.fill();
      g.stroke();
      g.fillRect(x0 - 3.2 * u, y0 + 0.3 * u, 6.1 * u, 1.0 * u);
      g.beginPath();
      g.moveTo(x0 - 3.2 * u, y0 + 1.3 * u);
      g.lineTo(x0 + 2.9 * u, y0 + 1.3 * u);
      g.stroke();
      g.beginPath();
      g.arc(x0 - 0.9 * u, y0 - 0.4 * u, 0.5 * u, Math.PI * 0.2, Math.PI * 1.6);
      g.stroke();
    }
    // Far hills, flat colors with a keyline. They are taller on a tall screen.
    const hillH = Math.max(surface.height * 0.3, groundY * 0.45);
    for (const [cx, r, color] of [[0.18, 0.28, C.greenPale], [0.55, 0.36, C.green], [0.9, 0.26, C.greenPale]]) {
      g.fillStyle = color;
      g.beginPath();
      g.ellipse(W * cx, groundY, W * r, hillH, 0, Math.PI, 0);
      g.fill();
      g.stroke();
    }
    // The ground.
    g.fillStyle = C.paperDeep;
    g.fillRect(0, groundY, W, surface.height - groundY);
    g.beginPath();
    g.moveTo(0, groundY);
    g.lineTo(W, groundY);
    g.lineWidth = 2.5;
    g.stroke();
    // Small ticks for each step.
    g.lineWidth = 1.5;
    for (let x = 1; x <= s.field; x++) {
      const p = toS(x, 0);
      const len = x % 5 === 0 ? 12 : 6;
      g.beginPath();
      g.moveTo(p.x, groundY);
      g.lineTo(p.x, groundY + len);
      g.stroke();
    }
    // Bamboo markers at 5, 10, 15, ... with the number in a red seal.
    for (const m of s.markers) drawMarker(g, m);
    return c;
  }

  function drawMarker(g, m, glow = false) {
    const base = toS(m, 0);
    const top = toS(m, 1.25);
    const w = Math.max(6, 0.16 * k);
    g.lineWidth = 2;
    g.strokeStyle = C.ink;
    g.fillStyle = C.green;
    g.fillRect(base.x - w / 2, top.y, w, base.y - top.y);
    g.strokeRect(base.x - w / 2, top.y, w, base.y - top.y);
    for (let j = 1; j < 3; j++) {
      const y = top.y + ((base.y - top.y) * j) / 3;
      g.beginPath();
      g.moveTo(base.x - w / 2 - 2, y);
      g.lineTo(base.x + w / 2 + 2, y);
      g.stroke();
    }
    const size = Math.max(26, 0.62 * k);
    const sx = base.x - size / 2;
    const sy = top.y - size - 2;
    if (glow) {
      g.fillStyle = C.yellow;
      g.fillRect(sx - 6, sy - 6, size + 12, size + 12);
    }
    g.fillStyle = C.vermilion;
    g.fillRect(sx, sy, size, size);
    g.strokeRect(sx, sy, size, size);
    g.strokeStyle = C.diep;
    g.lineWidth = 1.2;
    g.strokeRect(sx + 3, sy + 3, size - 6, size - 6);
    g.fillStyle = C.diep;
    g.font = `700 ${Math.round(size * 0.55)}px Alegreya, serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(m), base.x, sy + size / 2 + 1);
  }

  // A sprite with its feet at (x, y) in world units, and a height in world units.
  function sprite(ctx, bmp, x, y, height, { flip = false, alpha = 1, rot = 0, dx = 0, sy = 1, person = true } = {}) {
    const hh = height * k * (person ? big : 1);
    const ww = (bmp.unitW / bmp.unitH) * hh;
    const p = toS(x, y);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x + dx * k, p.y);
    if (rot) ctx.rotate(rot);
    if (flip) ctx.scale(-1, 1);
    ctx.scale(1, sy);
    ctx.drawImage(bmp, -ww / 2, -hh, ww, hh);
    ctx.restore();
  }

  function shadow(ctx, x, width) {
    const p = toS(x, 0);
    ctx.fillStyle = 'rgba(31, 27, 23, 0.18)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, (width * k) / 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Visual state that the rules do not keep.
  const look = new Map(s.enemies.map((e) => [e.id, { stagger: -9, duck: -9, knock: -9, run: 0, gone: false }]));
  const popups = []; // damage numbers
  const dusts = []; // dust clouds
  const throws = []; // stones of enemies in the air
  let landMark = null; // { x, text }
  let stamps = []; // hoof marks of Nghé
  let glowMarker = null;
  const nghe = { x: X.nghe, from: X.nghe, to: X.nghe, t0: 0, dur: 0, mode: 'idle', until: 0, nudge: false };
  let heroHurt = -9;
  let ended = null; // 'won' | 'lost'
  let endAt = 0;
  let clock = 0; // seconds since the page started (for the animations)

  function moveNghe(to, dur, mode, until = 0) {
    nghe.from = ngheX();
    nghe.to = to;
    nghe.t0 = clock;
    nghe.dur = dur;
    nghe.mode = mode;
    nghe.until = until;
  }
  function ngheX() {
    const p = Math.min(1, (clock - nghe.t0) / Math.max(0.001, nghe.dur));
    return nghe.from + (nghe.to - nghe.from) * p;
  }

  // HUD: hearts, Guard, and Call Nghé. The only words: "Guard", "Call Nghé", "Try again", "Next".
  const hearts = h('div', { class: 'sling-hearts', 'aria-label': '' });
  const guardBtn = h('button', { class: 'btn sling-guard', type: 'button', 'aria-label': t('slingshot.guard') }, [img('thing/bamboo-shield', 'btn-icon'), h('span', { class: 'btn-label', text: t('slingshot.guard') })]);
  const ngheBtn = h('button', { class: 'btn paper sling-nghe', type: 'button', 'aria-label': t('slingshot.nghe') }, [img('friend/nghe', 'btn-icon'), h('span', { class: 'btn-label', text: t('slingshot.nghe') })]);
  ui.append(hearts, h('div', { class: 'sling-actions' }, [ngheBtn, guardBtn]));

  function drawHearts() {
    hearts.replaceChildren(...Array.from({ length: s.maxHearts }, (_, i) => img(i < s.hearts ? 'ui/heart' : 'ui/heart-empty')));
    hearts.setAttribute('aria-label', `${s.hearts}/${s.maxHearts}`);
  }
  drawHearts();

  // The Guard button reacts on the first touch, not at the end of the tap.
  guardBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    unlockAudio();
    if (battle.guard()) {
      play('sling.guard');
      guardBtn.classList.add('up');
      guardBtn.disabled = true;
      setTimeout(() => guardBtn.classList.remove('up'), RULES.guardWindow * 1000);
      setTimeout(() => { guardBtn.disabled = s.phase !== 'play'; }, RULES.guardRest * 1000);
    }
  });
  ngheBtn.addEventListener('click', () => {
    unlockAudio();
    const events = battle.callNghe();
    if (!events.length) return;
    ngheBtn.disabled = true;
    handle(events);
  });

  // The model log, only with ?debug=1. The child never sees it.
  const logLines = [];
  let logBox = null;
  if (DEBUG) {
    logBox = h('div', { class: 'sling-log' }, [h('h2', { text: t('slingshot.log') })]);
    ui.append(logBox);
  }
  window.slingshotLog = logLines;

  function recordSkill(ev) {
    const change = learner.record({ skill: ev.skill, level: ev.level }, ev.correct);
    const line = {
      time: Math.round(s.time * 10) / 10,
      skill: ev.skill,
      level: ev.level,
      target: ev.target,
      landed: ev.landed,
      previous: ev.previous,
      gap: ev.gap,
      correct: ev.correct,
      p: Math.round(change.p * 1000) / 1000,
      state: change.after,
    };
    logLines.push(line);
    if (logBox) {
      const text = `${line.time.toFixed(1).padStart(5)}s  ${line.skill} L${line.level}  target ${line.target}  landed ${line.landed}`
        + `${line.gap === null ? '' : `  gap ${line.gap > 0 ? '+' : ''}${line.gap}`}  ${line.correct ? 'correct' : 'wrong'}  p=${line.p.toFixed(3)} ${line.state}`;
      logBox.append(h('div', { class: line.correct ? 'ok' : 'no', text }));
      logBox.scrollTop = logBox.scrollHeight;
    }
    if (DEBUG) console.log('skill event', JSON.stringify(line));
  }

  // Input: drag back from the slingshot, see the start of the arc, and let go.
  let aim = null; // { id, ox, oy (origin, screen), px, py (pointer, screen), shot }
  const pouchRest = () => toS(0, PHYSICS.h0);
  const maxPull = () => Math.min(190, surface.height * 0.36);

  canvas.addEventListener('pointerdown', (e) => {
    unlockAudio();
    if (s.phase !== 'play' || s.stone || aim) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const rest = pouchRest();
    // A touch near the slingshot pulls the pouch itself. A touch anywhere else pulls from that point.
    const near = Math.hypot(px - rest.x, py - rest.y) < Math.max(90, 2.5 * k);
    aim = { id: e.pointerId, ox: near ? rest.x : px, oy: near ? rest.y : py, px, py, shot: null, pulled: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!aim || e.pointerId !== aim.id) return;
    const rect = canvas.getBoundingClientRect();
    aim.px = e.clientX - rect.left;
    aim.py = e.clientY - rect.top;
    const dx = aim.px - aim.ox;
    const dy = -(aim.py - aim.oy);
    aim.shot = shotFromDrag(dx, dy, maxPull());
    if (!aim.pulled && aim.shot.power > 0.12) {
      aim.pulled = true;
      play('sling.pull');
    }
  });
  const release = (e) => {
    if (!aim || e.pointerId !== aim.id) return;
    const shot = aim.shot;
    aim = null;
    if (!shot || shot.power < 0.12) return;
    if (battle.shoot(shot)) {
      play('sling.release');
      play('sling.fly');
      landMark = null;
    }
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', () => { aim = null; });

  // React to the events of the rules.
  function handle(events) {
    for (const ev of events) {
      const L = ev.enemy ? look.get(ev.enemy.id) : null;
      switch (ev.type) {
        case 'land':
          dusts.push({ x: ev.x, t0: clock });
          break;
        case 'skill':
          recordSkill(ev.event);
          break;
        case 'hit':
          L.stagger = clock;
          popups.push({ x: ev.enemy.x, y: SIZE.adult + 0.4, text: String(ev.damage), big: ev.combo, t0: clock });
          if (!ev.combo) play('sling.hit');
          break;
        case 'combo':
          play('sling.combo');
          break;
        case 'miss':
          play('sling.miss');
          landMark = { x: ev.x, text: t('slingshot.landed', { n: Math.round(ev.x) }) };
          break;
        case 'duck':
          L.duck = clock;
          break;
        case 'hint':
          // Nghé never says a number: Nghé walks, points at a marker, or stamps the ground.
          if (ev.kind === 'point') {
            glowMarker = ev.at;
            moveNghe(ev.at - 0.9, 0.9, 'point', clock + 5);
          } else {
            glowMarker = null;
            moveNghe(ev.at - 0.2, 0.9, 'stamp', clock + 5);
            setTimeout(() => {
              stamps.push({ x: ev.at, t0: clock });
              dusts.push({ x: ev.at, t0: clock, small: true });
              play('sling.stamp');
            }, 950);
          }
          break;
        case 'retreat':
          L.run = clock;
          play('retreat');
          if (glowMarker !== null || nghe.mode === 'point' || nghe.mode === 'stamp') {
            glowMarker = null;
            stamps = [];
            moveNghe(X.nghe, 0.8, 'idle');
          }
          break;
        case 'nghe':
          play('sling.nghe');
          L.knock = clock;
          moveNghe(ev.enemy.x - 0.9, 0.55, 'charge', clock + 0.9);
          break;
        case 'throw':
          play('sling.throw');
          throws.push({ from: ev.enemy.x, t0: clock });
          break;
        case 'step':
          break;
        case 'blocked':
          popups.push({ x: X.hero + 0.6, y: 1.8, spark: true, t0: clock });
          break;
        case 'hurt':
          heroHurt = clock;
          play('sling.hurt');
          drawHearts();
          break;
        case 'won':
          ended = 'won';
          endAt = clock + 1.6;
          break;
        case 'lost':
          ended = 'lost';
          endAt = clock + 1.4;
          play('sling.loss');
          nghe.nudge = true;
          moveNghe(X.hero - 0.75, 0.6, 'nudge');
          break;
        default:
          break;
      }
    }
  }

  function showEnd() {
    guardBtn.disabled = true;
    ngheBtn.disabled = true;
    const next = new URLSearchParams(location.search);
    const box = h('div', { class: 'sling-end' });
    if (ended === 'won') play('sling.win');
    const again = h('button', { class: `btn ${ended === 'won' ? 'paper' : 'red'}`, type: 'button', text: t('slingshot.again') });
    again.addEventListener('click', () => { next.delete('seed'); location.search = next.toString(); });
    box.append(again);
    if (ended === 'won' && Number(LEVEL) < 3) {
      const go = h('button', { class: 'btn red', type: 'button', text: t('slingshot.next') });
      go.addEventListener('click', () => { next.set('level', String(Number(LEVEL) + 1)); next.delete('seed'); location.search = next.toString(); });
      box.append(go);
    }
    ui.append(box);
  }

  // Drawing of one frame.
  function draw() {
    const ctx = surface.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(background, 0, 0);
    ctx.restore();

    if (glowMarker !== null) drawMarker(ctx, glowMarker, Math.sin(clock * 8) > -0.3);

    // Hoof marks of Nghé at the exact distance.
    for (const st of stamps) {
      const p = toS(st.x, 0);
      ctx.fillStyle = C.ink;
      for (const off of [-5, 5]) {
        ctx.beginPath();
        ctx.ellipse(p.x + off, p.y + 7, 3.5, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // The landing marker of a miss, on the ground.
    if (landMark) {
      const p = toS(landMark.x, 0);
      ctx.font = `600 ${Math.max(13, Math.round(0.36 * k))}px "Be Vietnam Pro", sans-serif`;
      const w = ctx.measureText(landMark.text).width + 14;
      const hh = Math.max(20, 0.55 * k);
      const y = p.y + 16;
      ctx.fillStyle = C.diep;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.6;
      ctx.fillRect(p.x - w / 2, y, w, hh);
      ctx.strokeRect(p.x - w / 2, y, w, hh);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + 2);
      ctx.lineTo(p.x, y);
      ctx.stroke();
      ctx.fillStyle = C.ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(landMark.text, p.x, y + hh / 2 + 1);
    }

    // The wall.
    if (s.wall) {
      shadow(ctx, s.wall.x, 0.9);
      sprite(ctx, art.fence, s.wall.x, 0, s.wall.height, { person: false });
    }

    // Enemies.
    for (const e of s.enemies) {
      const L = look.get(e.id);
      if (L.gone) continue;
      if (e.hp <= 0) {
        // Retreat: run off the right edge.
        const run = Math.max(0, clock - L.run - 0.35);
        const knocked = clock - L.knock < 0.6;
        const x = e.x + run * RUN_SPEED;
        if (toS(x, 0).x > surface.width + 80) {
          L.gone = true;
          continue;
        }
        if (knocked) sprite(ctx, enemyArt[e.kind], e.x + 0.3, 0, SIZE.adult, { flip: true, rot: 0.9 * Math.min(1, (clock - L.knock) / 0.3) });
        else sprite(ctx, art.retreat, x, 0, SIZE.adult, { flip: false });
        continue;
      }
      const st = clock - L.stagger;
      const dx = st < 0.4 ? Math.sin(st * 40) * 0.12 * (1 - st / 0.4) : 0;
      const du = clock - L.duck;
      const squash = du < 0.4 ? 0.8 : 1;
      shadow(ctx, e.x, 0.9);
      sprite(ctx, enemyArt[e.kind], e.x, 0, SIZE.adult, { flip: true, dx, sy: squash });
      // Over the head: the hit points, and the count to the next attack.
      const head = toS(e.x, SIZE.adult * big * squash + 0.15);
      const pip = Math.max(4, 0.1 * k);
      for (let i = 0; i < e.maxHp; i++) {
        ctx.fillStyle = i < e.hp ? C.vermilion : C.paper;
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(head.x + (i - (e.maxHp - 1) / 2) * pip * 2.6, head.y, pip, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      if (s.phase !== 'play') continue;
      const count = battle.countOf(e);
      const danger = count <= 1;
      const r = Math.max(12, 0.3 * k) * (danger ? 1 + 0.12 * Math.sin(clock * 18) : 1);
      const cy = head.y - pip - r - 4;
      ctx.fillStyle = danger ? C.vermilion : C.diep;
      ctx.beginPath();
      ctx.arc(head.x, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = danger ? C.diep : C.ink;
      ctx.font = `700 ${Math.round(r * 1.2)}px Alegreya, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(count), head.x, cy + 1);
    }

    // Nghé: idle, walking, pointing, stamping, charging, or nudging the hero.
    const nx = ngheX();
    const moving = clock - nghe.t0 < nghe.dur;
    let bob = moving ? Math.abs(Math.sin(clock * 16)) * 0.08 : 0;
    let rot = 0;
    if (!moving && nghe.mode === 'point') rot = -0.12 + Math.sin(clock * 6) * 0.05;
    if (!moving && nghe.mode === 'stamp') bob = Math.abs(Math.sin(clock * 10)) * 0.12;
    if (nghe.mode === 'nudge' && !moving) rot = Math.sin(clock * 5) * 0.12;
    if (clock - heroHurt < 0.8) rot = 0.18; // Nghé lowers her horns when the hero is hurt.
    const ngheFlip = nghe.to < nghe.from && moving;
    shadow(ctx, nx, 0.9);
    sprite(ctx, art.nghe, nx, bob, SIZE.nghe, { flip: ngheFlip, rot });
    if (nghe.until && clock > nghe.until && nghe.mode !== 'idle' && nghe.mode !== 'nudge') {
      nghe.until = 0;
      glowMarker = null;
      moveNghe(X.nghe, 0.9, 'idle');
    }

    // The hero and the slingshot.
    const hurtT = clock - heroHurt;
    const sit = ended === 'lost';
    shadow(ctx, X.hero, 0.7);
    sprite(ctx, art.hero, X.hero, sit ? -0.35 : 0, SIZE.child, { dx: hurtT < 0.4 ? Math.sin(hurtT * 50) * 0.06 : 0, sy: sit ? 0.78 : 1 });
    sprite(ctx, art.sling, 0, 0, SIZE.sling, { person: false });
    const prongL = toS(-0.2, 1.08);
    const prongR = toS(0.2, 1.08);
    let pouch = pouchRest();
    if (aim && aim.shot) {
      const pull = Math.min(maxPull(), Math.hypot(aim.px - aim.ox, aim.py - aim.oy));
      const a = aim.shot.angle;
      pouch = { x: pouchRest().x - Math.cos(a) * pull * 0.55, y: pouchRest().y + Math.sin(a) * pull * 0.55 };
      // The dotted preview: the first part of the arc only.
      ctx.fillStyle = C.ink;
      for (const pt of previewPoints(aim.shot)) {
        const p = toS(pt.x, pt.y);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = C.wood;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(prongL.x, prongL.y);
    ctx.lineTo(pouch.x, pouch.y);
    ctx.lineTo(prongR.x, prongR.y);
    ctx.stroke();
    if (!s.stone) {
      const sz = SIZE.stone * k;
      ctx.drawImage(art.stone, pouch.x - sz / 2, pouch.y - sz / 2, sz, sz);
    }

    // The guard shield in front of the hero.
    if (s.time - s.lastGuard < RULES.guardWindow) sprite(ctx, art.shield, X.hero + 0.55, 0.2, SIZE.shield);

    // The stone in flight.
    if (s.stone) {
      const pos = s.stone.fl.at(s.time - s.stone.t0);
      const p = toS(pos.x, pos.y);
      const sz = SIZE.stone * k;
      if (p.y < 0) {
        // Above the screen: a small mark at the top edge.
        ctx.fillStyle = C.ink;
        ctx.beginPath();
        ctx.moveTo(p.x, 4);
        ctx.lineTo(p.x - 7, 16);
        ctx.lineTo(p.x + 7, 16);
        ctx.fill();
      } else ctx.drawImage(art.stone, p.x - sz / 2, p.y - sz / 2, sz, sz);
    }

    // Stones of the enemies.
    for (const th of [...throws]) {
      const u = (clock - th.t0) / RULES.throwFlight;
      if (u >= 1) {
        throws.splice(throws.indexOf(th), 1);
        continue;
      }
      const x = th.from + (X.hero + 0.4 - th.from) * u;
      const y = 1.5 + (1.1 - 1.5) * u + Math.sin(u * Math.PI) * 1.6;
      const p = toS(x, y);
      const sz = SIZE.stone * 0.8 * k;
      ctx.drawImage(art.stone, p.x - sz / 2, p.y - sz / 2, sz, sz);
    }

    // Dust clouds.
    for (const d of [...dusts]) {
      const u = (clock - d.t0) / 0.9;
      if (u >= 1) {
        dusts.splice(dusts.indexOf(d), 1);
        continue;
      }
      const w = (d.small ? 0.8 : 1.3) * (0.7 + u * 0.5);
      sprite(ctx, art.dust, d.x, 0, w / 2, { alpha: 1 - u, person: false });
    }

    // Damage numbers and the "blocked" mark.
    for (const pp of [...popups]) {
      const u = (clock - pp.t0) / (pp.big ? 1.2 : 0.9);
      if (u >= 1) {
        popups.splice(popups.indexOf(pp), 1);
        continue;
      }
      const p = toS(pp.x, pp.y + u * 0.8);
      ctx.globalAlpha = 1 - u * u;
      if (pp.spark) {
        const sz = 0.9 * k * (1 + u * 0.4);
        ctx.drawImage(art.spark, p.x - sz / 2, p.y - sz / 2, sz, sz);
        sprite(ctx, art.shield, pp.x, pp.y - 1.1 + u * 0.8, 0.8);
      } else {
        const size = Math.round((pp.big ? 0.95 : 0.62) * k * (pp.big ? 1 + 0.3 * Math.sin(u * Math.PI) : 1));
        ctx.font = `700 ${size}px Alegreya, serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(3, size / 8);
        ctx.strokeStyle = C.ink;
        ctx.fillStyle = pp.big ? C.yellow : C.vermilion;
        ctx.strokeText(pp.text, p.x, p.y);
        ctx.fillText(pp.text, p.x, p.y);
      }
      ctx.globalAlpha = 1;
    }
  }

  // The loop: the rules move in fixed steps, and the screen draws each frame.
  const STEP = 1 / 120;
  let last = performance.now();
  let acc = 0;
  let endShown = false;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    clock += dt;
    if (!document.hidden) {
      acc += dt;
      while (acc >= STEP) {
        acc -= STEP;
        const events = battle.update(STEP);
        if (events.length) handle(events);
      }
    }
    if (ended && !endShown && clock >= endAt) {
      endShown = true;
      showEnd();
    }
    draw();
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', layout);
  layout();
  // For automatic checks of the prototype.
  window.slingshot = { battle, toS, toWorld, maxPull, pouchRest, get scale() { return k; } };
  requestAnimationFrame(frame);
}

start();
