// Voice. speak(key) plays a recorded file from audio/<lang>/ when it exists.
// If no file exists, it uses the Web Speech API.
import { lang, say } from './i18n.js';
import { chooseVoice } from '../core/voices.js';

const recorded = {};
let enabled = true;
let player = null;
let voices = [];

function loadVoices() {
  if (!('speechSynthesis' in window)) return;
  voices = window.speechSynthesis.getVoices();
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

// Load the list of recorded keys for a language. The list is in audio/<lang>/index.json.
export async function loadRecordedKeys(code) {
  if (recorded[code]) return;
  try {
    const response = await fetch(`audio/${code}/index.json`);
    const data = response.ok ? await response.json() : { keys: [] };
    recorded[code] = new Set(data.keys ?? []);
  } catch {
    recorded[code] = new Set();
  }
}

// iOS lets a page speak only after it speaks once in a tap. Speak an empty text in the first tap.
let speechUnlocked = false;
export function unlockSpeech() {
  if (speechUnlocked || !('speechSynthesis' in window)) return;
  speechUnlocked = true;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch {
    speechUnlocked = false;
  }
}

export function setVoiceEnabled(value) {
  enabled = value;
  if (!value) stop();
}

export function voiceEnabled() {
  return enabled;
}

export function stop() {
  if (player) {
    player.pause();
    player = null;
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

// The voice profiles (data/config/game.json, "voices"). The app sets them after it loads the data.
let profiles = {};
export function setVoiceProfiles(value) {
  profiles = value ?? {};
}

// Speak a text key. Params are only for the synthetic voice:
// a recorded file is used only for a key with no params.
// opts: { force (speak also when the voice is off), queue (wait for the current speech;
// do not stop it), voice (a profile name, for example 'elderMan') }
export function speak(key, params = null, { force = false, queue = false, voice = 'narrator' } = {}) {
  if (!enabled && !force) return;
  if (!queue) stop();
  const code = lang();
  const hasParams = params && Object.keys(params).length > 0;
  if (!hasParams && recorded[code]?.has(key) && !queue) {
    player = new Audio(`audio/${code}/${key}.mp3`);
    player.play().catch(() => speakText(say(key, params), code, { voice, force: true }));
    return;
  }
  speakText(say(key, params), code, { queue: true, voice, force: true });
}

// Speak a text. With queue: false, stop the current speech first.
export function speakText(text, code = lang(), { queue = false, voice = 'narrator', force = false } = {}) {
  if (!('speechSynthesis' in window) || !text) return;
  if (!enabled && !force) return;
  if (!queue) stop();
  const profile = profiles[voice] ?? profiles.narrator ?? {};
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = code === 'vi' ? 'vi-VN' : 'en-US';
  const chosen = chooseVoice(voices, code, profile.gender ?? null);
  if (chosen) utterance.voice = chosen;
  utterance.rate = profile.rate ?? 0.9;
  utterance.pitch = profile.pitch ?? 1;
  window.speechSynthesis.speak(utterance);
}

// Wait until the voice is quiet, or until maxMs.
export function whenQuiet(maxMs = 6000) {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const talking = (player && !player.paused && !player.ended) ||
        ('speechSynthesis' in window && (window.speechSynthesis.speaking || window.speechSynthesis.pending));
      if (!talking || Date.now() - start >= maxMs) resolve();
      else setTimeout(check, 100);
    };
    // Wait a moment, so that a speech that starts now is seen.
    setTimeout(check, 150);
  });
}
