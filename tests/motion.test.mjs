import test from 'node:test';
import assert from 'node:assert/strict';
import { createReaderMotion } from '../src/pages/notes/reader-motion.ts';
import { createCollectionMotion } from '../src/pages/notes/collection-motion.ts';
import { createPaperMotion } from '../src/pages/notes/paper-motion.ts';

const config = { transitionSpeed: 1, responsiveMotion: true, softness: 1.1, breeze: true };
function environment() {
  const media = new Map();
  const callbacks = new Map();
  let frameId = 0;
  const events = () => ({ listeners: new Map(), addEventListener(type, listener) { this.listeners.set(type, listener); } });
  globalThis.window = events();
  globalThis.document = { ...events(), hidden: false };
  globalThis.innerWidth = 1280;
  globalThis.innerHeight = 800;
  globalThis.matchMedia = query => {
    if (!media.has(query)) media.set(query, { ...events(), matches: query.includes('pointer: fine') });
    return media.get(query);
  };
  globalThis.requestAnimationFrame = callback => { callbacks.set(++frameId, callback); return frameId; };
  globalThis.cancelAnimationFrame = id => callbacks.delete(id);
  globalThis.getComputedStyle = () => ({ transform: 'none', opacity: '1', getPropertyValue: () => '-1.6deg' });
  const animations = [];
  function animate(frames, options) {
    let resolve, reject;
    const finished = new Promise((res, rej) => { resolve = res; reject = rej; });
    const animation = { frames, options, finished, cancelled: false, finish: resolve, cancel() { this.cancelled = true; reject(new Error('cancelled')); } };
    animations.push(animation);
    return animation;
  }
  const style = () => ({ values: new Map(), setProperty(name, value) { this.values.set(name, value); }, getPropertyValue(name) { return this.values.get(name) || ""; }, removeProperty(name) { this.values.delete(name); } });
  const tick = now => { const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(callback => callback(now)); };
  return { media, callbacks, events, animations, animate, style, tick };
}

test('reader transitions are unhurried, share portal speed, and supersede stale closes', async () => {
  const env = environment();
  const article = { animate: env.animate };
  const dialog = { animate: env.animate, style: env.style(), querySelector: () => article, classList: { add() {}, remove() {} }, getBoundingClientRect: () => ({ left: 290, top: 50, width: 700, height: 700 }) };
  const card = { getBoundingClientRect: () => ({ left: 60, top: 250, right: 380, bottom: 570, width: 320, height: 320 }) };
  const motion = createReaderMotion(dialog, config);
  for (const kind of ['unfold', 'lift', 'turn', 'fade']) {
    const opening = motion.open(card, kind);
    const current = env.animations.slice(-2);
    assert.ok(current.every(animation => animation.options.duration <= 720));
    assert.ok(current[0].options.duration >= 420);
    assert.ok(current.every(animation => !animation.options.delay));
    current.forEach(animation => animation.finish());
    await opening;
  }
  const closing = motion.close(card, 'turn');
  assert.equal(env.animations.at(-1).options.duration, 420);
  const reopening = motion.open(card, 'lift');
  assert.equal(await closing, false);
  env.animations.slice(-2).forEach(animation => animation.finish());
  await reopening;
  const fast = createReaderMotion(dialog, { ...config, transitionSpeed: 2 });
  const opening = fast.open(card, 'unfold');
  assert.equal(env.animations.at(-2).options.duration, 360);
  env.animations.slice(-2).forEach(animation => animation.finish());
  await opening;
  env.media.get('(prefers-reduced-motion: reduce)').matches = true;
  const count = env.animations.length;
  await fast.open(card, 'turn');
  assert.equal(await fast.close(card, 'turn'), true);
  assert.equal(env.animations.length, count);
});

test('category layout reuses retained cards, cleans ghosts, and cancels rapid changes', async () => {
  const env = environment();
  const rect = (left, top, width = 320, height = 326) => ({ left, top, width, height });
  const ghostNodes = [];
  const empty = { hidden: true, animate: env.animate };
  const container = { animate: env.animate, getBoundingClientRect: () => rect(20, 350, 1000, grid.children.length > 1 ? 680 : 326), querySelector: () => empty, append(node) { ghostNodes.push(node); } };
  const grid = { children: [] };
  function card(id) {
    return { id, parentElement: grid, animate: env.animate, getBoundingClientRect() { return rect(20 + grid.children.indexOf(this) * 340, 350); }, cloneNode() { return { style: {}, classList: { add() {} }, setAttribute() {}, animate: env.animate, remove() { const index = ghostNodes.indexOf(this); if (index >= 0) ghostNodes.splice(index, 1); } }; } };
  }
  const a = card('a'), b = card('b'), c = card('c');
  grid.children = [a, b, c];
  const motion = createCollectionMotion(container, grid, config);
  motion.change(() => { a.parentElement = null; c.parentElement = null; grid.children = [b]; });
  assert.equal(ghostNodes.length, 2);
  assert.ok(env.animations.some(animation => animation.frames[0].transform === 'translate(340px, 0px)'));
  assert.equal(grid.children[0], b);
  const previousAnimations = [...env.animations];
  motion.change(() => { a.parentElement = grid; grid.children = [a, b]; });
  assert.ok(previousAnimations.every(animation => animation.cancelled));
  assert.equal(ghostNodes.length, 0);
  env.animations.forEach(animation => animation.finish());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ghostNodes.length, 0);
  assert.ok(env.animations.every(animation => animation.cancelled));
  env.media.get('(prefers-reduced-motion: reduce)').matches = true;
  const count = env.animations.length;
  motion.change(() => { a.parentElement = null; grid.children = [b]; });
  assert.equal(env.animations.length, count);
});

test('paper follows pointer with spring inertia, returns to rest, and skips touch', () => {
  const env = environment();
  const grid = env.events();
  const classes = new Set();
  const paper = { classList: { add: name => classes.add(name), remove: name => classes.delete(name) }, isConnected: true, style: env.style(), parentElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 326 }) } };
  const motion = createPaperMotion(grid, config, () => false);
  const target = { closest: () => paper };
  grid.listeners.get('pointermove')({ target, clientX: 310, clientY: 40, pointerType: 'mouse', buttons: 0 });
  assert.ok(classes.has('paper-moving'));
  for (let i = 1; i <= 90; i++) env.tick(i * 16.667);
  assert.ok(parseFloat(paper.style.values.get('--paper-ry')) > 3);
  assert.ok(parseFloat(paper.style.values.get('--paper-y')) < -6);
  assert.ok(parseFloat(paper.style.values.get('--paper-scale')) > 1);
  motion.release();
  for (let i = 91; i <= 300; i++) env.tick(i * 16.667);
  assert.equal(paper.style.values.get('--paper-ry'), '0deg');
  assert.equal(paper.style.values.get('--paper-y'), '0px');
  assert.equal(paper.style.values.get('--paper-scale'), '1');
  assert.ok(!classes.has('paper-moving'));
  assert.equal(env.callbacks.size, 0);
  grid.listeners.get('pointermove')({ target, clientX: 310, clientY: 40, pointerType: 'touch', buttons: 0 });
  assert.equal(env.callbacks.size, 0);
  motion.reset();
});

test('reader turns keep old content until exit and animate new content and height together', async () => {
  const env = environment();
  let height = 480, content = 'old';
  const classes = new Set();
  const article = { animate: env.animate };
  const dialog = { open: true, animate: env.animate, style: env.style(), querySelector: () => article,
    classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
    getBoundingClientRect: () => ({ height }) };
  const motion = createReaderMotion(dialog, config);
  const turn = motion.change(1, () => { content = 'new'; height = 650; });
  assert.equal(content, 'old');
  assert.equal(env.animations.length, 1);
  assert.equal(env.animations[0].frames.at(-1).transform, 'translateX(-24px)');
  assert.equal(dialog.style.getPropertyValue('height'), '480px');
  env.animations[0].finish();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(content, 'new');
  assert.equal(env.animations[1].frames[0].transform, 'translateX(24px)');
  assert.deepEqual(env.animations[2].frames, [{ height: '480px' }, { height: '650px' }]);
  env.animations.slice(1).forEach(animation => animation.finish());
  assert.equal(await turn, true);
  assert.equal(dialog.style.getPropertyValue('height'), '');
  assert.ok(!classes.has('reader-changing'));
  assert.ok(env.animations.every(animation => animation.cancelled));
});

test('rapid page turns and closing cancel stale content commits; reduced motion stays immediate', async () => {
  const env = environment();
  let content = 'first';
  const article = { animate: env.animate };
  const dialog = { open: true, animate: env.animate, style: env.style(), querySelector: () => article,
    classList: { add() {}, remove() {} }, getBoundingClientRect: () => ({ height: 480 }) };
  const motion = createReaderMotion(dialog, config);
  const obsolete = motion.change(1, () => { content = 'obsolete'; });
  const latest = motion.change(-1, () => { content = 'latest'; });
  assert.equal(await obsolete, false);
  assert.equal(content, 'first');
  assert.equal(env.animations.at(-1).frames.at(-1).transform, 'translateX(24px)');
  env.animations.at(-1).finish();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(content, 'latest');
  assert.equal(env.animations.at(-1).frames[0].transform, 'translateX(-24px)');
  env.animations.at(-1).finish();
  assert.equal(await latest, true);
  const interrupted = motion.change(1, () => { content = 'must not appear'; });
  const closing = motion.close(null, 'fade');
  assert.equal(await interrupted, false);
  env.animations.at(-1).finish();
  assert.equal(await closing, true);
  assert.equal(content, 'latest');
  assert.equal(dialog.style.getPropertyValue('height'), '');
  env.media.get('(prefers-reduced-motion: reduce)').matches = true;
  const count = env.animations.length;
  assert.equal(await motion.change(1, () => { content = 'reduced'; }), true);
  assert.equal(content, 'reduced');
  assert.equal(env.animations.length, count);
});
