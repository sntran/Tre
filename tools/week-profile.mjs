// A test profile with two weeks of play, for the weekly note of the parent page (#25):
//   node tools/week-profile.mjs [out.json] [--monday=YYYY-MM-DD]
// It plays the practice stories of tests/stories/ at speed, each on its own day of last week or of
// this week (the week of --monday, or of today), with the learning log on. Some sessions come from
// a practice link, and the child starts the others. Each story plays its own profile (a story
// expects its own start), and the tool joins them into one profile: the events of all the logs in
// the order of time, and the memory of the facts (the activity and the week of the first right
// commit of each fact, and the table of each week). At the end, the teacher asks short questions on
// the facts of the table (the outside check of rule 26). The profile is written as JSON.

import { readFileSync, writeFileSync } from 'node:fs';
import { runHeadless, data } from '../tests/story-run.js';
import { createLogger } from '../src/core/logger.js';
import { factKey, factState, factString } from '../src/core/planting.js';
import { createLog, logEvent, weekOf } from '../src/core/learnlog.js';

const DAY = 86400000;
const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith('--')) ?? 'week-profile.json';
const given = args.find((a) => a.startsWith('--monday='))?.slice(9);
const mondayOf = (t) => {
  const d = Math.floor(t / DAY);
  return (d - ((d + 3) % 7)) * DAY;
};
const monday = given ? Date.parse(`${given}T00:00:00Z`) : mondayOf(Date.now());

// [day from this Monday, hour, story, from a practice link, who ends the session]. The time limit
// (parent) ends one session, and the raids of the story come on two days (#58).
const PLAN = [
  [-7, 17, 'practice-cay-lua', true],
  [-5, 17, 'practice-cho-vit-an', true],
  [-4, 18, 'practice-mua-trong', false],
  [0, 17, 'practice-mua-trong', true],
  [1, 17, 'practice-dat-lo', false],
  [1, 19, 'raid-lost', false],
  [2, 18, 'practice-cay-lua', false, 'parent'],
  [2, 19, 'raid-scouts', false],
  [3, 17, 'practice-mua-trong', false],
  [4, 16, 'practice-nhay-day', false],
];

const story = (name) => JSON.parse(readFileSync(new URL(`../tests/stories/${name}.json`, import.meta.url), 'utf8'));
const runs = [];
for (const [day, hour, name, sent, endedBy = 'child'] of PLAN) {
  const s = story(name);
  s.profile = { ...s.profile, name: 'Nam' };
  const epoch = monday + day * DAY + hour * 3600000;
  let p = null;
  const failures = await runHeadless(s, { log: true, epoch, sent, endedBy, onEnd: (r) => { p = r.profile; } });
  runs.push({ epoch, profile: p });
  console.log(`${new Date(epoch).toISOString().slice(0, 16)} ${name}${sent ? ' (link)' : ''}${endedBy !== 'child' ? ` (ended by ${endedBy})` : ''}: ${failures.length ? JSON.stringify(failures) : 'ok'}`);
}

// One profile: the last one, with the events of all the logs, and the facts of all the plays.
const profile = runs[runs.length - 1].profile;
const log = createLog(profile.log?.tz ?? 0);
for (const ev of runs.flatMap((r) => r.profile.log?.events ?? []).sort((a, b) => a.t - b.t)) logEvent(log, ev, data.learnlog);
profile.log = log;
const skill = data.planting.skill;
const week = weekOf(monday);
const merge = (list) => {
  const mem = {};
  for (const r of list) {
    for (const [key, e] of Object.entries(r.profile.facts?.[skill] ?? {})) {
      const old = mem[key];
      if (!old) mem[key] = structuredClone(e);
      else {
        // The plays of the days are one memory: the boxes of the right commits add up.
        const keep = structuredClone(e);
        keep.box = Math.min((old.box ?? 0) + (e.box ?? 0), data.planting.boxes.length);
        keep.n = (old.n ?? 0) + (e.n ?? 0);
        keep.from = old.from ?? e.from;
        keep.fromWk = old.fromWk ?? e.fromWk;
        if (old.fromWk !== undefined && e.fromWk !== undefined && e.fromWk > old.fromWk) keep.kept = e.fromWk;
        mem[key] = keep;
      }
    }
  }
  return mem;
};
const last = merge(runs.filter((r) => weekOf(r.epoch) < week));
profile.facts = { [skill]: merge(runs) };
profile.factSnap = { week, prevWeek: week - 1, cur: { [skill]: factString(profile.facts[skill]) }, prev: { [skill]: factString(last) } };

// The short questions of the teacher on the facts, on Friday evening: right on the facts that the
// child knows in the world, and on some of the others.
const at = monday + 4 * DAY + 19 * 3600000;
const logger = createLogger({ profile, schema: data.learnlog, quests: data.quests.quests, now: () => at, drop: false });
const mem = profile.facts[skill];
const facts = [...Object.keys(mem), factKey(6, 8), factKey(7, 9)].slice(0, 8);
facts.forEach((fact, i) => {
  const known = factState(mem[fact]) === 'confident';
  logger.record('quiz', { skill, fact, known, correct: known || i % 2 === 0 });
});
profile.hero.name = 'Nam';
writeFileSync(out, JSON.stringify(profile));
console.log(`wrote ${out}: ${Object.keys(mem).length} facts met, ${log.events.length} events today, ${Object.keys(Object.values(log.rollups)[0]?.weeks ?? {}).length} weeks rolled up`);
