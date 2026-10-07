// The view of a raid in the village scene: the slingshot, the drags of the elements, the taps on
// the things of the raid, and the marks over the enemies. No rules here: the view sends commands
// to the session (src/core/session.js), and the raid (src/core/world/raids.js) answers.
//
//   The slingshot: the child puts a finger on the hero and pulls back. The band stretches in steps
//   of one half block: a tick at each step and a red band at every fifth, the same marks as the
//   posts. No arc shows before the shot. Let go: the stone lands at the count along the road.
//   An element: the child puts a finger on a source (the jar, the brazier, the forge, or a torch
//   that burns on the road) and drags it to a point on the ground. Let go: pour.
//   The marks: over each enemy a row of dots, one for each hit that it can still take; a hit pops
//   up as red dots over the enemy (no numeral in the world).
import { getEntity, query } from '../core/world/state.js';
import { C } from '../render/palette.js';
import { takesSling, isPull } from '../world/sling.js';

const FLOW = { water: C.indigo, fire: C.vermilion, lightning: C.yellow };

// view: the voxel view. figures: the figure layer. session: the session of the village. layer: a
// canvas over the world for the marks of the raid. send(cmd): send a command to the session.
export function createRaidView({ view, figures, session, layer, send }) {
  const draw2d = layer.getContext('2d');
  const state = () => session.state;
  const raid = () => getEntity(state(), 'raid')?.raid ?? null;
  let sling = null; // { id, x, y }: the finger that pulls the slingshot
  let flow = null; // { id, source, kind, x, y }: the finger that drags an element
  const pops = []; // { id, n, age }
  let demo = 0; // seconds: the hand that shows the pull of the slingshot
  let size = { w: 1, h: 1 };

  // The box of a figure on the screen, with some room for a finger.
  const under = (id, p, pad = 10) => {
    const f = figures.placeOf(id);
    if (!f) return false;
    const b = view.screenBox({ x0: f.x - 0.8, x1: f.x + 0.8, y0: f.y, y1: f.y + Math.max(0.6, f.height) + 0.2, z0: f.z - 0.8, z1: f.z + 0.8 });
    return p.x >= b.x0 - pad && p.x <= b.x1 + pad && p.y >= b.y0 - pad && p.y <= b.y1 + pad;
  };
  // The box of a figure on the screen, and its middle.
  const boxOf = (id) => {
    const f = figures.placeOf(id);
    if (!f) return null;
    return view.screenBox({ x0: f.x - 0.8, x1: f.x + 0.8, y0: f.y, y1: f.y + Math.max(0.6, f.height) + 0.2, z0: f.z - 0.8, z1: f.z + 0.8 });
  };
  const middleOf = (b) => (b ? { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 } : null);
  const heroScreen = () => {
    const f = figures.placeOf('hero');
    return f ? view.project(f.x, f.y + 1, f.z) : null;
  };
  // The length of one step of the band on the screen (one half block of the pull).
  const stepPx = () => Math.max(7, Math.min(11, Math.min(size.w, size.h) / 90));
  // The pull of the slingshot now: the count of steps (whole half blocks, 0 to the longest pull),
  // and the direction of the band on the screen.
  // The direction away from the road on the screen (a pull of the big button goes this way).
  function backward() {
    const r = raid();
    const f = figures.placeOf('hero');
    if (!r || !f) return null;
    const a = view.project(f.x, f.y + 1, f.z);
    const b = view.project(f.x + r.dir.x * 5, f.y + 1, f.z + r.dir.z * 5);
    const n = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    return { ux: (a.x - b.x) / n, uy: (a.y - b.y) / n };
  }
  function aim() {
    const h = heroScreen();
    const r = raid();
    // A pull with the big button (#50): the band goes back from the hero, away from the road.
    const held = session.raidPull?.() ?? 0;
    if (!sling && held && h && r) {
      const u = backward();
      return u ? { count: held, ux: u.ux, uy: u.uy, from: h } : null;
    }
    if (!sling || !h || !r) return null;
    const dx = sling.x - h.x;
    const dy = sling.y - h.y;
    const px = Math.hypot(dx, dy);
    const count = Math.max(0, Math.min(r.sling.max, Math.round(px / stepPx())));
    return { count, ux: px ? dx / px : 0, uy: px ? dy / px : 1, from: h };
  }

  return {
    // Is a raid on now?
    get on() { return Boolean(raid() && !raid().result); },
    // A finger down: on the hero (with empty hands) it takes the slingshot; on a source it takes
    // an element. Return true when the raid takes this finger. up() returns 'tap' for a touch of
    // the slingshot that did not pull.
    down(p, id) {
      if (!this.on) return false;
      // The slingshot: a finger on the hero, not on Nghé next to the hero (#50).
      const hb = boxOf('hero');
      if (!session.holding() && takesSling(p, hb, middleOf(hb), [middleOf(boxOf('friend:nghe'))])) {
        sling = { id, x: p.x, y: p.y, x0: p.x, y0: p.y };
        return true;
      }
      for (const e of query(state(), 'source', 'position')) {
        if (!under(e.id, p, 8)) continue;
        flow = { id, source: e.source.id, kind: e.source.kind, x: p.x, y: p.y };
        return true;
      }
      return false;
    },
    move(p, id) {
      if (sling?.id === id) Object.assign(sling, { x: p.x, y: p.y });
      else if (flow?.id === id) Object.assign(flow, { x: p.x, y: p.y });
      else return false;
      return true;
    },
    up(p, id) {
      if (sling?.id === id) {
        const a = aim();
        const pulled = isPull({ x: sling.x0, y: sling.y0 }, p, stepPx());
        sling = null;
        // A touch that does not pull is a tap on the world, never a shot (#50).
        if (!pulled) return 'tap';
        // No step is no shot (the finger went back to the hero).
        if (a?.count) send({ type: 'shoot', count: a.count });
        return true;
      }
      if (flow?.id === id) {
        const f = flow;
        flow = null;
        const hit = view.pick(p.x, p.y);
        if (hit) send({ type: 'pour', source: f.source, x: hit.x, y: hit.y });
        return true;
      }
      return false;
    },
    cancel() {
      sling = null;
      flow = null;
    },
    // The thing of the raid under a finger (the gate bar, a spot, the bamboo), as a tap target.
    targetAt(p) {
      if (!this.on) return null;
      for (const e of query(state(), 'raidTap', 'position')) if (under(e.id, p, 12)) return { raid: e.raidTap };
      return null;
    },
    // An event of the world: a hit pops up over the enemy.
    event(ev) {
      if (ev.type === 'hit') pops.push({ id: ev.id, n: ev.damage, age: 0 });
      if (ev.type === 'raid' && ev.on === false) this.cancel();
    },
    // The focus of the camera in a raid: between the hero and the middle of the road, so that the
    // child sees the enemies come.
    focus(heroPlace) {
      const r = raid();
      if (!r || !heroPlace) return heroPlace;
      // The first raid of the traps waits for the first trap in the hands (#50): the pile is on the
      // screen, between it and the hero.
      if (r.hold?.tool === 'traps') {
        const pile = query(state(), 'item', 'position').filter((e) => e.item.kind === 'trap' && !e.item.set && !e.item.held);
        if (pile.length) {
          const px = pile.reduce((a, e) => a + e.position.x, 0) / pile.length;
          const pz = pile.reduce((a, e) => a + e.position.z, 0) / pile.length;
          return { ...heroPlace, x: (heroPlace.x + px) / 2, z: (heroPlace.z + pz) / 2 };
        }
      }
      const mid = { x: (r.wall.x + r.dir.x * 14) / 2, z: (r.wall.z + r.dir.z * 14) / 2 };
      return { ...heroPlace, x: heroPlace.x * 0.3 + mid.x * 0.7, z: heroPlace.z * 0.3 + mid.z * 0.7 };
    },
    // Each frame: the dotted arc, the flow of an element, the dots over the enemies, and the pops.
    draw(dt, w, h) {
      if (layer.width !== w || layer.height !== h) {
        layer.width = w;
        layer.height = h;
      }
      size = { w, h };
      draw2d.clearRect(0, 0, w, h);
      const r = raid();
      layer.hidden = !r && !pops.length;
      if (layer.hidden) return;
      draw2d.lineCap = 'round';
      // The slingshot: the band from the hero to the end of the last whole step, with a tick at
      // each step and a red band at every fifth (as on the posts). No arc before the shot.
      const a = aim();
      if (a && r) {
        const step = stepPx();
        const end = { x: a.from.x + a.ux * a.count * step, y: a.from.y + a.uy * a.count * step };
        draw2d.strokeStyle = C.wood;
        draw2d.lineWidth = 5;
        draw2d.beginPath();
        draw2d.moveTo(a.from.x, a.from.y);
        draw2d.lineTo(end.x, end.y);
        draw2d.stroke();
        for (let k = 1; k <= a.count; k++) {
          const c = { x: a.from.x + a.ux * k * step, y: a.from.y + a.uy * k * step };
          const fifth = k % 5 === 0;
          const half = fifth ? 11 : 6;
          draw2d.strokeStyle = fifth ? C.vermilion : C.ink;
          draw2d.lineWidth = fifth ? 5 : 2;
          draw2d.beginPath();
          draw2d.moveTo(c.x - a.uy * half, c.y + a.ux * half);
          draw2d.lineTo(c.x + a.uy * half, c.y - a.ux * half);
          draw2d.stroke();
        }
        // The pouch with the stone at the end of the band.
        draw2d.beginPath();
        draw2d.arc(end.x, end.y, 7, 0, Math.PI * 2);
        draw2d.fillStyle = C.ash;
        draw2d.fill();
        draw2d.lineWidth = 2;
        draw2d.strokeStyle = C.ink;
        draw2d.stroke();
      }
      // The first raid of the slingshot (#50): while the enemy waits, a hand shows the pull on the
      // hero, again and again: a finger on the hero that goes back, with the band behind it.
      if (!a && r?.hold?.tool === 'sling') {
        demo = (demo + dt) % 2.6;
        const h0 = heroScreen();
        const u = backward();
        if (h0 && u) {
          const k = Math.min(1, demo / 1.6);
          const len = k * 6 * stepPx();
          const end = { x: h0.x + u.ux * len, y: h0.y + u.uy * len };
          draw2d.globalAlpha = demo < 2.2 ? 0.85 : 0.85 * (2.6 - demo) / 0.4;
          draw2d.strokeStyle = C.wood;
          draw2d.lineWidth = 5;
          draw2d.beginPath();
          draw2d.moveTo(h0.x, h0.y);
          draw2d.lineTo(end.x, end.y);
          draw2d.stroke();
          // The finger: a round pad with a ring.
          draw2d.beginPath();
          draw2d.arc(end.x, end.y, 13, 0, Math.PI * 2);
          draw2d.fillStyle = C.paper;
          draw2d.fill();
          draw2d.lineWidth = 3;
          draw2d.strokeStyle = C.ink;
          draw2d.stroke();
          draw2d.globalAlpha = 1;
        }
      }
      // An element on its way: a thick line in its color from the source to the finger.
      if (flow) {
        const e = getEntity(state(), `source:${flow.source}`) ?? getEntity(state(), flow.source);
        const f = e ? figures.placeOf(e.id) : null;
        if (f) {
          const s = view.project(f.x, f.y + 1, f.z);
          draw2d.strokeStyle = FLOW[flow.kind] ?? C.ink;
          draw2d.lineWidth = 8;
          draw2d.setLineDash(flow.kind === 'lightning' ? [14, 8] : []);
          draw2d.beginPath();
          draw2d.moveTo(s.x, s.y);
          draw2d.lineTo(flow.x, flow.y);
          draw2d.stroke();
          draw2d.setLineDash([]);
        }
      }
      // The dots over each enemy: one for each hit that it can still take.
      for (const e of r?.enemies ?? []) {
        if (e.state === 'retreat' || e.state === 'gone') continue;
        const f = figures.placeOf(e.id);
        if (!f) continue;
        const s = view.project(f.x, f.y + f.height + 0.5, f.z);
        const left = e.max - e.hits;
        for (let i = 0; i < e.max; i++) {
          const x = s.x + (i - (e.max - 1) / 2) * 13;
          draw2d.beginPath();
          draw2d.arc(x, s.y, 5, 0, Math.PI * 2);
          draw2d.fillStyle = i < left ? C.vermilion : C.paper;
          draw2d.fill();
          draw2d.lineWidth = 2;
          draw2d.strokeStyle = C.ink;
          draw2d.stroke();
        }
      }
      // A hit pops up: red dots that rise and fade.
      for (let i = pops.length - 1; i >= 0; i--) {
        const pop = pops[i];
        pop.age += dt;
        const f = figures.placeOf(pop.id);
        if (!f || pop.age > 1) {
          pops.splice(i, 1);
          continue;
        }
        const s = view.project(f.x, f.y + f.height + 1, f.z);
        draw2d.globalAlpha = 1 - pop.age;
        for (let k = 0; k < pop.n; k++) {
          draw2d.beginPath();
          draw2d.arc(s.x + (k - (pop.n - 1) / 2) * 20, s.y - 16 - pop.age * 40, 9 * (1 + pop.age * 0.4), 0, Math.PI * 2);
          draw2d.fillStyle = C.vermilion;
          draw2d.fill();
          draw2d.lineWidth = 3;
          draw2d.strokeStyle = C.diep;
          draw2d.stroke();
        }
        draw2d.globalAlpha = 1;
      }
    },
  };
}
