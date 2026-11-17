import test from 'node:test';
import assert from 'node:assert/strict';
import { createReader } from '../src/pages/notes/reader.ts';

class Element extends EventTarget {
  textContent = '';
  innerHTML = '';
  isConnected = true;
  dataset = {};
  styles = new Map();
  style = { setProperty: (key, value) => this.styles.set(key, value), getPropertyValue: key => this.styles.get(key) || "", removeProperty: key => this.styles.delete(key) };
  classList = { add() {}, remove() {} };
  focus() {}
  replaceChildren() { this.innerHTML = ''; }
}

test('repeated reader sessions keep the leaf layer intact and release the hidden article', async () => {
  globalThis.window = new EventTarget();
  globalThis.document = new EventTarget();
  const reduced = Object.assign(new EventTarget(), { matches: true });
  globalThis.matchMedia = () => reduced;
  globalThis.getComputedStyle = () => ({ transform: 'none', opacity: '1' });
  const stack = [{ url: '/notes.html', state: null }];
  let index = 0;
  const updateLocation = () => {
    const url = new URL(stack[index].url, 'https://example.com');
    globalThis.location = { pathname: url.pathname, search: url.search, hash: url.hash };
  };
  globalThis.history = {
    get state() { return stack[index].state; },
    pushState(state, _, url) { stack.splice(++index); stack.push({ state, url }); updateLocation(); },
    replaceState(state, _, url) { stack[index] = { state, url }; updateLocation(); },
    back() { index--; updateLocation(); window.dispatchEvent(new Event('hashchange')); },
  };
  updateLocation();
  const root = new Element();
  const nodes = new Map(['#reader', '#reader-title', '#previous-note', '#next-note', '#reader-meta', '#reader-content', '#reader-position', '#close-reader'].map(id => [id, new Element()]));
  root.querySelector = selector => {
    assert.notEqual(selector, '.qp-page', 'opening/closing an article must not clear or hide the leaf layer');
    return nodes.get(selector);
  };
  const dialog = nodes.get('#reader');
  dialog.open = false;
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.dispatchEvent(new Event('close')); };
  const card = new Element();
  card.dataset.noteId = 'one';
  card.closest = () => card;
  const notes = [{ id: 'one', title: 'One', date: '2026-11-17', category: 'Demo', body: 'A small article.', animation: 'fade' }];
  notes.push({ ...notes[0], id: 'two', title: 'Two', body: 'Second article.' }, { ...notes[0], id: 'three', title: 'Three', body: 'Third article.' });
  const settings = { responsiveMotion: false, transitionSpeed: 1 };
  createReader(root, notes, settings, 'Notes', () => {}, () => card);
  for (let attempt = 0; attempt < 25; attempt++) {
    const click = new Event('click', { cancelable: true });
    Object.defineProperties(click, { target: { value: card }, button: { value: 0 } });
    root.dispatchEvent(click);
    assert.equal(dialog.open, true);
    assert.equal(document.title, 'One · Notes');
    assert.ok(nodes.get('#reader-content').innerHTML.includes('A small article.'));
    if (attempt === 0) {
      dialog.scrollTop = 123;
      window.dispatchEvent(new Event('pagehide'));
      assert.equal(dialog.open, false);
      assert.equal(nodes.get('#reader-content').innerHTML, '');
      assert.equal(location.hash, '#note=one');
      window.dispatchEvent(new Event('pageshow'));
      assert.equal(dialog.open, true);
      assert.equal(dialog.scrollTop, 123);
      assert.ok(nodes.get('#reader-content').innerHTML.includes('A small article.'));
      assert.equal(stack.length, 2);
    }
    nodes.get('#close-reader').dispatchEvent(new Event('click'));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(dialog.open, false);
    assert.equal(nodes.get('#reader-content').innerHTML, '');
    assert.equal(location.hash, '');
    assert.equal(document.title, 'Notes');
    assert.equal(index, 0);
    assert.equal(stack.length, 2);
  }

  // Real next/previous button wiring must wait for exit before changing the DOM.
  const animations = [];
  const animate = () => {
    let finish, cancel;
    const finished = new Promise((resolve, reject) => { finish = resolve; cancel = () => reject(new Error('cancelled')); });
    const animation = { finished, finish, cancel };
    animations.push(animation);
    return animation;
  };
  const article = new Element();
  article.animate = animate;
  dialog.animate = animate;
  dialog.querySelector = () => article;
  dialog.getBoundingClientRect = () => ({ height: 600 });
  settings.responsiveMotion = true;
  reduced.matches = false;
  const click = new Event('click', { cancelable: true });
  Object.defineProperties(click, { target: { value: card }, button: { value: 0 } });
  root.dispatchEvent(click);
  animations.forEach(animation => animation.finish());
  await new Promise(resolve => setImmediate(resolve));
  nodes.get('#next-note').dispatchEvent(new Event('click'));
  assert.equal(location.hash, '#note=two');
  assert.equal(nodes.get('#reader-title').textContent, 'One');
  animations.at(-1).finish();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(nodes.get('#reader-title').textContent, 'Two');
  animations.at(-1).finish();
  await new Promise(resolve => setImmediate(resolve));
  nodes.get('#previous-note').dispatchEvent(new Event('click'));
  assert.equal(nodes.get('#reader-title').textContent, 'Two');
  nodes.get('#close-reader').dispatchEvent(new Event('click'));
  animations.at(-1).finish();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(dialog.open, false);
  assert.equal(nodes.get('#reader-content').innerHTML, '');
  assert.equal(location.hash, '');
  assert.equal(index, 0);
  assert.equal(stack.length, 2);
});
