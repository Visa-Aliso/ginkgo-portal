/** Look up a required template element and identify missing selectors in errors. */
export function required<T extends Element = HTMLElement>(
  root: ParentNode,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

export function destination(url: string): string | null {
  if (!url.trim()) return null;
  try {
    const parsed = new URL(url, document.baseURI);
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
export function icon(name: string) {
  const node = document.createElement("i");
  node.dataset.lucide = name;
  return node;
}
