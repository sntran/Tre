// A small renderer of the Markdown that the entries of the diary use (docs/devlog/, #40): headings,
// paragraphs, lists (two levels), tables, links, bold, italics, and code in a line. It makes an HTML
// string; all text is escaped. link(href): { href, external } for each link (external: the link opens
// in a new tab). Pure: no DOM.

const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The marks in a line of text: code, links, bold, italics.
export function inline(text, link = (href) => ({ href, external: false })) {
  const kept = [];
  const keep = (html) => `\u0000${kept.push(html) - 1}\u0000`;
  let s = String(text);
  s = s.replace(/`([^`]+)`/g, (all, code) => keep(`<code>${escape(code)}</code>`));
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (all, label, href) => {
    const to = link(href);
    const attrs = to.external ? ' target="_blank" rel="noopener"' : '';
    return keep(`<a href="${escape(to.href)}"${attrs}>${inline(label, link)}</a>`);
  });
  s = escape(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\p{L}\p{N}])\*([^*\s][^*]*?)\*(?![*\p{L}\p{N}])/gu, '$1<em>$2</em>');
  s = s.replace(/(^|[^_\p{L}\p{N}])_([^_\s][^_]*?)_(?![_\p{L}\p{N}])/gu, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (all, i) => kept[Number(i)]);
}

const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
const LIST = /^(\s*)([-*]|\d+\.)\s+(.*)$/;

// The HTML of a Markdown text.
export function markdownToHtml(md, { link } = {}) {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  const md2 = (t) => inline(t, link);
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const head = line.match(/^(#{1,6})\s+(.*)$/);
    if (head) {
      out.push(`<h${head[1].length}>${md2(head[2])}</h${head[1].length}>`);
      i++;
      continue;
    }
    // A table: a line of heads, a line of dashes, then the rows. It scrolls inside its box.
    if (line.trim().startsWith('|') && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] ?? '')) {
      const heads = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(cells(lines[i++]));
      out.push(`<div class="table"><table><thead><tr>${heads.map((c) => `<th>${md2(c)}</th>`).join('')}</tr></thead>`
        + `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${md2(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    // A list: the items, and the items of an item (indented). A line with no mark goes on the item.
    if (LIST.test(line)) {
      const items = [];
      while (i < lines.length && lines[i].trim()) {
        const m = lines[i].match(LIST);
        if (m) items.push({ deep: m[1].length > 0, ordered: /\d/.test(m[2]), text: m[3] });
        else items.at(-1).text += ` ${lines[i].trim()}`;
        i++;
      }
      out.push(list(items, md2));
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^#{1,6}\s/.test(lines[i]) && !LIST.test(lines[i]) && !lines[i].trim().startsWith('|')) para.push(lines[i++].trim());
    out.push(`<p>${md2(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

function list(items, md2) {
  const tag = (ordered) => (ordered ? 'ol' : 'ul');
  let html = `<${tag(items[0].ordered)}>`;
  for (let k = 0; k < items.length; k++) {
    const it = items[k];
    if (it.deep) continue;
    const subs = [];
    for (let j = k + 1; j < items.length && items[j].deep; j++) subs.push(items[j]);
    html += `<li>${md2(it.text)}${subs.length ? `<${tag(subs[0].ordered)}>${subs.map((s) => `<li>${md2(s.text)}</li>`).join('')}</${tag(subs[0].ordered)}>` : ''}</li>`;
  }
  return `${html}</${tag(items[0].ordered)}>`;
}
