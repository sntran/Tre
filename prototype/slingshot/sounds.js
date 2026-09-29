// The sounds of the slingshot prototype, made with the Web Audio API through the game sound module.
import { addSounds } from '../../src/ui/audio.js';

addSounds({
  // The band stretches: a low creak that rises.
  'sling.pull': (t, { tone }) => tone(160, t, 0.25, { type: 'triangle', volume: 0.08, glide: 260 }),
  // The band snaps.
  'sling.release': (t, { tone, noise }) => { noise(t, 0.06, { volume: 0.35, filter: 2500 }); tone(420, t, 0.08, { type: 'square', volume: 0.06, glide: 180 }); },
  // The stone cuts the air.
  'sling.fly': (t, { noise }) => noise(t, 0.45, { volume: 0.12, filter: 1800, sweep: 900, q: 2 }),
  // The stone hits a shield: a crack.
  'sling.hit': (t, { tone, noise }) => { noise(t, 0.09, { volume: 0.5, filter: 3200, q: 0.8 }); tone(140, t, 0.16, { volume: 0.35, glide: 70 }); },
  // The stone falls in the dust: a dull thud.
  'sling.miss': (t, { tone, noise }) => { tone(110, t, 0.15, { volume: 0.25, glide: 80 }); noise(t, 0.2, { volume: 0.15, filter: 500 }); },
  // One stone, two enemies: the drum.
  'sling.combo': (t, { tone, PENTA }) => {
    for (let i = 0; i < 3; i++) tone(95, t + i * 0.12, 0.3, { volume: 0.6, glide: 50 });
    tone(PENTA[3], t + 0.36, 0.3, { volume: 0.2 });
  },
  // The bamboo shield: a thump.
  'sling.guard': (t, { tone, noise }) => { tone(85, t, 0.14, { volume: 0.55, glide: 55 }); noise(t, 0.05, { volume: 0.2, filter: 700 }); },
  // An enemy throws: a short whoosh down.
  'sling.throw': (t, { noise }) => noise(t, 0.3, { volume: 0.18, filter: 1200, sweep: 2400, q: 1.5 }),
  // The hero is hurt.
  'sling.hurt': (t, { tone }) => tone(300, t, 0.2, { type: 'sawtooth', volume: 0.1, glide: 150 }),
  // Nghé charges.
  'sling.nghe': (t, { tone, noise }) => { for (let i = 0; i < 4; i++) tone(70, t + i * 0.1, 0.1, { volume: 0.4, glide: 55 }); noise(t + 0.4, 0.3, { volume: 0.2, filter: 600 }); },
  // Nghé stamps the ground.
  'sling.stamp': (t, { tone }) => { tone(75, t, 0.12, { volume: 0.5, glide: 50 }); tone(75, t + 0.25, 0.12, { volume: 0.5, glide: 50 }); },
  'sling.win': (t, { tone, PENTA }) => PENTA.forEach((f, i) => tone(f, t + i * 0.1, 0.3, { volume: 0.25 })),
  'sling.loss': (t, { tone, PENTA }) => [PENTA[3], PENTA[2], PENTA[0]].forEach((f, i) => tone(f / 2, t + i * 0.22, 0.4, { type: 'triangle', volume: 0.2 })),
});
