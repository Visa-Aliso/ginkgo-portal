import { readFrontMatter } from "../../shared/markdown.ts";

export type NoteAnimation = "unfold" | "lift" | "turn" | "fade";
export interface Note {
  id: string;
  title: string;
  date: string;
  category: string;
  excerpt: string;
  body: string;
  style?: "blue" | "landscape" | "quote";
  animation: NoteAnimation;
}

const animations: NoteAnimation[] = ["unfold", "lift", "turn", "fade"];

export function loadNotes(sources: Record<string, string>): Note[] {
  const result: Note[] = [];
  const ids = new Set<string>();
  for (const [path, source] of Object.entries(sources)) {
    if (path.split("/").pop()?.startsWith("_")) continue;
    const { fields, body } = readFrontMatter(source, path);
    if (fields.draft && fields.draft !== "true" && fields.draft !== "false") throw new Error(`${path}: draft 只能是 true 或 false。`);
    if (fields.draft === "true") continue;
    for (const key of ["title", "date", "category", "excerpt"]) {
      if (!fields[key]?.trim()) throw new Error(`${path}: 缺少 ${key}。`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.date) || Number.isNaN(Date.parse(fields.date)) || new Date(fields.date).toISOString().slice(0, 10) !== fields.date) throw new Error(`${path}: date 必须是有效的 YYYY-MM-DD 日期。`);
    if (fields.category === "全部") throw new Error(`${path}: “全部”保留给分类筛选，请使用具体分类名。`);
    if (!body) throw new Error(`${path}: 正文不能为空。`);
    if (fields.style && !["blue", "landscape", "quote"].includes(fields.style)) throw new Error(`${path}: style 只能是 blue、landscape 或 quote，也可以省略。`);
    if (fields.animation && !animations.includes(fields.animation as NoteAnimation)) throw new Error(`${path}: animation 只能是 unfold、lift、turn 或 fade。`);
    const id = (fields.id || path.split("/").pop()!.replace(/\.md$/, "")).trim();
    if (!id) throw new Error(`${path}: id 不能为空。`);
    if (ids.has(id)) throw new Error(`${path}: 重复的随笔 id：${id}`);
    ids.add(id);
    result.push({ id, title: fields.title, date: fields.date, category: fields.category, excerpt: fields.excerpt, body, style: fields.style as Note["style"], animation: (fields.animation || "unfold") as NoteAnimation });
  }
  return result.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

