// The service worker: the game works offline after the first visit.
// It keeps a copy of all game files. When the network works, it gets the newest file
// first (so that updates arrive at once); without a network, it uses the copy.

const CACHE = 'tre-v6';
// three.js, the one file from another site, at a fixed version (see the import map in index.html).
const THREE = 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js';

// All game files. A test checks that this list has each file that the site ships.
const FILES = [
  './',
  'LICENSE',
  'art/fx/bubble.svg',
  'art/fx/fire.svg',
  'art/fx/ice.svg',
  'art/fx/shield.svg',
  'art/fx/spark.svg',
  'art/fx/steam.svg',
  'art/fx/water.svg',
  'art/icon-180.png',
  'art/icon-192.png',
  'art/icon-512.png',
  'art/item/bamboo.svg',
  'art/item/coin.svg',
  'art/item/horse-part-body.svg',
  'art/item/horse-part-head.svg',
  'art/item/horse-part-leg.svg',
  'art/item/horse-part-tail.svg',
  'art/item/iron.svg',
  'art/item/ore.svg',
  'art/item/rice.svg',
  'art/logo.svg',
  'art/palette.json',
  'art/paper.svg',
  'art/pattern/clouds.svg',
  'art/pattern/flowers.svg',
  'art/pattern/waves.svg',
  'art/title/bamboo-section.svg',
  'art/title/bamboo-shoot.svg',
  'art/title/bamboo-top.svg',
  'art/ui/back.svg',
  'art/ui/bag.svg',
  'art/ui/check.svg',
  'art/ui/clear.svg',
  'art/ui/close.svg',
  'art/ui/fire.svg',
  'art/ui/friends.svg',
  'art/ui/heart-empty.svg',
  'art/ui/heart.svg',
  'art/ui/hint.svg',
  'art/ui/home.svg',
  'art/ui/lock.svg',
  'art/ui/map.svg',
  'art/ui/menu.svg',
  'art/ui/quest.svg',
  'art/ui/seal.svg',
  'art/ui/speak.svg',
  'art/ui/star.svg',
  'art/ui/water.svg',
  'audio/en/index.json',
  'audio/vi/index.json',
  'content/LICENSE',
  'data/callings.json',
  'data/config/experiments.json',
  'data/config/game.json',
  'data/config/learning.json',
  'data/config/learnlog.json',
  'data/config/limits.json',
  'data/dialogue/giong.json',
  'data/dialogue/prologue.json',
  'data/dialogue/village.json',
  'data/figures.json',
  'data/friends.json',
  'data/geo/vietnam.json',
  'data/hero.json',
  'data/items.json',
  'data/maps/phu-dong.json',
  'data/maps/road-thanglong.json',
  'data/maps/soc-son.json',
  'data/maps/trau-son.json',
  'data/npcs.json',
  'data/questions/science.json',
  'data/quests.json',
  'data/raids.json',
  'data/skills.json',
  'data/tiles.json',
  'data/titles.json',
  'data/trials.json',
  'data/world/blocks.json',
  'data/world/day.json',
  'data/world/life.json',
  'data/world/people.json',
  'data/world/regions.json',
  'data/world/road-events.json',
  'data/world/routes.json',
  'data/world/zones.json',
  'fonts/Alegreya-Bold.woff2',
  'fonts/BeVietnamPro-Bold.woff2',
  'fonts/BeVietnamPro-Regular.woff2',
  'fonts/BeVietnamPro-SemiBold.woff2',
  'fonts/OFL-Alegreya.txt',
  'fonts/OFL-BeVietnamPro.txt',
  'i18n/en.json',
  'i18n/vi.json',
  'index.html',
  'manifest.webmanifest',
  'src/core/codec.js',
  'src/core/conditions.js',
  'src/core/dialogue.js',
  'src/core/events.js',
  'src/core/exam.js',
  'src/core/experiments.js',
  'src/core/fresh.js',
  'src/core/fsm.js',
  'src/core/game.js',
  'src/core/generators.js',
  'src/core/grades.js',
  'src/core/hit.js',
  'src/core/i18n.js',
  'src/core/learner.js',
  'src/core/learnlog.js',
  'src/core/logger.js',
  'src/core/mastery.js',
  'src/core/parentgate.js',
  'src/core/profile.js',
  'src/core/quests.js',
  'src/core/rating.js',
  'src/core/restore.js',
  'src/core/review.js',
  'src/core/rng.js',
  'src/core/save.js',
  'src/core/session.js',
  'src/core/skills.js',
  'src/core/solver.js',
  'src/core/story.js',
  'src/core/tilemap.js',
  'src/core/timelimit.js',
  'src/core/triggers.js',
  'src/core/voices.js',
  'src/core/world/ambient.js',
  'src/core/world/clock.js',
  'src/core/world/env.js',
  'src/core/world/move.js',
  'src/core/world/populate.js',
  'src/core/world/raids.js',
  'src/core/world/save.js',
  'src/core/world/state.js',
  'src/core/world/step.js',
  'src/core/world/systems/clock.js',
  'src/core/world/systems/flock.js',
  'src/core/world/systems/follow.js',
  'src/core/world/systems/ground.js',
  'src/core/world/systems/input.js',
  'src/core/world/systems/joys.js',
  'src/core/world/systems/lights.js',
  'src/core/world/systems/move.js',
  'src/core/world/systems/place.js',
  'src/core/world/systems/push.js',
  'src/core/world/systems/raid.js',
  'src/core/world/systems/react.js',
  'src/core/world/systems/route.js',
  'src/core/world/systems/schedule.js',
  'src/core/world/systems/sky.js',
  'src/core/world/systems/steer.js',
  'src/core/world/systems/work.js',
  'src/core/world/trials.js',
  'src/core/world/zones.js',
  'src/main.js',
  'src/render/ambient3d.js',
  'src/render/assets.js',
  'src/render/figure3d.js',
  'src/render/gl.js',
  'src/render/palette.js',
  'src/render/portrait.js',
  'src/render/voxel.js',
  'src/ui/app.js',
  'src/ui/audio.js',
  'src/ui/create.js',
  'src/ui/data.js',
  'src/ui/dialogue.js',
  'src/ui/dom.js',
  'src/ui/i18n.js',
  'src/ui/modals.js',
  'src/ui/parent.js',
  'src/ui/portraits.js',
  'src/ui/question.js',
  'src/ui/quiz.js',
  'src/ui/raid.js',
  'src/ui/registry.js',
  'src/ui/research.js',
  'src/ui/rest.js',
  'src/ui/speak.js',
  'src/ui/storage.js',
  'src/ui/storybook.js',
  'src/ui/title.js',
  'src/ui/vanmieu.js',
  'src/ui/village.js',
  'src/ui/visuals.js',
  'src/ui/worldmap.js',
  'src/world/animate.js',
  'src/world/chunks.js',
  'src/world/fade.js',
  'src/world/figures.js',
  'src/world/fine.js',
  'src/world/geo.js',
  'src/world/lod.js',
  'src/world/mesher.js',
  'src/world/parts.js',
  'src/world/portraits.js',
  'src/world/props/context.js',
  'src/world/props/houses.js',
  'src/world/props/index.js',
  'src/world/props/plants.js',
  'src/world/props/things.js',
  'src/world/regions.js',
  'src/world/roofs.js',
  'src/world/smooth.js',
  'src/world/sway.js',
  'src/world/terrain.js',
  'src/world/travel.js',
  'src/world/voxel.js',
  'styles/main.css',
  'styles/palette.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll([...FILES.map((f) => new Request(f, { cache: 'reload' })), new Request(THREE, { mode: 'cors' })]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tre-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Wait for the network for some time only. Then use the copy.
function fromNetwork(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(request).then((response) => {
      clearTimeout(timer);
      resolve(response);
    }, (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // three.js never changes at a fixed version: use the copy first.
  if (request.method === 'GET' && request.url === THREE) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const copy = await cache.match(THREE);
      if (copy) return copy;
      const response = await fetch(request);
      if (response.ok) cache.put(THREE, response.clone());
      return response;
    })());
    return;
  }
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fromNetwork(request, 4000);
      if (response.ok && response.type === 'basic') cache.put(request, response.clone());
      return response;
    } catch {
      const copy = await cache.match(request, { ignoreSearch: true });
      if (copy) return copy;
      if (request.mode === 'navigate') {
        const page = await cache.match('index.html');
        if (page) return page;
      }
      return new Response('', { status: 504 });
    }
  })());
});
