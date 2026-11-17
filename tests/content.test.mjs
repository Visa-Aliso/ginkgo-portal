import test from 'node:test';
import assert from 'node:assert/strict';
import { loadNotes } from '../src/pages/notes/content.ts';
import { markdownToHtml, readFrontMatter } from '../src/shared/markdown.ts';

const note = (metadata = '') => `---\ntitle: 测试随笔\ndate: 2026-11-17\ncategory: 日常\nexcerpt: 摘要\n${metadata}---\n\n正文。`;
test('content loader excludes drafts/templates, orders dates, and accepts custom categories', () => {
  const result = loadNotes({ 'second.md': note(), 'first.md': note().replace('2026-11-17', '2026-11-18'), 'draft.md': note('draft: true\n'), '_template.md': 'not published' });
  assert.deepEqual(result.map(item => item.id), ['first', 'second']);
  assert.equal(result[0].category, '日常');
});
test('invalid publishing metadata fails before the site is built', () => {
  for (const text of [note('draft: ture\n'), note('animation: typo\n'), note('style: typo\n'), note().replace('2026-11-17', '2026-02-30'), note().replace('category: 日常', 'category: 全部'), note().replace('title: 测试随笔', 'title:')]) {
    assert.throws(() => loadNotes({ 'bad.md': text }));
  }
  assert.throws(() => loadNotes({ 'a.md': note('id: duplicate\n'), 'b.md': note('id: duplicate\n') }));
  assert.throws(() => readFrontMatter('---\ntitle: A\ntitle: B\n---\n正文', 'bad.md'));
});
test('Markdown formats supported text and does not execute raw HTML or dangerous URLs', () => {
  const html = markdownToHtml('## 标题\n\n**粗体** 和 *斜体* 与 `代码`\n\n> 引用\n\n- 一\n- 二\n\n```js\n<script>alert(1)</script>\n```\n\n![图](./images/a.jpg)');
  for (const expected of ['<h4>标题</h4>', '<strong>粗体</strong>', '<em>斜体</em>', '<code>代码</code>', '<blockquote>', '<ul>', '&lt;script&gt;', 'src="./images/a.jpg"']) assert.ok(html.includes(expected), expected);
  assert.ok(!markdownToHtml('<img src=x onerror=alert(1)>').includes('<img'));
  assert.ok(!markdownToHtml('[x](javascript:alert) ![x](data:image/png;base64,abc)').includes('href='));
  assert.ok(!markdownToHtml('![x](data:image/png;base64,abc)').includes('<img'));
});
