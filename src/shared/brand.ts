import { siteConfig } from "../config/site";

/** Keep the wordmark in sync across all document entries. */
export function initBrand(root: HTMLElement) {
  const name = siteConfig.name.trim() || "Ginkgo";
  for (const wordmark of root.querySelectorAll<HTMLElement>("[data-site-name]")) {
    wordmark.textContent = name;
    if (wordmark instanceof HTMLAnchorElement) {
      wordmark.setAttribute("aria-label", `${name}，返回引导页`);
    }
  }
}
