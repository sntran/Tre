// Small helpers to build the DOM.

// h('div', { class: 'x', onclick: fn }, [children...])
export function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function img(path, cls = '', alt = '') {
  return h('img', { src: `art/${path}.svg`, class: cls, alt, draggable: 'false' });
}

// A button that reacts on pointer up (fast on touch screens).
export function button(label, onPress, { cls = 'btn', icon = null, aria = null, disabled = false } = {}) {
  const el = h('button', { class: cls, type: 'button', 'aria-label': aria, title: aria, disabled }, [
    icon ? img(icon, 'btn-icon') : null,
    label ? h('span', { class: 'btn-label', text: label }) : null,
  ]);
  el.addEventListener('click', (e) => {
    e.preventDefault();
    if (!el.disabled) onPress(e);
  });
  return el;
}

export function clear(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}

// Wait some milliseconds.
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
