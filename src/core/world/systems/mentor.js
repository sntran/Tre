// The moves of the mentors in the world (src/core/mentor.js; docs/MENTOR.md). The session puts a
// script for a move: steps at times (seconds from the start of the script). The person points, says
// a short line, puts marks on the ground, lays the things of a demonstration on another instance,
// or puts some parts into the place for the child (a shared task). This system plays the scripts,
// turns a pointing person to what it points at, and takes the marks away after their time.
//   point { id, x, z, time }: the person turns and points (the gesture of the person).
//   say { id, key, params }: a line in a bubble over the person (the event call).
//   mark { x, z, ttl }: a mark on the ground (a red ring and a flag).
//   spawn { look, x, z, facing, dy }: a thing of a demonstration (it goes at the end of the script;
//     dy: half blocks over the ground, as a trap on the water; y: the height itself, as the glow of a
//     unit of a plank on the bridge).
//   look { k, look }: the k-th thing of the demonstration takes another look (a bundle that becomes
//     a row of seedlings, the feed in a trough, a trap full of fish).
//   hop { k }, gesture { k, act, t }: the k-th thing of the demonstration hops, or pecks.
//   shows { id, icon }: the button picture of an act over the person (the event shows).
//   sound { id, sound }: a sound of the demonstration (the event example; at the end of the
//     script of an example, the event example with done).
//   put { zone, item, person }: the person puts a thing of the pile into the place.
//   back { item }: the thing that the person put goes back from the place to its own heap (the
//     end of a first step).
//   cue { zone }: Nghé shows the gap of the bridge (the hint of the place system).
//   nudge { x, z, time }: Nghé goes next to a place and stretches its neck toward it.
//   end: the things of the demonstration go, and the script ends.
export const WRITES = ['script', 'gesture', 'position', 'mentorMark', 'follow', 'item', 'zone', 'hidden', 'hands', 'carry', 'look', 'hop', 'events'];

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
    // The star of a person pulses (the view shows it, also at the edge of the screen).
    if (st.star) world.events.push({ type: 'starPulse', id: st.star });
    if (st.mark) {
      const y = env.groundY(st.mark.x / 2, st.mark.z / 2);
      const id = `mark:mentor:${made++}`;
      addEntity(world, { id, mentorMark: { ttl: st.mark.ttl ?? 3 }, position: { x: st.mark.x, y, z: st.mark.z, facing: 0 }, look: 'mentor-mark' });
      (sc.marks ??= []).push(id);
    }
    if (st.spawn) {
      const id = `demo:${sc.key}:${made++}`;
      const y = env.groundY(st.spawn.x / 2, st.spawn.z / 2);
      addEntity(world, { id, demo: { key: sc.key }, position: { x: st.spawn.x, y: st.spawn.y ?? y + (st.spawn.dy ?? 0), z: st.spawn.z, facing: st.spawn.facing ?? 0 }, look: st.spawn.look });
      sc.spawned.push(id);
    }
    const spawned = (k) => getEntity(world, sc.spawned[k]);
    if (st.look && spawned(st.look.k)) spawned(st.look.k).look = st.look.look;
    if (st.hop && spawned(st.hop.k)) spawned(st.hop.k).hop = { t: 0 };
    if (st.gesture && spawned(st.gesture.k)) spawned(st.gesture.k).gesture = { act: st.gesture.act, t: st.gesture.t ?? 1 };
    if (st.shows) world.events.push({ type: 'shows', id: st.shows.id, icon: st.shows.icon });
    if (st.sound) world.events.push({ type: 'example', id: st.sound.id, sound: st.sound.sound });
    if (st.put) {
      const person = getEntity(world, st.put.person) ?? { id: st.put.person, position: null };
      const thing = getEntity(world, st.put.item);
      const zone = getEntity(world, st.put.zone);
      // A thing that the child already put on a place stays where it is: the step never takes it
      // and never takes it back later (#61: one press put the bunch of the example in the basket).
      const lies = thing?.item?.zone ? getEntity(world, `zone:${thing.item.zone}`)?.zone : null;
      const free = !lies || lies.rule === 'heap' || lies.rule === 'pile';
      if (thing && zone && free && !thing.item?.held && handPut(world, person, thing, zone, env)) (sc.put ??= []).push(thing.id);
    }
    // Only a thing that the person put goes back (the child can take the same thing first).
    if (st.back && sc.put?.includes(st.back.item)) {
      backHome(world, getEntity(world, st.back.item));
      sc.put = sc.put.filter((id) => id !== st.back.item);
    }
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

// The end of a script: the things of its demonstration go. early: the script stops before its
// end (the greeting of a place when the child starts a station, #38): its marks go too.
export function endScript(world, ent, { early = false } = {}) {
  if (!ent?.script) return;
  if (early) for (const id of ent.script.marks ?? []) removeEntity(world, id);
  end(world, ent);
}

function end(world, ent) {
  for (const id of ent.script.spawned) removeEntity(world, id);
  // A script that ends before a step back (a new move of the task, a wave): the things that a step
  // put and that a later step takes back go back to their heap now, so that no thing of the
  // example stays on the place (#61). The things that smaller and share put stay.
  const sc = ent.script;
  const later = new Set(sc.steps.slice(sc.i).filter((s) => s.back).map((s) => s.back.item));
  for (const id of sc.put ?? []) {
    const thing = getEntity(world, id);
    if (later.has(id) && thing) backHome(world, thing);
  }
  // The example of a station ends (src/core/examples.js): the round of the child comes next.
  if (ent.script.move === 'example') world.events.push({ type: 'example', key: ent.script.key, done: true });
  for (const f of query(world, 'follow')) if (f.follow.goal?.nudge) delete f.follow.goal;
  removeEntity(world, ent.id);
}
