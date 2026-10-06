// The diary of the making of Tre (docs/devlog/, #40): the entries of the index, the file of an entry
// in a language, and where each link of an entry goes on the site. Pure: no DOM.

export const DEVLOG = 'docs/devlog/';
// The files of the repository that the site does not show open on GitHub.
export const REPO = 'https://github.com/sntran/Tre/blob/main/';
const ENTRY = /^(\d{4}-\d{2}-\d{2}-[a-z0-9-]+?)(\.vi)?\.md$/;

// The file of the index or of an entry in a language (en or vi). name: null for the index.
export function fileOf(name, lang) {
  const suffix = lang === 'vi' ? '.vi.md' : '.md';
  return `${DEVLOG}${name ?? 'README'}${suffix}`;
}

// The entries of an index (the table "Date | Entry", newest first): [{ date, title, name }].
export function entriesOf(index) {
  const out = [];
  for (const line of String(index).split('\n')) {
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*$/);
    const e = m && m[3].match(ENTRY);
    if (e) out.push({ date: m[1], title: m[2], name: e[1], lang: e[2] ? 'vi' : 'en' });
  }
  return out;
}

// The address of the page of the diary for an entry (null: the index) in a language.
export const pageOf = (name, lang) => `diary.html?${name ? `entry=${name}&` : ''}lang=${lang}`;

// Where a link of an entry goes: { href, external }. A source (http or https) opens in a new tab; a
// link to another entry or to the index opens the page of the diary; a link to another file of the
// repository (docs/research/, docs/DESIGN.md) opens the file on GitHub in a new tab.
export function diaryLink(href) {
  if (/^https?:\/\//.test(href)) return { href, external: true };
  const file = href.split('#')[0];
  const entry = file.match(ENTRY);
  if (entry) return { href: pageOf(entry[1], entry[2] ? 'vi' : 'en'), external: false };
  const index = file.match(/^README(\.vi)?\.md$/);
  if (index) return { href: pageOf(null, index[1] ? 'vi' : 'en'), external: false };
  return { href: REPO + resolve(DEVLOG, href), external: true };
}

// The Markdown without the line that is only the link to the same page in the other language (as
// "*[English](README.md)*"): the page has its own switch at the top, and the link shows two times (#45).
export function withoutLanguageLine(md, lang) {
  const lines = String(md).split('\n');
  const at = lines.findIndex((line) => {
    const m = line.trim().match(/^([*_]?)\[[^\]]+\]\(([^)#]+)\)\1$/);
    const file = m && m[2].match(/^(README|\d{4}-\d{2}-\d{2}-[a-z0-9-]+?)(\.vi)?\.md$/);
    return file && (file[2] ? 'vi' : 'en') !== lang;
  });
  if (at < 0) return md;
  lines.splice(at, lines[at + 1]?.trim() === '' ? 2 : 1);
  return lines.join('\n');
}

// A path relative to a folder ("../research/x.md" from "docs/devlog/" is "docs/research/x.md").
function resolve(dir, rel) {
  const parts = dir.split('/').filter(Boolean);
  for (const p of rel.split('/')) {
    if (p === '..') parts.pop();
    else if (p !== '.') parts.push(p);
  }
  return parts.join('/');
}
