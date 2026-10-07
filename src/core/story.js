// Stories: the use paths of the game as data (tests/stories/*.json). A story is a start state,
// a list of steps (commands, waits, taps, and facts to check), and a name. The same story runs
// headless in node:test (tests/stories.test.js) and in the browser with ?story=<name>&play
// (src/ui/storybook.js). This module has the parts that both use: the profile of a story, the
// targets of the taps, the steps, the facts, and the laws of the world. No DOM.
//
// A story file:
//   { name, about: { vi, en }, profile: { name, grade, lang, seed, flags, items, party, timeLimit,
//     played (minutes of play today) }, at: [place, x, y] (the start of the hero: a cell of the
//     plane in the frame of a place; [x, y]: a cell of the plane), clock (game minutes), state (a
//     saved world, instead of at), steps: [...] }
// The cells of the steps ([x, y]) are in the frame of the place of the start (of the plane, when
// the start is [x, y]); a cell in the frame of another place is [place, x, y] (storyOnPlane makes
// them cells of the plane).
// Steps:
//   { do: <command of the session> }         { wait: <seconds> }
//   { until: { event, with, timeout } }      (an event after the last command)
//   { at: { hour } }
//   { tap: { cell: [x, y] } | { entity } | { thing } | { item: <kind>, size } | { plank: <size> } | { guess: <n> } |
//          { zone } | { on: <zone> } | { screenOf: <zone> } | { span } | { stem: <along> } | { culm: <n>, at: <height> } | { line: <along> } |
//          { raid: 'gate' | 'bamboo' | <spot id> } | { post: 10 } (a post before the first shot) }
//     (item: the first thing of a kind (and size) in a heap or a pile; plank: a plank of this size on a pile;
//     zone: the middle of the zone of a task, the first thing of a heap, or the gap of a span; on: the last thing put
//     on the zone of a task (a tap on the thing itself, to take it back); screenOf: the middle of the zone of a task on
//     the screen of a phone, through the hit test of the village (src/world/hit.js), as a child taps; span: the last plank on a
//     span; stem: a place along the stem of the woodcutter; culm: a standing culm of the bamboo
//     clump of the staffs (its place in the row), at a height in half blocks; line: a place on the
//     fish trap line)
//   { shoot: { count: <n> } | { at: 'first' | <enemy id>, kind, off: <half blocks>, lead: <seconds> } }
//     (the slingshot at the wall: a pull of n half blocks, or the count for an enemy of the raid
//     (of this kind): off is how much farther (or nearer, below 0); lead: where the enemy will be
//     after so many seconds; wait: when no enemy is there, the world goes on for a second)
//   { pour: { from: <source id>, at: 'first' | <enemy id> | [x, y] } }  (the drag of an element)
//   { press: <a target of a tap step> | true }  (the hero walks to the target as a tap does, and then the
//                                             action button; with true, only the button. culm with
//                                             at: the button stays down until the mark comes to at)
//   { walk: { to: [x, y], leg } }            (a walk to a far cell, as a child taps ahead again and
//                                             again: a tap each `leg` cells (20) on the way; a line
//                                             of a trigger zone on the way is read)
//   { repeat: <n>, steps: [...] }         (the steps n times)
//   { read: true | [<choice>, ...] }         (read the open talk to its end, with these choices)
//   { reload: true }                         (save, load, and go on from the loaded save)
//   { restore: <n> }                         (a parent goes back to the restore point n, the newest
//                                             first: src/core/restore.js; the game goes on from it)
//   { expect: [<fact>, ...] }
// Facts: see checkFact.
import { createProfile } from './profile.js';
import { dayKey } from './timelimit.js';
import { getEntity, query } from './world/state.js';
import { findPath } from './tilemap.js';
import { saveWorld, loadWorld, setHeroPlace } from './world/save.js';
import { createI18n } from './i18n.js';
import { STEP } from './world/step.js';
import { along } from './world/raids.js';
import { heroLook } from '../world/figures.js';
import { tapTarget as screenTap, sessionCamera, sessionScreen } from '../world/hit.js';
import { pickTopOf, columnTop } from '../world/terrain.js';
import { speakerLook } from '../world/portraits.js';

// The time of the start of a story (a Monday morning), so that a story always gives the same
// result. The time of play goes on with the steps of the world.
export const STORY_EPOCH = Date.UTC(2026, 0, 5, 2, 0);
const DAY = 1440;
// No digit, no operator, and no question mark in a text of the village or a raid.
const WORLD_TEXT = /[0-9+−×÷=?]/;

// A story with its cells on the plane. world: the world of the regions (src/world/regions.js).
export function storyOnPlane(story, world) {
  const out = structuredClone(story);
  // A start [x, y] is a cell of the plane: the cells of the steps are cells of the plane too.
  const frame = !Array.isArray(story.at) ? world.start.place : story.at.length === 3 ? story.at[0] : null;
  const cell = (p) => (p.length === 3 ? world.at(p[0], p[1], p[2]) : frame ? world.at(frame, p[0], p[1]) : [p[0], p[1]]);
  out.map = story.map ?? world.regionOf(frame ?? world.start.place);
  if (Array.isArray(story.at)) out.at = cell(story.at);
  const steps = (list) => {
    for (const st of list ?? []) {
      if (st.steps) steps(st.steps);
      if (st.tap?.cell) st.tap.cell = cell(st.tap.cell);
      if (st.press?.cell) st.press.cell = cell(st.press.cell);
      if (Array.isArray(st.do?.at)) st.do.at = cell(st.do.at);
      if (Array.isArray(st.pour?.at)) st.pour.at = cell(st.pour.at);
      if (st.walk?.to) st.walk.to = cell(st.walk.to);
      for (const f of st.expect ?? []) if (f.hero?.cell) f.hero.cell = cell(f.hero.cell);
    }
  };
  steps(out.steps);
  return out;
}

// The profile at the start of a story (its cells on the plane: storyOnPlane).
export function storyProfile(story, { now = STORY_EPOCH } = {}) {
  const p = story.profile ?? {};
  const profile = createProfile({ id: `story-${story.name}`, name: p.name ?? 'An', gender: p.gender ?? 'boy', skin: p.skin, face: p.face, hair: p.hair, clothes: p.clothes, grade: p.grade ?? 2, lang: p.lang ?? 'vi', seed: p.seed ?? 1, now });
  Object.assign(profile.flags, p.flags ?? {});
  for (const [item, n] of Object.entries(p.items ?? {})) profile.inventory[item] = n;
  // P(L) of some skills at the start (a child who did not master them yet).
  for (const [id, pl] of Object.entries(p.skills ?? {})) profile.learning.skills[id] = { p: pl, r: 1000, n: 0, c: 0, streak: 0, box: 0, due: 0, last: 0, top: 0, recent: '', mastered: false };
  if (p.party) {
    profile.party = [...p.party];
    profile.friends = [...new Set([...profile.friends, ...p.party])];
  }
  if (p.timeLimit !== undefined) profile.settings.timeLimit = p.timeLimit;
  if (p.played !== undefined) profile.time = { day: dayKey(now), usedMs: p.played * 60000, extraMs: 0 };
  const map = story.map ?? 'giong';
  if (story.state) profile.world = structuredClone(story.state);
  else {
    if (story.clock !== undefined) profile.world.clock.minutes = story.clock;
    if (story.at) setHeroPlace(profile.world, map, story.at[0], story.at[1]);
    else profile.world.map = map;
  }
  return profile;
}

// The target of a tap step for the session, and the map point of the finger ({ x, y } cells).
export function tapTarget(session, spec) {
  const state = session.state;
  const at = (e) => ({ x: e.position.x / 2, y: e.position.z / 2 });
  if (spec.cell) return { target: session.targetAt(spec.cell[0], spec.cell[1]), point: { x: spec.cell[0], y: spec.cell[1] } };
  if (spec.post !== undefined) {
    // A distance post of the raid, before the first shot (the prediction).
    const e = query(state, 'raidTap', 'position').find((x) => x.raidTap.what === 'post' && x.raidTap.id === spec.post);
    return e ? { target: { raid: e.raidTap }, point: at(e) } : null;
  }
  if (spec.raid) {
    // A thing of the raid: the gate bar, the bamboo, or a spot for a villager.
    const e = query(state, 'raidTap', 'position').find((x) => x.raidTap.what === spec.raid || x.raidTap.id === spec.raid);
    return e ? { target: { raid: e.raidTap }, point: at(e) } : null;
  }
  if (spec.entity) {
    const e = getEntity(state, spec.entity);
    if (!e?.position) return null;
    return { target: e.person ? { person: e.id } : session.targetAt(e.position.x / 2, e.position.z / 2), point: at(e) };
  }
  if (spec.plank !== undefined) {
    // A plank of this size on a pile.
    for (const z of query(state, 'zone')) {
      if (z.zone.rule !== 'pile') continue;
      const id = z.zone.items.find((i) => getEntity(state, i)?.item.size === spec.plank);
      if (id) {
        const e = getEntity(state, id);
        const m = session.middleOf(e);
        return { target: { thing: id }, point: { x: m.x / 2, y: m.z / 2 } };
      }
    }
    return null;
  }
  if (spec.guess !== undefined) {
    const g = query(state, 'guess', 'position').find((x) => x.guess.n === spec.guess && x.guess.left === undefined);
    return g ? { target: { guess: { zone: g.guess.zone, n: g.guess.n } }, point: { x: g.position.x / 2, y: g.position.z / 2 + 1 } } : null;
  }
  if (spec.on) {
    // The last thing put on a place of a task (a tap on the thing itself, to take it back).
    const z = getEntity(state, `zone:${spec.on}`);
    const e = z ? z.zone.items.map((id) => getEntity(state, id)).filter((x) => x && !x.hidden && !x.item.held).at(-1) : null;
    if (!e) return null;
    const m = session.middleOf(e);
    return { target: { thing: e.id }, point: { x: m.x / 2, y: m.z / 2 } };
  }
  if (spec.thing) {
    const e = getEntity(state, spec.thing);
    if (!e?.position) return null;
    const m = e.item ? session.middleOf(e) : e.position;
    return { target: { thing: e.id }, point: { x: m.x / 2, y: m.z / 2 } };
  }
  if (spec.item) {
    // The first thing of this kind (and of this size, and of another owner or not, when the step
    // gives it) that lies in a heap or a pile.
    const of = (it) => it?.kind === spec.item && (spec.size === undefined || it.size === spec.size) && (spec.stray === undefined || Boolean(it.stray) === spec.stray);
    for (const z of query(state, 'zone')) {
      if (z.zone.rule !== 'pile' && z.zone.rule !== 'heap') continue;
      const id = z.zone.items.find((i) => of(getEntity(state, i)?.item));
      if (id) {
        const e = getEntity(state, id);
        return { target: { thing: id }, point: { x: e.position.x / 2, y: e.position.z / 2 } };
      }
    }
    // A thing of this kind on the ground.
    const loose = query(state, 'item', 'position').find((e) => of(e.item) && !e.item.zone && !e.item.held && !e.hidden);
    return loose ? { target: { thing: loose.id }, point: { x: loose.position.x / 2, y: loose.position.z / 2 } } : null;
  }
  if (spec.stem !== undefined) {
    // A place along the stem of the woodcutter (half blocks from its start).
    const e = query(state, 'item', 'position').find((x) => x.item.kind === 'stem' && x.item.task === 'trial-woodcutter' && !x.hidden);
    if (!e) return null;
    return { target: { thing: e.id, along: spec.stem }, point: { x: (e.position.x + spec.stem) / 2, y: e.position.z / 2 } };
  }
  if (spec.culm !== undefined) {
    // A standing culm of the bamboo clump of the staffs (its place in the row), at a height (half
    // blocks from the ground).
    const e = getEntity(state, `culm:staffs:${spec.culm}`);
    if (!e) return null;
    return { target: { thing: e.id, along: spec.at }, point: { x: e.position.x / 2, y: e.position.z / 2 } };
  }
  if (spec.line !== undefined) {
    // A place on the line of a fish trap (half blocks from the first stake).
    const z = getEntity(state, 'zone:line')?.zone;
    if (!z) return null;
    const x = (z.x + spec.line) / 2;
    const y = z.z / 2;
    return { target: { ground: { x, y, h: session.env.groundY(x, y) / 2, thing: false, object: null } }, point: { x, y } };
  }
  if (spec.span) {
    // The last plank on a span (a tap at the edge takes it back).
    const z = getEntity(state, `zone:${spec.span}`)?.zone;
    const id = z?.items[z.items.length - 1];
    const e = id ? getEntity(state, id) : null;
    if (!e) return null;
    const m = session.middleOf(e);
    return { target: { thing: id }, point: { x: m.x / 2, y: m.z / 2 } };
  }
  if (spec.screenOf) {
    // A tap where a child taps: the middle of the place on the screen of a phone, with the camera of
    // the game, through the hit test of the village (src/world/hit.js, #47). The target is what the
    // screen gives there (the place, a thing, or a person in front of it).
    const base = tapTarget(session, { zone: spec.screenOf });
    if (!base) return null;
    const thing = base.target.thing ? getEntity(state, base.target.thing) : null;
    // The height of the point: a thing, or the top of the ground (or of the water) there.
    const [cx, cz] = [Math.floor(base.point.x), Math.floor(base.point.y)];
    const tm = session.tileMap;
    const h = thing ? thing.position.y / 2 + 0.3 : pickTopOf(tm.type(cx, cz), columnTop(tm.heightAt(cx, cz)));
    const cam = sessionCamera(session, spec.az !== undefined ? { az: spec.az } : {});
    const at = cam.project(base.point.x, h, base.point.y);
    const target = screenTap(at, sessionScreen(session, cam));
    return target && !target.pet ? { target, point: base.point } : null;
  }
  if (spec.zone) {
    // The zone of a task: a tap in the middle of it.
    const z = getEntity(state, `zone:${spec.zone}`)?.zone;
    if (!z) return null;
    if (z.rect) {
      const x = (z.rect.x0 + z.rect.x1) / 4;
      const y = (z.rect.z0 + z.rect.z1) / 4;
      return { target: { ground: { x, y, h: session.env.groundY(x, y) / 2, thing: false, object: null } }, point: { x, y } };
    }
    // A heap or a pile: a tap on its first thing.
    if (z.rule === 'heap' || z.rule === 'pile') {
      const e = getEntity(state, z.items[0]);
      if (e) return { target: { thing: e.id }, point: { x: e.position.x / 2, y: e.position.z / 2 } };
      return { target: { ground: { x: z.x / 2, y: z.z / 2, h: session.env.groundY(z.x / 2, z.z / 2) / 2, thing: false, object: null } }, point: { x: z.x / 2, y: z.z / 2 } };
    }
    // The broken part of a bridge (a span that is not solid): a tap on the water of the gap.
    const x = (z.x0 + z.x1 + 1) / 2;
    const y = z.start / 2 + 0.5;
    return { target: { ground: { x, y, h: session.env.groundY(x, y) / 2, thing: false, object: null } }, point: { x, y } };
  }
  return null;
}

// An enemy of the raid now: 'first' is the nearest one to the gate that walks.
export function raidEnemy(session, which, kind = null) {
  const raid = getEntity(session.state, 'raid')?.raid;
  if (!raid) return null;
  const live = raid.enemies.filter((e) => e.state !== 'retreat' && e.state !== 'gone' && e.state !== 'stunned' && (!kind || e.kind === kind));
  if (which !== 'first') return live.find((e) => e.id === which) ?? null;
  return live.sort((a, b) => along(raid, a) - along(raid, b))[0] ?? null;
}

// The command of a shoot step: a count (the pull), or the count for an enemy: its distance along
// the road where it will be after `lead` seconds (when it walks), and `off` more (or less).
export function shootCommand(session, spec) {
  if (spec.count !== undefined) return { type: 'shoot', count: spec.count };
  const raid = getEntity(session.state, 'raid')?.raid;
  const e = raidEnemy(session, spec.at ?? 'first', spec.kind ?? null);
  if (!raid || !e) return null;
  let p = { x: e.x, z: e.z };
  const goal = e.state === 'walk' ? e.to : e.state === 'back' ? e.back : null;
  if (spec.lead && goal) {
    const speed = raid.kinds[e.kind].speed * (e.state === 'back' ? 2 : 1);
    const d = Math.hypot(goal.x - e.x, goal.z - e.z) || 1;
    const k = Math.min(d, speed * spec.lead);
    p = { x: e.x + ((goal.x - e.x) / d) * k, z: e.z + ((goal.z - e.z) / d) * k };
  }
  const count = Math.max(1, Math.round(along(raid, p) + (spec.off ?? 0)));
  // An enemy past the longest pull is out of reach (a step with wait waits for it).
  return count > raid.sling.max ? null : { type: 'shoot', count };
}

// A comparison in a fact: a number, or a text such as ">= 0.5".
function compare(value, want) {
  if (typeof want !== 'string') return value === want;
  const m = /^(>=|<=|>|<|==)\s*(-?[\d.]+)$/.exec(want.trim());
  if (!m) return String(value) === want;
  const n = Number(m[2]);
  return { '>=': value >= n, '<=': value <= n, '>': value > n, '<': value < n, '==': value === n }[m[1]];
}
// Do the fields of an event have these values?
const fits = (ev, want = {}) => Object.entries(want).every(([k, v]) => (v !== null && typeof v === 'object' ? JSON.stringify(ev[k]) === JSON.stringify(v) : compare(ev[k], v)));
const hourOf = (minutes) => (((minutes % DAY) + DAY) % DAY) / 60;
const cellDist = (a, b) => Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z) / 2;

// Check one fact. ctx: { session, events (since the last expect), learner }. Return null when the
// fact is true, or a message.
export function checkFact(fact, ctx) {
  const { session } = ctx;
  const state = session.state;
  const hero = getEntity(state, 'hero');
  if (fact.hero) {
    const f = fact.hero;
    if (f.in) {
      const g = session.env.groundAt(hero.position.x, hero.position.z);
      const ok = f.in === 'water' ? g === 'water' || g === 'shallow' : g === f.in;
      if (!ok) return `the hero is on ${g}, not in ${f.in}`;
    }
    // mist: the hero is in the mist of the land of a later era (or not).
    if (f.mist !== undefined && ((session.env.mistAt?.(hero.position.x / 2, hero.position.z / 2) ?? 0) > 0) !== f.mist) return `the hero in the mist: ${!f.mist}`;
    if (f.near) {
      const e = getEntity(state, f.near);
      const d = e ? cellDist(hero, e) : Infinity;
      if (d > (f.within ?? 3)) return `the hero is ${d.toFixed(1)} cells from ${f.near}`;
    }
    if (f.cell) {
      const d = Math.hypot(hero.position.x / 2 - f.cell[0], hero.position.z / 2 - f.cell[1]);
      if (d > (f.within ?? 2)) return `the hero is ${d.toFixed(1)} cells from ${f.cell.join(', ')}`;
    }
    if (f.holding !== undefined && Boolean(hero.hands?.holds) !== f.holding) return `the hands of the hero: ${hero.hands?.holds ?? 'empty'}`;
    if (f.falls !== undefined && Boolean(hero.fall) !== f.falls) return `the hero falls: ${Boolean(hero.fall)}`;
    if (f.riding !== undefined && Boolean(hero.riding) !== f.riding) return `the hero rides: ${Boolean(hero.riding)}`;
    return null;
  }
  if (fact.portrait) {
    // The look that the portrait of a speaker shows (data/figures.json and the hero of the
    // profile), and the mood of the last line of that speaker.
    const f = fact.portrait;
    const figures = session.data.figures;
    const look = speakerLook(f.speaker, { figures: figures.figures, flags: session.profile.flags, hero: heroLook(session.profile.hero, figures.hero) });
    if (!look) return `no portrait for ${f.speaker}`;
    for (const [k, v] of Object.entries(f.look ?? {})) if (look[k] !== v) return `the portrait of ${f.speaker} has ${k} ${look[k]}, not ${v}`;
    if (f.mood) {
      const line = [...ctx.events].reverse().find((ev) => ev.type === 'open' && ev.speaker === f.speaker);
      if ((line?.mood ?? 'calm') !== f.mood) return `the last line of ${f.speaker} has the mood ${line?.mood ?? 'none'}, not ${f.mood}`;
    }
    return null;
  }
  if (fact.entity) {
    const e = getEntity(state, fact.entity);
    // gone: the entity is not in the world (an enemy of a lost raid before the next dawn).
    if (fact.gone) return e ? `${fact.entity} is in the world` : null;
    if (!e) return `no entity ${fact.entity}`;
    if (fact.near) {
      const other = getEntity(state, fact.near);
      const d = other ? cellDist(e, other) : Infinity;
      if (d > (fact.within ?? 3)) return `${fact.entity} is ${d.toFixed(1)} cells from ${fact.near}`;
    }
    // act: what the entity does now ('none' for nothing).
    if (fact.act !== undefined && (e.act ?? 'none') !== fact.act) return `${fact.entity} does ${e.act ?? 'none'}, not ${fact.act}`;
    if (fact.look !== undefined && e.look !== fact.look) return `${fact.entity} looks ${e.look}, not ${fact.look}`;
    if (fact.hidden !== undefined && Boolean(e.hidden) !== fact.hidden) return `${fact.entity} hidden: ${Boolean(e.hidden)}`;
    // keep: the player changed the entity (a cart that moved), so the save keeps it.
    if (fact.keep !== undefined && Boolean(e.keep) !== fact.keep) return `${fact.entity} kept: ${Boolean(e.keep)}`;
    // in: the ground under the entity; notIn: grounds that it is not on; mist: it is in the mist.
    const g = e.position ? session.env.groundAt(e.position.x, e.position.z) : null;
    if (fact.in !== undefined && g !== fact.in) return `${fact.entity} is on ${g}, not ${fact.in}`;
    if (fact.notIn && fact.notIn.includes(g)) return `${fact.entity} is on ${g}`;
    if (fact.mist !== undefined && ((session.env.mistAt?.(e.position.x / 2, e.position.z / 2) ?? 0) > 0) !== fact.mist) return `${fact.entity} in the mist: ${!fact.mist}`;
    return null;
  }
  if (fact.event) {
    const found = ctx.events.some((ev) => ev.type === fact.event && fits(ev, fact.with));
    if (found === (fact.not ?? false)) return fact.not ? `an event ${fact.event} came` : `no event ${fact.event} ${JSON.stringify(fact.with ?? {})}`;
    return null;
  }
  if (fact.action !== undefined) {
    // The action button: what it does now and its picture (null: dim, with nothing to do).
    const a = session.action();
    if (fact.action === null) return a ? `the action button does ${a.act}` : null;
    if (!a) return 'the action button is dim';
    for (const k of ['act', 'icon']) if (fact.action[k] !== undefined && a[k] !== fact.action[k]) return `the action button has the ${k} ${a[k]}, not ${fact.action[k]}`;
    // ghost: a pale thing shows where the thing in the hands goes (a place on a line).
    if (fact.action.ghost !== undefined && Boolean(a.ghost) !== fact.action.ghost) return `the action button shows ${a.ghost ? 'a' : 'no'} ghost`;
    return null;
  }
  if (fact.flag) {
    const want = fact.is ?? true;
    if (Boolean(session.profile.flags[fact.flag]) !== want) return `the flag ${fact.flag} is not ${want}`;
    return null;
  }
  if (fact.item) {
    const n = session.profile.inventory[fact.item] ?? 0;
    if (!compare(n, fact.count)) return `${n} ${fact.item}, not ${fact.count}`;
    return null;
  }
  if (fact.learner) {
    const e = ctx.learner?.entry(fact.learner.skill);
    if (!e) return 'no learner';
    if (fact.learner.pL !== undefined && !compare(e.p, fact.learner.pL)) return `P(L) of ${fact.learner.skill} is ${e.p.toFixed(3)}, not ${fact.learner.pL}`;
    return null;
  }
  if (fact.points !== undefined) {
    // The restore points of the profile.
    if (!Array.isArray(ctx.points)) return 'no restore points here';
    if (!compare(ctx.points.length, fact.points)) return `${ctx.points.length} restore points, not ${fact.points}`;
    if (fact.before !== undefined && ctx.points.filter((p) => p.before).length !== fact.before) return `not ${fact.before} points from before a restore`;
    return null;
  }
  if (fact.day !== undefined) {
    // The game day (day 0 is the first).
    const d = Math.floor(state.clock.minutes / DAY);
    if (!compare(d, fact.day)) return `the game day is ${d}, not ${fact.day}`;
    return null;
  }
  if (fact.practice) {
    // The record of an activity of the practice links in the profile: its sets and the level of
    // its next round.
    const f = fact.practice;
    const r = session.profile.practice?.[f.id];
    if (!r) return `no practice ${f.id} in the profile`;
    if (f.sets !== undefined && !compare(r.sets, f.sets)) return `${r.sets} sets of ${f.id}, not ${f.sets}`;
    if (f.level !== undefined && !compare(r.level, f.level)) return `the level of ${f.id} is ${r.level}, not ${f.level}`;
    return null;
  }
  if (fact.clock) {
    const h = hourOf(state.clock.minutes);
    const [a, b] = fact.clock.between;
    if (!(a <= b ? h >= a && h <= b : h >= a || h <= b)) return `the hour is ${h.toFixed(2)}, not between ${a} and ${b}`;
    return null;
  }
  if (fact.zone) {
    const z = getEntity(state, `zone:${fact.zone}`)?.zone;
    if (!z) return `no zone ${fact.zone}`;
    const now = z.set ? 'solid' : 'open';
    if (fact.state && fact.state !== now) return `the zone ${fact.zone} is ${now}, not ${fact.state}`;
    if (fact.round !== undefined && z.round !== fact.round) return `the zone ${fact.zone} is at round ${z.round}, not ${fact.round}`;
    if (fact.planks !== undefined && !compare(z.items.length, fact.planks)) return `the zone ${fact.zone} has ${z.items.length} planks, not ${fact.planks}`;
    if (fact.gap !== undefined && z.gap !== fact.gap) return `the gap of ${fact.zone} is ${z.gap}, not ${fact.gap}`;
    return null;
  }
  if (fact.ford) {
    // The fords of the map: closed (every cell blocks, the river is high) or open.
    const { tileMap, env } = session;
    const blocked = env.fords.filter((c) => tileMap.isBlocked(c.x, c.y)).length;
    const now = !env.fords.length ? 'none' : blocked === env.fords.length ? 'closed' : blocked === 0 ? 'open' : 'partly closed';
    if (now !== fact.ford) return `the ford is ${now}, not ${fact.ford}`;
    return null;
  }
  if (fact.text) {
    const key = fact.text.shown;
    const shown = ctx.events.some((ev) => ev.type === 'open' && (ev.textKey === key || ev.choices?.includes(key)));
    if (!shown) return `the text ${key} did not show`;
    return null;
  }
  if (fact.screen !== undefined) {
    if (session.screen !== fact.screen) return `the screen is ${session.screen}, not ${fact.screen}`;
    return null;
  }
  if (fact.count) {
    const c = fact.count;
    const n = state.entities.filter((e) => !e.hidden && (e.kind === c.entities || e.look === c.entities || String(e.id).startsWith(`${c.entities}:`))).length;
    if (c.min !== undefined && n < c.min) return `${n} ${c.entities}, fewer than ${c.min}`;
    if (c.max !== undefined && n > c.max) return `${n} ${c.entities}, more than ${c.max}`;
    return null;
  }
  if (fact.all) {
    // All entities of a group are near a place of their day: { of: 'people' | <kind>, plan (only
    // the people of this plan), home (only the people with a house who go in at night), near: 'spot' | 'bed' |
    // 'bank' | 'place:<name>', within, hidden }.
    const a = fact.all;
    const list = a.of === 'people' ? query(state, 'schedule', 'person') : query(state, 'kind').filter((e) => e.kind === a.of);
    const plans = ctx.data?.people?.people ?? {};
    // A person of the quest stays out at night (with a lantern): not part of the group.
    const group = list.filter((e) => (!a.plan || plans[e.person?.ref]?.plan === a.plan) && (!a.home || (e.schedule?.home && !e.schedule.stay)));
    if (!group.length) return `no ${a.of}`;
    for (const e of group) {
      if (a.hidden !== undefined && Boolean(e.hidden) !== a.hidden) return `${e.id} hidden: ${Boolean(e.hidden)}`;
      if (!a.near) continue;
      const p = a.near.startsWith('place:') ? session.env.places[a.near.slice(6)] : e.schedule?.[a.near];
      if (!p) return `${e.id} has no ${a.near}`;
      const d = Math.hypot(e.position.x - p.x, e.position.z - p.z) / 2;
      if (d > (a.within ?? 2)) return `${e.id} is ${d.toFixed(1)} cells from its ${a.near}`;
    }
    return null;
  }
  if (fact.raid) {
    // The raid now: on (a raid goes on), phase (the id of its phase), enemies (the count of the
    // enemies that did not retreat), losses (the enemies at the gate and the torches inside).
    const f = fact.raid;
    const raid = getEntity(state, 'raid')?.raid ?? null;
    if (f.on !== undefined && Boolean(raid && !raid.result) !== f.on) return `a raid goes on: ${Boolean(raid && !raid.result)}`;
    if (!raid) return f.on === false ? null : 'no raid';
    if (f.phase && raid.phases[raid.phase].id !== f.phase) return `the raid is at the phase ${raid.phases[raid.phase].id}, not ${f.phase}`;
    const live = raid.enemies.filter((e) => e.state !== 'retreat' && e.state !== 'gone').length;
    if (f.enemies !== undefined && !compare(live, f.enemies)) return `${live} enemies, not ${f.enemies}`;
    if (f.losses !== undefined && !compare(raid.losses, f.losses)) return `${raid.losses} losses, not ${f.losses}`;
    return null;
  }
  if (fact.edits) {
    // The changes of the land that the save keeps (src/world/terrain.js, edits): chunks (the count
    // of the changed chunks), felled (the felled things), and dug (the digs, one for each block).
    const f = fact.edits;
    const saved = Object.values(session.terrain?.edits?.() ?? {});
    const ones = (runs) => runs.reduce((n, r, k) => n + (k % 2 ? r : 0), 0);
    const got = {
      chunks: saved.length,
      felled: saved.reduce((n, e) => n + ones(e.felled ?? []), 0),
      dug: saved.reduce((n, e) => n + (e.dug ?? []).reduce((m, runs) => m + ones(runs), 0), 0),
    };
    for (const k of ['chunks', 'felled', 'dug']) if (f[k] !== undefined && !compare(got[k], f[k])) return `${got[k]} ${k} in the changes of the land, not ${f[k]}`;
    return null;
  }
  return `an unknown fact ${JSON.stringify(fact)}`;
}

// The laws of the world, checked on every step of every story. data: the data of the game.
// texts: { vi, en } (the i18n files). limits: data/config/limits.json.
export function createLaws({ texts, limits }) {
  const i18n = Object.fromEntries(Object.entries(texts).map(([lang, dict]) => [lang, createI18n(dict, lang)]));

  // No NaN, no entity outside the map, the hero and the people on free ground, the count of the
  // entities and of the live chunks under the limits, and the save of the world loads back to the
  // same world.
  function step(session) {
    const problems = [];
    const { state, env, tileMap } = session;
    if (state.entities.length > limits.entities) problems.push(`${state.entities.length} entities, more than ${limits.entities}`);
    if (limits.liveChunks && session.live && session.live.length > limits.liveChunks) problems.push(`${session.live.length} live chunks, more than ${limits.liveChunks}`);
    for (const e of state.entities) {
      const q = e.position;
      if (!q) continue;
      if (![q.x, q.y, q.z, q.facing ?? 0].every(Number.isFinite)) {
        problems.push(`${e.id} is at a place that is not a number`);
        continue;
      }
      if (q.x < 0 || q.z < 0 || q.x > env.width || q.z > env.height) problems.push(`${e.id} is outside the map (${q.x.toFixed(1)}, ${q.z.toFixed(1)})`);
      // A thing that falls, swims, climbs the ladder of its house, rides a ferry, or jumps (in the
      // air over a log or a ditch) may be over water or a house.
      if (e.hidden || e.fall || e.swim || e.climb || e.aboard || e.jump || (e.id !== 'hero' && !e.person)) continue;
      const tx = Math.floor(q.x / 2);
      const ty = Math.floor(q.z / 2);
      if (['water', 'sea'].includes(tileMap.groundAt(tx, ty))) problems.push(`${e.id} stands in deep water (${tx}, ${ty})`);
      else if (tileMap.isBlocked(tx, ty)) problems.push(`${e.id} stands in a blocked cell (${tx}, ${ty})`);
    }
    const saved = JSON.stringify(saveWorld(state));
    if (JSON.stringify(saveWorld(loadWorld(JSON.parse(saved)))) !== saved) problems.push('the save of the world does not load back to the same world');
    return problems;
  }

  // The rule of the world: a text that the session shows in the village or a raid has no digit,
  // no operator, and no question mark, in each language. The rule is about the math of the task,
  // so a fact of history (a key history.*, which needs its year) and a place name (place.* and
  // region.*, as a text or as a value) are not checked.
  const exempt = (key) => /^(history|place|region)\./.test(key);
  function text(ev, params = {}) {
    if (ev.type !== 'open') return [];
    const keys = [ev.textKey, ...(ev.choices ?? []), ev.mark ? `mark.${ev.mark}` : null].filter((k) => k && !exempt(k));
    const values = Object.fromEntries(Object.entries({ ...params, ...(ev.params ?? {}) }).map(([k, v]) => [k, v?.key && exempt(v.key) ? '' : v]));
    const problems = [];
    for (const key of keys) {
      for (const [lang, t] of Object.entries(i18n)) {
        const shown = t.gloss(t.t(key, values));
        if (WORLD_TEXT.test(shown)) problems.push(`${key} (${lang}): "${shown}"`);
      }
    }
    return problems;
  }

  return { step, text };
}

// Play a story. io: {
//   session(): the session now (a reload makes a new one),
//   advance(seconds, until): let the world go on for some seconds of the world, or until
//     until() is true; return true when until() became true,
//   send(cmd, point): send a command (point: the map point of a tap, for the finger),
//   reload(): save, load, and go on with a new session; return a message when the loaded world
//     is not the same, or null,
//   restore(n): go back to the restore point n and go on with a new session; return a message or
//     null, points(): the restore points of the profile ([{ day, era, at, before }]),
//   learner(): the learner, data: the data of the game, onStep(i, step), onExpect(i, failures, step) }.
// Return the failures: [{ step, message }].
export async function playStory(story, io) {
  const failures = [];
  // The events of the start that the view did not take yet, then all the events of the session.
  const events = io.session().opening();
  let since = 0; // the events since the last expect start here
  let mark = 0; // the events since the last command start here
  let stop = io.session().listen((ev) => events.push(ev));
  // A new session (after a reload, a restore, or "go back" at the end of a practice): its events
  // from its start on.
  let bound = io.session();
  const rebind = () => {
    if (io.session() === bound) return;
    stop();
    bound = io.session();
    events.push(...bound.opening());
    stop = bound.listen((ev) => events.push(ev));
  };
  const fail = (i, message) => failures.push({ step: i, message });
  const lastLine = () => [...events].reverse().find((ev) => ev.type === 'open' && (ev.screen === 'dialogue' || ev.screen === 'say'));

  // The steps of a repeat have the number of the repeat step.
  const flat = [];
  const unroll = (steps, i = null) => {
    for (const [k, s] of steps.entries()) {
      if (s.repeat !== undefined) for (let n = 0; n < s.repeat; n++) unroll(s.steps ?? [], i ?? k);
      else flat.push([i ?? k, s]);
    }
  };
  unroll(story.steps ?? []);
  for (const [i, s] of flat) {
    // A law of every story: no step throws an error (an error in a frame of the view stops the
    // game of a child, #46). The story stops at the step with the message.
    try {
      io.onStep?.(i, s);
      rebind();
      const session = io.session();
      // A shoot step marks only when it shoots: a shot with no enemy (the raid is over) keeps the
      // mark, so that the end of the raid during the shots still counts for the next steps.
      if (s.do || s.tap || s.press || s.read || s.pour || (s.shoot && shootCommand(session, s.shoot))) mark = events.length;
      if (s.do) await io.send(s.do, null);
      else if (s.wait !== undefined) await io.advance(s.wait, null);
      else if (s.until) {
        // The event came after the last command (in a browser, it can come while the finger taps).
        const from = mark;
        const ok = await io.advance(s.until.timeout ?? 30, () => events.slice(from).some((ev) => ev.type === s.until.event && fits(ev, s.until.with)));
        if (!ok) fail(i, `no event ${s.until.event} ${JSON.stringify(s.until.with ?? {})} in ${s.until.timeout ?? 30} seconds`);
      } else if (s.at) {
        const m = session.state.clock.minutes;
        const target = Math.floor(m / DAY) * DAY + s.at.hour * 60;
        const end = target > m ? target : target + DAY;
        const ok = await io.advance(2 * DAY, () => io.session().state.clock.minutes >= end);
        if (!ok) fail(i, `the clock did not come to ${s.at.hour}`);
      } else if (s.tap) {
        const tap = tapTarget(session, s.tap);
        if (!tap?.target) fail(i, `nothing to tap for ${JSON.stringify(s.tap)}`);
        else await io.send({ type: 'tap', target: tap.target }, tap.point);
      } else if (s.press) {
        const problem = await press(io, s.press);
        if (problem) fail(i, problem);
      } else if (s.shoot) {
        const cmd = shootCommand(session, s.shoot);
        // wait: no enemy now is no failure; the world goes on for a second.
        if (!cmd && s.shoot.wait) await io.advance(1, null);
        else if (!cmd) fail(i, `no enemy to shoot at for ${JSON.stringify(s.shoot)}`);
        else {
          const h = getEntity(session.state, 'hero').position;
          await io.send(cmd, { x: h.x / 2, y: h.z / 2 });
        }
      } else if (s.pour) {
        const e = Array.isArray(s.pour.at) ? null : raidEnemy(session, s.pour.at ?? 'first');
        const to = Array.isArray(s.pour.at) ? { x: s.pour.at[0], y: s.pour.at[1] } : e ? { x: e.x / 2, y: e.z / 2 } : null;
        if (!to) fail(i, `no place to pour for ${JSON.stringify(s.pour)}`);
        else await io.send({ type: 'pour', source: s.pour.from, x: to.x, y: to.y }, to);
      } else if (s.walk) {
        const problem = await walkFar(io, s.walk);
        if (problem) fail(i, problem);
      } else if (s.read) {
        const choices = Array.isArray(s.read) ? [...s.read] : [];
        for (let n = 0; n < 60 && ['dialogue', 'say'].includes(io.session().screen); n++) {
          const line = lastLine();
          if (line?.choices?.length) await io.send({ type: 'choose', n: choices.length ? choices.shift() : 0 }, null);
          else await io.send({ type: 'next' }, null);
        }
        if (['dialogue', 'say'].includes(io.session().screen)) fail(i, 'the talk did not end');
      } else if (s.reload) {
        const problem = await io.reload();
        rebind();
        if (problem) fail(i, problem);
      } else if (s.restore !== undefined) {
        const problem = await io.restore(s.restore);
        rebind();
        if (problem) fail(i, problem);
      } else if (s.expect) {
        const ctx = { session, events: events.slice(since), learner: io.learner?.(), data: io.data, points: await io.points?.() };
        const out = [];
        for (const fact of s.expect) {
          const message = checkFact(fact, ctx);
          if (message) out.push(message);
        }
        for (const message of out) fail(i, message);
        await io.onExpect?.(i, out, s);
        since = events.length;
      } else fail(i, `an unknown step ${JSON.stringify(s)}`);
    } catch (err) {
      fail(i, `the step threw an error: ${err?.message ?? err}`);
      break;
    }
  }
  stop();
  return failures;
}

// A press step: the walk of a tap to the target, the end of the walk, and the action button (held
// down until the mark of a slash comes to the height `at` on a culm). Return a message, or null.
async function press(io, spec) {
  const hero = () => getEntity(io.session().state, 'hero');
  if (spec !== true) {
    const tap = tapTarget(io.session(), spec);
    if (!tap?.target) return `nothing to walk to for ${JSON.stringify(spec)}`;
    await io.send({ type: 'tap', target: tap.target }, tap.point);
    await io.advance(0.2, null);
    await io.advance(20, () => !hero().route);
    await io.advance(0.15, null);
  }
  if (spec.culm !== undefined && spec.at !== undefined) {
    await io.send({ type: 'hold', on: true }, null);
    const aim = () => getEntity(io.session().state, 'zone:trial-staffs')?.zone.aim;
    const ok = await io.advance(15, () => (aim()?.at ?? 0) >= spec.at);
    await io.send({ type: 'hold', on: false }, null);
    return ok ? null : `the mark of the slash did not come to ${spec.at}`;
  }
  await io.send({ type: 'hands' }, null);
  return null;
}

// A walk to a far cell: the way on the tile map, and a tap each `leg` cells on it. Return a
// message when the hero did not come there, or null.
async function walkFar(io, spec) {
  const session = io.session();
  const hero = () => getEntity(io.session().state, 'hero').position;
  const h = hero();
  const goal = { x: Math.floor(spec.to[0]), y: Math.floor(spec.to[1]) };
  const way = findPath(session.tileMap, { x: Math.floor(h.x / 2), y: Math.floor(h.z / 2) }, goal, { maxNodes: 600000 });
  if (!way) return `no way to ${spec.to.join(', ')}`;
  const leg = spec.leg ?? 20;
  const points = way.filter((_, k) => (k + 1) % leg === 0 || k === way.length - 1);
  for (const p of points) {
    const at = { x: p.x + 0.5, y: p.y + 0.5 };
    const near = () => Math.hypot(hero().x / 2 - at.x, hero().z / 2 - at.y) < 1.5;
    for (let tries = 0; tries < 3 && !near(); tries++) {
      // A line of a trigger zone on the way: read it, and go on.
      for (let n = 0; n < 10 && ['dialogue', 'say'].includes(io.session().screen); n++) await io.send({ type: 'next' }, null);
      const tap = tapTarget(io.session(), { cell: [at.x, at.y] });
      await io.send({ type: 'tap', target: tap.target }, tap.point);
      await io.advance(leg / 2, () => near() || ['dialogue', 'say'].includes(io.session().screen));
    }
    if (!near()) return `the walk stopped at ${(hero().x / 2).toFixed(1)}, ${(hero().z / 2).toFixed(1)} on the way to ${spec.to.join(', ')}`;
  }
  return null;
}

export { STEP };
