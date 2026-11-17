import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
for (const name of ['index.html', 'notes.html', 'profile.html']) {
  const source = readFileSync(resolve(root, name), 'utf8');
  const built = readFileSync(resolve(root, 'dist', name), 'utf8');
  for (const [kind, html] of [['source', source], ['built', built]]) {
    const head = html.split('</head>')[0];
    assert.equal([...head.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].length, 1, `${name} (${kind}): expected one early stylesheet`);
  }
  assert.ok(source.includes('<!-- site:bootstrap -->'), `${name}: missing shared bootstrap marker`);
  assert.ok(!built.includes('<!-- site:bootstrap -->'), `${name}: bootstrap was not compiled`);
  assert.ok(built.indexOf('function bootstrapPage') < built.indexOf('<link rel="stylesheet"'), `${name}: first-paint settings must precede styles`);
  if (name !== 'index.html') {
    assert.match(built, /<span class="brand-section" aria-current="page">[^<]+<\/span>/, `${name}: page labels must not be interactive`);
  }
  for (const [, href] of built.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    if (/^(https?:|data:|mailto:)/.test(href)) continue;
    assert.ok(!href.startsWith('/'), `${name}: root-relative output breaks subdirectory hosting: ${href}`);
    assert.ok(existsSync(resolve(root, 'dist', href.split(/[?#]/)[0])), `${name}: missing build asset ${href}`);
  }
}
console.log('Validated all three production pages, early stylesheets, and subdirectory-safe asset links.');

const profileHtml = readFileSync(resolve(root, 'dist/profile.html'), 'utf8');
const profileCssPath = profileHtml.match(/<link[^>]+href="([^"]+\.css)"/)[1];
const profileCss = readFileSync(resolve(root, 'dist', profileCssPath), 'utf8');
assert.ok(!profileCss.includes('.note-link') && !profileCss.includes('.reader-article'), 'Profile must not include Notes card or reader styles');
console.log('Validated compiled first-paint config, noninteractive breadcrumbs, and isolated Profile styles.');
