// The robot child (#174): it plays a scene of tests/stories/ headless, on the session of the
// village (as tests/story-run.js does), like a child of six, and checks the laws of progress at
// each command. It does not see the screen: the children still judge the looks, the words, and the
// fun; the robot finds the dead ends before them (Holmgård, Green, Liapis, and Togelius 2019).
//
// A command of the robot is one act of a child: it reads a talk (a random choice), waits while the
// game is busy, presses the big button when it has an act (a hold for a hold act), taps a thing of
// the work near the hero, taps the star (the star of an open work first, else the nearest), and
// taps a person now and then. The kinds of child:
//   star     the acts above;
//   presser  presses fast and often;
//   counter  at the trap and the slingshot: one press for each post of the ask or of the enemy,
//            and then it waits;
//   dealer   at the share: one sack to each mat in turn, the rest on the pile.
// The world runs one second (ROBOT_STEP) after each command.
import { runHeadless, data } from '../../tests/story-run.js';
import { load } from '../../tests/helpers.js';
import { STEP } from '../../src/core/story.js';
import { getEntity, query } from '../../src/core/world/state.js';
import { createI18n } from '../../src/core/i18n.js';
import { storyStars } from '../../src/core/stars.js';
import { along, postAt } from '../../src/core/world/raids.js';
import { createRng } from '../../src/core/rng.js';
import { readdirSync, readFileSync } from 'node:fs';

export const KINDS = ['star', 'presser', 'counter', 'dealer'];
export const NIGHT = 1260; // minutes: 21:00
const ROBOT_STEP = 1; // seconds of the world after each command
const vi = createI18n(load('i18n/vi.json'), 'vi');
// A text with a key in it: a word with dots and no space (npc.giong-sky.name, Frac.11.12).
const KEY_IN_TEXT = /(^|[\s"(“])[A-Za-z][\w-]*\.[A-Za-z0-9][\w-]*(\.[\w-]+)*(?=$|[\s,.!?:;")”])/;
const COUNT_WORD = /^num\.|^ord\./;
// The events that do not show a change to a child.
const QUIET_EVENTS = new Set(['sound', 'hud', 'tapfx', 'goalShow', 'view', 'workView', 'names']);

// The text of a line, with its parameters (as the view says it).
function textOf(key, params = {}) {
  const p = {};
  for (const [k, v] of Object.entries(params ?? {})) p[k] = v && typeof v === 'object' && v.key ? textOf(v.key, v.params) : v;
  return vi.has(key) ? vi.t(key, p) : key;
}

// The laws of progress (the list of #174). Each finding: { law, scene, kind, night, command, clock,
// goal, act, lines (the last four), detail }.
export const LAWS = {
  deadPress: 'a press that changes nothing, three times in a row',
  sameLine: 'the same line five times in twelve lines',
  silentTalk: 'a talk with a person in reach that says no line',
  keyInText: 'a text with a key in it',
  noMorning: '60 commands at night with no morning, out of a work and a raid',
  longWork: 'a work open for 120 commands',
  noProgress: '80 commands with no change of progress while a work is open',
  trapPost: 'the trap of a count is not at the post of its count',
  flicker: 'the button changes by itself while the hero stands still',
};

// Play one scene. story: a story of tests/stories/ (its profile, clock, and place); opts: { kind,
// night, commands, grade, seed, laws (the laws to check; all when not given) }. Return { findings,
// stats }.
export async function playScene(story, { kind = 'star', night = false, commands = 120, grade = null, seed = 1, scene = story.name ?? 'scene', profile = null } = {}) {
  const raw = { ...story, steps: [], ...(night ? { clock: NIGHT } : {}), ...(story.profile ? { profile: { ...story.profile, ...(grade !== null ? { grade } : {}) } } : {}) };
  let session = null;
  const lines = []; // { key, text, tick, tapped }
  const events = [];
  let lastOpen = null;
  let morning = false;
  let noted = 0; // the events of the world that a child sees or hears (not a sound only)
  let glowed = []; // the things that glow now
  await runHeadless(raw, { profile, onSession: (x) => {
    session = x;
    x.listen((e) => {
      events.push(e);
      if (!QUIET_EVENTS.has(e.type)) noted += 1;
      // The things that a line makes glow: a child follows the glow.
      if (e.type === 'glowThings' || e.type === 'cue' || e.type === 'glowSeq') glowed = [...(e.ids ?? [])];
      if (e.type === 'open') lastOpen = e;
      // The lines that the child hears: the bubbles, the talks, and the lines of the screen (a
      // call of the world comes as a bubble too).
      const key = e.type === 'open' ? e.textKey : null;
      if (key) lines.push({ key, text: textOf(key, e.params), tick: x.state.tick, tapped: tappedAt, command });
      if (e.type === 'dawn' || (e.type === 'open' && e.textKey === 'rest.morning')) morning = true;
    });
  } });
  const rng = createRng(`robot:${scene}:${kind}:${night}:${seed}`);
  const random = () => rng.next();
  const findings = [];
  const seen = new Set();
  const st = () => session.state;
  const hero = () => getEntity(st(), 'hero');
  let command = 0;
  let tappedAt = -1; // the command of the last tap of the robot on a thing
  const run = (sec) => {
    for (let i = 0; i < sec / STEP; i++) {
      session.step();
      session.events();
    }
  };
  const goalKey = () => session.workGoal?.() ?? null;
  const find = (law, detail = '') => {
    const id = `${law}|${detail}`;
    if (seen.has(id)) return;
    seen.add(id);
    findings.push({ law, scene, kind, night, command, clock: st().clock.minutes, goal: goalKey(), act: session.action()?.act ?? null, lines: lines.slice(-4).map((l) => l.text), detail });
  };
  // The signature of the state that a press can change.
  const sign = () => {
    const h = hero();
    const things = query(st(), 'item').map((e) => `${e.id}:${e.item.zone}:${e.item.held}:${e.item.slot ?? ''}`).join('|');
    const raid = getEntity(st(), 'raid')?.raid;
    return JSON.stringify([Object.keys(session.profile.flags).length, things, h?.hands?.holds ?? null, h?.riding ?? null, Math.round(h?.position.x ?? 0), Math.round(h?.position.z ?? 0), session.screen, raid ? [raid.stones.length, raid.pull, raid.result] : null, lines.length, query(st(), 'zone').map((z) => `${z.id}:${z.zone.items?.length ?? ''}:${z.zone.commits ?? ''}`).join('|')]);
  };
  const progress = () => {
    const p = session.profile;
    const zones = query(st(), 'zone').filter((z) => z.zone.rule === 'trial').map((z) => `${z.zone.commits}:${z.zone.done}`).join('|');
    const things = query(st(), 'item').map((e) => `${e.item.zone}:${e.item.slot ?? ''}`).sort().join('|');
    return JSON.stringify([Object.keys(p.flags).length, JSON.stringify(p.inventory), zones, things, (p.stats?.battlesWon ?? 0), (p.stats?.battlesLost ?? 0)]);
  };
  const stars = () => storyStars({
    data, profile: session.profile, state: st(), session, mapData: session.map,
    groundY: () => 0, top: (id) => (getEntity(st(), id) ? 3 : null),
  });
  const nearThings = () => {
    const h = hero().position;
    const open = query(st(), 'zone').filter((z) => z.zone.rule === 'trial' && !z.zone.done).map((z) => z.id.replace(/^zone:/, ''));
    return query(st(), 'item', 'position').filter((e) => !e.item.held && !e.hidden && open.includes(e.item.task) && Math.hypot(e.position.x - h.x, e.position.z - h.z) <= 24);
  };
  // A press of the act of the button. A press that the button refused (a picture that changed a
  // moment ago takes no press, SETTLE in src/core/session.js) is no press of an act.
  const press = () => {
    const a = session.action();
    if (!a) return false;
    const from = events.length;
    if (a.hold) {
      session.command({ type: 'hold', on: true, id: a.id });
      run(0.3 + random() * 2.6);
      session.command({ type: 'hold', on: false });
    } else session.command({ type: 'hands', id: a.id });
    const answer = events.slice(from).find((e) => e.type === 'press');
    if (answer && !answer.done && !answer.wait) return false;
    return a;
  };
  const tapStar = () => {
    let list = [];
    try {
      list = stars();
    } catch {
      list = [];
    }
    if (!list.length) return false;
    const h = hero().position;
    const work = list.find((m) => m.work);
    const m = work ?? list.reduce((a, b) => (Math.hypot(b.x * 2 - h.x, b.y * 2 - h.z) < Math.hypot(a.x * 2 - h.x, a.y * 2 - h.z) ? b : a));
    tappedAt = command;
    session.command({ type: 'tap', target: { ground: { x: m.x, y: m.y, h: m.h ?? 3, thing: false, object: null, goal: true } } });
    return true;
  };
  const tapPerson = () => {
    const h = hero().position;
    const near = session.persons().filter((p) => Math.hypot(p.x * 2 - h.x, p.y * 2 - h.z) <= 20 && !getEntity(st(), p.entity)?.hidden);
    if (!near.length) return false;
    tappedAt = command;
    session.command({ type: 'tap', target: { person: near[Math.floor(random() * near.length)].entity } });
    return true;
  };
  // A tap on a thing that glows (a thing of the world, or a mark on the ground).
  // A ring of a hint (an entity "why:…:next") glows too: a child walks to the ring that a line names.
  const rings = () => st().entities.filter((x) => /^why:.*:next$/.test(x.id)).map((x) => x.id);
  const tapGlow = () => {
    const e = [...glowed, ...rings()].map((id) => getEntity(st(), id)).find((x) => x?.position && !x.hidden);
    glowed = [];
    if (!e) return false;
    tappedAt = command;
    if (e.item && !e.item.held) session.command({ type: 'tap', target: { thing: e.id } });
    else if (e.person) session.command({ type: 'tap', target: { person: e.id } });
    else session.command({ type: 'tap', target: { ground: { x: e.position.x / 2, y: e.position.z / 2, h: (e.position.y ?? 0) / 2, thing: false, object: null } } });
    return true;
  };
  // The counter: one press for each post of the ask (with a trap in the hands) or of the enemy.
  let counted = null; // { posts, from (the command) } of the last count of the trap
  const count = () => {
    const raid = getEntity(st(), 'raid')?.raid;
    if (!raid || raid.result) return false;
    const held = getEntity(st(), session.holding?.() ?? hero()?.hands?.holds ?? '');
    let n = 0;
    if (held?.item?.kind === 'trap' && raid.trapPost !== null && !raid.trapDone) n = raid.posts.findIndex((q) => q.d === raid.trapPost) + 1;
    else if (session.action()?.act === 'sling') {
      const at = raid.enemies.filter((e) => (e.state === 'walk' || e.state === 'wait') && postAt(raid, along(raid, e))).map((e) => raid.posts.indexOf(postAt(raid, along(raid, e))) + 1).sort((a, b) => a - b)[0];
      n = at ?? 0;
    }
    if (n <= 0) return false;
    if (held?.item?.kind === 'trap') counted = { posts: n, from: command };
    for (let i = 0; i < n; i++) {
      const a = session.action();
      if (!a) break;
      session.command({ type: 'hands', id: a.id });
      run(0.5);
    }
    run(4);
    return true;
  };
  // The dealer: one sack to each mat in turn.
  let turn = 0;
  const deal = () => {
    const share = getEntity(st(), 'zone:trial-share');
    if (!share || share.zone.done) return false;
    const who = share.zone.who ?? ['hero', 'nghe', 'giong'];
    const held = hero()?.hands?.holds;
    if (!held) {
      const loot = getEntity(st(), 'zone:loot')?.zone;
      if (!loot || loot.items.length < who.length) return false;
      session.command({ type: 'tap', target: { thing: loot.items[0] } });
      run(4);
      const a = session.action();
      if (a) session.command({ type: 'hands', id: a.id });
      return true;
    }
    session.command({ type: 'tap', target: { thing: `mat:share-${who[turn % who.length]}` } });
    run(4);
    const a = session.action();
    if (a) session.command({ type: 'hands', id: a.id });
    turn += 1;
    return true;
  };

  // Where the stars lead (for a check of a save, tools/robot/scene.mjs).
  const where = () => {
    let list = [];
    try {
      list = stars();
    } catch {
      list = [];
    }
    const h = hero().position;
    return { map: session.map?.id ?? null, hero: [Math.round(h.x / 2), Math.round(h.z / 2)], goal: goalKey(), quest: session.profile.quest ?? null, stars: list.map((m) => ({ at: [Math.round(m.x), Math.round(m.y)], who: m.who ?? null, thing: m.thing ?? null, line: m.key ? textOf(m.key, { who: m.who ? textOf(`npc.${m.who}.name`) : '', thing: m.name ? { key: m.name } : '' }) : null, work: Boolean(m.work), rest: Boolean(m.rest) })) };
  };
  const start = where();
  let dead = 0;
  let nightFor = 0;
  let quiet = 0;
  let lastProgress = progress();
  const openFor = new Map();
  for (command = 0; command < commands; command++) {
    // A talk or a line: read it (a random choice).
    if (session.screen) {
      const choices = lastOpen?.choices?.length ?? 0;
      if (session.screen === 'dialogue' && choices) session.command({ type: 'choose', n: Math.floor(random() * choices) });
      else session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
      run(0.3);
      continue;
    }
    // Busy: wait (a show of a person, a line that holds the game).
    if (session.busy || query(st(), 'script').some((e) => e.script?.waitChild === false)) {
      run(ROBOT_STEP);
      continue;
    }
    const before = sign();
    const linesBefore = lines.length;
    const notedBefore = noted;
    const act = session.action();
    let pressed = null;
    const r = random();
    if (kind === 'counter' && count()) {
      // A count of the trap: it goes to the post of its count.
    } else if (kind === 'dealer' && deal()) {
      // A sack to a mat.
    } else if (r < 0.5 && (glowed.length || rings().length) && tapGlow()) {
      // The thing that glows.
    } else if (r < 0.08 && tapPerson()) {
      // A person now and then.
    } else if (act && (kind === 'presser' ? r < 0.9 : r < 0.75)) {
      // A look or a talk answers the press: its line is an answer, as a line after a tap.
      if (act.act === 'look' || act.act === 'talk') tappedAt = command;
      pressed = press();
    } else if (r < 0.85 && nearThings().length) {
      const things = nearThings();
      tappedAt = command;
      session.command({ type: 'tap', target: { thing: things[Math.floor(random() * things.length)].id } });
    } else if (!tapStar()) {
      if (act) pressed = press();
      else tapPerson();
    }
    // The button that changes by itself: an act that flips and flips back while the hero stands
    // still, in the wait after the command.
    const acts = [];
    const p0 = { ...hero().position };
    const steps = (kind === 'presser' ? 0.4 : ROBOT_STEP) / STEP;
    for (let i = 0; i < steps; i++) {
      session.step();
      session.events();
      if (i % 3 === 0 && !session.screen && !hero().route) acts.push(session.action()?.act ?? null);
    }
    const still = Math.hypot(hero().position.x - p0.x, hero().position.z - p0.z) < 0.05;
    if (still && !pressed) {
      const changes = acts.filter((a, i) => i > 0 && a !== acts[i - 1]).length;
      if (changes >= 3 && new Set(acts).size >= 2) find('flicker', acts.join('>'));
    }
    // A press that changes nothing.
    if (pressed) {
      dead = sign() === before && noted === notedBefore ? dead + 1 : 0;
      if (dead >= 3) find('deadPress', `${pressed.act}|${pressed.target ?? ''}`);
      if (pressed.act === 'talk' && lines.length === linesBefore && !session.screen) {
        // The press walks to the person first: the line comes at the end of the walk.
        for (let i = 0; i < 10 && hero().route && !session.screen; i++) run(1);
        for (let i = 0; i < 8 && lines.length === linesBefore && !session.screen; i++) run(1);
        if (lines.length === linesBefore && !session.screen && !session.busy) {
          find('silentTalk', String(pressed.target ?? ''));
          if (process.env.ROBOT_DEBUG) console.log('silent talk', command, pressed, events.slice(-12).map((e) => e.type + (e.textKey ? `:${e.textKey}` : '') + (e.screen ? `:${e.screen}` : '') + (e.type === 'press' ? JSON.stringify(e) : '')).join(' '));
        }
      }
    }
    // The texts of the lines of this command.
    for (const l of lines.slice(linesBefore)) if (KEY_IN_TEXT.test(l.text)) find('keyInText', l.text);
    // The same line again and again.
    const last = lines.slice(-12).filter((l) => !COUNT_WORD.test(l.key) && l.tapped < l.command - 1);
    const by = new Map();
    for (const l of last) by.set(l.text, (by.get(l.text) ?? 0) + 1);
    for (const [text, n] of by) if (n >= 5) find('sameLine', text);
    // Night with no morning.
    const min = st().clock.minutes % 1440;
    const dark = min >= 19 * 60 || min < 5 * 60;
    // Only out of a work and a raid: in a work the child finishes it first (the work goes on at
    // night), and the robot is a clumsy worker.
    const busyWork = query(st(), 'zone').some((z) => z.zone.rule === 'trial' && !z.zone.done) || Boolean(getEntity(st(), 'raid'));
    if (dark && !morning && !busyWork) nightFor += 1;
    else nightFor = 0;
    if (morning) morning = false;
    if (nightFor >= 60) find('noMorning');
    // A work open too long, and no progress.
    for (const z of query(st(), 'zone').filter((x) => x.zone.rule === 'trial' && !x.zone.done)) {
      openFor.set(z.id, (openFor.get(z.id) ?? 0) + 1);
      if (openFor.get(z.id) >= 120) find('longWork', z.id);
    }
    // No progress while a work is open: no change of its things, its tries, or the flags.
    const p = progress();
    const working = query(st(), 'zone').some((z) => z.zone.rule === 'trial' && !z.zone.done);
    quiet = working && p === lastProgress ? quiet + 1 : 0;
    lastProgress = p;
    if (quiet >= 80) find('noProgress', query(st(), 'zone').filter((z) => z.zone.rule === 'trial' && !z.zone.done).map((z) => z.id).join(','));
    // The counter at the trap: the trap goes to the post of its count.
    if (counted) {
      const put = events.slice().reverse().find((e) => e.type === 'trapput');
      const raid = getEntity(st(), 'raid')?.raid;
      if (put && raid) {
        const k = raid.posts.findIndex((q) => Math.abs(q.d - put.d) <= 1) + 1;
        if (k !== counted.posts) find('trapPost', `count ${counted.posts}, trap at post ${k}`);
        counted = null;
      }
    }
  }
  return { findings, stats: { commands, lines: lines.length, tick: st().tick }, start, end: where(), heard: lines.map((l) => l.text), lines: lines.map((l) => ({ key: l.key, text: l.text, tick: l.tick, command: l.command })) };
}

// The scenes of tests/stories/: [{ name, story }].
export function scenes() {
  const dir = new URL('../../tests/stories/', import.meta.url);
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => ({ name: f.replace(/\.json$/, ''), story: JSON.parse(readFileSync(new URL(f, dir), 'utf8')) }));
}

// A report of findings, grouped by law.
export function report(findings) {
  const out = [];
  for (const law of Object.keys(LAWS)) {
    const list = findings.filter((f) => f.law === law);
    if (!list.length) continue;
    out.push(`## ${LAWS[law]} (${list.length})`);
    for (const f of list.slice(0, 12)) out.push(`- ${f.scene}, ${f.kind}${f.night ? ', night' : ''}, command ${f.command}, ${String(Math.floor(f.clock / 60) % 24).padStart(2, '0')}:${String(Math.floor(f.clock % 60)).padStart(2, '0')}, goal ${f.goal ?? '-'}, act ${f.act ?? '-'}${f.detail ? `: ${f.detail}` : ''}\n  last lines: ${f.lines.map((l) => `"${l}"`).join(' / ')}`);
    if (list.length > 12) out.push(`- … and ${list.length - 12} more`);
  }
  return out.join('\n') || 'No finding.';
}
