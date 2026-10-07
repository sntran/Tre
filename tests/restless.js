// A restless child (#44): plays an activity with seeded random taps on cells near the hero, presses
// with no walk first, quick taps and holds of the big button, jumps, short walks with the stick,
// reads, and waves. The stories walk to the exact place and then press; a child does not.
// play(session, { steps, seed }) runs it and returns the broken laws (a list of messages):
// - no step throws an error;
// - a thing of a task never goes to the ground when a place for it was in reach at the press;
// - a person never says the same line more than three times in a row with no try of the child
//   (a commit) between (#45);
// - a tap on a cell that the hero can walk to moves the hero;
// - when a task starts, its person, heap, and places fit on a phone held upright with the camera of
//   the game (the focus led toward the work, src/world/view.js);
// - the hero never stands on the cell of the person at the start of a talk.
import { createRng } from '../src/core/rng.js';
import { getEntity } from '../src/core/world/state.js';
import { findPath } from '../src/core/tilemap.js';
import { leadFocus } from '../src/world/view.js';

const STEP = 1 / 30;
const ANGLES = [0, 1, 2, 3].map((k) => Math.PI / 4 + (k * Math.PI) / 2);

export function playRestless(session, { steps = 240, seed = 1, repeats = 3 } = {}) {
  const random = createRng(`restless:${seed}`);
  const rng = () => random.next();
  const broken = new Set();
  const hero = () => getEntity(session.state, 'hero');
  const cellOf = () => ({ x: hero().position.x / 2, y: hero().position.z / 2 });
  // The lines of each person in a row.
  const lines = new Map();
  let lastDrop = null;
  const off = session.listen((ev) => {
    if (ev.type === 'drop') lastDrop = ev;
    // A try of the child (a commit): a person may say a line of help again after it (#45).
    if (ev.type === 'skill') lines.clear();
    // A line of a person that the child sees: a callout (a call of a mentor opens one) or a line
    // that waits for a tap.
    const key = ev.type === 'open' && (ev.screen === 'callout' || ev.screen === 'say') ? ev.textKey : null;
    const who = ev.id ?? ev.who ?? null;
    if (key && who) {
      const run = lines.get(who);
      const n = run?.key === key ? run.n + 1 : 1;
      lines.set(who, { key, n });
      if (n > repeats) broken.add(`${who} says ${key} more than ${repeats} times in a row`);
    }
    if (ev.type === 'workView' && ev.points?.length) {
      const h = hero().position;
      const pts = [{ x: h.x / 2, y: h.y / 2, z: h.z / 2 }, ...ev.points.map((p) => ({ x: p.x / 2, y: p.y / 2, z: p.z / 2 }))];
      if (!ANGLES.some((az) => leadFocus(pts, { az, width: 390, height: 844 }).fits)) broken.add(`the work of ${ev.key} does not fit on a phone held upright`);
    }
    if (ev.type === 'open' && ev.screen === 'dialogue' && typeof ev.id === 'string') {
      const p = getEntity(session.state, ev.id)?.position;
      const h = hero().position;
      if (p && Math.hypot(p.x - h.x, p.z - h.z) < 0.6) broken.add(`the hero stands on ${ev.id} at the start of a talk`);
    }
  });
  const tick = () => {
    try {
      session.step();
      session.events();
    } catch (err) {
      broken.add(`a step threw an error: ${err.message}`);
    }
  };
  const send = (cmd) => {
    try {
      session.command(cmd);
      session.events();
    } catch (err) {
      broken.add(`the command ${cmd.type} threw an error: ${err.message}`);
    }
  };
  for (let k = 0; k < steps; k++) {
    const screen = session.screen;
    if (screen === 'dialogue' || screen === 'say') {
      // A child reads, or chooses the first answer.
      send({ type: rng() < 0.9 ? 'next' : 'choose', n: 0 });
    } else if (screen) {
      send({ type: 'close' });
    } else {
      const r = rng();
      if (r < 0.35) {
        // A tap on a cell near the hero.
        const c = cellOf();
        const x = c.x + (rng() - 0.5) * 12;
        const y = c.y + (rng() - 0.5) * 12;
        const target = session.targetAt(x, y);
        // A tap on a place of a task chooses the place: the hero only turns when it is in reach.
        const busy = hero().jump || hero().fall || hero().motion?.wade || hero().motion?.shallow;
        const free = !busy && target?.ground && !session.placeAt(x, y) && session.tileMap.walkable(Math.floor(x), Math.floor(y)) && Math.hypot(x - c.x, y - c.y) > 2;
        const before = { ...c };
        const reach = free && findPath(session.tileMap, { x: Math.floor(c.x), y: Math.floor(c.y) }, { x: Math.floor(x), y: Math.floor(y) }, { maxNodes: 4000 });
        const seen = [];
        const offSeen = process.env.RESTLESS_DEBUG ? session.listen((ev) => seen.push(ev.type + (ev.id ? `:${ev.id}` : ''))) : () => {};
        send({ type: 'tap', target });
        const route = JSON.stringify(hero().route?.points?.slice(0, 2) ?? null);
        for (let i = 0; i < 45; i++) tick();
        offSeen();
        const after = cellOf();
        if (reach && reach.length > 2 && !hero().riding && !session.screen && Math.hypot(after.x - before.x, after.y - before.y) < 0.2) broken.add(process.env.RESTLESS_DEBUG ? `a tap on a cell that the hero can walk to does not move the hero: ${JSON.stringify({ before, x, y, carry: session.carried(), route, seen: seen.slice(0, 12), fall: hero().fall ?? null, intent: hero().intent ?? null, solids: session.state.entities.filter((e) => e.solid && e.position && Math.hypot(e.position.x - hero().position.x, e.position.z - hero().position.z) < 6).map((e) => `${e.id} ${JSON.stringify(e.solid)} ${e.position.x.toFixed(1)},${e.position.z.toFixed(1)}`), hp: [hero().position.x.toFixed(2), hero().position.z.toFixed(2)] })}` : 'a tap on a cell that the hero can walk to does not move the hero');
      } else if (r < 0.6) {
        // A press of the big button with no walk first.
        const targets = session.targets();
        const place = session.carried() && targets.some((t) => t.act === 'put' && t.rank < 10);
        lastDrop = null;
        send({ type: 'hands' });
        tick();
        if (place && lastDrop) broken.add('a press put a thing on the ground with its place in reach');
      } else if (r < 0.72) {
        // A quick tap or a hold of the big button.
        send({ type: 'hold', on: true });
        const n = rng() < 0.5 ? 0 : Math.floor(rng() * 45);
        if (rng() < 0.3) send({ type: 'hold', on: false });
        for (let i = 0; i < n; i++) tick();
        send({ type: 'hold', on: false });
      } else if (r < 0.8) {
        send({ type: 'jump' });
      } else if (r < 0.9) {
        // A short walk with the stick.
        const a = rng() * Math.PI * 2;
        send({ type: 'move', dx: Math.cos(a), dz: Math.sin(a), strength: 1 });
        for (let i = 0; i < 10; i++) tick();
        send({ type: 'move', dx: 0, dz: 0, strength: 0 });
      } else if (r < 0.95) {
        send({ type: 'wave' });
      }
    }
    tick();
  }
  off();
  return [...broken];
}

export { STEP };

// A child who only presses the big button (#54): from the end of the talk of a mentor, a press, a
// short wait, and a press again; a talk reads on. With hold, a press is a hold of the button for
// that many seconds (the slash at a culm). until(session): stop when it is true. Return the broken
// laws:
// - a press never asks for help (a talk to the mentor needs a tap on the mentor);
// - a press never takes back the thing that the last press put;
// - a press never puts a thing of a task on the ground;
// - a press never looks at a thing of the map or talks in the task (a tap chooses them).
export function playPresses(session, { presses = 40, wait = 2.5, hold = 1, until = () => false } = {}) {
  const broken = new Set();
  let lastPut = null;
  let asked = 0;
  const off = session.listen((ev) => {
    if (ev.type === 'mentor' && ev.asked) asked += 1;
    if (ev.type === 'put' && ev.id === 'hero') lastPut = ev.item;
    if (ev.type === 'pick' && ev.id === 'hero' && ev.item === lastPut) broken.add(`a press took back ${ev.item}, which the last press put`);
    if (ev.type === 'drop' && ev.id === 'hero' && String(getEntity(session.state, ev.item)?.item?.task ?? '').startsWith('trial-')) broken.add(`a press put ${ev.item} on the ground`);
  });
  const run = (seconds) => {
    for (let i = 0; i < seconds / STEP; i++) {
      session.step();
      session.events();
    }
  };
  for (let k = 0; k < presses && !until(session); k++) {
    for (let n = 0; session.screen && n < 40; n++) {
      session.command(session.screen === 'dialogue' || session.screen === 'say' ? { type: 'next' } : { type: 'close' });
      session.events();
      run(0.3);
    }
    const a = session.action();
    if (a && (a.act === 'look' || a.act === 'talk') && !a.work) broken.add(`a press in the task did ${a.act} at ${a.target}`);
    if (a?.hold) {
      session.command({ type: 'hold', on: true });
      run(hold);
      session.command({ type: 'hold', on: false });
    } else session.command({ type: 'hands' });
    session.events();
    run(wait);
  }
  off();
  if (asked) broken.add(`a press asked for help ${asked} times`);
  return [...broken];
}

// A child of six in a raid with the big button only (#55). The child taps the enemy of the
// encounter and presses. In the raid the child looks at the nearest enemy that walks to the gate,
// counts the red bands of the post nearest to it, and presses that many times (a press each
// 0.3 seconds); the stone flies one second after the last press. A restless child miscounts by one
// post at times (miscount), and waits a moment (0.5 to 2 seconds) after each stone lands. Return
// { won (true, false, or null when the raid did not end), shots, hits }.
export function playRaid(session, encounter, { seed = 1, miscount = 0.25, seconds = 300 } = {}) {
  const random = createRng(`raid:${seed}`);
  const rng = () => random.next();
  let won = null;
  let shots = 0;
  let hits = 0;
  let flying = 0;
  const off = session.listen((ev) => {
    if (ev.type === 'end' && typeof ev.won === 'boolean') won = ev.won;
    if (ev.type === 'shoot') {
      shots += 1;
      flying += 1;
    }
    if (ev.type === 'land') flying = Math.max(0, flying - 1);
    if (ev.type === 'hit') hits += 1;
  });
  const run = (s) => {
    for (let i = 0; i < s / STEP; i++) {
      session.step();
      session.events();
    }
  };
  const read = () => {
    for (let n = 0; session.screen && n < 40; n++) {
      session.command(session.screen === 'dialogue' || session.screen === 'say' ? { type: 'next' } : { type: 'close' });
      session.events();
      run(0.3);
    }
  };
  session.command({ type: 'tap', target: { person: encounter } });
  session.events();
  session.command({ type: 'hands' });
  session.events();
  let t = 0;
  let rest = 0;
  for (; t < 20 && !getEntity(session.state, 'raid'); t += 0.3) {
    read();
    run(0.3);
  }
  while (t < seconds && won === null) {
    read();
    const raid = getEntity(session.state, 'raid')?.raid;
    if (!raid) break;
    if (rest > 0 || flying || raid.reload > 0) {
      rest -= STEP;
      run(STEP);
      t += STEP;
      continue;
    }
    const foes = raid.enemies.filter((e) => e.state !== 'retreat' && e.state !== 'gone' && e.hits < e.max);
    const near = foes.map((e) => ({ e, d: (e.x - raid.wall.x) * raid.dir.x + (e.z - raid.wall.z) * raid.dir.z })).filter((f) => f.d > 2).sort((a, b) => a.d - b.d)[0];
    if (!near) {
      run(0.2);
      t += 0.2;
      continue;
    }
    // The bands of the post nearest to the enemy, sometimes one more or one less.
    let posts = Math.max(1, Math.round(near.d / 5));
    if (rng() < miscount) posts = Math.max(1, posts + (rng() < 0.5 ? -1 : 1));
    for (let k = 0; k < posts; k++) {
      session.command({ type: 'hands' });
      session.events();
      run(0.3);
      t += 0.3;
    }
    // The stone flies one second after the last press.
    run(1.1);
    t += 1.1;
    rest = 0.5 + rng() * 1.5;
  }
  run(3);
  read();
  off();
  return { won, shots, hits };
}
