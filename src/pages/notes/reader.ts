import { required } from "../../shared/dom.ts";
import { markdownToHtml } from "../../shared/markdown.ts";
import type { Note } from "./content";
import type { SiteConfig } from "../../config/types";
import { createNoteNavigation } from "./navigation.ts";
import { createReaderMotion } from "./reader-motion.ts";

export function createReader(root: HTMLElement, notes: Note[], motion: SiteConfig["motion"], pageTitle: string, beforeOpen: () => void, getCard: (id: string) => HTMLAnchorElement | null) {
  const dialog = required<HTMLDialogElement>(root, "#reader");
  const readerTitle = required(root, "#reader-title");
  const previous = required<HTMLButtonElement>(root, "#previous-note");
  const next = required<HTMLButtonElement>(root, "#next-note");
  const readerMotion = createReaderMotion(dialog, motion);
  let selectedIndex = -1;
  let openingLink: HTMLAnchorElement | null = null;
  let closing = false;
  let suspended = false;
  let savedScroll = 0;
  const navigation = createNoteNavigation(() => syncReader());
  function syncReader(restore = false) {
    if (suspended) return;
    const match = /^#note=(.*)$/.exec(location.hash);
    let id = "";
    try { id = match ? decodeURIComponent(match[1]) : ""; } catch {}
    const index = notes.findIndex(note => note.id === id);
    if (index < 0) {
      if (dialog.open) void closeReader(false);
      return;
    }
    const direction = index < selectedIndex ? -1 : 1;
    selectedIndex = index;
    const changing = dialog.open && !closing;
    beforeOpen();
    closing = false;
    const note = notes[index];
    // Button state follows the latest requested article, including fast repeats.
    previous.disabled = index === 0;
    next.disabled = index === notes.length - 1;
    const commit = () => {
      openingLink = getCard(note.id);
      readerTitle.textContent = note.title;
      required(root, "#reader-meta").textContent = `${note.date.replaceAll("-", ".")}  /  ${note.category}`;
      required(root, "#reader-content").innerHTML = markdownToHtml(note.body);
      required(root, "#reader-position").textContent = `${index + 1} / ${notes.length}`;
      document.title = `${note.title.replaceAll("\n", "")} · ${pageTitle}`;
      if (!dialog.open) dialog.showModal();
      dialog.scrollTop = restore ? savedScroll : 0;
      if (!restore) readerTitle.focus({ preventScroll: true });
    };
    if (changing && !restore) {
      void readerMotion.change(direction, commit);
    } else {
      readerMotion.reset();
      commit();
      if (!restore) void readerMotion.open(openingLink, note.animation);
    }
  }

  async function closeReader(updateUrl = true) {
    if (closing || !dialog.open) return;
    closing = true;
    if (updateUrl) navigation.close();
    if (await readerMotion.close(openingLink, notes[selectedIndex]?.animation ?? "fade")) {
      dialog.close();
      readerMotion.reset();
      closing = false;
    }
  }
  required(root, "#close-reader").addEventListener("click", () => { void closeReader(); });
  dialog.addEventListener("cancel", event => { event.preventDefault(); closeReader(); });
  dialog.addEventListener("click", event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) closeReader();
  });
  dialog.addEventListener("close", () => {
    if (dialog.open) return;
    if (!suspended) document.title = pageTitle;
    if (!suspended && openingLink?.isConnected) openingLink.focus({ preventScroll: true });
    openingLink = null;
    required(root, "#reader-content").replaceChildren();
  });
  previous.addEventListener("click", () => { if (!closing && selectedIndex > 0) navigation.open(notes[selectedIndex - 1].id); });
  next.addEventListener("click", () => { if (!closing && selectedIndex < notes.length - 1) navigation.open(notes[selectedIndex + 1].id); });
  root.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element).closest<HTMLAnchorElement>(".note-link[data-note-id]");
    if (!link || !notes.some(note => note.id === link.dataset.noteId)) return;
    event.preventDefault();
    navigation.open(link.dataset.noteId!);
  });

  window.addEventListener("pagehide", () => {
    suspended = true;
    savedScroll = dialog.scrollTop;
    readerMotion.reset();
    closing = false;
    openingLink = null;
    if (dialog.open) dialog.close();
    required(root, "#reader-content").replaceChildren();
  });
  window.addEventListener("pageshow", () => {
    if (!suspended) return;
    suspended = false;
    syncReader(true);
  });
  return { sync: () => syncReader() };
}
