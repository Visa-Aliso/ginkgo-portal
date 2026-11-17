import { loadNotes } from "./note-content.ts";
export type { Note, NoteAnimation } from "./note-content.ts";

// Content parsing is independent from Vite so it can be checked before release.
const files = import.meta.glob<string>("./content/notes/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});
export const notes = loadNotes(files);
