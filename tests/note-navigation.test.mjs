import test from 'node:test';
import assert from 'node:assert/strict';
import { createNoteNavigation } from '../src/pages/notes/navigation.ts';

function environment(initial = '/garden/notes.html') {
  const entries = [{ url: '/garden/index.html', state: null }, { url: initial, state: null }];
  let cursor = 1, syncs = 0;
  const setLocation = () => {
    const url = new URL(entries[cursor].url, 'https://example.com');
    globalThis.location = { pathname: url.pathname, search: url.search, hash: url.hash };
  };
  globalThis.window = new EventTarget();
  globalThis.history = {
    get state() { return entries[cursor].state; },
    pushState(state, _, url) { entries.splice(++cursor); entries.push({ state, url }); setLocation(); },
    replaceState(state, _, url) { entries[cursor] = { state, url }; setLocation(); },
    back() { if (cursor > 0) { cursor--; setLocation(); window.dispatchEvent(new Event('hashchange')); } },
    forward() { if (cursor < entries.length - 1) { cursor++; setLocation(); window.dispatchEvent(new Event('hashchange')); } },
  };
  setLocation();
  return { navigation: createNoteNavigation(() => syncs++), entries, syncs: () => syncs };
}

test('close consumes the reader entry, so the next Back returns to the portal', () => {
  const env = environment();
  env.navigation.open('one');
  env.navigation.open('two');
  env.navigation.open('three');
  assert.equal(env.entries.length, 3);
  assert.equal(location.hash, '#note=three');
  env.navigation.close();
  assert.equal(location.hash, '');
  assert.equal(location.pathname, '/garden/notes.html');
  history.back();
  assert.equal(location.pathname, '/garden/index.html');
  assert.equal(env.syncs(), 5);
});

test('browser Back closes and Forward reopens; reopening does not accumulate duplicate list entries', () => {
  const { navigation, entries } = environment();
  navigation.open('one');
  history.back();
  assert.equal(location.hash, '');
  history.forward();
  assert.equal(location.hash, '#note=one');
  navigation.close();
  navigation.open('note with spaces');
  assert.equal(entries.length, 3);
  assert.equal(location.hash, '#note=note%20with%20spaces');
  navigation.close();
  history.back();
  assert.equal(location.pathname, '/garden/index.html');
});

test('direct links close in place and do not navigate away from Notes', () => {
  const { navigation, entries } = environment('/garden/notes.html?theme=light#note=one');
  navigation.open('two');
  assert.equal(entries.length, 2);
  navigation.close();
  assert.equal(location.pathname + location.search + location.hash, '/garden/notes.html?theme=light');
  history.back();
  assert.equal(location.pathname, '/garden/index.html');
});
