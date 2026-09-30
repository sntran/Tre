// The parent area: the gate, the progress page, the settings, the question
// editor, and the export code. The area opens only after a parent holds a
// button for 3 seconds and answers a question for adults.
import { makeGateQuestion, checkGateAnswer, holdProgress } from '../core/parentgate.js';
import { drawLearning } from './research.js';
import { exportCode, importCode, SaveError } from '../core/save.js';
import { gradeIds, gradeName } from '../core/grades.js';
import { extendTime, remainingMs } from '../core/timelimit.js';
import { registerModal } from './registry.js';
import { saveProfile, deleteProfile, listProfiles, loadProfile, listRestorePoints, restoreProfile } from './storage.js';
import { gameDay } from '../core/restore.js';
import { h, img, button } from './dom.js';
import { t, lang } from './i18n.js';
import { formatNumber } from '../core/i18n.js';
import { C } from '../render/palette.js';
import { setVoiceEnabled } from './speak.js';

// The gate. Return true when the parent passes it.
function gate(ctx) {
  const cfg = ctx.data.game.parentGate;
  return new Promise((resolve) => {
    const layer = h('div', { class: 'modal-layer' });
    const panel = h('div', { class: 'panel parent', style: { width: 'min(560px, 100%)' } });
    const close = (ok) => { layer.remove(); resolve(ok); };
    layer.append(panel);
    ctx.ui.append(layer);

    const header = () => h('div', { class: 'panel-head' }, [h('h2', { text: t('parent.gate.title') }), button(null, () => close(false), { cls: 'icon-btn', icon: 'ui/close', aria: t('ui.close') })]);

    function holdStep() {
      const NS = 'http://www.w3.org/2000/svg';
      const ring = document.createElementNS(NS, 'svg');
      ring.setAttribute('viewBox', '0 0 100 100');
      ring.setAttribute('class', 'hold-ring');
      ring.innerHTML = `<circle cx="50" cy="50" r="42" fill="${C.diep}" stroke="${C.ink}" stroke-width="3"/><circle class="arc" cx="50" cy="50" r="42" fill="none" stroke="${C.vermilion}" stroke-width="10" stroke-dasharray="0 264" transform="rotate(-90 50 50)"/>`;
      const lock = img('ui/lock');
      lock.style.cssText = 'position:absolute;inset:0;margin:auto;width:56px;height:56px;pointer-events:none';
      const holder = h('button', { class: 'btn paper', type: 'button', style: { position: 'relative', width: '170px', height: '170px', borderRadius: '50%', padding: '0' }, 'aria-label': t('parent.gate.hold') }, [ring, lock]);
      const arc = ring.querySelector('.arc');
      let start = null;
      let raf = 0;
      const tick = () => {
        const p = holdProgress(start, performance.now(), cfg.holdMs);
        arc.setAttribute('stroke-dasharray', `${(p * 264).toFixed(1)} 264`);
        if (p >= 1) {
          start = null;
          questionStep();
          return;
        }
        if (start !== null) raf = requestAnimationFrame(tick);
      };
      const down = (e) => {
        e.preventDefault();
        start = performance.now();
        holder.setPointerCapture?.(e.pointerId);
        raf = requestAnimationFrame(tick);
      };
      const up = () => {
        start = null;
        cancelAnimationFrame(raf);
        arc.setAttribute('stroke-dasharray', '0 264');
      };
      holder.addEventListener('pointerdown', down);
      holder.addEventListener('pointerup', up);
      holder.addEventListener('pointercancel', up);
      holder.addEventListener('contextmenu', (e) => e.preventDefault());
      panel.replaceChildren(header(), h('p', { class: 'center', text: t('parent.gate.hold') }), h('div', { class: 'row' }, [holder]));
    }

    function questionStep() {
      const q = makeGateQuestion(ctx.rng, cfg);
      const input = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', 'aria-label': t('parent.gate.answer'), style: { fontSize: '28px', textAlign: 'center', width: '160px' } });
      const msg = h('p', { class: 'center' });
      const ok = button(t('ui.ok'), () => {
        if (checkGateAnswer(q, input.value)) {
          layer.remove();
          resolve(true);
        } else {
          msg.textContent = t('parent.gate.wrong');
          setTimeout(questionStep, 900);
        }
      }, { cls: 'btn red' });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok.click(); });
      panel.replaceChildren(header(),
        h('p', { class: 'center', text: t('parent.gate.question') }),
        h('p', { class: 'center gate-question', text: `${q.a} × ${q.b} = ?` }),
        h('div', { class: 'row field' }, [input, ok]),
        msg);
      input.focus();
    }

    holdStep();
  });
}

function toggleRow(label, value, onChange) {
  const box = h('input', { type: 'checkbox', 'aria-label': label });
  box.checked = value;
  box.style.cssText = 'width:28px;height:28px';
  box.addEventListener('change', () => onChange(box.checked));
  return h('label', { class: 'switch-row' }, [h('span', { text: label }), box]);
}

function selectField(label, options, value, onChange) {
  const sel = h('select', { 'aria-label': label });
  for (const [v, text] of options) {
    const o = h('option', { value: String(v), text });
    if (String(v) === String(value)) o.selected = true;
    sel.append(o);
  }
  sel.addEventListener('change', () => onChange(sel.value));
  return h('div', { class: 'field' }, [h('label', { text: label }), sel]);
}

function formatDate(ms) {
  try {
    return new Date(ms).toLocaleDateString(lang() === 'vi' ? 'vi-VN' : 'en-US');
  } catch {
    return '';
  }
}

// opts: { tab, profile, action }: open a tab, and an action (rename, export, delete) on a profile.
async function parentArea(ctx, opts = {}) {
  const { data } = ctx;
  await new Promise((resolve) => {
    const layer = h('div', { class: 'modal-layer' });
    const panel = h('div', { class: 'panel parent' });
    const body = h('div');
    const close = () => { layer.remove(); resolve(); };
    const tabs = ctx.profile ? ['progress', 'learning', 'settings', 'questions', 'games', 'code'] : ['games', 'code'];
    let tab = tabs.includes(opts.tab) ? opts.tab : tabs[0];
    // Leave the parent area and go on with a profile (after a restore or an import), or to the title.
    const leave = async (profile) => {
      ctx.profile = null;
      layer.remove();
      resolve();
      if (profile) await ctx.startProfile(profile);
      else ctx.go('title');
    };
    const tabBar = h('div', { class: 'tabs' });
    const drawTabs = () => {
      tabBar.replaceChildren(...tabs.map((id) => {
        const b = button(t(`parent.tab.${id}`), () => { tab = id; drawTabs(); draw(); }, { cls: 'btn small paper' });
        b.setAttribute('aria-pressed', String(id === tab));
        return b;
      }));
    };
    panel.append(h('div', { class: 'panel-head' }, [h('h2', { text: t('parent.title') }), button(null, close, { cls: 'icon-btn', icon: 'ui/close', aria: t('ui.close') })]), tabBar, body);
    layer.append(panel);
    ctx.ui.append(layer);

    const draw = () => {
      body.replaceChildren();
      if (tab === 'progress') drawProgress();
      if (tab === 'learning') drawLearning(body, ctx);
      if (tab === 'settings') drawSettings();
      if (tab === 'questions') drawQuestions();
      if (tab === 'code') drawCode();
      if (tab === 'games') drawGames();
    };

    // The code of a profile, with a copy button.
    function codeBox(profile) {
      const code = exportCode(profile, Date.now());
      const area = h('textarea', { readonly: true, 'aria-label': t('parent.code.export') });
      area.value = code;
      return h('div', { class: 'field' }, [area, h('div', { class: 'row', style: { justifyContent: 'flex-start' } }, [
        button(t('parent.code.copy'), async () => {
          try {
            await navigator.clipboard.writeText(code);
            ctx.toast('parent.code.copied');
          } catch {
            area.select();
          }
        }, { cls: 'btn small' }),
        button(t('parent.code.file'), () => {
          const blob = new Blob([code], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = h('a', { href: url, download: `tre-${profile.hero.name.replace(/[^\p{L}\p{N}]+/gu, '-')}.txt` });
          document.body.append(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, { cls: 'btn small paper' }),
      ])]);
    }

    // The adventures on this device: for each one, the restore points (the last dawns), rename,
    // export, and delete (a second press deletes; the export code comes first).
    async function drawGames() {
      const list = (await listProfiles()).filter((x) => !x.damaged);
      if (tab !== 'games') return;
      if (!list.length) body.append(h('p', { class: 'muted', text: t('parent.games.none') }));
      for (const item of list) {
        const current = ctx.profile?.id === item.id ? ctx.profile : item.profile;
        const today = gameDay(current);
        const box = h('div', { class: 'game-box' });
        const extra = h('div');
        box.append(h('h3', { text: t('parent.games.head', { name: current.hero.name, era: t(ctx.data.world.eraOf(current.world?.map)), day: today + 1, date: formatDate(item.updatedAt) }) }));
        // Restore points.
        const points = await listRestorePoints(item.id);
        box.append(h('h4', { text: t('parent.restore') }));
        if (!points.length) box.append(h('p', { class: 'muted', text: t('parent.restore.none') }));
        const row = h('div', { class: 'row', style: { justifyContent: 'flex-start', flexWrap: 'wrap' } });
        points.forEach((pt, i) => {
          const back = today - pt.day;
          const label = pt.before ? t('parent.restore.before') : back < 0 ? t('parent.restore.later') : back === 0 ? t('parent.restore.today') : back === 1 ? t('parent.restore.yesterday') : t('parent.restore.days', { n: back });
          row.append(button(`${label} · ${t(ctx.data.world.eraOf(pt.map))} · ${formatDate(pt.at)}`, async () => {
            if (!window.confirm(t('parent.restore.confirm', { name: current.hero.name }))) return;
            // The open game saves first, so that its state becomes the restore point in its place.
            if (ctx.profile?.id === item.id) await ctx.save('restore');
            await restoreProfile(item.id, i);
            ctx.toast('parent.restore.done');
            if (ctx.profile?.id === item.id) await leave(await loadProfile(item.id));
            else draw();
          }, { cls: 'btn small paper' }));
        });
        box.append(row);
        // Rename, export, delete.
        const rename = () => {
          const input = h('input', { type: 'text', maxlength: String(data.hero.nameMax), 'aria-label': t('parent.rename') });
          input.value = current.hero.name;
          extra.replaceChildren(h('div', { class: 'row field', style: { justifyContent: 'flex-start' } }, [input, button(t('parent.rename.save'), async () => {
            const name = input.value.trim();
            if (!name) return;
            const p = ctx.profile?.id === item.id ? ctx.profile : await loadProfile(item.id);
            p.hero.name = name;
            if (ctx.profile?.id === item.id) await ctx.save('rename');
            else await saveProfile(p);
            draw();
          }, { cls: 'btn small red' })]));
          input.focus();
        };
        const exportIt = async () => {
          const p = ctx.profile?.id === item.id ? ctx.profile : await loadProfile(item.id);
          extra.replaceChildren(h('p', { text: t('parent.code.export.note') }), codeBox(p));
        };
        let armed = false;
        const del = button(t('parent.discard', { name: current.hero.name }), async () => {
          if (!armed) {
            // The first press: the export code first, then the second press deletes.
            armed = true;
            await exportIt();
            extra.prepend(h('p', { class: 'warn', text: t('parent.discard.first', { name: current.hero.name }) }));
            del.querySelector('.btn-label').textContent = t('parent.discard.again', { name: current.hero.name });
            del.classList.replace('paper', 'red');
            return;
          }
          await deleteProfile(item.id);
          ctx.toast('parent.discard.done');
          if (ctx.profile?.id === item.id) await leave(null);
          else draw();
        }, { cls: 'btn small paper' });
        box.append(h('div', { class: 'row', style: { justifyContent: 'flex-start', flexWrap: 'wrap' } }, [
          button(t('parent.rename'), rename, { cls: 'btn small paper' }),
          button(t('parent.code.export'), exportIt, { cls: 'btn small paper' }),
          del,
        ]), extra);
        body.append(box);
        if (opts.profile === item.id && opts.action) {
          const action = opts.action;
          opts.action = null;
          if (action === 'rename') rename();
          if (action === 'export') await exportIt();
          if (action === 'delete') del.click();
          box.scrollIntoView?.({ block: 'center' });
        }
      }
    }

    function drawProgress() {
      const p = ctx.profile;
      const learner = ctx.learner;
      const calling = data.callings.callings.find((c) => c.id === p.calling);
      const left = remainingMs(p.time, p.settings.timeLimit, Date.now());
      body.append(
        h('p', { text: t('parent.summary', {
          name: p.hero.name, grade: gradeName(p.grade, data.game.grades),
          calling: calling ? t(calling.nameKey) : t('ui.none'),
          titles: p.titles.map((id) => t(`title.${id}.name`)).join(t('ui.list.sep')) || t('ui.none'),
          minutes: Math.round((p.time.usedMs ?? 0) / 60000),
        }) }),
        p.settings.timeLimit ? h('p', { text: t('parent.time.left', { minutes: Math.max(0, Math.round(left / 60000)) }) }) : null,
      );
      const practice = learner.toPractice();
      body.append(h('h3', { text: t('parent.practice') }), h('p', { text: practice.length ? practice.map((id) => t(`skill.${id}`)).join(t('ui.list.sep')) : t('parent.practice.none') }));
      body.append(h('h3', { text: t('parent.exams') }));
      if (!p.learning.exams.length) body.append(h('p', { class: 'muted', text: t('parent.exams.none') }));
      else {
        const table = h('table', { class: 'table' });
        table.append(h('tr', {}, [h('th', { text: t('parent.col.date') }), h('th', { text: t('parent.col.exam') }), h('th', { text: t('parent.col.result') })]));
        for (const e of p.learning.exams.slice().reverse()) {
          table.append(h('tr', {}, [
            h('td', { text: formatDate(e.at) }),
            h('td', { text: t(data.titles.exams[e.kind].titleKey) }),
            h('td', { text: t(e.kind === 'placement' ? 'parent.exam.placed' : e.passed ? 'parent.exam.passed' : 'parent.exam.notyet', { correct: e.correct, total: e.asked }) }),
          ]));
        }
        body.append(table);
      }
      for (const subject of ctx.graph.subjects) {
        const rows = learner.summary((s) => s.subject === subject && (s.grade <= Math.max(2, p.grade + 1)));
        if (!rows.length) continue;
        body.append(h('h3', { text: t(`subject.${subject}`) }));
        const table = h('table', { class: 'table' });
        table.append(h('tr', {}, [h('th', { text: t('parent.col.skill') }), h('th', { text: t('parent.col.grade') }), h('th', { text: t('parent.col.state') }), h('th', { text: t('parent.col.answers') })]));
        for (const r of rows) {
          table.append(h('tr', {}, [
            h('td', { text: t(`skill.${r.id}`) }),
            h('td', { text: String(r.grade) }),
            h('td', {}, [h('span', { class: `chip ${r.status}`, text: t(`mastery.${r.status}`) })]),
            h('td', { text: r.answers ? `${r.correct}/${r.answers}` : t('ui.none') }),
          ]));
        }
        body.append(table);
      }
    }

    function drawSettings() {
      const p = ctx.profile;
      const s = p.settings;
      const save = () => ctx.save('settings');
      body.append(
        selectField(t('parent.lang'), [['vi', t('lang.vi')], ['en', t('lang.en')]], s.lang, async (v) => {
          await ctx.setLanguage(v);
          ctx.makeLearner();
          await save();
          drawTabs();
          draw();
        }),
        selectField(t('parent.grade'), gradeIds(data.game.grades).map((g) => [g, capital(t(gradeName(g, data.game.grades).key, gradeName(g, data.game.grades).params))]), p.grade, (v) => {
          p.grade = Number(v);
          ctx.makeLearner();
          save();
        }),
        selectField(t('parent.time'), data.game.time.choices.map((m) => [m, m ? t('parent.minutes', { n: m }) : t('parent.time.none')]), s.timeLimit, (v) => {
          s.timeLimit = Number(v);
          save();
        }),
        h('div', { class: 'row', style: { justifyContent: 'flex-start' } }, [
          button(t('parent.time.extend', { n: data.game.time.extendMin }), () => {
            extendTime(p.time, data.game.time.extendMin, Date.now());
            save();
            ctx.toast('parent.time.extended', { n: data.game.time.extendMin });
          }, { cls: 'btn small' }),
        ]),
        toggleRow(t('parent.sound'), s.sound, (v) => { s.sound = v; ctx.bus.emit('settings', s); save(); }),
        toggleRow(t('parent.music'), s.music, (v) => { s.music = v; ctx.bus.emit('settings', s); save(); }),
        toggleRow(t('parent.voice'), s.voice, (v) => { s.voice = v; setVoiceEnabled(v); save(); }),
        selectField(t('parent.loss'), ['auto', 'none', 'small', 'normal'].map((v) => [v, t(`parent.loss.${v}`)]), s.loss, (v) => { s.loss = v; save(); }),
        h('p', { class: 'muted', text: t('parent.loss.note') }),
      );
    }

    function drawQuestions() {
      const p = ctx.profile;
      const list = p.settings.questions;
      body.append(h('p', { text: t('parent.q.note') }));
      for (const q of list) {
        body.append(h('div', { class: 'switch-row' }, [
          h('span', { text: t('parent.q.row', {
            text: q.text,
            answer: q.type === 'numeric' ? formatNumber(q.answer, lang()) : q.choices[0],
            skill: { key: `skill.${q.skill}` },
            lang: { key: `lang.${q.lang}` },
          }) }),
          button(t('parent.q.delete'), () => {
            p.settings.questions = list.filter((x) => x !== q);
            ctx.makeLearner();
            ctx.save('questions');
            draw();
          }, { cls: 'btn small paper' }),
        ]));
      }
      const skillSel = h('select', { 'aria-label': t('parent.q.skill') }, ctx.graph.all().map((s) => h('option', { value: s.id, text: t(`skill.${s.id}`) })));
      const langSel = h('select', { 'aria-label': t('parent.lang') }, ['vi', 'en'].map((v) => h('option', { value: v, text: t(`lang.${v}`) })));
      langSel.value = lang();
      const typeSel = h('select', { 'aria-label': t('parent.q.type') }, [h('option', { value: 'numeric', text: t('parent.q.numeric') }), h('option', { value: 'choice', text: t('parent.q.choice') })]);
      const text = h('input', { type: 'text', maxlength: '200', 'aria-label': t('parent.q.text') });
      const answer = h('input', { type: 'text', maxlength: '80', 'aria-label': t('parent.q.answer') });
      const wrong1 = h('input', { type: 'text', maxlength: '80', 'aria-label': t('parent.q.wrong') });
      const wrong2 = h('input', { type: 'text', maxlength: '80', 'aria-label': t('parent.q.wrong') });
      const wrongBox = h('div', { class: 'field', hidden: true }, [h('label', { text: t('parent.q.wrong') }), wrong1, wrong2]);
      typeSel.addEventListener('change', () => { wrongBox.hidden = typeSel.value !== 'choice'; });
      const msg = h('p');
      body.append(
        h('h3', { text: t('parent.q.add') }),
        h('div', { class: 'field' }, [h('label', { text: t('parent.q.skill') }), skillSel]),
        h('div', { class: 'field' }, [h('label', { text: t('parent.lang') }), langSel]),
        h('div', { class: 'field' }, [h('label', { text: t('parent.q.type') }), typeSel]),
        h('div', { class: 'field' }, [h('label', { text: t('parent.q.text') }), text]),
        h('div', { class: 'field' }, [h('label', { text: t('parent.q.answer') }), answer]),
        wrongBox,
        msg,
        button(t('parent.q.save'), () => {
          const q = { id: `parent-${Date.now().toString(36)}`, skill: skillSel.value, lang: langSel.value, type: typeSel.value, text: text.value.trim() };
          if (!q.text || !answer.value.trim()) { msg.textContent = t('parent.q.missing'); return; }
          if (q.type === 'numeric') {
            const n = Number(answer.value.trim().replace(',', '.'));
            if (!Number.isFinite(n)) { msg.textContent = t('parent.q.number'); return; }
            q.answer = n;
          } else {
            const wrong = [wrong1.value.trim(), wrong2.value.trim()].filter(Boolean);
            if (!wrong.length) { msg.textContent = t('parent.q.missing'); return; }
            q.choices = [answer.value.trim(), ...wrong];
            q.answer = 0;
          }
          p.settings.questions.push(q);
          ctx.makeLearner();
          ctx.save('questions');
          draw();
        }, { cls: 'btn red' }),
      );
    }

    function drawCode() {
      const p = ctx.profile;
      if (p) body.append(h('h3', { text: t('parent.code.export') }), h('p', { text: t('parent.code.export.note') }), codeBox(p));
      const input = h('textarea', { 'aria-label': t('parent.code.import') });
      const file = h('input', { type: 'file', accept: '.txt,text/plain', 'aria-label': t('parent.code.file.pick') });
      file.addEventListener('change', async () => {
        const f = file.files?.[0];
        if (f) input.value = (await f.text()).trim();
      });
      const msg = h('p');
      const choices = h('div', { class: 'menu-list' });
      body.append(
        h('h3', { text: t('parent.code.import') }),
        h('p', { text: t('parent.code.import.note') }),
        h('div', { class: 'field' }, [input, file]),
        msg,
        button(t('parent.code.load'), async () => {
          choices.replaceChildren();
          let profile;
          try {
            profile = importCode(input.value, { grades: data.game.grades });
          } catch (e) {
            msg.textContent = t(e instanceof SaveError ? `parent.code.error.${e.reason}` : 'parent.code.error.data');
            return;
          }
          // The code goes in as a new adventure, or in the place of one on this device.
          const list = (await listProfiles()).filter((x) => !x.damaged);
          msg.textContent = t('parent.code.choose', { name: profile.hero.name });
          const full = list.length >= data.game.maxProfiles;
          const asNew = button(t('parent.code.as.new'), async () => {
            if (list.some((x) => x.id === profile.id)) profile.id = `p${Date.now().toString(36)}`;
            await saveProfile(profile);
            await leave(profile);
          }, { cls: 'btn red' });
          asNew.disabled = full;
          choices.append(asNew);
          if (full) choices.append(h('p', { class: 'muted', text: t('title.full', { max: data.game.maxProfiles }) }));
          for (const old of list) {
            choices.append(button(t('parent.code.as.replace', { name: old.name }), async () => {
              if (!window.confirm(t('parent.code.replace.confirm', { old: old.name, name: profile.hero.name }))) return;
              await deleteProfile(old.id);
              profile.id = old.id;
              await saveProfile(profile);
              await leave(profile);
            }, { cls: 'btn paper' }));
          }
        }, { cls: 'btn red' }),
        choices,
      );
    }

    drawTabs();
    draw();
  });
}

registerModal('parent', async (ctx, opts = {}) => {
  if (await gate(ctx)) await parentArea(ctx, opts);
});

// The text with a capital first letter, for a list of choices.
function capital(text) {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}
