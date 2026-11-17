/** One-shot handoff between the portal's blue sheet and the Notes document. */
export const arrivalKey = "ginkgo-notes-arrival";
const warmed = new Set<string>();

export function localNotesDestination(url: string): URL | null {
  try {
    const target = new URL(url, location.href);
    const notes = new URL("./notes.html", location.href);
    return target.origin === location.origin && target.pathname === notes.pathname && !target.hash ? target : null;
  } catch { return null; }
}

export function warmNotesPage(url: string) {
  const target = localNotesDestination(url);
  if (!target || warmed.has(target.href)) return;
  warmed.add(target.href);
  // Warm the document and its entry assets during the existing paper animation.
  // Preloading modules fetches them but never runs the Notes application here.
  void fetch(target.href, { credentials: "same-origin", cache: "force-cache" })
    .then(async response => {
      if (!response.ok) throw new Error("Notes preload unavailable");
      const html = new DOMParser().parseFromString(await response.text(), "text/html");
      for (const node of html.querySelectorAll<HTMLLinkElement | HTMLScriptElement>('link[rel="stylesheet"], link[rel="modulepreload"], script[type="module"][src]')) {
        const asset = new URL(node.getAttribute("href") || node.getAttribute("src")!, target);
        if (asset.origin !== target.origin) continue;
        const stylesheet = node.getAttribute("rel") === "stylesheet";
        if ([...document.querySelectorAll<HTMLLinkElement>('link[rel="preload"], link[rel="modulepreload"]')].some(link => link.href === asset.href)) continue;
        const link = document.createElement("link");
        link.rel = stylesheet ? "preload" : "modulepreload";
        if (stylesheet) link.as = "style";
        else link.crossOrigin = "anonymous";
        link.href = asset.href;
        document.head.append(link);
      }
    }).catch(() => { warmed.delete(target.href); });
}

export function rememberNotesArrival(url: string, color: string, speed: number): boolean {
  const target = localNotesDestination(url);
  if (!target) return false;
  try {
    sessionStorage.setItem(arrivalKey, JSON.stringify({
      path: target.pathname + target.search,
      time: Date.now(),
      color,
      speed: Math.max(.2, Math.min(3, speed)),
    }));
    return true;
  } catch { return false; }
}

export async function enterNotes(root: HTMLElement) {
  const html = document.documentElement;
  if (!html.classList.contains("notes-arriving")) return;
  const color = html.style.getPropertyValue("--notes-arrival-color");
  const speed = Number(html.dataset.arrivalSpeed) || 1;
  clearTimeout(Number(html.dataset.arrivalTimeout));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const cover = document.createElement("div");
  cover.className = "notes-arrival-cover";
  cover.setAttribute("aria-hidden", "true");
  cover.style.background = color;
  document.body.append(cover);
  // The real cover replaces the early head mask within the same paint.
  html.classList.remove("notes-arriving");
  delete html.dataset.arrivalSpeed;
  delete html.dataset.arrivalTimeout;
  html.style.removeProperty("--notes-arrival-color");
  const animations: Animation[] = [];
  const wasInert = root.inert;
  root.inert = true;
  const finishEarly = () => animations.forEach(animation => animation.finish());
  const onMotionChange = () => { if (reduced.matches) finishEarly(); };
  const cleanup = () => {
    animations.forEach(animation => animation.cancel());
    cover.remove();
    root.inert = wasInert;
    window.removeEventListener("pagehide", cleanup);
    window.removeEventListener("resize", finishEarly);
    reduced.removeEventListener("change", onMotionChange);
  };
  window.addEventListener("pagehide", cleanup, { once: true });
  window.addEventListener("resize", finishEarly);
  reduced.addEventListener("change", onMotionChange);
  try {
    if (reduced.matches || !cover.animate) return;
    const duration = 1400 / speed;
    const animate = (node: Element, frames: Keyframe[], time: number, delay = 0) => {
      const animation = node.animate(frames, { duration: time / speed, delay: delay / speed, fill: "both", easing: "cubic-bezier(.22,.65,.18,1)" });
      animations.push(animation);
      return animation.finished.catch(() => undefined);
    };
    const target = root.querySelector<HTMLElement>(".note-blue .note-link");
    const bounds = target?.getBoundingClientRect();
    const visible = bounds && bounds.top < innerHeight && bounds.bottom > 0;
    const work: Promise<unknown>[] = [];
    if (visible) {
      const pose = `translate(${bounds.left}px, ${bounds.top}px) scale(${bounds.width / innerWidth}, ${bounds.height / innerHeight})`;
      const animation = cover.animate([
        { transform: "none", opacity: 1, borderRadius: "0" },
        { transform: pose, opacity: .95, borderRadius: "4px", offset: .86 },
        { transform: pose, opacity: 0, borderRadius: "4px" },
      ], { duration, fill: "both", easing: "cubic-bezier(.42,0,.22,1)" });
      animations.push(animation);
      work.push(animation.finished.catch(() => undefined));
    } else {
      work.push(animate(cover, [{ opacity: 1 }, { opacity: 0 }], 800));
    }
    for (const [index, node] of [...root.querySelectorAll(".site-header, .intro, .collection-toolbar, .collection-meta")].entries()) {
      work.push(animate(node, [{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], 680, 200 + index * 50));
    }
    for (const [index, node] of [...root.querySelectorAll(".note")].entries()) {
      work.push(animate(node, [{ opacity: 0, transform: "translateY(18px)" }, { opacity: 1, transform: "none" }], 720, 320 + Math.min(index * 50, 200)));
    }
    for (const node of root.querySelectorAll(".qp-leaves, .collection-end, .site-footer")) {
      work.push(animate(node, [{ opacity: 0 }, { opacity: getComputedStyle(node).opacity }], 600, 650));
    }
    await Promise.all(work);
  } finally { cleanup(); }
}
