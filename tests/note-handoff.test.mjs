import test from 'node:test';
import assert from 'node:assert/strict';
import { expandNoteSurface } from '../src/pages/portal/note-handoff.ts';

function scene(width, height) {
  const classes = new Set(), animations = [];
  let settled = false;
  const page = { getBoundingClientRect: () => ({ left: 0, top: -20, width, height }) };
  const bounds = { left: 63, top: 240, width: Math.min(280, width - 80), height: 220 };
  const front = { getBoundingClientRect() { assert.ok(settled, 'measure after the tilted front settles'); return bounds; } };
  const paper = { classList: { add: name => classes.add(name) }, querySelectorAll: () => [{}, {}] };
  const veil = { style: {} };
  globalThis.getComputedStyle = () => ({ transform: 'matrix3d(...)', opacity: '1', borderTopLeftRadius: '5px' });
  const run = (node, frames, options) => {
    let finish, cancel;
    const promise = new Promise((resolve, reject) => { finish = () => { if (node === front) settled = true; resolve(); }; cancel = () => reject(new Error('cancelled')); });
    animations.push({ node, frames, options, finish, cancel });
    return promise;
  };
  return { classes, animations, page, bounds, front, paper, veil, run };
}

test('mobile and desktop handoff replace the settled note before moving the opaque cover', async () => {
  for (const [width, height] of [[360, 800], [390, 844], [430, 932], [1280, 800]]) {
    const env = scene(width, height);
    const pending = expandNoteSurface(env.paper, env.front, env.veil, env.page, env.run);
    assert.ok(!env.classes.has('qp-handoff'));
    assert.ok(env.animations.every(animation => animation.node !== env.veil));
    env.animations.forEach(animation => animation.finish());
    await new Promise(resolve => setImmediate(resolve));
    const expansion = env.animations.at(-1);
    assert.equal(expansion.node, env.veil);
    assert.ok(env.classes.has('qp-handoff'), 'source is hidden before the cover moves');
    assert.equal(env.veil.style.opacity, '1');
    assert.equal(expansion.frames[0].opacity, 1);
    assert.equal(expansion.frames.at(-1).opacity, 1);
    assert.equal(expansion.frames[0].transform, `translate(63px, 260px) scale(${env.bounds.width / width}, ${env.bounds.height / height})`);
    assert.ok(!env.animations.some(animation => animation.node === env.paper), 'do not enlarge the original behind the flat cover');
    expansion.finish();
    await pending;
    assert.equal(env.veil.style.transform, 'none');
    assert.equal(env.veil.style.borderRadius, '0');
  }
});

test('interrupted settling does not introduce a second rectangular cover', async () => {
  const env = scene(390, 844);
  const pending = expandNoteSurface(env.paper, env.front, env.veil, env.page, env.run);
  env.animations.forEach(animation => animation.cancel());
  await assert.rejects(pending, /cancelled/);
  assert.ok(!env.classes.has('qp-handoff'));
  assert.ok(env.animations.every(animation => animation.node !== env.veil));
});
