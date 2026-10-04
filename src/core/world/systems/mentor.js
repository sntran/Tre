// The moves of the mentors in the world (src/core/mentor.js; docs/MENTOR.md). The session puts a
// script for a move: steps at times (seconds from the start of the script). The person points, says
// a short line, puts marks on the ground, lays the things of a demonstration on another instance,
// or puts some parts into the place for the child (a shared task). This system plays the scripts,
// turns a pointing person to what it points at, and takes the marks away after their time.
//   point { id, x, z, time }: the person turns and points (the gesture of the person).
//   say { id, key, params }: a line in a bubble over the person (the event call).
//   mark { x, z, ttl }: a mark on the ground (a red ring and a flag).
//   spawn { look, x, z, facing }: a thing of a demonstration (it goes at the end of the script).
//   put { zone, item, person }: the person puts a thing of the pile into the place.
//   back { item }: the thing that the person put goes back from the place to its own heap (the
//     end of a first step).
//   cue { zone }: Nghé shows the gap of the bridge (the hint of the place system).
//   nudge { x, z, time }: Nghé goes next to a place and stretches its neck toward it.
//   end: the things of the demonstration go, and the script ends.
export const WRITES = ['script', 'gesture', 'position', 'mentorMark', 'follow', 'item', 'zone', 'hidden', 'hands', 'carry', 'look', 'events'];

import { query, getEntity, addEntity, removeEntity } from '../state.js';
import { faceOf } from '../move.js';
import { handPut, backHome } from './work.js';
import { cueHint } from './place.js';

let made = 0;

export function mentor(world, dt, rng, env) {
  // A pointing person turns to what it points at, until the end of the gesture (a gesture with no
  // point, as a duck that pecks or a drummer who laughs, keeps the facing).
  for (const e of query(world, 'gesture', 'position')) {
    const g = e.gesture;
    g.t -= dt;
    if (g.t <= 0) {
      delete e.gesture;
      continue;
    }
    if (g.x !== undefined) e.position.facing = faceOf(g.x - e.position.x, g.z - e.position.z);
  }
  // The marks go after their time.
  for (const m of query(world, 'mentorMark')) {
    m.mentorMark.ttl -= dt;
    if (m.mentorMark.ttl <= 0) removeEntity(world, m.id);
  }
  if (world.paused) return;
  for (const s of query(world, 'script')) play(world, s, dt, env);
}

function play(world, ent, dt, env) {
  const sc = ent.script;
  sc.t += dt;
  while (sc.i < sc.steps.length && sc.steps[sc.i].at <= sc.t) {
    const st = sc.steps[sc.i];
    sc.i += 1;
    if (st.point) {
      const who = getEntity(world, st.point.id);
      if (who?.position) who.gesture = { act: 'point', x: st.point.x, z: st.point.z, t: st.point.time ?? 1.2 };
    }
    if (st.say) world.events.push({ type: 'call', id: st.say.id, key: st.say.key, params: st.say.params ?? {} });
    if (st.mark) {
      const y = env.groundY(st.mark.x / 2, st.mark.z / 2);
      addEntity(world, { id: `mark:mentor:${made++}`, mentorMark: { ttl: st.mark.ttl ?? 3 }, position: { x: st.mark.x, y, z: st.mark.z, facing: 0 }, look: 'mentor-mark' });
    }
    if (st.spawn) {
      const id = `demo:${sc.key}:${made++}`;
      const y = env.groundY(st.spawn.x / 2, st.spawn.z / 2);
      addEntity(world, { id, demo: { key: sc.key }, position: { x: st.spawn.x, y, z: st.spawn.z, facing: st.spawn.facing ?? 0 }, look: st.spawn.look });
      sc.spawned.push(id);
    }
    if (st.put) {
      const person = getEntity(world, st.put.person) ?? { id: st.put.person, position: null };
      const thing = getEntity(world, st.put.item);
      const zone = getEntity(world, st.put.zone);
      if (thing && zone && !thing.item?.held && handPut(world, person, thing, zone, env)) (sc.put ??= []).push(thing.id);
    }
    // Only a thing that the person put goes back (the child can take the same thing first).
    if (st.back && sc.put?.includes(st.back.item)) backHome(world, getEntity(world, st.back.item));
    if (st.cue) cueHint(world, getEntity(world, st.cue.zone), env);
    if (st.nudge) {
      const friend = query(world, 'follow')[0];
      if (friend && !friend.follow.goal) friend.follow.goal = { x: st.nudge.x - 2.5, z: st.nudge.z, face: faceOf(2.5, 0), act: 'stretch', nudge: true };
    }
    if (st.unnudge) for (const f of query(world, 'follow')) if (f.follow.goal?.nudge) delete f.follow.goal;
    if (st.end) {
      end(world, ent);
      return;
    }
  }
}

// The end of a script: the things of its demonstration go.
export function endScript(world, ent) {
  if (ent?.script) end(world, ent);
}

function end(world, ent) {
  for (const id of ent.script.spawned) removeEntity(world, id);
  for (const f of query(world, 'follow')) if (f.follow.goal?.nudge) delete f.follow.goal;
  removeEntity(world, ent.id);
}
