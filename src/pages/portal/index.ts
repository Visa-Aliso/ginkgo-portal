import { initPageLifecycle } from "../../shared/page-lifecycle";
import { ArrowUpRight, Monitor, Moon, Sun, Wind, createIcons } from "../../shared/icons";
import { siteConfig, type EntryId } from "../../config/site";
import { required, destination } from "../../shared/dom";
import { initPortal } from "./motion";
import { initLeaves } from "../../effects/leaves";
import { initBrand } from "../../shared/brand";

const root = required(document, "#ginkgo-wind-portal");
initPageLifecycle(root);
initBrand(root);
document.title = siteConfig.name.trim()
  ? `${siteConfig.name} · 银杏与风`
  : "银杏与风";

for (const link of root.querySelectorAll<HTMLAnchorElement>(".qp-window")) {
  const id = link.dataset.site!.toLowerCase() as EntryId;
  const entry = siteConfig.entries[id];
  const url = destination(entry.url);
  link.dataset.entry = id;
  link.href = url ?? `#${id}`;
  link.draggable = false;
  link.setAttribute(
    "aria-label",
    `${entry.label}，${entry.caption}${url ? "" : "，预览展开动画"}`,
  );
  required(link, ".qp-word").textContent = entry.label;
  required(link, ".qp-caption").textContent = entry.caption;
}

createIcons({
  icons: { ArrowUpRight, Monitor, Moon, Sun, Wind },
  attrs: { width: 18, height: 18, "stroke-width": 1.5 },
});
initPortal(root, siteConfig);
// Reveal only after layout() has assigned card sizes and positions.
clearTimeout(Number(document.documentElement.dataset.portalBootTimer));
delete document.documentElement.dataset.portalBootTimer;
document.documentElement.classList.remove("portal-loading");
initLeaves(root, siteConfig.leaves);
