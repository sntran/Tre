// Help that fits the work as it is (#96): a wave in each state of the work gives a step that the
// child can do then, and never a thing that the state makes false.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runHeadless } from './story-run.js';
import { load } from './helpers.js';

const story = (name) => load(`tests/stories/${name}.json`);
// The lines (callouts and talks) of a run.
async function heard(s, steps) {
  const lines = [];
  const failures = await runHeadless({ ...s, steps }, { onSession: (x) => x.listen((e) => { if (e.type === 'open' && e.textKey) lines.push(e.textKey); }) });
  return { failures, lines };
}

test('the teacher: with no rod, a wave says the heap; with a full mat, the count and the tie; after the first of two bundles, he says that one more is needed', async () => {
  const s = story('trial-scholar');
  const first = s.steps.findIndex((x) => x.read === true) + 2;
  const put = (n) => ({ repeat: n, steps: [{ press: { item: 'rod' } }, { until: { event: 'put', timeout: 10 } }] });
  const { failures, lines } = await heard(s, [
    ...s.steps.slice(0, first), { wait: 1 },
    { do: { type: 'wave' } }, { wait: 1 }, { do: { type: 'wave' } }, { until: { event: 'open', with: { textKey: 'mentor.show.scholar' }, timeout: 10 } },
    put(10), { wait: 1 },
    { do: { type: 'wave' } }, { until: { event: 'open', with: { textKey: 'mentor.scholar.tie' }, timeout: 10 } },
    { press: { entity: 'npc:teacher' } }, { until: { event: 'tie', timeout: 10 } },
    { until: { event: 'open', with: { textKey: 'scholar.more' }, timeout: 10 } },
  ]);
  assert.deepEqual(failures.map((f) => `${f.step}: ${f.message}`), [], lines.join(', '));
  const tie = lines.lastIndexOf('mentor.scholar.tie');
  assert.ok(!lines.slice(tie).includes('mentor.show.scholar'), 'no line of the heap with a full mat');
});

test('the fisher: after an escape, a wave names the hole, never "Đủ hàng rồi"; the row that did not change gets no new tide', async () => {
  const s = story('trial-fisher');
  const at = s.steps.findIndex((x) => x.until?.event === 'escape') + 1;
  const { failures, lines } = await heard(s, [...s.steps.slice(0, at), { wait: 6 }, { do: { type: 'wave' } }, { until: { event: 'open', with: { textKey: 'mentor.fisher.hole' }, timeout: 10 } }, { wait: 50 }]);
  assert.deepEqual(failures.map((f) => `${f.step}: ${f.message}`), [], lines.join(', '));
  const esc = lines.indexOf('fisher.escape');
  const later = lines.slice(esc + 1);
  assert.ok(!later.includes('fisher.full'), `no "Đủ hàng rồi": ${later.join(', ')}`);
  assert.ok(!later.includes('fisher.tide.more'), `no "Cắm thêm cọc trước đã": ${later.join(', ')}`);
});

test('the ducks: a wave names a duck and the pen, never a heap', async () => {
  const s = story('event-duck');
  const at = s.steps.findIndex((x) => x.read === true) + 1;
  const { failures, lines } = await heard(s, [...s.steps.slice(0, at), { wait: 1 }, { do: { type: 'wave' } }, { wait: 1 }, { do: { type: 'wave' } }, { until: { event: 'open', with: { textKey: 'mentor.duck.show' }, timeout: 10 } }]);
  assert.deepEqual(failures.map((f) => `${f.step}: ${f.message}`), [], lines.join(', '));
  assert.ok(!lines.includes('mentor.show'), 'no general line of a heap');
});

test('the healer: after the end, no hint and no glow of the give', async () => {
  const s = story('trial-healer');
  const { failures, lines } = await heard(s, [...s.steps, { wait: 1 }, { do: { type: 'wave' } }, { wait: 6 }]);
  assert.deepEqual(failures.map((f) => `${f.step}: ${f.message}`), []);
  const given = lines.lastIndexOf('dlg.healer.trial.done.n1');
  assert.ok(!lines.slice(given).some((k) => /^mentor\.(healer\.)?(next|show)/.test(k)), `no hint after the end: ${lines.slice(given).join(', ')}`);
});

test('every event of a day has its own line of the next step', () => {
  const cfg = load('data/world/mentors.json');
  const vi = load('i18n/vi.json');
  for (const k of ['event-cart', 'event-flood', 'event-market', 'event-duck']) {
    const key = cfg.mentors[k].lines.show;
    assert.ok(key && vi[key], k);
  }
});
