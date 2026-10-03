// The learning tab of the parent area: the variant of the experiment, the researcher view (one
// block for each of the nine questions of "What good means", in words and simple bars, from the
// roll-ups of this device), and the shared summary (all of it shown, then saved or copied;
// nothing is sent). HTML and CSS only, no chart library.
import { h, button } from './dom.js';
import { t } from './i18n.js';
import { currentRollups, summarize, QUESTIONS, qHelp } from '../core/learnlog.js';
import { createExperiments } from '../core/experiments.js';

const pct = (x) => (x === null || x === undefined ? '–' : `${Math.round(x * 100)}`);
const num = (x, digits = 1) => (x === null || x === undefined ? '–' : String(Math.round(x * 10 ** digits) / 10 ** digits));

// A row of a bar: a label, a bar (0 to 1), and a value.
function bar(label, value, text, band = null) {
  const fill = h('div', { class: 'bar-fill', style: { width: `${Math.max(0, Math.min(1, value ?? 0)) * 100}%` } });
  const track = h('div', { class: 'bar-track' }, [fill]);
  if (band) track.append(h('div', { class: 'bar-band', style: { left: `${band[0] * 100}%`, width: `${(band[1] - band[0]) * 100}%` } }));
  return h('div', { class: 'bar-row' }, [h('span', { class: 'bar-label', text: label }), track, h('span', { class: 'bar-value', text })]);
}

function block(id, children) {
  return h('section', { class: 'research-block' }, [h('h4', { text: t(`research.${id}.title`) }), ...children.filter(Boolean)]);
}

const empty = () => h('p', { class: 'muted', text: t('research.none') });

// The nine blocks, from the roll-ups.
export function researchView(rollups, data) {
  const band = data.learnlog.band;
  const q = Object.fromEntries(Object.entries(QUESTIONS).map(([k, f]) => [k, k === 'difficulty' ? f(rollups, band) : f(rollups)]));
  const skill = (id) => t(`skill.${id}`);
  const place = (id) => {
    const m = data.world?.map?.(id);
    return m ? t(m.nameKey) : id;
  };
  const blocks = [];

  blocks.push(block('learn', q.learn.length ? q.learn.flatMap((s) => [
    h('p', { text: t('research.learn.skill', { skill: skill(s.skill), n: s.commits, recent: pct(s.recent), mastery: s.toMastery === null ? t('research.learn.notyet') : t('research.learn.mastered', { minutes: Math.round(s.toMastery) }) }) }),
    ...s.curve.slice(-7).map((c) => bar(t('research.day', { n: c.day + 1 }), c.rate, `${pct(c.rate)}% (${c.n})`)),
  ]) : [empty()]));

  blocks.push(block('stay', q.stay.some((x) => x.n) ? q.stay.map((x) => bar(t('research.stay.after', { days: x.days }), x.rate, x.n ? `${pct(x.rate)}% (${x.n})` : '–')) : [empty()]));

  blocks.push(block('transfer', q.transfer.n ? [
    h('p', { text: t('research.transfer.text', { n: q.transfer.n, correct: pct(q.transfer.correct) }) }),
    h('p', { text: q.transfer.r === null ? t('research.transfer.few') : t('research.transfer.r', { r: num(q.transfer.r, 2) }) }),
  ] : [empty()]));

  blocks.push(block('difficulty', q.difficulty.firsts ? [
    h('p', { text: t('research.difficulty.text', { rate: pct(q.difficulty.rate), low: pct(band[0]), high: pct(band[1]) }) }),
    bar(t('research.difficulty.first'), q.difficulty.rate, `${pct(q.difficulty.rate)}%`, band),
    h('p', { class: 'muted', text: t('research.difficulty.harder', { n: q.difficulty.harder }) }),
  ] : [empty()]));

  const masteryRows = (m) => Object.entries(m).filter(([, v]) => v.skills).map(([variant, v]) => h('p', { class: 'muted', text: t('research.mastery.variant', { variant, minutes: num(v.minutes, 0), n: v.skills }) }));
  blocks.push(block('predict', q.predict.n ? [
    h('p', { text: t('research.predict.text', { n: q.predict.n, skipped: pct(q.predict.skipped), error: num(q.predict.error) }) }),
    ...q.predict.curve.slice(-7).map((c) => bar(t('research.day', { n: c.day + 1 }), Math.min(1, c.error / 3), t('research.predict.miss', { error: num(c.error) }))),
    ...masteryRows(q.predict.mastery),
  ] : [empty()]));

  blocks.push(block('hints', q.hints.levels.length ? [
    ...q.hints.levels.map((l) => bar(l.level ? t('research.hints.level', { level: l.level }) : t('research.hints.none'), l.rate, `${pct(l.rate)}% (${l.n})`)),
    h('p', { class: 'muted', text: t('research.hints.short', { short: pct(q.hints.short) }) }),
  ] : [empty()]));

  // Which help works: the success of the next commit after each move of the mentors, for each
  // diagnosis; the checks of the child; the waves.
  const help = qHelp(rollups);
  blocks.push(block('help', help.rows.length || help.checks || help.asks.before + help.asks.after ? [
    h('p', { class: 'muted', text: t('research.help.note') }),
    ...help.rows.slice(0, 12).map((r) => bar(t('research.help.row', { diagnosis: t(`research.diagnosis.${r.diagnosis}`), move: t(`research.move.${r.move}`) }), r.rate, `${pct(r.rate)}% (${r.n})`)),
    h('p', { class: 'muted', text: t('research.help.checks', { n: help.checks, fix: pct(help.selfFix) }) }),
    h('p', { class: 'muted', text: t('research.help.asks', { before: help.asks.before, after: help.asks.after }) }),
  ] : [empty()]));

  blocks.push(block('mashing', q.mashing.commits ? [
    bar(t('research.mashing.share'), q.mashing.share, `${pct(q.mashing.share)}%`),
    h('p', { text: t('research.mashing.after', { rate: pct(q.mashing.after.rate), n: q.mashing.after.n }) }),
  ] : [empty()]));

  blocks.push(block('comeback', q.comeBack.sessions ? [
    h('p', { text: t('research.comeback.text', { n: q.comeBack.sessions, week: num(q.comeBack.perWeek), retries: q.comeBack.retries, after: pct(q.comeBack.afterQuest) }) }),
    q.comeBack.stops.length ? h('p', { class: 'muted', text: t('research.comeback.stops', { places: q.comeBack.stops.map((s) => `${place(s.place)} (${s.n})`).join(t('ui.list.sep')) }) }) : null,
  ] : [empty()]));

  const s = q.sessions;
  const most = Math.max(1, ...s.lengths);
  const lengthLabel = (i) => (i === 0 ? t('research.sessions.under', { m: s.bounds[0] }) : i === s.bounds.length ? t('research.sessions.over', { m: s.bounds[i - 1] }) : t('research.sessions.range', { a: s.bounds[i - 1], b: s.bounds[i] }));
  blocks.push(block('sessions', s.n ? [
    h('p', { text: t('research.sessions.text', { minutes: num(s.minutes, 0) }) }),
    ...s.lengths.map((n, i) => bar(lengthLabel(i), n / most, String(n))),
    h('p', { class: 'muted', text: t('research.sessions.ended', { device: s.endedBy.device, parent: s.endedBy.parent, child: s.endedBy.child }) }),
    h('p', { class: 'muted', text: t('research.sessions.first', { list: Object.entries(s.first).map(([k, n]) => `${t(`research.action.${k}`)} (${n})`).join(t('ui.list.sep')) }) }),
  ] : [empty()]));
  return blocks;
}

// The learning tab. body: the element of the tab. ctx: the game.
export function drawLearning(body, ctx) {
  const p = ctx.profile;
  const { data } = ctx;
  if (!p.log) return body.append(empty());
  // The variant of the experiment of this release; the parent can change it.
  const x = ctx.experiments;
  body.append(h('h3', { text: t('research.variant') }));
  if (!x?.active) body.append(h('p', { class: 'muted', text: t('research.variant.none') }));
  else {
    const select = h('select', { 'aria-label': t('research.variant') }, x.variants.map((v) => h('option', { value: v, text: v, ...(v === x.variant ? { selected: true } : {}) })));
    select.addEventListener('change', () => {
      p.experiment = { experiment: x.active, variant: select.value };
      ctx.experiments = createExperiments(data.experiments, { seed: p.seed, choice: p.experiment });
      ctx.makeLearner();
      ctx.save('experiment');
    });
    body.append(h('div', { class: 'field' }, [h('label', { text: t('research.variant.of', { name: x.active }) }), select]));
  }
  // The researcher view.
  body.append(h('h3', { text: t('research.title') }), h('p', { class: 'muted', text: t('research.note') }));
  body.append(h('div', { class: 'research' }, researchView(currentRollups(p.log, data.learnlog), data)));
  // The shared summary: shown in full; saved or copied by the parent; never sent.
  body.append(h('h3', { text: t('research.share') }), h('p', { class: 'muted', text: t('research.share.note') }));
  const out = h('div');
  body.append(button(t('research.share.make'), () => {
    const summary = summarize(p.log, { grade: p.grade, variant: ctx.experiments?.label ?? 'base' }, data.learnlog);
    const text = JSON.stringify(summary, null, 1);
    const area = h('textarea', { readonly: true, class: 'summary-text', 'aria-label': t('research.share') });
    area.value = text;
    out.replaceChildren(
      h('p', { class: 'muted', text: t('research.share.size', { kb: Math.max(1, Math.round(text.length / 1024)) }) }),
      h('div', { class: 'field' }, [area]),
      h('div', { class: 'row', style: { justifyContent: 'flex-start' } }, [
        button(t('parent.code.copy'), async () => {
          try {
            await navigator.clipboard.writeText(text);
            ctx.toast('parent.code.copied');
          } catch {
            area.select();
          }
        }, { cls: 'btn small' }),
        button(t('parent.code.file'), () => {
          const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
          const a = h('a', { href: url, download: 'tre-learning-summary.json' });
          document.body.append(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, { cls: 'btn small paper' }),
      ]),
    );
  }, { cls: 'btn small' }), out);
}
