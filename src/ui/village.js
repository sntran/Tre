// The village scene: a thin view over the session of the village (src/core/session.js). The
// session owns the world state and the story logic; this file draws the state, turns the input
// into commands, and reacts to the events: the dialogue box, the screens, the sounds, the HUD,
// and the marks over the world.
import { currentGoal } from '../core/quests.js';
import { questMark } from '../core/clues.js';
import { conditionState } from '../core/game.js';
import { edgeMarker } from '../core/hit.js';
import { portraitCanvas, heroLookOf, speakerLookOf, prerender, portraitStats } from './portraits.js';
import { keysToScreenDir, stickToScreenDir, screenToMap } from '../core/world/move.js';
import { getEntity, query } from '../core/world/state.js';
import { basketOf } from '../core/items.js';
import { STEP } from '../core/world/step.js';
import { gustsAt, windyOn, dayIndex, mealAt, isTet, rareOn, starOn, puddlesAt } from '../core/world/ambient.js';
import { rainOf } from '../core/world/systems/sky.js';
import { createSession, middleOf } from '../core/session.js';
import { createHearing } from '../core/hearing.js';
import { LINE_LIFE, lineLife, linesAfter, nearHero as talksNear } from '../core/lines.js';
import { placeStar, placeArrow, placeBubble, AWAY_LIFE } from '../world/marks.js';
import { practiceStart, activityOf } from '../core/practice.js';
import { createTerrain, columnTop, CHUNK } from '../world/terrain.js';
import { WATER_KINDS } from '../world/chunks.js';
import { workBoxes, workTurn } from '../world/fade.js';
import { VIEW, viewSize, inView, leadFocus } from '../world/view.js';
import { heroLook, thingLook } from '../world/figures.js';
import { tapTarget, thingUnder } from '../world/hit.js';
import { h, img, button } from './dom.js';
import { t, tn, setSpeech } from './i18n.js';
import { speechTable, speechWay } from '../core/speech.js';
import { speak } from './speak.js';
import { createDialogueBox, glossLine } from './dialogue.js';
import { createRaidView } from './raid.js';
import { createStream } from './stream.js';
import { landStore } from './landstore.js';
import { formatTimes } from '../core/loading.js';
import { keyAct } from '../core/keys.js';

const STICK_R = 56; // the radius of the virtual stick, in screen pixels
// The color of the dusk wash at full night: the hue of indigo (#2f4668) in the palette.
const DUSK = Object.freeze({ hue: 215, saturation: 45, lightness: 42 });
const WARM_MS = 40; // the time to build near chunks in each frame of the loading screen
const WARM_WAIT_MS = 6000; // after this time, the near land that did not come is made at once
const HOLD_MS = 220; // a press this long is a hold (walk toward the finger), not a tap

// three.js and the drawing code load only when the village opens, so that the other screens
// work without them. The terrain of a map takes some time to make: keep it for the next visit.
let drawing = null;
const terrains = new Map();
const worlds = new Map();
const streams = new Map(); // the streams of the land (src/ui/stream.js), by the key of the map

async function loadDrawing() {
  drawing ??= Promise.all([import('../render/voxel.js'), import('../render/figure3d.js'), import('../render/ambient3d.js'), import('../render/folk3d.js')])
    .then(([voxel, figure, ambient, folk]) => ({ ...voxel, ...figure, ...ambient, ...folk }))
    .catch((e) => {
      drawing = null;
      throw e;
    });
  return drawing;
}

// A shooting star crosses the sky in this many game minutes (about two seconds of play).
const STAR_MINUTES = 6;

// The terrain of a map, made once for a map and its seed (its pages are pure; a new session loads
// the changes of its save into it).
export function terrainOf(map, tileTypes, tileMap, blocks = null) {
  const key = map.key ?? map.id;
  if (!terrains.has(key)) {
    for (const k of terrains.keys()) if (k.startsWith(`${map.id}:`)) terrains.delete(k);
    terrains.set(key, createTerrain(map, tileTypes, tileMap, blocks));
  }
  return terrains.get(key);
}

// A clear message when the device cannot draw the world.
function noWorld(ctx) {
  ctx.endLoading();
  const box = h('div', { class: 'screen no-webgl' }, [
    h('div', { class: 'panel' }, [
      h('p', { text: t('ui.webgl.missing') }),
      button(t('ui.menu'), () => ctx.openMenu(), { cls: 'btn big' }),
    ]),
  ]);
  ctx.ui.append(box);
  return { unmount() { box.remove(); }, api: null };
}

// A new session of the village for the profile of the game.
export function villageSession(ctx) {
  return createSession({
    data: ctx.data,
    profile: ctx.profile,
    learner: () => ctx.learner,
    log: (kind, fields) => ctx.log(kind, fields),
    save: (reason) => ctx.save(reason),
    terrainOf: (map, tileMap) => terrainOf(map, ctx.data.tiles.types, tileMap, ctx.data.blocks),
    switches: ctx.experiments?.switches ?? null,
  });
}

// Load the height tiles of the land tiles around a cell of a map on the plane (5 x 5 land tiles,
// as the stream asks for them: src/ui/stream.js).
async function loadHeightsNear(data, map, x, y) {
  if (!map.land?.needs || !data.moreHeights) return;
  const tx = Math.floor(x / 64);
  const tz = Math.floor(y / 64);
  const names = new Set();
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) for (const n of map.land.needs(tx + dx, tz + dz)) if (!data.heights.has(n)) names.add(n);
  if (names.size) await data.moreHeights([...names]);
}

// The stream of the land of a map (one map at a time).
function streamOf(map, data) {
  if (!streams.has(map.key)) {
    for (const [k, st] of streams) {
      st.dispose();
      streams.delete(k);
    }
    streams.set(map.key, createStream(map, data, { store: landStore() }));
  }
  return streams.get(map.key);
}

// params: map, at, facing, after (talks after the start), arrive (the map name shows), session (a
// session that already started, after an exit to this map), and practice (the activity of a
// practice link: the visit starts at its place, src/core/practice.js).
export async function mountVillage(ctx, params = {}) {
  const { data, profile } = ctx;
  const canvas = ctx.voxel;
  // The loading screen (src/ui/loading.js) shows the steps of the load; each step lets one frame
  // draw the screen before it goes on.
  const loading = ctx.loading ?? null;
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  const next = async (step) => {
    if (!loading) return;
    loading.report(step);
    await nextFrame();
  };

  // The drawing code loads from the start, at the same time as the data and the land (#36).
  const drawingCode = loadDrawing();
  drawingCode.catch(() => {});
  const session = params.session ?? villageSession(ctx);
  let begin = null; // the start of the session, after the land around the hero is made
  if (!params.session) {
    // A visit from a practice link: the place, the clock, and the practice of the activity.
    const visit = params.practice ? practiceStart(data, profile, params.practice) : null;
    if (visit) ctx.practiceId = params.practice.id;
    const mapId = visit?.map ?? params.map ?? null;
    const at = visit?.at ?? params.at;
    // The height tiles of the land around the start come first (the land of a tile waits for them).
    const where = session.startPlace(mapId, { at });
    // The land of the first view: the tiles that the device keeps come at once; the workers make
    // the others (each one loads its height tiles first) while the drawing code loads.
    streamOf(where.map, data).update(where.x, where.y);
    await next('heights');
    await loadHeightsNear(data, where.map, where.x, where.y);
    begin = { mapId, where, opts: { at, facing: params.facing, after: params.after, ...(visit ? { clock: visit.clock, practice: visit.practice } : {}) } };
  }

  let D;
  try {
    await next('code');
    D = await drawingCode;
  } catch (e) {
    console.error('The drawing code did not load', e);
    return noWorld(ctx);
  }
  if (!D.hasWebGL()) return noWorld(ctx);

  if (begin) {
    // The land tiles of the first view around the hero, from the store of the device or from the
    // workers (the rest of the ring comes after the first frame); land that does not come in time
    // (no worker, no height tiles offline) is made at once by the start of the session.
    if (loading) {
      const stream = streamOf(begin.where.map, data);
      const t0 = performance.now();
      for (;;) {
        stream.update(begin.where.x, begin.where.y);
        const n = stream.firstView(begin.where.x, begin.where.y);
        loading.report('land', n.ready / n.total);
        if (n.ready === n.total || performance.now() - t0 > WARM_WAIT_MS) break;
        await nextFrame();
      }
    }
    await next('world');
    session.start(begin.mapId, begin.opts);
  }
  canvas.hidden = false;
  const mapData = session.map;
  const tileMap = session.tileMap;
  const terrain = session.terrain;
  // The people of the region speak the words of its way (data/world/speech.json, #39).
  setSpeech(speechTable(data.speech, speechWay(data.regions, session.map.region)));
  const state = session.state;
  const hearing = createHearing();
  // One view for each map, made once for its terrain. The far land and the mist fade into the
  // paper (mistAt: 0 in the land of the era, 1 deep in the mist).
  const fadeCells = mapData.mist?.fade ?? 12;
  // The land around the hero is made in the workers before the hero and the view need it.
  const stream = streamOf(mapData, data);
  if (worlds.get(mapData.id)?.terrain !== terrain) {
    worlds.get(mapData.id)?.view.dispose();
    worlds.set(mapData.id, { terrain, view: D.createVoxelWorld(canvas, terrain, {
      ready: (cx, cz) => stream.ready(cx * CHUNK - 10, cz * CHUNK - 10, cx * CHUNK + CHUNK + 10, cz * CHUNK + CHUNK + 10),
      mistAt: (x, z) => Math.min(1, (session.tileMap.mistAt?.(Math.floor(x), Math.floor(z)) ?? 0) / fadeCells),
      waterAt: (x, z) => WATER_KINDS[session.tileMap.type(Math.floor(x), Math.floor(z))] ?? null,
    }) });
  }
  const view = worlds.get(mapData.id).view;
  const looks = data.figures.figures;
  // The portraits of the hero, Nghé, and the people of this map, before any dialogue opens (after
  // the loading screen, so that they do not take the frames of the load).
  const prerenderAll = () => prerender(ctx, [
    { look: heroLookOf(ctx), size: 44 },
    ...['hero', 'nghe', ...mapData.npcs.map((n) => n.id)].map((id) => ({ look: speakerLookOf(ctx, id), size: 96 })),
  ]);
  if (!loading) prerenderAll();
  // The world at rest: the smoke of the kitchens, the steam of the rice pot, the incense of the đình,
  // butterflies, a dragonfly, and a fish at the ford (src/render/ambient3d.js).
  const places = session.env.places;
  // The things near the hero (the pages change as the hero walks: the lists come again then).
  const nearHero = (list, x = (o) => o.x, z = (o) => o.z) => {
    const h = getEntity(state, 'hero')?.position;
    return h ? list.filter((o) => Math.abs(x(o) - h.x / 2) < CHUNK * 3 && Math.abs(z(o) - h.z / 2) < CHUNK * 3) : list;
  };
  let near = null;
  let nearVersion = -1;
  const nearby = () => {
    const h = getEntity(state, 'hero')?.position;
    const at = `${terrain.version}:${Math.floor((h?.x ?? 0) / 2 / CHUNK)},${Math.floor((h?.z ?? 0) / 2 / CHUNK)}`;
    if (at !== nearVersion) {
      nearVersion = at;
      const objWorld = (kinds) => terrain.objects.filter((o) => kinds.includes(o.kind) && !o.gone).map((o) => terrain.boxOf(o));
      near = {
        // The smoke comes out at the ridge of the roof, a little off its middle (fine units in the roof).
        kitchens: nearHero(terrain.roofs
          .filter((r) => terrain.objects.some((o) => o.who === r.who && ['house', 'giong-house', 'hut'].includes(o.kind)))
          .map((r) => ({ x: (r.x0 + r.x1) / 4 + 0.8, y: (r.y + r.ridgeH) / 2 + 0.2, z: (r.z0 + r.z1) / 4 }))),
        incense: objWorld(['dinh']).map((b) => ({ x: (b.x0 + b.x1) / 2, y: b.y0 + 4.3, z: b.z1 - 3 })),
        flowers: nearHero(terrain.flowers),
        paddies: nearHero(terrain.paddies),
        fords: nearHero(terrain.water.filter((w) => w.ford)),
        crowns: nearHero(terrain.smooth.filter((c) => c.kind === 'crown').map((c) => ({ x: c.x, y: c.y, z: c.z, r: c.r }))),
      };
    }
    return near;
  };
  // The lines of the court of nhảy lò cò and the rope of nhảy dây (src/render/folk3d.js).
  const folkLayer = D.createFolkLayer(view.scene);
  const motes = D.createAmbient(view.scene, {
    get kitchens() { return nearby().kitchens; },
    pots: places['giong-pot'] ? [{ x: places['giong-pot'].x / 2 + 0.5, y: places['giong-pot'].y / 2 + 1.1, z: places['giong-pot'].z / 2 + 0.6 }] : [],
    get incense() { return nearby().incense; },
    get flowers() { return nearby().flowers; },
    get paddies() { return nearby().paddies; },
    get fords() { return nearby().fords; },
    // The small joys of the view: the pot of bánh chưng at Tết, the doors of the houses (couplets),
    // and the crowns of the trees (peach blossoms).
    tetPots: state.entities.filter((e) => e.kind === 'banh-chung').map((e) => ({ x: e.position.x / 2, y: e.position.y / 2 + 2.2, z: e.position.z / 2 })),
    get doors() { return nearHero(Object.values(session.env.homes).map((w) => ({ x: w.door.x / 2, y: w.door.y / 2, z: w.door.z / 2 }))); },
    get crowns() { return nearby().crowns; },
  });
  // A villager of a generated hamlet has a look from parts in the map (by its id).
  // A thing in the hands has the look of the thing itself (src/world/carry.js).
  const lookOfKey = (key) => looks[key] ?? thingLook(key) ?? mapData.looks?.[key] ?? {};
  const figures = D.createFigureLayer(view.scene, (key, carry) => ({ ...(key === 'hero' ? heroLook(profile.hero, data.figures.hero) : lookOfKey(key)), ...(carry ? { item: carry, carried: lookOfKey(carry), carryRules: data.figures.carry } : {}) }), { camera: view.camera, zoom: () => view.state.level, mistAt: (x, z) => Math.min(1, (session.tileMap.mistAt?.(Math.floor(x), Math.floor(z)) ?? 0) / fadeCells) });

  // The height of the ground under a map point (world units).
  const groundY = (x, y) => columnTop(tileMap.heightAt(Math.floor(x), Math.floor(y)));
  const hero = () => getEntity(state, 'hero');
  const heroCell = () => session.heroCell();
  const persons = () => session.persons();
  const send = (cmd) => {
    session.command(cmd);
    flush();
  };

  let tapFx = null;
  let busy = session.busy; // true while a dialogue or a panel is open
  let alive = true;
  ctx.syncWorld = session.syncSave;

  // HUD
  const hud = h('div', { class: 'hud' });
  const goalBtn = h('button', { class: 'goal', type: 'button' });
  const counts = h('div', { class: 'counts' });
  // The counter of rice shows the basket of the household; the other goods of the basket fly to it.
  const BASKET = data.items.basket?.[0] ?? null;
  const slotOf = (item) => (data.items.basket?.includes(item) ? BASKET : item);
  const heroFace = h('button', { class: 'hud-hero', type: 'button', 'aria-label': t('ui.home') }, [
    h('span', { class: 'mini-portrait' }, [portraitCanvas(ctx, heroLookOf(ctx), { size: 44 })]),
    h('span', { class: 'hud-name', text: profile.hero.name }),
  ]);
  heroFace.addEventListener('click', () => send({ type: 'talkTo', id: 'grandma' }));
  const menuBtn = button(null, () => { ctx.log('action', { kind: 'menu' }); ctx.openMenu(); }, { cls: 'icon-btn', icon: 'ui/menu', aria: t('ui.menu') });
  // The country map. The world waits while it is open.
  const mapBtn = button(null, () => {
    ctx.log('action', { kind: 'travel' });
    if (!busy) send({ type: 'travel' });
  }, { cls: 'icon-btn map-btn', icon: 'ui/map', aria: t('ui.worldmap') });
  hud.append(heroFace, goalBtn, counts, mapBtn, menuBtn);
  // Buttons that turn the view in steps of 90°.
  const turnLeft = h('button', { class: 'turn-btn', type: 'button', 'aria-label': t('ui.turn.left'), title: t('ui.turn.left'), text: '⟲' });
  const turnRight = h('button', { class: 'turn-btn', type: 'button', 'aria-label': t('ui.turn.right'), title: t('ui.turn.right'), text: '⟳' });
  turnLeft.addEventListener('click', () => view.turn(-1));
  turnRight.addEventListener('click', () => view.turn(1));
  // The wave: the child calls the person of the task near the hero (docs/MENTOR.md). It shows only
  // at a task with a mentor.
  const waveBtn = h('button', { class: 'turn-btn wave-btn', type: 'button', hidden: true, 'aria-label': t('ui.wave'), title: t('ui.wave') }, [img('ui/wave', 'btn-icon')]);
  waveBtn.addEventListener('click', () => send({ type: 'wave' }));
  // The jump (src/core/world/jump.js): a round button at the bottom right, and Space (or J).
  const jumpBtn = h('button', { class: 'turn-btn jump-btn', type: 'button', 'aria-label': t('ui.jump'), title: t('ui.jump') }, [img('ui/jump', 'btn-icon')]);
  // A press jumps at once; its end tells the length of the press (on the court of nhảy lò cò a long
  // press hops two squares, over the shard).
  let jumpDown = null;
  jumpBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    jumpDown = performance.now();
    send({ type: 'jump' });
  });
  const jumpEnd = () => {
    if (jumpDown === null) return;
    send({ type: 'jumpUp', held: (performance.now() - jumpDown) / 1000 });
    jumpDown = null;
  };
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) jumpBtn.addEventListener(ev, jumpEnd);
  // The action button (docs/TASKS.md): the hands, and the finish of a task in reach, as E. It
  // shows a picture of what it will do now, and it is dim when there is nothing to do. While the
  // jar of feed is in reach, the button pours as long as the finger stays on it.
  const actIcon = img('ui/hand-pick', 'btn-icon');
  // The thing in the hands: a small picture of it in the corner of the button (#43), so that the
  // child sees what the hero carries also when the hero is small on a phone.
  const actThing = h('span', { class: 'act-thing', hidden: true });
  const actBtn = h('button', { class: 'turn-btn act-btn dim', type: 'button', 'aria-label': t('ui.action'), title: t('ui.action') }, [actIcon, actThing]);
  let actCarry = null;
  let actNow = null;
  let actHold = false;
  actBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (busy || !actNow) return;
    if (actNow.hold) {
      actHold = true;
      send({ type: 'hold', on: true });
    } else send({ type: 'hands' });
  });
  const actUp = () => {
    if (!actHold) return;
    actHold = false;
    send({ type: 'hold', on: false });
  };
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) actBtn.addEventListener(ev, actUp);
  // The picture of the button follows the hands and the task in reach.
  let actWait = 0;
  function updateAction(dt) {
    actWait -= dt;
    if (actWait > 0) return;
    actWait = 0.15;
    const a = busy ? null : session.action();
    const icon = a?.icon ?? 'hand-pick';
    if (icon !== actNow?.icon) actIcon.src = actIcon.src.replace(/ui\/[a-z-]+\.svg/, `ui/${icon}.svg`);
    actBtn.classList.toggle('dim', !a);
    actNow = a;
    const carry = busy ? actCarry : session.carried();
    if (carry !== actCarry) {
      actCarry = carry;
      actThing.hidden = !carry;
      actThing.replaceChildren(...(carry ? [portraitCanvas(ctx, lookOfKey(carry), { framing: 'full', size: 34, cls: 'act-thing-pic' })] : []));
    }
    // The target has a thicker outline and a soft light; a thing on a line shows as a ghost.
    figures.mark(a?.target ?? null, a?.spot ?? null, a?.ghost ?? null);
  }
  // The buttons are a block of two columns at the bottom right, away from the stick at the bottom
  // left (#44): the wave over the jump, the two turns over the big button.
  const turns = h('div', { class: 'turns' }, [waveBtn, h('div', { class: 'turn-pair' }, [turnLeft, turnRight]), jumpBtn, actBtn]);
  // The paper of the print over the world: grain and a soft vignette.
  const paper = h('div', { class: 'world-paper' });
  // The dusk over the world: an indigo wash with warm pools around the lanterns, and the rain.
  const duskLayer = h('canvas', { class: 'world-dusk' });
  // The hue of the dusk: a layer in the indigo of the palette with the blend mode "color", so that
  // the yellow paper turns blue as the light goes (a multiply alone makes it gray on the way).
  const duskTint = h('div', { class: 'world-dusk-tint' });
  // The warm light of the lanterns on top (blend mode "screen": it adds light to the indigo).
  const glowLayer = h('canvas', { class: 'world-glow' });
  const glow = glowLayer.getContext('2d');
  const dusk = duskLayer.getContext('2d');
  const drops = Array.from({ length: 140 }, (_, i) => ({ x: (i * 97) % 1000 / 1000, y: (i * 61) % 1000 / 1000, s: 0.7 + ((i * 13) % 10) / 20 }));
  // The marks of a raid: the dotted arc of the slingshot, the flow of an element, the dots over
  // the enemies (src/ui/raid.js).
  const raidLayer = h('canvas', { class: 'world-raid', hidden: true });
  const raidView = createRaidView({ view, figures, session, layer: raidLayer, send });
  // The layer of the marks on the world: the quest stars, the arrows at the edge, the tap ring.
  const marks = h('div', { class: 'world-marks' });
  const ring = h('div', { class: 'tap-ring', hidden: true });
  const stickEl = h('div', { class: 'stick', hidden: true }, [h('div', { class: 'stick-knob' })]);
  marks.append(ring, stickEl);
  // A dark layer for the change of map, and the name of the new map.
  const fade = h('div', { class: params.arrive ? 'map-fade on' : 'map-fade' });
  const banner = params.arrive ? h('div', { class: 'map-name', text: t(mapData.nameKey) }) : null;
  ctx.ui.append(duskTint, duskLayer, glowLayer, paper, raidLayer, marks, hud, turns, fade, ...(banner ? [banner] : []));
  if (params.arrive) {
    requestAnimationFrame(() => requestAnimationFrame(() => fade.classList.remove('on')));
    setTimeout(() => banner?.remove(), 2600);
  }

  let goalKey = null;
  let goalParams = {};
  const flying = {}; // items on their way to the counters of the HUD
  function updateHud() {
    // In a visit from a practice link, the quest bar shows the activity (until the child stays).
    const pr = session.practice;
    // A child who stays plays on in the practice: the bar still shows the activity (#48).
    const activity = pr ? activityOf(data.practice, pr.id) : null;
    const goal = activity ? null : currentGoal(data.quests.quests, conditionState(profile));
    if (activity) {
      // What to do there (a practice of a whole place), or the name of the activity.
      goalKey = activity.goalKey ?? activity.titleKey;
      goalParams = {};
    } else if (goal) {
      goalKey = goal.step.goalKey;
      goalParams = goal.progress ?? {};
    } else {
      goalKey = 'quest.free';
      goalParams = {};
    }
    // The quest bar has short text only. The dialogues give the long explanations.
    // A count shows as things, not numerals (docs/QUESTIONS.md, 76): a small thing for each one that
    // the step needs, filled for each one that the child has.
    // The work of a trial counts as things too (the bundles of the teacher, #48).
    const work = session.workCount();
    const count = work ?? (goal?.progress && goal.step.pip ? { pip: goal.step.pip, ...goal.progress } : null);
    const pips = count
      ? [h('span', { class: 'goal-pips', 'aria-hidden': 'true' }, Array.from({ length: count.need }, (_, i) => h('i', { class: `pip pip-${count.pip}${i < count.have ? ' on' : ''}` })))]
      : [];
    goalBtn.replaceChildren(img('ui/quest', 'btn-icon'), h('span', { class: 'goal-text', text: tn(goalKey, goalParams) }), ...pips);
    // A thing on its way to the basket is not in the count yet: the count ticks up when it lands.
    // The counter of rice is the basket of the household (#26): a tap opens it.
    counts.replaceChildren(...data.items.hud.map((item) => {
      const basket = item === BASKET;
      const el = h(basket ? 'button' : 'span', { class: `count${basket ? ' basket' : ''}`, dataset: { item }, ...(basket ? { type: 'button', 'aria-label': t('basket.title') } : {}) }, [
        img(basket ? data.items.basketArt : data.items.items[item].art, 'count-icon'),
        h('span', { text: String((profile.inventory[item] ?? 0) - (flying[item] ?? 0)) }),
      ]);
      if (basket) el.addEventListener('click', openBasket);
      return el;
    }));
  }
  goalBtn.addEventListener('click', () => speak(goalKey, goalParams, { force: true }));
  // The basket of the household: all the goods of barter, with the count of each (#26).
  function openBasket() {
    ctx.log('action', { kind: 'basket' });
    const layer = h('div', { class: 'modal-layer' });
    const close = () => layer.remove();
    const rows = basketOf(data.items, profile.inventory).map(({ id, n }) => h('li', { class: 'basket-row' }, [
      img(data.items.items[id].art, 'count-icon'),
      h('span', { class: 'basket-name', text: t(data.items.items[id].nameKey) }),
      h('span', { class: 'basket-n', text: String(n) }),
    ]));
    layer.append(h('div', { class: 'panel basket-panel' }, [
      h('div', { class: 'panel-head' }, [h('h2', { text: t('basket.title') }), button(null, close, { cls: 'icon-btn', icon: 'ui/close', aria: t('ui.close') })]),
      h('ul', { class: 'basket-list' }, rows),
    ]));
    layer.addEventListener('click', (e) => { if (e.target === layer) close(); });
    ctx.ui.append(layer);
  }

  // The top of a figure, for its quest star (world units).
  const figureTop = (id) => {
    const f = figures.placeOf(id);
    return f ? f.y + f.height + 0.6 : null;
  };
  const objectOf = (id) => terrain.objects.find((o) => o.id === id);

  // The quest markers: world points { x, y (map), h (height) }. In a practice of a whole place, the
  // star of a task is over the person of each station (#37).
  function markers() {
    const stationIds = session.stations();
    if (stationIds.length) {
      return persons().filter((p) => p.kind === 'npc' && stationIds.includes(p.ref)).map((p) => ({ p, top: figureTop(p.entity) }))
        .filter((m) => m.top !== null).map(({ p, top }) => ({ x: p.x, y: p.y, h: top, id: p.entity }));
    }
    const goal = currentGoal(data.quests.quests, conditionState(profile));
    if (!goal) return [];
    const stepGoal = goal.step;
    const out = [];
    const flags = profile.flags;
    const list = stepGoal.targets ?? (stepGoal.target ? [{ npc: stepGoal.target }] : []);
    const here = persons();
    // A person of the quest away from the live chunks: the marker is at the place of the person on
    // the map (the arrow at the edge of the screen shows the way).
    const away = (kind, id) => {
      const item = (kind === 'npc' ? mapData.npcs : mapData.encounters).find((x) => x.id === id);
      if (item) out.push({ x: item.x, y: item.y, h: groundY(item.x, item.y) + 3 });
    };
    for (const tg of list) {
      if (tg.unless && flags[tg.unless]) continue;
      if (tg.if && !flags[tg.if]) continue;
      for (const kind of ['npc', 'encounter']) {
        if (!tg[kind]) continue;
        const p = here.find((x) => x.kind === kind && x.ref === tg[kind]);
        const top = p ? figureTop(p.entity) : null;
        if (top !== null) out.push({ x: p.x, y: p.y, h: top });
        else if (!p) away(kind, tg[kind]);
      }
      if (tg.object) {
        const o = mapData.layers.objects.find((x) => x.id === tg.object);
        const thing = objectOf(tg.object);
        if (o) out.push({ x: o.x + o.w / 2, y: o.y + o.h / 2, h: (thing ? terrain.boxOf(thing).y1 : groundY(o.x, o.y) + 2) + 0.8 });
      }
    }
    if (stepGoal.place && (stepGoal.place.map ?? mapData.id) === mapData.id) out.push({ x: stepGoal.place.x + 1, y: stepGoal.place.y + 0.5, h: groundY(stepGoal.place.x, stepGoal.place.y) + 3 });
    // A place that the hero did not find yet (Trâu Sơn, #27): the mark shows only the way.
    if (!data.clues || !data.world?.at) return out;
    const h = hero().position;
    return out.map((m) => questMark(data.clues, data.world.at, flags, m, { x: h.x / 2, y: h.z / 2 }));
  }

  // Screens: the session opens them, the view shows them and tells the session when they close.
  let box = null;
  const book = ctx.storybook ?? null; // a story of the storybook (src/ui/storybook.js)
  let bookScreen = null;
  function openScreen(ev) {
    if (ev.screen === 'dialogue' || ev.screen === 'say') {
      // A line in the box is a new line of its speaker: the lines of the other people go.
      talkOver(`npc:${ev.speaker}`);
      box ??= createDialogueBox(ctx, { next: () => send({ type: 'next' }), choose: (n) => send({ type: 'choose', n }) });
      box.show(ev);
      return;
    }
    if (ev.screen === 'callout') {
      // The first time of a word of a region (#39) or of a name (#41), its gloss shows in the bubble too.
      const gloss = glossLine(ctx, ev.textKey, { params: ev.params });
      showBubble(ev.id, gloss ? `${t(ev.textKey, ev.params)}\n${gloss}` : t(ev.textKey, ev.params));
      return;
    }
    // A story that plays in the storybook stays in the village: the other screens show as a
    // card with their name, until the story closes them.
    if (book?.playing) {
      bookScreen?.remove();
      bookScreen = h('div', { class: 'story-screen', text: ev.screen });
      ctx.ui.append(bookScreen);
      return;
    }
    if (ev.screen === 'rest') {
      // The time is over: the hero goes home to rest. A panel of the parent waits first.
      const goRest = () => {
        if (!alive) return;
        if (ctx.ui.querySelector('.modal-layer')) setTimeout(goRest, 1000);
        else ctx.go('rest');
      };
      goRest();
      return;
    }
    // A screen of a story effect. ctx.open() returns false when the village scene closes (for
    // example for Văn Miếu).
    ctx.open(ev.cmd, { village: api }).then((stay) => {
      if (stay && alive) send({ type: 'closed' });
    });
  }

  // Input ------------------------------------------------------------------

  const keys = new Set();
  const stick = { active: false, id: null, x: 0, y: 0, kx: 0, ky: 0, show: matchMedia('(pointer: coarse)').matches };
  let hold = null; // { id, vx, vy, since, held }
  const pointers = new Map();
  let pinch = null;
  let size = { width: 1, height: 1 };

  // A dialogue, a panel, or a trigger zone stops the hero: drop the input that is held.
  function dropInput() {
    raidView.cancel();
    hold = null;
    stick.active = false;
    keys.clear();
  }

  const local = (e) => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const stickHome = () => ({ x: 24 + STICK_R, y: size.height - 24 - STICK_R });
  const inStickZone = (p) => p.x < Math.min(280, size.width * 0.4) && p.y > size.height * 0.45;

  function onDown(e) {
    if (busy || !alive) return;
    const p = local(e);
    pointers.set(e.pointerId, p);
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // A pointer that the browser does not know (for example from a test) has no capture.
    }
    if (pointers.size === 2) {
      // Two fingers: a pinch changes the zoom. Stop the other controls.
      const [a, c] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - c.x, a.y - c.y) };
      hold = null;
      stick.active = false;
      return;
    }
    if (e.pointerType !== 'mouse') stick.show = true;
    // In a raid: a finger on the hero pulls the slingshot; a finger on a source drags an element.
    if (raidView.down(p, e.pointerId)) return;
    if (e.pointerType !== 'mouse' && inStickZone(p)) {
      Object.assign(stick, { active: true, id: e.pointerId, x: p.x, y: p.y, kx: 0, ky: 0, since: performance.now(), far: 0 });
      return;
    }
    hold = { id: e.pointerId, vx: p.x, vy: p.y, sx: p.x, sy: p.y, since: performance.now(), held: false };
  }

  function onMove(e) {
    if (!pointers.has(e.pointerId)) return;
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pinch && pointers.size === 2) {
      const [a, c] = [...pointers.values()];
      const d = Math.hypot(a.x - c.x, a.y - c.y);
      if (d / pinch.d < 0.75) { view.setZoom(1); pinch.d = d; }
      if (d / pinch.d > 1.33) { view.setZoom(0); pinch.d = d; }
      return;
    }
    if (raidView.move(p, e.pointerId)) return;
    if (stick.active && stick.id === e.pointerId) {
      let kx = p.x - stick.x;
      let ky = p.y - stick.y;
      const len = Math.hypot(kx, ky);
      if (len > STICK_R) { kx *= STICK_R / len; ky *= STICK_R / len; }
      stick.kx = kx;
      stick.ky = ky;
      stick.far = Math.max(stick.far, Math.hypot(kx, ky));
      return;
    }
    if (hold && hold.id === e.pointerId) {
      hold.vx = p.x;
      hold.vy = p.y;
      if (!hold.held && Math.hypot(p.x - hold.sx, p.y - hold.sy) > 14) startHold();
    }
  }

  function onUp(e) {
    const p = local(e);
    pointers.delete(e.pointerId);
    if (pinch) {
      if (pointers.size === 0) pinch = null;
      hold = null;
      return;
    }
    if (raidView.up(p, e.pointerId)) return;
    if (stick.active && stick.id === e.pointerId) {
      stick.active = false;
      stick.kx = 0;
      stick.ky = 0;
      // A touch with no push in the stick area is a tap on the world there, short or long (a child
      // often presses long; #48: a slow tap on the wood pile at the bottom left did nothing).
      if (e.type === 'pointerup' && !busy && stick.far < 12) onTap(p);
      return;
    }
    if (hold && hold.id === e.pointerId) {
      // A long press that did not move is a tap too: the walk toward the finger goes on to the
      // place, and the place is the target (a child often presses long, #47).
      const still = Math.hypot(p.x - hold.sx, p.y - hold.sy) < 14;
      const wasHeld = hold.held && !still;
      hold = null;
      if (wasHeld || e.type !== 'pointerup' || busy) return;
      onTap(p);
    }
  }

  function startHold() {
    hold.held = true;
  }

  function onWheel(e) {
    e.preventDefault();
    view.setZoom(e.deltaY > 0 ? 1 : 0);
  }

  // The keys (src/core/keys.js): Space (or J) jumps, E (or Enter) acts, Z and C turn the view.
  function onKey(e) {
    const what = keyAct(e.code);
    if (!what) return;
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return;
    if (e.type === 'keydown') {
      if (busy) return;
      e.preventDefault();
      if (what === 'move') keys.add(e.code);
      else if (e.repeat) return;
      else if (what === 'turnLeft' || what === 'turnRight') view.turn(what === 'turnLeft' ? -1 : 1);
      else if (what === 'jump') {
        jumpDown = performance.now();
        send({ type: 'jump' });
      } else send({ type: 'hands' });
    } else {
      if (what === 'jump') jumpEnd();
      // The action key up: the pour of the jar stops (as the finger leaves the action button).
      if (what === 'act') send({ type: 'hold', on: false });
      keys.delete(e.code);
    }
  }

  const showTap = (x, y, hh) => {
    tapFx = { x, y, h: hh, age: 0 };
  };

  // What the screen shows now, for the hit test of a tap (src/world/hit.js): the figures where the
  // renderer draws them.
  const figureAt = (id, extra = {}) => {
    const f = figures.placeOf(id);
    return f ? { id, x: f.x, y: f.y, z: f.z, height: f.height, ...extra } : null;
  };
  function screenNow() {
    const friend = query(state, 'follow')[0];
    const friends = friend ? [figureAt(friend.id), ...(hero().riding ? [{ ...figureAt('hero'), id: friend.id }] : [])].filter((f) => f?.x !== undefined) : [];
    return {
      cam: view,
      things: query(state, 'item', 'position'),
      persons: persons().map((q) => figureAt(q.entity)).filter(Boolean),
      friends,
      guesses: query(state, 'guess', 'position'),
      hamlet: query(state, 'hamletTap', 'position').map((e) => figureAt(e.id, { hamletTap: e.hamletTap })).filter(Boolean),
      pick: (px, py) => {
        const hit = view.pick(px, py, { things: true });
        if (!hit) return null;
        const thing = hit.who ? terrain.objects.find((o) => o.who === hit.who) : null;
        return { ...hit, object: thing?.id ?? null };
      },
      under: (px, py) => view.pick(px, py),
      placeAt: (x, y, pad) => session.taskPlaceAt(x, y, pad),
      inTask: session.inTask(),
      carrying: Boolean(session.carried()),
      raidAt: (p) => raidView.targetAt(p),
    };
  }
  // What is under a screen point, as the target of a tap for the session (a tap only walks there,
  // docs/TASKS.md), or a pet of Nghé.
  const targetUnder = (p) => tapTarget(p, screenNow());

  function onTap(p) {
    // A long press that did not move walked toward the finger: stop that walk before the tap, so
    // that the stop of the next frame does not end the walk of the tap (#53).
    if (moving) {
      session.command({ type: 'move', dx: 0, dz: 0, strength: 0 });
      moving = false;
    }
    const target = targetUnder(p);
    if (target?.pet) {
      ctx.bus.emit('sound', 'tap');
      send({ type: 'pet', id: target.pet });
    } else if (target) send({ type: 'tap', target });
    else ctx.bus.emit('sound', 'tap');
  }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  // The input of this frame as a command for the world: a map direction from the stick, the
  // keys, or a held finger. A tap walk goes in as a "walk" command (in the session).
  let moving = false;
  function sendInput() {
    if (busy) return;
    const toMap = (s) => {
      if (!s.dx && !s.dy) return null;
      const m = screenToMap(s.dx, s.dy, view.angle);
      return { dx: m.x, dz: m.y, strength: s.strength ?? 1, run: Boolean(s.run) };
    };
    let dir = null;
    if (stick.active) dir = toMap(stickToScreenDir(stick.kx, stick.ky, STICK_R));
    else if (keys.size) dir = toMap(keysToScreenDir(keys));
    else {
      if (hold && !hold.held && performance.now() - hold.since > HOLD_MS) startHold();
      const m = hold?.held ? view.pick(hold.vx, hold.vy) : null;
      // A held finger walks along a path around houses and steps, as a tap does (#53).
      if (m) dir = session.holdToward(m.x, m.y);
    }
    if (dir) {
      if (!moving) ctx.log('action', { kind: 'walk' });
      session.command({ type: 'move', ...dir });
      moving = true;
    } else if (moving) {
      // The stick, the keys, or the finger stopped: the hero stops too.
      session.command({ type: 'move', dx: 0, dz: 0, strength: 0 });
      moving = false;
    }
  }

  // The frame loop -------------------------------------------------------------

  let last = performance.now();
  let time = 0;
  let acc = 0;
  // With ?fps in the address, a small box shows the frames each second and the size of a frame,
  // for tests of the speed on real devices.
  const meter = new URLSearchParams(location.search).has('fps') ? h('div', { class: 'fps-meter' }) : null;
  if (meter) ctx.ui.append(meter);
  let frames = 0;
  let since = last;
  let portraitMs = null; // the time of the last portrait render (ms), for the meter
  // With ?debug=1 in the address, a small panel shows the skill events of the placements.
  const debugPanel = new URLSearchParams(location.search).get('debug') === '1' ? h('div', { class: 'debug-events' }) : null;
  const skillLog = [];
  function logSkill(ev) {
    if (!debugPanel) return;
    const flags = [ev.solved ? 'solved' : 'not solved', ev.efficient ? 'efficient' : null, ev.first ? 'first' : null, ev.mashing ? 'mashing: no evidence' : null].filter(Boolean);
    skillLog.unshift(`${ev.skill} · L${ev.level} · ${flags.join(', ')} · ${ev.parts.join(' ')} / ${ev.target}`);
    skillLog.length = Math.min(skillLog.length, 8);
    debugPanel.replaceChildren(h('b', { text: 'skill events' }), ...skillLog.map((line) => h('div', { text: line })));
  }
  if (debugPanel) {
    ctx.ui.append(debugPanel);
    debugPanel.replaceChildren(h('b', { text: 'skill events' }));
  }
  // Before the first frame: the near chunks around the hero (the land of each from the workers),
  // for at most WARM_MS in each frame, then the shaders of the view. The world waits. Then the
  // first frame draws the world with the hero, and the loading screen goes in the frame after it.
  let warming = loading ? 'chunks' : null;
  let warmStart = performance.now();
  let shaders = null; // 'wait' while the shaders compile, then 'ready'
  function warmUp(now) {
    const hp = hero().position;
    stream.update(hp.x / 2, hp.z / 2);
    // Land that does not come (no worker, no height tiles offline) is made at once after a time.
    const ms = now - warmStart > WARM_WAIT_MS ? Infinity : WARM_MS;
    const w = view.warm(hp.x / 2, hp.z / 2, ms);
    loading.report('chunks', (w.ready + w.built * 2) / (w.total * 3));
    if (w.built < w.total) return false;
    if (!shaders) {
      shaders = 'wait';
      loading.report('figures');
      view.prepare().then(() => { shaders = 'ready'; });
    }
    return shaders === 'ready';
  }

  // One frame. An error of one step or of the drawing never stops the loop: the frame logs it
  // (with ?debug=1, the debug panel shows it), and the next frame goes on.
  let errors = 0;
  function frame(now) {
    if (!alive) return;
    try {
      frameBody(now);
    } catch (err) {
      errors += 1;
      if (errors <= 5 || errors % 100 === 0) console.error('frame', err);
      if (debugPanel) debugPanel.append(h('div', { class: 'debug-error', text: `error: ${err?.message ?? err}` }));
    }
    if (alive) requestAnimationFrame(frame);
  }
  function frameBody(now) {
    if (warming === 'done') {
      // The first frame of the world is on the screen.
      warming = null;
      ctx.endLoading();
      prerenderAll();
    } else if (warming) {
      if (!warmUp(now)) {
        last = now;
        return;
      }
      warming = 'done';
      // The events of the start (a talk) show with the first frame.
      flush();
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    sendInput();
    updateAction(dt);
    // The world moves in fixed steps; the drawing is smooth between two steps. A story of the
    // storybook can play faster (&speed=4).
    acc += dt * (book?.speed ?? 1);
    // The finger of the storybook moves to a tap: the world waits for it.
    if (book?.hold) acc = 0;
    while (acc >= STEP && alive) {
      acc -= STEP;
      session.step();
      figures.sync(state);
      flush();
    }
    // A step can open another scene (the rest screen, Văn Miếu): the village is gone then.
    if (!alive) return;
    draw(dt, acc / STEP);
    frames += 1;
    if (frames % 15 === 0) waveBtn.hidden = busy || !session.mentorTask;
    // The sound of the place changes with the light and the rain.
    if (frames % 30 === 0) {
      const sk = state.sky ?? { night: 0, rain: 0 };
      // The wind in the leaves: a soft hiss, louder while a gust goes over the paddies and the hedges.
      const g = gustsAt(state.seed, state.tick * STEP, data.day?.ambient);
      ctx.bus.emit('ambience', busy ? null : { day: 1 - sk.night, night: sk.night, rain: sk.rain, wind: Math.max(g.paddy, g.hedge) });
    }
    if (meter && now - since > 1000) {
      const s = view.stats();
      // The time of the last portrait render (src/render/portrait.js), for the check on a phone.
      portraitStats(ctx).then((p) => { portraitMs = p?.renders ? p.lastMs : null; });
      meter.textContent = `${Math.round((frames * 1000) / (now - since))} fps · ${s.calls} calls · ${Math.round(s.triangles / 1000)}k triangles${portraitMs === null ? '' : ` · portrait ${portraitMs.toFixed(1)} ms`}`;
      // The times of the steps of the load (src/core/loading.js).
      if (ctx.loadTimes) meter.textContent += `\nload: ${formatTimes(ctx.loadTimes)}`;
      frames = 0;
      since = now;
    }
  }

  // A coin that an enemy took at the gate: it flies from its counter in the HUD to the enemy.
  function flyFromCounter(toId, item, delay) {
    const f = figures.placeOf(toId);
    const counter = counts.querySelector(`[data-item="${slotOf(item)}"] .count-icon`);
    updateHud();
    if (!f || !counter || !data.items.items[item]) return;
    const box = counter.getBoundingClientRect();
    const base = canvas.getBoundingClientRect();
    const start = { x: box.left + box.width / 2 - base.left, y: box.top + box.height / 2 - base.top };
    const el = img(data.items.items[item].art, 'flying-item');
    marks.append(el);
    const t0 = performance.now() + delay * 1000;
    const tick = (now) => {
      const end = view.project(f.x, f.y + f.height, f.z);
      const k = Math.max(0, Math.min(1, (now - t0) / 700));
      const e = k * k * (3 - 2 * k);
      el.style.transform = `translate(${start.x + (end.x - start.x) * e}px, ${start.y + (end.y - start.y) * e - Math.sin(k * Math.PI) * 60}px) translate(-50%, -50%) scale(${1 - k * 0.4})`;
      if (k < 1 && alive) requestAnimationFrame(tick);
      else el.remove();
    };
    requestAnimationFrame(tick);
  }

  // A task or an example starts: the view turns (in its steps) so that no house or roof covers the
  // work and its person (src/world/fade.js, #38). points: half blocks.
  // sight: the points that stay on the screen (the person and the example).
  // The work of a task near the hero (#44): the camera leads from the hero toward the middle of
  // the work, so that the person, the heap, and the places are on the screen of a phone held
  // upright, and zooms out one step when they need it. It ends when the hero walks away.
  let work = null;
  const WORK_AWAY = 16; // cells: the hero this far from the middle of the work ends the lead
  function leadToWork(heroAt) {
    if (!work) return heroAt;
    const mid = work.points.reduce((a, p) => ({ x: a.x + p.x / work.points.length, z: a.z + p.z / work.points.length }), { x: 0, z: 0 });
    if (Math.hypot(heroAt.x - mid.x, heroAt.z - mid.z) > WORK_AWAY) {
      if (work.zoomed) view.setZoom(work.level);
      work = null;
      return heroAt;
    }
    const lead = leadFocus([heroAt, ...work.points], { az: view.angle, width: size.width, height: size.height });
    if (lead.level > view.state.level && !work.zoomed) {
      work.zoomed = true;
      view.setZoom(lead.level);
    }
    return { ...heroAt, x: lead.focus.x, z: lead.focus.z };
  }
  function turnToWork(points, sight = []) {
    const wu = (p) => ({ x: p.x / 2, y: p.y / 2, z: p.z / 2 });
    const pts = (points ?? []).map(wu);
    if (!pts.length) return;
    if (work?.zoomed) view.setZoom(work.level);
    work = { points: pts, level: view.state.level, zoomed: false };
    const focus = wu(hero().position);
    const scr = viewSize(size.width, size.height, view.state.level);
    const inSight = (az) => sight.map(wu).every((p) => inView({ x0: p.x - 0.5, x1: p.x + 0.5, y0: p.y, y1: p.y + 1, z0: p.z - 0.5, z1: p.z + 0.5 }, focus, { az, size: scr }));
    const steps = workTurn(workBoxes(terrain, pts), pts, view.angle, VIEW.elevation, inSight);
    if (steps) view.turn(steps);
  }

  // Greetings over the heads of the people, and the coins of broken pots.
  let bubbles = [];
  // Take away the lines of the other people when a person near the hero says a new line: one person
  // talks at a time (src/core/lines.js, #38).
  function talkOver(id) {
    const near = talksNear(getEntity(state, id)?.position, hero().position);
    const stay = linesAfter(bubbles, id, near);
    for (const b of bubbles) if (!stay.includes(b)) b.el.remove();
    bubbles = stay;
  }
  // icon: the button picture of an act (the example of a station, #37), in a bubble of its own over
  // the line of the person.
  function showBubble(id, text, icon = null) {
    // A heart over Nghé is no line of a person.
    if (!icon && !String(id).startsWith('friend:')) talkOver(id);
    // A new line of a person takes the place of the last one (a mentor counts aloud, one word at a time).
    for (let i = bubbles.length - 1; i >= 0; i--) {
      if (bubbles[i].id !== id || Boolean(bubbles[i].icon) !== Boolean(icon)) continue;
      bubbles[i].el.remove();
      bubbles.splice(i, 1);
    }
    const el = icon ? h('div', { class: 'world-bubble icon' }, [img(`ui/${icon}`, 'bubble-icon')]) : h('div', { class: 'world-bubble', text });
    marks.append(el);
    // A longer line stays longer (a greeting of one line), and wraps (styles/main.css).
    bubbles.push({ id, el, age: 0, icon, life: lineLife(icon ? '' : text), width: el.offsetWidth, height: el.offsetHeight });
  }
  // A thing (a coin) flies in an arc from an entity to its counter in the HUD. The counter ticks
  // up when it lands.
  function flyToCounter(fromId, item, delay) {
    // A figure that is new in this step (a plank that became deck) has no drawn place yet: use
    // the place of its entity.
    const q = getEntity(state, fromId)?.position;
    const f = figures.placeOf(fromId) ?? (q ? { x: q.x / 2, y: q.y / 2, z: q.z / 2 } : null);
    const counter = counts.querySelector(`[data-item="${slotOf(item)}"]`);
    if (!f || !counter || !data.items.items[item]) {
      updateHud();
      return;
    }
    flying[item] = (flying[item] ?? 0) + 1;
    updateHud();
    const start = view.project(f.x, f.y + 1.2, f.z);
    const el = img(data.items.items[item].art, 'flying-item');
    marks.append(el);
    const t0 = performance.now() + delay * 1000;
    const tick = (now) => {
      const box = counts.querySelector(`[data-item="${slotOf(item)}"] .count-icon`)?.getBoundingClientRect();
      const base = canvas.getBoundingClientRect();
      const end = box ? { x: box.left + box.width / 2 - base.left, y: box.top + box.height / 2 - base.top } : { x: start.x, y: 0 };
      const k = Math.max(0, Math.min(1, (now - t0) / 700));
      const e = k * k * (3 - 2 * k);
      const x = start.x + (end.x - start.x) * e;
      const y = start.y + (end.y - start.y) * e - Math.sin(k * Math.PI) * 80;
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${1 - k * 0.3})`;
      if (k < 1 && alive) {
        requestAnimationFrame(tick);
        return;
      }
      el.remove();
      flying[item] = Math.max(0, (flying[item] ?? 1) - 1);
      if (!alive) return;
      updateHud();
      ctx.bus.emit('sound', 'pickup');
      const c = counts.querySelector(`[data-item="${slotOf(item)}"]`);
      c?.classList.add('tick');
      setTimeout(() => c?.classList.remove('tick'), 300);
    };
    requestAnimationFrame(tick);
  }

  // The events of the session and of the world: the screens, the sounds, the HUD, and the
  // bursts of the world.
  function flush() {
    for (const ev of session.events()) handle(ev);
  }
  function handle(ev) {
    switch (ev.type) {
      case 'open': openScreen(ev); return;
      case 'close':
        if (ev.screen === 'dialogue' || ev.screen === 'say') {
          box?.close();
          box = null;
        } else {
          bookScreen?.remove();
          bookScreen = null;
        }
        return;
      case 'busy':
        busy = ev.on;
        if (busy) dropInput();
        return;
      case 'halt': dropInput(); return;
      case 'hud': updateHud(); return;
      case 'sound': ctx.bus.emit('sound', ev.sound); return;
      case 'tapfx': showTap(ev.x, ev.y, ev.h); return;
      case 'pulse': figures.pulse(ev.id); return;
      case 'cue': figures.glow(ev.ids, ev.spots, ev.rings); return;
      // The head of the hamlet points at a station: its star (or its arrow at the edge) pulses.
      case 'starPulse': starPulse = { id: ev.id, t: STAR_PULSE }; return;
      case 'workView': turnToWork(ev.points, ev.sight); return;
      case 'gift':
        for (const [item, n] of Object.entries(ev.give)) {
          for (let i = 0; i < n; i++) flyToCounter(ev.from, item, ev.delay + i * 0.15);
        }
        return;
      case 'raid':
        ctx.bus.emit('raid', ev.on);
        raidView.event(ev);
        return;
      case 'lose':
        for (const [item, n] of Object.entries(ev.take)) for (let i = 0; i < n; i++) flyFromCounter(ev.to, item, i * 0.15);
        return;
      case 'goBack':
        // "Go back" at the end of a practice: a short change to the place before the visit (or
        // to the start of the game, when the profile had no place).
        fade.classList.add('on');
        setTimeout(() => { if (alive) ctx.go('village', ev.to ? { map: ev.to.map, at: { x: ev.to.x, y: ev.to.y }, arrive: true } : { arrive: true }); }, 400);
        return;
      default: worldEvent(ev);
    }
  }
  // What the world did in a step: sounds, hearts, splashes, and dust.
  function worldEvent(ev) {
    if (ev.id === 'sky') {
      // The drum of the đình and a cock crow at dawn; the lanterns and a far temple bell at dusk.
      ctx.bus.emit('sound', ev.type === 'dawn' ? 'drum' : 'lantern');
      ctx.bus.emit('sound', ev.type === 'dawn' ? 'crow' : 'bell');
      return;
    }
    // A sound of the world is softer far away, and the same sound does not play again and again
    // (#49, src/core/hearing.js).
    if (ev.sound) {
      const volume = hearing.hear(ev, state, performance.now() / 1000);
      if (volume > 0) ctx.bus.emit('sound', { name: ev.sound, volume });
    }
    if (ev.type === 'petted') showBubble(ev.id, '♥');
    // The example of a station: the button picture of each act over the person.
    if (ev.type === 'shows') showBubble(ev.id, null, ev.icon);
    raidView.event(ev);
    // A raid: dust where a stone lands, a trap snaps, or Gióng strikes; water and lightning splash.
    if (ev.type === 'land' || ev.type === 'water' || ev.type === 'shock' || ev.type === 'spark' || ev.type === 'flame') {
      const q = ev.at;
      if (q) figures.burst(q.x / 2, session.env.groundY(q.x / 2, q.z / 2) / 2 + 0.2, q.z / 2, ev.type === 'water' || ev.type === 'shock' ? 'splash' : 'dust', ev.type === 'land' ? 5 : 12);
    }
    // A change of the terrain: its chunks build again, with a puff of dust.
    if (ev.type === 'felled' || ev.type === 'dug') {
      view.edit(ev.chunks);
      const at = ev.at ?? null;
      if (at) figures.burst(at[0] + 0.5, at[1] + 1, at[2] + 0.5, 'dust', 10);
    }
    if (ev.type === 'snap' || ev.type === 'strike' || ev.type === 'butt') {
      // A trap that snaps, a piece of the stem that breaks (at), or the band of the teacher.
      const f = ev.at ? { x: ev.at.x / 2, y: session.env.groundY(ev.at.x / 2, ev.at.z / 2) / 2, z: ev.at.z / 2 } : figures.placeOf(ev.type === 'snap' ? ev.trap ?? ev.id : ev.id);
      if (f) figures.burst(f.x, f.y + 0.3, f.z, 'dust', 10);
    }
    // A plank falls into the river: a splash. The bridge takes solid form: dust along the deck.
    if (ev.type === 'float' || ev.type === 'crack') {
      const q = ev.at ?? getEntity(state, ev.id)?.position;
      if (q) figures.burst(q.x / 2, 1.6, q.z / 2, 'splash', 12);
    }
    if (ev.type === 'solid') {
      const z = getEntity(state, ev.id)?.zone;
      if (z) for (let k = z.from; k < z.from + z.gap; k += 2) figures.burst(z.cx / 2, z.deckY / 2, k / 2, 'dust', 4);
    }
    // A commit at a placement: the child never sees the skill event; with ?debug=1 in the
    // address, a small panel shows it.
    if (ev.type === 'skill') logSkill(ev);
    // The small joys: a puddle that the hero walks into, and a frog that dives into the river.
    if ((ev.type === 'splash' && ev.id !== 'hero') || ev.type === 'dive') {
      const q = ev.at;
      if (q) figures.burst(q.x / 2, session.env.groundY(q.x / 2, q.z / 2) / 2 + (ev.type === 'dive' ? 0.6 : 0.1), q.z / 2, 'splash', ev.type === 'dive' ? 8 : 10);
    }
    if (ev.id === 'hero' && ev.type === 'splash') {
      const q = hero().position;
      figures.burst(q.x / 2, q.y / 2 + 0.6, q.z / 2, 'splash', 18);
    }
    if (ev.id === 'hero' && ev.type === 'placed') view.jump(hero().position.x / 2, hero().position.y / 2 + 1.5, hero().position.z / 2);
  }

  // The marks on the world: quest stars over the targets, arrows at the edge for targets out of
  // view, the ring of a tap, and the stick.
  const starPool = [];
  const arrowPool = [];
  function pooled(pool, make) {
    return (i) => {
      if (!pool[i]) {
        pool[i] = make();
        marks.append(pool[i]);
      }
      pool[i].hidden = false;
      return pool[i];
    };
  }
  // A tap on a star (or on an arrow at the edge) walks the hero toward its goal (#44): children
  // tap the star, because the star is where they must go. The walk goes on along the roads to the
  // goal, or to the ferry on the way (#53).
  const starTap = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const m = e.currentTarget.mark;
    if (!m || busy || !alive) return;
    ctx.log('action', { kind: 'star' });
    send({ type: 'tap', target: { ground: { x: m.x, y: m.y, h: m.h, thing: false, object: null, goal: true } } });
  };
  const tappable = (el) => {
    el.addEventListener('pointerdown', starTap);
    return el;
  };
  const starAt = pooled(starPool, () => tappable(img('ui/star', 'world-star')));
  const arrowAt = pooled(arrowPool, () => tappable(h('div', { class: 'edge-arrow' }, [img('ui/star', 'edge-star')])));
  // The pulse of the star of a station (seconds left), when the head of the hamlet points at it.
  const STAR_PULSE = 1.6;
  let starPulse = null;
  const pulseOf = (m) => (starPulse && m.id === starPulse.id ? 1 + 0.6 * Math.sin((Math.PI * starPulse.t) / STAR_PULSE) : 1);
  // The boxes of the controls (the stick and the buttons) on the screen, and of the hero: the marks
  // keep off them (src/world/marks.js, #53). The boxes of the buttons come again twice a second.
  let controlBoxes = [];
  let controlsAge = Infinity;
  function controlsNow(canvasRect) {
    if ((controlsAge += 1 / 60) < 0.5) return controlBoxes;
    controlsAge = 0;
    const box = (r) => ({ x0: r.left - canvasRect.left, y0: r.top - canvasRect.top, x1: r.right - canvasRect.left, y1: r.bottom - canvasRect.top });
    controlBoxes = [...turns.querySelectorAll('button')].filter((b) => !b.hidden && b.offsetParent).map((b) => box(b.getBoundingClientRect()));
    if (stick.show) {
      const home = stickHome();
      controlBoxes.push({ x0: home.x - STICK_R, y0: home.y - STICK_R, x1: home.x + STICK_R, y1: home.y + STICK_R });
    }
    return controlBoxes;
  }
  function heroBox() {
    const f = figures.placeOf('hero');
    if (!f) return null;
    const feet = view.project(f.x, f.y, f.z);
    const head = view.project(f.x, f.y + (f.height ?? 1.6), f.z);
    const half = Math.max(14, (feet.y - head.y) * 0.3);
    return { x0: feet.x - half, y0: head.y, x1: feet.x + half, y1: feet.y };
  }
  function drawMarks() {
    if (starPulse && (starPulse.t -= 1 / 60) <= 0) starPulse = null;
    const hudRect = hud.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const inset = { top: Math.max(0, hudRect.bottom - canvasRect.top) + 8, right: 12, bottom: 12, left: 12 };
    const controls = controlsNow(canvasRect);
    const heroAt = heroBox();
    const screen = { x: 0, y: 0, w: size.width, h: size.height };
    let stars = 0;
    let arrows = 0;
    const edges = [];
    const bob = Math.sin(time * 4) * 4;
    for (const m of busy ? [] : markers()) {
      const p = view.project(m.x, m.h, m.y);
      const edge = edgeMarker(screen, p, inset);
      if (!edge) {
        const el = starAt(stars++);
        el.mark = m;
        // Off the stick, the buttons, and the hero (#53).
        const at = placeStar(p, { controls, hero: heroAt });
        el.style.transform = `translate(${at.x - 15}px, ${at.y - 30 + bob}px) scale(${pulseOf(m)})`;
        continue;
      }
      // Targets in about the same direction share one arrow.
      if (edges.some((q) => Math.hypot(q.x - edge.x, q.y - edge.y) < 56)) continue;
      edges.push(edge);
      const el = arrowAt(arrows++);
      el.mark = m;
      const pulse = Math.sin(time * 5) * 3;
      const at = placeArrow(edge, { controls });
      el.style.transform = `translate(${at.x}px, ${at.y}px) rotate(${edge.angle}rad) translate(${-22 + pulse}px, 0) scale(${pulseOf(m)})`;
      el.firstChild.style.transform = `rotate(${-edge.angle}rad)`;
    }
    for (let i = stars; i < starPool.length; i++) starPool[i].hidden = true;
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.age += 1 / 60;
      const f = figures.placeOf(b.id);
      if (!f || b.age > b.life) {
        b.el.remove();
        bubbles.splice(i, 1);
        continue;
      }
      const q = view.project(f.x, f.y + f.height + 0.4, f.z);
      // The bubble stays on the screen, off the hero and the controls; a person off the screen
      // talks from the edge with a tail toward the person, for a short time (#53).
      const rise = Math.min(b.age, LINE_LIFE) * 10 + (b.icon ? 40 : 0);
      const at = placeBubble({ x: q.x, y: q.y - rise }, b.width, b.height, { screen: { w: size.width, h: size.height, top: inset.top, bottom: size.height }, hero: heroAt, controls });
      if (at.away) b.life = Math.min(b.life, AWAY_LIFE);
      const side = !at.tail ? null : at.tail.x < at.x0 ? 'left' : at.tail.x > at.x1 ? 'right' : at.tail.y > at.y1 ? 'down' : 'up';
      if (b.side !== side) {
        if (b.side) b.el.classList.remove(`tail-${b.side}`);
        if (side) b.el.classList.add(`tail-${side}`);
        b.side = side;
      }
      b.el.style.transform = `translate(${at.x0}px, ${at.y0}px)`;
      b.el.style.opacity = String(Math.min(1, (b.life - b.age) * 2));
    }
    for (let i = arrows; i < arrowPool.length; i++) arrowPool[i].hidden = true;
    if (tapFx && tapFx.age < 0.6) {
      const p = view.project(tapFx.x, tapFx.h + 0.05, tapFx.y);
      ring.hidden = false;
      const k = 0.6 + tapFx.age * 1.2;
      ring.style.transform = `translate(${p.x}px, ${p.y}px) scale(${k}, ${k * 0.5})`;
      ring.style.opacity = String(1 - tapFx.age / 0.6);
    } else {
      ring.hidden = true;
    }
    const s = stick.show && !busy ? (stick.active ? stick : { ...stickHome(), kx: 0, ky: 0 }) : null;
    stickEl.hidden = !s;
    if (s) {
      stickEl.classList.toggle('on', stick.active);
      stickEl.style.transform = `translate(${s.x - STICK_R}px, ${s.y - STICK_R}px)`;
      stickEl.firstChild.style.transform = `translate(${s.kx}px, ${s.ky}px)`;
    }
  }

  // The wash of the dusk (multiply), holes of warm light at the lanterns, and the lines of the rain.
  function drawSky() {
    const night = state.sky?.night ?? 0;
    const rain = state.sky?.rain ?? 0;
    const w = size.width;
    const hh = size.height;
    for (const c of [duskLayer, glowLayer]) {
      if (c.width !== w || c.height !== hh) {
        c.width = w;
        c.height = hh;
      }
    }
    dusk.clearRect(0, 0, w, hh);
    glow.clearRect(0, 0, w, hh);
    duskLayer.hidden = night < 0.01 && rain < 0.01;
    glowLayer.hidden = night < 0.05;
    duskTint.style.opacity = String(Math.min(0.5, Math.sqrt(night) * 0.5 + rain * 0.15));
    if (duskLayer.hidden) return;
    // The multiply layer in the indigo of the palette makes the frame darker as the light goes.
    const k = Math.min(1, night * 0.9 + rain * 0.25);
    dusk.globalCompositeOperation = 'source-over';
    dusk.fillStyle = `hsl(${DUSK.hue}, ${DUSK.saturation}%, ${100 - (100 - DUSK.lightness) * k}%)`;
    dusk.fillRect(0, 0, w, hh);
    if (night > 0.05) {
      // Each lit lantern: a hole in the wash (lighter), and a warm pool on the glow layer.
      dusk.globalCompositeOperation = 'lighter';
      const lights = state.entities.filter((e) => e.look === 'lantern-lit' || e.carry === 'lantern');
      for (const e of lights) {
        const f = figures.placeOf(e.id);
        if (!f) continue;
        const q = view.project(f.x + (e.lantern ? 0.8 : 0), f.y + (e.lantern ? 1 : 0.6), f.z);
        const flicker = e.lantern?.flicker ? 0.7 + Math.abs(Math.sin(time * 40)) * 0.5 : 1;
        const r = (view.state.level ? 70 : 100) * (0.95 + Math.sin(time * 6 + q.x) * 0.05) * flicker;
        const hole = dusk.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
        hole.addColorStop(0, `rgba(160, 140, 110, ${0.8 * night})`);
        hole.addColorStop(1, 'rgba(0, 0, 0, 0)');
        dusk.fillStyle = hole;
        dusk.fillRect(q.x - r, q.y - r, r * 2, r * 2);
        const warm = glow.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 0.8);
        warm.addColorStop(0, `rgba(222, 150, 60, ${0.55 * night * flicker})`);
        warm.addColorStop(0.6, `rgba(170, 100, 40, ${0.25 * night})`);
        warm.addColorStop(1, 'rgba(0, 0, 0, 0)');
        glow.fillStyle = warm;
        glow.fillRect(q.x - r, q.y - r, r * 2, r * 2);
      }
    }
    // A shooting star on one night in five: a streak over the top of the frame, in steps.
    const starHour = night > 0.6 ? starOn(state.seed, dayIndex(state.clock.minutes - (state.clock.minutes % 1440 < 360 ? 1440 : 0)), data.day?.ambient) : null;
    if (starHour !== null) {
      const hour = (state.clock.minutes % 1440) / 60;
      const k = (((hour - starHour + 24) % 24) * 60) / STAR_MINUTES;
      if (k >= 0 && k < 1) {
        const s = Math.floor(k * 8) / 8;
        const x0 = w * 0.15;
        const y0 = hh * 0.12;
        const x = x0 + s * w * 0.5;
        const y = y0 + s * hh * 0.12;
        glow.strokeStyle = 'rgba(247, 240, 223, 0.95)';
        glow.lineWidth = 3;
        glow.beginPath();
        glow.moveTo(Math.max(x0, x - w * 0.12), Math.max(y0, y - hh * 0.03));
        glow.lineTo(x, y);
        glow.stroke();
      }
    }
    if (rain > 0.01) {
      // Rain: short slanted lines, in the ink of the print.
      dusk.globalCompositeOperation = 'source-over';
      dusk.strokeStyle = `rgba(47, 70, 104, ${0.75 * rain})`;
      dusk.lineWidth = 2;
      dusk.beginPath();
      for (const d of drops) {
        const x = ((d.x * w + time * 60 * d.s) % (w + 40)) - 20;
        const y = ((d.y * hh + time * 520 * d.s) % (hh + 40)) - 20;
        dusk.moveTo(x, y);
        dusk.lineTo(x - 5, y + 16);
      }
      dusk.stroke();
    }
  }

  function draw(dt, between) {
    if (tapFx) tapFx.age += dt;
    const w = canvas.clientWidth || window.innerWidth;
    const hh = canvas.clientHeight || window.innerHeight;
    if (w !== size.width || hh !== size.height) {
      size = { width: w, height: hh };
      view.resize(w, hh);
    }
    figures.draw(between, dt);
    // The light of the hour: the world dims to a cool dusk (softer at 0.8 so that the night stays readable).
    D.night.value = (state.sky?.night ?? 0) * 0.8;
    // The world at rest: the gusts and the wind for the sway of the leaves (src/core/world/ambient.js).
    const seconds = state.tick * STEP;
    const amb = data.day?.ambient;
    const ambient = { gusts: gustsAt(state.seed, seconds, amb), wind: state.wind, windy: windyOn(state.seed, dayIndex(state.clock.minutes), amb) };
    const hour = (state.clock.minutes % 1440) / 60;
    // The small joys of the view (src/render/ambient3d.js): Tết, and the firefly on the horn of Nghé
    // on its rare night.
    const today = dayIndex(state.clock.minutes);
    const nghe = state.entities.find((e) => e.follow);
    const ngheAt = nghe && rareOn(state.seed, today, amb).includes('firefly-horn') ? figures.placeOf(nghe.id) : null;
    motes.draw({
      t: time,
      night: state.sky?.night ?? 0,
      wind: state.wind,
      meal: mealAt(hour, amb),
      tet: isTet(today, amb),
      horn: ngheAt ? { x: ngheAt.x, y: ngheAt.y + ngheAt.height, z: ngheAt.z } : null,
    });
    const rope = getEntity(state, 'folk:rope');
    folkLayer.draw({ court: getEntity(state, 'folk:court')?.folkCourt ?? null, rope: rope?.folkRope ?? null, ropeY: rope?.position.y ?? 0 });
    const hp = hero().position;
    const hm = hero().motion;
    const speed = Math.hypot(hm?.vx ?? 0, hm?.vz ?? 0) || 1;
    stream.update(hp.x / 2, hp.z / 2, { x: (hm?.vx ?? 0) / speed, y: (hm?.vz ?? 0) / speed });
    // The puddles on the earth roads after a rain (drawn by the ground of the view).
    const puddles = puddlesAt((d) => rainOf(state.seed, d, data.day ?? undefined), state.clock.minutes);
    const heroAt = figures.placeOf('hero');
    if (!heroAt) return;
    view.render(dt, raidView.focus(leadToWork(heroAt)), time, { ...state.sky, puddles }, ambient);
    drawSky();
    raidView.draw(dt, w, hh);
    drawMarks();
  }

  const api = {
    refresh: () => send({ type: 'refresh' }),
    talk: (id) => send({ type: 'talk', dialogue: id }),
    heroTile: () => {
      const c = heroCell();
      return { x: Math.floor(c.x), y: Math.floor(c.y) };
    },
    mapId: () => mapData.id,
    // The session of the village, for the storybook and for automatic tests of the whole game.
    session,
    // Send a command to the session and show its events (the storybook).
    send,
    // The screen point of a map point on the ground (the finger of the storybook).
    pointOf: (x, y) => view.project(x, groundY(x, y) + 0.2, y),
    // The debug panel (with ?debug=1), where the storybook shows the step of a story.
    debugPanel,
    // The motes of the world at rest that the last frame drew (for the tests on a device).
    motes: () => motes.count,
    // Open another map, for automatic tests of the whole game.
    goMap: (id, x, y) => ctx.go('village', { map: id, at: { x, y } }),
    // The screen point of the middle of a cell, for automatic tests of the whole game.
    screenOf: (x, y) => view.project(x + 0.5, groundY(x + 0.5, y + 0.5), y + 0.5),
    // The screen point of a person or an enemy, for automatic tests of the whole game.
    screenOfPerson: (id) => {
      const q = persons().find((x) => x.ref === id);
      const f = q ? figures.placeOf(q.entity) : null;
      return f ? view.project(f.x, f.y + f.height * 0.5, f.z) : null;
    },
    // The screen point of the middle of an entity (a plank), for automatic tests.
    screenOfThing: (id) => {
      const e = getEntity(state, id);
      if (!e?.position) return null;
      const m = e.item ? middleOf(e) : e.position;
      return view.project(m.x / 2, e.position.y / 2 + 0.3, m.z / 2);
    },
    // The screen point of the n-th plank outline of the prediction, for automatic tests.
    screenOfGuess: (n) => {
      const g = query(state, 'guess').find((x) => x.guess.n === n);
      return g ? view.project(g.position.x / 2, g.position.y / 2 + 0.1, g.position.z / 2 + 1) : null;
    },
    // The plank under a screen point, for automatic tests.
    thingAt: (x, y) => thingUnder({ x, y }, view, query(state, 'item', 'position'))?.e.id ?? null,
    // The target of a tap at a screen point (src/world/hit.js), for automatic tests.
    targetUnder: (x, y) => targetUnder({ x, y }),
    turn: (n) => view.turn(n),
    stats: (opts) => view.stats(opts),
    // The world state, for automatic tests (read only).
    state: () => state,
  };
  ctx.activeVillage = api;

  updateHud();
  figures.sync(state);
  size = { width: canvas.clientWidth || window.innerWidth, height: canvas.clientHeight || window.innerHeight };
  view.resize(size.width, size.height);
  figures.draw(1, 0);
  const h0 = hero().position;
  // With the loading screen, the near chunks are built in the next frames (warmUp), so that the
  // screen can draw the progress; with no loading screen, they are built now.
  view.jump(h0.x / 2, h0.y / 2 + 1.5, h0.z / 2, { build: !loading });
  requestAnimationFrame(frame);
  // Show the new language in the top bar after a change in the parent area.
  const offLang = ctx.bus.on('lang', () => {
    heroFace.setAttribute('aria-label', t('ui.home'));
    menuBtn.setAttribute('aria-label', t('ui.menu'));
    jumpBtn.setAttribute('aria-label', t('ui.jump'));
    jumpBtn.title = t('ui.jump');
    mapBtn.setAttribute('aria-label', t('ui.worldmap'));
    turnLeft.setAttribute('aria-label', t('ui.turn.left'));
    turnRight.setAttribute('aria-label', t('ui.turn.right'));
    updateHud();
  });
  // The events of the start (the intro, the talks after a map change).
  queueMicrotask(() => {
    if (alive && !warming) flush();
  });

  return {
    unmount() {
      alive = false;
      setSpeech(null);
      if (warming) ctx.endLoading();
      if (ctx.activeVillage === api) ctx.activeVillage = null;
      box?.close();
      session.leave();
      if (ctx.syncWorld === session.syncSave) ctx.syncWorld = null;
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      offLang();
      figures.dispose();
      motes.dispose();
      for (const el of [duskTint, duskLayer, glowLayer, paper, raidLayer, marks, hud, turns, fade, banner, meter, debugPanel, bookScreen]) el?.remove();
    },
    api,
  };
}
