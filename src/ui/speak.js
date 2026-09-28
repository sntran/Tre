// Voice. speak(key) plays a recorded file from audio/<lang>/ when it exists.
// If no file exists, it uses the Web Speech API.
import { lang, say } from './i18n.js';

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

function pickVoice(code) {
  const tag = code === 'vi' ? 'vi' : 'en';
  return voices.find((v) => v.lang?.toLowerCase().startsWith(tag) && v.localService) ??
    voices.find((v) => v.lang?.toLowerCase().startsWith(tag)) ?? null;
}

// Speak a text key. Params are only for the synthetic voice:
// a recorded file is used only for a key with no params.
export function speak(key, params = null, { force = false } = {}) {
  if (!enabled && !force) return;
  stop();
  const code = lang();
  const hasParams = params && Object.keys(params).length > 0;
  if (!hasParams && recorded[code]?.has(key)) {
    player = new Audio(`audio/${code}/${key}.mp3`);
    player.play().catch(() => speakText(say(key, params), code));
    return;
  }
  speakText(say(key, params), code);
}

export function speakText(text, code = lang()) {
  if (!('speechSynthesis' in window) || !text) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = code === 'vi' ? 'vi-VN' : 'en-US';
  const voice = pickVoice(code);
  if (voice) utterance.voice = voice;
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}
