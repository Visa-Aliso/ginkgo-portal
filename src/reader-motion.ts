import type { NoteAnimation } from "./notes-data";

/** A new navigation always supersedes the previous transition. */
export function createReaderMotion(dialog: HTMLDialogElement, config = { transitionSpeed: 1, responsiveMotion: true }) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let sequence = 0;
  let running: Animation[] = [];
  const duration = (milliseconds: number) => milliseconds / Math.max(.2, Math.min(3, config.transitionSpeed));
  function reset() {
    sequence++;
    running.forEach(animation => animation.cancel());
    running = [];
    dialog.classList.remove("reader-closing");
  }
  reduced.addEventListener("change", () => {
    if (reduced.matches) running.forEach(animation => animation.finish());
  });
  function animate(target: Element, frames: Keyframe[], options: KeyframeAnimationOptions) {
    const animation = target.animate(frames, { fill: "both", easing: "cubic-bezier(.22,.65,.18,1)", ...options });
    running.push(animation);
    return animation.finished.catch(() => undefined);
  }
  function cardPose(source: HTMLElement | null, kind: NoteAnimation): string {
    const target = dialog.getBoundingClientRect();
    const from = source?.getBoundingClientRect();
    if (!from || from.bottom < 0 || from.top > innerHeight || from.right < 0 || from.left > innerWidth) return "translateY(20px) scale(.96)";
    const x = from.left + from.width / 2 - target.left - target.width / 2;
    const y = from.top + from.height / 2 - target.top - target.height / 2;
    const tilt = kind === "turn" ? "rotateY(-24deg) rotateZ(-4deg)" : kind === "lift" ? "rotateZ(3deg)" : "rotateX(-18deg)";
    return `perspective(1400px) translate(${x}px, ${y}px) ${tilt} scale(${from.width / target.width}, ${from.height / target.height})`;
  }
  async function open(source: HTMLElement | null, kind: NoteAnimation, changing = false, direction = 1) {
    reset();
    if (reduced.matches || !config.responsiveMotion || !dialog.animate) return;
    const token = sequence;
    const article = dialog.querySelector(".reader-article")!;
    const work: Promise<unknown>[] = [];
    if (changing) {
      work.push(animate(article, [{ opacity: .3, transform: `translateX(${direction * 14}px) rotateY(${direction * 2}deg)` }, { opacity: 1, transform: "none" }], { duration: duration(380) }));
    } else {
      const pose = kind === "fade" ? "translateY(14px) scale(.98)" : cardPose(source, kind);
      const time = duration(kind === "fade" ? 420 : kind === "lift" ? 650 : 720);
      dialog.style.setProperty("--reader-open-time", `${time}ms`);
      work.push(animate(dialog, [{ opacity: .35, transform: pose }, { opacity: 1, transform: "none" }], { duration: time }));
      work.push(animate(article, [{ opacity: .15, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: time * .8 }));
    }
    await Promise.all(work);
    if (sequence === token) { running.forEach(animation => animation.cancel()); running = []; }
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
  return { open, close, reset };
}
