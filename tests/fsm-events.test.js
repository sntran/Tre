import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMachine } from '../src/core/fsm.js';
import { createBus } from '../src/core/events.js';

function door() {
  const log = [];
  const m = createMachine({
    initial: 'closed',
    context: { locked: false, opens: 0 },
    states: {
      closed: {
        on: {
          OPEN: { target: 'open', guard: (ctx) => !ctx.locked, action: (ctx) => { ctx.opens++; } },
          LOCK: { action: (ctx) => { ctx.locked = true; } },
        },
        exit: () => log.push('exit closed'),
      },
      open: { on: { CLOSE: 'closed' }, enter: () => log.push('enter open') },
    },
  });
  return { m, log };
}

test('the machine changes state only on known events', () => {
  const { m, log } = door();
  assert.equal(m.state, 'closed');
  assert.equal(m.send('CLOSE'), false);
  assert.equal(m.state, 'closed');
  assert.equal(m.send('OPEN'), true);
  assert.equal(m.state, 'open');
  assert.deepEqual(log, ['exit closed', 'enter open']);
  assert.equal(m.context.opens, 1);
});

test('a guard can stop an event', () => {
  const { m } = door();
  m.send('LOCK');
  assert.equal(m.state, 'closed');
  assert.equal(m.can('OPEN'), false);
  assert.equal(m.send('OPEN'), false);
  assert.equal(m.state, 'closed');
});

test('an unknown target is an error when the machine is made', () => {
  assert.throws(() => createMachine({ initial: 'a', states: { a: { on: { GO: 'nowhere' } } } }));
});

test('onChange() tells about each change', () => {
  const { m } = door();
  const changes = [];
  m.onChange((c) => changes.push(`${c.from}>${c.to}`));
  m.send('OPEN');
  m.send('CLOSE');
  assert.deepEqual(changes, ['closed>open', 'open>closed']);
});

test('the bus sends events to handlers', () => {
  const bus = createBus();
  const got = [];
  const off = bus.on('hit', (p) => got.push(p));
  bus.once('hit', (p) => got.push(`once ${p}`));
  bus.on('*', (type, p) => got.push(`${type}:${p}`));
  bus.emit('hit', 1);
  bus.emit('hit', 2);
  off();
  bus.emit('hit', 3);
  assert.deepEqual(got, [1, 'once 1', 'hit:1', 2, 'hit:2', 'hit:3']);
});
