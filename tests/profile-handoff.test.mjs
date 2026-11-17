import test from 'node:test';
import assert from 'node:assert/strict';
import { leaveForProfile } from '../src/pages/portal/profile-handoff.ts';

test('Profile departure only fades and waits for completion before navigation', async () => {
  const veil = {}, animations = [];
  const run = (node, frames, options) => {
    let finish, cancel;
    const pending = new Promise((resolve, reject) => { finish = resolve; cancel = () => reject(new Error('cancelled')); });
    animations.push({ node, frames, options, finish, cancel });
    return pending;
  };
  let done = false;
  const pending = leaveForProfile(veil, run).then(() => { done = true; });
  assert.equal(animations.length, 1);
  const fade = animations[0];
  assert.equal(fade.node, veil);
  assert.equal(fade.options.duration, 800);
  assert.equal(fade.options.delay, undefined);
  assert.deepEqual(fade.frames, [{ opacity: 0 }, { opacity: 1 }]);
  await Promise.resolve();
  assert.equal(done, false, 'navigation waits until the fade is opaque');
  fade.finish();
  await pending;
  assert.equal(done, true);

  animations.length = 0;
  const interrupted = leaveForProfile(veil, run);
  animations.forEach(animation => animation.cancel());
  await assert.rejects(interrupted, /cancelled/);
});
