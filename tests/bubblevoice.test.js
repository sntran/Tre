// The voice of the bubbles (#60): every line of a person in a bubble is spoken in the voice of that
// person, the words of a count in their order, and a greeting goes when the voice is busy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bubbleLine, createVoiceQueue, kindOf, speakerOf, SAID_AGAIN } from '../src/core/bubblevoice.js';
import { voiceOf } from '../src/core/voices.js';
import { runHeadless, data } from './story-run.js';
import { playPresses } from './restless.js';
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
