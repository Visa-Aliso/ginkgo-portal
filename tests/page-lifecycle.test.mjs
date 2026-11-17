import test from 'node:test';
import assert from 'node:assert/strict';
import { initPageLifecycle } from '../src/shared/page-lifecycle.ts';

test('cached/background pages skip rendering, preserve geometry and only resume when active', () => {
  globalThis.window = new EventTarget();
  globalThis.document = Object.assign(new EventTarget(), { hidden: false });
  const attrs = new Map(), styles = new Map();
  let measurements = 0;
  const root = {
    getBoundingClientRect() { measurements++; return { width: 1280, height: 2350 }; },
    style: { setProperty: (key, value) => styles.set(key, value), removeProperty: key => styles.delete(key) },
    setAttribute: (key, value) => attrs.set(key, value), removeAttribute: key => attrs.delete(key),
  };
  initPageLifecycle(root);
  assert.equal(attrs.size, 0);
  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  assert.ok(attrs.has('data-page-suspended'));
  assert.equal(styles.get('--suspended-size'), '1280px 2350px');
  window.dispatchEvent(new Event('pagehide'));
  document.hidden = false;
  document.dispatchEvent(new Event('visibilitychange'));
  assert.ok(attrs.has('data-page-suspended'));
  assert.equal(measurements, 1);
  window.dispatchEvent(new Event('pageshow'));
  assert.equal(attrs.size, 0);
  assert.equal(styles.size, 0);
});
