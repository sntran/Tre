// The diary of the making of Tre (#40): the entries of docs/devlog/, their index, their links, and
// the page that shows them (src/core/markdown.js, src/core/diary.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { markdownToHtml, inline } from '../src/core/markdown.js';
import { entriesOf, fileOf, pageOf, diaryLink, withoutLanguageLine, REPO } from '../src/core/diary.js';

const DIR = 'docs/devlog/';
const read = (f) => readFileSync(f, 'utf8');
const names = [...new Set(readdirSync(DIR).filter((f) => /^\d{4}-/.test(f)).map((f) => f.replace(/(\.vi)?\.md$/, '')))].sort();
const LANGS = ['en', 'vi'];
const PARTS = { en: ['What we found', 'What we decided'], vi: ['Điều chúng tôi tìm thấy', 'Điều chúng tôi quyết định'] };
// The two old sources of the research that have no https address.
const HTTP = new Set([
  'http://psychnet.wustl.edu/memory/wp-content/uploads/2018/04/Butler-et-al-2009_PsychSci.pdf',
  'http://thenhier.ca/en/node/312.html',
]);
const linksOf = (md) => [...md.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)].map((m) => m[1]);

test('each entry has a file in English and a file in Vietnamese, and the index of each language lists every entry, newest first', () => {
  assert.ok(names.length >= 23, `${names.length} entries`);
  for (const n of names) for (const lang of LANGS) assert.ok(existsSync(fileOf(n, lang)), fileOf(n, lang));
  for (const lang of LANGS) {
    const list = entriesOf(read(fileOf(null, lang)));
    assert.deepEqual(list.map((e) => e.name).sort(), names, lang);
    assert.ok(list.every((e) => e.lang === lang), `${lang}: every link of the index is in its language`);
    const dates = list.map((e) => e.name.slice(0, 10));
    assert.deepEqual(dates, [...dates].sort().reverse(), `${lang}: newest first`);
  }
});

test('each entry has the three parts: the question in the first paragraph, what we found, and what we decided', () => {
  for (const n of names) for (const lang of LANGS) {
    const md = read(fileOf(n, lang));
    const blocks = md.split(/\n\s*\n/).map((b) => b.trim());
    assert.match(blocks[0], /^# /, `${n} ${lang}: a title`);
    // The question: the first paragraph after the title and the line of the date, before the parts.
    const first = blocks.slice(1).find((b) => !/^\*.*\*$/.test(b));
    assert.ok(first && !first.startsWith('#') && !first.startsWith('-') && first.length > 80, `${n} ${lang}: the question`);
    const heads = [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
    for (const part of PARTS[lang]) assert.ok(heads.includes(part), `${n} ${lang}: ${part}`);
    assert.ok(heads.indexOf(PARTS[lang][0]) < heads.indexOf(PARTS[lang][1]), `${n} ${lang}: the order of the parts`);
  }
});

test('every link to a source is an absolute address, and every link to another entry goes to a file that exists, in the same language', () => {
  for (const file of readdirSync(DIR).filter((f) => f.endsWith('.md'))) {
    const vi = file.endsWith('.vi.md');
    for (const href of linksOf(read(DIR + file))) {
      if (/^https?:/.test(href)) {
        assert.ok(href.startsWith('https://') || HTTP.has(href), `${file}: ${href}`);
        continue;
      }
      const path = href.split('#')[0];
      assert.ok(existsSync(DIR + path), `${file}: ${href} is not a file`);
      if (!path.startsWith('../') && !/^(\d{4}-.+|README)\.md$/.test(path) && !/\.vi\.md$/.test(path)) assert.fail(`${file}: ${href}`);
      // The link at the top of an entry goes to the other language; every other link stays in its language.
      const top = read(DIR + file).split('\n').slice(0, 4).join('\n').includes(`](${href})`);
      if (!top && !path.startsWith('../')) assert.equal(path.endsWith('.vi.md'), vi, `${file}: ${href} in the other language`);
    }
  }
});

test('the links of the page: a source opens in a new tab, an entry and the index open the page of the diary, another file of the repository opens on GitHub', () => {
  assert.deepEqual(diaryLink('https://example.org/a'), { href: 'https://example.org/a', external: true });
  assert.deepEqual(diaryLink('2026-10-05-names-in-the-north.vi.md'), { href: 'diary.html?entry=2026-10-05-names-in-the-north&lang=vi', external: false });
  assert.deepEqual(diaryLink('2026-10-05-names-in-the-north.md'), { href: 'diary.html?entry=2026-10-05-names-in-the-north&lang=en', external: false });
  assert.deepEqual(diaryLink('README.vi.md'), { href: 'diary.html?lang=vi', external: false });
  assert.deepEqual(diaryLink('../research/learning-by-doing.md'), { href: `${REPO}docs/research/learning-by-doing.md`, external: true });
  assert.equal(pageOf(null, 'en'), 'diary.html?lang=en');
  assert.equal(fileOf('2026-09-28-every-hero-starts-small', 'vi'), 'docs/devlog/2026-09-28-every-hero-starts-small.vi.md');
});

test('the renderer: headings, lists in two levels, tables in a box, links, bold, italics, code, and escaped text', () => {
  const html = markdownToHtml('# A <b>\n\n*5 Oct · [English](x.md)*\n\nOne\ntwo **bold** and `a*b*c`.\n\n- one\n  - deep\n- two\n\n1. first\n2. second\n\n| A | B |\n| --- | --- |\n| [s](https://s.org) | _i_ |', { link: (href) => ({ href, external: href.startsWith('https') }) });
  assert.equal(html, [
    '<h1>A &lt;b&gt;</h1>',
    '<p><em>5 Oct · <a href="x.md">English</a></em></p>',
    '<p>One two <strong>bold</strong> and <code>a*b*c</code>.</p>',
    '<ul><li>one<ul><li>deep</li></ul></li><li>two</li></ul>',
    '<ol><li>first</li><li>second</li></ol>',
    '<div class="table"><table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td><a href="https://s.org" target="_blank" rel="noopener">s</a></td><td><em>i</em></td></tr></tbody></table></div>',
  ].join('\n'));
  assert.equal(inline('a_b_c and snake_case'), 'a_b_c and snake_case', 'no italics inside a word');
});

test('each entry and each index becomes HTML with no Markdown marks left', () => {
  for (const file of readdirSync(DIR).filter((f) => f.endsWith('.md'))) {
    const html = markdownToHtml(read(DIR + file), { link: diaryLink });
    const words = html.replace(/<code>[^<]*<\/code>/g, '').replace(/<[^>]+>/g, '');
    for (const mark of ['**', '](', '|', '`', '\n# ', '\n## ', '\n- ']) assert.ok(!words.includes(mark), `${file}: ${mark}`);
    assert.doesNotMatch(words, /(^|\s)\*\S|\S\*(\s|$)|^#/, file);
    for (const [, href] of html.matchAll(/href="([^"]+)"/g)) assert.ok(!href.endsWith('.md') || href.startsWith(REPO), `${file}: ${href} is a Markdown file of the site`);
  }
});

test('the page shows the link to the other language one time: the line of the index that is only that link goes (#45)', () => {
  for (const lang of ['en', 'vi']) {
    const md = readFileSync(fileOf(null, lang), 'utf8');
    const other = lang === 'vi' ? 'README.md' : 'README.vi.md';
    assert.ok(md.includes(`](${other})`), `the index in ${lang} links to the other language`);
    const out = withoutLanguageLine(md, lang);
    assert.ok(!out.includes(`](${other})`), `the line of the other language goes from the index in ${lang}`);
    assert.ok(out.startsWith('# '), 'the heading stays');
    assert.equal(entriesOf(out).length, entriesOf(md).length, 'the list of the entries stays');
  }
  // A link to the same language, or a link in a sentence, stays.
  assert.equal(withoutLanguageLine('*[English](README.md)*', 'en'), '*[English](README.md)*');
  assert.equal(withoutLanguageLine('See [this](README.vi.md) too.', 'en'), 'See [this](README.vi.md) too.');
});
