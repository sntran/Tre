// What the child hears of the world (#49). The systems of the world say a sound with each event
// (a duck that flees, a sleeper, a person who greets); this module says how loud the sound is at
// the hero, or that it does not play. Pure: no DOM and no Web Audio (src/ui/audio.js plays).
//   - A sound of the world has a place: it is softer with the distance and does not play past FAR.
//   - One sound of a kind at most each GAP seconds, and at most PER_MINUTE of a kind in a minute.
//   - At most MOST sounds of the world at once (in LENGTH seconds).
// The sounds of the acts of the child (the hero, the place of a task) are not limited: the child
// must hear each put and each snap.

import { getEntity } from './world/state.js';

export const HEAR = Object.freeze({
  near: 8, // half blocks: full loudness up to here
  far: 40, // half blocks (20 blocks): no sound past here
  gap: 2, // seconds between two sounds of a kind
  perMinute: 4, // sounds of a kind in a minute
  most: 3, // sounds of the world at once
  length: 1, // seconds that a sound counts as playing
});

// The loudness of a sound at a distance d (half blocks): 1 near, 0 at far and past it.
export function loudness(d, h = HEAR) {
  if (d <= h.near) return 1;
  if (d >= h.far) return 0;
  const k = 1 - (d - h.near) / (h.far - h.near);
  return k * k;
}

// Is the sound of an event an act of the child? The hero, and the places of the tasks and raids.
export const ownSound = (ev) => ev.id === 'hero' || String(ev.id).startsWith('zone:') || String(ev.id).startsWith('raid');

// The place of the sound of an event: its point (at), else the place of its thing. null: no place
// (the sky at dawn and dusk).
export function soundPlace(ev, world) {
  if (ev.at && Number.isFinite(ev.at.x)) return ev.at;
  return getEntity(world, ev.id)?.position ?? null;
}

// The ears of the hero: hear(ev, world, now) returns the loudness (0 to 1) of the sound of the
// event, 0 when it does not play. now: seconds.
export function createHearing(h = HEAR) {
  const times = new Map(); // name: the times of the sounds of that name in the last minute
  let playing = []; // the times of the sounds of the world that play now
  return {
    hear(ev, world, now) {
      const name = ev.sound;
      if (!name) return 0;
      if (ownSound(ev)) return 1;
      const at = soundPlace(ev, world);
      const hero = getEntity(world, 'hero')?.position;
      const v = at && hero ? loudness(Math.hypot(at.x - hero.x, at.z - hero.z), h) : 1;
      if (v <= 0) return 0;
      const list = (times.get(name) ?? []).filter((t) => now - t < 60);
      if (list.length && now - list[list.length - 1] < h.gap) return 0;
      if (list.length >= h.perMinute) return 0;
      playing = playing.filter((t) => now - t < h.length);
      if (playing.length >= h.most) return 0;
      list.push(now);
      times.set(name, list);
      playing.push(now);
      return v;
    },
  };
}
