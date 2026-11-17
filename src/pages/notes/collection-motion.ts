import { createAnimationGroup } from "../../shared/animation-group.ts";
import type { SiteConfig } from "../../config/site";

type MotionConfig = SiteConfig["motion"];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Animate card positions on their wrappers, independently from the paper's tilt. */
export function createCollectionMotion(container: HTMLElement, grid: HTMLElement, config: MotionConfig) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const animations = createAnimationGroup();
  let ghosts: HTMLElement[] = [];
  let revision = 0;
  function finish() {
    revision++;
    animations.cancel();
    ghosts.forEach(ghost => ghost.remove());
    ghosts = [];
  }
  function change(update: () => void) {
    const oldHeight = container.getBoundingClientRect().height;
    const before = new Map([...grid.children].map(node => [node, node.getBoundingClientRect()]));
    finish();
    update();
    if (reduced.matches || !config.responsiveMotion || !container.animate) return;
    const token = revision;
    const bounds = container.getBoundingClientRect();
    const speed = clamp(config.transitionSpeed, .2, 3);
    const animate = (node: Element, frames: Keyframe[], duration: number, delay = 0) =>
      animations.play(node, frames, { duration: duration / speed, delay: delay / speed });
    const work: Promise<unknown>[] = [];
    // Removed notes fade in place while remaining notes move into their new slots.
    for (const [node, rect] of before) {
      if (node.parentElement === grid) continue;
      const ghost = node.cloneNode(true) as HTMLElement;
      ghost.inert = true;
      ghost.setAttribute("aria-hidden", "true");
      ghost.classList.add("note-ghost");
      Object.assign(ghost.style, { position: "absolute", left: `${rect.left - bounds.left}px`, top: `${rect.top - bounds.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, pointerEvents: "none" });
      container.append(ghost);
      ghosts.push(ghost);
      work.push(animate(ghost, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-8px) scale(.97)" }], 260));
    }
    [...grid.children].forEach((node, index) => {
      const old = before.get(node);
      const current = node.getBoundingClientRect();
      if (old) {
        const x = old.left - current.left, y = old.top - current.top;
        if (Math.abs(x) + Math.abs(y) > .5) work.push(animate(node, [{ transform: `translate(${x}px, ${y}px)` }, { transform: "none" }], 450));
      } else {
        work.push(animate(node, [{ opacity: 0, transform: "translateY(13px) scale(.98)" }, { opacity: 1, transform: "none" }], 400, Math.min(index * 24, 72)));
      }
    });
    if (Math.abs(oldHeight - bounds.height) > 1) work.push(animate(container, [{ height: `${oldHeight}px` }, { height: `${bounds.height}px` }], 450));
    const empty = container.querySelector<HTMLElement>("#empty-state");
    if (empty && !empty.hidden) work.push(animate(empty, [{ opacity: 0 }, { opacity: 1 }], 320));
    void Promise.all(work).then(() => { if (revision === token) finish(); });
  }
  reduced.addEventListener("change", finish);
  window.addEventListener("resize", finish);
  window.addEventListener("pagehide", finish);
  document.addEventListener("visibilitychange", () => { if (document.hidden) finish(); });
  return { change, finish };
}

