import { createAnimationGroup } from "../../shared/animation-group.ts";
import type { NoteAnimation } from "./data";

/** A new navigation always supersedes the previous transition. */
export function createReaderMotion(dialog: HTMLDialogElement, config = { transitionSpeed: 1, responsiveMotion: true }) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let sequence = 0;
  const animations = createAnimationGroup();
  let restoreHeight: (() => void) | null = null;
  const duration = (milliseconds: number) => milliseconds / Math.max(.2, Math.min(3, config.transitionSpeed));
  function reset() {
    sequence++;
    animations.cancel();
    dialog.classList.remove("reader-closing");
    dialog.classList.remove("reader-changing");
    restoreHeight?.();
    restoreHeight = null;
  }
  const finish = animations.finish;
  window.addEventListener("resize", finish);
  window.addEventListener("pagehide", finish);
  document.addEventListener("visibilitychange", () => { if (document.hidden) finish(); });
  reduced.addEventListener("change", () => {
    if (reduced.matches) finish();
  });
  const animate = animations.play;
  function cardPose(source: HTMLElement | null, kind: NoteAnimation): string {
    const target = dialog.getBoundingClientRect();
    const from = source?.getBoundingClientRect();
    if (!from || from.bottom < 0 || from.top > innerHeight || from.right < 0 || from.left > innerWidth) return "translateY(20px) scale(.96)";
    const x = from.left + from.width / 2 - target.left - target.width / 2;
    const y = from.top + from.height / 2 - target.top - target.height / 2;
    const tilt = kind === "turn" ? "rotateY(-24deg) rotateZ(-4deg)" : kind === "lift" ? "rotateZ(3deg)" : "rotateX(-18deg)";
    return `perspective(1400px) translate(${x}px, ${y}px) ${tilt} scale(${from.width / target.width}, ${from.height / target.height})`;
  }
  async function open(source: HTMLElement | null, kind: NoteAnimation) {
    reset();
    if (reduced.matches || !config.responsiveMotion || !dialog.animate) return;
    const token = sequence;
    const article = dialog.querySelector(".reader-article")!;
    const pose = kind === "fade" ? "translateY(14px) scale(.98)" : cardPose(source, kind);
    const time = duration(kind === "fade" ? 420 : kind === "lift" ? 650 : 720);
    dialog.style.setProperty("--reader-open-time", `${time}ms`);
    await Promise.all([
      animate(dialog, [{ opacity: .35, transform: pose }, { opacity: 1, transform: "none" }], { duration: time }),
      animate(article, [{ opacity: .15, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: time * .8 }),
    ]);
    if (sequence === token) reset();
  }
  async function change(direction: number, commit: () => void): Promise<boolean> {
    const article = dialog.querySelector(".reader-article")!;
    const animated = () => !reduced.matches && config.responsiveMotion && !document.hidden && Boolean(dialog.animate);
    if (!animated()) { reset(); commit(); return true; }
    // Snapshot before cancelling a preceding turn so rapid input continues from
    // the current visible pose. Keep the old DOM until it has faded out.
    const current = getComputedStyle(article);
    const from = { opacity: current.opacity, transform: current.transform };
    const oldHeight = dialog.getBoundingClientRect().height;
    reset();
    const token = sequence;
    const originalHeight = dialog.style.getPropertyValue("height");
    restoreHeight = () => {
      if (originalHeight) dialog.style.setProperty("height", originalHeight);
      else dialog.style.removeProperty("height");
    };
    dialog.style.setProperty("height", `${oldHeight}px`);
    dialog.classList.add("reader-changing");
    try {
      await animate(article, [from, { opacity: 0, transform: `translateX(${-direction * 24}px)` }], {
        duration: duration(240), easing: "ease-in-out",
      });
      if (token !== sequence || !dialog.open) return false;
      commit();
      // Measure the new page while the outgoing animation still hides its text.
      restoreHeight!();
      const newHeight = dialog.getBoundingClientRect().height;
      if (!animated()) return true;
      dialog.style.setProperty("height", `${oldHeight}px`);
      const work = [animate(article, [
        { opacity: 0, transform: `translateX(${direction * 24}px)` },
        { opacity: 1, transform: "none" },
      ], { duration: duration(420) })];
      if (Math.abs(newHeight - oldHeight) > 1) work.push(animate(dialog, [
        { height: `${oldHeight}px` }, { height: `${newHeight}px` },
      ], { duration: duration(420) }));
      await Promise.all(work);
      return token === sequence;
    } finally {
      if (token === sequence) reset();
    }
  }
  async function close(source: HTMLElement | null, kind: NoteAnimation): Promise<boolean> {
    const current = getComputedStyle(dialog);
    const start = { transform: current.transform, opacity: current.opacity };
    reset();
    const token = sequence;
    if (reduced.matches || !config.responsiveMotion || !dialog.animate) return true;
    dialog.style.setProperty("--reader-close-time", `${duration(420)}ms`);
    dialog.classList.add("reader-closing");
    const pose = kind === "fade" ? "translateY(12px) scale(.97)" : cardPose(source, kind);
    await animate(dialog, [start, { transform: pose, opacity: 0 }], { duration: duration(420), easing: "cubic-bezier(.4,0,.3,1)" });
    return sequence === token;
  }
  return { open, change, close, reset };
}
