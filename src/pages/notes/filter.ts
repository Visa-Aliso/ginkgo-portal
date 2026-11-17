import type { Note } from "./content";

/** Return original positions so filtering never changes card numbering or tilt. */
export function filterNoteIndices(notes: readonly Note[], category: string, query: string): number[] {
  const indices: number[] = [];
  for (let index = 0; index < notes.length; index++) {
    const note = notes[index];
    if (category !== "全部" && note.category !== category) continue;
    // Avoid building/lowercasing full-text copies for normal category browsing.
    if (query && ![note.title, note.excerpt, note.category, note.body].join(" ").toLocaleLowerCase().includes(query)) continue;
    indices.push(index);
  }
  return indices;
}
