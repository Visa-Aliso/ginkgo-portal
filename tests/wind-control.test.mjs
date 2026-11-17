import test from 'node:test';
import assert from 'node:assert/strict';
import { bindWindControl, WIND_HOLD_MS } from '../src/wind-control.ts';

class Button extends EventTarget {
  disabled = false;
  dataset = {};
  attrs = new Map();
  classes = new Set();
  classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name) };
  style = { setProperty() {} };
  setAttribute(name, value) { this.attrs.set(name, value); }
}
function emit(target, type, values = {}) {
  const event = new Event(type, { cancelable: true });
  for (const [key, value] of Object.entries(values)) Object.defineProperty(event, key, { value });
  target.dispatchEvent(event);
  return event;
}
function environment(store = new Map(), blocked = false) {
  let now = 0, sequence = 0;
  const timers = new Map();
  const window = new EventTarget(), document = new EventTarget();
  document.hidden = false;
  globalThis.window = window;
  globalThis.document = document;
  globalThis.localStorage = {
    getItem: key => { if (blocked) throw new Error('blocked'); return store.get(key) ?? null; },
    setItem: (key, value) => { if (blocked) throw new Error('blocked'); store.set(key, value); },
  };
  globalThis.setTimeout = (callback, delay) => { const id = ++sequence; timers.set(id, { callback, at: now + delay }); return id; };
  globalThis.clearTimeout = id => timers.delete(id);
  let disabledChanged;
  globalThis.MutationObserver = class {
    constructor(callback) { disabledChanged = callback; }
    observe() {}
    disconnect() {}
  };
  const button = new Button(), changes = [];
  let clicks = 0;
  const control = bindWindControl(button, { clear: () => clicks++, pausedChanged: value => changes.push(value) });
  const advance = milliseconds => {
    now += milliseconds;
    for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); }
  };
  const down = () => emit(button, 'pointerdown', { button: 0, isPrimary: true, pointerId: 1, clientX: 10, clientY: 10 });
  const up = () => { emit(window, 'pointerup', { pointerId: 1 }); return emit(button, 'click'); };
  return { button, changes, control, store, window, document, timers, advance, down, up, disabledChanged: () => disabledChanged(), get clicks() { return clicks; } };
}

test('short click clears once; long press pauses and resumes without an extra click', () => {
  const env = environment();
  env.down(); env.advance(100); env.up();
  assert.equal(env.clicks, 1);
  assert.deepEqual(env.changes, []);
  env.down(); env.advance(WIND_HOLD_MS - 1);
  assert.equal(env.control.paused, false);
  env.advance(1);
  assert.equal(env.control.paused, true);
  assert.equal(env.button.dataset.leavesPaused, 'true');
  assert.equal(env.button.attrs.get('aria-pressed'), 'true');
  assert.equal(env.store.get('ginkgo-leaves-paused'), 'true');
  assert.ok(env.up().defaultPrevented);
  assert.equal(env.clicks, 1);
  env.down(); env.advance(WIND_HOLD_MS); env.up();
  assert.deepEqual(env.changes, [true, false]);
  assert.equal(env.clicks, 1);
  env.control.dispose();
});

test('moving away, cancelled touch, disabled button and hidden page cancel the hold', () => {
  for (const interrupt of [
    env => emit(env.window, 'pointermove', { pointerId: 1, clientX: 40, clientY: 10 }),
    env => emit(env.button, 'pointerleave'),
    env => emit(env.window, 'pointercancel'),
    env => emit(env.window, 'blur'),
    env => emit(env.window, 'pagehide'),
    env => { env.button.disabled = true; env.disabledChanged(); },
    env => { env.document.hidden = true; emit(env.document, 'visibilitychange'); },
  ]) {
    const env = environment();
    env.down(); env.advance(300); interrupt(env); env.advance(1000);
    assert.deepEqual(env.changes, []);
    assert.equal(env.timers.size, 0);
    assert.ok(!env.button.classes.has('wind-holding'));
    env.control.dispose();
  }
});

test('keyboard short press clears, long press toggles, and key repeat does not restart it', () => {
  const env = environment();
  emit(env.button, 'keydown', { key: 'Enter', repeat: false });
  env.advance(100);
  emit(env.button, 'keyup', { key: 'Enter' });
  assert.equal(env.clicks, 1);
  emit(env.button, 'keydown', { key: ' ', repeat: false });
  env.advance(400);
  emit(env.button, 'keydown', { key: ' ', repeat: true });
  env.advance(300);
  emit(env.button, 'keyup', { key: ' ' });
  assert.deepEqual(env.changes, [true]);
  assert.equal(env.clicks, 1);
  env.control.dispose();
});

test('pause preference survives a new page and refreshes on history restore', () => {
  const store = new Map();
  const first = environment(store);
  first.down(); first.advance(WIND_HOLD_MS); first.up();
  const second = environment(store);
  assert.equal(second.control.paused, true);
  second.down(); second.advance(WIND_HOLD_MS); second.up();
  assert.equal(store.get('ginkgo-leaves-paused'), 'false');
  emit(first.window, 'pageshow');
  assert.equal(first.control.paused, false);
  first.control.dispose(); second.control.dispose();
});

test('blocked storage still allows toggling and disposing cancels pending timers', () => {
  const env = environment(new Map(), true);
  env.down(); env.advance(WIND_HOLD_MS); env.up();
  assert.equal(env.control.paused, true);
  env.down(); env.advance(200); env.control.dispose(); env.advance(1000);
  assert.deepEqual(env.changes, [true]);
  assert.equal(env.timers.size, 0);
});
