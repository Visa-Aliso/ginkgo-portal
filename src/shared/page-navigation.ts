/** Same-origin page preloading and one-shot navigation metadata. */
export type ContentPage = "notes" | "profile";
let warmedUrl = "";
let cancelWarm: (() => void) | null = null;

export function localContentDestination(url: string, page: ContentPage = "notes"): URL | null {
  try {
    const target = new URL(url, location.href);
    const expected = new URL(`./${page}.html`, location.href);
    return target.origin === location.origin && target.pathname === expected.pathname && !target.hash ? target : null;
  } catch { return null; }
}

export function warmContentPage(url: string, page: ContentPage = "notes") {
  const target = localContentDestination(url, page);
  if (!target || warmedUrl === target.href) return;
  cancelWarm?.();
  const controller = new AbortController();
  const links: HTMLLinkElement[] = [];
  let timeout = 0;
  const cleanup = () => {
    controller.abort();
    links.forEach(link => link.remove());
    links.length = 0;
    clearTimeout(timeout);
    window.removeEventListener("pagehide", cleanup);
    if (cancelWarm === cleanup) { cancelWarm = null; warmedUrl = ""; }
  };
  cancelWarm = cleanup;
  warmedUrl = target.href;
  window.addEventListener("pagehide", cleanup, { once: true });
  timeout = window.setTimeout(cleanup, 10000);
  // Only the clicked destination is warmed. Fetch script bytes without compiling
  // another page's module graph into the portal's module map / history cache.
  void fetch(target.href, { credentials: "same-origin", cache: "default", signal: controller.signal })
    .then(async response => {
      if (!response.ok) throw new Error("Page preload unavailable");
      const source = await response.text();
      if (controller.signal.aborted) return;
      const html = new DOMParser().parseFromString(source, "text/html");
      const seen = new Set<string>();
      for (const node of html.querySelectorAll<HTMLLinkElement | HTMLScriptElement>('link[rel="stylesheet"], link[rel="modulepreload"], script[type="module"][src]')) {
        const asset = new URL(node.getAttribute("href") || node.getAttribute("src")!, target);
        if (asset.origin !== target.origin || seen.has(asset.href)) continue;
        seen.add(asset.href);
        const stylesheet = node.getAttribute("rel") === "stylesheet";
        const link = document.createElement("link");
        link.rel = "preload";
        link.as = stylesheet ? "style" : "script";
        if (!stylesheet) link.crossOrigin = "anonymous";
        link.href = asset.href;
        links.push(link);
        document.head.append(link);
      }
    }).catch(cleanup);
}

export function rememberPageArrival(url: string, color: string, speed: number, page: ContentPage = "notes"): boolean {
  const target = localContentDestination(url, page);
  if (!target) return false;
  try {
    sessionStorage.setItem(`ginkgo-${page}-arrival`, JSON.stringify({
      path: target.pathname + target.search,
      time: Date.now(),
      color,
      speed: Math.max(.2, Math.min(3, speed)),
    }));
    return true;
  } catch { return false; }
}

