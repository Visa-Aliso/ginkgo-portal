import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnimationGroup } from '../src/shared/animation-group.ts';

test('finished fill effects remain owned until cleanup; a cancelled group can be reused', async () => {
  const effects = [];
  const target = { animate(frames, options) {
    let resolve, reject;
    const effect = { options, finished: new Promise((done, fail) => { resolve = done; reject = fail; }),
      cancelled: 0, finish() { resolve(); }, cancel() { this.cancelled++; reject(new Error('cancelled')); } };
    effects.push(effect);
    return effect;
  } };
  const group = createAnimationGroup();
  const first = group.play(target, [{ opacity: 0 }, { opacity: 1 }], { duration: 600 });
  group.finish();
  await first;
  assert.equal(effects[0].cancelled, 0);
  assert.equal(effects[0].options.fill, 'both');
  group.cancel();
  assert.equal(effects[0].cancelled, 1, 'finished fill effects must also be released');
  group.cancel();
  assert.equal(effects[0].cancelled, 1, 'cleanup forgets retired animations');
  const second = group.play(target, [], { duration: 240, easing: 'ease-in-out' });
  assert.equal(effects[1].options.easing, 'ease-in-out');
  group.cancel();
  await second;
  assert.equal(effects[1].cancelled, 1);
  assert.equal(effects[0].cancelled, 1);
});
