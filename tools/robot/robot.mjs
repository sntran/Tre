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
//   dealer   at the share: one sack to each mat in turn, the rest on the pile;
//   walker   presses during each walk after a tap (#183: a boy of grade 4 pressed seven times
//            while the hero walked to the basket of bà lang);
//   slow     counts as the counter, but waits 3 s between the presses of a count (#183).
// The world runs one second (ROBOT_STEP) after each command.
import { runHeadless, data } from '../../tests/story-run.js';
import { load } from '../../tests/helpers.js';
import { STEP } from '../../src/core/story.js';
import { getEntity, query } from '../../src/core/world/state.js';
import { createI18n } from '../../src/core/i18n.js';
import { storyStars } from '../../src/core/stars.js';
import { sideMarks } from '../../src/world/marks.js';
import { drawable } from '../../src/world/figures.js';
import { currentGoal } from '../../src/core/quests.js';
import { conditionState } from '../../src/core/game.js';
import { along, postAt } from '../../src/core/world/raids.js';
import { createRng } from '../../src/core/rng.js';
import { readdirSync, readFileSync } from 'node:fs';

export const KINDS = ['star', 'presser', 'counter', 'dealer', 'walker', 'slow'];
export const NIGHT = 1260; // minutes: 21:00
const ROBOT_STEP = 1; // seconds of the world after each command
const vi = createI18n(load('i18n/vi.json'), 'vi');
// A text with a key in it: a word with dots and no space (npc.giong-sky.name, Frac.11.12).
const KEY_IN_TEXT = /(^|[\s"(“])[A-Za-z][\w-]*\.[A-Za-z0-9][\w-]*(\.[\w-]+)*(?=$|[\s,.!?:;")”])/;
// The count words, and the lines of a count (a count says the same words when the same thing goes
// in and out again).
const COUNT_WORD = /^num\.|^ord\.|\.count(\.|$)/;
// The events that do not show a change to a child.
const QUIET_EVENTS = new Set(['sound', 'hud', 'tapfx', 'goalShow', 'view', 'workView', 'names']);
// The lines of a fail of a work (#183: the same fail again with presses only).
const FAIL_KEY = /\.(stuck|chase|short|late|early|miss|wrong|fail|broke|break)(\.|$)|\.bend\.(late|early)$/;
// A line that names the big button: a hold or a press (#183). A sentence of a rule (when, each
// time, after) or of a walk first ("…, rồi bấm nút") does not ask for the act now.
const BUTTON_SAY = /(giữ|bấm) nút/i;
const RULE_SAY = /(thì|khi|nếu|lần sau|mỗi lần|rồi bấm|rồi giữ)/i;
export const sayNow = (text) => {
  const s = String(text).split(/(?<=[.!?])\s+/).find((x) => BUTTON_SAY.test(x) && !RULE_SAY.test(x));
  return s ? (/giữ nút/i.test(s) ? 'hold' : 'press') : null;
};
// The acts that are no work: a talk, a look, a ride, a rest.
// The name of a work: a trial zone, its task, or a place of it (trial-event-duck, event-duck).
export const workOf = (task) => String(task).replace(/^trial-/, '').replace(/-(gap|pile)$/, '');
const NO_WORK = new Set(['talk', 'look', 'ride', 'ride-off', 'rest', 'sleep', 'pet', 'wake']);

// The checks of the laws of #183, with no session (each has a test in tests/robot.test.js).
// A lost press: an answer of the session to a press of the robot with no act, no wait for a walk,
// no second press of the same act, no "not now" (nope), and no stop at a commit (arrive, #184). mine: the ids of the presses of the robot > the act.
export function lostPresses(answers, mine) {
  return answers.filter((e) => mine.has(e.id) && !e.done && !e.wait && !e.again && !e.nope && !e.arrive).map((e) => `${mine.get(e.id)}: ${e.why ?? '-'}`);
}
// Another work on the button: here (the work where the hero is), act (the act of the button).
export function otherWork(here, act) {
  if (!here || !act || here === 'puzzle' || here === 'folk') return false;
  return act.act === 'raid' || (!NO_WORK.has(act.act) && Boolean(act.task) && workOf(act.task) !== workOf(here));
}
// The next state of the count of the same fail: fail (the last fail, or null), key (the key of a
// line), tappedAt (the command of the last tap), command. A tap between two fails starts again.
export function failStep(fail, key, tappedAt, command) {
  if (!FAIL_KEY.test(key)) return fail;
  return fail && fail.key === key && tappedAt < fail.command ? { key, n: fail.n + 1, command } : { key, n: 1, command };
}
// The things of an open riddle or work near the hero that the view does not draw: things
// [{ id, near, open, held, entity }].
export function unseen(things) {
  return things.filter((t) => t.near && t.open && !t.held && !drawable(t.entity)).map((t) => t.id);
}

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
  dealWrong: 'at the share, the sack of a tap on a mat and a press went to another mat',
  lostPress: 'a press while the button shows an act, and the act does not come',
  otherWork: 'while a work is open, the button offers another work, a raid, or an event',
  failLoop: 'the same fail of a work three times in a row with presses only',
  lineBeforeAct: 'a line says to press or hold the big button, and the button has no such act',
  unseenThing: 'a thing of an open puzzle or work near the hero that the view does not draw',
};

// Play one scene. story: a story of tests/stories/ (its profile, clock, and place); opts: { kind,
// night, commands, grade, seed, steps (the first steps of the story, played before the robot) }.
// Return { findings, stats }.
export async function playScene(story, { kind = 'star', night = false, commands = 120, grade = null, seed = 1, scene = story.name ?? 'scene', profile = null, steps = [] } = {}) {
  const raw = { ...story, steps, ...(night ? { clock: NIGHT } : {}), ...(story.profile ? { profile: { ...story.profile, ...(grade !== null ? { grade } : {}) } } : {}) };
  let session = null;
  const lines = []; // { key, text, tick, tapped }
  const events = [];
  let lastOpen = null;
  let morning = false;
  let noted = 0; // the events of the world that a child sees or hears (not a sound only)
  let glowed = []; // the things that glow now
  let command = 0;
  let tappedAt = -1; // the command of the last tap of the robot on a thing
  const presses = []; // the answers of the session to a press: { id, act, done, wait, again }
  const mine = new Map(); // the id of a press of the robot > the act that the button showed
  let saysNow = []; // the lines that name the button: { text, kind, due (tick) }
  // The first steps of the story (steps) play before the robot: their failures go in the stats.
  const failed = await runHeadless(raw, { profile, onSession: (x) => {
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
      if (e.type === 'press') presses.push(e);
      // A line that names the button: the act must be on the button 1 s after the line at the
      // latest (a line takes about 0.06 s for each letter).
      const kindNow = key ? sayNow(textOf(key, e.params)) : null;
      if (kindNow) saysNow.push({ text: textOf(key, e.params), kind: kindNow, due: x.state.tick + (textOf(key, e.params).length * 0.06 + 1) / STEP });
      if (e.type === 'dawn' || (e.type === 'open' && e.textKey === 'rest.morning')) morning = true;
    });
  } });
  const rng = createRng(`robot:${scene}:${kind}:${night}:${seed}`);
  const random = () => rng.next();
  const findings = [];
  const seen = new Set();
  const st = () => session.state;
  const hero = () => getEntity(st(), 'hero');
  // One step of the world. A line that names the button waits for its act (the time of a talk
  // on the screen does not count).
  const stepOnce = () => {
    session.step();
    session.events();
    if (!saysNow.length) return;
    if (session.screen || session.busy) {
      for (const w of saysNow) w.due += 1;
      return;
    }
    const a = session.action();
    saysNow = saysNow.filter((w) => {
      if (a && (w.kind === 'press' || a.hold)) return false;
      if (st().tick < w.due) return true;
      find('lineBeforeAct', w.text);
      return false;
    });
  };
  const run = (sec) => {
    for (let i = 0; i < sec / STEP; i++) stepOnce();
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
  // A press of the act a of the button (the id that the view sends with a press).
  const hands = (a) => {
    mine.set(a.id, a.act);
    session.command({ type: 'hands', id: a.id });
  };
  const press = () => {
    const a = session.action();
    if (!a) return false;
    const from = events.length;
    if (a.hold) {
      mine.set(a.id, a.act);
      session.command({ type: 'hold', on: true, id: a.id });
      run(0.3 + random() * 2.6);
      session.command({ type: 'hold', on: false });
    } else hands(a);
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
    // The star of a riddle near the hero is a star too, and a tap on it is a tap on its person, as
    // in the view (src/world/marks.js). An open riddle near the hero comes first, as a work.
    const side = sideMarks(st().entities);
    const h = hero().position;
    const nearSide = side.filter((m) => Math.hypot(m.x * 2 - h.x, m.y * 2 - h.z) <= 40);
    // During a riddle that the child heard, the child works on it: no star (a tap on its star says
    // the riddle again).
    if (session.puzzleHere?.()) return false;
    list = [...list, ...nearSide];
    if (!list.length) return false;
    const work = list.find((m) => m.work);
    const m = work ?? list.reduce((a, b) => (Math.hypot(b.x * 2 - h.x, b.y * 2 - h.z) < Math.hypot(a.x * 2 - h.x, a.y * 2 - h.z) ? b : a));
    tappedAt = command;
    if (m.side && m.person) session.command({ type: 'tap', target: { person: m.person } });
    else session.command({ type: 'tap', target: { ground: { x: m.x, y: m.y, h: m.h ?? 3, thing: false, object: null, goal: true } } });
    return true;
  };
  const tapPerson = () => {
    const h = hero().position;
    // During a riddle the child does not ask its person again and again.
    const near = session.persons().filter((p) => Math.hypot(p.x * 2 - h.x, p.y * 2 - h.z) <= 20 && !getEntity(st(), p.entity)?.hidden && !(session.puzzleHere?.() && p.kind === 'puzzle'));
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
      hands(a);
      run(kind === 'slow' ? 3 : 0.5);
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
      // Deal until each mat has its fair count; the rest stays on the pile.
      const onMats = who.reduce((a, w) => a + (getEntity(st(), `zone:share-${w}`)?.zone.items.length ?? 0), 0);
      const fair = Math.floor((onMats + (loot?.items.length ?? 0)) / who.length) * who.length;
      if (!loot?.items.length || onMats >= fair) return false;
      session.command({ type: 'tap', target: { thing: loot.items[0] } });
      run(4);
      const a = session.action();
      if (a) hands(a);
      return true;
    }
    // A tap on the mat of the turn (on its ground, as a finger taps it), and a press.
    const want = `zone:share-${who[turn % who.length]}`;
    const mat = getEntity(st(), want)?.zone;
    if (!mat) return false;
    session.command({ type: 'tap', target: { ground: { x: mat.x / 2, y: mat.z / 2, h: mat.y / 2, thing: false, object: null } } });
    run(4);
    const a = session.action();
    const counts = () => (share.zone.who ?? who).map((w) => getEntity(st(), `zone:share-${w}`)?.zone.items.length ?? 0).join(',');
    const before = counts();
    const n = mat.items.length;
    if (a) hands(a);
    run(2);
    if (counts() !== before && mat.items.length !== n + 1) find('dealWrong', `${want}: ${before} > ${counts()}`);
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
    // The goal of the quest strip (as src/ui/village.js shows it), and the work that the button
    // offers (#183).
    const q = currentGoal(data.quests.quests, conditionState(session.profile));
    const strip = goalKey() ?? q?.step.goalKey ?? 'quest.free';
    const a = session.screen ? null : session.action();
    return { map: session.map?.id ?? null, hero: [Math.round(h.x / 2), Math.round(h.z / 2)], goal: goalKey(), strip: textOf(strip, q?.progress ?? {}), offer: a ? { act: a.act, target: a.target, task: a.task ?? null } : null, quest: session.profile.quest ?? null, stars: list.map((m) => ({ at: [Math.round(m.x), Math.round(m.y)], who: m.who ?? null, thing: m.thing ?? null, line: m.key ? textOf(m.key, { who: m.who ? textOf(`npc.${m.who}.name`) : '', thing: m.name ? { key: m.name } : '' }) : null, work: Boolean(m.work), rest: Boolean(m.rest) })) };
  };
  const start = where();
  let dead = 0;
  let nightFor = 0;
  let quiet = 0;
  let lastProgress = progress();
  const openFor = new Map();
  let fail = null; // the last fail of a work: { key, n, command }
  let pressSeen = 0;
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
    if ((kind === 'counter' || kind === 'slow') && count()) {
      // A count of the trap: it goes to the post of its count.
    } else if (kind === 'dealer' && deal()) {
      // A sack to a mat.
    } else if ((r < 0.5 && glowed.length && tapGlow()) || (r < 0.85 && rings().length && tapGlow())) {
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
    // The walker presses during the walk of a tap: one to three presses, 0.3 s apart.
    if (kind === 'walker' && tappedAt === command) {
      run(0.3);
      for (let i = 0, n = 1 + Math.floor(random() * 3); i < n && hero().route && !session.screen; i++) {
        const a = session.action();
        if (a && !a.hold) hands(a);
        run(0.3);
      }
    }
    // The button that changes by itself: an act that flips and flips back while the hero stands
    // still, in the wait after the command.
    const acts = [];
    const p0 = { ...hero().position };
    const steps = (kind === 'presser' ? 0.4 : ROBOT_STEP) / STEP;
    for (let i = 0; i < steps; i++) {
      stepOnce();
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
    // A lost press: the session answered a press of the robot with no act (also a press that
    // waited for the end of a walk), while the button showed an act.
    for (const d of lostPresses(presses.slice(pressSeen), mine)) find('lostPress', d);
    pressSeen = presses.length;
    // Another work on the button while a work is open (the share, a trial, a riddle).
    const here = session.screen ? null : session.taskHere?.();
    const now = here ? session.action() : null;
    if (otherWork(here, now)) find('otherWork', `${here} > ${now.act}${now.task ? ` (${now.task})` : ''}`);
    // The same fail three times in a row with presses only.
    for (const l of lines.slice(linesBefore)) {
      if (!FAIL_KEY.test(l.key)) continue;
      fail = failStep(fail, l.key, tappedAt, command);
      if (fail.n >= 3) find('failLoop', l.text);
    }
    // A thing of an open riddle or work near the hero that the view does not draw.
    {
      const h = hero().position;
      const open = new Set(query(st(), 'zone').filter((z) => z.zone.rule === 'trial' && !z.zone.done).map((z) => z.id.replace(/^zone:/, '')));
      const things = query(st(), 'item', 'position').map((e) => ({
        id: e.id,
        entity: e,
        // A fixed thing of a work can hide on purpose (the stem of the woodcutter after a cut: its
        // pieces show in its place).
        open: (String(e.item.kind).startsWith('pz') && Boolean(session.puzzleHere?.())) || (open.has(e.item.task) && !e.item.fixed),
        held: Boolean(e.item.held || e.item.inHands || hero().hands?.holds === e.id),
        near: Math.hypot(e.position.x - h.x, e.position.z - h.z) <= 24,
      }));
      for (const id of unseen(things)) find('unseenThing', id);
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
  return { findings, stats: { commands, lines: lines.length, tick: st().tick, failed: failed.map((f) => `step ${f.step}: ${f.message}`) }, start, end: where(), heard: lines.map((l) => l.text), lines: lines.map((l) => ({ key: l.key, text: l.text, tick: l.tick, command: l.command })) };
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
