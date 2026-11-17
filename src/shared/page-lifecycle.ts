/** Keep document state for Back while allowing hidden rendering layers to retire. */
export function initPageLifecycle(root: HTMLElement) {
  let active = true, suspended = false;
  const refresh = () => {
    const next = !active || document.hidden;
    if (next === suspended) return;
    suspended = next;
    if (next) {
      // Skipping descendants must not collapse document height / lose scroll position.
      const bounds = root.getBoundingClientRect();
      root.style.setProperty("--suspended-size", `${bounds.width}px ${bounds.height}px`);
      root.setAttribute("data-page-suspended", "");
    } else {
      root.removeAttribute("data-page-suspended");
      root.style.removeProperty("--suspended-size");
    }
  };
  window.addEventListener("pagehide", () => { active = false; refresh(); });
  window.addEventListener("pageshow", () => { active = true; refresh(); });
  document.addEventListener("visibilitychange", refresh);
  refresh();
}
