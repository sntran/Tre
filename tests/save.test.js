import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compress, decompress, crc32, toBase64Url, fromBase64Url, utf8Encode, utf8Decode } from '../src/core/codec.js';
import { createProfile, addItem, takeItems, applyLoss, lossLevel, addFriend, giveTitle } from '../src/core/profile.js';
import {
  serialize, deserialize, exportCode, importCode, migrate, wrap, SaveError, SAVE_VERSION, SAVE_FORMAT,
} from '../src/core/save.js';
import { createRng } from '../src/core/rng.js';

function sample() {
  const p = createProfile({ id: 'p1', name: 'Tí Sún', gender: 'girl', grade: 2, now: 1000 });
  addItem(p, 'coin', 12);
  p.flags['trial.smith.done'] = true;
  p.learning.skills['math.add.20'] = { p: 0.6, r: 1010, n: 5, c: 4 };
  return p;
}

test('compression gives back the same bytes', () => {
  const rng = createRng(42);
  const inputs = [
    new Uint8Array(0),
    utf8Encode('a'),
    utf8Encode('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    utf8Encode('Thánh Gióng nhổ tre đánh giặc. '.repeat(200)),
    Uint8Array.from({ length: 5000 }, () => rng.int(0, 255)),
    Uint8Array.from({ length: 200000 }, () => rng.int(97, 100)),
  ];
  for (const input of inputs) assert.deepEqual(decompress(compress(input)), input);
});

test('compression makes repeated text smaller', () => {
  const input = utf8Encode(JSON.stringify(sample()).repeat(5));
  assert.ok(compress(input).length < input.length / 2);
});

test('base64url and CRC-32 work', () => {
  const bytes = Uint8Array.from([0, 1, 2, 250, 251, 252, 253]);
  for (let n = 0; n <= bytes.length; n++) assert.deepEqual(fromBase64Url(toBase64Url(bytes.slice(0, n))), bytes.slice(0, n));
  assert.equal(crc32(utf8Encode('123456789')), 0xcbf43926);
  assert.equal(utf8Decode(utf8Encode('Văn Miếu')), 'Văn Miếu');
});

test('save and load give the same profile', () => {
  const p = sample();
  assert.deepEqual(deserialize(serialize(p, 5)), p);
});

test('a bad save does not load', () => {
  assert.throws(() => deserialize('{nope'), SaveError);
  assert.throws(() => deserialize(JSON.stringify({ format: 'other', version: 1 })), SaveError);
  const newer = wrap(sample());
  newer.version = SAVE_VERSION + 1;
  assert.throws(() => deserialize(JSON.stringify(newer)), (e) => e.reason === 'newer');
  const broken = wrap({ ...sample(), grade: 9 });
  assert.throws(() => deserialize(JSON.stringify(broken)), (e) => e.reason === 'shape');
});

test('migrations change an old save into the current version', () => {
  // A test format with 3 versions. Version 1 had "gold". Version 2 calls it "coin".
  // Version 3 adds "machines".
  const migrations = {
    1: (p) => {
      const { gold, ...rest } = p;
      return { ...rest, inventory: { ...p.inventory, coin: gold } };
    },
    2: (p) => ({ ...p, machines: p.machines ?? [] }),
  };
  const v1 = sample();
  delete v1.machines;
  v1.gold = 7;
  const old = { format: SAVE_FORMAT, version: 1, savedAt: 0, profile: v1 };
  const done = migrate(old, { migrations, version: 3 });
  assert.equal(done.version, 3);
  assert.equal(done.profile.inventory.coin, 7);
  assert.equal(done.profile.gold, undefined);
  assert.deepEqual(done.profile.machines, []);
  // The input does not change.
  assert.equal(old.profile.gold, 7);
  // A missing migration is an error.
  assert.throws(() => migrate(old, { migrations: { 1: migrations[1] }, version: 3 }), (e) => e.reason === 'migration');
});

test('the export code loads on another device', () => {
  const p = sample();
  const code = exportCode(p, 99);
  assert.match(code, /^TRE1-[A-Za-z0-9_-]+-[0-9a-f]{8}$/);
  assert.deepEqual(importCode(code), p);
  // Spaces and line breaks from a copy are removed.
  assert.deepEqual(importCode(code.replace(/(.{20})/g, '$1\n ')), p);
});

test('a changed export code does not load', () => {
  const code = exportCode(sample());
  const i = 12;
  const changed = code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1);
  assert.throws(() => importCode(changed), (e) => e.reason === 'checksum');
  assert.throws(() => importCode('HELLO-abc-123'), (e) => e.reason === 'prefix');
  assert.throws(() => importCode('TRE1-ab$c-00000000'), SaveError);
});

test('profile items, friends, titles, and loss rules', () => {
  const p = sample();
  assert.equal(takeItems(p, { coin: 20 }), false);
  assert.equal(takeItems(p, { coin: 2 }), true);
  assert.equal(p.inventory.coin, 10);
  assert.equal(addFriend(p, 'song'), true);
  assert.equal(addFriend(p, 'song'), false);
  assert.deepEqual(p.party, ['song']);
  assert.equal(giveTitle(p, 'tu-tai', 1, 5), true);
  assert.equal(p.stele[0].name, 'Tí Sún');

  const rules = { small: { share: 0.1, max: 3 }, normal: { share: 0.25, max: 10 } };
  assert.equal(lossLevel(p), 'small');
  const lost = applyLoss(p, 'small', rules, ['coin', 'iron']);
  assert.deepEqual(lost, { coin: 1 });
  assert.deepEqual(p.friends, ['song']);
  assert.deepEqual(p.titles, ['tu-tai']);

  const g1 = createProfile({ id: 'g1', name: 'An', grade: 1 });
  assert.equal(lossLevel(g1), 'none');
  g1.settings.loss = 'normal';
  assert.equal(lossLevel(g1), 'normal');
});
