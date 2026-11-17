import test from 'node:test';
import assert from 'node:assert/strict';
import { warmContentPage } from '../src/shared/page-navigation.ts';

test('only one destination is warmed, without module compilation, and requests/links are released on exit', async () => {
  globalThis.location = { href: 'https://example.com/garden/index.html', origin: 'https://example.com' };
  const links = [], requests = [], timers = new Map();
  let id = 0;
  globalThis.window = new EventTarget();
  window.setTimeout = callback => { timers.set(++id, callback); return id; };
  const originalClearTimeout = globalThis.clearTimeout;
  globalThis.clearTimeout = key => timers.delete(key);
  const node = (rel, href, src) => ({ getAttribute: name => ({ rel, href, src })[name] });
  globalThis.DOMParser = class { parseFromString() { return { querySelectorAll: () => [
    node('stylesheet', './style.css'), node('modulepreload', './shared.js'), node(null, null, './notes.js'),
    node('modulepreload', './shared.js'), node('modulepreload', 'https://external.test/extra.js'),
  ] }; } };
  globalThis.document = {
    createElement: () => ({ remove() { const at = links.indexOf(this); if (at >= 0) links.splice(at, 1); } }),
    head: { append: link => links.push(link) },
  };
  globalThis.fetch = (url, options) => new Promise(resolve => { requests.push({ url, options, resolve }); });
  try {
    warmContentPage('./notes.html');
    warmContentPage('./notes.html');
    assert.equal(requests.length, 1);
    requests[0].resolve({ ok: true, text: async () => '<html></html>' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(links.length, 3);
    assert.ok(links.every(link => link.rel === 'preload'));
    assert.deepEqual(links.map(link => link.as), ['style', 'script', 'script']);
    warmContentPage('./profile.html', 'profile');
    assert.equal(requests[0].options.signal.aborted, true);
    assert.equal(links.length, 0);
    assert.equal(timers.size, 1);
    window.dispatchEvent(new Event('pagehide'));
    assert.equal(requests[1].options.signal.aborted, true);
    assert.equal(timers.size, 0);
    requests[1].resolve({ ok: true, text: async () => '<html></html>' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(links.length, 0, 'late response cannot recreate preload nodes in bfcache');
  } finally { globalThis.clearTimeout = originalClearTimeout; }
});
