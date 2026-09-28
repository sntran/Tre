// Number cards for a number shield. The player taps cards to make the target.
// With '+' and '−', the player taps the sign between two cards to change it.
import { h, button } from './dom.js';
import { t, lang } from './i18n.js';
import { evaluateCards } from '../core/solver.js';
import { formatNumber } from '../core/i18n.js';

const SIGN = { '+': '+', '-': '−', '×': '×' };

export function renderCards(problem, { onSubmit }) {
  const el = h('div', { class: 'col', style: { alignItems: 'center', width: '100%' } });
  const expr = h('div', { class: 'expr', 'aria-live': 'polite' });
  const cardsRow = h('div', { class: 'cards' });
  let moves = [];
  let locked = false;
  const defaultOp = problem.ops.includes('×') ? '×' : '+';

  function render() {
    expr.replaceChildren();
    moves.forEach((m, i) => {
      if (i > 0) {
        if (problem.ops.length > 1) {
          const op = h('button', { class: 'op', type: 'button', text: SIGN[m.op], 'aria-label': SIGN[m.op] });
          op.addEventListener('click', () => {
            if (locked) return;
            const list = problem.ops;
            m.op = list[(list.indexOf(m.op) + 1) % list.length];
            render();
          });
          expr.append(op);
        } else {
          expr.append(h('span', { text: SIGN[m.op] }));
        }
      }
      expr.append(h('span', { class: 'slot', text: formatNumber(problem.cards[m.index], lang()) }));
    });
    if (moves.length) {
      expr.append(h('span', { class: 'total', text: t('battle.total', { total: evaluateCards(problem.cards, moves) }) }));
    } else {
      expr.append(h('span', { class: 'muted', text: '…' }));
    }
    [...cardsRow.children].forEach((c, i) => c.classList.toggle('used', moves.some((m) => m.index === i)));
    go.disabled = moves.length < 2;
  }

  problem.cards.forEach((v, i) => {
    const card = h('button', { class: 'card', type: 'button', text: formatNumber(v, lang()) });
    card.addEventListener('click', () => {
      if (locked || moves.some((m) => m.index === i)) return;
      if (problem.ops.includes('×') && moves.length >= 2) return;
      moves.push({ index: i, op: moves.length === 0 ? '+' : defaultOp });
      render();
    });
    cardsRow.append(card);
  });

  const go = button(t('battle.cards.go'), () => {
    if (!locked && moves.length >= 2) onSubmit(moves.map((m) => ({ ...m })));
  }, { cls: 'btn red' });
  const clearBtn = button(t('battle.cards.clear'), () => {
    if (locked) return;
    moves = [];
    render();
  }, { cls: 'btn paper small' });

  el.append(expr, cardsRow, h('div', { class: 'battle-actions' }, [clearBtn, go]));
  render();

  return {
    el,
    lock() { locked = true; },
    unlock() { locked = false; moves = []; render(); },
    highlight(index) {
      const c = cardsRow.children[index];
      if (c) {
        c.style.background = 'var(--yellow)';
        c.classList.add('pop');
      }
    },
    destroy() { el.remove(); },
  };
}
