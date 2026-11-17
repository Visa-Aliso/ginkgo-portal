import { ArrowUpLeft, ArrowUpRight, ArrowLeft, ArrowRight, Sun, Moon, Monitor, Wind, Search, Feather, X, createIcons } from "lucide";
import { required } from "./dom";
import { siteConfig, type ThemePreference } from "./config";
import { initLeaves } from "./leaves";
import { notes } from "./notes-data";
import { markdownToHtml } from "./markdown";
import { createReaderMotion } from "./reader-motion";
import { createCollectionMotion, createPaperMotion } from "./notes-motion";
import "./notes.css";

const root = required(document, "#ginkgo-notes");
const grid = required(root, "#notes-grid");
const search = required<HTMLInputElement>(root, "#notes-search");
const dialog = required<HTMLDialogElement>(root, "#reader");
const readerTitle = required(root, "#reader-title");
const filters = required(root, ".filters");
filters.replaceChildren(...["全部", ...new Set(notes.map(note => note.category))].map(category => {
  const button = element("button", "", category);
  button.dataset.category = category;
  if (category === "全部") button.append(element("span", "", String(notes.length).padStart(2, "0")));
  return button;
}));
const categoryButtons = [...root.querySelectorAll<HTMLButtonElement>("[data-category]")];
const previous = required<HTMLButtonElement>(root, "#previous-note");
const next = required<HTMLButtonElement>(root, "#next-note");
const icons = { ArrowUpLeft, ArrowUpRight, ArrowLeft, ArrowRight, Sun, Moon, Monitor, Wind, Search, Feather, X };
const refreshIcons = () => createIcons({ icons, attrs: { "stroke-width": 1.4, "aria-hidden": "true" } });
let category = "全部";
let selectedIndex = -1;
let openingLink: HTMLAnchorElement | null = null;
const readerMotion = createReaderMotion(dialog, siteConfig.motion);
const collectionMotion = createCollectionMotion(required(root, "#notes-results"), grid, siteConfig.motion);
const paperMotion = createPaperMotion(grid, siteConfig.motion, () => dialog.open);
const noteCards = new Map<string, HTMLElement>();
const indicator = element("span", "filter-indicator");
indicator.setAttribute("aria-hidden", "true");
filters.append(indicator);
let closing = false;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function icon(name: string) {
  const node = document.createElement("i");
  node.dataset.lucide = name;
  return node;
}

const landscape = `<svg class="landscape" viewBox="0 0 280 90" fill="none" aria-hidden="true"><path d="M0 64 Q36 35 79 51 T154 45 T230 43 T280 29 L280 90H0Z" fill="currentColor" opacity=".08"/><path d="M0 71Q46 49 88 61T167 53T280 51" stroke="currentColor" stroke-width=".7" opacity=".5"/><path d="M0 80Q62 65 108 75T218 65T280 69" stroke="currentColor" stroke-width=".6" opacity=".35"/><path d="M36 53V20M36 29L25 18M36 36L47 24M36 43L22 32M247 50V15M247 24L238 13M247 32L259 18M247 40L235 28" stroke="currentColor" stroke-width=".8" stroke-linecap="round" opacity=".6"/><circle cx="208" cy="20" r="9" fill="currentColor" opacity=".12"/><path d="M121 24l4-2 4 2m8-6 3-2 3 2" stroke="currentColor" stroke-width=".7" opacity=".65"/></svg>`;

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
  const filtered = notes.filter(note => (category === "全部" || note.category === category) && [note.title, note.excerpt, note.category, note.body].join(" ").toLocaleLowerCase().includes(query));
  const visibleCards: HTMLElement[] = [];
  for (const note of filtered) {
    const cached = noteCards.get(note.id);
    if (cached) { visibleCards.push(cached); continue; }
    const article = element("article", `note${note.style ? ` note-${note.style}` : ""}`);
    article.style.setProperty("--angle", `${[-1.6, 0, 1, -.6, 0, 1.2][notes.indexOf(note) % 6]}deg`);
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
    bottom.append(element("span", "note-index", `No. ${String(notes.length - notes.indexOf(note)).padStart(2, "0")}`), reading);
    link.append(bottom);
    link.addEventListener("click", event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      collectionMotion.finish();
      openingLink = link;
    });
    article.append(link);
    noteCards.set(note.id, article);
    visibleCards.push(article);
  }
  const updateCards = () => {
    grid.replaceChildren(...visibleCards);
    required(root, "#empty-state").hidden = filtered.length > 0;
    grid.hidden = !filtered.length;
  };
  paperMotion.reset();
  if (transition) collectionMotion.change(updateCards);
  else updateCards();
  required(root, "#result-count").textContent = `${String(filtered.length).padStart(2, "0")} 篇随笔`;
  required(root, "#collection-label").textContent = query ? `搜索「${search.value.trim()}」` : category === "全部" ? "散落的篇章" : category;
  categoryButtons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.category === category)));
  moveIndicator();
  refreshIcons();
}
categoryButtons.forEach(button => button.addEventListener("click", () => { if (category === button.dataset.category) return; category = button.dataset.category!; render(true); }));
search.addEventListener("input", () => render(true));
required(root, "#reset-search").addEventListener("click", () => { category = "全部"; search.value = ""; render(true); search.focus(); });
required(root, '[data-category="全部"] span').textContent = String(notes.length).padStart(2, "0");

function syncReader() {
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
  collectionMotion.finish();
  paperMotion.reset();
  readerMotion.reset();
  closing = false;
  const note = notes[selectedIndex];
  openingLink = [...grid.querySelectorAll<HTMLAnchorElement>(".note-link")].find(link => link.dataset.noteId === note.id) ?? null;
  readerTitle.textContent = note.title;
  required(root, "#reader-meta").textContent = `${note.date.replaceAll("-", ".")}  /  ${note.category}`;
  required(root, "#reader-content").innerHTML = markdownToHtml(note.body);
  required(root, "#reader-position").textContent = `${selectedIndex + 1} / ${notes.length}`;
  previous.disabled = selectedIndex === 0;
  next.disabled = selectedIndex === notes.length - 1;
  document.title = `${note.title.replaceAll("\n", "")} · 银杏与风`;
  required(root, ".qp-page").classList.add("qp-entering");
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  readerTitle.focus({ preventScroll: true });
  void readerMotion.open(openingLink, note.animation, changing, direction);
}
async function closeReader(updateUrl = true) {
  if (closing || !dialog.open) return;
  closing = true;
  if (updateUrl) history.replaceState(null, "", `${location.pathname}${location.search}`);
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
  required(root, ".qp-page").classList.remove("qp-entering");
  document.title = "随笔 Notes · 银杏与风";
  if (openingLink?.isConnected) openingLink.focus({ preventScroll: true });
  openingLink = null;
});
previous.addEventListener("click", () => { if (!closing && selectedIndex > 0) location.hash = `note=${encodeURIComponent(notes[selectedIndex - 1].id)}`; });
next.addEventListener("click", () => { if (!closing && selectedIndex < notes.length - 1) location.hash = `note=${encodeURIComponent(notes[selectedIndex + 1].id)}`; });
window.addEventListener("hashchange", syncReader);

const themeTrigger = required<HTMLButtonElement>(root, "#theme-trigger");
const themeMenu = required(root, "#theme-menu");
const systemTheme = matchMedia("(prefers-color-scheme: dark)");
const themeButtons = [...root.querySelectorAll<HTMLButtonElement>("button[data-theme]")];
let theme: ThemePreference = siteConfig.defaultTheme;
try {
  const stored = localStorage.getItem("ginkgo-theme");
  if (stored === "light" || stored === "dark" || stored === "system") theme = stored;
} catch {}
function applyTheme() {
  const resolved = theme === "system" ? systemTheme.matches ? "dark" : "light" : theme;
  document.documentElement.style.colorScheme = resolved;
  required(root, ".qp-page").dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#162028" : "#f8fafb");
  root.querySelectorAll<HTMLElement>("[data-theme-icon]").forEach(node => node.toggleAttribute("hidden", node.dataset.themeIcon !== resolved));
  themeButtons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.theme === theme)));
}
function closeTheme(focus = false) { themeMenu.hidden = true; themeTrigger.setAttribute("aria-expanded", "false"); if (focus) themeTrigger.focus(); }
themeTrigger.addEventListener("click", () => { themeMenu.hidden = !themeMenu.hidden; themeTrigger.setAttribute("aria-expanded", String(!themeMenu.hidden)); });
themeButtons.forEach(button => button.addEventListener("click", () => {
  theme = button.dataset.theme as ThemePreference;
  try { localStorage.setItem("ginkgo-theme", theme); } catch {}
  applyTheme(); closeTheme(true);
}));
systemTheme.addEventListener("change", applyTheme);
document.addEventListener("pointerdown", event => { if (!(event.target as Element).closest(".theme-switch")) closeTheme(); });
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !themeMenu.hidden) closeTheme(true);
  if (event.key === "/" && !dialog.open && !event.ctrlKey && !event.metaKey && !event.altKey && !(event.target as Element).closest("input, textarea, [contenteditable]")) { event.preventDefault(); search.focus(); }
});
root.addEventListener("ginkgo:gust", () => { paperMotion.release(); required(root, "#announcement").textContent = "风吹过，银杏叶轻轻散开。"; });

render();
applyTheme();
initLeaves(root, { ...siteConfig.leaves, desktopCount: 28, mobileCount: 14, size: .8 }, {
  target: root,
  cardSelector: ".note-link",
  ignoreSelector: ".site-header, .collection-toolbar, button, input, dialog, .note-ghost",
  enabled: () => !dialog.open,
});
syncReader();
