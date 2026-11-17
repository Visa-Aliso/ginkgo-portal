import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSiteConfig, parseProfileConfig, parseNotesConfig } from '../src/config/parse.ts';
const read = name => readFileSync(new URL(`../config/${name}.config`, import.meta.url), 'utf8');

test('independent config files preserve all page defaults and placeholder data', () => {
  const site = parseSiteConfig(read('site'));
  const profile = parseProfileConfig(read('profile'));
  const notes = parseNotesConfig(read('notes'));
  assert.equal(site.name, 'Ginkgo');
  assert.equal(site.entries.profile.url, './profile.html');
  assert.equal(profile.name, 'Ginkgo');
  assert.equal(profile.leavesPaused, true);
  assert.equal(site.leaves.pixelBudget, 1_048_576);
  assert.equal(profile.sections.length, 5);
  assert.ok(profile.sections.every(section => section.items.length));
  assert.ok(notes.leaves.desktopCount < site.leaves.desktopCount);
});
test('bad JSON, unsafe links, invalid physics and unknown keys fail with field paths', () => {
  assert.throws(() => parseSiteConfig('{'), /site.config/);
  for (const [mutate, expected] of [
    [site => { site.motion.softness = 0; }, /motion.softness/],
    [site => { site.motion.transitionSpeed = 0; }, /motion.transitionSpeed/],
    [site => { site.leaves.mobileCount = 2.5; }, /leaves.mobileCount/],
    [site => { site.leaves.pixelBudget = 1.5; }, /leaves.pixelBudget/],
    [site => { site.defaultTheme = 'night'; }, /defaultTheme/],
    [site => { site.entries.profile.url = 'javascript:alert(1)'; }, /entries.profile.url/],
    [site => { site.leavs = {}; }, /leavs/],
  ]) {
    const site = JSON.parse(read('site')); mutate(site);
    assert.throws(() => parseSiteConfig(JSON.stringify(site)), expected);
  }
  for (const [mutate, expected] of [
    [profile => { profile.sections[1].id = profile.sections[0].id; }, /sections\[1\].id/],
    [profile => { profile.sections[0].initialShow = 0; }, /initialShow/],
    [profile => { profile.avatar = 'data:text/html,unsafe'; }, /avatar/],
    [profile => { profile.links = [{ name: 'Link', url: 'javascript:alert(1)' }]; }, /links\[0\].url/],
  ]) {
    const profile = JSON.parse(read('profile')); mutate(profile);
    assert.throws(() => parseProfileConfig(JSON.stringify(profile)), expected);
  }
});
