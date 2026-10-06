// A log of the sounds of ten minutes of play (#49): the real session with no screen walks the hero
// through Phù Đổng (the grandma, the forge, the healer, the river of the fisher, the hut of the
// teacher) and stands at each place, as a child plays. Each sound of the world goes through the
// ears of the hero (src/core/hearing.js), as in the village view. The log counts each sound by
// name: the sounds that the world says, the sounds that the child hears, and the most that the
// child hears in one minute.
//   node tools/sound-log.mjs [minutes]
// tests/hearing.test.js runs it for the rule: no sound plays more than a few times a minute.

import { runHeadless } from '../tests/story-run.js';
import { createHearing, HEAR, ownSound } from '../src/core/hearing.js';
import { STEP } from '../src/core/world/step.js';

const PROFILE = { name: 'An', grade: 1, lang: 'vi', seed: 7, flags: { 'intro.seen': true, 'prologue.started': true } };
// The places of the walk (map cells of Phù Đổng) and the seconds at each place.
export const ROUTE = [
  [[10.5, 31], 40],
  [[53, 45], 60],
  [[33, 44], 60],
  [[27, 64.5], 90],
  [[54, 27], 60],
];

// Play `minutes` of the walk. Return { said, heard, most, own } by sound name: said: the sounds of
// the world; heard: the sounds that play; most: the most that play in one minute; own: the names
// of the sounds of the acts of the child (the steps of the hero), which have no limit.
export async function soundLog(minutes = 10) {
  const said = {};
  const heard = {};
  const perMinute = {};
  const own = new Set();
  let session = null;
  const ears = createHearing();
  const steps = [];
  for (const [at, wait] of ROUTE) steps.push({ walk: { to: ['phu-dong', ...at] } }, { wait });
  steps.push({ wait: minutes * 60 });
  const end = minutes * 60;
  await runHeadless({ name: 'sound-log', profile: PROFILE, clock: 540, at: ['phu-dong', 10.5, 33], steps }, {
    onSession: (s) => {
      session = s;
      s.listen((ev) => {
        // The village view plays the sounds of the world events (not the sky, not the screens).
        if (!ev.sound || ev.id === 'sky' || ev.type === 'sound') return;
        const t = s.state.tick * STEP;
        if (t > end) return;
        said[ev.sound] = (said[ev.sound] ?? 0) + 1;
        if (ownSound(ev)) own.add(ev.sound);
        if (ears.hear(ev, s.state, t) <= 0) return;
        heard[ev.sound] = (heard[ev.sound] ?? 0) + 1;
        const key = `${ev.sound}:${Math.floor(t / 60)}`;
        perMinute[key] = (perMinute[key] ?? 0) + 1;
      });
    },
  });
  const most = {};
  for (const [key, n] of Object.entries(perMinute)) {
    const name = key.slice(0, key.lastIndexOf(':'));
    most[name] = Math.max(most[name] ?? 0, n);
  }
  return { said, heard, most, own, seconds: Math.min(end, session ? session.state.tick * STEP : 0) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const minutes = Number(process.argv[2] ?? 10);
  const { said, heard, most, own, seconds } = await soundLog(minutes);
  const names = Object.keys(said).sort((a, b) => said[b] - said[a]);
  console.log(`${Math.round(seconds / 60)} minutes of play; at most ${HEAR.perMinute} of a sound a minute, none past ${HEAR.far / 2} blocks`);
  console.log('| sound | said by the world | heard | most in a minute |');
  console.log('|---|---:|---:|---:|');
  for (const n of names) console.log(`| ${n}${own.has(n) ? ' (the child)' : ''} | ${said[n]} | ${heard[n] ?? 0} | ${most[n] ?? 0} |`);
}
