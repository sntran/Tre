// The voice of the bubbles (#60): every line of a person in a bubble is spoken in the voice of that
// person, the words of a count in their order, and a greeting goes when the voice is busy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bubbleLine, createVoiceQueue, kindOf, speakerOf, SAID_AGAIN } from '../src/core/bubblevoice.js';
import { voiceOf, spokenOf } from '../src/core/voices.js';
import { runHeadless, data } from './story-run.js';
import { playPresses, STEP } from './restless.js';
import { load } from './helpers.js';

const voice = (speaker) => voiceOf(speaker, { npcs: data.npcs.npcs, friends: data.friends.friends, voices: data.game.voices });

test('the kind of a line, and the speaker of a bubble', () => {
  assert.equal(kindOf('num.3'), 'count');
  assert.equal(kindOf('world.greet.1'), 'greet');
  assert.equal(kindOf('mentor.teacher.show'), 'line');
  assert.equal(speakerOf('npc:fisher'), 'fisher');
  assert.equal(speakerOf('friend:nghe'), 'nghe');
});

test('the queue: a hint waits for the talk, the counts keep their order, a greeting goes when the voice is busy', () => {
  const q = createVoiceQueue();
  const line = (key, id = 'npc:teacher') => ({ id, key, params: {}, voice: 'elderMan', kind: kindOf(key) });
  assert.equal(q.offer(line('mentor.a'), true), 'wait', 'the talk box speaks: the hint waits');
  assert.equal(q.next(true), null);
  assert.equal(q.next(false).key, 'mentor.a', 'the hint speaks when the voice is quiet');
  assert.equal(q.offer(line('num.1'), false), 'now');
  assert.equal(q.offer(line('num.2'), true), 'wait');
  assert.equal(q.offer(line('num.3'), true), 'wait');
  assert.equal(q.offer(line('world.greet.1', 'npc:farmer'), true), 'drop', 'a greeting of a person who walks by goes');
  assert.deepEqual([q.next(false), q.next(false), q.next(false)].map((l) => l.key), ['num.1', 'num.2', 'num.3'], 'one number never cuts the last one');
  assert.equal(q.offer(line('world.greet.1', 'npc:farmer'), false), 'now', 'with a quiet voice, the greeting speaks');
  q.next(false);
  // A newer hint of the same person takes the place of an older one that waits; the same line once.
  q.offer(line('mentor.old'), true);
  q.offer(line('mentor.new'), true);
  assert.equal(q.offer(line('mentor.new'), true), 'drop');
  assert.deepEqual([q.next(false)?.key, q.next(false)], ['mentor.new', null]);
});

test('each bubble of a mentor in a task gives one line to speak, in the voice of the mentor (#60)', async () => {
  const story = load('tests/stories/trial-scholar.json');
  const first = story.steps.findIndex((s) => s.read === true);
  let session = null;
  await runHeadless({ ...story, steps: story.steps.slice(0, first + 1) }, { onSession: (s) => { session = s; } });
  const lines = [];
  let callouts = 0;
  session.listen((ev) => {
    if (ev.type !== 'open' || ev.screen !== 'callout') return;
    callouts += 1;
    const l = bubbleLine(ev, voice);
    if (l) lines.push(l);
  });
  playPresses(session, { presses: 20 });
  assert.ok(callouts > 0, 'the teacher speaks in bubbles');
  assert.equal(lines.length, callouts, 'one line for each bubble');
  const teacher = lines.filter((l) => l.id === 'npc:teacher');
  assert.ok(teacher.length > 0);
  assert.ok(teacher.every((l) => l.voice === voice('teacher') && l.voice !== 'narrator'), JSON.stringify(teacher.map((l) => l.voice)));
});

// Each line of a bubble is spoken one time (#67): two children who greet the hero at once, or two
// villagers who say the same news, are heard one time; the words of a count are never dropped.
test('the same words from two people are spoken one time; a count is never dropped', () => {
  const q = createVoiceQueue();
  const line = (key, id = 'npc:teacher') => ({ id, key, params: {}, voice: 'elderMan', kind: kindOf(key) });
  const hi = (id) => ({ ...line('world.greet.1', id), params: { name: 'Tí' } });
  assert.equal(q.offer(hi('npc:kid-a'), false, 10), 'now');
  assert.equal(q.offer(hi('npc:kid-b'), false, 10), 'drop', 'the same greeting waits already');
  assert.equal(q.next(false, 10).id, 'npc:kid-a');
  assert.equal(q.offer(hi('npc:kid-b'), false, 11), 'drop', 'the voice said these words a moment ago');
  assert.equal(q.offer(line('market.news', 'npc:a'), false, 12), 'now');
  q.next(false, 12);
  assert.equal(q.offer(line('market.news', 'npc:b'), false, 14), 'drop');
  assert.equal(q.offer(line('market.news', 'npc:b'), false, 12 + SAID_AGAIN), 'now', 'much later, the line speaks again');
  q.next(false, 12 + SAID_AGAIN);
  assert.equal(q.offer(line('num.1'), false, 40), 'now');
  q.next(false, 40);
  assert.equal(q.offer(line('num.1'), false, 41), 'now', 'a new count says one again');
});

// #106: every line that a child needs is spoken.
const lineOf = (key, id = 'npc:teacher', extra = {}) => ({ id, key, params: {}, voice: 'elderMan', kind: kindOf(key), ...extra });
const drain = (q, now = null) => {
  const out = [];
  for (let l = q.next(false, now); l; l = q.next(false, now)) out.push(l.key);
  return out;
};

test('the goal of a task and then the first help of the same person, in one step: both are spoken, in order', () => {
  const q = createVoiceQueue();
  q.offer(lineOf('teacher.need.2'), true, 0);
  q.offer(lineOf('mentor.scholar.first'), true, 0);
  assert.deepEqual(drain(q, 1), ['teacher.need.2', 'mentor.scholar.first']);
  q.offer(lineOf('scholar.tied', 'npc:teacher', { kind: 'world' }), true, 2);
  q.offer(lineOf('scholar.more'), true, 2);
  q.offer(lineOf('mentor.show.scholar'), true, 2);
  assert.deepEqual(drain(q, 3), ['scholar.tied', 'scholar.more', 'mentor.show.scholar'], 'what is left is never dropped for a hint');
  for (const key of ['teacher.need.1', 'mentor.scholar.need', 'woodcutter.pieces', 'scholar.more', 'fisher.gaps', 'fisher.gaps.one', 'event.duck.start', 'puzzle.ferry.start.1']) assert.equal(kindOf(key), 'goal', key);
});

test('a line that the child asked for with a wave is spoken two times in twelve seconds', () => {
  const q = createVoiceQueue();
  q.offer(lineOf('mentor.show.scholar', 'npc:teacher', { asked: true }), false, 0);
  assert.deepEqual(drain(q, 0), ['mentor.show.scholar']);
  assert.notEqual(q.offer(lineOf('mentor.show.scholar', 'npc:teacher', { asked: true }), false, 5), 'drop');
  assert.deepEqual(drain(q, 5), ['mentor.show.scholar']);
  assert.equal(q.offer(lineOf('mentor.show.scholar'), false, 6), 'drop', 'the same line with no wave goes');
  assert.ok(SAID_AGAIN >= 12);
});

test('a count of eleven and then its result: the eleven numbers, then the result', () => {
  const q = createVoiceQueue();
  for (let n = 1; n <= 11; n++) q.offer(lineOf(`num.${n}`, 'event:duck'), n > 1, 0);
  q.offer({ id: 'talk', talk: true, key: 'event.duck.short', params: {}, voice: 'woman', kind: 'world' }, true, 0);
  assert.deepEqual(drain(q, 1), [...Array.from({ length: 11 }, (_, i) => `num.${i + 1}`), 'event.duck.short']);
});

test('the card of a new word and the gloss of a name are spoken after the line', () => {
  const d = { npcs: data.npcs.npcs, friends: data.friends.friends, voices: data.game.voices };
  const out = spokenOf({ speaker: 'smith', textKey: 'dlg.smith.need.iron.n1', word: { nameKey: 'word.ore', textKey: 'word.ore.what' } }, d, null, { gloss: 'Ông Dương: an old man.' });
  assert.deepEqual(out.map((x) => x.key ?? x.text), ['dlg.smith.need.iron.n1', 'word.ore.what', 'Ông Dương: an old man.']);
  assert.ok(out.every((x) => x.voice === out[0].voice), 'in the voice of the person');
});

// The voice of a whole village, headless: the bubbles and the talk boxes go into one queue, and a
// line takes the time of its words (about 12 letters each second).
function voiceOfVillage(session, i18n) {
  const q = createVoiceQueue();
  const spoken = [];
  let busyUntil = 0;
  const now = () => session.state.tick * STEP;
  session.listen((ev) => {
    if (ev.type !== 'open' || !ev.textKey) return;
    const line = ev.screen === 'callout' ? bubbleLine(ev, voice) : { id: 'talk', talk: true, key: ev.textKey, params: ev.params ?? {}, voice: 'narrator', kind: 'world' };
    q.offer(line, now() < busyUntil, now());
  });
  return {
    spoken,
    tick() {
      if (now() < busyUntil) return;
      const l = q.next(false, now());
      if (!l) return;
      spoken.push(l.key);
      busyUntil = now() + 0.6 + i18n.t(l.key, l.params).length / 12;
    },
  };
}

test('the whole village at the teacher, grades 1 and 2: the goal is spoken after the talk, and what is left after the first bundle', async () => {
  const { createI18n } = await import('../src/core/i18n.js');
  const i18n = createI18n(load('i18n/vi.json'), 'vi');
  for (const grade of [1, 2]) {
    const s = load('tests/stories/trial-scholar.json');
    const first = s.steps.findIndex((x) => x.read === true);
    let session = null;
    let v = null;
    const failures = await runHeadless({ ...s, profile: { ...s.profile, grade }, steps: s.steps.slice(0, first) }, { onSession: (x) => { session = x; v = voiceOfVillage(x, i18n); } });
    assert.deepEqual(failures, []);
    const run = (sec) => {
      for (let i = 0; i < sec / STEP; i++) {
        if (session.screen) session.command({ type: session.screen === 'dialogue' || session.screen === 'say' ? 'next' : 'close' });
        session.step();
        session.events();
        v.tick();
      }
    };
    run(40);
    assert.ok(v.spoken.some((k) => /^teacher\.need\./.test(k)), `grade ${grade}: ${v.spoken.join(', ')}`);
    // Ten rods on the mat, and the tie.
    const { getEntity } = await import('../src/core/world/state.js');
    const before = v.spoken.length;
    const tapAt = (id) => {
      const e = getEntity(session.state, id);
      session.command({ type: 'tap', target: e.zone ? session.targetAt(e.zone.x / 2, e.zone.z / 2) : { thing: id } });
      run(4);
    };
    const press = () => { session.command({ type: 'hands', id: session.action()?.id }); run(1.5); };
    for (let i = 0; i < 10; i++) {
      const rod = getEntity(session.state, 'zone:rods').zone.items.find((id) => getEntity(session.state, id)?.item.kind === 'rod');
      tapAt(rod);
      // With the mat in reach, one press puts the rod on the mat; else a tap on the mat and a press.
      press();
      if (getEntity(session.state, 'hero').hands?.holds) {
        tapAt('zone:mat');
        press();
      }
    }
    assert.equal(getEntity(session.state, 'zone:mat').zone.items.length, 10, 'ten rods on the mat');
    session.command({ type: 'tap', target: { person: 'npc:teacher' } });
    run(3);
    session.command({ type: 'hands', id: session.action()?.id });
    run(40);
    const after = v.spoken.slice(before);
    assert.ok(after.includes('scholar.more'), `grade ${grade}: ${after.join(', ')}`);
  }
});
