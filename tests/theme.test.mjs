import test from 'node:test';
import assert from 'node:assert/strict';
import { initTheme } from '../src/theme.ts';

class Element extends EventTarget {
  dataset = {};
  style = {};
  attrs = new Map();
  hidden = true;
  setAttribute(key, value) { this.attrs.set(key, value); }
  toggleAttribute(key, enabled) { if (enabled) this.attrs.set(key, ''); else this.attrs.delete(key); }
  focus() { this.focused = true; }
}
function event(target, type, values = {}) {
  const e = new Event(type, { cancelable: true });
  for (const [key, value] of Object.entries(values)) Object.defineProperty(e, key, { value });
  target.dispatchEvent(e);
}

test('shared theme controller persists selection, follows system, and resyncs cached pages', () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  globalThis.window = new EventTarget();
  globalThis.document = new EventTarget();
  document.documentElement = new Element();
  const meta = new Element();
  document.querySelector = () => meta;
  const system = new EventTarget();
  system.matches = false;
  globalThis.matchMedia = () => system;
  const page = new Element(), trigger = new Element(), menu = new Element(), status = new Element();
  const buttons = ['light', 'dark', 'system'].map(theme => { const button = new Element(); button.dataset.theme = theme; return button; });
  menu.querySelectorAll = () => buttons;
  trigger.parentElement = { contains: target => target === trigger || buttons.includes(target) };
  const icons = ['light', 'dark'].map(theme => { const icon = new Element(); icon.dataset.themeIcon = theme; return icon; });
  const root = { querySelector: selector => ({ '.qp-page': page, '.qp-theme-trigger, #theme-trigger': trigger, '.qp-theme-options, #theme-menu': menu, '.qp-announcement, #announcement': status })[selector], querySelectorAll: () => icons };
  const controller = initTheme(root, { defaultTheme: 'system' });
  assert.equal(page.dataset.theme, 'light');
  event(trigger, 'click');
  assert.equal(menu.hidden, false);
  event(buttons[1], 'click');
  assert.equal(page.dataset.theme, 'dark');
  assert.equal(storage.get('ginkgo-theme'), 'dark');
  assert.equal(meta.attrs.get('content'), '#162028');
  assert.ok(icons[0].attrs.has('hidden'));
  assert.equal(menu.hidden, true);
  assert.ok(trigger.focused);
  storage.set('ginkgo-theme', 'light');
  event(window, 'pageshow');
  assert.equal(page.dataset.theme, 'light');
  event(buttons[2], 'click');
  system.matches = true;
  event(system, 'change');
  assert.equal(page.dataset.theme, 'dark');
  event(trigger, 'click');
  event(document, 'keydown', { key: 'Escape' });
  assert.equal(menu.hidden, true);
  controller.close();
});
