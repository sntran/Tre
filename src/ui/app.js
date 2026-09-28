// The app: load the text and show the first screen.
import { setLanguage, t } from './i18n.js';
import { loadRecordedKeys, speak } from './speak.js';

export async function startApp(root) {
  await setLanguage('vi');
  await loadRecordedKeys('vi');
  const ui = root.querySelector('#ui');
  ui.innerHTML = '';
  const title = document.createElement('h1');
  title.textContent = t('app.name');
  const tagline = document.createElement('p');
  tagline.textContent = t('app.tagline');
  tagline.addEventListener('pointerup', () => speak('app.tagline'));
  ui.append(title, tagline);
}
