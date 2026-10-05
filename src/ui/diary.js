// The page of the diary of the making of Tre (diary.html, #40): the index or one entry of
// docs/devlog/, in the language of the game, with a switch to the other language. The Markdown of
// the entries becomes HTML with src/core/markdown.js; src/core/diary.js tells where each link goes.
import { markdownToHtml } from '../core/markdown.js';
import { entriesOf, fileOf, pageOf, diaryLink } from '../core/diary.js';
import { setLanguage, t } from './i18n.js';
import { getMeta } from './storage.js';
import { h } from './dom.js';

const text = async (path) => {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.text();
};

// The language: the address first, then the language of the game, then the language of the browser.
async function languageOf(query) {
  const asked = query.get('lang');
  if (asked === 'vi' || asked === 'en') return asked;
  const saved = await getMeta('lang').catch(() => null);
  if (saved === 'vi' || saved === 'en') return saved;
  return navigator.language?.toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

async function start() {
  const query = new URLSearchParams(location.search);
  const lang = await languageOf(query);
  await setLanguage(lang);
  document.title = t('diary.title');
  const other = lang === 'vi' ? 'en' : 'vi';
  const name = /^[0-9a-z-]+$/.test(query.get('entry') ?? '') ? query.get('entry') : null;
  const main = document.getElementById('diary');
  const top = h('nav', { class: 'diary-top' }, [
    h('a', { class: 'diary-home', href: pageOf(null, lang), text: t('diary.title') }),
    h('a', { class: 'diary-lang', href: pageOf(name, other), lang: other, text: t(`lang.${other}`) }),
  ]);
  const body = h('article', { class: 'diary-entry' });
  main.replaceChildren(top, body);
  try {
    const [md, index] = await Promise.all([text(fileOf(name, lang)), name ? text(fileOf(null, lang)) : null]);
    body.innerHTML = markdownToHtml(md, { link: diaryLink });
    if (name) document.title = `${body.querySelector('h1')?.textContent ?? ''} · ${t('diary.title')}`;
    if (name) main.append(steps(entriesOf(index), name, lang));
  } catch (e) {
    console.warn('Diary', e);
    body.replaceChildren(h('p', { text: t('diary.failed') }));
  }
  main.append(h('p', { class: 'diary-game' }, [h('a', { href: './', text: t('diary.game') })]));
}

// The links to the newer entry, to the list, and to the older entry.
function steps(entries, name, lang) {
  const at = entries.findIndex((e) => e.name === name);
  const link = (e, key, cls) => (e ? h('a', { class: cls, href: pageOf(e.name, lang), text: t(key) }) : h('span'));
  return h('nav', { class: 'diary-steps' }, [
    link(entries[at - 1], 'diary.newer', 'newer'),
    h('a', { href: pageOf(null, lang), text: t('diary.all') }),
    link(at >= 0 ? entries[at + 1] : null, 'diary.older', 'older'),
  ]);
}

start();
