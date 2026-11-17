import test from 'node:test';
import assert from 'node:assert/strict';
import { filterNoteIndices } from '../src/pages/notes/filter.ts';

const notes = [
  { title: 'Ginkgo', excerpt: 'Autumn wind', category: '生活', body: '叶子\n落下了' },
  { title: 'A Note', excerpt: 'HELLO', category: '随想', body: 'Some thoughts' },
  { title: '再见', excerpt: '慢一点', category: '生活', body: '中文，English 和符号 #tag' },
];

test('filter preserves original positions, full-text matching and field-boundary matches', () => {
  assert.deepEqual(filterNoteIndices(notes, '全部', ''), [0, 1, 2]);
  assert.deepEqual(filterNoteIndices(notes, '生活', ''), [0, 2]);
  assert.deepEqual(filterNoteIndices(notes, '全部', 'hello'), [1]);
  assert.deepEqual(filterNoteIndices(notes, '生活', 'hello'), []);
  assert.deepEqual(filterNoteIndices(notes, '全部', '叶子\n落下'), [0]);
  assert.deepEqual(filterNoteIndices(notes, '生活', '#tag'), [2]);
  assert.deepEqual(filterNoteIndices(notes, '全部', 'ginkgo autumn'), [0]);
  assert.deepEqual(filterNoteIndices(notes, '全部', 'wind 生活 叶子'), [0]);
  assert.deepEqual(filterNoteIndices(notes, '不存在', ''), []);
  assert.deepEqual(filterNoteIndices([], '全部', ''), []);
});

test('category browsing and excluded categories never read full text', () => {
  const guarded = { category: '生活', get body() { throw new Error('unnecessary full-text scan'); } };
  assert.deepEqual(filterNoteIndices([guarded], '全部', ''), [0]);
  assert.deepEqual(filterNoteIndices([guarded], '生活', ''), [0]);
  assert.deepEqual(filterNoteIndices([guarded], '随想', 'hello'), []);
});
