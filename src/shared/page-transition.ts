import type { ContentPage } from "./page-navigation.ts";

/** Map the cover onto the paper itself, rather than its rotated bounding box. */
export function paperArrivalTransform(bounds: { left: number; top: number; width: number; height: number }, width: number, height: number, angle: number, viewport: { width: number; height: number }) {
  const radians = angle * Math.PI / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  const x = bounds.left + bounds.width / 2 - cos * width / 2 + sin * height / 2;
  const y = bounds.top + bounds.height / 2 - sin * width / 2 - cos * height / 2;
  return `matrix(${cos * width / viewport.width}, ${sin * width / viewport.width}, ${-sin * height / viewport.height}, ${cos * height / viewport.height}, ${x}, ${y})`;
}

export async function enterPage(root: HTMLElement, page: ContentPage = "notes", config = { responsiveMotion: true }) {
  const html = document.documentElement;
  if (!html.classList.contains(`${page}-arriving`)) return;
  const color = html.style.getPropertyValue(`--${page}-arrival-color`);
  const speed = Number(html.dataset.arrivalSpeed) || 1;
  clearTimeout(Number(html.dataset.arrivalTimeout));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const cover = page === "notes" ? document.createElement("div") : null;
  if (cover) {
    cover.className = "page-arrival-cover";
    cover.setAttribute("aria-hidden", "true");
    cover.style.background = color;
    document.body.append(cover);
  }
  // Hand off without a paint between these synchronous changes. Removing the
  // early class briefly restores the normal gutter so we can measure final layout.
  html.classList.remove(`${page}-arriving`);
  delete html.dataset.arrivalSpeed;
  delete html.dataset.arrivalTimeout;
  html.style.removeProperty(`--${page}-arrival-color`);
  const animations: Animation[] = [];
  const wasInert = root.inert;
  const previousWidth = root.style.getPropertyValue("--arrival-content-width");
  root.inert = true;
  const finishEarly = () => animations.forEach(animation => animation.finish());
  const onMotionChange = () => { if (reduced.matches) finishEarly(); };
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    animations.forEach(animation => animation.cancel());
    cover?.remove();
    html.classList.remove("page-arriving");
    if (previousWidth) root.style.setProperty("--arrival-content-width", previousWidth);
    else root.style.removeProperty("--arrival-content-width");
    root.inert = wasInert;
    window.removeEventListener("pagehide", cleanup);
    window.removeEventListener("resize", finishEarly);
    reduced.removeEventListener("change", onMotionChange);
  };
  window.addEventListener("pagehide", cleanup, { once: true });
  window.addEventListener("resize", finishEarly);
  reduced.addEventListener("change", onMotionChange);
  try {
    if (reduced.matches || !config.responsiveMotion) return;
    const animate = (node: Element, frames: Keyframe[], time: number, delay = 0, easing = "cubic-bezier(.22,.65,.18,1)") => {
      const animation = node.animate(frames, { duration: time / speed, delay: delay / speed, fill: "both", easing });
      animations.push(animation);
      return animation.finished.catch(() => undefined);
    };
    if (page === "profile") {
      // Fade only visible content; the real background and scrollbar stay put.
      // Separate sections avoid allocating a layer for the entire long CV.
      const work: Promise<unknown>[] = [];
      for (const node of root.querySelectorAll(".site-header, .profile-header, .profile-section, .profile-footer")) {
        const rect = node.getBoundingClientRect();
        if (typeof node.animate === "function" && rect.top < innerHeight && rect.bottom > 0) {
          work.push(animate(node, [{ opacity: 0 }, { opacity: 1 }], 1400, 0, "ease-in-out"));
        }
      }
      await Promise.all(work);
      return;
    }
    if (!cover?.animate) return;
    // Measure with the normal scrollbar, then hide it without widening content.
    root.style.setProperty("--arrival-content-width", `${root.getBoundingClientRect().width}px`);
    html.classList.add("page-arriving");
    cover.style.width = `${innerWidth}px`;
    cover.style.height = `${innerHeight}px`;
    const duration = 1400 / speed;
    const target = root.querySelector<HTMLElement>(".note-blue .note-link");
    const bounds = target?.getBoundingClientRect();
    const visible = bounds && bounds.top < innerHeight && bounds.bottom > 0;
    const work: Promise<unknown>[] = [];
    if (visible) {
      const paperStyle = getComputedStyle(target!);
      const paperWidth = target!.offsetWidth, paperHeight = target!.offsetHeight;
      const pose = paperArrivalTransform(bounds, paperWidth, paperHeight,
        parseFloat(paperStyle.getPropertyValue("--angle")) || 0,
        { width: innerWidth, height: innerHeight });
      const corners = [paperStyle.borderTopLeftRadius, paperStyle.borderTopRightRadius,
        paperStyle.borderBottomRightRadius, paperStyle.borderBottomLeftRadius].map(value => parseFloat(value) || 0);
      // Radius values are in the cover's coordinates, before nonuniform scaling.
      const radius = `${corners.map(value => value * innerWidth / paperWidth + "px").join(" ")} / ${corners.map(value => value * innerHeight / paperHeight + "px").join(" ")}`;
      const animation = cover.animate([
        { transform: "matrix(1, 0, 0, 1, 0, 0)", backgroundColor: color, borderRadius: "0" },
        { transform: pose, backgroundColor: paperStyle.backgroundColor, borderRadius: radius },
      ], { duration, fill: "both", easing: "cubic-bezier(.42,0,.22,1)" });
      animations.push(animation);
      work.push(animation.finished.catch(() => undefined));
      // Reveal the real paper only once both surfaces coincide, while the cover
      // is still opaque. Then fade just the cover, avoiding a double-alpha flash.
      const reveal = cover.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 360 / speed, delay: 1400 / speed, fill: "both", easing: "ease-in-out",
      });
      const paperReveal = (target!.parentElement ?? target!).animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 0, delay: 1400 / speed, fill: "both",
      });
      animations.push(paperReveal);
      work.push(paperReveal.finished.catch(() => undefined));
      animations.push(reveal);
      work.push(reveal.finished.catch(() => undefined));
    } else {
      work.push(animate(cover, [{ opacity: 1 }, { opacity: 0 }], 800));
    }
    for (const [index, node] of [...root.querySelectorAll(".site-header, .intro, .collection-toolbar, .collection-meta")].entries()) {
      work.push(animate(node, [{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], 680, 200 + index * 50));
    }
    for (const [index, node] of [...root.querySelectorAll(".note")].entries()) {
      if (target && node === target.parentElement) continue;
      const rect = node.getBoundingClientRect();
      if (rect.top >= innerHeight || rect.bottom <= 0) continue;
      work.push(animate(node, [{ opacity: 0, transform: "translateY(18px)" }, { opacity: 1, transform: "none" }], 720, 320 + Math.min(index * 50, 200)));
    }
    for (const node of root.querySelectorAll(".qp-leaves, .collection-end, .site-footer, .profile-footer")) {
      work.push(animate(node, [{ opacity: 0 }, { opacity: getComputedStyle(node).opacity }], 600, 650));
    }
    await Promise.all(work);
  } finally { cleanup(); }
}
