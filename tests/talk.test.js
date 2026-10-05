// One person talks at a time, and nobody makes small talk during the work (#38): src/core/lines.js,
// the end of the greeting of a place, and atWork in src/core/session.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linesAfter, lineLife, nearHero, LINE_LIFE, TALK_NEAR } from '../src/core/lines.js';
import { STEP } from '../src/core/world/step.js';
import { load } from './helpers.js';
import { runHeadless } from './story-run.js';

const vi = load('i18n/vi.json');
const SMALL_TALK = /^world\.(greet|market)\./;

test('a new line of a person near the hero takes away the lines of the other people; a person far away does not', () => {
  const lines = [{ id: 'npc:a' }, { id: 'npc:b' }, { id: 'npc:b', icon: 'jar' }];
  assert.deepEqual(linesAfter(lines, 'npc:b', true), [{ id: 'npc:b' }, { id: 'npc:b', icon: 'jar' }]);
  assert.deepEqual(linesAfter(lines, 'npc:c', true), []);
  assert.equal(linesAfter(lines, 'npc:c', false), lines);
  assert.ok(nearHero({ x: 0, z: 0 }, { x: TALK_NEAR, z: 0 }) && !nearHero({ x: 0, z: 0 }, { x: TALK_NEAR + 1, z: 0 }));
  assert.equal(lineLife('hai'), LINE_LIFE);
  assert.ok(lineLife(vi['hamlet.greet']) > 4, 'a greeting of one sentence stays long enough to read');
});

// The lines over the heads, as the view shows them: each callout and each line of a talk, with the
// time of the game, and the rule of src/core/lines.js.
function linesOnScreen(record) {
  let lines = [];
  const counts = [];
  for (const r of record) {
    lines = lines.filter((l) => r.t - l.t < l.life);
    lines = linesAfter(lines, r.id, r.near);
    if (r.box) lines = lines.filter((l) => l.id === r.id);
    else lines.push({ id: r.id, t: r.t, life: lineLife(vi[r.key] ?? '') });
    counts.push({ t: r.t, key: r.key, ids: [...new Set(lines.map((l) => l.id))] });
  }
  return counts;
}

test('a press at the planter during the greeting of the hamlet ends the greeting and its marks; then only one person talks, and the planter says no small talk while she works', async () => {
  let session = null;
  const record = [];
  let pressAt = null;
  let afterPress = null;
  const story = {
    name: 'one-talker', practice: 'xom-ruong',
    profile: { name: 'An', grade: 2, lang: 'vi', seed: 7, flags: {} },
    steps: [
      { until: { event: 'call', with: { key: 'hamlet.greet' }, timeout: 5 } },
      { wait: 1 },
      { press: { entity: 'npc:planter' } },
      { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 30 } },
      { read: true },
      { until: { event: 'example', with: { done: true }, timeout: 40 } },
      { wait: 4 },
    ],
  };
  const failures = await runHeadless(story, {
    onSession: (s) => {
      session = s;
      s.listen((ev) => {
        const t = s.state.tick * STEP;
        const hero = s.state.entities.find((e) => e.id === 'hero')?.position;
        const at = (id) => s.state.entities.find((e) => e.id === id)?.position;
        if (ev.type === 'open' && ev.screen === 'callout') record.push({ t, id: ev.id, key: ev.textKey, near: nearHero(at(ev.id), hero) });
        if (ev.type === 'open' && (ev.screen === 'dialogue' || ev.screen === 'say')) {
          const id = `npc:${ev.speaker}`;
          record.push({ t, id, key: ev.textKey, near: nearHero(at(id), hero), box: true });
          if (ev.speaker === 'planter' && pressAt === null) {
            pressAt = t;
            afterPress = { greet: s.state.entities.some((e) => e.id === 'script:greet'), marks: s.state.entities.filter((e) => e.mentorMark).length };
          }
        }
      });
    },
  });
  assert.deepEqual(failures, []);
  assert.ok(record.some((r) => r.key === 'hamlet.greet'), 'the head of the hamlet greets');
  assert.ok(pressAt !== null, 'the planter talks');
  assert.equal(afterPress.greet, false, 'the greeting ended at the press');
  assert.equal(afterPress.marks, 0, 'the marks of the greeting went with it');
  // From the first line of the planter on, only one person has a line over the head at a time.
  for (const c of linesOnScreen(record).filter((x) => x.t >= pressAt)) assert.ok(c.ids.length <= 1, `${c.key}: ${c.ids.join(', ')}`);
  // The planter worked (the example, then the round): no small talk from her.
  const planter = record.filter((r) => r.id === 'npc:planter' && r.t >= pressAt);
  assert.ok(planter.length > 0);
  assert.deepEqual(planter.filter((r) => SMALL_TALK.test(r.key ?? '')).map((r) => r.key), []);
  assert.ok(session);
});

test('a person at work makes no small talk: the greeting of a person near the hero waits while the person works', async () => {
  // The planter with the hero beside her, during her example: her greeting of the day is small talk.
  let session = null;
  let smallTalk = 0;
  const story = {
    name: 'no-small-talk', practice: 'cay-lua',
    profile: { name: 'An', grade: 2, lang: 'vi', seed: 7, flags: {} },
    steps: [
      { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 10 } },
      { read: true },
      { until: { event: 'shows', timeout: 10 } },
    ],
  };
  await runHeadless(story, {
    onSession: (s) => {
      session = s;
      s.listen((ev) => { if (ev.type === 'open' && ev.screen === 'callout' && ev.id === 'npc:planter' && SMALL_TALK.test(ev.textKey)) smallTalk += 1; });
    },
  });
  // The greeting reaction of the planter fires now (she is near the hero, and her wait is over).
  const planter = session.state.entities.find((e) => e.id === 'npc:planter');
  const greet = planter.react?.find?.((r) => r.kind === 'greet') ?? (planter.react?.kind === 'greet' ? planter.react : null);
  assert.ok(greet, 'the planter greets people who pass');
  greet.cool = 0;
  for (let i = 0; i < 30; i++) session.step();
  assert.equal(smallTalk, 0, 'no small talk while the example goes on');
});

test('during the example of the planter, a bystander two cells from the hero has its greeting due: no small talk shows, and the line of the planter stays', async () => {
  let session = null;
  const record = [];
  const story = {
    name: 'bystander', practice: 'cay-lua',
    profile: { name: 'An', grade: 2, lang: 'vi', seed: 7, flags: {} },
    steps: [
      { until: { event: 'open', with: { screen: 'dialogue' }, timeout: 10 } },
      { read: true },
      { until: { event: 'shows', timeout: 10 } },
    ],
  };
  await runHeadless(story, {
    onSession: (s) => {
      session = s;
      s.listen((ev) => {
        if (ev.type !== 'open' || ev.screen !== 'callout') return;
        const hero = s.state.entities.find((e) => e.id === 'hero').position;
        const at = s.state.entities.find((e) => e.id === ev.id)?.position;
        record.push({ t: s.state.tick * STEP, id: ev.id, key: ev.textKey, near: nearHero(at, hero) });
      });
    },
  });
  // The duck girl comes two cells from the hero, and her greeting is due.
  const hero = session.state.entities.find((e) => e.id === 'hero').position;
  const girl = session.state.entities.find((e) => e.id === 'npc:duck-girl');
  Object.assign(girl.position, { x: hero.x + 4, z: hero.z });
  const greet = [girl.react].flat().find((r) => r?.kind === 'greet');
  assert.ok(greet, 'the duck girl greets people who pass');
  greet.cool = 0;
  const from = record.length;
  for (let i = 0; i < 45; i++) session.step();
  assert.ok(session.state.entities.some((e) => e.id === 'script:example-planting'), 'the example still goes on');
  const after = record.slice(from);
  assert.deepEqual(after.filter((r) => SMALL_TALK.test(r.key ?? '')).map((r) => `${r.id} ${r.key}`), [], 'no small talk during the work');
  // The last line of the planter stays over her head: no line of another person took it away.
  const lines = linesOnScreen(record);
  const last = lines.at(-1);
  assert.ok(last.ids.includes('npc:planter') && last.ids.every((id) => id === 'npc:planter'), JSON.stringify(last));
});
