import type { ThemePreference } from "./config";
import { required } from "./dom.ts";
import { preferenceKeys, readPreference, writePreference } from "./preferences.ts";

interface ThemeOptions {
  defaultTheme: ThemePreference;
  blocked?: () => boolean;
  beforeChange?: (resolved: "light" | "dark") => void;
}
const validTheme = (value: string | null): value is ThemePreference =>
  value === "light" || value === "dark" || value === "system";

/** Both pages share preference persistence, menu behavior and history restore. */
export function initTheme(root: HTMLElement, options: ThemeOptions) {
  const page = required(root, ".qp-page");
  const trigger = required<HTMLButtonElement>(root, ".qp-theme-trigger, #theme-trigger");
  const menu = required(root, ".qp-theme-options, #theme-menu");
  const buttons = [...menu.querySelectorAll<HTMLButtonElement>("button[data-theme-choice], button[data-theme]")];
  const system = matchMedia("(prefers-color-scheme: dark)");
  const saved = readPreference(preferenceKeys.theme);
  let preference = validTheme(saved) ? saved : options.defaultTheme;

  function apply() {
    const resolved = preference === "system" ? system.matches ? "dark" : "light" : preference;
    options.beforeChange?.(resolved);
    page.style.colorScheme = resolved;
    page.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#162028" : "#f8fafb");
    root.querySelectorAll("[data-theme-icon]").forEach(icon => icon.toggleAttribute("hidden", (icon as HTMLElement).dataset.themeIcon !== resolved));
    buttons.forEach(button => button.setAttribute("aria-pressed", String((button.dataset.themeChoice ?? button.dataset.theme) === preference)));
  }
  function close(focus = false) {
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (focus) trigger.focus({ preventScroll: true });
  }
  trigger.addEventListener("click", () => {
    if (options.blocked?.() || trigger.disabled) return;
    menu.hidden = !menu.hidden;
    trigger.setAttribute("aria-expanded", String(!menu.hidden));
  });
  buttons.forEach(button => button.addEventListener("click", () => {
    const choice = button.dataset.themeChoice ?? button.dataset.theme ?? null;
    if (options.blocked?.() || !validTheme(choice)) return;
    preference = choice;
    writePreference(preferenceKeys.theme, preference);
    apply();
    close(true);
    const status = root.querySelector<HTMLElement>(".qp-announcement, #announcement");
    if (status) status.textContent = preference === "system" ? "外观已跟随系统。" : preference === "light" ? "已切换为浅色模式。" : "已切换为深色模式。";
  }));
  document.addEventListener("pointerdown", event => {
    if (!trigger.parentElement?.contains(event.target as Node)) close();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !menu.hidden) { event.preventDefault(); close(true); }
  });
  function refresh() {
    const stored = readPreference(preferenceKeys.theme);
    preference = validTheme(stored) ? stored : options.defaultTheme;
    close();
    apply();
  }
  system.addEventListener("change", () => { if (preference === "system") apply(); });
  window.addEventListener("storage", event => { if (event.key === preferenceKeys.theme || event.key === null) refresh(); });
  window.addEventListener("pageshow", refresh);
  apply();
  return { close, refresh };
}
