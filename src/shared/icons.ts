import type { IconNode, SVGProps } from "lucide";
import replaceElement from "lucide/dist/esm/replaceElement.mjs";

// Narrow entry points also keep the development server from loading the full
// icon catalogue. Production tree-shaking alone does not cover local previews.
export { default as ArrowUpLeft } from "lucide/dist/esm/icons/arrow-up-left.mjs";
export { default as ArrowUpRight } from "lucide/dist/esm/icons/arrow-up-right.mjs";
export { default as ArrowLeft } from "lucide/dist/esm/icons/arrow-left.mjs";
export { default as ArrowRight } from "lucide/dist/esm/icons/arrow-right.mjs";
export { default as Sun } from "lucide/dist/esm/icons/sun.mjs";
export { default as Moon } from "lucide/dist/esm/icons/moon.mjs";
export { default as Monitor } from "lucide/dist/esm/icons/monitor.mjs";
export { default as Wind } from "lucide/dist/esm/icons/wind.mjs";
export { default as Search } from "lucide/dist/esm/icons/search.mjs";
export { default as Feather } from "lucide/dist/esm/icons/feather.mjs";
export { default as X } from "lucide/dist/esm/icons/x.mjs";
export { default as BookOpen } from "lucide/dist/esm/icons/book-open.mjs";
export { default as CodeXml } from "lucide/dist/esm/icons/code-xml.mjs";
export { default as Mail } from "lucide/dist/esm/icons/mail.mjs";
export { default as Globe } from "lucide/dist/esm/icons/globe.mjs";
export { default as FileText } from "lucide/dist/esm/icons/file-text.mjs";

export function createIcons({ root = document, icons, attrs = {} }: {
  root?: ParentNode;
  icons: Record<string, IconNode>;
  attrs?: SVGProps;
}) {
  // Existing SVGs (including theme icons) remain intact when the list changes.
  for (const placeholder of root.querySelectorAll("i[data-lucide]")) {
    replaceElement(placeholder, { nameAttr: "data-lucide", icons, attrs });
  }
}
