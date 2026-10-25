// The folk games of the village children in the session (#30; docs/FOLKGAMES.md): nhảy lò cò on a
// court by the đình of Phù Đổng, and nhảy dây at the feast of Xóm Ruộng (or in a practice). The
// children play on their own; when the hero comes near, they ask in words, and the action button
// joins them. The rules are in src/core/folkgames.js. Pure: no DOM.
//
// deps: data (folkgames), profile, world(), env(), learner(), seed(), emit, callout(textKey,
// params, entity id), command(cmd) (a command of the world), goTo(point), skill(ev) (a skill event
// for the learner and the learning log), feastOn(), practice() (the task of a practice, or null),
// setDone(game) (the end of a set: true when a practice ends it), busy(), day(), view() (the angle
// of the view: the camera is toward (sin, cos) of it).

import { addEntity, removeEntity, getEntity } from './world/state.js';
import { createRng, hashSeed } from './rng.js';
import { courtPlan, courtOf, callSquare, FIRST_REACH, aimSquare, throwPlace, judgeThrow, createHops, hop, ropePlan, createRope, stepRope, jumpRope } from './folkgames.js';

const S = 2; // half blocks: the side of a square of the court
const INVITE = 14; // half blocks: the children ask a hero this near
const AGAIN = 90; // seconds before the children ask again
const LEAVE = 16; // half blocks from the middle of the court: a hero this far away leaves the game
const THROW_NEAR = 6; // half blocks from the start line: the big button throws only this near (#132)
const HOLD_GRADE = 2; // the highest grade where a quick press of the jump waits for the hop (#132)
const NEAR_START = 4; // half blocks: a hero this near the start line stands at it
const STILL_START = 8; // half blocks: a hero who stands still this near the start line for STILL_WAIT
const STILL_WAIT = 1; // seconds
const REACH_MORE = 2; // squares: after a throw in the called square, the calls go this much farther
const WHY_TIME = 3.2; // seconds of the line after a miss, before the next turn
const OTHER_THROW = 0.8; // seconds from the start of the turn of another child to the throw
const OTHER_HOPS = 4; // the squares of the hops of another child (over the shard)
const OTHER_HOP = 0.45; // seconds of a hop of another child
const DEMO_WAIT = 1.4; // seconds before the child of the demonstration holds
const DEMO_LOOK = 2.4; // seconds to look at the shard of the demonstration
const NAME_GLOW = 3; // seconds of the glow of a thing that a line names
const BODY_TALL = 3.4; // half blocks: the height of a child with the head
const BODY_HALF = 0.8; // half blocks: half the width of the body of a child on the screen
const COVER_PAD = 0.9; // half blocks: half a square, and a little more
const VIEW_SLOPE = 0.5; // the slope of the view over the ground (src/world/view.js: atan 0.5)
const FEET_CLEAR = 1; // half blocks between the body of a child and the edge of a square
const KID_APART = 2.6; // half blocks between two children who stand aside
const SHOW_SHARD = 3; // seconds of the line that shows the shard, before the first call
const JOIN_TIME = 3.5; // seconds of the line of the start, before the next line
// The lines that name the start line, and those that name the shard (#114).
const START_WORDS = new Set(['loco.join']);
// A line of a miss says where the shard fell: the shard glows with it too (#114: at night the
// shard was dark on the court).
const SHARD_WORDS = new Set(['loco.shard', 'loco.in', 'loco.pick', 'loco.rest', 'loco.fail.shard', 'loco.demo', 'loco.how.throw', 'loco.how.hop', 'loco.out', 'loco.other.far', 'loco.other.near', 'loco.line']);
const num = (n) => ({ key: `num.${Math.max(1, Math.min(150, n))}` });
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function createFolk(deps) {
  const def = deps.data;
  let now = 0;
  let geo = null; // { loco: court frame, rope: rope frame }
  let game = null;
  let inviteAt = { loco: 0, rope: 0 };
  let n = 0; // the games of this session (for the seeds)
  const world = () => deps.world();
  const hero = () => getEntity(world(), 'hero');
  const rngOf = (salt) => createRng(hashSeed(`${deps.seed()}:folk:${salt}:${n}`));

  // ---------------------------------------------------------------- The places
  // The frame of a game on the map: its place, the way that it goes, and the side.
  function frameOf(at, to) {
    const p = deps.env().places?.[at];
    const q = deps.env().places?.[to];
    if (!p || !q) return null;
    const len = Math.hypot(q.x - p.x, q.z - p.z) || 1;
    const dir = { x: (q.x - p.x) / len, z: (q.z - p.z) / len };
    return { o: { x: p.x, z: p.z }, dir, side: { x: -dir.z, z: dir.x } };
  }
  const along = (f, a, b = 0) => ({ x: f.o.x + f.dir.x * a + f.side.x * b, z: f.o.z + f.dir.z * a + f.side.z * b });
  const ground = (p) => deps.env().groundY?.(p.x / 2, p.z / 2) ?? 0;
  const at = (p, facing = 0) => ({ x: p.x, z: p.z, y: ground(p), facing });
  const facingOf = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

  // The points of a court: the middle of each square, the half circle to rest, the start, and home.
  function courtPoints(f, court) {
    const half = Math.ceil(court.length / 2);
    const squares = court.map((s) => along(f, (s.row + 0.5) * S, (s.side ? 0.5 : -0.5) * S));
    return { squares, rest: along(f, (half + 0.6) * S), start: along(f, -0.8 * S, -0.5 * S), home: along(f, -0.8 * S, 0.5 * S), half };
  }
  // The place of the shard on the court at a place of the line (squares from the start line).
  function shardPoint(f, court, place) {
    const half = Math.ceil(court.length / 2);
    const i = Math.floor(place);
    if (place <= 0) return along(f, -0.3 * S, -0.5 * S);
    if (i >= court.length) return along(f, (half + 0.4 + (place - court.length)) * S);
    const s = court[i];
    const k = place - i;
    return along(f, (s.side ? s.row + 1 - k : s.row + k) * S, (s.side ? 0.5 : -0.5) * S);
  }

  // The children and the things of the games of this map.
  function mapStart() {
    game = null;
    geo = { loco: frameOf('hopscotch', 'hopscotch-to'), rope: frameOf('rope', 'rope-to') };
    if (geo.loco) {
      const f = geo.loco;
      const court = courtOf({ start: 1, step: 1, squares: 10 });
      setCourt(court);
      def.loCo.children.forEach((look, k) => {
        const p = along(f, (0.5 + k * 1.6) * S, -2.1 * S);
        addEntity(world(), { id: k === 0 ? 'npc:loco-child' : `folk:child:${k}`, keep: false, folkChild: 'loco', look, position: at(p, facingOf(p, along(f, (1 + k * 1.5) * S))) });
      });
      addEntity(world(), { id: 'folk:shard', keep: false, look: 'shard', hidden: true, position: at(along(f, -0.3 * S, -0.5 * S)) });
      // The see-through shard of the aim (#114): it steps along the court while the button is held.
      addEntity(world(), { id: 'folk:aim', keep: false, look: 'shard', ghost: true, bright: true, see: true, hidden: true, position: at(along(f, -0.3 * S, -0.5 * S)) });
      // The square of the see-through shard glows, so that a child sees it on a phone.
      addEntity(world(), { id: 'folk:aimglow', keep: false, look: 'place-glow', hidden: true, position: at(along(f, -0.3 * S, -0.5 * S)) });
    }
  }
  function setCourt(court) {
    const f = geo.loco;
    const pts = courtPoints(f, court);
    const e = getEntity(world(), 'folk:court') ?? addEntity(world(), { id: 'folk:court', keep: false, position: at(f.o) });
    e.folkCourt = { squares: pts.squares.map((p, i) => ({ x: p.x, z: p.z, y: ground(p), side: court[i].side, row: court[i].row })), rest: pts.rest, dir: f.dir, size: S };
  }

  // The rope and its two children: at the feast, and in a practice of the rope.
  function ropeOn() {
    return Boolean(geo?.rope) && (deps.feastOn() || deps.practice() === 'rope' || game?.kind === 'rope');
  }
  function showRope(on) {
    const has = getEntity(world(), 'folk:rope');
    if (on && !has) {
      const f = geo.rope;
      const a = along(f, 5.2);
      const b = along(f, -5.2);
      addEntity(world(), { id: 'npc:rope-child', keep: false, folkChild: 'rope', look: def.rope.children[0], position: at(a, facingOf(a, b)) });
      addEntity(world(), { id: 'folk:turner:1', keep: false, folkChild: 'rope', look: def.rope.children[1], position: at(b, facingOf(b, a)) });
      addEntity(world(), { id: 'folk:rope', keep: false, position: at(f.o), folkRope: { a, b, turn: 0, period: def.rope.period, still: false } });
    } else if (!on && has) for (const id of ['npc:rope-child', 'folk:turner:1', 'folk:rope']) removeEntity(world(), id);
  }

  // ---------------------------------------------------------------- Join a game
  // The skill of a game: the first skill of the game (in the order of the grades) that the child
  // can learn now and does not know yet; when the child knows them all, the last one.
  const skillOf = (levels) => {
    const l = deps.learner();
    const ids = Object.keys(levels);
    const open = ids.find((id) => (l?.unlocked?.(id) ?? true) && !l?.isMastered?.(id));
    return open ?? ids.filter((id) => l?.isMastered?.(id)).at(-1) ?? ids[0];
  };
  const levelOf = (skill) => Math.max(1, deps.learner()?.levelFor?.(skill) ?? 1);

  function join(kind) {
    if (game || !geo?.[kind]) return false;
    n += 1;
    if (kind === 'loco') {
      const skill = skillOf(def.loCo.levels);
      // The level of the child chooses the court (#99: a child of grade 1 got a court from 47).
      const level = levelOf(skill);
      const plan = courtPlan(def.loCo.levels, skill, rngOf('court'), level);
      game = { kind, skill, level, plan, court: courtOf(plan), rounds: 0, misses: {}, demoed: false, call: null, prev: null, phase: 'walk', wait: 8, retry: false, first: true };
      setCourt(game.court);
      standAside();
      // The view turns so that no house covers the court (the event workView, #38).
      courtView();
      // The children always say where to start (#99), also on a court that does not start at 1.
      walkToStart();
      if (plan.start !== 1) {
        say('loco.start', { n: num(plan.start) });
        later(2.5, () => { if (game?.kind === 'loco' && game.phase === 'walk') say('loco.join', {}); });
      } else say('loco.join', {});
      game.joinAt = now;
    } else {
      showRope(true);
      const skill = skillOf(def.rope.levels);
      game = { kind, skill, level: levelOf(skill), rounds: 0, phase: 'walk', wait: 6, period: def.rope.period, offBeat: 0 };
      newRope();
      deps.goTo(along(geo.rope, 0, 1.2));
      const r = getEntity(world(), 'folk:rope')?.folkRope;
      if (r) deps.emit({ type: 'workView', key: 'folk-rope', points: [r.a, r.b, geo.rope.o].map((p) => at(p)), sight: [at(geo.rope.o)] });
    }
    played(kind);
    deps.emit({ type: 'folk', game: kind, on: true });
    return true;
  }
  // The days when the child played each game (the weekly note of the parent page, #25).
  function played(kind) {
    const p = (deps.profile.folk ??= {});
    p[kind] = deps.day();
  }
  const say = (key, params, who = null, extra = {}) => {
    const id = who ?? (game?.kind === 'rope' ? 'npc:rope-child' : 'npc:loco-child');
    deps.callout(key, params, id, extra);
    if (game?.kind === 'loco') nameThing(key, id);
  };
  // The words with the things (#114: "vạch đầu" and "mảnh sành" were words that a child of 5 did
  // not know): when a child says the shard, the shard glows and the child points at it; when a
  // child says the start line, the start line glows.
  let nameToken = 0;
  function nameThing(key, id) {
    const thing = START_WORDS.has(key) ? getEntity(world(), 'folk:start') : SHARD_WORDS.has(key) ? getEntity(world(), 'folk:shard') : null;
    if (!thing || thing.hidden) return;
    const kid = getEntity(world(), id);
    if (kid) kid.gesture = { act: 'point', x: thing.position.x, z: thing.position.z, t: 3 };
    deps.emit({ type: 'names', ids: [thing.id], spots: [], bobs: [], seq: [], points: [] });
    const token = ++nameToken;
    later(NAME_GLOW, () => { if (token === nameToken) deps.emit({ type: 'names', ids: [], spots: [], bobs: [], seq: [], points: [] }); });
  }
  // A wave is never silent (#105): the child asked, so a child says the next step again, also when
  // it was the last line.
  const waveSay = (key, params) => say(key, params, null, { asked: true });

  // ---------------------------------------------------------------- Nhảy lò cò
  // The children stand beside the court where their bodies cover no square in the view (#99: the
  // court was behind the three children; #122: on the side away from the camera, their bodies
  // stood over the far squares). A body covers the ground behind it, away from the camera, as far
  // as its height over the slope of the view.
  function standAside() {
    const f = geo.loco;
    const az = deps.view?.() ?? Math.PI / 4;
    if (game) game.standAz = az;
    const pts = courtPoints(f, game?.court ?? []);
    const keep = [...pts.squares, pts.rest, pts.start, pts.home];
    const spots = asideSpots(f, az, keep, pts.half, def.loCo.children.length);
    def.loCo.children.forEach((_, k) => {
      const e = getEntity(world(), k === 0 ? 'npc:loco-child' : `folk:child:${k}`);
      if (!e) return;
      const p = spots[k];
      e.position = at(p, facingOf(p, along(f, (pts.half / 2) * S)));
    });
  }
  // The spots of n children near the court, at least a body apart, where no body covers a point of
  // the court in the view from the azimuth az. The nearest spots to the court come first.
  function asideSpots(f, az, keep, half, n) {
    const cam = { x: Math.sin(az), z: Math.cos(az) };
    const covers = (p, q) => {
      const dx = q.x - p.x;
      const dz = q.z - p.z;
      const back = -(dx * cam.x + dz * cam.z);
      const side = Math.abs(dx * cam.z - dz * cam.x);
      return back > -COVER_PAD && back < BODY_TALL / VIEW_SLOPE + COVER_PAD && side < BODY_HALF + COVER_PAD;
    };
    const tries = [];
    for (let b = 1.6; b <= 4; b += 0.6) for (const sb of [-1, 1]) for (let a = -1.5; a <= half + 1.5; a += 0.5) tries.push(along(f, a * S, sb * b * S));
    for (let a = -3; a <= -1.6; a += 0.7) for (let b = -1.5; b <= 1.5; b += 0.75) tries.push(along(f, a * S, b * S));
    for (let a = half + 1.6; a <= half + 3; a += 0.7) for (let b = -1.5; b <= 1.5; b += 0.75) tries.push(along(f, a * S, b * S));
    const mid = along(f, (half / 2) * S);
    const env = deps.env();
    const free = (p) => !env.isBlocked || !env.isBlocked(Math.floor(p.x / 2), Math.floor(p.z / 2));
    // The feet and the shadow of a child stay out of each square, with the width of the body and
    // a little more (a child at the edge of the court stood on it in the view).
    const clearOf = S / 2 + BODY_HALF + FEET_CLEAR;
    const onIt = (p, q) => Math.abs((p.x - q.x) * f.dir.x + (p.z - q.z) * f.dir.z) < clearOf && Math.abs((p.x - q.x) * f.side.x + (p.z - q.z) * f.side.z) < clearOf;
    const clear = tries.filter((p) => free(p) && keep.every((q) => !onIt(p, q) && !covers(p, q)))
      .sort((p, q) => Math.hypot(p.x - mid.x, p.z - mid.z) - Math.hypot(q.x - mid.x, q.z - mid.z));
    const out = [];
    for (const p of clear) {
      if (out.length >= n) break;
      if (out.every((q) => Math.hypot(p.x - q.x, p.z - q.z) >= KID_APART)) out.push(p);
    }
    // No clear spot (a court in a small yard): beside the court, on the side away from the camera.
    const toCam = f.side.x * cam.x + f.side.z * cam.z;
    for (let k = out.length; k < n; k++) out.push(along(f, (0.5 + k * 1.6) * S, (toCam > 0 ? -2.1 : 2.1) * S));
    return out;
  }
  // The view frames the whole court, the start line, and the shard where it lies (#114: the view
  // showed only a part of the court, and the child never saw the shard where it landed).
  function courtView() {
    const pts = courtPoints(geo.loco, game.court);
    const shard = getEntity(world(), 'folk:shard');
    const extra = shard && !shard.hidden ? [shard.position] : [];
    deps.emit({ type: 'workView', key: 'folk-loco', points: [...pts.squares, pts.rest, pts.start, pts.home, ...extra].map((p) => at(p)), sight: [at(pts.start)] });
  }
  // The start line glows until the hero stands on it (#99).
  function startGlow(on) {
    const id = 'folk:start';
    if (!on) return removeEntity(world(), id);
    const p = courtPoints(geo.loco, game.court).start;
    if (!getEntity(world(), id)) addEntity(world(), { id, keep: false, look: 'place-glow', position: at(p, Math.atan2(geo.loco.dir.x, geo.loco.dir.z)) });
  }
  function walkToStart() {
    const pts = courtPoints(geo.loco, game.court);
    game.phase = 'walk';
    game.wait = 8;
    game.still = 0;
    startGlow(true);
    deps.goTo(pts.start);
  }
  // The hero at the start line, facing along the court: a child calls the square. The shard lies at
  // the feet of the hero; the first time, a child shows it and says what it is (#114).
  function standAtStart() {
    startGlow(false);
    const pts = courtPoints(geo.loco, game.court);
    deps.command({ type: 'place', id: 'hero', x: pts.start.x, z: pts.start.z });
    deps.command({ type: 'face', id: 'hero', x: pts.start.x + geo.loco.dir.x * 4, z: pts.start.z + geo.loco.dir.z * 4 });
    const shard = getEntity(world(), 'folk:shard');
    if (shard) {
      Object.assign(shard.position, at(along(geo.loco, -0.3 * S, -0.5 * S)));
      shard.hidden = false;
    }
    // The line of the start is said whole before the next line (#114: the hero came to the start
    // at once, and the line of the shard took the place of the line of the start).
    const wait = Math.max(0, (game.joinAt ?? -Infinity) + JOIN_TIME - now);
    game.phase = 'show';
    later(wait, () => { if (game?.phase === 'show') showShard(); });
  }
  function showShard() {
    const folk = (deps.profile.folk ??= {});
    if (!folk.shardShown) {
      folk.shardShown = true;
      say('loco.shard', {});
      later(SHOW_SHARD, () => { if (game?.phase === 'show') callNow(); });
      return;
    }
    callNow();
  }
  function callNow() {
    if (!game.retry || game.call === null) {
      const c = callSquare(game.court, rngOf(`call:${game.rounds}:${game.prev}`), game.prev, game.plan.near, deps.profile.folk?.reach ?? FIRST_REACH);
      game.call = c;
      game.prev = c.square;
    }
    game.retry = false;
    const c = game.call;
    const value = game.court[c.square].value;
    if (c.base !== null) say('loco.call.near', { base: num(game.court[c.base].value), more: num(c.more) });
    else say('loco.call', { n: num(value) });
    game.phase = 'throw';
    deps.emit({ type: 'folkCall', square: c.square });
  }
  // The throw: the hold of the action button. While it is held, the see-through shard steps along
  // the court one square at a time (#114); when the button goes up, the shard lands there.
  function throwStart() {
    if (game?.phase !== 'throw') return;
    game.phase = 'aim';
    game.held = 0;
    game.aimAt = -1;
    aimStep();
  }
  function aimStep() {
    const n = game.court.length;
    const k = aimSquare(game.held, def.loCo, n);
    if (k === game.aimAt) return;
    game.aimAt = k;
    showAim(shardPoint(geo.loco, game.court, k + 0.5));
    deps.emit({ type: 'folkAim', square: k < n ? k : null });
  }
  // The see-through shard and the glow of its square at a point, or hidden (null).
  function showAim(p) {
    const aim = getEntity(world(), 'folk:aim');
    const glow = getEntity(world(), 'folk:aimglow');
    for (const e of [aim, glow]) {
      if (!e) continue;
      e.hidden = !p;
      if (p) Object.assign(e.position, at(p, Math.atan2(geo.loco.dir.x, geo.loco.dir.z)));
    }
  }
  function throwEnd() {
    if (game?.phase !== 'aim') return;
    const place = throwPlace(game.held, def.loCo, game.court.length);
    const r = judgeThrow(game.court, game.call.square, place, def.loCo);
    showAim(null);
    const shard = getEntity(world(), 'folk:shard');
    if (shard) {
      Object.assign(shard.position, at(shardPoint(geo.loco, game.court, place)));
      shard.hidden = false;
      shard.thrown = { t: 0, from: { ...hero().position } };
    }
    courtView();
    deps.emit({ type: 'throw', result: r.result, square: r.square, target: game.call.square, place });
    deps.skill({ type: 'skill', skill: game.skill, level: game.level, task: 'folk-loco', id: 'folk:shard', correct: r.result === 'in', solved: r.result === 'in', efficient: r.result === 'in', first: game.first, mashing: false, evidence: true, parts: [Math.round(place * 10) / 10], target: game.call.square + 0.5 });
    game.first = false;
    game.throwMisses = r.result === 'in' ? 0 : (game.throwMisses ?? 0) + 1;
    if (r.result === 'in') {
      // A throw in the called square: the next calls can go farther (#114).
      const folk = (deps.profile.folk ??= {});
      folk.reach = Math.max(folk.reach ?? FIRST_REACH, game.call.square + REACH_MORE);
      say('loco.in', {});
      game.hops = createHops(game.court, r.square);
      game.phase = 'hop';
      game.hopAt = now;
      deps.emit({ type: 'hops', shard: r.square });
    } else missWhy(r, place);
  }
  // A miss shows why (#114): the shard lies where it fell, and a child points at it and at the
  // called square, and says both ("Rơi vào ô ba. Ô bảy còn xa hơn."). After the second miss in a
  // row, a child shows a throw; else the turn of the other children.
  function missWhy(r, place) {
    const called = game.court[game.call.square];
    const kid = getEntity(world(), 'npc:loco-child');
    const shard = getEntity(world(), 'folk:shard');
    const target = at(courtPoints(geo.loco, game.court).squares[game.call.square]);
    const m = num(called.value);
    if (r.result === 'other') say(r.square > game.call.square ? 'loco.other.near' : 'loco.other.far', { n: num(game.court[r.square].value), m });
    else if (r.result === 'out') say('loco.out', { m });
    else say('loco.line', {});
    // After the line (its glow of the shard): the child points at the shard, then at the square.
    if (kid && shard) kid.gesture = { act: 'point', x: shard.position.x, z: shard.position.z, t: 1.8, then: { act: 'point', x: target.x, z: target.z, t: 2.2 } };
    deps.emit({ type: 'missWhy', result: r.result, square: r.square, target: game.call.square, place });
    game.phase = 'other';
    if (game.throwMisses >= 2) {
      game.throwMisses = 0;
      later(WHY_TIME, throwDemo);
    } else later(WHY_TIME, otherTurn);
  }
  // A child shows a throw once (#114, rule 34: show the action): beside the hero at the start line,
  // the child holds, the see-through shard steps along the court, and the child lets go at the
  // called square. Then the hero throws again at the same square.
  function throwDemo() {
    if (game?.kind !== 'loco') return;
    game.phase = 'demo';
    const kid = getEntity(world(), 'folk:child:2') ?? getEntity(world(), 'folk:child:1');
    const pts = courtPoints(geo.loco, game.court);
    const home = kid ? { ...kid.position } : null;
    if (kid) Object.assign(kid.position, at(pts.home, Math.atan2(geo.loco.dir.x, geo.loco.dir.z)));
    const shard = getEntity(world(), 'folk:shard');
    if (shard) shard.hidden = true;
    say('loco.throw.demo', {}, kid?.id);
    const k = game.call.square;
    for (let i = 0; i <= k; i++) {
      later(DEMO_WAIT + i * def.loCo.rate, () => {
        if (game?.phase !== 'demo') return;
        showAim(pts.squares[i]);
        deps.emit({ type: 'folkAim', square: i, by: kid?.id ?? null });
      });
    }
    const drop = DEMO_WAIT + (k + 0.6) * def.loCo.rate;
    later(drop, () => {
      if (game?.phase !== 'demo') return;
      showAim(null);
      if (shard) {
        Object.assign(shard.position, at(pts.squares[k]));
        shard.hidden = false;
        shard.thrown = { t: 0, from: { ...(kid?.position ?? hero().position) } };
      }
      deps.emit({ type: 'throw', result: 'in', square: k, target: k, place: k + 0.5, by: kid?.id ?? null });
      say('loco.call', { n: num(game.court[k].value) }, kid?.id);
    });
    later(drop + DEMO_LOOK, () => {
      if (game?.phase !== 'demo') return;
      if (kid && home) Object.assign(kid.position, home);
      if (shard) shard.hidden = true;
      game.retry = true;
      walkToStart();
    });
    deps.emit({ type: 'demo', game: 'loco', throw: k });
  }
  // A press of the jump on the court: one square, or two over the shard with a long press.
  function hopPress(held) {
    if (game?.phase !== 'hop') return false;
    // At grades K to 2, a press during a hop waits and acts when the hop ends (#132: three quick
    // presses ended the turn near its end; rule 22: mashing is no evidence, not an error).
    const early = def.loCo.settle - (now - game.hops.last);
    if (early > 0 && Number(deps.profile.grade ?? 1) <= HOLD_GRADE) {
      if (!game.hopWait) {
        game.hopWait = true;
        later(early + 0.01, () => {
          if (!game) return;
          game.hopWait = false;
          if (game.phase === 'hop') hopPress(held);
        });
      }
      return true;
    }
    const long = held >= def.loCo.long;
    const pts = courtPoints(geo.loco, game.court);
    const events = hop(game.hops, { long, time: now }, def.loCo);
    for (const ev of events) {
      if (ev.type === 'land') {
        jumpTo(pts.squares[ev.square]);
        // The children say the number of the square (count on).
        say(`num.${ev.value}`, {}, childOf(ev.square));
      } else if (ev.type === 'rest') {
        jumpTo(pts.rest);
        // At the half circle a child says the way back, and the shard glows (#122: "I counted một to
        // mười! … But nothing happens now. Did I win?"). When the shard lies on the last square,
        // the line of the pick says it.
        if (!events.some((x) => x.type === 'pick')) later(def.loCo.hop + 0.1, () => say('loco.rest', {}));
        later(def.loCo.hop + 0.2, () => deps.command({ type: 'face', id: 'hero', x: geo.loco.o.x, z: geo.loco.o.z }));
      } else if (ev.type === 'pick') {
        later(def.loCo.hop + 0.15, () => {
          const shard = getEntity(world(), 'folk:shard');
          if (shard) shard.hidden = true;
          say('loco.pick', {});
          deps.emit({ type: 'pick', id: 'hero', item: 'folk:shard' });
        });
      } else if (ev.type === 'home') {
        jumpTo(pts.home);
        later(def.loCo.hop + 0.2, () => roundDone());
      } else turnEnds(ev);
    }
    deps.emit({ type: 'hopPress', long, events: events.map((e) => e.type) });
    return true;
  }
  const childOf = (k) => (k % 2 ? 'folk:child:1' : 'npc:loco-child');
  function jumpTo(p) {
    deps.command({ type: 'jump', id: 'hero', kind: 'jump', to: { x: p.x, z: p.z }, top: 0.9, time: def.loCo.hop, splash: false });
  }
  // A landing on the shard, a press too soon (on a line), or a long hop over a square with no
  // shard: the turn goes to the next child, with no loss.
  function turnEnds(ev) {
    say(`loco.fail.${ev.type}`, {});
    const kind = ev.type;
    game.misses[kind] = (game.misses[kind] ?? 0) + 1;
    deps.skill({ type: 'skill', skill: game.skill, level: game.level, task: 'folk-loco', id: 'hero', correct: false, solved: false, efficient: false, first: false, mashing: kind === 'line', evidence: true, parts: game.hops.landed.map((i) => game.court[i].value), target: game.court.length });
    deps.emit({ type: 'turn', end: kind });
    game.retry = true;
    // The children as peers: after two misses of the same kind, an older child shows the skip once
    // on another square; after two presses too soon, they draw a shorter court.
    if ((kind === 'shard' || kind === 'skip') && game.misses[kind] >= 2 && !game.demoed) {
      game.demoed = true;
      demo();
      return;
    }
    if (kind === 'line' && game.misses.line >= 2 && game.court.length > def.loCo.short) {
      game.misses.line = 0;
      game.plan = { ...game.plan, squares: def.loCo.short };
      game.court = courtOf(game.plan);
      game.call = null;
      setCourt(game.court);
      later(1.2, () => say('loco.slow', {}));
    }
    otherTurn();
  }
  // A good round: there and back, with the shard.
  function roundDone() {
    deps.skill({ type: 'skill', skill: game.skill, level: game.level, task: 'folk-loco', id: 'hero', correct: true, solved: true, efficient: true, first: false, mashing: false, evidence: true, parts: game.hops.landed.map((i) => game.court[i].value), target: game.court.length });
    game.rounds += 1;
    deps.emit({ type: 'round', game: 'loco', rounds: game.rounds });
    if (game.rounds >= def.loCo.rounds) return endSet('loco.done');
    say('loco.good', {});
    // How many rounds are left (#132: "How many turns are there?").
    const left = def.loCo.rounds - game.rounds;
    later(1.2, () => { if (game?.kind === 'loco') say(left === 1 ? 'loco.left.one' : 'loco.left', { n: num(left) }); });
    game.retry = false;
    later(3, walkToStart);
    game.phase = 'wait';
  }
  // The turn of another child, in view and short (#114: "I didn't see their turn"): the child
  // throws the shard to a near square at the start line and hops up the court over it, then the
  // hero again.
  function otherTurn() {
    if (game?.kind !== 'loco') return;
    game.phase = 'other';
    const kid = getEntity(world(), 'folk:child:1');
    const pts = courtPoints(geo.loco, game.court);
    const shard = getEntity(world(), 'folk:shard');
    const home = kid ? { ...kid.position } : null;
    const s = 1 + (game.rounds + (game.prev ?? 0)) % 2;
    const facing = Math.atan2(geo.loco.dir.x, geo.loco.dir.z);
    if (kid) Object.assign(kid.position, at(pts.start, facing));
    later(OTHER_THROW, () => {
      if (shard) {
        Object.assign(shard.position, at(pts.squares[s]));
        shard.hidden = false;
        shard.thrown = { t: 0, from: { ...(kid?.position ?? pts.start) } };
      }
    });
    const squares = Array.from({ length: OTHER_HOPS + 1 }, (_, i) => i).filter((i) => i !== s);
    squares.forEach((i, k) => later(OTHER_THROW + 0.8 + k * OTHER_HOP, () => {
      if (!kid || game?.phase !== 'other') return;
      Object.assign(kid.position, at(pts.squares[i], facing));
      kid.hop = { t: 0 };
    }));
    const end = OTHER_THROW + 0.8 + squares.length * OTHER_HOP + 0.3;
    later(end, () => {
      if (kid && home) Object.assign(kid.position, home);
      if (shard) shard.hidden = true;
      if (game?.kind === 'loco' && game.phase === 'other') walkToStart();
    });
    say('loco.turn', {}, kid?.id);
    deps.emit({ type: 'otherTurn', shard: s, hops: squares });
  }
  // An older child shows the skip once: a pebble on another square, and the hops over it.
  function demo() {
    game.phase = 'demo';
    const kid = getEntity(world(), 'folk:child:2') ?? getEntity(world(), 'folk:child:1');
    const pts = courtPoints(geo.loco, game.court);
    const over = game.hops.shard === 2 ? 3 : 2;
    say('loco.demo', {}, kid?.id);
    const shard = getEntity(world(), 'folk:shard');
    if (shard) Object.assign(shard.position, at(pts.squares[over])), shard.hidden = false;
    const home = kid ? { ...kid.position } : null;
    const steps = [over - 2, over - 1, over + 1, over + 2].filter((i) => i >= 0);
    steps.forEach((i, k) => later(1 + k * 0.7, () => {
      if (!kid) return;
      Object.assign(kid.position, at(pts.squares[i], kid.position.facing));
      kid.hop = { t: 0 };
      deps.callout(`num.${game.court[i].value}`, {}, kid.id);
    }));
    later(1 + steps.length * 0.7 + 0.8, () => { if (kid) Object.assign(kid.position, home); otherTurn(); });
    deps.emit({ type: 'demo', game: 'loco', over });
  }

  // ---------------------------------------------------------------- Nhảy dây
  function newRope() {
    const plan = ropePlan(def.rope.levels, game.skill, rngOf(`rope:${game.rounds}`));
    game.plan = plan;
    game.rope = createRope(plan, game.period);
    game.rope.wait = 1.2;
    say('rope.goal', { n: num(plan.target) });
  }
  function ropePress() {
    if (game?.kind !== 'rope' || game.phase !== 'rope') return false;
    const events = jumpRope(game.rope, def.rope);
    const count = game.rope.count;
    deps.command({ type: 'jump', id: 'hero', kind: 'hop', to: { x: hero().position.x, z: hero().position.z }, top: 1.2, time: 0.34, splash: false });
    for (const ev of events) {
      if (ev.type === 'count') {
        game.offBeat = 0;
        say(`num.${ev.count}`, {});
      }
      if (ev.type === 'miss') ropeMiss(ev, true);
      if (ev.type === 'done') ropeDone(ev);
    }
    deps.emit({ type: 'ropeJump', events: events.map((e) => e.type), count });
    return true;
  }
  function ropeMiss(ev, tap) {
    if (ev.count > 0) say('rope.miss.from', { n: num(ev.count) });
    else say('rope.miss', {});
    deps.emit({ type: 'ropeMiss', count: ev.count });
    if (!tap) return;
    // Taps off the beat, one after another (mashing): the children turn the rope slower.
    game.offBeat += 1;
    if (game.offBeat >= 2) {
      game.offBeat = 0;
      game.rope.period *= def.rope.slower;
      later(0.8, () => say('rope.slow', {}));
    }
  }
  function ropeDone(ev) {
    deps.skill({ type: 'skill', skill: game.skill, level: game.level, task: 'folk-rope', id: 'hero', correct: true, solved: true, efficient: ev.clean, first: false, mashing: false, evidence: true, parts: [game.rope.count], target: game.plan.target });
    game.rounds += 1;
    game.period = ev.clean ? Math.max(def.rope.fastest, game.rope.period * def.rope.faster) : game.rope.period;
    deps.emit({ type: 'round', game: 'rope', rounds: game.rounds, clean: ev.clean });
    if (game.rounds >= def.rope.rounds) return endSet('rope.done', { n: num(game.plan.target) });
    say('rope.good', { n: num(game.plan.target) });
    game.phase = 'wait';
    later(2, () => { if (game?.kind === 'rope') { newRope(); game.phase = 'rope'; } });
  }

  // ---------------------------------------------------------------- The set, the tick
  function endSet(key, params = {}) {
    const kind = game.kind;
    inviteAt[kind] = now + AGAIN;
    say(key, params);
    deps.emit({ type: 'folk', game: kind, on: false, rounds: game.rounds });
    if (kind === 'loco') startGlow(false);
    game = null;
    for (const id of ['folk:shard', 'folk:aim', 'folk:aimglow']) {
      const e = getEntity(world(), id);
      if (e) e.hidden = true;
    }
    later(1.5, () => deps.setDone(kind));
  }
  function stop() {
    if (!game) return;
    if (game.kind === 'loco') {
      startGlow(false);
      showAim(null);
    }
    inviteAt[game.kind] = now + AGAIN;
    deps.emit({ type: 'folk', game: game.kind, on: false, rounds: game.rounds });
    game = null;
  }

  const timers = [];
  function later(t, fn) { timers.push({ at: now + t, fn }); }

  function tick(dt) {
    now += dt;
    for (let i = timers.length - 1; i >= 0; i--) {
      if (timers[i].at <= now) {
        const t = timers.splice(i, 1)[0];
        t.fn();
      }
    }
    if (!geo) return;
    showRope(ropeOn());
    const h = hero();
    if (!h) return;
    // The rope turns, with or without the hero.
    const rope = getEntity(world(), 'folk:rope');
    if (rope) {
      const r = game?.kind === 'rope' && game.rope ? game.rope : null;
      if (r) Object.assign(rope.folkRope, { turn: r.time / r.period, period: r.period, still: r.wait > 0 });
      else rope.folkRope.turn += dt / def.rope.period;
    }
    for (const e of world().entities) if (e.hop && e.folkChild) { e.hop.t += dt; if (e.hop.t > 0.5) delete e.hop; }
    const shard = getEntity(world(), 'folk:shard');
    if (shard?.thrown) { shard.thrown.t += dt; if (shard.thrown.t > 0.6) delete shard.thrown; }
    if (!game) return invite(h);
    // The view turned (to the court, at the start of the game): the children go to the side away
    // from the camera again (#99: they stood in front of the court).
    if (game.kind === 'loco' && !['hop', 'other', 'demo'].includes(game.phase) && deps.view && deps.view() !== game.standAz && !world().entities.some((e) => e.hop && e.folkChild)) standAside();
    const centre = game.kind === 'loco' ? along(geo.loco, 3 * S) : geo.rope.o;
    // A child who walks away leaves the game, in each phase (#132: "I walked and walked and now I'm
    // back at the lò cò squares").
    // (A hero who joins from farther away, on the walk to the start, leaves only after being near.)
    const far = dist(h.position, centre) > LEAVE;
    if (!far) game.wasNear = true;
    if (far && (game.wasNear || game.phase !== 'walk')) {
      say(`${game.kind === 'loco' ? 'loco' : 'rope'}.leave`, {});
      return stop();
    }
    if (game.phase === 'walk') {
      game.wait -= dt;
      const target = game.kind === 'loco' ? courtPoints(geo.loco, game.court).start : along(geo.rope, 0, 1.2);
      // A hero who stands still near the start line stands at it too (#114: the child stood by the
      // court, and the call came only after a guess).
      const d = dist(h.position, target);
      game.still = !h.route && d < STILL_START ? (game.still ?? 0) + dt : 0;
      // The end of the wait puts the hero at the start only when the hero is near it: the phase of
      // the walk never moves a hero who walks away.
      if (d < (game.kind === 'loco' ? NEAR_START : 3) || (game.kind === 'loco' && game.still >= STILL_WAIT) || (game.wait <= 0 && d < STILL_START)) {
        if (game.kind === 'loco') standAtStart();
        else {
          deps.command({ type: 'place', id: 'hero', x: geo.rope.o.x, z: geo.rope.o.z });
          deps.command({ type: 'face', id: 'hero', x: geo.rope.o.x + geo.rope.side.x * 4, z: geo.rope.o.z + geo.rope.side.z * 4 });
          game.phase = 'rope';
        }
      }
    } else if (game.phase === 'aim') {
      game.held += dt;
      aimStep();
    }
    else if (game.phase === 'rope') {
      for (const ev of stepRope(game.rope, dt, def.rope)) {
        if (ev.type === 'beat') deps.emit({ type: 'ropeBeat', k: ev.k });
        if (ev.type === 'miss') ropeMiss(ev, false);
      }
    }
  }
  // The children ask a hero who comes near and does not play.
  function invite(h) {
    for (const kind of ['loco', 'rope']) {
      if (!geo[kind] || (kind === 'rope' && !ropeOn()) || deps.busy() || deps.quiet?.()) continue;
      const centre = kind === 'loco' ? along(geo.loco, 2 * S) : geo.rope.o;
      if (dist(h.position, centre) <= INVITE && now >= inviteAt[kind]) {
        inviteAt[kind] = now + AGAIN;
        deps.callout(`${kind}.invite`, {}, kind === 'loco' ? 'npc:loco-child' : 'npc:rope-child');
      }
    }
  }

  // A tap on a child of a game, out of the game: the child answers with the ask to play (#114).
  function answer(id) {
    const kind = getEntity(world(), id)?.folkChild;
    if (!kind || game) return false;
    inviteAt[kind] = now + AGAIN;
    deps.callout(`${kind}.invite`, {}, id);
    return true;
  }

  // ---------------------------------------------------------------- The action button
  // The acts of the games for the action button: join (near the children), and the throw (a hold).
  function candidates(add, reach) {
    const h = hero();
    if (!h || !geo) return;
    if (!game) {
      for (const kind of ['loco', 'rope']) {
        if (!geo[kind] || (kind === 'rope' && !ropeOn())) continue;
        const kid = getEntity(world(), kind === 'loco' ? 'npc:loco-child' : 'npc:rope-child');
        if (kid) add({ act: 'play', icon: 'talk', target: kid.id, at: kid.position, rank: 1, run: () => join(kind) }, reach + 3);
      }
      return;
    }
    // The throw only near the start line (#132: far away by the buffaloes, the shard still flew).
    const start = game.kind === 'loco' ? courtPoints(geo.loco, game.court).start : null;
    if (game.kind === 'loco' && (game.phase === 'throw' || game.phase === 'aim') && dist(h.position, start) <= THROW_NEAR) {
      add({ act: 'throw', icon: 'shard', target: 'hero', at: h.position, rank: 0, hold: true, run: throwStart, release: throwEnd }, reach + 1);
    }
  }

  // A wave in a game (#99, rule 41): a child says the next step now. Return true in a game.
  function wave() {
    if (!game) return false;
    if (game.kind === 'rope') waveSay('rope.goal', { n: num(game.plan.target) });
    else if (game.phase === 'walk') {
      startGlow(true);
      waveSay('loco.join', {});
    } else if (game.phase === 'show') waveSay('loco.shard', {});
    else if (game.phase === 'throw' || game.phase === 'aim') {
      const c = game.call;
      if (c) waveSay(c.base !== null ? 'loco.call.near' : 'loco.call', c.base !== null ? { base: num(game.court[c.base].value), more: num(c.more) } : { n: num(game.court[c.square].value) });
      later(1.5, () => { if (game?.phase === 'throw') waveSay('loco.how.throw', {}); });
    } else if (game.phase === 'hop') waveSay('loco.how.hop', {});
    else waveSay('loco.how.wait', {});
    return true;
  }

  // A press of the jump: the rope counts it at once; the court waits for the end of the press.
  const jump = () => (game?.kind === 'rope' ? ropePress() : game?.kind === 'loco' && game.phase === 'hop');
  const jumpUp = (held) => hopPress(held);

  return {
    mapStart, tick, join, stop, candidates, jump, jumpUp, wave, answer,
    active: () => game?.kind ?? null,
    stateOf: () => (game ? { kind: game.kind, phase: game.phase, rounds: game.rounds, skill: game.skill, call: game.call?.square ?? null, count: game.rope?.count ?? null, group: game.plan?.group ?? null, target: game.plan?.target ?? null, court: game.court?.map((s) => s.value) ?? null, hops: game.phase === 'hop' && game.hops ? { pos: game.hops.pos, shard: game.hops.shard } : null } : null),
  };
}
