import type { SiteConfig } from "./config";

type MotionConfig = SiteConfig["motion"];
const ease = "cubic-bezier(.22,.65,.18,1)";
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Animate card positions on their wrappers, independently from the paper's tilt. */
export function createCollectionMotion(container: HTMLElement, grid: HTMLElement, config: MotionConfig) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let running: Animation[] = [];
  let ghosts: HTMLElement[] = [];
  let revision = 0;
  function finish() {
    revision++;
    running.forEach(animation => animation.cancel());
    running = [];
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
    const animate = (node: Element, frames: Keyframe[], duration: number, delay = 0) => {
      const animation = node.animate(frames, { duration: duration / speed, delay: delay / speed, easing: ease, fill: "both" });
      running.push(animation);
      return animation.finished.catch(() => undefined);
    };
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
  return { change, finish };
}

const axes = ["x", "y", "rx", "ry", "rz", "scale", "fold"] as const;
type Axis = typeof axes[number];
type Pose = Record<Axis, number>;
const rest = (): Pose => ({ x: 0, y: 0, rx: 0, ry: 0, rz: 0, scale: 1, fold: 0 });
interface Paper { node: HTMLElement; value: Pose; target: Pose; velocity: Pose; }

/** The same spring/drag model as the portal, with a smaller reading-page range. */
export function createPaperMotion(grid: HTMLElement, config: MotionConfig, blocked: () => boolean) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const papers = new Map<HTMLElement, Paper>();
  let active: Paper | null = null, raf = 0, lastFrame = 0;
  const enabled = () => config.responsiveMotion && !reduced.matches && !document.hidden && !blocked();
  function paint(paper: Paper) {
    for (const axis of axes) {
      const unit = axis === "scale" ? "" : axis === "x" || axis === "y" ? "px" : "deg";
      paper.node.style.setProperty(`--paper-${axis}`, `${paper.value[axis]}${unit}`);
    }
  }
  function get(node: HTMLElement): Paper {
    let paper = papers.get(node);
    if (!paper) {
      paper = { node, value: rest(), target: rest(), velocity: { ...rest(), scale: 0 } };
      papers.set(node, paper);
    }
    return paper;
  }
  function wake() { if (!raf && enabled()) raf = requestAnimationFrame(frame); }
  function frame(now: number) {
    raf = 0;
    if (!enabled()) { reset(); return; }
    const dt = lastFrame ? Math.min((now - lastFrame) / 1000, .028) : 1 / 60;
    lastFrame = now;
    let moving = false;
    const softness = Math.max(.1, config.softness);
    const stiffness = 205 / softness, damping = 22 / Math.sqrt(softness);
    for (const [node, paper] of papers) {
      if (!node.isConnected) { papers.delete(node); continue; }
      for (const axis of axes) {
        const breeze = config.breeze && active === paper && axis === "y" ? Math.sin(now * .0012) * .65 : 0;
        const target = paper.target[axis] + breeze;
        const force = (target - paper.value[axis]) * stiffness - paper.velocity[axis] * damping;
        paper.velocity[axis] += force * dt;
        paper.value[axis] += paper.velocity[axis] * dt;
        const tolerance = axis === "scale" ? .0002 : .008;
        if (Math.abs(target - paper.value[axis]) > tolerance || Math.abs(paper.velocity[axis]) > tolerance * 8) moving = true;
        else { paper.value[axis] = target; paper.velocity[axis] = 0; }
      }
      paint(paper);
    }
    if (moving || (active && config.breeze)) wake();
    else lastFrame = 0;
  }
  function release() { if (active) active.target = rest(); active = null; wake(); }
  function reset() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0; lastFrame = 0; active = null;
    papers.forEach(paper => { paper.value = rest(); paper.target = rest(); paper.velocity = { ...rest(), scale: 0 }; paint(paper); });
  }
  function aim(node: HTMLElement, x: number, y: number) {
    const paper = get(node);
    if (active !== paper) release();
    active = paper;
    const angle = parseFloat(getComputedStyle(node).getPropertyValue("--angle")) || 0;
    paper.target = { x: x * 3, y: -8 + y * 1.5, rx: -y * 4, ry: x * 4.5, rz: -angle * .6 + x * 1.1, scale: 1.012, fold: -x * 9 - y * 5 };
    wake();
  }
  grid.addEventListener("pointermove", event => {
    if (!enabled() || !fine.matches || event.pointerType === "touch" || event.buttons) return;
    const node = (event.target as Element).closest<HTMLElement>(".note-link");
    if (!node) { release(); return; }
    // Use the un-tilted wrapper so pointer tracking cannot chase its own transform.
    const rect = node.parentElement!.getBoundingClientRect();
    aim(node, clamp((event.clientX - rect.left) / rect.width * 2 - 1, -1, 1), clamp((event.clientY - rect.top) / rect.height * 2 - 1, -1, 1));
  });
  grid.addEventListener("pointerleave", release);
  grid.addEventListener("focusin", event => {
    const node = (event.target as Element).closest<HTMLElement>(".note-link");
    if (node && enabled() && node.matches(":focus-visible")) aim(node, 0, 0);
  });
  grid.addEventListener("focusout", release);
  grid.addEventListener("pointerdown", event => {
    if (!enabled() || event.button !== 0 || event.pointerType === "touch") return;
    const node = (event.target as Element).closest<HTMLElement>(".note-link");
    if (node) { const paper = get(node); paper.target.scale = .994; wake(); }
  });
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
  window.addEventListener("blur", reset);
  window.addEventListener("scroll", release, { passive: true });
  document.addEventListener("visibilitychange", reset);
  reduced.addEventListener("change", reset);
  fine.addEventListener("change", reset);
  return { reset, release };
}
