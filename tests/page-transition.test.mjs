import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { localContentDestination, rememberPageArrival } from '../src/shared/page-navigation.ts';
import { enterPage, paperArrivalTransform } from '../src/shared/page-transition.ts';

const bootstrap = readFileSync(new URL('../src/shared/bootstrap.js', import.meta.url), 'utf8').replace('export function', 'function');
function classes() {
  const set = new Set();
  return { add: value => set.add(value), remove: value => set.delete(value), contains: value => set.has(value) };
}
function style() {
  const values = new Map();
  return { setProperty: (key, value) => values.set(key, value), getPropertyValue: key => values.get(key) || '', removeProperty: key => values.delete(key) };
}
function boot(record, { navigation = 'navigate', reduced = false, unavailable = false, page = 'notes', defaultTheme = 'system', responsiveMotion = true, savedTheme = 'dark' } = {}) {
  const html = { classList: classes(), style: style(), dataset: {} };
  let removed = false, watchdog;
  const context = {
    document: { documentElement: html },
    localStorage: { getItem() { if (unavailable) throw new Error('blocked'); return savedTheme; } },
    sessionStorage: { getItem() { if (unavailable) throw new Error('blocked'); return record && JSON.stringify(record); }, removeItem() { removed = true; } },
    location: { pathname: `/garden/${page}.html`, search: '' },
    performance: { getEntriesByType: () => [{ type: navigation }] },
    matchMedia: query => ({ matches: query.includes('reduced-motion') ? reduced : true }),
    CSS: { supports: () => true },
    setTimeout: callback => { watchdog = callback; return 12; },
    Date,
    settings: { page, defaultTheme, responsiveMotion },
  };
  runInNewContext(bootstrap + "\nbootstrapPage(settings);", context);
  return { html, removed, watchdog };
}

test('handoff targets only the local notes document, including subpath hosting', () => {
  globalThis.location = { href: 'https://example.com/garden/index.html', origin: 'https://example.com' };
  assert.equal(localContentDestination('./notes.html')?.pathname, '/garden/notes.html');
  assert.equal(localContentDestination('https://elsewhere.test/garden/notes.html'), null);
  assert.equal(localContentDestination('/notes.html'), null);
  assert.equal(localContentDestination('./notes.html#note=one'), null);
  let stored;
  globalThis.sessionStorage = { setItem: (_key, value) => { stored = JSON.parse(value); } };
  assert.equal(rememberPageArrival('./notes.html', 'rgb(66, 97, 206)', 1), true);
  assert.equal(stored.path, '/garden/notes.html');
  assert.equal(stored.color, 'rgb(66, 97, 206)');
  globalThis.sessionStorage = { setItem() { throw new Error('blocked'); } };
  assert.equal(rememberPageArrival('./notes.html', '#4261ce', 1), false);
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
  const cover = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1265, height: 800 }), style: {}, className: '', setAttribute() {}, remove() { removed = true; }, animate(frames, options) {
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
  globalThis.getComputedStyle = () => ({ opacity: '1', getPropertyValue: () => '0deg', backgroundColor: 'rgb(66, 97, 206)', borderTopLeftRadius: '2px', borderTopRightRadius: '2px', borderBottomRightRadius: '19px', borderBottomLeftRadius: '2px' });
  const target = { animate: cover.animate.bind(cover), offsetWidth: 320, offsetHeight: 326, getBoundingClientRect: () => ({ left: 100, top: 300, width: 320, height: 326, bottom: 626 }) };
  const root = { inert: false, style: style(), getBoundingClientRect() {
    assert.ok(!env.html.classList.contains('notes-arriving'));
    assert.ok(!env.html.classList.contains('page-arriving'));
    return { width: 1265 };
  }, querySelector: () => target, querySelectorAll: () => [] };
  await enterPage(root);
  assert.equal(root.inert, false);
  assert.ok(removed);
  assert.ok(!env.html.classList.contains('notes-arriving'));
  assert.equal(listeners.size, 0);
  assert.equal(animations[0].frames[0].transform, 'matrix(1, 0, 0, 1, 0, 0)');
  assert.equal(cover.style.width, '1280px');
  assert.equal(cover.style.height, '800px');
  assert.equal(animations[0].frames.at(-1).transform, 'matrix(0.25, 0, 0, 0.4075, 100, 300)');
  assert.equal(animations[0].options.duration, 1400);
  assert.equal(animations[0].options.easing, 'cubic-bezier(.42,0,.22,1)');
  assert.equal(animations[0].frames.at(-1).backgroundColor, 'rgb(66, 97, 206)');
  assert.equal(animations[1].frames.at(-1).opacity, 0);
  assert.equal(animations[1].options.delay, 1400);
  assert.equal(animations[1].options.duration, 360);
  assert.equal(animations[2].options.delay, animations[0].options.duration);
  assert.equal(animations[2].options.duration, 0);
  assert.equal(animations[2].frames[0].opacity, 0);
  assert.ok(!env.html.classList.contains('page-arriving'));
  assert.equal(root.style.getPropertyValue('--arrival-content-width'), '');
  env.html.classList.add('notes-arriving');
  throws = true;
  removed = false;
  await assert.rejects(enterPage(root));
  assert.equal(root.inert, false);
  assert.ok(removed);
  assert.ok(!env.html.classList.contains('page-arriving'));
  assert.equal(root.style.getPropertyValue('--arrival-content-width'), '');
});


test('Profile arrival is local and isolated from the Notes handoff', () => {
  globalThis.location = { href: 'https://example.com/garden/index.html', origin: 'https://example.com' };
  const records = new Map();
  globalThis.sessionStorage = { setItem: (key, value) => records.set(key, JSON.parse(value)) };
  assert.equal(localContentDestination('./profile.html', 'profile')?.pathname, '/garden/profile.html');
  assert.equal(localContentDestination('./notes.html', 'profile'), null);
  assert.equal(localContentDestination('https://elsewhere.test/profile.html', 'profile'), null);
  assert.equal(localContentDestination('./profile.html#education', 'profile'), null);
  assert.ok(rememberPageArrival('./profile.html', '#fff', 1, 'profile'));
  assert.ok(records.has('ginkgo-profile-arrival'));
  assert.ok(!records.has('ginkgo-notes-arrival'));
  assert.equal(records.get('ginkgo-profile-arrival').path, '/garden/profile.html');
});

test('first paint uses configured themes even when storage is blocked or invalid', () => {
  assert.equal(boot(null, { unavailable: true, defaultTheme: 'dark' }).html.style.colorScheme, 'dark');
  assert.equal(boot(null, { savedTheme: 'invalid', defaultTheme: 'light' }).html.style.colorScheme, 'light');
  const record = { path: '/garden/notes.html', time: Date.now(), color: '#4261ce', speed: 1 };
  assert.ok(!boot(record, { responsiveMotion: false }).html.classList.contains('notes-arriving'));
  assert.ok(!boot(record, { navigation: 'back_forward' }).html.classList.contains('notes-arriving'));
});
test('Profile fades visible content without a cover or layout lock and cleans up interruptions', async () => {
  for (const outcome of ['complete', 'pagehide', 'failure', 'reduced']) {
    const env = boot({ path: '/garden/profile.html', time: Date.now(), color: '#fff', speed: 1 }, { page: 'profile' });
    const listeners = new Map();
    const animations = [];
    let cancelled = false;
    globalThis.document = { documentElement: env.html, createElement() { throw new Error('Profile must not create a cover'); } };
    globalThis.window = { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
    globalThis.matchMedia = () => ({ matches: outcome === 'reduced', addEventListener() {}, removeEventListener() {} });
    globalThis.innerHeight = 800;
    const visible = { getBoundingClientRect: () => ({ top: 100, bottom: 400 }), animate(frames, options) {
      assert.ok(!env.html.classList.contains('page-arriving'));
      assert.ok(!env.html.classList.contains('profile-arriving'));
      if (outcome === 'failure') throw new Error('animation unsupported');
      let resolve;
      const animation = { frames, options, finished: new Promise(done => { resolve = done; }), finish() { resolve(); }, cancel() { cancelled = true; resolve(); } };
      animations.push(animation);
      return animation;
    } };
    const offscreen = { getBoundingClientRect: () => ({ top: 900, bottom: 1200 }), animate() { throw new Error('Offscreen sections must not animate'); } };
    const root = { inert: false, style: style(), querySelectorAll: () => [visible, offscreen], getBoundingClientRect() { throw new Error('Profile must not freeze layout'); } };
    const pending = enterPage(root, 'profile');
    if (outcome === 'failure') await assert.rejects(pending);
    else {
      if (outcome === 'pagehide') listeners.get('pagehide')();
      else animations.forEach(animation => animation.finish());
      await pending;
    }
    if (outcome === 'complete' || outcome === 'pagehide') {
      assert.equal(animations.length, 1);
      assert.equal(animations[0].options.duration, 1400);
      assert.equal(animations[0].options.easing, 'ease-in-out');
      assert.deepEqual(animations[0].frames, [{ opacity: 0 }, { opacity: 1 }]);
      assert.ok(cancelled);
    }
    assert.equal(root.inert, false);
    assert.equal(listeners.size, 0);
    assert.ok(!env.html.classList.contains('profile-arriving'));
    assert.ok(!env.html.classList.contains('page-arriving'));
    assert.equal(root.style.getPropertyValue('--arrival-content-width'), '');
  }
});

test('cover endpoint follows the tilted paper corners instead of its enclosing rectangle', () => {
  for (const angle of [-1.6, 0, 3]) {
    const width = 320, height = 326;
    const cos = Math.cos(angle * Math.PI / 180), sin = Math.sin(angle * Math.PI / 180);
    const bounds = { left: 100, top: 300, width: Math.abs(cos) * width + Math.abs(sin) * height, height: Math.abs(sin) * width + Math.abs(cos) * height };
    const matrix = paperArrivalTransform(bounds, width, height, angle, { width: 1280, height: 800 });
    const [a, b, c, d, e, f] = matrix.slice(7, -1).split(',').map(Number);
    for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const actual = [a * x * 1280 + c * y * 800 + e, b * x * 1280 + d * y * 800 + f];
      const expected = [bounds.left + bounds.width / 2 + cos * (x - .5) * width - sin * (y - .5) * height,
        bounds.top + bounds.height / 2 + sin * (x - .5) * width + cos * (y - .5) * height];
      assert.ok(Math.abs(actual[0] - expected[0]) < 1e-9);
      assert.ok(Math.abs(actual[1] - expected[1]) < 1e-9);
    }
  }
});

test('arrival locks the scrollbar without widening content, and interruption restores layout', async () => {
  for (const gutter of [0, 15, 24]) {
    const env = boot({ path: '/garden/notes.html', time: Date.now(), color: '#4261ce', speed: 1 });
    const listeners = new Map();
    const running = [];
    let removed = false;
    const cover = { style: {}, setAttribute() {}, remove() { removed = true; }, animate(frames, options) {
      assert.ok(env.html.classList.contains('page-arriving'));
      assert.equal(root.style.getPropertyValue('--arrival-content-width'), `${1280 - gutter}px`);
      let resolve;
      const animation = { frames, options, finished: new Promise(done => { resolve = done; }), cancel() { resolve(); }, finish() { resolve(); } };
      running.push(animation);
      return animation;
    } };
    const targetWrapper = { animate: cover.animate.bind(cover), getBoundingClientRect() { throw new Error('target paper must not have a second entry animation'); } };
    const target = { offsetWidth: 320, offsetHeight: 326, parentElement: targetWrapper,
      getBoundingClientRect: () => ({ left: 100, top: 300, width: 329, height: 335, bottom: 635 }) };
    const root = { inert: false, style: style(), getBoundingClientRect: () => ({ width: 1280 - gutter }), querySelector: () => target,
      querySelectorAll: selector => selector === '.note' ? [targetWrapper] : [] };
    globalThis.document = { documentElement: env.html, createElement: () => cover, body: { append() {} } };
    globalThis.window = { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
    globalThis.innerWidth = 1280;
    globalThis.innerHeight = 800;
    globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    globalThis.getComputedStyle = () => ({ getPropertyValue: () => '-1.6deg', backgroundColor: '#4261ce' });
    const pending = enterPage(root);
    assert.equal(cover.style.width, '1280px');
    assert.equal(running.length, 3);
    assert.equal(root.inert, true);
    listeners.get(gutter === 24 ? 'pagehide' : 'resize')();
    await pending;
    assert.equal(root.inert, false);
    assert.equal(removed, true);
    assert.equal(root.style.getPropertyValue('--arrival-content-width'), '');
    assert.ok(!env.html.classList.contains('page-arriving'));
    assert.equal(listeners.size, 0);
  }
});

test('Profile direct visits and reloads fade in without storage, but history restores immediately', () => {
  for (const options of [{}, { navigation: 'reload' }, { unavailable: true }]) {
    const env = boot(null, { page: 'profile', ...options });
    assert.ok(env.html.classList.contains('profile-arriving'));
    env.watchdog();
    assert.ok(!env.html.classList.contains('profile-arriving'));
  }
  for (const options of [{ navigation: 'back_forward' }, { reduced: true }, { responsiveMotion: false }]) {
    assert.ok(!boot(null, { page: 'profile', ...options }).html.classList.contains('profile-arriving'));
  }
});
