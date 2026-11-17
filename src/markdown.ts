/** Small HTML-free Markdown subset for local notes; no remote runtime needed. */
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
function safeUrl(value: string): string | null {
  if (!value || /[\s\u0000-\u001f]/.test(value)) return null;
  try {
    const url = new URL(value, "https://notes.invalid/");
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? escape(value) : null;
  } catch { return null; }
}
function inline(text: string, depth = 0): string {
  if (depth > 5) return escape(text);
  const pattern = /`([^`\n]+)`|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|(!?)\[([^\]\n]*)\]\(([^\s)]+)\)/g;
  let output = "", cursor = 0;
  for (const match of text.matchAll(pattern)) {
    output += escape(text.slice(cursor, match.index));
    const [, code, bold, italic, image, label, target] = match;
    if (code !== undefined) output += `<code>${escape(code)}</code>`;
    else if (bold !== undefined) output += `<strong>${inline(bold, depth + 1)}</strong>`;
    else if (italic !== undefined) output += `<em>${inline(italic, depth + 1)}</em>`;
    else {
      const href = safeUrl(target);
      if (!href || (image && target.toLowerCase().startsWith("mailto:"))) output += escape(label);
      else if (image) output += `<img src="${href}" alt="${escape(label)}" loading="lazy" />`;
      else output += `<a href="${href}" target="_blank" rel="noopener noreferrer">${inline(label, depth + 1)}</a>`;
    }
    cursor = match.index + match[0].length;
  }
  return output + escape(text.slice(cursor));
}
export function markdownToHtml(markdown: string): string {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const blocks: string[] = [];
  const listItem = /^(?:[-+*]|\d+\.)\s+(.+)$/;
  const startsBlock = (line: string) => /^(?:#{1,6}\s|>|```|~~~|(?:[-+*]|\d+\.)\s|(?:-{3,}|\*{3,}|_{3,})\s*$)/.test(line);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const fence = /^(`{3,}|~{3,})([\w+-]*)\s*$/.exec(line);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !new RegExp(`^${fence[1][0]}{${fence[1].length},}\\s*$`).test(lines[i])) body.push(lines[i++]);
      if (i < lines.length) i++;
      blocks.push(`<pre><code>${escape(body.join("\n"))}</code></pre>`);
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) { const level = Math.min(6, heading[1].length + 2); blocks.push(`<h${level}>${inline(heading[2])}</h${level}>`); i++; continue; }
    if (/^(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { blocks.push("<hr />"); i++; continue; }
    if (/^>/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ""));
      blocks.push(`<blockquote><p>${inline(quote.join("\n"))}</p></blockquote>`);
      continue;
    }
    if (listItem.test(line)) {
      const ordered = /^\d+\./.test(line), tag = ordered ? "ol" : "ul";
      const items: string[] = [];
      while (i < lines.length && listItem.test(lines[i]) && /^\d+\./.test(lines[i]) === ordered) items.push(`<li>${inline(lines[i++].replace(listItem, "$1"))}</li>`);
      blocks.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }
    const paragraph = [inline(line)];
    i++;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) paragraph.push(inline(lines[i++]));
    blocks.push(`<p>${paragraph.join("\n").replace(/ {2,}\n/g, "<br />")}</p>`);
  }
  return blocks.join("\n");
}
export function readFrontMatter(source: string, path: string): { fields: Record<string, string>; body: string } {
  const normalized = source.replace(/^\uFEFF/, "").replaceAll("\r\n", "\n");
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(normalized);
  if (!match) throw new Error(`${path}: 请在文件开头填写 --- 包围的随笔信息。`);
  const fields: Record<string, string> = Object.create(null);
  for (const line of match[1].split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const entry = /^([a-z]+):\s*(.*?)\s*$/.exec(line);
    if (!entry || entry[1] in fields) throw new Error(`${path}: 无效或重复的配置行：${line}`);
    let value = entry[2];
    if (value.startsWith('"')) {
      try { value = JSON.parse(value); } catch { throw new Error(`${path}: ${entry[1]} 的引号或转义不正确。`); }
    } else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1).replaceAll("''", "'");
    if (typeof value !== "string" || value === "|" || value === ">") throw new Error(`${path}: ${entry[1]} 请使用单行文本，换行可写成双引号内的 \\n。`);
    fields[entry[1]] = value;
  }
  return { fields, body: normalized.slice(match[0].length).trim() };
}
