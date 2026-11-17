import { createAnimationGroup } from "../../shared/animation-group.ts";
import type { SiteConfig } from "../../config/types";

/** Animate height in both directions. Rapid toggles continue from the visible height. */
export function bindSectionDisclosure(container: HTMLElement, rows: HTMLElement[], button: HTMLButtonElement, count: number, config: SiteConfig["motion"]) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let expanded = false;
  let revision = 0;
  const animations = createAnimationGroup();
  function settle() {
    revision++;
    animations.cancel();
    container.style.removeProperty("overflow");
    rows.forEach((row, index) => { row.hidden = !expanded && index >= count; });
  }
  button.addEventListener("click", () => {
    const before = container.getBoundingClientRect().height;
    settle();
    expanded = !expanded;
    button.textContent = expanded ? "收起 −" : `展开全部 (${rows.length}) +`;
    button.setAttribute("aria-expanded", String(expanded));
    rows.forEach((row, index) => { row.hidden = !expanded && index >= count; });
    const after = container.getBoundingClientRect().height;
    if (reduced.matches || !config.responsiveMotion || !container.animate) return;
    // Keep the exiting rows mounted until the collapsing viewport has closed.
    rows.forEach(row => { row.hidden = false; });
    container.style.overflow = "clip";
    const token = revision;
    const time = 560 / config.transitionSpeed;
    const work = (node: HTMLElement, frames: Keyframe[], duration = time) =>
      animations.play(node, frames, { duration });
    const tasks = [work(container, [{ height: `${before}px` }, { height: `${after}px` }])];
    for (const row of rows.slice(count)) {
      tasks.push(work(row, expanded
        ? [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }]
        : [{ opacity: 1 }, { opacity: 0 }], time * .8));
    }
    void Promise.all(tasks).then(() => { if (revision === token) settle(); });
  });
  reduced.addEventListener("change", settle);
  window.addEventListener("resize", settle);
  window.addEventListener("pagehide", settle);
  window.addEventListener("beforeprint", settle);
  document.addEventListener("visibilitychange", () => { if (document.hidden) settle(); });
  return { settle };
}
