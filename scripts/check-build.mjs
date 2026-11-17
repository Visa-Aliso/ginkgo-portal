import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
for (const name of ['index.html', 'notes.html']) {
  const source = readFileSync(resolve(root, name), 'utf8');
  const built = readFileSync(resolve(root, 'dist', name), 'utf8');
  for (const [kind, html] of [['source', source], ['built', built]]) {
    const head = html.split('</head>')[0];
    assert.equal([...head.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].length, 1, `${name} (${kind}): expected one early stylesheet`);
  }
  for (const [, href] of built.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    if (/^(https?:|data:|mailto:)/.test(href)) continue;
    assert.ok(!href.startsWith('/'), `${name}: root-relative output breaks subdirectory hosting: ${href}`);
    assert.ok(existsSync(resolve(root, 'dist', href.split(/[?#]/)[0])), `${name}: missing build asset ${href}`);
  }
}
console.log('Validated both production pages, early stylesheets, and subdirectory-safe asset links.');
