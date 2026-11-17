import test from 'node:test';
import assert from 'node:assert/strict';
import { leafSurfaceRatios, fallPose } from '../src/effects/leaf-motion.ts';
import { initLeaves } from '../src/effects/leaves.ts';

class Element extends EventTarget {
  dataset = {};
  hidden = false;
  disabled = false;
  isConnected = true;
  attrs = new Map();
  styles = new Map();
  classes = new Set();
  style = { setProperty: (key, value) => this.styles.set(key, value) };
  classList = { add: key => this.classes.add(key), remove: key => this.classes.delete(key), contains: key => this.classes.has(key) };
  setAttribute(key, value) { this.attrs.set(key, value); }
  appendChild() {}
  querySelectorAll() { return []; }
  getBoundingClientRect() { return { left: 0, top: 0, right: this.clientWidth, bottom: this.clientHeight, width: this.clientWidth, height: this.clientHeight }; }
}
function context() {
  const data = { drawCount: 0, renders: 0, poses: [], translate(x, y) { data.poses.push([x, y]); }, clearRect() { data.renders++; data.drawCount = 0; data.poses = []; }, drawImage() { data.drawCount++; }, isPointInPath() { return false; }, createLinearGradient() { return { addColorStop() {} }; } };
  return new Proxy(data, { get(target, key) { return key in target ? target[key] : () => {}; } });
}
function canvas() {
  const element = new Element();
  element.context = context();
  element.getContext = () => element.context;
  return element;
}
function event(target, type, values = {}) {
  const e = new Event(type);
  for (const [key, value] of Object.entries(values)) Object.defineProperty(e, key, { value });
  target.dispatchEvent(e);
}

test('paused engine stays empty after resize, theme change and history return; resume replenishes and pause settles without a frame loop', () => {
  let time = 1000, id = 0;
  const timers = new Map();
  const frames = new Map(), resizeObservers = [], mutations = [];
  globalThis.performance = { now: () => time };
  globalThis.requestAnimationFrame = callback => { frames.set(++id, callback); return id; };
  globalThis.cancelAnimationFrame = key => frames.delete(key);
  globalThis.devicePixelRatio = 2;
  globalThis.Path2D = class { moveTo() {} quadraticCurveTo() {} lineTo() {} closePath() {} };
  globalThis.getComputedStyle = () => ({ color: '#e0c366' });
  globalThis.MutationObserver = class { constructor(callback) { this.callback = callback; mutations.push(this); } observe(target) { this.target = target; } disconnect() {} };
  globalThis.ResizeObserver = class { constructor(callback) { resizeObservers.push(callback); } observe() {} };
  globalThis.IntersectionObserver = class { constructor() {} observe() {} };
  globalThis.window = new EventTarget();
  window.setTimeout = (callback, delay) => { timers.set(++id, { callback, at: time + delay }); return id; };
  globalThis.clearTimeout = key => timers.delete(key);
  globalThis.document = new EventTarget();
  document.hidden = false;
  document.createElement = tag => tag === 'canvas' ? canvas() : new Element();
  const reduced = new EventTarget();
  reduced.matches = false;
  globalThis.matchMedia = () => reduced;
  const storage = new Map([['ginkgo-leaves-paused', 'true']]);
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const root = new Element(), page = new Element(), foreground = canvas(), canopy = canvas(), button = new Element(), status = new Element();
  page.clientWidth = 800; page.clientHeight = 600; page.dataset.theme = 'light';
  root.querySelector = selector => ({ '.qp-page': page, '.qp-leaves': foreground, '.qp-canopy': canopy, '.qp-wind-button': button, '.qp-announcement, #announcement': status })[selector] ?? null;
  initLeaves(root, { enabled: true, desktopCount: 8, mobileCount: 4, mobileBreakpoint: 600, size: 1, refillDelay: 4, refillInterval: .32, breezeSpeed: 1, gustStrength: 1, pointerRadius: 90, clickRadius: 225, maxFps: 60, maxPixelRatio: 2 });
  const advance = milliseconds => {
    const end = time + milliseconds;
    while (time < end) {
      time += 1000 / 60;
      for (const [key, timer] of timers) if (timer.at <= time) { timers.delete(key); timer.callback(); }
      const current = [...frames.values()]; frames.clear(); current.forEach(callback => callback(time)); }
  };
  assert.equal(foreground.context.drawCount, 0);
  assert.equal(frames.size, 0);
  assert.equal(foreground.width * foreground.height, 1);
  assert.equal(canopy.width * canopy.height, 1);
  page.clientWidth = 900;
  resizeObservers.forEach(callback => callback());
  mutations.find(observer => observer.target === page).callback([{ attributeName: 'data-theme' }]);
  event(window, 'pageshow');
  advance(10000);
  assert.equal(foreground.context.drawCount, 0);
  assert.equal(frames.size, 0);
  storage.set('ginkgo-leaves-paused', 'false');
  event(window, 'storage', { key: 'ginkgo-leaves-paused' });
  assert.equal(foreground.context.drawCount, 0, 'initial foliage does not pop into place');
  advance(250);
  assert.ok(foreground.context.drawCount > 0 && foreground.context.drawCount < 16, 'leaves arrive gradually');
  const initialRenders = foreground.context.renders;
  advance(500);
  assert.ok(foreground.context.renders - initialRenders >= 29, '60 Hz motion does not accidentally skip every other frame');
  for (let attempt = 0; attempt < 160 && frames.size; attempt++) advance(250);
  assert.ok(foreground.context.drawCount > 0);
  assert.equal(foreground.width, Math.floor(page.clientWidth * leafSurfaceRatios(page.clientWidth, page.clientHeight, 2, 2).foreground));
  assert.equal(canopy.width, page.clientWidth * .5);
  assert.equal(frames.size, 0, 'settled leaves sleep instead of drawing continuously');
  assert.equal(timers.size, 1, 'one wake-up for the next breeze');
  const before = foreground.context.poses.map(point => [...point]);
  page.clientWidth += 15; // Modal scroll locking may change the layout viewport.
  resizeObservers.forEach(callback => callback());
  assert.equal(foreground.context.drawCount, before.length);
  foreground.context.poses.forEach((point, index) => {
    assert.ok(Math.abs(point[1] - before[index][1]) < .0001, 'resize retains each leaf instead of reseeding');
  });
  const beforeHide = foreground.context.poses.map(point => [...point]);
  document.hidden = true;
  event(document, 'visibilitychange');
  assert.equal(foreground.width * foreground.height, 1);
  assert.equal(canopy.width * canopy.height, 1);
  assert.equal(frames.size, 0);
  assert.equal(timers.size, 0);
  document.hidden = false;
  event(document, 'visibilitychange');
  assert.deepEqual(foreground.context.poses, beforeHide);
  advance(80);
  assert.ok(foreground.context.drawCount > 0);
  // Leaving through the portal must preserve leaves, not clear them.
  page.classList.add('qp-entering');
  mutations.find(observer => observer.target === page).callback([{ attributeName: 'class' }]);
  assert.ok(foreground.context.drawCount > 0);
  page.classList.remove('qp-entering');
  event(window, 'pagehide');
  // Late observer/theme/visibility callbacks cannot resurrect a cached page's bitmaps.
  resizeObservers.forEach(callback => callback());
  mutations.find(observer => observer.target === page).callback([{ attributeName: 'data-theme' }]);
  event(document, 'visibilitychange');
  advance(500);
  assert.equal(frames.size, 0);
  assert.equal(timers.size, 0);
  assert.equal(foreground.width, 1);
  assert.equal(canopy.width, 1);
  event(window, 'pageshow');
  advance(80);
  assert.ok(foreground.context.drawCount > 0);
  storage.set('ginkgo-leaves-paused', 'true');
  event(window, 'storage', { key: 'ginkgo-leaves-paused' });
  advance(5000);
  assert.equal(foreground.context.drawCount, 0);
  assert.equal(frames.size, 0);
  assert.equal(foreground.width * foreground.height, 1);
  assert.equal(canopy.width * canopy.height, 1);
  advance(15000);
  assert.equal(foreground.context.drawCount, 0);
  reduced.matches = true;
  storage.set('ginkgo-leaves-paused', 'false');
  event(window, 'storage', { key: 'ginkgo-leaves-paused' });
  advance(40);
  assert.ok(foreground.context.drawCount > 0);
  storage.set('ginkgo-leaves-paused', 'true');
  event(window, 'storage', { key: 'ginkgo-leaves-paused' });
  assert.equal(foreground.context.drawCount, 0);
  assert.equal(frames.size, 0);
});

test('decorative bitmaps stay within their budgets at high DPI and 4K', () => {
  for (const [w, h, dpr] of [[390, 844, 3], [1920, 1080, 2], [3840, 2160, 3], [7680, 4320, 2]]) {
    const ratios = leafSurfaceRatios(w, h, dpr, 1.25);
    assert.ok(Math.floor(w * ratios.foreground) * Math.floor(h * ratios.foreground) <= 2_097_152);
    assert.ok(Math.floor(w * ratios.canopy) * Math.floor(h * ratios.canopy) <= 262_144);
    assert.ok(ratios.foreground <= 1.25 && ratios.canopy <= .5);
  }
});

test('falling leaves descend continuously and settle without a position or speed jump', () => {
  const fall = { from: { x: 200, y: -70 }, to: { x: 310, y: 700 }, started: 0, duration: 11 };
  let previous = fallPose(fall, 0, .7);
  for (let frame = 1; frame <= 660; frame++) {
    const pose = fallPose(fall, frame / 60, .7);
    assert.ok(pose.y >= previous.y);
    assert.ok(Math.hypot(pose.x - previous.x, pose.y - previous.y) < 2.5);
    previous = pose;
  }
  assert.equal(previous.x, fall.to.x);
  assert.equal(previous.y, fall.to.y);
  assert.equal(previous.z, 0);
  assert.equal(previous.spin, 0);
  assert.equal(previous.done, true);
  const almost = fallPose(fall, 11 - 1 / 60, .7);
  assert.ok(Math.hypot(previous.x - almost.x, previous.y - almost.y) < .01);
});
