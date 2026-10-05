// The folk games of the village children in the session (#30; docs/FOLKGAMES.md): nhảy lò cò on a
// court by the đình of Phù Đổng, and nhảy dây at the feast of Xóm Ruộng (or in a practice). The
// children play on their own; when the hero comes near, they ask in words, and the action button
// joins them. The rules are in src/core/folkgames.js. Pure: no DOM.
//
// deps: data (folkgames), profile, world(), env(), learner(), seed(), emit, callout(textKey,
// params, entity id), command(cmd) (a command of the world), goTo(point), skill(ev) (a skill event
// for the learner and the learning log), feastOn(), practice() (the task of a practice, or null),
// setDone(game) (the end of a set: true when a practice ends it), busy(), day().

import { addEntity, removeEntity, getEntity } from './world/state.js';
import { createRng, hashSeed } from './rng.js';
import { courtPlan, courtOf, callSquare, throwPlace, judgeThrow, createHops, hop, ropePlan, createRope, stepRope, jumpRope } from './folkgames.js';

const S = 2; // half blocks: the side of a square of the court
const INVITE = 14; // half blocks: the children ask a hero this near
const AGAIN = 90; // seconds before the children ask again
const LEAVE = 26; // half blocks: a hero this far away leaves the game
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
      const plan = courtPlan(def.loCo.levels, skill, rngOf('court'));
      game = { kind, skill, level: levelOf(skill), plan, court: courtOf(plan), rounds: 0, misses: {}, demoed: false, call: null, prev: null, phase: 'walk', wait: 8, retry: false, first: true };
      setCourt(game.court);
      // The view turns so that no house covers the court (the event workView, #38).
      const pts = courtPoints(geo.loco, game.court);
      deps.emit({ type: 'workView', key: 'folk-loco', points: [...pts.squares, pts.rest, pts.start].map((p) => at(p)), sight: [at(pts.start)] });
      if (plan.start !== 1) say('loco.start', { n: num(plan.start) });
      else say('loco.join', {});
      walkToStart();
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
  const say = (key, params, who = null) => deps.callout(key, params, who ?? (game?.kind === 'rope' ? 'npc:rope-child' : 'npc:loco-child'));

  // ---------------------------------------------------------------- Nhảy lò cò
  function walkToStart() {
    const pts = courtPoints(geo.loco, game.court);
    game.phase = 'walk';
    game.wait = 8;
    deps.goTo(pts.start);
  }
  // The hero at the start line, facing along the court: a child calls the square.
  function standAtStart() {
    const pts = courtPoints(geo.loco, game.court);
    deps.command({ type: 'place', id: 'hero', x: pts.start.x, z: pts.start.z });
    deps.command({ type: 'face', id: 'hero', x: pts.start.x + geo.loco.dir.x * 4, z: pts.start.z + geo.loco.dir.z * 4 });
    if (!game.retry || game.call === null) {
      const c = callSquare(game.court, rngOf(`call:${game.rounds}:${game.prev}`), game.prev, game.plan.near);
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
  // The throw: the hold of the action button. The longer the hold, the farther the shard.
  function throwStart() {
    if (game?.phase !== 'throw') return;
    game.phase = 'aim';
    game.held = 0;
  }
  function throwEnd() {
    if (game?.phase !== 'aim') return;
    const place = throwPlace(game.held, def.loCo);
    const r = judgeThrow(game.court, game.call.square, place, def.loCo);
    const shard = getEntity(world(), 'folk:shard');
    if (shard) {
      Object.assign(shard.position, at(shardPoint(geo.loco, game.court, place)));
      shard.hidden = false;
      shard.thrown = { t: 0, from: { ...hero().position } };
    }
    deps.emit({ type: 'throw', result: r.result, square: r.square, target: game.call.square, place });
    deps.skill({ type: 'skill', skill: game.skill, level: game.level, task: 'folk-loco', id: 'folk:shard', correct: r.result === 'in', solved: r.result === 'in', efficient: r.result === 'in', first: game.first, mashing: false, evidence: true, parts: [Math.round(place * 10) / 10], target: game.call.square + 0.5 });
    game.first = false;
    if (r.result === 'in') {
      say('loco.in', {});
      game.hops = createHops(game.court, r.square);
      game.phase = 'hop';
      game.hopAt = now;
      deps.emit({ type: 'hops', shard: r.square });
    } else {
      if (r.result === 'other') say('loco.other', { n: num(game.court[r.square].value) });
      else say(r.result === 'line' ? 'loco.line' : 'loco.out', {});
      otherTurn();
    }
  }
  // A press of the jump on the court: one square, or two over the shard with a long press.
  function hopPress(held) {
    if (game?.phase !== 'hop') return false;
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
    game.retry = false;
    later(1.5, walkToStart);
    game.phase = 'wait';
  }
  // The turn of another child: a few hops on the court, then the hero again.
  function otherTurn() {
    game.phase = 'other';
    const kid = getEntity(world(), 'folk:child:1');
    const pts = courtPoints(geo.loco, game.court);
    const home = kid ? { ...kid.position } : null;
    if (kid) {
      [0, 1, 2].forEach((k) => later(0.6 + k * 0.55, () => { Object.assign(kid.position, at(pts.squares[k], kid.position.facing)); kid.hop = { t: 0 }; }));
      later(def.loCo.other - 0.4, () => Object.assign(kid.position, home));
    }
    later(def.loCo.other, () => { if (game?.kind === 'loco') walkToStart(); });
    getEntity(world(), 'folk:shard').hidden = true;
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
    game = null;
    const shard = getEntity(world(), 'folk:shard');
    if (shard) shard.hidden = true;
    later(1.5, () => deps.setDone(kind));
  }
  function stop() {
    if (!game) return;
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
    const centre = game.kind === 'loco' ? along(geo.loco, 3 * S) : geo.rope.o;
    if (dist(h.position, centre) > LEAVE && game.phase !== 'walk') {
      say(`${game.kind === 'loco' ? 'loco' : 'rope'}.leave`, {});
      return stop();
    }
    if (game.phase === 'walk') {
      game.wait -= dt;
      const target = game.kind === 'loco' ? courtPoints(geo.loco, game.court).start : along(geo.rope, 0, 1.2);
      if (dist(h.position, target) < 3 || game.wait <= 0) {
        if (game.kind === 'loco') standAtStart();
        else {
          deps.command({ type: 'place', id: 'hero', x: geo.rope.o.x, z: geo.rope.o.z });
          deps.command({ type: 'face', id: 'hero', x: geo.rope.o.x + geo.rope.side.x * 4, z: geo.rope.o.z + geo.rope.side.z * 4 });
          game.phase = 'rope';
        }
      }
    } else if (game.phase === 'aim') game.held += dt;
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
      if (!geo[kind] || (kind === 'rope' && !ropeOn()) || deps.busy()) continue;
      const centre = kind === 'loco' ? along(geo.loco, 2 * S) : geo.rope.o;
      if (dist(h.position, centre) <= INVITE && now >= inviteAt[kind]) {
        inviteAt[kind] = now + AGAIN;
        deps.callout(`${kind}.invite`, {}, kind === 'loco' ? 'npc:loco-child' : 'npc:rope-child');
      }
    }
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
    if (game.kind === 'loco' && (game.phase === 'throw' || game.phase === 'aim')) {
      add({ act: 'throw', icon: 'shard', target: 'hero', at: h.position, rank: 0, hold: true, run: throwStart, release: throwEnd }, reach + 1);
    }
  }

  // A press of the jump: the rope counts it at once; the court waits for the end of the press.
  const jump = () => (game?.kind === 'rope' ? ropePress() : game?.kind === 'loco' && game.phase === 'hop');
  const jumpUp = (held) => hopPress(held);

  return {
    mapStart, tick, join, stop, candidates, jump, jumpUp,
    active: () => game?.kind ?? null,
    stateOf: () => (game ? { kind: game.kind, phase: game.phase, rounds: game.rounds, skill: game.skill, call: game.call?.square ?? null, count: game.rope?.count ?? null, group: game.plan?.group ?? null, target: game.plan?.target ?? null, court: game.court?.map((s) => s.value) ?? null } : null),
  };
}
