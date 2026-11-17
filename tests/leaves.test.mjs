import test from 'node:test';
import assert from 'node:assert/strict';
import { initLeaves } from '../src/leaves.ts';

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
  const data = { drawCount: 0, clearRect() { data.drawCount = 0; }, drawImage() { data.drawCount++; }, isPointInPath() { return false; }, createLinearGradient() { return { addColorStop() {} }; } };
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
  const frames = new Map(), resizeObservers = [], mutations = [];
  globalThis.performance = { now: () => time };
  globalThis.requestAnimationFrame = callback => { frames.set(++id, callback); return id; };
  globalThis.cancelAnimationFrame = key => frames.delete(key);
  globalThis.devicePixelRatio = 1;
  globalThis.Path2D = class { moveTo() {} quadraticCurveTo() {} lineTo() {} closePath() {} };
  globalThis.getComputedStyle = () => ({ color: '#e0c366' });
  globalThis.MutationObserver = class { constructor(callback) { this.callback = callback; mutations.push(this); } observe(target) { this.target = target; } disconnect() {} };
  globalThis.ResizeObserver = class { constructor(callback) { resizeObservers.push(callback); } observe() {} };
  globalThis.IntersectionObserver = class { constructor() {} observe() {} };
  globalThis.window = new EventTarget();
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
  initLeaves(root, { enabled: true, desktopCount: 8, mobileCount: 4, mobileBreakpoint: 600, size: 1, refillDelay: 4, refillInterval: .32, breezeSpeed: 1, gustStrength: 1, pointerRadius: 90, clickRadius: 225, maxFps: 45, maxPixelRatio: 2 });
  const advance = milliseconds => {
    const end = time + milliseconds;
    while (time < end) { time += 40; const current = [...frames.values()]; frames.clear(); current.forEach(callback => callback(time)); }
  };
  assert.equal(foreground.context.drawCount, 0);
  assert.equal(frames.size, 0);
  page.clientWidth = 900;
  resizeObservers.forEach(callback => callback());
  mutations.find(observer => observer.target === page).callback([{ attributeName: 'data-theme' }]);
  event(window, 'pageshow');
  advance(10000);
  assert.equal(foreground.context.drawCount, 0);
  assert.equal(frames.size, 0);
  storage.set('ginkgo-leaves-paused', 'false');
  event(window, 'storage', { key: 'ginkgo-leaves-paused' });
  advance(5000);
  assert.ok(foreground.context.drawCount > 0);
  storage.set('ginkgo-leaves-paused', 'true');
  event(window, 'storage', { key: 'ginkgo-leaves-paused' });
  advance(5000);
  assert.equal(foreground.context.drawCount, 0);
  assert.equal(frames.size, 0);
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
