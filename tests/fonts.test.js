import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';

const root = new URL('../', import.meta.url).pathname;

// Read the characters of a WOFF2 font (the cmap table), with no library.
const KNOWN_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ',
  'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC',
  'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat',
  'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];

function fontCharacters(path) {
  const buf = readFileSync(path);
  assert.equal(buf.toString('latin1', 0, 4), 'wOF2');
  const numTables = buf.readUInt16BE(12);
  const compressedSize = buf.readUInt32BE(20);
  let pos = 48;
  const base128 = () => {
    let value = 0;
    for (let i = 0; i < 5; i++) {
      const b = buf[pos++];
      value = value * 128 + (b & 0x7f);
      if (!(b & 0x80)) return value;
    }
    throw new Error('Bad UIntBase128');
  };
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[pos++];
    let tag = KNOWN_TAGS[flags & 0x3f];
    if ((flags & 0x3f) === 63) {
      tag = buf.toString('latin1', pos, pos + 4);
      pos += 4;
    }
    const version = flags >> 6;
    const origLength = base128();
    const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0;
    const length = transformed ? base128() : origLength;
    tables.push({ tag, length });
  }
  const data = brotliDecompressSync(buf.subarray(pos, pos + compressedSize));
  let offset = 0;
  let cmap = null;
  for (const t of tables) {
    if (t.tag === 'cmap') cmap = data.subarray(offset, offset + t.length);
    offset += t.length;
  }
  assert.ok(cmap, 'no cmap table');
  const chars = new Set();
  const count = cmap.readUInt16BE(2);
  for (let i = 0; i < count; i++) {
    const sub = cmap.readUInt32BE(4 + i * 8 + 4);
    const format = cmap.readUInt16BE(sub);
    if (format === 4) {
      const segX2 = cmap.readUInt16BE(sub + 6);
      for (let s = 0; s < segX2 / 2; s++) {
        const end = cmap.readUInt16BE(sub + 14 + s * 2);
        const start = cmap.readUInt16BE(sub + 16 + segX2 + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) chars.add(c);
      }
    } else if (format === 12) {
      const groups = cmap.readUInt32BE(sub + 12);
      for (let g = 0; g < groups; g++) {
        const start = cmap.readUInt32BE(sub + 16 + g * 12);
        const end = cmap.readUInt32BE(sub + 20 + g * 12);
        for (let c = start; c <= end; c++) chars.add(c);
      }
    }
  }
  return chars;
}

function textCharacters() {
  const out = new Set();
  for (const lang of ['vi', 'en']) {
    const dict = JSON.parse(readFileSync(`${root}i18n/${lang}.json`, 'utf8'));
    for (const text of Object.values(dict)) {
      for (const ch of text.normalize('NFC')) if (ch.trim()) out.add(ch.codePointAt(0));
    }
  }
  // Numbers and signs that the code shows.
  for (const ch of '0123456789+−×÷=?/.,:·') out.add(ch.codePointAt(0));
  return out;
}

const FONTS = ['Alegreya-Bold', 'BeVietnamPro-Regular', 'BeVietnamPro-SemiBold', 'BeVietnamPro-Bold'];

for (const font of FONTS) {
  test(`the font ${font} has each character of the Vietnamese and English text`, () => {
    const have = fontCharacters(`${root}fonts/${font}.woff2`);
    const missing = [...textCharacters()].filter((c) => !have.has(c)).map((c) => String.fromCodePoint(c));
    assert.deepEqual(missing, []);
  });
}

test('the style sheet loads the two fonts from the fonts folder', () => {
  const css = readFileSync(`${root}styles/main.css`, 'utf8');
  for (const font of FONTS) assert.ok(css.includes(`../fonts/${font}.woff2`), font);
  assert.ok(css.includes("font-family: 'Alegreya'") || css.includes('"Alegreya"'));
  assert.ok(css.includes("'Be Vietnam Pro'"));
});
