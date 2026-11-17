import { readFileSync } from 'node:fs';
import { parseSiteConfig, parseProfileConfig, parseNotesConfig } from '../src/config/parse.ts';
for (const [name, parse] of [['site', parseSiteConfig], ['profile', parseProfileConfig], ['notes', parseNotesConfig]]) {
  parse(readFileSync(new URL(`../config/${name}.config`, import.meta.url), 'utf8'));
}
console.log('Validated site.config, profile.config and notes.config.');
