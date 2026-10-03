// Input: the commands of the last frames go into the components of the entities.
// Commands: move (a map direction from the stick or the keys), walk (a route of points), stop,
// place (put an entity at a point), face (turn to a point), pause (a dialogue opens or closes),
// stay (a person of the quest stays out at night), pet (a friend is happy), ride (the hero gets on
// the back of a friend, or gets off), knock (a tap on a house at night: if the family is in, the
// lantern flickers and a soft sound comes from inside), aim (the child chose a thing; the hero
// walks to it), pick (take a thing), put (put the thing in the hands into a zone), drop (put it on
// the ground), guess (the prediction before a commit), work (the work of a trial: add, back, tie,
// quench, give, mark, cut), raid (an order of the child in a raid: shoot, bar, call, charge, pour,
// bamboo), poke (a tap on a sleeping animal: it flicks an ear), jump (a jump of the hero that the
// session planned: src/core/world/jump.js). The place system does what the hands want; the work system does the work; the raid
// system does the orders.
export const WRITES = ['commands', 'paused', 'intent', 'route', 'position', 'motion', 'follow', 'schedule', 'riding', 'lantern', 'hands', 'work', 'orders', 'flick', 'jump', 'events'];

export const INSIDE_SOUNDS = Object.freeze(['cough', 'baby', 'clatter']);
const CROUCH = 0.1; // seconds: the short crouch before a jump

import { getEntity, query } from '../state.js';
import { faceOf } from '../move.js';

export function input(world, dt, rng, env) {
  for (const c of world.commands) {
    if (c.type === 'pause') {
      world.paused = Boolean(c.on);
      continue;
    }
    if (c.type === 'knock') {
      const lamp = getEntity(world, `lantern:${c.home}`);
      if (lamp?.look === 'lantern-lit') {
        lamp.lantern.flicker = 1.2;
        world.events.push({ type: 'inside', id: lamp.id, home: c.home, sound: rng.pick(INSIDE_SOUNDS) });
      }
      continue;
    }
    const e = getEntity(world, c.id);
    if (!e) continue;
    if (c.type === 'move') {
      e.intent = { dx: c.dx ?? 0, dz: c.dz ?? 0, strength: c.strength ?? 1, run: Boolean(c.run) };
      delete e.route;
    } else if (c.type === 'walk') {
      e.route = { points: c.points.map((p) => ({ x: p.x, z: p.z })), near: c.near ?? null, token: c.token ?? null, still: 0, last: null };
      delete e.intent;
    } else if (c.type === 'stop') {
      delete e.intent;
      delete e.route;
    } else if (c.type === 'place' && e.position) {
      e.position.x = c.x;
      e.position.z = c.z;
      e.position.y = env.groundY(c.x / 2, c.z / 2);
      if (e.motion) Object.assign(e.motion, { vx: 0, vz: 0, speed: 0 });
      delete e.intent;
      delete e.route;
      // The followers of the entity start again behind it.
      for (const f of query(world, 'follow', 'position')) {
        if (f.follow.target !== e.id) continue;
        f.follow.trail = [];
        f.position.x = c.x - 3.2 * Math.sin(e.position.facing ?? 0);
        f.position.z = c.z - 3.2 * Math.cos(e.position.facing ?? 0);
        if (env.near(f.position.x / 2, f.position.z / 2).isBlocked(Math.floor(f.position.x / 2), Math.floor(f.position.z / 2))) {
          f.position.x = c.x;
          f.position.z = c.z;
        }
        f.position.y = env.groundY(f.position.x / 2, f.position.z / 2);
      }
      world.events.push({ type: 'placed', id: e.id });
    } else if (c.type === 'pet' && e.follow) {
      e.follow.happy = 2.5;
      world.events.push({ type: 'petted', id: e.id, sound: 'moo' });
    } else if (c.type === 'ride') {
      const mount = getEntity(world, c.mount);
      if (e.riding || !mount) {
        delete e.riding;
        world.events.push({ type: 'dismount', id: e.id });
      } else {
        e.riding = mount.id;
        Object.assign(e.position, { x: mount.position.x, z: mount.position.z });
        world.events.push({ type: 'mount', id: e.id, sound: 'moo' });
      }
    } else if (['aim', 'pick', 'put', 'drop', 'guess'].includes(c.type)) {
      e.hands = { ...(e.hands ?? { holds: null }), want: { do: c.type, item: c.item ?? null, zone: c.zone ?? null, n: c.n ?? null, at: c.at ?? null } };
    } else if (c.type === 'raid' && e.raid) {
      const { type, id, ...o } = c;
      e.orders = [...(e.orders ?? []), o];
    } else if (c.type === 'work') {
      e.work = { trial: c.trial, act: c.act, item: c.item ?? null, at: c.at ?? null, culm: c.culm ?? null };
    } else if (c.type === 'poke' && e.act === 'sleep') {
      e.flick = 0.8;
      world.events.push({ type: 'flick', id: e.id, sound: 'huff' });
    } else if (c.type === 'stay' && e.schedule) {
      e.schedule.stay = Boolean(c.on);
    } else if (c.type === 'jump' && e.position && !e.jump && !e.fall && !e.riding) {
      // The jump starts with a short crouch; the move system plays its arc.
      delete e.intent;
      delete e.route;
      e.jump = { t: 0, crouch: CROUCH, from: { x: e.position.x, z: e.position.z, y: e.position.y }, to: { x: c.to.x, z: c.to.z }, top: c.top, time: c.time, splash: Boolean(c.splash), fall: c.fall ?? null };
      world.events.push({ type: 'jump', id: e.id, kind: c.kind ?? 'jump' });

    } else if (c.type === 'face' && e.position) {
      const dx = c.x - e.position.x;
      const dz = c.z - e.position.z;
      if (Math.hypot(dx, dz) > 0.05) e.position.facing = faceOf(dx, dz);
    }
  }
  world.commands = [];
}
