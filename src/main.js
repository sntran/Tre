// Start the game.
import { startApp } from './ui/app.js';
import './ui/modals.js';
import './ui/battle.js';
import './ui/craft.js';
import './ui/vanmieu.js';
import './ui/parent.js';

startApp(document.getElementById('app'));

// Offline play: register the service worker (only on http and https).
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker', e));
  });
}
