import test from 'node:test';
import assert from 'node:assert/strict';
import { createIcons, Wind, Sun } from '../src/shared/icons.ts';

class Element {
  attrs = new Map();
  children = [];
  constructor(tag) { this.tag = tag; }
  get attributes() { return [...this.attrs].map(([name, value]) => ({ name, value })); }
  setAttribute(name, value) { this.attrs.set(name, value); }
  getAttribute(name) { return this.attrs.get(name) ?? null; }
  appendChild(child) { this.children.push(child); }
}

test('icons preserve theme/accessibility attributes and do not recreate existing SVGs', () => {
  globalThis.document = { createElementNS: (_, tag) => new Element(tag) };
  const root = {
    children: [],
    querySelectorAll(selector) { assert.equal(selector, 'i[data-lucide]'); return this.children.filter(node => node.tag === 'i'); },
    replaceChild(svg, old) { this.children[this.children.indexOf(old)] = svg; svg.parentNode = this; },
  };
  const placeholder = new Element('i');
  placeholder.setAttribute('data-lucide', 'sun');
  placeholder.setAttribute('data-theme-icon', 'light');
  placeholder.setAttribute('hidden', '');
  placeholder.parentNode = root;
  root.children.push(placeholder);
  createIcons({ root, icons: { Sun, Wind }, attrs: { 'stroke-width': 1.4, 'aria-hidden': 'true' } });
  const first = root.children[0];
  assert.equal(first.tag, 'svg');
  assert.equal(first.getAttribute('data-theme-icon'), 'light');
  assert.equal(first.getAttribute('hidden'), '');
  assert.equal(first.getAttribute('aria-hidden'), 'true');
  assert.ok(first.children.length > 0);
  createIcons({ root, icons: { Sun, Wind } });
  assert.equal(root.children[0], first);
});
