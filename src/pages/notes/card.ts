import { element, icon } from "../../shared/dom";
import type { Note } from "./content";

const landscape = `<svg class="landscape" viewBox="0 0 280 90" fill="none" aria-hidden="true"><path d="M0 64 Q36 35 79 51 T154 45 T230 43 T280 29 L280 90H0Z" fill="currentColor" opacity=".08"/><path d="M0 71Q46 49 88 61T167 53T280 51" stroke="currentColor" stroke-width=".7" opacity=".5"/><path d="M0 80Q62 65 108 75T218 65T280 69" stroke="currentColor" stroke-width=".6" opacity=".35"/><path d="M36 53V20M36 29L25 18M36 36L47 24M36 43L22 32M247 50V15M247 24L238 13M247 32L259 18M247 40L235 28" stroke="currentColor" stroke-width=".8" stroke-linecap="round" opacity=".6"/><circle cx="208" cy="20" r="9" fill="currentColor" opacity=".12"/><path d="M121 24l4-2 4 2m8-6 3-2 3 2" stroke="currentColor" stroke-width=".7" opacity=".65"/></svg>`;

export function createNoteCard(note: Note, index: number, total: number) {
    const article = element("article", `note${note.style ? ` note-${note.style}` : ""}`);
    article.style.setProperty("--angle", `${[-1.6, 0, 1, -.6, 0, 1.2][index % 6]}deg`);
    const link = element("a", "note-link");
    link.href = `#note=${encodeURIComponent(note.id)}`;
    link.dataset.noteId = note.id;
    link.setAttribute("aria-label", `阅读：${note.title.replaceAll("\n", "")}`);
    const meta = element("div", "note-meta");
    const date = element("time", "", note.date.replaceAll("-", "."));
    date.dateTime = note.date;
    meta.append(date, element("span", "note-category", note.category));
    link.append(meta);
    if (note.style === "blue") {
      const clip = element("span", "paperclip");
      clip.setAttribute("aria-hidden", "true");
      link.append(clip);
    }
    if (note.style === "landscape") link.insertAdjacentHTML("beforeend", landscape);
    link.append(element("h2", "", note.title), element("p", "note-excerpt", note.excerpt));
    const bottom = element("div", "note-bottom");
    const reading = element("span", "read-label", "展开这页");
    reading.append(icon("arrow-up-right"));
    bottom.append(element("span", "note-index", `No. ${String(total - index).padStart(2, "0")}`), reading);
    link.append(bottom);
    article.append(link);
  return article;
}
