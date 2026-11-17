import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { loadNotes } from '../src/pages/notes/content.ts';

const directory = fileURLToPath(new URL('../content/notes/', import.meta.url));
const sources = Object.fromEntries(readdirSync(directory)
  .filter(name => name.endsWith('.md'))
  .map(name => [name, readFileSync(join(directory, name), 'utf8')]));
const notes = loadNotes(sources);
console.log(`Validated ${notes.length} published notes; templates and drafts excluded.`);
