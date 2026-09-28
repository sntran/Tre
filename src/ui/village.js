// The village scene: the map on the canvas, tap to move with A*, trigger zones,
// people, encounters, the quest goal, and the HUD.
import { createTileMap, findPath, pathNextTo } from '../core/tilemap.js';
import { createTriggers } from '../core/triggers.js';
import { currentGoal } from '../core/quests.js';
import { pickTalk, isPresent, applyEffects, conditionState } from '../core/game.js';
import { createVillageRenderer } from '../render/village.js';
import { createCamera } from '../render/camera.js';
import { bitmap, heroLayers } from '../render/assets.js';
import { h, img, button } from './dom.js';
import { t, tg } from './i18n.js';
import { speak } from './speak.js';
import { runDialogue, say } from './dialogue.js';

const SPEED = 5; // tiles each second

export async function mountVillage(ctx, params = {}) {
  const { data, profile } = ctx;
  const mapData = data.village;
  const T = mapData.tileSize;
  const tileMap = createTileMap(mapData, data.tiles.types);
  const triggers = createTriggers(mapData.triggers);
  const renderer = await createVillageRenderer(mapData, tileMap);
  const camera = createCamera(T);
  const surface = ctx.surface;
  surface.canvas.hidden = false;

  const heroBmp = await bitmap(heroLayers(profile.hero), 2);
  const npcBmps = new Map();
  for (const [id, npc] of Object.entries(data.npcs.npcs)) npcBmps.set(id, await bitmap(npc.art, 2));
  const encBmps = new Map();
  for (const e of mapData.encounters) encBmps.set(e.id, await bitmap(e.art, 2));
  const friendBmps = new Map();
  for (const [id, f] of Object.entries(data.friends?.friends ?? {})) friendBmps.set(id, await bitmap(f.art, 2));

  // The hero.
  const start = params.at ?? (profile.place.x !== null ? { x: profile.place.x, y: profile.place.y } : mapData.spawn);
  const hero = { x: start.x, y: start.y, px: (start.x + 0.5) * T, py: (start.y + 1) * T - 4, path: [], flip: false, walking: false, onArrive: null };
  const follower = { x: start.x, y: start.y, px: hero.px, py: hero.py };
  let tapFx = null;
  let busy = false; // true while a dialogue or a panel is open
  let alive = true;

  // People and encounters stand on tiles and block them.
  let people = [];
  let encounters = [];
  function refreshPeople() {
    tileMap.clearOccupied();
    people = mapData.npcs
      .filter((n) => data.npcs.npcs[n.id] && isPresent(data.npcs.npcs[n.id], profile))
      .map((n) => ({ ...n, def: data.npcs.npcs[n.id] }));
    encounters = mapData.encounters.filter((e) => isPresent(e, profile));
    for (const p of people) tileMap.occupy(p.x, p.y, { kind: 'npc', id: p.id });
    for (const e of encounters) tileMap.occupy(e.x, e.y, { kind: 'encounter', id: e.id });
    if (!tileMap.walkable(hero.x, hero.y) && tileMap.whoAt(hero.x, hero.y)) {
      // Somebody appeared on the tile of the hero: move the hero next to it.
      const near = pathNextTo(tileMap, { x: mapData.spawn.x, y: mapData.spawn.y }, { x: hero.x, y: hero.y });
      const spot = near?.length ? near[near.length - 1] : mapData.spawn;
      placeHero(spot.x, spot.y);
    }
    updateHud();
  }

  function placeHero(x, y) {
    hero.x = x;
    hero.y = y;
    hero.px = (x + 0.5) * T;
    hero.py = (y + 1) * T - 4;
    hero.path = [];
    follower.x = x;
    follower.y = y;
    follower.px = hero.px;
    follower.py = hero.py;
  }

  // HUD
  const hud = h('div', { class: 'hud' });
  const goalBtn = h('button', { class: 'goal', type: 'button' });
  const counts = h('div', { class: 'counts' });
  const heroFace = h('button', { class: 'hud-hero', type: 'button', 'aria-label': t('ui.home') }, [
    h('span', { class: 'mini-portrait' }, heroLayers(profile.hero).map((p) => img(p, 'layer'))),
    h('span', { class: 'hud-name', text: profile.hero.name }),
  ]);
  heroFace.addEventListener('click', () => walkToPerson('grandma'));
  const menuBtn = button(null, () => ctx.openMenu(), { cls: 'icon-btn', icon: 'ui/menu', aria: t('ui.menu') });
  hud.append(heroFace, goalBtn, counts, menuBtn);
  ctx.ui.append(hud);

  let goalKey = null;
  let goalParams = {};
  function updateHud() {
    const goal = currentGoal(data.quests.quests, conditionState(profile));
    if (goal) {
      goalKey = goal.step.goalKey;
      goalParams = goal.progress ?? {};
    } else {
      goalKey = 'quest.free';
      goalParams = {};
    }
    goalBtn.replaceChildren(img('ui/quest', 'btn-icon'), h('span', { text: tg(goalKey, goalParams) }));
    counts.replaceChildren(...data.items.hud.map((item) => h('span', { class: 'count' }, [
      img(data.items.items[item].art, 'count-icon'),
      h('span', { text: String(profile.inventory[item] ?? 0) }),
    ])));
  }
  goalBtn.addEventListener('click', () => speak(goalKey, goalParams, { force: true }));

  // The positions of the quest markers.
  function markers() {
    const goal = currentGoal(data.quests.quests, conditionState(profile));
    if (!goal) return [];
    const step = goal.step;
    const out = [];
    const flags = profile.flags;
    const list = step.targets ?? (step.target ? [{ npc: step.target }] : []);
    for (const tg0 of list) {
      if (tg0.unless && flags[tg0.unless]) continue;
      if (tg0.if && !flags[tg0.if]) continue;
      if (tg0.npc) {
        const p = people.find((x) => x.id === tg0.npc);
        if (p) out.push({ x: (p.x + 0.5) * T, y: p.y * T + T - (p.def.scale ? 100 : 76) });
      }
      if (tg0.encounter) {
        const e = encounters.find((x) => x.id === tg0.encounter);
        if (e) out.push({ x: (e.x + 0.5) * T, y: e.y * T - 20 });
      }
      if (tg0.object) {
        const o = mapData.objects.find((x) => x.id === tg0.object);
        if (o) out.push({ x: (o.x + 0.5) * T, y: o.y * T });
      }
    }
    if (step.place) out.push({ x: (step.place.x + 1) * T, y: step.place.y * T });
    return out;
  }

  // Input: tap to move.
  function onPointer(e) {
    if (busy || !alive) return;
    const rect = surface.canvas.getBoundingClientRect();
    const w = camera.toWorld(e.clientX - rect.left, e.clientY - rect.top);
    const tx = Math.floor(w.x / T);
    const ty = Math.floor(w.y / T);
    if (!tileMap.inside(tx, ty)) return;
    ctx.bus.emit('sound', 'tap');
    tapFx = { x: w.x, y: w.y, age: 0 };
    const who = tileMap.whoAt(tx, ty);
    const from = { x: hero.x, y: hero.y };
    if (who) {
      goTo(pathNextTo(tileMap, from, { x: tx, y: ty }), () => interact(who, tx, ty));
      return;
    }
    const tapZone = triggers.fire('tap', tx, ty, conditionState(profile));
    if (tapZone) {
      const path = tileMap.walkable(tx, ty) ? findPath(tileMap, from, { x: tx, y: ty }) : pathNextTo(tileMap, from, { x: tx, y: ty });
      goTo(path, () => doAction(tapZone));
      return;
    }
    if (tileMap.walkable(tx, ty)) goTo(findPath(tileMap, from, { x: tx, y: ty }), null);
    else goTo(pathNextTo(tileMap, from, { x: tx, y: ty }), null);
  }
  surface.canvas.addEventListener('pointerdown', onPointer);

  function goTo(path, onArrive) {
    if (!path) return;
    hero.path = path;
    hero.onArrive = onArrive;
    if (path.length === 0 && onArrive) {
      hero.onArrive = null;
      onArrive();
    }
  }

  function walkToPerson(id) {
    const p = people.find((x) => x.id === id);
    if (!p || busy) return;
    goTo(pathNextTo(tileMap, { x: hero.x, y: hero.y }, p), () => interact({ kind: 'npc', id }, p.x, p.y));
  }

  async function withBusy(fn) {
    busy = true;
    hero.path = [];
    try {
      return await fn();
    } finally {
      busy = false;
      if (alive) refreshPeople();
    }
  }

  async function talk(dialogueId) {
    if (!dialogueId) return;
    const commands = await withBusy(() => runDialogue(ctx, dialogueId));
    await handleCommands(commands);
  }

  // Open the screens that a dialogue asks for, one after the other.
  // ctx.open() returns false when the village scene closes (for example for a battle).
  async function handleCommands(commands) {
    for (const c of commands) {
      if (!c.open || !alive) continue;
      profile.place = { map: mapData.id, x: hero.x, y: hero.y };
      const stay = await withBusy(() => ctx.open(c, { village: api }));
      if (!stay) return;
    }
  }

  async function interact(who, x, y) {
    hero.flip = x < hero.x;
    if (who.kind === 'npc') {
      const npc = data.npcs.npcs[who.id];
      await talk(pickTalk(npc, profile));
    } else if (who.kind === 'encounter') {
      const enc = mapData.encounters.find((e) => e.id === who.id);
      await withBusy(() => ctx.confirmBattle(enc.battle));
    }
  }

  async function doAction(zone) {
    const a = zone.action;
    if (zone.once) profile.flags[`zone.${zone.id}`] = true;
    if (a.talk) {
      walkToPerson(a.talk);
      return;
    }
    if (a.pickup || a.set) {
      const { changes } = applyEffects(profile, [{ give: a.pickup, set: a.set }]);
      ctx.bus.emit('sound', 'pickup');
      ctx.save('pickup');
      await withBusy(() => say(ctx, a.textKey, { n: Object.values(changes.items)[0] ?? 0 }));
      return;
    }
    if (a.textKey) await withBusy(() => say(ctx, a.textKey));
    if (a.open) await handleCommands([{ open: a.open }]);
  }

  // The frame loop.
  let last = performance.now();
  let time = 0;
  function frame(now) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    step(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function step(dt) {
    if (tapFx) tapFx.age += dt;
    hero.walking = hero.path.length > 0;
    if (hero.path.length) {
      const next = hero.path[0];
      const tx = (next.x + 0.5) * T;
      const ty = (next.y + 1) * T - 4;
      const dx = tx - hero.px;
      const dy = ty - hero.py;
      const dist = Math.hypot(dx, dy);
      const move = SPEED * T * dt;
      if (dx !== 0) hero.flip = dx < 0;
      if (dist <= move) {
        hero.px = tx;
        hero.py = ty;
        follower.x = hero.x;
        follower.y = hero.y;
        hero.x = next.x;
        hero.y = next.y;
        hero.path.shift();
        const zone = triggers.fire('enter', hero.x, hero.y, conditionState(profile));
        if (zone) {
          hero.path = [];
          hero.onArrive = null;
          doAction(zone);
        } else if (hero.path.length === 0 && hero.onArrive) {
          const fn = hero.onArrive;
          hero.onArrive = null;
          fn();
        }
      } else {
        hero.px += (dx / dist) * move;
        hero.py += (dy / dist) * move;
      }
    }
    // The friend walks one tile behind the hero.
    const fx = (follower.x + 0.5) * T;
    const fy = (follower.y + 1) * T - 4;
    follower.px += (fx - follower.px) * Math.min(1, dt * 8);
    follower.py += (fy - follower.py) * Math.min(1, dt * 8);
  }

  function draw() {
    camera.fit(surface.width, surface.height, renderer.width, renderer.height);
    camera.follow(hero.px, hero.py - T / 2);
    const sprites = [];
    for (const p of people) {
      const bmp = npcBmps.get(p.id);
      sprites.push({ bmp, x: (p.x + 0.5) * T, y: (p.y + 1) * T - 4, scale: p.def.scale ?? 0.52, flip: p.x > hero.x });
    }
    for (const e of encounters) {
      sprites.push({ bmp: encBmps.get(e.id), x: (e.x + 0.5) * T, y: (e.y + 1) * T - 4, scale: e.art.includes('serpent') ? 0.5 : e.art.includes('general') ? 0.5 : 0.52, flip: true });
    }
    const friendId = profile.party[0];
    if (friendId && friendBmps.has(friendId) && (follower.x !== hero.x || follower.y !== hero.y || hero.walking)) {
      sprites.push({ bmp: friendBmps.get(friendId), x: follower.px - (hero.flip ? -10 : 10), y: follower.py, scale: 0.36, flip: hero.flip, walking: hero.walking });
    } else if (friendId && friendBmps.has(friendId)) {
      sprites.push({ bmp: friendBmps.get(friendId), x: hero.px + (hero.flip ? 26 : -26), y: hero.py, scale: 0.36, flip: hero.flip });
    }
    sprites.push({ bmp: heroBmp, x: hero.px, y: hero.py, scale: 0.52, flip: hero.flip, walking: hero.walking });
    renderer.draw(surface, { camera, sprites, markers: markers(), tap: tapFx }, time);
  }

  const api = {
    refresh: () => refreshPeople(),
    talk,
    heroTile: () => ({ x: hero.x, y: hero.y }),
    placeHero,
  };

  refreshPeople();
  requestAnimationFrame(frame);

  // Events after the scene starts (for example the story after a battle).
  queueMicrotask(async () => {
    if (!profile.flags['intro.seen']) await talk('grandma.intro');
    for (const id of params.after ?? []) if (alive) await talk(id);
  });

  return {
    unmount() {
      alive = false;
      profile.place = { map: mapData.id, x: hero.x, y: hero.y };
      surface.canvas.removeEventListener('pointerdown', onPointer);
      hud.remove();
    },
    api,
  };
}
