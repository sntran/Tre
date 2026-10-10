// The notebook (Sổ tay, #8): the pages of prints (src/core/notebook.js). The child opens it from the
// menu, or with a tap on the card of a new print; the parent area shows the same notebook.
import { registerModal } from './registry.js';
import { h, img, button } from './dom.js';
import { t, tn } from './i18n.js';
import { speak } from './speak.js';
import { portraitCanvas } from './portraits.js';
import { notebookOf, notebookCount, printArt, sentSkills } from '../core/notebook.js';

// The print of an entry: the figure of its look, the picture of a place, or of a subject.
export function printOf(ctx, entry, size = 64) {
  if (entry.look && ctx.data.figures.figures[entry.look]) return portraitCanvas(ctx, ctx.data.figures.figures[entry.look], { framing: 'bust', size });
  return img(printArt(entry), 'note-art');
}

// The pages of the notebook of a profile, as one element. A print that the child did not meet is a
// gap with its place on the page (the child sees what is still to find); a tap on a print says its
// name. curriculum: the parent area shows the name of the curriculum of a skill under the name that
// the child knows (#77).
export function notebookGrid(ctx, profile, { speakOnTap = true, curriculum = false } = {}) {
  const list = notebookOf(ctx.data.notebook, ctx.data.skills.skills, profile, sentSkills(ctx.data.trials ?? {}));
  const pages = [];
  // The pages in the order of the list (a page with a print first).
  for (const kind of [...new Set(list.map((e) => e.kind))]) {
    const cards = list.filter((e) => e.kind === kind).map((e) => {
      const card = h(e.met ? 'button' : 'div', { class: `note-card${e.met ? '' : ' gap'}${e.sealed ? ' sealed' : ''}`, ...(e.met ? { type: 'button' } : {}), dataset: { id: e.id } }, [
        h('span', { class: 'note-print' }, e.met ? [printOf(ctx, e)] : []),
        h('span', { class: 'note-name', text: e.met ? tn(e.titleKey) : t('note.unknown') }),
        curriculum && e.skillKey && e.skillKey !== e.titleKey ? h('span', { class: 'note-skill', text: t(e.skillKey) }) : null,
        e.sealed ? img('ui/seal', 'note-seal') : null,
      ]);
      if (e.met && speakOnTap) card.addEventListener('click', () => speak(e.titleKey, {}, { force: true }));
      return card;
    });
    // The count of each page with its name (#67), so that the child sees where the prints are.
    const n = notebookCount(list.filter((e) => e.kind === kind));
    if (cards.length) pages.push(h('section', { class: 'note-page' }, [h('h3', {}, [t(`note.${kind}`), h('span', { class: 'note-page-count', text: t('note.pageCount', n) })]), h('div', { class: 'note-grid' }, cards)]));
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
