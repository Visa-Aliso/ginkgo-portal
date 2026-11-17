import test from 'node:test';
import assert from 'node:assert/strict';
import { bindSectionDisclosure } from '../src/pages/profile/section-motion.ts';

test('disclosure reverses cleanly, releases animation references, and settles before print', async () => {
  const callbacks = new Map();
  globalThis.window = { addEventListener: (name, callback) => callbacks.set(name, callback) };
  globalThis.document = { hidden: false, addEventListener: (name, callback) => callbacks.set(name, callback) };
  const reduced = { matches: false, addEventListener: (name, callback) => callbacks.set('reduced', callback) };
  globalThis.matchMedia = () => reduced;
  const animations = [];
  function animate(frames, options) {
    let resolve, reject;
    const animation = { frames, options, cancelled: false, finished: new Promise((yes, no) => { resolve = yes; reject = no; }), finish: () => resolve(), cancel() { this.cancelled = true; reject(new Error('cancelled')); } };
    animations.push(animation);
    return animation;
  }
  const rows = Array.from({ length: 4 }, (_, i) => ({ hidden: i >= 2, animate }));
  const container = { style: { removeProperty(name) { delete this[name]; } }, animate, getBoundingClientRect: () => ({ height: rows.filter(row => !row.hidden).length * 100 }) };
  const button = { attrs: {}, setAttribute(name, value) { this.attrs[name] = value; }, addEventListener(name, cb) { callbacks.set(name, cb); } };
  bindSectionDisclosure(container, rows, button, 2, { transitionSpeed: 1, responsiveMotion: true });
  callbacks.get('click')();
  assert.equal(button.attrs['aria-expanded'], 'true');
  assert.equal(animations[0].options.duration, 560);
  const first = [...animations];
  callbacks.get('click')();
  assert.equal(button.attrs['aria-expanded'], 'false');
  assert.ok(first.every(animation => animation.cancelled));
  assert.ok(rows.every(row => !row.hidden)); // Remain mounted while collapsing.
  animations.forEach(animation => animation.finish());
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(rows.map(row => row.hidden), [false, false, true, true]);
  assert.equal(container.style.overflow, undefined);
  callbacks.get('click')();
  callbacks.get('beforeprint')();
  assert.ok(animations.every(animation => animation.cancelled));
  assert.ok(rows.every(row => !row.hidden));
  reduced.matches = true;
  const count = animations.length;
  callbacks.get('click')();
  assert.equal(animations.length, count);
  assert.deepEqual(rows.map(row => row.hidden), [false, false, true, true]);
});
