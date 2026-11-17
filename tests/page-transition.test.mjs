import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { localNotesDestination, rememberNotesArrival, enterNotes } from '../src/page-transition.ts';

const bootstrap = readFileSync(new URL('../notes.html', import.meta.url), 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
function classes() {
  const set = new Set();
  return { add: value => set.add(value), remove: value => set.delete(value), contains: value => set.has(value) };
}
function style() {
  const values = new Map();
  return { setProperty: (key, value) => values.set(key, value), getPropertyValue: key => values.get(key) || '', removeProperty: key => values.delete(key) };
}
function boot(record, { navigation = 'navigate', reduced = false, unavailable = false } = {}) {
  const html = { classList: classes(), style: style(), dataset: {} };
  let removed = false, watchdog;
  const context = {
    document: { documentElement: html },
    localStorage: { getItem: () => 'dark' },
    sessionStorage: { getItem() { if (unavailable) throw new Error('blocked'); return record && JSON.stringify(record); }, removeItem() { removed = true; } },
    location: { pathname: '/garden/notes.html', search: '' },
    performance: { getEntriesByType: () => [{ type: navigation }] },
    matchMedia: query => ({ matches: query.includes('reduced-motion') ? reduced : true }),
    CSS: { supports: () => true },
    setTimeout: callback => { watchdog = callback; return 12; },
    Date,
  };
  runInNewContext(bootstrap, context);
  return { html, removed, watchdog };
}

test('handoff targets only the local notes document, including subpath hosting', () => {
  globalThis.location = { href: 'https://example.com/garden/index.html', origin: 'https://example.com' };
  assert.equal(localNotesDestination('./notes.html')?.pathname, '/garden/notes.html');
  assert.equal(localNotesDestination('https://elsewhere.test/garden/notes.html'), null);
  assert.equal(localNotesDestination('/notes.html'), null);
  assert.equal(localNotesDestination('./notes.html#note=one'), null);
  let stored;
  globalThis.sessionStorage = { setItem: (_key, value) => { stored = JSON.parse(value); } };
  assert.equal(rememberNotesArrival('./notes.html', 'rgb(66, 97, 206)', 1), true);
  assert.equal(stored.path, '/garden/notes.html');
  assert.equal(stored.color, 'rgb(66, 97, 206)');
  globalThis.sessionStorage = { setItem() { throw new Error('blocked'); } };
  assert.equal(rememberNotesArrival('./notes.html', '#4261ce', 1), false);
});

test('early mask is one-shot and rejects reloads, stale tokens, reduced motion, or disabled storage', () => {
  const record = { path: '/garden/notes.html', time: Date.now(), color: 'rgb(76, 99, 193)', speed: 1 };
  const first = boot(record);
  assert.ok(first.html.classList.contains('notes-arriving'));
  assert.equal(first.html.style.getPropertyValue('--notes-arrival-color'), record.color);
  assert.ok(first.removed);
  first.watchdog();
  assert.ok(!first.html.classList.contains('notes-arriving'));
  assert.equal(first.html.dataset.arrivalTimeout, undefined);
  for (const scenario of [boot(null), boot(record, { navigation: 'reload' }), boot(record, { reduced: true }), boot(record, { unavailable: true }), boot({ ...record, time: Date.now() - 20000 }), boot({ ...record, path: '/other.html' })]) {
    assert.ok(!scenario.html.classList.contains('notes-arriving'));
  }
});

test('destination reveals content, releases input, and removes the cover on completion or failure', async () => {
  const env = boot({ path: '/garden/notes.html', time: Date.now(), color: '#4261ce', speed: 1 });
  const animations = [];
  const listeners = new Map();
  let removed = false, throws = false;
  const cover = { style: {}, className: '', setAttribute() {}, remove() { removed = true; }, animate(frames, options) {
    if (throws) throw new Error('animation unsupported');
    const animation = { frames, options, finished: Promise.resolve(), cancel() {}, finish() {} };
    animations.push(animation);
    return animation;
  } };
  globalThis.document = { documentElement: env.html, createElement: () => cover, body: { append() {} } };
  globalThis.window = { addEventListener: (event, callback) => listeners.set(event, callback), removeEventListener: event => listeners.delete(event) };
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  globalThis.innerWidth = 1280;
  globalThis.innerHeight = 800;
  globalThis.getComputedStyle = () => ({ opacity: '1' });
  const target = { getBoundingClientRect: () => ({ left: 100, top: 300, width: 320, height: 326, bottom: 626 }) };
  const root = { inert: false, querySelector: () => target, querySelectorAll: () => [] };
  await enterNotes(root);
  assert.equal(root.inert, false);
  assert.ok(removed);
  assert.ok(!env.html.classList.contains('notes-arriving'));
  assert.equal(listeners.size, 0);
  assert.equal(animations[0].frames[0].opacity, 1);
  assert.equal(animations[0].options.duration, 1400);
  assert.equal(animations[0].options.easing, 'cubic-bezier(.42,0,.22,1)');
  assert.equal(animations[0].frames.at(-1).opacity, 0);
  assert.match(animations[0].frames.at(-1).transform, /translate\(100px, 300px\)/);
  env.html.classList.add('notes-arriving');
  throws = true;
  removed = false;
  await assert.rejects(enterNotes(root));
  assert.equal(root.inert, false);
  assert.ok(removed);
});
