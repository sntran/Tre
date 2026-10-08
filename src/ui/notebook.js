// The notebook (Sổ tay, #8): the pages of prints (src/core/notebook.js). The child opens it from the
// menu, or with a tap on the card of a new print; the parent area shows the same notebook.
import { registerModal } from './registry.js';
import { h, img, button } from './dom.js';
import { t } from './i18n.js';
import { speak } from './speak.js';
import { portraitCanvas } from './portraits.js';
import { notebookOf, notebookCount } from '../core/notebook.js';

// The picture of a skill by its subject, and of a place.
const SUBJECT_ART = { math: 'ui/chalk', sci: 'ui/water', hist: 'ui/seal' };

// The print of an entry: the figure of its look, the picture of a place, or of a subject.
export function printOf(ctx, entry, size = 64) {
  if (entry.look && ctx.data.figures.figures[entry.look]) return portraitCanvas(ctx, ctx.data.figures.figures[entry.look], { framing: 'bust', size });
  if (entry.kind === 'place') return img('ui/map', 'note-art');
  return img(SUBJECT_ART[entry.subject] ?? 'ui/hint', 'note-art');
}

// The pages of the notebook of a profile, as one element. A print that the child did not meet is a
// gap with its place on the page (the child sees what is still to find); a tap on a print says its
// name.
export function notebookGrid(ctx, profile, { speakOnTap = true } = {}) {
  const list = notebookOf(ctx.data.notebook, ctx.data.skills.skills, profile);
  const pages = [];
  for (const kind of ctx.data.notebook.kinds) {
    const cards = list.filter((e) => e.kind === kind).map((e) => {
      const card = h(e.met ? 'button' : 'div', { class: `note-card${e.met ? '' : ' gap'}${e.sealed ? ' sealed' : ''}`, ...(e.met ? { type: 'button' } : {}), dataset: { id: e.id } }, [
        h('span', { class: 'note-print' }, e.met ? [printOf(ctx, e)] : []),
        h('span', { class: 'note-name', text: e.met ? t(e.titleKey) : t('note.unknown') }),
        e.sealed ? img('ui/seal', 'note-seal') : null,
      ]);
      if (e.met && speakOnTap) card.addEventListener('click', () => speak(e.titleKey, {}, { force: true }));
      return card;
    });
    if (cards.length) pages.push(h('section', { class: 'note-page' }, [h('h3', { text: t(`note.${kind}`) }), h('div', { class: 'note-grid' }, cards)]));
  }
  const c = notebookCount(list);
  return h('div', { class: 'notebook' }, [h('p', { class: 'note-count', text: t('parent.notebook.count', c) }), ...pages]);
}

registerModal('notebook', (ctx) => new Promise((resolve) => {
  const layer = h('div', { class: 'modal-layer' });
  const close = () => { layer.remove(); resolve(); };
  ctx.log?.('action', { kind: 'notebook' });
  layer.append(h('div', { class: 'panel notebook-panel' }, [
    h('div', { class: 'panel-head' }, [h('h2', { text: t('note.title') }), button(null, close, { cls: 'icon-btn', icon: 'ui/close', aria: t('ui.close') })]),
    notebookGrid(ctx, ctx.profile),
  ]));
  layer.addEventListener('click', (e) => { if (e.target === layer) close(); });
  ctx.ui.append(layer);
  speak('note.title', {}, { force: true });
}));
