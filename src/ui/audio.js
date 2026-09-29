import { unlockSpeech } from './speak.js';

// Sound with the Web Audio API: short sound effects and simple music.
// The sounds are made in code, so the game needs no sound files.
// The music uses a five-note scale, like the sáo trúc (bamboo flute) and the trống (drum).

let ac = null;
let master = null;
let musicGain = null;
let soundOn = true;
let musicOn = true;
let musicTimer = null;
let musicStep = 0;
let musicMode = null;

function audio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.5;
    master.connect(ac.destination);
    musicGain = ac.createGain();
    musicGain.gain.value = 0.18;
    musicGain.connect(master);
  }
  return ac;
}

// Browsers start sound only after a tap.
export function unlockAudio() {
  const a = audio();
  // Safari can also be in the state 'interrupted' after the app was in the background.
  if (a && a.state !== 'running') a.resume().catch(() => {});
}

function tone(freq, start, length, { type = 'sine', volume = 0.3, glide = null, dest = null } = {}) {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (glide) osc.frequency.exponentialRampToValueAtTime(glide, start + length);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(g).connect(dest ?? master);
  osc.start(start);
  osc.stop(start + length + 0.05);
}

function noise(start, length, { volume = 0.3, filter = 1200, q = 1, sweep = null, dest = null } = {}) {
  const a = audio();
  if (!a) return;
  const size = Math.floor(a.sampleRate * length);
  const buffer = a.createBuffer(1, size, a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buffer;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(filter, start);
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, start + length);
  f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(volume, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + length);
  src.connect(f).connect(g).connect(dest ?? master);
  src.start(start);
}

const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

const SOUNDS = {
  tap: (t) => tone(880, t, 0.05, { volume: 0.08 }),
  correct: (t) => { tone(PENTA[0], t, 0.12); tone(PENTA[3], t + 0.1, 0.25); },
  wrong: (t) => tone(220, t, 0.3, { type: 'triangle', volume: 0.2, glide: 170 }),
  hit: (t) => { noise(t, 0.12, { volume: 0.4, filter: 900 }); tone(120, t, 0.18, { volume: 0.4, glide: 60 }); },
  shield: (t) => { tone(1200, t, 0.08, { type: 'square', volume: 0.08 }); noise(t, 0.2, { volume: 0.25, filter: 3000 }); },
  fire: (t) => noise(t, 0.5, { volume: 0.4, filter: 400, sweep: 2400, q: 0.7 }),
  water: (t) => { for (let i = 0; i < 4; i++) tone(500 + i * 120, t + i * 0.06, 0.08, { volume: 0.15, glide: 900 + i * 100 }); },
  steam: (t) => noise(t, 0.8, { volume: 0.25, filter: 5000, sweep: 1500, q: 0.5 }),
  drum: (t) => { for (let i = 0; i < 3; i++) tone(90, t + i * 0.45, 0.4, { volume: 0.6, glide: 45 }); },
  pickup: (t) => { tone(PENTA[2], t, 0.1); tone(PENTA[4], t + 0.08, 0.2); },
  win: (t) => PENTA.forEach((f, i) => tone(f, t + i * 0.12, 0.3, { volume: 0.25 })),
  lose: (t) => [PENTA[3], PENTA[2], PENTA[0]].forEach((f, i) => tone(f / 2, t + i * 0.2, 0.35, { type: 'triangle', volume: 0.2 })),
  hurt: (t) => tone(300, t, 0.2, { type: 'sawtooth', volume: 0.1, glide: 150 }),
  retreat: (t) => [4, 3, 2].forEach((n, i) => tone(PENTA[n], t + i * 0.1, 0.15, { volume: 0.15 })),
  title: (t) => { tone(PENTA[0], t, 0.3); tone(PENTA[3], t + 0.2, 0.5); },
  // The world.
  'step-grass': (t) => noise(t, 0.07, { volume: 0.07, filter: 1400, q: 0.8 }),
  'step-wood': (t) => { tone(180, t, 0.06, { type: 'triangle', volume: 0.1, glide: 140 }); noise(t, 0.04, { volume: 0.05, filter: 900 }); },
  'step-water': (t) => noise(t, 0.16, { volume: 0.1, filter: 700, sweep: 2200, q: 1.5 }),
  cluck: (t) => { for (let i = 0; i < 3; i++) tone(620 + i * 40, t + i * 0.09, 0.06, { type: 'square', volume: 0.05, glide: 420 }); },
  quack: (t) => { tone(330, t, 0.12, { type: 'sawtooth', volume: 0.06, glide: 260 }); tone(330, t + 0.18, 0.1, { type: 'sawtooth', volume: 0.05, glide: 250 }); },
  bark: (t) => { tone(260, t, 0.09, { type: 'sawtooth', volume: 0.08, glide: 180 }); tone(260, t + 0.16, 0.09, { type: 'sawtooth', volume: 0.08, glide: 170 }); },
  moo: (t) => tone(140, t, 0.6, { type: 'triangle', volume: 0.18, glide: 110 }),
  pot: (t) => { noise(t, 0.25, { volume: 0.35, filter: 2500, q: 0.6 }); tone(700, t, 0.08, { type: 'triangle', volume: 0.12, glide: 300 }); },
  rustle: (t) => noise(t, 0.3, { volume: 0.08, filter: 3500, sweep: 2000, q: 0.5 }),
  greet: (t) => { tone(PENTA[1], t, 0.12, { volume: 0.08 }); tone(PENTA[3], t + 0.12, 0.16, { volume: 0.08 }); },
  // Soft sounds from inside a house at night, and a sigh for a new pot.
  cough: (t) => { noise(t, 0.12, { volume: 0.12, filter: 500, q: 1.2 }); noise(t + 0.2, 0.1, { volume: 0.09, filter: 450, q: 1.2 }); },
  baby: (t) => tone(520, t, 0.5, { type: 'triangle', volume: 0.05, glide: 640 }),
  clatter: (t) => { for (let i = 0; i < 3; i++) tone(900 - i * 120, t + i * 0.07, 0.06, { type: 'triangle', volume: 0.06 }); },
  sigh: (t) => noise(t, 0.7, { volume: 0.1, filter: 700, sweep: 350, q: 0.7 }),
  lantern: (t) => [3, 4, 5].forEach((n, i) => tone(PENTA[n] * 2, t + i * 0.15, 0.5, { volume: 0.05 })),
  // The planks of the bridge: a knock of wood when the hero takes one or puts one down, a creak
  // when a plank wobbles or tips, a splash in the river, and a crack when the rain breaks the bridge.
  'plank-up': (t) => tone(300, t, 0.06, { type: 'triangle', volume: 0.12, glide: 360 }),
  'plank-down': (t) => { tone(180, t, 0.08, { type: 'triangle', volume: 0.2, glide: 120 }); noise(t, 0.06, { volume: 0.12, filter: 900 }); },
  creak: (t) => tone(210, t, 0.5, { type: 'sawtooth', volume: 0.05, glide: 150 }),
  splash: (t) => { noise(t, 0.45, { volume: 0.35, filter: 1800, sweep: 500, q: 0.6 }); tone(420, t, 0.12, { volume: 0.08, glide: 900 }); },
  crack: (t) => { noise(t, 0.12, { volume: 0.4, filter: 2500, q: 0.8 }); tone(160, t + 0.05, 0.3, { type: 'sawtooth', volume: 0.08, glide: 80 }); },
};

// The sound of the place: insects by day, frogs by night, and the rain. Three quiet loops.
let amb = null;
function ambience() {
  const a = audio();
  if (!a) return null;
  if (amb) return amb;
  const loop = (filterType, freq, q) => {
    const size = a.sampleRate * 2;
    const buffer = a.createBuffer(1, size, a.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const f = a.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = a.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(master);
    src.start();
    return g;
  };
  const insects = loop('bandpass', 4800, 6);
  // Insects sing in pulses.
  const lfo = a.createOscillator();
  const depth = a.createGain();
  lfo.frequency.value = 7;
  depth.gain.value = 0.5;
  const pulse = a.createGain();
  pulse.gain.value = 0.5;
  lfo.connect(depth).connect(pulse.gain);
  lfo.start();
  insects.disconnect();
  insects.connect(pulse).connect(master);
  amb = { insects, rain: loop('lowpass', 900, 0.5), frogs: 0, timer: null, level: { day: 0, night: 0, rain: 0 } };
  return amb;
}

// level: { day, night, rain } from 0 to 1, or null for silence (away from the world).
export function setAmbience(level) {
  const a = audio();
  if (!a || a.state !== 'running') return;
  const x = ambience();
  if (!x) return;
  const on = soundOn && level;
  const t = a.currentTime;
  x.insects.gain.setTargetAtTime(on ? 0.03 * level.day : 0, t, 0.5);
  x.rain.gain.setTargetAtTime(on ? 0.12 * level.rain : 0, t, 0.5);
  x.level = on ? level : { day: 0, night: 0, rain: 0 };
  // Frogs croak now and then at night.
  if (on && level.night > 0.5 && !x.timer) {
    const croak = () => {
      x.timer = null;
      if (x.level.night <= 0.5) return;
      const c = audio().currentTime + 0.02;
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) tone(110 + Math.random() * 40, c + i * 0.18, 0.12, { type: 'square', volume: 0.04 * x.level.night, glide: 80 });
      x.timer = setTimeout(croak, 700 + Math.random() * 1800);
    };
    x.timer = setTimeout(croak, 300);
  }
}

export function play(name) {
  if (!soundOn) return;
  const a = audio();
  if (!a || a.state !== 'running') return;
  SOUNDS[name]?.(a.currentTime + 0.01);
}

// Simple music: a flute line and a drum. mode: 'village' or 'battle'.
const MELODY = {
  village: [0, 2, 3, 2, 4, 3, 2, 0, 1, 2, 0, -1, 0, 2, 3, 4, 3, 2, 1, 0, -1, -1, 0, -1],
  battle: [0, 0, 3, 3, 4, 3, 2, 0, 0, 0, 3, 4, 5, 4, 3, 2],
};

function musicTick() {
  const a = audio();
  if (!musicOn || !musicMode) return;
  const beat = musicMode === 'battle' ? 0.22 : 0.42;
  if (!a || a.state !== 'running') {
    // Wait until a tap starts the sound.
    clearTimeout(musicTimer);
    musicTimer = setTimeout(musicTick, 500);
    return;
  }
  const line = MELODY[musicMode];
  const t = a.currentTime + 0.05;
  const note = line[musicStep % line.length];
  if (note >= 0) {
    // A soft flute tone with a little vibrato.
    const osc = a.createOscillator();
    const lfo = a.createOscillator();
    const lfoGain = a.createGain();
    const g = a.createGain();
    osc.type = 'sine';
    osc.frequency.value = PENTA[note];
    lfo.frequency.value = 5;
    lfoGain.gain.value = 6;
    lfo.connect(lfoGain).connect(osc.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + beat * 1.8);
    osc.connect(g).connect(musicGain);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + beat * 2);
    lfo.stop(t + beat * 2);
  }
  if (musicStep % 4 === 0) tone(80, t, 0.3, { volume: 0.5, glide: 50, dest: musicGain });
  musicStep += 1;
  clearTimeout(musicTimer);
  musicTimer = setTimeout(musicTick, beat * 1000);
}

export function setMusic(mode) {
  if (mode === musicMode) return;
  musicMode = mode;
  musicStep = 0;
  clearTimeout(musicTimer);
  if (mode && musicOn) musicTimer = setTimeout(musicTick, 200);
}

export function setSoundOptions({ sound, music }) {
  soundOn = sound;
  musicOn = music;
  if (!musicOn) clearTimeout(musicTimer);
  else if (musicMode) {
    clearTimeout(musicTimer);
    musicTimer = setTimeout(musicTick, 200);
  }
}

// Connect sounds to the event bus.
export function connectAudio(bus) {
  bus.on('sound', play);
  bus.on('settings', (s) => setSoundOptions(s));
  bus.on('scene', (name) => {
    setMusic(name === 'village' ? 'village' : name === 'battle' ? 'battle' : null);
    if (name !== 'village') setAmbience(null);
  });
  bus.on('ambience', setAmbience);
  // iOS starts sound only in a tap that ends (touchend, pointerup, or click).
  const unlock = () => {
    unlockAudio();
    unlockSpeech();
  };
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
    window.addEventListener(type, unlock, { passive: true });
  }
}
