import { test } from 'node:test';
import assert from 'node:assert/strict';
import { voiceOf, voiceGender, chooseVoice } from '../src/core/voices.js';
import { load } from './helpers.js';

const game = load('data/config/game.json');
const data = { npcs: load('data/npcs.json').npcs, friends: load('data/friends.json').friends, voices: game.voices };
const speakers = new Set(['prologue', 'village', 'giong']
  .flatMap((f) => load(`data/dialogue/${f}.json`).dialogues)
  .flatMap((d) => Object.values(d.nodes).map((n) => n.speaker)));

test('each speaker of a dialogue has a voice profile', () => {
  for (const s of speakers) {
    const v = voiceOf(s, data, { hero: { gender: 'girl' }, flags: {} });
    assert.ok(game.voices[v], `${s}: ${v}`);
    if (s && !['narrator', 'hero', 'giong'].includes(s)) assert.notEqual(v, 'narrator', `${s} has its own voice`);
  }
  assert.equal(voiceOf('grandma', data), 'elderWoman');
  assert.equal(voiceOf('elder', data), 'elderMan');
  assert.equal(voiceOf('mother', data), 'woman');
  assert.equal(voiceOf('hero', data, { hero: { gender: 'girl' } }), 'girl');
  assert.equal(voiceOf('hero', data, { hero: { gender: 'boy' } }), 'boy');
  assert.equal(voiceOf('giong', data, { flags: {} }), 'boy');
  assert.equal(voiceOf('giong', data, { flags: { 'giong.grown': true } }), 'man');
});

test('the voice profiles sound different: children high, elders slow', () => {
  const v = game.voices;
  assert.ok(v.girl.pitch > v.woman.pitch && v.boy.pitch > v.man.pitch);
  assert.ok(v.elderMan.rate < v.man.rate && v.elderWoman.rate < v.woman.rate);
  assert.ok(v.elderMan.pitch < v.man.pitch);
});

test('a male or female browser voice is chosen when the device has one', () => {
  const voices = [
    { name: 'Google Tiếng Việt', lang: 'vi-VN', localService: false },
    { name: 'Microsoft NamMinh Online', lang: 'vi-VN', localService: false },
    { name: 'Samantha', lang: 'en-US', localService: true },
    { name: 'Daniel', lang: 'en-GB', localService: true },
  ];
  assert.equal(voiceGender('Microsoft NamMinh Online'), 'male');
  assert.equal(voiceGender('Linh'), 'female');
  assert.equal(chooseVoice(voices, 'vi', 'male').name, 'Microsoft NamMinh Online');
  assert.equal(chooseVoice(voices, 'vi', 'female').name, 'Google Tiếng Việt');
  assert.equal(chooseVoice(voices, 'en', 'male').name, 'Daniel');
  // Only one voice: use it for all people.
  assert.equal(chooseVoice([voices[0]], 'vi', 'male').name, 'Google Tiếng Việt');
  // No voice for the language: the browser chooses.
  assert.equal(chooseVoice(voices.slice(2), 'vi', 'male'), null);
});
