import { filterNoteIndices } from "./filter";
import { initPageLifecycle } from "../../shared/page-lifecycle";
import { ArrowUpLeft, ArrowUpRight, ArrowLeft, ArrowRight, Sun, Moon, Monitor, Wind, Search, Feather, X, createIcons } from "../../shared/icons";
import { required, element } from "../../shared/dom";
import { createNoteCard } from "./card";
import { createReader } from "./reader";
import { siteConfig } from "../../config/site";
import { notesConfig } from "../../config/notes";
import { initBrand } from "../../shared/brand";
import { initTheme } from "../../shared/theme.ts";
import { initLeaves } from "../../effects/leaves";
import { notes } from "./data";
import { createCollectionMotion } from "./collection-motion";
import { createPaperMotion } from "./paper-motion";
import { enterPage } from "../../shared/page-transition";

const root = required(document, "#ginkgo-notes");
initPageLifecycle(root);
initBrand(root);
document.title = notesConfig.title;
required(root, ".intro-subtitle").textContent = notesConfig.subtitle;
required(root, ".collection-end p").textContent = notesConfig.footer;
const grid = required(root, "#notes-grid");
const search = required<HTMLInputElement>(root, "#notes-search");
const dialog = required<HTMLDialogElement>(root, "#reader");
const filters = required(root, ".filters");
const emptyState = required(root, "#empty-state");
const resultCount = required(root, "#result-count");
const collectionLabel = required(root, "#collection-label");
const announcement = required(root, "#announcement");
filters.replaceChildren(...["全部", ...new Set(notes.map(note => note.category))].map(category => {
  const button = element("button", "", category);
  button.dataset.category = category;
  if (category === "全部") button.append(element("span", "", String(notes.length).padStart(2, "0")));
  return button;
}));
const categoryButtons = [...root.querySelectorAll<HTMLButtonElement>("[data-category]")];
const icons = { ArrowUpLeft, ArrowUpRight, ArrowLeft, ArrowRight, Sun, Moon, Monitor, Wind, Search, Feather, X };
const refreshIcons = () => createIcons({ root, icons, attrs: { "stroke-width": 1.4, "aria-hidden": "true" } });
let category = "全部";
const collectionMotion = createCollectionMotion(required(root, "#notes-results"), grid, siteConfig.motion);
const paperMotion = createPaperMotion(grid, siteConfig.motion, () => dialog.open);
const noteCards = new Map<string, HTMLElement>();
const indicator = element("span", "filter-indicator");
indicator.setAttribute("aria-hidden", "true");
filters.append(indicator);

function moveIndicator() {
  const button = categoryButtons.find(button => button.dataset.category === category);
  if (!button) return;
  indicator.style.left = `${button.offsetLeft}px`;
  indicator.style.top = `${button.offsetTop + button.offsetHeight - 1}px`;
  indicator.style.width = `${button.offsetWidth}px`;
}
new ResizeObserver(moveIndicator).observe(filters);

function render(transition = false) {
  const query = search.value.trim().toLocaleLowerCase();
  const filtered = filterNoteIndices(notes, category, query);
  const visibleCards: HTMLElement[] = [];
  for (const index of filtered) {
    const note = notes[index];
    const cached = noteCards.get(note.id);
    if (cached) { visibleCards.push(cached); continue; }
    const article = createNoteCard(note, index, notes.length);
    noteCards.set(note.id, article);
    visibleCards.push(article);
  }
  const updateCards = () => {
    grid.replaceChildren(...visibleCards);
    for (const [id, card] of noteCards) {
      if (noteCards.size <= Math.max(24, visibleCards.length)) break;
      if (card.parentElement !== grid) noteCards.delete(id);
    }
    emptyState.hidden = filtered.length > 0;
    grid.hidden = !filtered.length;
  };
  paperMotion.reset();
  if (transition) collectionMotion.change(updateCards);
  else updateCards();
  resultCount.textContent = `${String(filtered.length).padStart(2, "0")} 篇随笔`;
  collectionLabel.textContent = query ? `搜索「${search.value.trim()}」` : category === "全部" ? notesConfig.collectionLabel : category;
  categoryButtons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.category === category)));
  moveIndicator();
  refreshIcons();
}
categoryButtons.forEach(button => button.addEventListener("click", () => { if (category === button.dataset.category) return; category = button.dataset.category!; render(true); }));
let searchFrame = 0;
search.addEventListener("input", () => {
  if (!searchFrame) searchFrame = requestAnimationFrame(() => { searchFrame = 0; render(true); });
});
window.addEventListener("pagehide", () => {
  if (searchFrame) { cancelAnimationFrame(searchFrame); searchFrame = 0; render(false); }
  noteCards.clear();
});
required(root, "#reset-search").addEventListener("click", () => { category = "全部"; search.value = ""; render(true); search.focus(); });

const reader = createReader(root, notes, siteConfig.motion, notesConfig.title,
  () => { collectionMotion.finish(); paperMotion.reset(); },
  id => [...grid.querySelectorAll<HTMLAnchorElement>(".note-link")].find(link => link.dataset.noteId === id) ?? null);

initTheme(root, { defaultTheme: siteConfig.defaultTheme });
document.addEventListener("keydown", event => {
  if (event.key === "/" && !dialog.open && !event.ctrlKey && !event.metaKey && !event.altKey && !(event.target as Element).closest("input, textarea, [contenteditable]")) { event.preventDefault(); search.focus(); }
});
root.addEventListener("ginkgo:gust", () => { paperMotion.release(); announcement.textContent = "风吹过，银杏叶轻轻散开。"; });

render();
initLeaves(root, { ...siteConfig.leaves, ...notesConfig.leaves }, {
  target: root,
  cardSelector: ".note-link",
  ignoreSelector: ".site-header, .collection-toolbar, button, input, dialog, .note-ghost",
  enabled: () => !dialog.open,
});
void enterPage(root, "notes", siteConfig.motion)
  .catch(error => console.warn("Notes arrival animation skipped:", error))
  .then(reader.sync);
